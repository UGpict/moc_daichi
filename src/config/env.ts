import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TIME_ZONE } from "./settings";
import { adcRuntimeSource, stripPlaceholderAdc } from "@/server/auth/adc";
import type { AppProfile, PersistTarget, ProviderMode, RuntimeMode } from "./env-types";

export type { AppProfile, PersistTarget, ProviderMode, RuntimeMode } from "./env-types";

function fileExists(path: string): boolean {
  try {
    return typeof existsSync === "function" && existsSync(path);
  } catch {
    return false;
  }
}

function readText(path: string): string | null {
  try {
    if (typeof readFileSync !== "function") return null;
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function loadDotEnv() {
  const g = globalThis as { __futariEnvLoaded?: boolean };
  if (g.__futariEnvLoaded) return;
  g.__futariEnvLoaded = true;
  for (const name of [".env.local", ".env"]) {
    const file = resolve(/* turbopackIgnore: true */ process.cwd(), name);
    if (!fileExists(file)) continue;
    const text = readText(file);
    if (!text) continue;
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (process.env[key] == null || process.env[key] === "") {
        process.env[key] = value.replace(/^["']|["']$/g, "").trim();
      }
    }
  }
}

loadDotEnv();
stripPlaceholderAdc();

function read(name: string): string | null {
  const value = process.env[name];
  if (value == null || value.trim() === "") return null;
  return value.trim().replace(/^["']|["']$/g, "");
}

function readBool(name: string, fallback: boolean): boolean {
  const value = read(name);
  if (value == null) return fallback;
  return value === "true" || value === "1";
}

function readNumber(name: string, fallback: number): number {
  const value = read(name);
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** DEV/MOCK は開発プロファイル。LIVE 要求時にキー不足でも MOCK へ落とさない。 */

export function getEnv() {
  const firebaseConfigured = Boolean(
    read("NEXT_PUBLIC_FIREBASE_API_KEY") &&
      read("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") &&
      read("NEXT_PUBLIC_FIREBASE_PROJECT_ID") &&
      read("NEXT_PUBLIC_FIREBASE_APP_ID"),
  );
  const orcaConfigured = Boolean(read("ORCAROUTER_API_KEY"));
  const mapsConfigured = Boolean(read("GOOGLE_MAPS_API_KEY"));
  const raw = (read("APP_RUNTIME") ?? "MOCK").toUpperCase();
  const emulatorHost = read("FIRESTORE_EMULATOR_HOST") ?? read("FIREBASE_AUTH_EMULATOR_HOST");
  let profile: AppProfile = "DEV";
  if (raw === "LIVE") profile = "LIVE";
  else if (raw === "EMULATOR" || emulatorHost) profile = "EMULATOR";
  else profile = "DEV";

  const liveReady = firebaseConfigured && orcaConfigured && mapsConfigured;
  const requestedLive = raw === "LIVE";
  const runtime: RuntimeMode = profile === "LIVE" ? "LIVE" : "MOCK";

  return {
    profile,
    runtime,
    requestedRuntime: requestedLive ? ("LIVE" as const) : profile === "EMULATOR" ? ("LIVE" as const) : ("MOCK" as const),
    requestedLive,
    liveReady,
    firebaseConfigured,
    orcaConfigured,
    mapsConfigured,
    orcaBaseUrl: read("ORCAROUTER_BASE_URL") ?? "https://api.orcarouter.ai/v1",
    orcaApiKey: read("ORCAROUTER_API_KEY"),
    orcaMundaneModel: read("ORCAROUTER_MUNDANE_MODEL") ?? "orcarouter/mundane",
    orcaHardModel: read("ORCAROUTER_HARD_MODEL") ?? "orcarouter/hard",
    googleMapsApiKey: read("GOOGLE_MAPS_API_KEY"),
    firebaseProjectId:
      profile === "EMULATOR"
        ? "futari-log-dev"
        : read("FIREBASE_PROJECT_ID") ?? read("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ?? "futari-log-dev",
    firebaseApiKey: read("NEXT_PUBLIC_FIREBASE_API_KEY"),
    firebaseAuthDomain: read("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    firebaseAppId: read("NEXT_PUBLIC_FIREBASE_APP_ID"),
    firestoreEmulatorHost:
      profile === "EMULATOR" ? (read("FIRESTORE_EMULATOR_HOST") ?? "127.0.0.1:8080") : read("FIRESTORE_EMULATOR_HOST"),
    authEmulatorHost:
      profile === "EMULATOR" ? (read("FIREBASE_AUTH_EMULATOR_HOST") ?? "127.0.0.1:9099") : read("FIREBASE_AUTH_EMULATOR_HOST"),
    persistBackend: profile === "DEV" ? ("json" as const) : ("firestore" as const),
    enableDemoControls: readBool("ENABLE_DEMO_CONTROLS", false),
    demoAllowedUids: (read("DEMO_ALLOWED_UIDS") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    demoAreaName: read("DEMO_AREA_NAME") ?? "名古屋駅周辺",
    demoAreaId: read("DEMO_AREA_ID") ?? "area:nagoya-station",
    demoLat: readNumber("DEMO_LAT", 35.170915),
    demoLng: readNumber("DEMO_LNG", 136.881537),
    demoDate: read("DEMO_DATE") ?? "2026-09-19",
    workerConcurrency: Math.max(1, readNumber("WORKER_CONCURRENCY", 1)),
    workerMode: (
      read("WORKER_MODE") ??
      (read("K_SERVICE") ? "http" : read("VERCEL") ? "sync" : "poller")
    ).toLowerCase(),
    workerInvokeUrl: read("WORKER_INVOKE_URL"),
    workerSharedSecret: read("WORKER_SHARED_SECRET"),
    cloudTasksQueue: read("CLOUD_TASKS_QUEUE"),
    cloudRunService: read("K_SERVICE"),
    mockAuthSecret: read("MOCK_AUTH_SECRET") ?? (profile === "LIVE" ? null : "dev-only-change-me"),
    timeZone: TIME_ZONE,
  };
}

export function publicBlockers(): { code: string; item: string; status: "BLOCKED" }[] {
  const env = getEnv();
  const items: { code: string; item: string; status: "BLOCKED" }[] = [];
  if (env.requestedLive && !env.firebaseConfigured) {
    items.push({ code: "FIREBASE", item: "LIVE 要求だが Firebase Auth / Firestore 未設定", status: "BLOCKED" });
  } else if (!env.firebaseConfigured && env.profile === "DEV") {
    items.push({ code: "FIREBASE", item: "Firebase 未設定。DEV は JSON ストアと開発用トークン", status: "BLOCKED" });
  }
  for (const p of persistBlockers()) items.push({ code: p.code, item: p.item, status: "BLOCKED" });
  if ((env.requestedLive || env.profile === "LIVE") && !env.orcaConfigured) {
    items.push({ code: "ORCAROUTER", item: "LIVE 要求だが OrcaRouter API キー未設定。モック推論へは落とさない", status: "BLOCKED" });
  }
  if ((env.requestedLive || env.profile === "LIVE") && !env.mapsConfigured) {
    items.push({ code: "GOOGLE_MAPS", item: "LIVE 要求だが Google Maps API キー未設定。モックカタログへは落とさない", status: "BLOCKED" });
  }
  items.push({
    code: "VENUE",
    item: "東京の発表会場住所・最寄り駅は未提供。開発時は名古屋駅周辺を明示使用",
    status: "BLOCKED",
  });
  return items;
}


export function providerModes(): {
  persist: PersistTarget;
  llm: ProviderMode;
  places: ProviderMode;
  routes: ProviderMode;
} {
  const env = getEnv();
  const persist: PersistTarget =
    env.persistBackend === "json" ? "json" : env.profile === "EMULATOR" ? "firestore-emulator" : "firestore-live";
  if (env.profile === "DEV") {
    return { persist, llm: "MOCK", places: "MOCK", routes: "MOCK" };
  }
  const llm: ProviderMode = env.orcaConfigured ? "LIVE" : env.profile === "LIVE" ? "BLOCKED" : "MOCK";
  const maps: ProviderMode = env.profile === "LIVE" ? (env.mapsConfigured ? "LIVE" : "BLOCKED") : "MOCK";
  return { persist, llm, places: maps, routes: maps };
}

export function persistBlockers(): { code: string; item: string; status: "BLOCKED"; kind?: string }[] {
  const env = getEnv();
  if (env.persistBackend === "json") return [];
  stripPlaceholderAdc();
  if (env.profile === "EMULATOR" || env.firestoreEmulatorHost || env.authEmulatorHost) {
    try {
      const { emulatorHosts, probePortSync } = require("@/server/auth/emulatorGuard") as typeof import("@/server/auth/emulatorGuard");
      const hosts = emulatorHosts();
      const firestoreUp = probePortSync(hosts.firestore);
      const authUp = probePortSync(hosts.auth);
      if (!firestoreUp || !authUp) {
        return [
          {
            code: "FIRESTORE",
            item: `CONNECT: Firebase Emulator 未起動（firestore=${firestoreUp} auth=${authUp} @ ${hosts.firestore} / ${hosts.auth}）。本番へは接続しない`,
            status: "BLOCKED",
            kind: "CONNECT",
          },
        ];
      }
      return [];
    } catch {
      return [
        {
          code: "FIRESTORE",
          item: "CONNECT: Emulator probe を読めない。本番へは接続しない",
          status: "BLOCKED",
          kind: "CONNECT",
        },
      ];
    }
  }
  const adc = adcRuntimeSource();
  if (!adc.usable) {
    return [
      {
        code: "FIRESTORE",
        item: `CREDENTIALS: ${adc.detail}`,
        status: "BLOCKED",
        kind: "CREDENTIALS",
      },
    ];
  }
  return [];
}

export function assertLiveProvider(kind: "llm" | "places" | "routes"): void {
  const modes = providerModes();
  const mode = kind === "llm" ? modes.llm : modes.places;
  if (mode === "BLOCKED") {
    if (kind === "llm") throw new Error("BLOCKED: ORCAROUTER_API_KEY missing; not falling back to mock LLM");
    throw new Error("BLOCKED: GOOGLE_MAPS_API_KEY missing; not falling back to mock places");
  }
}

export function rejectMockId(id: string | null | undefined, context: string): void {
  const env = getEnv();
  if (env.profile !== "LIVE") return;
  if (id && (id.startsWith("mock:") || id.startsWith("mock/"))) {
    throw new Error(`LIVE では mock ID を拒否します (${context}: ${id})`);
  }
}
