import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { getEnv, providerModes, type PersistTarget } from "../src/config/env";
import { applyEmulatorEnv } from "../src/server/auth/emulatorGuard";
import { tokyoToday } from "../src/lib/time";
import {
  blockedAll,
  judgment,
  memoryInfluenceVerdict,
  rainVerdict,
  reflectionQuestionVerdict,
  scoreOutcome,
  type CriterionJudgment,
  type RunOutcome,
} from "../src/domain/demo/criteria61";
import { isPersistBlocked } from "../src/server/repositories/persistErrors";

const BASE = process.env.DEMO_BASE_URL ?? "http://127.0.0.1:3000";
const five = process.argv.includes("--five");
if (process.argv.includes("--emu") || process.argv.includes("--emulator")) {
  process.env.APP_RUNTIME = "EMULATOR";
}

type Report = {
  ok: boolean;
  outcome: RunOutcome;
  git?: string;
  runIds: string[];
  durationsMs: number[];
  costs: unknown[];
  notes: string[];
  failures: string[];
  repairCount: number;
  criteria: CriterionJudgment[];
  persistKind?: string;
  countedAs?: "LIVE" | "EMULATOR" | "DEV";
  providers?: ReturnType<typeof providerModes>;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function portOpen(): Promise<boolean> {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(800) });
    return res.ok || res.status === 404 || res.status >= 400;
  } catch {
    return false;
  }
}

function killDevStack() {
  const needles = ["next-server", "next dev", "src/worker/index.ts", "scripts/dev.ts"];
  const self = process.pid;
  for (const name of readdirSync("/proc")) {
    if (!/^\d+$/.test(name)) continue;
    const pid = Number(name);
    if (pid === self) continue;
    let cmd = "";
    try {
      cmd = readFileSync(`/proc/${pid}/cmdline`, "utf8").replace(/\0/g, " ");
    } catch {
      continue;
    }
    if (cmd.includes("live-demo.ts")) continue;
    if (!needles.some((n) => cmd.includes(n))) continue;
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
}

async function freePort() {
  for (let i = 0; i < 20; i++) {
    killDevStack();
    await sleep(400);
    if (!(await portOpen())) return;
  }
  throw new Error("port 3000 still in use after kill");
}

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok || res.status === 404) return;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error("server not ready");
}

function ensureServer(): ChildProcess | null {
  return fetch(BASE)
    .then(() => null)
    .catch(() => {
      return spawn("npx", ["tsx", "scripts/dev.ts"], {
        stdio: "inherit",
        env: process.env,
        shell: process.platform === "win32",
      });
    }) as unknown as ChildProcess | null;
}

async function api(path: string, init: RequestInit & { token?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} ${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function firebaseAnonymous(): Promise<{ uid: string; token: string }> {
  const env = getEnv();
  if (env.profile === "EMULATOR") {
    applyEmulatorEnv();
    const host = env.authEmulatorHost ?? "127.0.0.1:9099";
    const res = await fetch(
      `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key-for-emulator`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const json = (await res.json()) as { idToken?: string; localId?: string; error?: { message?: string } };
    if (!res.ok || !json.idToken || !json.localId) {
      throw new Error(`emulator anonymous failed: ${json.error?.message ?? res.status}`);
    }
    return { uid: json.localId, token: json.idToken };
  }
  if (!env.firebaseApiKey) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY missing");
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(env.firebaseApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
      signal: AbortSignal.timeout(10000),
    },
  );
  const json = (await res.json()) as { idToken?: string; localId?: string; error?: { message?: string } };
  if (!res.ok || !json.idToken || !json.localId) {
    throw new Error(`firebase anonymous failed: ${json.error?.message ?? res.status}`);
  }
  return { uid: json.localId, token: json.idToken };
}

async function waitRun(token: string, runId: string, timeoutMs = 120_000) {
  const start = Date.now();
  for (;;) {
    const view = await api(`/api/runs/${runId}`, { token });
    const status = view.run.status as string;
    if (["SUCCEEDED", "WAITING_INPUT", "WAITING_APPROVAL", "FAILED", "PARTIAL", "INTERRUPTED"].includes(status)) {
      return { view, ms: Date.now() - start };
    }
    if (Date.now() - start > timeoutMs) throw new Error(`timeout ${runId} ${status}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

function persistScoreTarget(target: PersistTarget | undefined): "live" | "emulator" | "json" {
  if (target === "firestore-emulator") return "emulator";
  if (target === "json") return "json";
  return "live";
}

function reportOf(partial: Omit<Report, "ok" | "outcome">): Report {
  const modes = partial.providers ?? providerModes();
  const outcome = scoreOutcome(partial.criteria, persistScoreTarget(modes.persist));
  const countedAs = modes.persist === "firestore-emulator" ? "EMULATOR" : modes.persist === "firestore-live" ? "LIVE" : "DEV";
  return {
    ...partial,
    providers: modes,
    countedAs,
    outcome,
    ok: outcome === "完全成功" || outcome === "EMULATOR成功",
  };
}

async function onePass(): Promise<Report> {
  const notes: string[] = [];
  const failures: string[] = [];
  const runIds: string[] = [];
  const durationsMs: number[] = [];
  const costs: unknown[] = [];
  const criteria: CriterionJudgment[] = [];
  let repairCount = 0;
  let persistKind = "ok";
  const git = existsSync(".git")
    ? execSync("git rev-parse --short HEAD").toString().trim()
    : undefined;
  const modes = providerModes();
  const empty = () =>
    reportOf({ git, runIds, durationsMs, costs, notes, failures, repairCount, criteria, persistKind, providers: modes });

  const env = getEnv();
  try {
  let token: string | undefined = process.env.DEMO_FIREBASE_ID_TOKEN;
  if (!token) {
    if (env.profile === "LIVE" || env.profile === "EMULATOR") {
      const fb = await firebaseAnonymous();
      token = fb.token;
      notes.push(`firebase uid=${fb.uid} project=${env.firebaseProjectId}`);
    } else {
      const auth = await fetch(`${BASE}/api/auth/anonymous`, { method: "POST" });
      const setCookie = auth.headers.get("set-cookie") ?? "";
      token = setCookie.match(/futari_token=([^;]+)/)?.[1];
      if (!token) {
        const body = (await auth.json().catch(() => ({}))) as { token?: string };
        token = body.token;
      }
    }
  }
  if (!token) throw new Error("no token");
  const me = await api("/api/me", { token });
  persistKind = String(me.persist?.kind ?? (env.persistBackend === "firestore" ? "unknown" : "ok"));
  notes.push(`providers persist=${modes.persist} llm=${modes.llm} places=${modes.places} routes=${modes.routes}`);
  if (persistKind === "ok" && env.profile === "LIVE" && env.persistBackend === "firestore") {
    criteria.push(judgment("persist_backend", "PASS", me.persist?.detail ?? "Firestore LIVE"));
  } else if (persistKind === "ok" && env.profile === "EMULATOR") {
    criteria.push(judgment("persist_backend", "PASS", me.persist?.detail ?? "Firestore Emulator（本番ではない）"));
  } else if (env.profile === "DEV") {
    criteria.push(judgment("persist_backend", "PASS", `DEV/json (${persistKind})。LIVE 成功には数えない`));
  } else if (
    persistKind === "CREDENTIALS" ||
    persistKind === "PERMISSION" ||
    persistKind === "NOT_CONFIGURED" ||
    persistKind === "UNIMPLEMENTED" ||
    persistKind === "CONNECT"
  ) {
    criteria.push(
      judgment(
        "persist_backend",
        "BLOCKED",
        `${persistKind}: ${me.persist?.detail ?? me.persistBlockers?.[0]?.item ?? "persist blocked"}`,
      ),
    );
  } else {
    criteria.push(judgment("persist_backend", "FAIL", `${env.profile} persist kind=${persistKind} backend=${me.persist?.backend}`));
  }
  if ((env.profile === "LIVE" || env.profile === "EMULATOR") && persistKind !== "ok") {
    notes.push(`persist BLOCKED ${persistKind}`);
    criteria.splice(0, criteria.length, ...blockedAll(`persist ${persistKind}`, criteria.find((c) => c.id === "persist_backend")));
    failures.push(`persist ${persistKind}`);
    return empty();
  }
  const couple = await api("/api/couples", {
    method: "POST",
    token,
    body: JSON.stringify({ isDemo: true }),
  });
  const date = env.demoDate;
  let meet = {
    name: "名古屋駅",
    lat: env.demoLat,
    lng: env.demoLng,
    spotId: env.profile === "LIVE" ? null : "mock:nagoya-station",
    provider: env.profile === "LIVE" ? "places" : "mock",
    resolved: env.profile !== "LIVE",
  };
  let museum: { id: string; name: string; lat: number; lng: number } | null = null;
  if (env.profile === "LIVE") {
    const station = await api(`/api/places/search?q=${encodeURIComponent("名古屋駅")}`, { token });
    const hit = (station.spots as { id: string; name: string; lat: number; lng: number }[])?.[0];
    if (!hit) throw new Error("LIVE: 名古屋駅の Places 検索が空");
    meet = {
      name: hit.name,
      lat: hit.lat,
      lng: hit.lng,
      spotId: hit.id,
      provider: "places",
      resolved: true,
    };
    const art = await api(`/api/places/search?q=${encodeURIComponent("愛知県美術館")}`, { token });
    museum = (art.spots as { id: string; name: string; lat: number; lng: number }[])?.[0] ?? null;
    notes.push(`meet=${hit.id} museum=${museum?.id ?? "none"}`);
  }
  const session = await api(`/api/couples/${couple.id}/sessions`, {
    method: "POST",
    token,
    body: JSON.stringify({
      dateTokyo: date,
      startTime: "13:00",
      endTime: "18:00",
      meet,
      end: meet,
      budget: { mealsJpy: 8000, facilitiesJpy: 4000, transitJpy: 2000 },
      preferences: [
        { id: "pref_self", subject: "SELF", content: "散歩と展示", priority: "PREFER", source: "SELF_REPORT" },
        { id: "pref_partner", subject: "PARTNER", content: "甘いもの", priority: "MUST", source: "PARTNER_STATEMENT_REPORTED" },
      ],
      fixedAppointments:
        env.profile === "LIVE"
          ? museum
            ? [
                {
                  id: "fix_art",
                  label: museum.name,
                  spotId: museum.id,
                  spotNameHint: museum.name,
                  startAt: `${date}T15:00:00+09:00`,
                  endAt: `${date}T16:00:00+09:00`,
                  kind: "TIME_FIXED",
                },
              ]
            : []
          : [
              {
                id: "fix_art",
                label: "愛知県美術館",
                spotId: "mock:aichi-art-museum",
                spotNameHint: "愛知県美術館",
                startAt: `${date}T15:00:00+09:00`,
                endAt: `${date}T16:00:00+09:00`,
                kind: "TIME_FIXED",
              },
            ],
      autoApply: {
        enabled: true,
        acknowledgedScope: "未着手1件 PASS 予算増なし 終了遅延なし 移動増なし",
        validUntil: "2099-01-01T00:00:00.000Z",
      },
      travelMode: "WALK",
      areaName: env.demoAreaName,
      areaId: env.demoAreaId,
      areaLat: env.demoLat,
      areaLng: env.demoLng,
      radiusMeters: 2500,
      assembleMode: "AI",
    }),
  });

  const init = await api(`/api/sessions/${session.sessionId}/runs`, {
    method: "POST",
    token,
    headers: { "Idempotency-Key": `live-${session.sessionId}` },
    body: JSON.stringify({ kind: "INITIAL_PLAN" }),
  });
  const first = await waitRun(token, init.runId);
  runIds.push(init.runId);
  durationsMs.push(first.ms);
  costs.push(first.view.run.cost);
  repairCount = ((first.view.events as { type: string }[]) ?? []).filter((e) => e.type === "REPAIR_ATTEMPTED").length;
  notes.push(`repairs=${repairCount}`);
  try {
    const trace = await api(`/api/runs/${init.runId}/llm-trace`, { token });
    notes.push(`llmTraceUsd=${trace.costUsd} jpy=${trace.costJpy} rows=${(trace.rows as unknown[]).length}`);
  } catch {
    notes.push("llm-trace missing");
  }

  const snap1 = await api(`/api/sessions/${session.sessionId}`, { token });
  const items = snap1.plan?.items ?? [];
  if (items.length < 3 || items.length > 4) {
    failures.push(`spot count ${items.length}`);
    criteria.push(judgment("spots_3_to_4", "FAIL", `items=${items.length}`));
  } else {
    criteria.push(judgment("spots_3_to_4", "PASS", `items=${items.length}`));
  }
  const locked = items.find((i: { locked: boolean }) => i.locked);
  if (!locked) {
    failures.push("locked item missing");
    criteria.push(judgment("locked_item", "FAIL", "locked item missing"));
  } else {
    criteria.push(judgment("locked_item", "PASS", locked.id ?? "locked"));
  }
  if (snap1.plan?.openings?.some((o: { state: string }) => o.state === "CLOSED")) {
    failures.push("CLOSED present");
    criteria.push(judgment("no_closed", "FAIL", "CLOSED present"));
  } else {
    criteria.push(judgment("no_closed", "PASS", "no CLOSED"));
  }
  notes.push(`first status=${first.view.run.status} validation=${snap1.plan?.validation?.state} items=${items.length} runs=${(snap1.runs as {id:string;status:string;kind:string}[]).map((r)=>r.kind+":"+r.status).join(",")}`);
  if (snap1.plan?.validation?.state === "FAIL") {
    failures.push(`initial validation FAIL: ${(snap1.plan.validation.issues as {code:string}[]).map((i)=>i.code).join(",")}`);
    criteria.push(judgment("initial_not_fail", "FAIL", `FAIL ${(snap1.plan.validation.issues as {code:string}[]).map((i)=>i.code).join(",")}`));
  } else {
    criteria.push(judgment("initial_not_fail", "PASS", String(snap1.plan?.validation?.state ?? "none")));
  }
  if (!["SUCCEEDED", "WAITING_APPROVAL"].includes(first.view.run.status)) {
    failures.push(`initial run ${first.view.run.status}`);
    return empty();
  }

  await api(`/api/sessions/${session.sessionId}/progress`, {
    method: "POST",
    token,
    body: JSON.stringify({ confirm: true, status: "CONFIRMED" }),
  });
  const doneItem =
    items.find((i: { locked: boolean; progress: string }) => i.locked) ?? items.at(-1);
  if (doneItem) {
    await api(`/api/sessions/${session.sessionId}/progress`, {
      method: "POST",
      token,
      body: JSON.stringify({
        itemId: doneItem.id,
        progress: "DONE",
        status: "IN_PROGRESS",
        location: { lat: 35.170278, lng: 136.908611, label: "愛知県美術館" },
      }),
    });
  }

  const rain = await api(`/api/sessions/${session.sessionId}/scenarios`, {
    method: "POST",
    token,
    body: JSON.stringify({ kind: "WEATHER", overlay: { precipitationMm: 8 } }),
  });
  const rainWait = await waitRun(token, rain.runId);
  runIds.push(rain.runId);
  durationsMs.push(rainWait.ms);
  let snapRain = await api(`/api/sessions/${session.sessionId}`, { token });
  const auto = (snapRain.events as { type: string }[]).some((e) => e.type === "PLAN_AUTO_APPLIED");
  const approval = (snapRain.approvals as { status: string; id: string; kind: string }[]).find(
    (a) => a.status === "PENDING" && a.kind === "PLAN_APPLY",
  );
  const rainReasons = ((snapRain.events as { type: string; payload?: { reasons?: string[]; validation?: string } }[]) ?? [])
    .filter((e) => e.type === "APPROVAL_REQUIRED" || e.type === "PLAN_AUTO_APPLIED")
    .flatMap((e) => e.payload?.reasons ?? []);
  const rainJudge = rainVerdict({
    autoApplied: auto,
    pendingApproval: Boolean(approval),
    nextValidationState: snapRain.plan?.validation?.state ?? null,
    reasons: rainReasons,
  });
  criteria.push(rainJudge);
  notes.push(auto ? "rain AUTO_NOTIFY" : approval ? "rain APPROVAL (not complete success)" : `rain status=${rainWait.view.run.status}`);
  if (rainJudge.verdict === "FAIL") failures.push(rainJudge.detail);
  if (approval) {
    await api(`/api/approvals/${approval.id}/decision`, {
      method: "POST",
      token,
      body: JSON.stringify({ decision: "APPROVE" }),
    });
    snapRain = await api(`/api/sessions/${session.sessionId}`, { token });
  }

  const beforeDelayVersion = snapRain.session.currentPlanVersion;
  const delay = await api(`/api/sessions/${session.sessionId}/scenarios`, {
    method: "POST",
    token,
    body: JSON.stringify({
      kind: "TRAVEL_DELAY",
      overlay: { delayMinutes: 55 },
      spotId: museum?.id ?? snapRain.plan?.items.find((i: { locked: boolean }) => !i.locked)?.spotId,
    }),
  });
  const delayWait = await waitRun(token, delay.runId);
  runIds.push(delay.runId);
  durationsMs.push(delayWait.ms);
  const snapDelay = await api(`/api/sessions/${session.sessionId}`, { token });
  if (snapDelay.session.currentPlanVersion !== beforeDelayVersion) {
    failures.push("plan changed before delay approval");
    criteria.push(judgment("delay_not_applied_early", "FAIL", "plan changed before delay approval"));
  } else {
    criteria.push(judgment("delay_not_applied_early", "PASS", `version=${beforeDelayVersion}`));
  }
  if (delayWait.view.run.status !== "WAITING_APPROVAL") {
    notes.push(`delay status=${delayWait.view.run.status} (expected WAITING_APPROVAL)`);
    if (delayWait.view.run.status === "SUCCEEDED") {
      failures.push("delay auto-applied");
      criteria.push(judgment("delay_waiting_approval", "FAIL", "delay auto-applied"));
    } else {
      criteria.push(judgment("delay_waiting_approval", "FAIL", `status=${delayWait.view.run.status}`));
    }
  } else {
    criteria.push(judgment("delay_waiting_approval", "PASS", "WAITING_APPROVAL"));
  }

  const refl = await api(`/api/sessions/${session.sessionId}/runs`, {
    method: "POST",
    token,
    body: JSON.stringify({ kind: "REFLECTION", note: "カフェは喜んでた。展示は途中で疲れてた" }),
  });
  const reflWait = await waitRun(token, refl.runId);
  runIds.push(refl.runId);
  notes.push(`reflection status=${reflWait.view.run.status}`);
  const reflJudge = reflectionQuestionVerdict(
    reflWait.view.run.status,
    Boolean(reflWait.view.run.waitingQuestion?.id),
  );
  criteria.push(reflJudge);
  if (reflJudge.verdict === "FAIL") failures.push(reflJudge.detail);
  if (reflWait.view.run.status === "WAITING_INPUT") {
    const q = reflWait.view.run.waitingQuestion;
    if (q?.id) {
      await api(`/api/runs/${refl.runId}/answers`, {
        method: "POST",
        token,
        body: JSON.stringify({
          questionId: q.id,
          answer: "長く立つのがしんどいと言っていた",
        }),
      });
    }
  } else if (reflWait.view.run.status === "WAITING_APPROVAL") {
    notes.push("確認質問なし。保存候補の承認へ（完全成功にしない）");
  }
  const snapMem = await api(`/api/sessions/${session.sessionId}`, { token });
  const pendingMems = (snapMem.approvals as { kind: string; status: string; id: string }[]).filter(
    (a) => a.kind === "MEMORY_SAVE" && a.status === "PENDING",
  );
  if ((snapMem.memories as unknown[]).length > 0) {
    failures.push("memory saved before approval");
    criteria.push(judgment("memory_not_saved_before_approval", "FAIL", "memory saved before approval"));
  } else {
    criteria.push(judgment("memory_not_saved_before_approval", "PASS", "empty before approval"));
  }
  if (!pendingMems.length) {
    failures.push("no memory approval");
    criteria.push(judgment("memory_saved_after_approval", "FAIL", "no memory approval"));
  } else {
    for (const pendingMem of pendingMems) {
      await api(`/api/approvals/${pendingMem.id}/decision`, {
        method: "POST",
        token,
        body: JSON.stringify({ decision: "APPROVE" }),
      });
    }
  }
  const afterMem = await api(`/api/sessions/${session.sessionId}`, { token });
  if ((afterMem.memories as unknown[]).length < 1) {
    failures.push("memory missing after approval");
    if (pendingMems.length) criteria.push(judgment("memory_saved_after_approval", "FAIL", "memory missing after approval"));
  } else if (pendingMems.length) {
    criteria.push(judgment("memory_saved_after_approval", "PASS", `n=${(afterMem.memories as unknown[]).length}`));
  }

  const next = await api(`/api/couples/${couple.id}/sessions`, {
    method: "POST",
    token,
    body: JSON.stringify(session.input),
  });
  const nextRun = await api(`/api/sessions/${next.sessionId}/runs`, {
    method: "POST",
    token,
    body: JSON.stringify({ kind: "NEXT_PLAN" }),
  });
  const nextWait = await waitRun(token, nextRun.runId);
  runIds.push(nextRun.runId);
  durationsMs.push(nextWait.ms);
  const snapNext = await api(`/api/sessions/${next.sessionId}`, { token });
  const influences = snapNext.plan?.memoryInfluences ?? [];
  const inflJudge = memoryInfluenceVerdict(influences);
  criteria.push(inflJudge);
  if (inflJudge.verdict === "FAIL") failures.push(inflJudge.detail);
  notes.push(inflJudge.detail);
  const firstNames = items.map((i: { spotId: string }) => snap1.spots?.[i.spotId]?.name ?? i.spotId);
  const nextNames = (snapNext.plan?.items ?? []).map(
    (i: { spotId: string }) => snapNext.spots?.[i.spotId]?.name ?? i.spotId,
  );
  notes.push(`memoryPlanDiff ${firstNames.join(">") || "∅"} => ${nextNames.join(">") || "∅"}`);
  mkdirSync("docs/reports", { recursive: true });
  writeFileSync(
    join("docs/reports", "memory-plan-diff.json"),
    JSON.stringify(
      {
        firstSessionId: session.sessionId,
        nextSessionId: next.sessionId,
        firstNames,
        nextNames,
        influences,
      },
      null,
      2,
    ),
  );

  try {
    const sessionTrace = await api(`/api/sessions/${session.sessionId}/llm-trace`, { token });
    notes.push(
      `sessionTraceJpy=${sessionTrace.costJpy} runCostJpy=${sessionTrace.runCostJpy} match=${sessionTrace.matchesSum}`,
    );
    if (sessionTrace.matchesSum === false) failures.push("session llm-trace cost mismatch");
  } catch {
    notes.push("session llm-trace missing");
  }

  await api(`/api/runs/${init.runId}/replay-export`, { method: "POST", token, body: "{}" });

  void me;
  return empty();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    notes.push(msg.slice(0, 400));
    if (isPersistBlocked(error) || /persistKind|CREDENTIALS|UNIMPLEMENTED|ADC|Firestore/.test(msg)) {
      persistKind = isPersistBlocked(error) ? error.kind : /UNIMPLEMENTED/.test(msg) ? "UNIMPLEMENTED" : "CREDENTIALS";
      failures.push(`persist ${persistKind}`);
      const persist = judgment("persist_backend", "BLOCKED", msg.slice(0, 240));
      criteria.splice(0, criteria.length, ...blockedAll(`persist ${persistKind}`, persist));
      return empty();
    }
    failures.push(msg.slice(0, 240));
    if (!criteria.length) criteria.push(...blockedAll(msg.slice(0, 160)));
    return empty();
  }
}

async function main() {
  let child: ChildProcess | null = null;
  try {
    if ((process.env.APP_RUNTIME ?? "").toUpperCase() === "EMULATOR") applyEmulatorEnv();
    const env = getEnv();
    process.env.ENABLE_DEMO_CONTROLS ??= "true";
    process.env.DEMO_DATE ??= env.demoDate;
    console.log(JSON.stringify({ profile: env.profile, providers: providerModes(), countedAs: env.profile }));
    if (env.profile === "LIVE" || env.profile === "EMULATOR") {
      const today = tokyoToday();
      if ((process.env.DEMO_DATE ?? env.demoDate) < today) {
        process.env.DEMO_DATE = today;
        console.log(JSON.stringify({ demoDateAdjustedToTokyoToday: today }));
      }
    }
    if (env.profile === "EMULATOR") {
      applyEmulatorEnv();
      const { ensureEmulator } = await import("./ensure-emulator");
      await ensureEmulator();
    }
    if (env.profile === "LIVE" || env.profile === "EMULATOR") {
      const fb = await firebaseAnonymous();
      process.env.DEMO_FIREBASE_ID_TOKEN = fb.token;
      process.env.DEMO_ALLOWED_UIDS = fb.uid;
      process.env.ENABLE_DEMO_CONTROLS = "true";
      console.log(JSON.stringify({ firebaseAnonymous: true, uidPrefix: fb.uid.slice(0, 6), projectId: env.firebaseProjectId }));
      await freePort();
    }
    const maybe = await fetch(BASE).then(() => null).catch(() => "start");
    if (maybe === "start" || env.profile === "LIVE" || env.profile === "EMULATOR") {
      child = spawn("npx", ["tsx", "scripts/dev.ts"], {
        stdio: "inherit",
        env: process.env,
        shell: process.platform === "win32",
      });
    }
    await waitForServer();
    const reports: Report[] = [];
    const n = five ? 5 : 1;
    for (let i = 0; i < n; i++) {
      const report = await onePass();
      reports.push(report);
    }
    mkdirSync("docs/reports", { recursive: true });
    const out = join("docs/reports", five ? "demo-five.json" : "demo-live.json");
    writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), spec: "v0.4 §6.1", reports }, null, 2));
    writeFileSync(
      join("docs/reports", "criteria-61.json"),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          spec: "v0.4 §6.1",
          completeSuccess: reports.filter((r) => r.outcome === "完全成功").length,
          emulatorSuccess: reports.filter((r) => r.outcome === "EMULATOR成功").length,
          countedAs: reports.map((r) => r.countedAs),
          providers: reports[0]?.providers ?? providerModes(),
          outcomes: reports.map((r) => r.outcome),
          criteria: reports.map((r, i) => ({ n: i + 1, outcome: r.outcome, persistKind: r.persistKind, countedAs: r.countedAs, providers: r.providers, criteria: r.criteria })),
        },
        null,
        2,
      ),
    );
    const last = reports.at(-1);
    const totalRepairs = reports.reduce((n, r) => n + r.repairCount, 0);
    console.log(
      JSON.stringify(
        {
          file: out,
          ok: reports.every((r) => r.ok),
          count: reports.length,
          liveSuccess: reports.filter((r) => r.outcome === "完全成功").length,
          emulatorSuccess: reports.filter((r) => r.outcome === "EMULATOR成功").length,
          providers: reports[0]?.providers ?? providerModes(),
          outcomes: reports.map((r) => r.outcome),
          totalRepairs,
          last,
        },
        null,
        2,
      ),
    );
    if (!reports.every((r) => r.ok) || reports.length < n) process.exit(1);
  } finally {
    child?.kill("SIGTERM");
  }
}

void ensureServer;
void main();
