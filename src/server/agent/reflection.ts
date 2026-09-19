import { getEnv } from "@/config/env";
import type { AppEvent, EventType, MemoryCandidate } from "@/domain/schemas";
import { newId } from "@/lib/ids";
import { realNowIso } from "@/lib/time";
import { callLLM } from "@/server/llm";
import { reflectionLlmSchema, repairHintFor } from "@/server/llm/taskSchemas";
import { maskPii } from "@/server/privacy/mask";
import { candidateContentHash, validateMemoryCandidate } from "@/domain/memory/validateMemoryCandidate";
import { findRun, withStore } from "@/server/repositories/store";

async function appendEvent(runId: string, type: EventType, summary: string, extra: Partial<AppEvent> = {}) {
  await withStore((db) => {
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

function mockFromNote(masked: string) {
  const cafeOnly = /カフェ|甘い|ケーキ/.test(masked) && !/疲|立|歩|展示/.test(masked);
  if (cafeOnly) {
    return {
      observations: ["カフェが良かったという記述がある"],
      uncertainties: [] as string[],
      clarification: null as { prompt: string; options: string[] } | null,
      memoryCandidates: [
        {
          subject: "PARTNER" as const,
          type: "PREFERENCE" as const,
          content: "カフェが好評だった",
          sourceType: "OBSERVATION" as const,
          evidenceQuote: masked.slice(0, 80),
          strength: "SOFT" as const,
          scope: "NEXT_DATE" as const,
          careTarget: "SWEETS" as const,
          careDirection: "PREFER" as const,
        },
      ],
    };
  }
  const tired = /疲|立|歩/.test(masked);
  return {
    observations: tired ? ["疲労や歩行・立位への言及がある"] : ["振り返りの記述がある"],
    uncertainties: tired ? ["何が負担だったか"] : ([] as string[]),
    clarification: tired
      ? {
          prompt: "相手が大変そうにしていた点で、いちばん近いものは？",
          options: ["長く立つのがしんどいと言っていた", "歩く距離が長かった", "分からない", "保存しない"],
        }
      : null,
    memoryCandidates: tired
      ? [
          {
            subject: "PARTNER" as const,
            type: "CARE" as const,
            content: "長く立つと疲れる可能性がある",
            sourceType: "OBSERVATION" as const,
            evidenceQuote: masked.slice(0, 80),
            strength: "SOFT" as const,
            scope: "NEXT_DATE" as const,
            careTarget: "STANDING" as const,
            careDirection: "REDUCE" as const,
          },
        ]
      : [],
  };
}

export async function runReflection(runId: string, signal: AbortSignal): Promise<void> {
  const env = getEnv();
  const loaded = await withStore((db) => findRun(db, runId));
  if (!loaded) return;

  if (loaded.run.waitingQuestion) {
    await withStore((db) => {
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
        content:
          "振り返り原文（マスク済み）だけを根拠にする。原文に書かれている好み・疲労・制約は memoryCandidates に OBSERVATION として残す。evidenceQuote は原文からの抜粋。原文に原因（立つ/歩く等）が無い疲労は確定の苦手にせず、必要なら clarification を最大1問。原文だけで保存できるなら clarification は null。好みや疲労が原文にあるのに memoryCandidates を空にしない。仮説は sourceType=HYPOTHESIS。JSONのみ。",
      },
      {
        role: "user",
        content: JSON.stringify({
          maskedNote: masked,
          reflectionId: reflection?.id ?? null,
        }),
      },
    ],
    schema: reflectionLlmSchema,
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
  await withStore((db) => {
    const found = findRun(db, runId);
    if (!found) return;
    found.run.cost.mundaneCalls += 1;
    if (llm.costJpy != null) found.run.cost.llmJpy = (found.run.cost.llmJpy ?? 0) + llm.costJpy;
    if (llm.costJpy == null && env.runtime === "LIVE") found.run.cost.unaccountedCalls += 1;
  });

  if ((!llm.ok || !llm.data) && env.profile === "LIVE") {
    await withStore((db) => {
      const found = findRun(db, runId);
      if (!found) return;
      found.run.status = "FAILED";
      found.run.error = llm.error ?? "reflection LLM failed";
      found.run.finishedAt = realNowIso();
      found.run.leaseOwner = null;
    });
    await appendEvent(runId, "RUN_FINISHED", `振り返りLLM失敗: ${llm.error ?? "unknown"}`);
    return;
  }

  const data = llm.ok && llm.data ? llm.data : mock;
  const reflectionId = reflection?.id ?? newId("ref");
  const storedCandidates: MemoryCandidate[] = [];
  await withStore((db) => {
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
    for (const c of data.memoryCandidates) {
      const grounded =
        Boolean(c.evidenceQuote.trim()) &&
        (masked.includes(c.evidenceQuote.trim()) || masked.includes(c.evidenceQuote.trim().slice(0, 8)));
      if (c.sourceType === "HYPOTHESIS" && !grounded) continue;
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
        sourceType: c.sourceType === "HYPOTHESIS" && grounded ? "OBSERVATION" : c.sourceType,
        evidenceQuote: c.evidenceQuote,
        strength: c.strength,
        scope: c.scope,
        createdAt: realNowIso(),
      };
      const checked = validateMemoryCandidate(candidate);
      if (!checked.ok) continue;
      found.couple.memoryCandidates[cid] = candidate;
      storedCandidates.push(candidate);
    }
  });

  if (data.clarification) {
    const question = {
      id: newId("q"),
      prompt: data.clarification.prompt,
      options: data.clarification.options,
    };
    await withStore((db) => {
      const found = findRun(db, runId);
      if (!found) return;
      found.run.status = "WAITING_INPUT";
      found.run.waitingQuestion = question;
      found.run.leaseOwner = null;
    });
    await appendEvent(runId, "INPUT_REQUIRED", question.prompt, { payload: { question, reflectionId } });
    return;
  }

  await withStore((db) => {
    const found = findRun(db, runId);
    if (!found) return;
    for (const candidate of storedCandidates) {
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
        summary: `記憶候補: ${candidate.content}`,
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
    found.run.status = storedCandidates.length ? "WAITING_APPROVAL" : "SUCCEEDED";
    found.run.finishedAt = storedCandidates.length ? null : realNowIso();
    found.run.leaseOwner = null;
  });
  await appendEvent(runId, "RUN_FINISHED", storedCandidates.length ? "確認質問は不要。保存候補の承認待ち" : "確認質問も候補も不要");
}

export async function applyReflectionAnswer(args: {
  runId: string;
  questionId: string;
  answer: string;
}): Promise<void> {
  void args;
}
