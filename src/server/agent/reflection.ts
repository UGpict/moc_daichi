import { getEnv } from "@/config/env";
import type { AppEvent, EventType, MemoryCandidate } from "@/domain/schemas";
import { newId } from "@/lib/ids";
import { realNowIso } from "@/lib/time";
import { callLLM } from "@/server/llm";
import { wrapUntrusted, systemFence } from "@/server/security/promptFence";
import { detectInjection } from "@/server/security/injection";
import { reflectionLlmSchema, reflectionStrictSchema, repairHintFor } from "@/server/llm/taskSchemas";
import { maskPii } from "@/server/privacy/mask";
import { candidateContentHash, validateMemoryCandidate } from "@/domain/memory/validateMemoryCandidate";
import { findRun, readStore, withRun, type CoupleBundle, type SessionBundle } from "@/server/repositories/store";
import {
  interpretConfirmation,
  mockFromNote,
  normalizeReflectionLlm,
  type NormalizedReflection,
} from "./reflectionNormalize";

async function appendEvent(runId: string, type: EventType, summary: string, extra: Partial<AppEvent> = {}) {
  await withRun(runId, (db) => {
    const found = findRun(db, runId);
    if (!found) return;
    const seq = Object.keys(found.bundle.events).length;
    found.bundle.events[newId("evt")] = {
      eventId: newId("evt"),
      runId,
      seq,
      at: realNowIso(),
      type,
      summary,
      evidenceIds: extra.evidenceIds ?? [],
      model: extra.model ?? null,
      pool: extra.pool ?? null,
      requestedModel: extra.requestedModel ?? null,
      actualModel: extra.actualModel ?? null,
      usage: extra.usage ?? null,
      payload: extra.payload ?? null,
    };
  });
}

function toStoredCandidates(
  found: { couple: CoupleBundle; bundle: SessionBundle },
  reflectionId: string,
  data: NormalizedReflection,
  masked: string,
): MemoryCandidate[] {
  const stored: MemoryCandidate[] = [];
  for (const c of data.memoryCandidates) {
    if (c.sourceType === "HYPOTHESIS") continue;
    const cid = newId("mc");
    const candidate: MemoryCandidate = {
      id: cid,
      coupleId: found.couple.couple.id,
      sessionId: found.bundle.session.id,
      reflectionId,
      answerId: null,
      subject: c.subject,
      type: c.type,
      content: c.content,
      sourceType: c.sourceType,
      evidenceQuote: c.evidenceQuote,
      strength: c.strength,
      scope: c.scope,
      careTarget: c.careTarget,
      careDirection: c.careDirection,
      createdAt: realNowIso(),
      injectionFlags: detectInjection(`${c.content}\n${c.evidenceQuote}\n${masked}`).map((f) => f.code),
    };
    const checked = validateMemoryCandidate(candidate);
    if (!checked.ok) continue;
    found.couple.memoryCandidates[cid] = candidate;
    stored.push(candidate);
  }
  return stored;
}

function enqueueMemoryApprovals(
  found: { couple: CoupleBundle; bundle: SessionBundle; run: { id: string } },
  runId: string,
  candidates: MemoryCandidate[],
) {
  for (const candidate of candidates) {
    if (candidate.sourceType === "HYPOTHESIS") continue;
    const approvalId = newId("appr");
    found.couple.approvals[approvalId] = {
      id: approvalId,
      coupleId: found.couple.couple.id,
      sessionId: found.bundle.session.id,
      runId,
      planVersionFrom: found.bundle.session.currentPlanVersion ?? 0,
      planVersionTo: found.bundle.session.currentPlanVersion ?? 0,
      kind: "MEMORY_SAVE",
      status: "PENDING",
      summary: (candidate.injectionFlags ?? []).length
        ? `警告 ${candidate.injectionFlags?.join(",")}: ${candidate.content}`
        : `記憶候補: ${candidate.content}`,
      diff: null,
      consumedAt: null,
      createdAt: realNowIso(),
      payloadId: candidate.id,
      payloadVersion: 1,
      candidateId: candidate.id,
      candidateVersion: 1,
      sourceMemoryId: null,
      sourceVersion: null,
      replacementCandidateId: null,
      presentedHash: candidateContentHash(candidate),
    };
  }
}

export async function runReflection(runId: string, signal: AbortSignal): Promise<void> {
  const env = getEnv();
  const loaded = await readStore((db) => findRun(db, runId), { runId });
  if (!loaded) return;

  if (loaded.run.waitingQuestion) {
    await withRun(runId, (db) => {
      const found = findRun(db, runId);
      if (!found) return;
      found.run.status = "SUCCEEDED";
      found.run.finishedAt = realNowIso();
      found.run.leaseOwner = null;
    });
    await appendEvent(runId, "RUN_FINISHED", "確認質問は作成済み。回答待ち");
    return;
  }

  const reflection = Object.values(loaded.couple.reflections)
    .filter((r) => r.sessionId === loaded.bundle.session.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const masked = reflection?.maskedNote ?? "";
  const mock = mockFromNote(masked);

  const llm = await callLLM({
    task: "reflect",
    schemaName: "reflection",
    repairHint: repairHintFor("reflection"),
    messages: [
      {
        role: "system",
        content: `${systemFence("reflect")} 原文の観察・原因の仮説・ユーザー確認済み事項を分離する。原文に書いてある事実だけを observations と OBSERVATION 候補にする。書いていない原因は hypotheses に置き、HYPOTHESIS を OBSERVATION に書き換えない。疲れていたとしか無いときは STANDING/WALKING を補完しない。原因が不明なら clarification を1問だけ出す。記憶候補に仮説を入れない。`,
      },
      {
        role: "user",
        content: wrapUntrusted("reflection_note", { maskedNote: masked, reflectionId: reflection?.id ?? null }),
      },
    ],
    schema: reflectionLlmSchema,
    strictSchema: reflectionStrictSchema,
    coerceSchema: reflectionLlmSchema,
    runId,
    signal,
    mockValue: mock,
  });

  for (const attempt of llm.attempts.length ? llm.attempts : [llm]) {
    await appendEvent(runId, "LLM_ATTEMPT", attempt.ok ? "振り返りLLM" : `振り返りLLM失敗: ${attempt.error ?? ""}`, {
      pool: attempt.pool,
      requestedModel: attempt.requestedModel,
      actualModel: attempt.actualModel,
      usage: {
        promptTokens: attempt.promptTokens,
        completionTokens: attempt.completionTokens,
        costUsd: attempt.costUsd,
        costJpy: attempt.costJpy,
        latencyMs: attempt.latencyMs,
        ok: attempt.ok,
      },
      payload: attempt.data
        ? {
            observations: attempt.data.observations.length,
            hypotheses: attempt.data.hypotheses?.length ?? 0,
            candidates: attempt.data.memoryCandidates.map((c) => ({
              sourceType: c.sourceType,
              type: c.type,
              content: c.content.slice(0, 80),
            })),
            hasClarification: Boolean(attempt.data.clarification),
          }
        : { error: attempt.error },
    });
  }
  await withRun(runId, (db) => {
    const found = findRun(db, runId);
    if (!found) return;
    found.run.cost.mundaneCalls += 1;
    if (llm.costJpy != null) found.run.cost.llmJpy = (found.run.cost.llmJpy ?? 0) + llm.costJpy;
    if (llm.costJpy == null && env.runtime === "LIVE") found.run.cost.unaccountedCalls += 1;
  });

  if (llm.coerced) await appendEvent(runId, "LLM_COERCED", "振り返りで寛容パースを最終手段として使用");

  const raw = llm.ok && llm.data ? llm.data : env.profile === "LIVE" ? { observations: [], hypotheses: [], uncertainties: [], clarification: null, memoryCandidates: [] } : mock;
  const data = normalizeReflectionLlm(
    {
      observations: raw.observations,
      hypotheses: "hypotheses" in raw ? raw.hypotheses : [],
      uncertainties: raw.uncertainties,
      clarification: raw.clarification,
      memoryCandidates: raw.memoryCandidates.map((c) => ({
        ...c,
        careTarget: c.careTarget ?? null,
        careDirection: c.careDirection ?? null,
      })),
    },
    masked,
  );
  const reflectionId = reflection?.id ?? newId("ref");
  let storedCandidates: MemoryCandidate[] = [];
  await withRun(runId, (db) => {
    const found = findRun(db, runId);
    if (!found) return;
    if (!found.couple.reflections[reflectionId]) {
      const maskedNow = maskPii(masked || "（原文なし）");
      found.couple.reflections[reflectionId] = {
        id: reflectionId,
        sessionId: found.bundle.session.id,
        coupleId: found.couple.couple.id,
        rawNote: maskedNow.masked,
        maskedNote: maskedNow.masked,
        createdAt: realNowIso(),
      };
    }
    storedCandidates = toStoredCandidates(found, reflectionId, data, masked);
  });

  const flagged = storedCandidates.filter((c) => (c.injectionFlags ?? []).length);
  if (flagged.length) {
    await appendEvent(runId, "INJECTION_FLAGGED", `記憶候補 ${flagged.length} 件に命令形・固定化の疑い`, {
      payload: flagged.map((c) => ({ id: c.id, flags: c.injectionFlags })),
    });
  }

  await appendEvent(runId, "NOTICE", "観察と仮説を分離した", {
    payload: {
      observations: data.observations,
      hypotheses: data.hypotheses,
      uncertainties: data.uncertainties,
      saveable: storedCandidates.map((c) => ({ id: c.id, sourceType: c.sourceType, careTarget: c.careTarget })),
    },
  });

  if (data.clarification) {
    const question = {
      id: newId("q"),
      prompt: data.clarification.prompt,
      options: data.clarification.options,
    };
    await withRun(runId, (db) => {
      const found = findRun(db, runId);
      if (!found) return;
      found.run.status = "WAITING_INPUT";
      found.run.waitingQuestion = question;
      found.run.leaseOwner = null;
    });
    await appendEvent(runId, "INPUT_REQUIRED", question.prompt, {
      payload: { question, reflectionId, hypotheses: data.hypotheses },
    });
    return;
  }

  await withRun(runId, (db) => {
    const found = findRun(db, runId);
    if (!found) return;
    enqueueMemoryApprovals(found, runId, storedCandidates);
    found.run.status = storedCandidates.length ? "WAITING_APPROVAL" : "SUCCEEDED";
    found.run.finishedAt = storedCandidates.length ? null : realNowIso();
    found.run.leaseOwner = null;
  });
  await appendEvent(runId, "RUN_FINISHED", storedCandidates.length ? "確認不要の観察候補の承認待ち" : "確認質問も候補も不要");
}

export function applyConfirmedAnswerInPlace(args: {
  couple: CoupleBundle;
  bundle: SessionBundle;
  runId: string;
  questionId: string;
  answer: string;
  reflectionId: string;
}): MemoryCandidate[] {
  const created: MemoryCandidate[] = [];
  const interpreted = interpretConfirmation(args.answer);
  const existing = Object.values(args.couple.memoryCandidates).filter(
    (c) => c.sessionId === args.bundle.session.id && !c.answerId && c.sourceType !== "HYPOTHESIS",
  );
  for (const cand of existing) {
    cand.answerId = args.questionId;
  }
  if (interpreted.saveCausal) {
    const cid = newId("mc");
    const candidate: MemoryCandidate = {
      id: cid,
      coupleId: args.couple.couple.id,
      sessionId: args.bundle.session.id,
      reflectionId: args.reflectionId,
      answerId: args.questionId,
      subject: "PARTNER",
      type: interpreted.careTarget ? "CARE" : "PREFERENCE",
      content: interpreted.content,
      sourceType: "PARTNER_STATEMENT_REPORTED",
      evidenceQuote: interpreted.content,
      strength: "SOFT",
      scope: "NEXT_DATE",
      careTarget: interpreted.careTarget,
      careDirection: interpreted.careDirection,
      createdAt: realNowIso(),
      injectionFlags: detectInjection(interpreted.content).map((f) => f.code),
    };
    if (validateMemoryCandidate(candidate).ok) {
      args.couple.memoryCandidates[cid] = candidate;
      created.push(candidate);
    }
  }
  const pending = [...existing, ...created];
  enqueueMemoryApprovals({ couple: args.couple, bundle: args.bundle, run: { id: args.runId } }, args.runId, pending);
  return pending;
}

export async function applyReflectionAnswer(args: {
  runId: string;
  questionId: string;
  answer: string;
}): Promise<void> {
  await withRun(args.runId, (db) => {
    const found = findRun(db, args.runId);
    if (!found) return;
    const masked = maskPii(args.answer);
    const reflectionId = newId("ref");
    found.couple.reflections[reflectionId] = {
      id: reflectionId,
      sessionId: found.bundle.session.id,
      coupleId: found.couple.couple.id,
      rawNote: masked.masked,
      maskedNote: masked.masked,
      createdAt: realNowIso(),
    };
    applyConfirmedAnswerInPlace({
      couple: found.couple,
      bundle: found.bundle,
      runId: args.runId,
      questionId: args.questionId,
      answer: args.answer,
      reflectionId,
    });
  });
}
