import { DEADLINES_MS, SCHEMA_VERSION, PROMPT_VERSION, TOOL_VERSION, MODEL_SETTINGS_VERSION } from "@/config/settings";
import { getEnv, publicBlockers } from "@/config/env";
import {
  planningInputSchema,
  type PlanningInput,
  type RunKind,
  type ScenarioKind,
} from "@/domain/schemas";
import { candidateToMemory } from "@/domain/memory";
import { candidateContentHash } from "@/domain/memory/validateMemoryCandidate";
import { structurePreference } from "@/domain/planning/requirements";
import { canApplyPlan } from "@/server/approvals/service";
import { consumeDraft } from "@/server/agent/drafts";
import { maskPii } from "@/server/privacy/mask";
import { draftShareMessage } from "@/server/privacy/dto";
import { detectInjection } from "@/server/security/injection";
import { demoAllowed } from "@/server/auth";
import { newId, sha256 } from "@/lib/ids";
import { realNowIso, tokyoDateTime } from "@/lib/time";
import {
  findApproval,
  findMemory,
  findRun,
  findSession,
  withStore,
  type CoupleBundle,
  type SessionBundle,
} from "@/server/repositories/store";
import { getCatalogSpot } from "@/server/providers/catalog";
import { applyConfirmedAnswerInPlace } from "@/server/agent/reflection";

function gitSha(): string | null {
  return process.env.GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null;
}

export function snapshotOf(couple: CoupleBundle, bundle: SessionBundle) {
  const env = getEnv();
  const applied = bundle.session.currentPlanVersion
    ? bundle.planHistory[String(bundle.session.currentPlanVersion)]
    : null;
  const latestRun = Object.values(bundle.runs).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
  const proposed =
    latestRun?.resultPlanVersion != null ? bundle.planHistory[String(latestRun.resultPlanVersion)] : null;
  const plan = applied ?? proposed ?? null;
  const runs = Object.values(bundle.runs).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const events = Object.values(bundle.events).sort((a, b) => a.seq - b.seq);
  const approvals = Object.values(couple.approvals).filter((a) => a.sessionId === bundle.session.id);
  return {
    runtime: env.profile === "LIVE" ? "LIVE" : env.profile === "EMULATOR" ? "EMULATOR" : "DEV",
    blockers: publicBlockers(),
    couple: couple.couple,
    session: bundle.session,
    plan,
    spots: bundle.spots,
    evidence: bundle.evidence,
    runs,
    events,
    approvals,
    memories: Object.values(couple.memories),
    memoryCandidates: Object.values(couple.memoryCandidates),
    scenarios: Object.values(bundle.scenarios),
    overlays: Object.values(bundle.scenarios).map((s) => s.kind),
  };
}

export async function createCouple(uid: string, isDemo: boolean) {
  const id = newId("cpl");
  await withStore((db) => {
    db.couples[id] = {
      couple: { id, ownerUid: uid, isDemo, createdAt: realNowIso() },
      memories: {},
      memoryCandidates: {},
      reflections: {},
      approvals: {},
      sessions: {},
      replays: {},
    };
  });
  return { id };
}

export async function createSession(uid: string, coupleId: string, raw: unknown) {
  const parsed = planningInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, status: 400, error: parsed.error.message };
  }
  const env = getEnv();
  if (env.profile === "LIVE") {
    const ids = [
      parsed.data.meet.spotId,
      parsed.data.end.spotId,
      ...parsed.data.fixedAppointments.map((a) => a.spotId),
      ...parsed.data.pickedSpotIds,
      ...parsed.data.selectedSpots.map((s) => s.spotId),
    ];
    if (ids.some((id) => id?.startsWith("mock:"))) {
      return { ok: false as const, status: 400, error: "LIVE では mock ID を送れません" };
    }
  }
  if (parsed.data.meet.resolved === false || parsed.data.end.resolved === false) {
    return { ok: false as const, status: 400, error: "集合・終了地点が未解決です。候補から選んでください" };
  }
  const input = resolveFixedSpot({
    ...parsed.data,
    preferences: parsed.data.preferences.map((p) => structurePreference(p)),
  });
  const created = await withStore((db) => {
    const couple = db.couples[coupleId];
    if (!couple) return { ok: false as const, status: 404, error: "couple not found" };
    if (couple.couple.ownerUid !== uid) return { ok: false as const, status: 403, error: "forbidden" };
    const id = newId("ses");
    const bundle: SessionBundle = {
      session: {
        id,
        coupleId,
        ownerUid: uid,
        status: "DRAFT",
        input,
        currentPlanVersion: null,
        currentLocation: null,
        scheduleNow: null,
        isDemo: couple.couple.isDemo,
        createdAt: realNowIso(),
      },
      planHistory: {},
      runs: {},
      events: {},
      scenarios: {},
      spots: {},
      evidence: {},
    };
    couple.sessions[id] = bundle;
    for (const memory of Object.values(couple.memories)) {
      if (
        memory.active &&
        memory.scope === "NEXT_DATE" &&
        memory.targetSessionId == null
      ) {
        memory.targetSessionId = id;
      }
    }
    return { ok: true as const, id, input };
  });
  if (created.ok) await consumeDraft(uid, input.draftId);
  return created;
}

function resolveFixedSpot(input: PlanningInput): PlanningInput {
  const catalog = [
    getCatalogSpot("mock:aichi-art-museum"),
    getCatalogSpot("mock:science-museum"),
    getCatalogSpot("mock:nagoya-castle"),
    getCatalogSpot("mock:komeda-meieki"),
    getCatalogSpot("mock:noritake-garden"),
  ].filter((s): s is NonNullable<typeof s> => Boolean(s));
  return {
    ...input,
    fixedAppointments: input.fixedAppointments.map((a) => {
      if (a.spotId) return a;
      const hint = a.spotNameHint ?? a.label;
      const byName = catalog.find(
        (s) => hint.includes(s.name) || s.name.includes(hint.replace(/の予定/, "")),
      );
      return { ...a, spotId: byName?.id ?? a.spotId };
    }),
  };
}

export async function startRun(input: {
  uid: string;
  sessionId: string;
  kind: RunKind;
  trigger?: string | null;
  idempotencyKey?: string | null;
  bodyHash: string;
  reflectionNote?: string | null;
}) {
  return withStore((db) => {
    if (input.idempotencyKey) {
      const prev = db.idempotency[input.idempotencyKey];
      if (prev) {
        if (prev.uid !== input.uid || prev.bodyHash !== input.bodyHash || prev.op !== "startRun") {
          return { ok: false as const, status: 409, error: "idempotency conflict" };
        }
        return { ok: true as const, duplicated: true, ...(prev.response as { runId: string }) };
      }
    }
    const found = findSession(db, input.sessionId);
    if (!found) return { ok: false as const, status: 404, error: "session not found" };
    if (found.couple.couple.ownerUid !== input.uid) {
      return { ok: false as const, status: 403, error: "forbidden" };
    }
    const active = Object.values(found.bundle.runs).filter((r) =>
      ["PENDING", "RUNNING", "WAITING_INPUT", "WAITING_APPROVAL"].includes(r.status),
    );
    if (active.length >= 1 && input.kind !== "REFLECTION") {
      return {
        ok: false as const,
        status: 409,
        error: `concurrent run: ${active.map((r) => `${r.id}:${r.status}:${r.kind}`).join(",")}`,
      };
    }
    const today = realNowIso().slice(0, 10);
    const countToday = Object.values(found.couple.sessions).reduce((n, b) => {
      return (
        n +
        Object.values(b.runs).filter((r) => r.createdAt.startsWith(today)).length
      );
    }, 0);
    if (countToday >= 20) return { ok: false as const, status: 429, error: "daily cap" };

    const env = getEnv();
    const id = newId("run");
    const kind = input.kind;
    found.bundle.runs[id] = {
      id,
      coupleId: found.couple.couple.id,
      sessionId: found.bundle.session.id,
      ownerUid: input.uid,
      kind,
      status: "PENDING",
      mode: env.profile === "LIVE" ? "LIVE" : "LIVE",
      displayRuntime: env.profile === "LIVE" ? "LIVE" : env.profile === "EMULATOR" ? "EMULATOR" : "DEV",
      leaseFencingToken: 0,
      createdAt: realNowIso(),
      startedAt: null,
      finishedAt: null,
      deadlineAt: new Date(Date.now() + DEADLINES_MS[kind]).toISOString(),
      leaseOwner: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      trigger: input.trigger ?? null,
      basePlanVersion: found.bundle.session.currentPlanVersion,
      resultPlanVersion: null,
      waitingQuestion: null,
      waitingApprovalId: null,
      error: null,
      cost: {
        llmJpy: env.runtime === "MOCK" ? 0 : null,
        apiJpy: env.runtime === "MOCK" ? 0 : null,
        mundaneCalls: 0,
        hardCalls: 0,
        unaccountedCalls: 0,
      },
      versions: {
        schema: SCHEMA_VERSION,
        prompt: PROMPT_VERSION,
        tool: TOOL_VERSION,
        modelSettings: MODEL_SETTINGS_VERSION,
        git: gitSha(),
      },
    };
    const response = { runId: id };
    if (input.idempotencyKey) {
      db.idempotency[input.idempotencyKey] = {
        key: input.idempotencyKey,
        uid: input.uid,
        target: input.sessionId,
        op: "startRun",
        bodyHash: input.bodyHash,
        status: 202,
        response,
      };
    }
    if (kind === "REFLECTION" && input.reflectionNote) {
      const masked = maskPii(input.reflectionNote);
      const rid = newId("ref");
      found.couple.reflections[rid] = {
        id: rid,
        sessionId: found.bundle.session.id,
        coupleId: found.couple.couple.id,
        rawNote: masked.masked,
        maskedNote: masked.masked,
        createdAt: realNowIso(),
      };
    }
    return { ok: true as const, duplicated: false, runId: id };
  });
}

export async function getSessionSnapshot(uid: string, sessionId: string) {
  return withStore((db) => {
    const found = findSession(db, sessionId);
    if (!found) return { ok: false as const, status: 404, error: "not found" };
    if (found.couple.couple.ownerUid !== uid) return { ok: false as const, status: 403, error: "forbidden" };
    return { ok: true as const, data: snapshotOf(found.couple, found.bundle) };
  });
}

export async function getRunView(uid: string, runId: string) {
  return withStore((db) => {
    const found = findRun(db, runId);
    if (!found) return { ok: false as const, status: 404, error: "not found" };
    if (found.couple.couple.ownerUid !== uid) return { ok: false as const, status: 403, error: "forbidden" };
    const events = Object.values(found.bundle.events)
      .filter((e) => e.runId === runId)
      .sort((a, b) => a.seq - b.seq);
    return { ok: true as const, run: found.run, events };
  });
}

export async function answerQuestion(uid: string, runId: string, questionId: string, answer: string) {
  return withStore((db) => {
    const found = findRun(db, runId);
    if (!found) return { ok: false as const, status: 404, error: "not found" };
    if (found.couple.couple.ownerUid !== uid) return { ok: false as const, status: 403, error: "forbidden" };
    if (found.run.status !== "WAITING_INPUT" || found.run.waitingQuestion?.id !== questionId) {
      return { ok: false as const, status: 409, error: "question mismatch" };
    }
    const reflectionId = newId("ref");
    const masked = maskPii(answer);
    found.couple.reflections[reflectionId] = {
      id: reflectionId,
      sessionId: found.bundle.session.id,
      coupleId: found.couple.couple.id,
      rawNote: masked.masked,
      maskedNote: masked.masked,
      createdAt: realNowIso(),
    };
    found.bundle.session.status = "REFLECTED";
    applyConfirmedAnswerInPlace({
      couple: found.couple,
      bundle: found.bundle,
      runId,
      questionId,
      answer,
      reflectionId,
    });
    found.run.status = "SUCCEEDED";
    found.run.finishedAt = realNowIso();
    found.run.waitingQuestion = null;
    return { ok: true as const };
  });
}

export async function decideApproval(uid: string, approvalId: string, decision: "APPROVE" | "REJECT") {
  return withStore((db) => {
    const found = findApproval(db, approvalId);
    if (!found) return { ok: false as const, status: 404, error: "not found" };
    if (found.couple.couple.ownerUid !== uid) return { ok: false as const, status: 403, error: "forbidden" };
    const approval = found.approval;
    if (approval.status !== "PENDING") return { ok: false as const, status: 409, error: "already consumed" };
    if (approval.kind === "PLAN_APPLY") {
      const bundle = found.couple.sessions[approval.sessionId];
      if (!bundle) return { ok: false as const, status: 404, error: "session" };
      const nextPlan = bundle.planHistory[String(approval.planVersionTo)] ?? null;
      const current = bundle.planHistory[String(approval.planVersionFrom)] ?? null;
      const gate = canApplyPlan({
        callerUid: uid,
        ownerUid: found.couple.couple.ownerUid,
        approval,
        currentVersion: bundle.session.currentPlanVersion,
        nextPlan,
        previousPlan: current,
      });
      if (!gate.ok) return gate;
      approval.status = decision === "APPROVE" ? "CONSUMED" : "REJECTED";
      approval.consumedAt = realNowIso();
      const run = bundle.runs[approval.runId];
      if (decision === "APPROVE") {
        bundle.session.currentPlanVersion = approval.planVersionTo;
        if (run) {
          run.status = "SUCCEEDED";
          run.finishedAt = realNowIso();
        }
      } else if (run) {
        run.status = "CANCELLED";
        run.finishedAt = realNowIso();
      }
      return { ok: true as const, approval };
    }
    if (approval.kind === "MEMORY_SAVE" || approval.kind === "MEMORY_EDIT") {
      approval.status = decision === "APPROVE" ? "CONSUMED" : "REJECTED";
      approval.consumedAt = realNowIso();
      if (decision === "APPROVE") {
        const candidate = approval.candidateId
          ? found.couple.memoryCandidates[approval.candidateId]
          : undefined;
        if (!candidate) return { ok: false as const, status: 409, error: "candidateId required" };
        if (approval.presentedHash && candidate.content) {
          if (candidateContentHash(candidate) !== approval.presentedHash) {
            return { ok: false as const, status: 409, error: "content hash mismatch; re-approve" };
          }
        }
        if (approval.kind === "MEMORY_EDIT") {
          const old = approval.sourceMemoryId ? found.couple.memories[approval.sourceMemoryId] : undefined;
          if (old && old.version !== (approval.sourceVersion ?? old.version)) {
            return { ok: false as const, status: 409, error: "source version mismatch" };
          }
          if (old) old.active = false;
        }
        if (candidate.sourceType === "HYPOTHESIS") {
          return { ok: false as const, status: 409, error: "hypothesis cannot be stored as memory" };
        }
        const mem = candidateToMemory({
          candidate,
          approvedAt: realNowIso(),
          targetSessionId: candidate.scope === "NEXT_DATE" ? approval.sessionId : null,
          supersedes: approval.kind === "MEMORY_EDIT" ? approval.sourceMemoryId : null,
        });
        found.couple.memories[mem.id] = mem;
      }
      return { ok: true as const, approval };
    }
    return { ok: false as const, status: 400, error: "kind" };
  });
}

export async function updateProgress(
  uid: string,
  sessionId: string,
  body: {
    itemId?: string;
    progress?: "NOT_STARTED" | "IN_PROGRESS" | "DONE";
    confirm?: boolean;
    location?: { lat: number; lng: number; label: string | null };
    scheduleNow?: string | null;
    status?: "CONFIRMED" | "IN_PROGRESS" | "DONE";
  },
) {
  return withStore((db) => {
    const found = findSession(db, sessionId);
    if (!found) return { ok: false as const, status: 404, error: "not found" };
    if (found.couple.couple.ownerUid !== uid) return { ok: false as const, status: 403, error: "forbidden" };
    if (body.confirm || body.status === "CONFIRMED") found.bundle.session.status = "CONFIRMED";
    if (body.status) found.bundle.session.status = body.status;
    if (body.location) found.bundle.session.currentLocation = body.location;
    if (body.scheduleNow !== undefined) found.bundle.session.scheduleNow = body.scheduleNow;
    const version = found.bundle.session.currentPlanVersion;
    if (version && body.itemId && body.progress) {
      const plan = found.bundle.planHistory[String(version)];
      const item = plan.items.find((i) => i.id === body.itemId);
      if (item) item.progress = body.progress;
    }
    return { ok: true as const, session: found.bundle.session };
  });
}

export async function injectScenario(
  uid: string,
  sessionId: string,
  body: {
    kind: ScenarioKind;
    spotId?: string | null;
    legId?: string | null;
    from?: string | null;
    to?: string | null;
    overlay: Record<string, unknown>;
  },
) {
  if (!demoAllowed(uid)) return { ok: false as const, status: 403, error: "demo controls disabled" };
  const allowed: ScenarioKind[] = ["WEATHER", "SPOT_FULL", "TRAVEL_DELAY", "DEMO_CLOCK"];
  if (!allowed.includes(body.kind)) {
    return { ok: false as const, status: 400, error: "kind not on allow-list" };
  }
  return withStore((db) => {
    const found = findSession(db, sessionId);
    if (!found) return { ok: false as const, status: 404, error: "not found" };
    if (found.couple.couple.ownerUid !== uid) return { ok: false as const, status: 403, error: "forbidden" };
    const id = newId("scen");
    found.bundle.scenarios[id] = {
      id,
      sessionId,
      kind: body.kind,
      createdAt: realNowIso(),
      createdByUid: uid,
      target: {
        spotId: body.spotId ?? null,
        legId: body.legId ?? null,
        from: body.from ?? null,
        to: body.to ?? null,
      },
      overlay: body.overlay,
      baselineRef: "pre-overlay-preserved",
    };
    if (body.kind === "DEMO_CLOCK") {
      found.bundle.session.scheduleNow = String(body.overlay.now ?? realNowIso());
    }
    return { ok: true as const, scenarioId: id };
  });
}

export async function reviseMemory(uid: string, memoryId: string, content: string) {
  const masked = maskPii(content);
  return withStore((db) => {
    const found = findMemory(db, memoryId);
    if (!found) return { ok: false as const, status: 404, error: "not found" };
    if (found.couple.couple.ownerUid !== uid) return { ok: false as const, status: 403, error: "forbidden" };
    const cid = newId("mc");
    found.couple.memoryCandidates[cid] = {
      id: cid,
      coupleId: found.couple.couple.id,
      sessionId: found.memory.reflectionId,
      reflectionId: found.memory.reflectionId,
      answerId: found.memory.answerId,
      subject: found.memory.subject,
      type: found.memory.type,
      content: masked.masked,
      sourceType: found.memory.sourceType,
      evidenceQuote: found.memory.evidenceQuote,
      strength: found.memory.strength,
      scope: found.memory.scope,
      createdAt: realNowIso(),
      injectionFlags: detectInjection(masked.masked).map((f) => f.code),
    };
    const approvalId = newId("appr");
    found.couple.approvals[approvalId] = {
      id: approvalId,
      coupleId: found.couple.couple.id,
      sessionId: found.memory.reflectionId,
      runId: "revision",
      planVersionFrom: found.memory.version,
      planVersionTo: found.memory.version + 1,
      kind: "MEMORY_EDIT",
      status: "PENDING",
      summary: `記憶候補: ${masked.masked}`,
      diff: null,
      consumedAt: null,
      createdAt: realNowIso(),
      payloadId: cid,
      payloadVersion: 1,
      candidateId: cid,
      candidateVersion: 1,
      sourceMemoryId: found.memory.id,
      sourceVersion: found.memory.version,
      replacementCandidateId: cid,
      presentedHash: candidateContentHash(found.couple.memoryCandidates[cid]!),
    };
    return { ok: true as const, candidateId: cid, approvalId };
  });
}

export async function deactivateMemory(uid: string, memoryId: string) {
  return withStore((db) => {
    const found = findMemory(db, memoryId);
    if (!found) return { ok: false as const, status: 404, error: "not found" };
    if (found.couple.couple.ownerUid !== uid) return { ok: false as const, status: 403, error: "forbidden" };
    found.memory.active = false;
    return { ok: true as const };
  });
}

export async function messageDraft(uid: string, sessionId: string) {
  return withStore((db) => {
    const found = findSession(db, sessionId);
    if (!found) return { ok: false as const, status: 404, error: "not found" };
    if (found.couple.couple.ownerUid !== uid) return { ok: false as const, status: 403, error: "forbidden" };
    const plan = found.bundle.session.currentPlanVersion
      ? found.bundle.planHistory[String(found.bundle.session.currentPlanVersion)]
      : null;
    if (!plan) return { ok: false as const, status: 400, error: "no plan" };
    const dto = {
      dateTokyo: found.bundle.session.input.dateTokyo,
      meetName: found.bundle.session.input.meet.name,
      endName: found.bundle.session.input.end.name,
      items: plan.items.map((it) => ({
        name: found.bundle.spots[it.spotId]?.name ?? it.spotId,
        startAt: it.startAt,
        endAt: it.endAt,
        officialUrl: found.bundle.spots[it.spotId]?.officialUrl ?? null,
      })),
    };
    const draft = draftShareMessage(dto);
    return { ok: true as const, dto, ...draft };
  });
}

export async function exportReplay(uid: string, runId: string) {
  return withStore((db) => {
    const found = findRun(db, runId);
    if (!found) return { ok: false as const, status: 404, error: "not found" };
    if (found.couple.couple.ownerUid !== uid) return { ok: false as const, status: 403, error: "forbidden" };
    if (!found.couple.couple.isDemo) {
      return { ok: false as const, status: 403, error: "REPLAY はデモデータのみ。実ユーザー原文は書き出さない" };
    }
    const id = newId("rep");
    const events = Object.values(found.bundle.events)
      .filter((e) => e.runId === runId)
      .sort((a, b) => a.seq - b.seq)
      .map((e) => ({
        ...e,
        payload:
          e.payload && typeof e.payload === "object"
            ? Object.fromEntries(
                Object.entries(e.payload as Record<string, unknown>).filter(
                  ([k]) => !/rawNote|private|maskedNote/i.test(k),
                ),
              )
            : e.payload,
      }));
    const plan = found.run.resultPlanVersion
      ? found.bundle.planHistory[String(found.run.resultPlanVersion)]
      : null;
    found.couple.replays[id] = {
      id,
      coupleId: found.couple.couple.id,
      sessionId: found.bundle.session.id,
      runId,
      createdAt: realNowIso(),
      gitCommit: gitSha(),
      versions: found.run.versions,
      events,
      plan,
      spots: Object.values(found.bundle.spots),
      evidence: Object.values(found.bundle.evidence),
      costSnapshot: found.run.cost,
      notes: "デモ入力のみを検査して保存。実ユーザーのPRIVATE原文は含まない。再生時に外部APIも新規課金もしない",
    };
    return { ok: true as const, replayId: id };
  });
}

export async function demoReset(uid: string, keepReplays = true) {
  if (!demoAllowed(uid)) return { ok: false as const, status: 403, error: "demo controls disabled" };
  return withStore((db) => {
    for (const [id, couple] of Object.entries(db.couples)) {
      if (couple.couple.ownerUid !== uid || !couple.couple.isDemo) continue;
      const replays = keepReplays ? couple.replays : {};
      db.couples[id] = {
        couple: couple.couple,
        memories: {},
        memoryCandidates: {},
        reflections: {},
        approvals: {},
        sessions: {},
        replays,
      };
    }
    return { ok: true as const };
  });
}

export async function listMemory(uid: string, coupleId: string) {
  return withStore((db) => {
    const couple = db.couples[coupleId];
    if (!couple) return { ok: false as const, status: 404, error: "not found" };
    if (couple.couple.ownerUid !== uid) return { ok: false as const, status: 403, error: "forbidden" };
    return {
      ok: true as const,
      memories: Object.values(couple.memories),
      candidates: Object.values(couple.memoryCandidates),
    };
  });
}

export async function listSessions(uid: string, coupleId: string) {
  return withStore((db) => {
    const couple = db.couples[coupleId];
    if (!couple) return { ok: false as const, status: 404, error: "not found" };
    if (couple.couple.ownerUid !== uid) return { ok: false as const, status: 403, error: "forbidden" };
    const sessions = Object.values(couple.sessions)
      .map((bundle) => {
        const plan = bundle.session.currentPlanVersion
          ? bundle.planHistory[String(bundle.session.currentPlanVersion)]
          : null;
        return {
          id: bundle.session.id,
          status: bundle.session.status,
          dateTokyo: bundle.session.input.dateTokyo,
          areaName: bundle.session.input.areaName,
          meetName: bundle.session.input.meet.name,
          spotNames: (plan?.items ?? []).map((it) => bundle.spots[it.spotId]?.name ?? it.spotId),
          validationState: plan?.validation.state ?? null,
          costKnown: plan?.costEstimate.totalJpy.value != null,
          createdAt: bundle.session.createdAt,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { ok: true as const, sessions };
  });
}

export async function ownerCoupleId(uid: string): Promise<string | null> {
  return withStore((db) => {
    const hit = Object.values(db.couples).find((c) => c.couple.ownerUid === uid);
    return hit?.couple.id ?? null;
  });
}

export { sha256, tokyoDateTime };
