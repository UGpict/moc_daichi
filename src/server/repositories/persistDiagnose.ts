import { existsSync, statSync } from "node:fs";
import { basename, dirname } from "node:path";
import { getEnv } from "@/config/env";
import { adcRuntimeSource, stripPlaceholderAdc } from "@/server/auth/adc";
import { emulatorHosts, probePortSync } from "@/server/auth/emulatorGuard";
import { lastFirebaseAdminInitError } from "@/server/auth/firebase";
import {
  PersistBlockedError,
  classifyPersistFailure,
  redactPersistText,
  type PersistBlockKind,
} from "./persistErrors";
import { jsonStoreFile } from "./store";

export type PersistDiagnosis = {
  backend: "json" | "firestore";
  kind: "ok" | PersistBlockKind;
  detail: string;
  operation: string | null;
  errorName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  currentWriteTarget: "json:.data/store.json" | "firestore:collections" | "firestore:emulator" | "none";
  leftoverStoreJson: { exists: boolean; bytes: number | null };
  implemented: {
    jsonStore: true;
    firestoreRepo: true;
    switchByPersistBackend: true;
    scopedWrites: true;
    approvalTransaction: true;
    userAdc: true;
    emulatorGuard: true;
  };
  adc: {
    envSet: boolean;
    fileExists: boolean;
    pathIsPlaceholder: boolean;
    basename: string | null;
    parentDirExists: boolean;
    usesApplicationDefault: true;
  };
  projectIdSet: boolean;
  emulator: boolean;
  emulatorReady: boolean | null;
  refusedProduction: boolean;
};

function adcPath(): string | null {
  const value = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!value || !value.trim()) return null;
  return value.trim();
}

function leftoverStore() {
  try {
    const path = jsonStoreFile();
    if (!existsSync(path)) return { exists: false, bytes: null as number | null };
    return { exists: true, bytes: statSync(path).size };
  } catch {
    return { exists: false, bytes: null as number | null };
  }
}

const implemented = {
  jsonStore: true,
  firestoreRepo: true,
  switchByPersistBackend: true,
  scopedWrites: true,
  approvalTransaction: true,
  userAdc: true,
  emulatorGuard: true,
} as const;

function adcInfo(path: string | null): PersistDiagnosis["adc"] {
  return {
    envSet: Boolean(path),
    fileExists: Boolean(path && existsSync(path)),
    pathIsPlaceholder: false,
    basename: path ? basename(path) : null,
    parentDirExists: Boolean(path && existsSync(dirname(path))),
    usesApplicationDefault: true,
  };
}

function fail(
  kind: PersistBlockKind,
  operation: string,
  detail: string,
  extra: {
    error?: { name?: string; message?: string; code?: string | number | null };
    emulator?: boolean;
    emulatorReady?: boolean | null;
    refusedProduction?: boolean;
    write?: PersistDiagnosis["currentWriteTarget"];
  } = {},
): PersistDiagnosis {
  const env = getEnv();
  const path = adcPath();
  return {
    backend: env.persistBackend,
    kind,
    detail: redactPersistText(detail),
    operation,
    errorName: extra.error?.name ?? "PersistBlockedError",
    errorCode: extra.error?.code != null ? String(extra.error.code) : null,
    errorMessage: extra.error?.message ? redactPersistText(extra.error.message) : null,
    currentWriteTarget: extra.write ?? "none",
    leftoverStoreJson: leftoverStore(),
    implemented,
    adc: adcInfo(path),
    projectIdSet: Boolean(env.firebaseProjectId),
    emulator: extra.emulator ?? Boolean(env.firestoreEmulatorHost || env.profile === "EMULATOR"),
    emulatorReady: extra.emulatorReady ?? null,
    refusedProduction: extra.refusedProduction ?? false,
  };
}

function ok(
  detail: string,
  write: PersistDiagnosis["currentWriteTarget"],
  extra: { emulator?: boolean; emulatorReady?: boolean | null } = {},
): PersistDiagnosis {
  const env = getEnv();
  const path = adcPath();
  return {
    backend: env.persistBackend,
    kind: "ok",
    detail,
    operation: null,
    errorName: null,
    errorCode: null,
    errorMessage: null,
    currentWriteTarget: write,
    leftoverStoreJson: leftoverStore(),
    implemented,
    adc: adcInfo(path),
    projectIdSet: Boolean(env.firebaseProjectId),
    emulator: extra.emulator ?? Boolean(env.profile === "EMULATOR"),
    emulatorReady: extra.emulatorReady ?? null,
    refusedProduction: false,
  };
}

function emulatorDownDiagnosis(): PersistDiagnosis {
  const hosts = emulatorHosts();
  const firestoreUp = probePortSync(hosts.firestore);
  const authUp = probePortSync(hosts.auth);
  if (firestoreUp && authUp) return ok("Firebase Emulator が応答している", "firestore:emulator", { emulator: true, emulatorReady: true });
  return fail(
    "CONNECT",
    "probe FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST",
    `Firebase Emulator 未起動（firestore=${firestoreUp} @ ${hosts.firestore}, auth=${authUp} @ ${hosts.auth}）。本番 Firestore へは接続しない`,
    { emulator: true, emulatorReady: false, refusedProduction: true },
  );
}

/** ファイル必須チェックはしない。Emulator 未起動だけ同期で止める。 */
export function diagnosePersistSync(): PersistDiagnosis {
  const env = getEnv();
  stripPlaceholderAdc();
  if (env.persistBackend === "json") {
    return ok(`DEV はローカル JSON（${jsonStoreFile()}）`, "json:.data/store.json", { emulator: false, emulatorReady: null });
  }
  if (env.profile === "EMULATOR" || env.firestoreEmulatorHost || env.authEmulatorHost) {
    return emulatorDownDiagnosis();
  }
  if (!env.firebaseProjectId) {
    return fail("NOT_CONFIGURED", "getEnv().firebaseProjectId", "FIREBASE_PROJECT_ID が無い。Firestore 未設定。");
  }
  const adc = adcRuntimeSource();
  if (!adc.usable) {
    return fail("CREDENTIALS", "applicationDefault()", adc.detail);
  }
  return ok(
    "applicationDefault() で接続する。GOOGLE_APPLICATION_CREDENTIALS 必須ではない。実接続は diagnosePersist()",
    "firestore:collections",
    { emulator: false, emulatorReady: null },
  );
}

/** 実接続の結果から CREDENTIALS / PERMISSION / NOT_CONFIGURED を切る。 */
export async function diagnosePersist(): Promise<PersistDiagnosis> {
  const sync = diagnosePersistSync();
  if (sync.backend === "json") return sync;
  if (sync.kind !== "ok") return sync;
  try {
    const { firestoreDb } = await import("@/server/auth/firebase");
    if (sync.emulator) {
      const { assertEmulatorOrThrow } = await import("@/server/auth/firebase");
      await assertEmulatorOrThrow();
    }
    const db = firestoreDb();
    if (!db) {
      const init = lastFirebaseAdminInitError();
      if (init) {
        const kind = classifyPersistFailure({ message: init.message, code: init.code, operation: init.operation });
        return fail(kind, init.operation, init.message, { error: init, emulator: sync.emulator, emulatorReady: sync.emulatorReady });
      }
      return fail(
        "CREDENTIALS",
        "firebase-admin initializeApp(applicationDefault)",
        "applicationDefault() で Admin を初期化できない。gcloud auth application-default login を確認。",
        { emulator: sync.emulator, emulatorReady: sync.emulatorReady },
      );
    }
    await db.collection("couples").limit(1).get();
    return ok(
      sync.emulator ? "Emulator で couples.limit(1) が成功" : "Admin Firestore で couples.limit(1) が成功",
      sync.emulator ? "firestore:emulator" : "firestore:collections",
      { emulator: sync.emulator, emulatorReady: sync.emulator ? true : null },
    );
  } catch (error) {
    if (error instanceof PersistBlockedError) {
      return fail(error.kind, error.operation ?? "persist", error.message, {
        error: { name: error.name, message: error.message, code: error.errorCode },
        emulator: sync.emulator,
        emulatorReady: sync.emulatorReady,
        refusedProduction: error.kind === "CONNECT" && Boolean(sync.emulator),
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    const code =
      error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : null;
    const kind = classifyPersistFailure({ message, code, operation: "firestore.collection('couples').limit(1).get" });
    return fail(kind, "firestore.collection('couples').limit(1).get", message, {
      error: { name: error instanceof Error ? error.name : "Error", message, code },
      emulator: sync.emulator,
      emulatorReady: sync.emulatorReady,
    });
  }
}

export function throwIfPersistBlocked(diagnosis: PersistDiagnosis): void {
  if (diagnosis.kind === "ok") return;
  throw new PersistBlockedError(diagnosis.kind, diagnosis.detail, {
    operation: diagnosis.operation ?? undefined,
    errorCode: diagnosis.errorCode,
  });
}
