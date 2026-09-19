import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname } from "node:path";
import { getEnv } from "@/config/env";
import { lastFirebaseAdminInitError } from "@/server/auth/firebase";
import {
  PersistBlockedError,
  classifyPersistFailure,
  redactPersistText,
  type PersistBlockKind,
} from "./persistErrors";

export type PersistDiagnosis = {
  backend: "json" | "firestore";
  kind: "ok" | PersistBlockKind;
  detail: string;
  operation: string | null;
  errorName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  currentWriteTarget: "json:.data/store.json" | "firestore:collections" | "none";
  leftoverStoreJson: { exists: boolean; bytes: number | null };
  implemented: {
    jsonStore: true;
    firestoreRepo: true;
    switchByPersistBackend: true;
  };
  adc: {
    envSet: boolean;
    fileExists: boolean;
    pathIsPlaceholder: boolean;
    basename: string | null;
    parentDirExists: boolean;
  };
  projectIdSet: boolean;
  emulator: boolean;
};

function adcPath(): string | null {
  const value = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!value || !value.trim()) return null;
  return value.trim();
}

function isPlaceholderPath(path: string): boolean {
  return path === "/path/to/service-account.json" || path === "path/to/service-account.json" || /\/path\/to\//.test(path);
}

function leftoverStore() {
  try {
    if (!existsSync(".data/store.json")) return { exists: false, bytes: null as number | null };
    return { exists: true, bytes: statSync(".data/store.json").size };
  } catch {
    return { exists: false, bytes: null as number | null };
  }
}

function fail(
  kind: PersistBlockKind,
  operation: string,
  detail: string,
  error?: { name?: string; message?: string; code?: string | number | null },
): PersistDiagnosis {
  const env = getEnv();
  const path = adcPath();
  return {
    backend: env.persistBackend,
    kind,
    detail: redactPersistText(detail),
    operation,
    errorName: error?.name ?? "PersistBlockedError",
    errorCode: error?.code != null ? String(error.code) : null,
    errorMessage: error?.message ? redactPersistText(error.message) : null,
    currentWriteTarget: env.persistBackend === "json" ? "json:.data/store.json" : "none",
    leftoverStoreJson: leftoverStore(),
    implemented: { jsonStore: true, firestoreRepo: true, switchByPersistBackend: true },
    adc: {
      envSet: Boolean(path),
      fileExists: Boolean(path && existsSync(path)),
      pathIsPlaceholder: Boolean(path && isPlaceholderPath(path)),
      basename: path ? basename(path) : null,
      parentDirExists: Boolean(path && existsSync(dirname(path))),
    },
    projectIdSet: Boolean(env.firebaseProjectId),
    emulator: Boolean(env.firestoreEmulatorHost),
  };
}

function ok(detail: string, write: PersistDiagnosis["currentWriteTarget"]): PersistDiagnosis {
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
    implemented: { jsonStore: true, firestoreRepo: true, switchByPersistBackend: true },
    adc: {
      envSet: Boolean(path),
      fileExists: Boolean(path && existsSync(path)),
      pathIsPlaceholder: Boolean(path && isPlaceholderPath(path)),
      basename: path ? basename(path) : null,
      parentDirExists: Boolean(path && existsSync(dirname(path))),
    },
    projectIdSet: Boolean(env.firebaseProjectId),
    emulator: Boolean(env.firestoreEmulatorHost),
  };
}

/** ファイルと環境だけ。Firestore RPC は打たない。 */
export function diagnosePersistSync(): PersistDiagnosis {
  const env = getEnv();
  if (env.persistBackend === "json") {
    return ok("DEV はローカル JSON（.data/store.json）", "json:.data/store.json");
  }
  if (env.firestoreEmulatorHost) {
    return ok("FIRESTORE_EMULATOR_HOST あり。実 ADC は不要", "firestore:collections");
  }
  const path = adcPath();
  if (!path) {
    return fail("CREDENTIALS", "read process.env.GOOGLE_APPLICATION_CREDENTIALS", "環境変数 GOOGLE_APPLICATION_CREDENTIALS が空。認証情報の取得失敗。");
  }
  if (isPlaceholderPath(path)) {
    return fail(
      "CREDENTIALS",
      "open GOOGLE_APPLICATION_CREDENTIALS",
      "GOOGLE_APPLICATION_CREDENTIALS がプレースホルダ /path/to/service-account.json。実ファイルが無い。認証情報の取得失敗。",
      { name: "Error", message: "ENOENT: placeholder path, no such file", code: "ENOENT" },
    );
  }
  if (!existsSync(path)) {
    return fail(
      "CREDENTIALS",
      "fs.existsSync(GOOGLE_APPLICATION_CREDENTIALS)",
      `ADC ファイルが存在しない（basename=${basename(path)}）。認証情報の取得失敗。`,
      { name: "Error", message: "ENOENT: no such file", code: "ENOENT" },
    );
  }
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as { type?: string; private_key?: string };
    if (parsed.type !== "service_account") {
      return fail("CREDENTIALS", "JSON.parse(ADC)", "ADC の type が service_account ではない。認証情報の取得失敗。");
    }
    if (typeof parsed.private_key !== "string" || !parsed.private_key.includes("BEGIN PRIVATE KEY")) {
      return fail("CREDENTIALS", "JSON.parse(ADC).private_key", "ADC に PEM 形式の private_key が無い。認証情報の取得失敗。");
    }
    if (/PLACEHOLDER|changeme|FIXME|YOUR_/i.test(raw)) {
      return fail("CREDENTIALS", "JSON.parse(ADC)", "ADC JSON がプレースホルダ。認証情報の取得失敗。");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "ADC を読めない";
    return fail("CREDENTIALS", "readFileSync(ADC)+JSON.parse", `ADC をJSONとして読めない。認証情報の取得失敗。`, {
      name: error instanceof Error ? error.name : "Error",
      message: redactPersistText(message),
    });
  }
  if (!env.firebaseProjectId) {
    return fail("NOT_CONFIGURED", "getEnv().firebaseProjectId", "FIREBASE_PROJECT_ID が無い。Firestore 未設定。");
  }
  const init = lastFirebaseAdminInitError();
  if (init) {
    const kind = classifyPersistFailure({ message: init.message, code: init.code, operation: init.operation });
    return fail(kind, init.operation, init.message, init);
  }
  return ok("ADC ファイルは読める。Firestore RPC は diagnosePersist() で確認", "firestore:collections");
}

/** 認証情報があるときだけ couples 1件読みで権限/未設定を切る。 */
export async function diagnosePersist(): Promise<PersistDiagnosis> {
  const sync = diagnosePersistSync();
  if (sync.kind !== "ok" || sync.backend === "json") return sync;
  try {
    const { firestoreDb } = await import("@/server/auth/firebase");
    const db = firestoreDb();
    if (!db) {
      const init = lastFirebaseAdminInitError();
      if (init) {
        const kind = classifyPersistFailure({ message: init.message, code: init.code, operation: init.operation });
        return fail(kind, init.operation, init.message, init);
      }
      return fail("CREDENTIALS", "firebase-admin initializeApp / getFirestore", "Firebase Admin を初期化できない。認証情報の取得失敗。");
    }
    await db.collection("couples").limit(1).get();
    return ok("Admin Firestore で couples.limit(1) が成功", "firestore:collections");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : null;
    const kind = classifyPersistFailure({ message, code, operation: "firestore.collection('couples').limit(1).get" });
    return fail(kind, "firestore.collection('couples').limit(1).get", message, {
      name: error instanceof Error ? error.name : "Error",
      message,
      code,
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
