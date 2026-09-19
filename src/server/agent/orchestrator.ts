import { DEADLINES_MS, LIMITS } from "@/config/settings";
import { getEnv } from "@/config/env";
import type { AppEvent, EventType, Memory, Run, Spot } from "@/domain/schemas";
import { diffPlan } from "@/domain/plan/diffPlan";
import { evaluateAutoApply } from "@/domain/plan/evaluateAutoApply";
import { preferenceMatchIds } from "@/domain/plan/validatePlan";
import { newId } from "@/lib/ids";
import { realNowIso } from "@/lib/time";
import { callLLM } from "@/server/llm";
import { planProposalSchema } from "@/server/llm/taskSchemas";
import { getSpotDetails, getWeather, searchSpots, type ProviderCtx } from "@/server/providers";
import { getCatalogSpot } from "@/server/providers/catalog";
import { readTodayDigest } from "@/server/providers/dailyDigest";
import { ensureSpotFacts } from "@/server/providers/ensureSpotFacts";
import { findRun, withStore } from "@/server/repositories/store";
import { canWriteRun } from "@/server/approvals/service";
import { buildPlan } from "./buildPlan";
import { heartbeat, WORKER_ID } from "./lease";
import { canReadMemory } from "@/domain/memory";
import { allowedToolCallSchema, type AllowedToolCall } from "./toolRegistry";
import { chooseRepairStrategy, HUMAN_REPAIR_OPTIONS } from "./repairLoop";
import { wrapUntrusted, systemFence } from "@/server/security/promptFence";
import { resolveNotifyTarget } from "@/server/security/notifyAllowlist";
import { detectInjection } from "@/server/security/injection";

async function appendEvent(
  runId: string,
  type: EventType,
  summary: string,
  extra: Partial<AppEvent> = {},
) {
  await withStore((db) => {
    const found = findRun(db, runId);
    if (!found) return;
    if (
      found.run.leaseOwner &&
      !canWriteRun({
        leaseOwner: found.run.leaseOwner,
        leaseFencingToken: found.run.leaseFencingToken,
        workerId: WORKER_ID,
        fencingToken: found.run.leaseFencingToken,
      }) &&
      found.run.leaseOwner !== WORKER_ID
    ) {
      return;
    }
    const seq = Object.keys(found.bundle.events).length;
    const event: AppEvent = {
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
    found.bundle.events[event.eventId] = event;
  });
}

async function patchRun(runId: string, patch: Partial<Run>) {
  await withStore((db) => {
    const found = findRun(db, runId);
    if (!found) return;
    if (found.run.leaseOwner && found.run.leaseOwner !== WORKER_ID) return;
    Object.assign(found.run, patch);
  });
}

function pickSpots(args: {
  walk: Spot[];
  exhibit: Spot[];
  sweets: Spot[];
  lockedIds: string[];
  mustVisit: string[];
  rain: boolean;
}): { selected: string[]; rejected: { spotId: string; reason: string }[] } {
  const rejected: { spotId: string; reason: string }[] = [];
  const selected: string[] = [];
  const addId = (id?: string | null) => {
    if (id && !selected.includes(id)) selected.push(id);
  };
  for (const id of args.lockedIds) addId(id);
  for (const id of args.mustVisit) addId(id);
  for (const s of args.walk.filter((x) => x.environment.value === "OUTDOOR")) {
    if (args.rain && !args.lockedIds.includes(s.id) && !args.mustVisit.includes(s.id)) {
      rejected.push({ spotId: s.id, reason: "降水量から屋外を見送り" });
    }
  }
  const indoor = [...args.exhibit, ...args.walk].find((s) => s.environment.value === "INDOOR");
  addId(args.rain ? indoor?.id ?? args.exhibit[0]?.id : args.walk[0]?.id);
  addId(args.exhibit[0]?.id);
  addId(args.sweets[0]?.id);
  addId(args.walk[1]?.id);
  return { selected: [...new Set(selected)].slice(0, 4), rejected };
}

async function runTool(
  call: AllowedToolCall,
  ctx: ProviderCtx,
  sessionInput: {
    areaLat: number;
    areaLng: number;
    areaName: string;
    radiusMeters: number;
    dateTokyo: string;
    startTime: string;
  },
  spots: Record<string, Spot>,
  memories: Memory[],
): Promise<unknown> {
  switch (call.name) {
    case "search_spots": {
      const r = await searchSpots(ctx, {
        area: { lat: sessionInput.areaLat, lng: sessionInput.areaLng, name: sessionInput.areaName },
        category: call.args.category,
        radiusMeters: call.args.radiusMeters ?? sessionInput.radiusMeters,
      });
      for (const s of r.spots) spots[s.id] = s;
      return { ids: r.spots.map((s) => s.id) };
    }
    case "get_spot_details": {
      const d = await getSpotDetails(ctx, { spotId: call.args.spotId });
      if (d.spot) spots[d.spot.id] = d.spot;
      return { found: Boolean(d.spot), id: d.spot?.id ?? null };
    }
    case "get_weather": {
      return getWeather(ctx, { lat: call.args.lat, lng: call.args.lng, at: call.args.at });
    }
    case "read_memories": {
      return memories.map((m) => ({
        id: m.id,
        careTarget: m.careTarget,
        careDirection: m.careDirection,
        content: m.content,
        strength: m.strength,
        scope: m.scope,
      }));
    }
    case "propose_candidates": {
      const r = await searchSpots(ctx, {
        area: { lat: sessionInput.areaLat, lng: sessionInput.areaLng, name: sessionInput.areaName },
        category: call.args.indoorOnly ? "屋内" : call.args.query,
        radiusMeters: sessionInput.radiusMeters,
      });
      for (const s of r.spots) spots[s.id] = s;
      return { ids: r.spots.slice(0, 5).map((s) => s.id) };
    }
    case "check_opening":
    case "estimate_travel":
    case "validate_plan":
    case "compute_diff":
    case "ask_clarification":
      return { deferred: call.name };
    default:
      return { error: "unknown tool" };
  }
}

export async function runPlanningOrchestrator(runId: string, signal: AbortSignal): Promise<void> {
  const env = getEnv();
  const loaded = await withStore((db) => findRun(db, runId));
  if (!loaded) return;
  const { run, bundle, couple } = loaded;
  const session = bundle.session;
  const overlays = Object.values(bundle.scenarios);
  const deadlineMs = DEADLINES_MS[run.kind];
  const started = Date.now();
  const fencingToken = run.leaseFencingToken;

  const cache = new Map<string, { at: string; value: unknown; stale: boolean }>();
  const ctx: ProviderCtx = {
    runId,
    overlays,
    cache,
    httpAttempts: 0,
    onHttp: (info) => {
      void appendEvent(
        runId,
        info.cacheHit ? "CACHE_HIT" : "HTTP_ATTEMPT",
        info.cacheHit ? `${info.provider} キャッシュ` : `${info.provider} HTTP #${info.attempt}`,
        { payload: info },
      );
    },
  };

  await appendEvent(runId, "RUN_STARTED", `${run.kind} を開始`);
  await heartbeat(runId, fencingToken);

  const memories = Object.values(couple.memories).filter((m) => canReadMemory(m, session.id));
  const mode = overlays.length ? "LIVE_SCENARIO" : run.mode;
  const picked = (session.input.pickedSpotIds ?? []).filter(Boolean);
  const selectedSpots = session.input.selectedSpots ?? [];
  const mustVisit = selectedSpots.filter((s) => s.intent === "MUST_VISIT").map((s) => s.spotId);
  const useManual = session.input.assembleMode === "MANUAL" && (picked.length >= 3 || selectedSpots.length >= 3);
  const digest = await readTodayDigest();
  if (digest && digest.areaId !== session.input.areaId) {
    await appendEvent(runId, "NOTICE", "digest の areaId がセッションと一致しないため使わない");
  }
  const digestOk =
    digest?.status === "READY" &&
    (digest.areaId ?? env.demoAreaId) === session.input.areaId &&
    Object.keys(digest.spots).length > 0;

  let walk: { spots: Spot[] } = { spots: [] };
  let exhibit: { spots: Spot[] } = { spots: [] };
  let sweets: { spots: Spot[] } = { spots: [] };

  if (digestOk && digest) {
    await appendEvent(runId, "CACHE_HIT", `今日の候補（${digest.tokyoDate} / ${digest.fetchedAt} 取得）を使う。都度検索しない`);
    const all = Object.values(digest.spots);
    const happeningIds = new Set(digest.items.filter((i) => i.kind === "HAPPENING").map((i) => i.spotId));
    walk = { spots: all.filter((s) => /park|tourist|散歩/.test(s.categories.join(" ").toLowerCase() + s.name)) };
    exhibit = {
      spots: all.filter((s) => happeningIds.has(s.id) || /museum|art|展示/.test(s.categories.join(" ").toLowerCase())),
    };
    sweets = { spots: all.filter((s) => /cafe|bakery|sweet/.test(s.categories.join(" ").toLowerCase())) };
    if (walk.spots.length < 2) walk = { spots: all };
    if (exhibit.spots.length < 2) exhibit = { spots: all };
    if (sweets.spots.length < 1) sweets = { spots: all };
  } else if (!useManual) {
    walk = await searchSpots(ctx, {
      area: { lat: session.input.areaLat, lng: session.input.areaLng, name: session.input.areaName },
      category: "散歩",
      radiusMeters: session.input.radiusMeters,
    });
    exhibit = await searchSpots(ctx, {
      area: { lat: session.input.areaLat, lng: session.input.areaLng, name: session.input.areaName },
      category: "展示",
      radiusMeters: session.input.radiusMeters,
    });
    sweets = await searchSpots(ctx, {
      area: { lat: session.input.areaLat, lng: session.input.areaLng, name: session.input.areaName },
      category: "甘いもの",
      radiusMeters: session.input.radiusMeters,
    });
  }

  const weather = await getWeather(ctx, {
    lat: session.input.areaLat,
    lng: session.input.areaLng,
    at: `${session.input.dateTokyo}T${session.input.startTime}:00+09:00`,
  });
  await appendEvent(runId, "TOOL_COMPLETED", weather.injected ? "天気（注入内容を評価）" : "天気", {
    evidenceIds: [weather.evidence.id],
  });
  const rain = (weather.precipitationMm ?? 0) >= 2;
  const lockedIds = session.input.fixedAppointments.map((a) => a.spotId).filter((x): x is string => Boolean(x));
  const mockAction = pickSpots({
    walk: walk.spots,
    exhibit: exhibit.spots,
    sweets: sweets.spots,
    lockedIds,
    mustVisit,
    rain,
  });

  const spotMap: Record<string, Spot> = { ...(digestOk ? digest?.spots : {}) };
  for (const s of [...walk.spots, ...exhibit.spots, ...sweets.spots]) spotMap[s.id] = s;
  for (const s of Object.values(spotMap)) {
    const flags = detectInjection(`${s.name} ${s.officialUrl ?? ""}`);
    if (flags.length) {
      await appendEvent(runId, "INJECTION_FLAGGED", `外部店名/説明に命令形の疑い: ${s.id}`, {
        payload: { spotId: s.id, flags: flags.map((f) => f.code) },
      });
    }
  }

  const focusIds = [...new Set([...lockedIds, ...mustVisit, ...picked, ...selectedSpots.map((s) => s.spotId), ...mockAction.selected])].slice(0, 6);
  const facts = await ensureSpotFacts({
    ctx,
    spots: spotMap,
    spotIds: focusIds,
    requiredFields: ["opening", "cost", "environment", "restEase", "standingBurden", "officialUrl"],
    targetDate: session.input.dateTokyo,
    signal,
  });
  Object.assign(spotMap, facts.spots);
  if (facts.fetchedIds.length) {
    await appendEvent(runId, "TOOL_COMPLETED", `詳細補完 ${facts.fetchedIds.length}件（存在だけでは省略しない）`);
  }

  let sourceIds: string[] = [];
  let llmRejected: { spotId: string; reason: string }[] = [];
  let lastValidation: string | null = null;

  if (useManual) {
    sourceIds = [...new Set([...lockedIds, ...mustVisit, ...picked, ...selectedSpots.map((s) => s.spotId)])].slice(0, 4);
    await appendEvent(runId, "TOOL_COMPLETED", "手動組み立て（明示的。AI作成の基本経路ではない）");
  } else {
    const brief = (s: Spot) => ({
      id: s.id,
      name: s.name,
      categories: s.categories,
      environment: s.environment.value,
      cost: s.costForTwoJpy.value,
    });
    const toolBudget = { steps: 0, http: ctx.httpAttempts };
    while (toolBudget.steps < LIMITS.maxDecisionSteps && ctx.httpAttempts < LIMITS.maxExternalHttpAttempts && !signal.aborted) {
      toolBudget.steps += 1;
      const llm = await callLLM({
        task: "final_plan",
        schemaName: "planProposal",
        repairHint:
          "直前のJSONはスキーマ不一致。orderedSpotIds（既知候補のidのみ）、rejected、assumptions、tradeoffs を返す。",
        messages: [
          {
            role: "system",
            content: `${systemFence("final_plan")} 候補配列の id だけを orderedSpotIds に使う。未知IDを採用しない。3〜4件。lockedIds と MUST_VISIT は必ず含める。記憶保存とプラン適用はしない。通知先は出力しない。`,
          },
          {
            role: "user",
            content: wrapUntrusted("planning_input", {
              preferences: session.input.preferences,
              lockedIds,
              mustVisit,
              preferVisit: selectedSpots.filter((s) => s.intent === "PREFER_VISIT").map((s) => s.spotId),
              rain,
              precipitationMm: weather.precipitationMm,
              lastValidation,
              memories: memories.map((m) => ({
                id: m.id,
                content: m.content,
                careTarget: m.careTarget,
                careDirection: m.careDirection,
                strength: m.strength,
              })),
              candidates: {
                walk: walk.spots.slice(0, 8).map(brief),
                exhibit: exhibit.spots.slice(0, 8).map(brief),
                sweets: sweets.spots.slice(0, 8).map(brief),
              },
            }),
          },
        ],
        schema: planProposalSchema,
        runId,
        signal,
        mockValue: {
          orderedSpotIds: mockAction.selected,
          rejected: mockAction.rejected,
          assumptions: ["空席は確認していない"],
          tradeoffs: rain ? ["屋外を避け屋内を優先"] : [],
        },
      });

      for (const attempt of llm.attempts.length ? llm.attempts : [llm]) {
        await appendEvent(runId, "LLM_ATTEMPT", attempt.ok ? "LLM試行成功" : `LLM試行失敗: ${attempt.error ?? ""}`, {
          pool: attempt.pool,
          model: attempt.actualModel,
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
        });
      }
      await appendEvent(runId, "MODEL_SELECTED", `${llm.pool} / ${llm.actualModel} (${llm.routeReason})`, {
        pool: llm.pool,
        model: llm.actualModel,
        requestedModel: llm.requestedModel,
        actualModel: llm.actualModel,
        usage: {
          promptTokens: llm.promptTokens,
          completionTokens: llm.completionTokens,
          costUsd: llm.costUsd,
          costJpy: llm.costJpy,
          latencyMs: llm.latencyMs,
          ok: llm.ok,
        },
        payload: { reason: llm.routeReason, coerced: llm.coerced, escalated: llm.escalated, schemaMode: llm.schemaMode },
      });
      if (llm.coerced) await appendEvent(runId, "LLM_COERCED", "寛容パースを最終手段として使用");
      await withStore((db) => {
        const found = findRun(db, runId);
        if (!found) return;
        found.run.cost.mundaneCalls += llm.pool === "mundane" ? 1 : 0;
        found.run.cost.hardCalls += llm.pool === "hard" ? 1 : 0;
        if (llm.costJpy == null && env.runtime === "LIVE") found.run.cost.unaccountedCalls += 1;
        if (llm.costJpy != null) found.run.cost.llmJpy = (found.run.cost.llmJpy ?? 0) + llm.costJpy;
      });

      if (env.profile === "LIVE" && !llm.ok) {
        await appendEvent(runId, "ESCALATED", `LLM失敗: ${llm.error ?? "unknown"}`);
        await patchRun(runId, {
          status: "FAILED",
          finishedAt: realNowIso(),
          error: llm.error ?? "llm failed",
          leaseOwner: null,
        });
        await appendEvent(runId, "RUN_FINISHED", "LLM失敗のため停止");
        return;
      }

      sourceIds =
        llm.ok && llm.data?.orderedSpotIds?.length
          ? llm.data.orderedSpotIds
          : env.profile === "LIVE"
            ? []
            : mockAction.selected;
      llmRejected = llm.data?.rejected ?? [];
      break;
    }
  }

  const selected: string[] = [];
  for (const id of sourceIds) {
    if (!spotMap[id] && !getCatalogSpot(id) && !id.startsWith("mock:")) {
      const details = await getSpotDetails(ctx, { spotId: id });
      if (details.spot) spotMap[details.spot.id] = details.spot;
      else {
        await appendEvent(runId, "CANDIDATE_REJECTED", `未知ID ${id} は採用しない`);
        continue;
      }
    }
    selected.push(id);
  }
  if (env.profile === "LIVE" && selected.some((id) => id.startsWith("mock:"))) {
    await patchRun(runId, {
      status: "FAILED",
      finishedAt: realNowIso(),
      error: "LIVE に mock 候補が混入",
      leaseOwner: null,
    });
    await appendEvent(runId, "VALIDATION_FAILED", "LIVE では mock ID を拒否");
    await appendEvent(runId, "RUN_FINISHED", "mock 混入のため停止");
    return;
  }
  if (env.profile === "LIVE" && selected.length < 3) {
    await appendEvent(runId, "VALIDATION_FAILED", `LIVEで採用できた候補が${selected.length}件`);
    await patchRun(runId, {
      status: "FAILED",
      finishedAt: realNowIso(),
      error: "live selected spots < 3",
      leaseOwner: null,
    });
    await appendEvent(runId, "RUN_FINISHED", "実在候補を確定できず停止");
    return;
  }
  for (const r of llmRejected) {
    await appendEvent(runId, "CANDIDATE_REJECTED", `${r.spotId}: ${r.reason}`);
  }

  const current = session.currentPlanVersion ? bundle.planHistory[String(session.currentPlanVersion)] : undefined;
  let built = await buildPlan({
    version: (current?.version ?? 0) + 1,
    input: session.input,
    orderedSpotIds: selected,
    spots: spotMap,
    memories,
    ctx,
    dataMode: overlays.length ? "LIVE_SCENARIO" : "LIVE",
    previousItems: current?.items,
  });

  if (built.plan.validation.state === "FAIL") {
    let stayScale = 1;
    let travelMode = session.input.travelMode;
    let repairIds = selected;
    for (let n = 0; n < LIMITS.maxPlanRepairAttempts && built.plan.validation.state === "FAIL"; n++) {
      const errors = built.plan.validation.issues.filter((i) => i.severity === "ERROR");
      const codes = errors.map((i) => i.code);
      const closedSpotIds = built.plan.items
        .filter((it) => errors.some((e) => e.code === "CLOSED" && e.itemIds.includes(it.id)))
        .map((it) => it.spotId);
      const mustKeep = new Set(mustVisit);
      for (const pref of session.input.preferences.filter((p) => p.priority === "MUST")) {
        for (const s of Object.values({ ...spotMap, ...built.spots })) {
          if (preferenceMatchIds(s, [pref]).length) mustKeep.add(s.id);
        }
      }
      const mustCandidateIds = [...mustKeep];
      const choice = chooseRepairStrategy({
        codes,
        attemptIndex: n,
        orderedIds: repairIds,
        lockedIds,
        mustVisit: [...mustKeep],
        closedSpotIds,
        mustCandidateIds,
        currentMode: travelMode,
      });
      if (!choice) break;
      repairIds = choice.nextIds;
      stayScale = choice.stayScale;
      if (choice.travelMode) travelMode = choice.travelMode;
      const beforeIds = built.plan.items.map((i) => i.spotId);
      built = await buildPlan({
        version: (current?.version ?? 0) + 1,
        input: session.input,
        orderedSpotIds: repairIds,
        spots: { ...spotMap, ...built.spots },
        memories,
        ctx,
        dataMode: built.plan.dataMode,
        previousItems: current?.items,
        stayScale,
        travelMode,
      });
      await appendEvent(runId, "REPAIR_ATTEMPTED", `${choice.strategy}: ${choice.reason}`, {
        payload: {
          n: n + 1,
          failCodes: codes,
          strategy: choice.strategy,
          reason: choice.reason,
          beforeIds,
          afterIds: built.plan.items.map((i) => i.spotId),
          stayScale,
          travelMode,
          revalidation: built.plan.validation.state,
          remainingCodes: built.plan.validation.issues.filter((i) => i.severity === "ERROR").map((i) => i.code),
        },
      });
      await appendEvent(runId, "SELF_CORRECTED", `修復 ${n + 1}/${LIMITS.maxPlanRepairAttempts}`);
    }
  }

  if ((signal.aborted || Date.now() - started > deadlineMs) && built.plan.validation.state === "FAIL") {
    await appendEvent(runId, "TIME_BUDGET_REACHED", "期限のため FAIL の暫定案は確定しない");
    await patchRun(runId, {
      status: "PARTIAL",
      finishedAt: realNowIso(),
      error: "time budget",
      leaseOwner: null,
    });
    return;
  }

  await withStore((db) => {
    const found = findRun(db, runId);
    if (!found) return;
    found.run.displayRuntime = env.profile === "LIVE" ? "LIVE" : env.profile === "EMULATOR" ? "EMULATOR" : "DEV";
    found.run.mode = mode === "LIVE_SCENARIO" ? "LIVE_SCENARIO" : found.run.mode;
    for (const ev of Object.values(built.evidence)) found.bundle.evidence[ev.id] = ev;
    Object.assign(found.bundle.spots, built.spots);
    found.bundle.planHistory[String(built.plan.version)] = built.plan;
    found.run.resultPlanVersion = built.plan.version;
  });

  if (built.plan.validation.state === "FAIL") {
    const codes = built.plan.validation.issues.filter((i) => i.severity === "ERROR").map((i) => i.code);
    await appendEvent(runId, "VALIDATION_FAILED", "FAIL の行程は適用しない（参考表示のみ）");
    const question = {
      id: newId("q"),
      prompt: `修復を${LIMITS.maxPlanRepairAttempts}回試しましたが FAIL のままです（${codes.join(",")}）。条件は緩めていません。`,
      options: [...HUMAN_REPAIR_OPTIONS],
    };
    await patchRun(runId, {
      status: "WAITING_INPUT",
      finishedAt: null,
      error: "validation FAIL; not applied",
      leaseOwner: null,
      resultPlanVersion: built.plan.version,
      waitingQuestion: question,
    });
    await appendEvent(runId, "INPUT_REQUIRED", question.prompt, { payload: { question, codes } });
    return;
  }

  if ((run.kind === "REPLAN" || run.kind === "NEXT_PLAN") && current && run.kind === "REPLAN") {
    const d = diffPlan(current, built.plan);
    const auto = evaluateAutoApply({
      previous: current,
      next: built.plan,
      diff: d,
      policy: session.input.autoApply,
      nowIso: realNowIso(),
      expectedBaseVersion: run.basePlanVersion ?? current.version,
      mustVisitIds: mustVisit,
    });
    if (auto.apply) {
      const notifyTo = resolveNotifyTarget("in-app");
      await withStore((db) => {
        const found = findRun(db, runId);
        if (!found) return;
        found.bundle.session.currentPlanVersion = built.plan.version;
        found.run.status = "SUCCEEDED";
        found.run.finishedAt = realNowIso();
        found.run.leaseOwner = null;
      });
      await appendEvent(runId, "PLAN_AUTO_APPLIED", `AUTO_NOTIFY: ${d.summary}`, {
        payload: { diff: d, reasons: auto.reasons, notifyTo },
      });
      await appendEvent(runId, "RUN_FINISHED", "自動適用して完了");
      return;
    }
    const approvalId = newId("appr");
    await withStore((db) => {
      const found = findRun(db, runId);
      if (!found) return;
      found.couple.approvals[approvalId] = {
        id: approvalId,
        coupleId: found.couple.couple.id,
        sessionId: found.bundle.session.id,
        runId,
        planVersionFrom: current.version,
        planVersionTo: built.plan.version,
        kind: "PLAN_APPLY",
        status: "PENDING",
        summary: `${d.summary}。${auto.reasons.join(" / ")}`,
        diff: d,
        consumedAt: null,
        createdAt: realNowIso(),
        payloadId: `plan:${found.bundle.session.id}:${built.plan.version}`,
        payloadVersion: built.plan.version,
        candidateId: null,
        candidateVersion: 1,
        sourceMemoryId: null,
        sourceVersion: null,
        replacementCandidateId: null,
        presentedHash: null,
      };
      found.run.status = "WAITING_APPROVAL";
      found.run.waitingApprovalId = approvalId;
      found.run.leaseOwner = null;
    });
    await appendEvent(runId, "APPROVAL_REQUIRED", auto.reasons.join(" / "), {
      payload: { approvalId, diff: d },
    });
    return;
  }

  await withStore((db) => {
    const found = findRun(db, runId);
    if (!found) return;
    found.bundle.session.currentPlanVersion = built.plan.version;
    found.run.status = "SUCCEEDED";
    found.run.finishedAt = realNowIso();
    found.run.leaseOwner = null;
  });
  await appendEvent(runId, "PLAN_APPLIED", `行程 v${built.plan.version} を作成`);
  await appendEvent(runId, "RUN_FINISHED", "完了");
}

void allowedToolCallSchema;
void runTool;
