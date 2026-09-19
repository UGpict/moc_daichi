import type { Firestore } from "firebase-admin/firestore";
import { getEnv } from "@/config/env";
import { firestoreDb } from "@/server/auth/firebase";
import { PersistBlockedError, classifyPersistFailure, redactPersistText } from "../persistErrors";
import { diagnosePersistSync, throwIfPersistBlocked, type PersistDiagnosis } from "../persistDiagnose";
import type { Db } from "../store";
import { scopeIsEmpty, type StoreScope } from "../storeScope";
import { commitScoped, loadScoped } from "./scoped";

export type PersistInspect = Pick<PersistDiagnosis, "backend" | "kind" | "detail">;

export function inspectAdc(): { kind: "ok" | "CREDENTIALS"; detail: string } {
  const d = diagnosePersistSync();
  if (d.kind === "ok" || d.emulator) return { kind: "ok", detail: d.detail };
  if (d.kind === "CREDENTIALS") return { kind: "CREDENTIALS", detail: d.detail };
  return { kind: "CREDENTIALS", detail: d.detail };
}

export function inspectPersist(): PersistInspect {
  const d = diagnosePersistSync();
  return { backend: d.backend, kind: d.kind, detail: d.detail };
}

function requireFirestore() {
  const env = getEnv();
  if (env.persistBackend === "json") {
    throw new PersistBlockedError("UNIMPLEMENTED", "json バックエンドで Firestore repo は呼ばない", {
      operation: "requireFirestore",
    });
  }
  throwIfPersistBlocked(diagnosePersistSync());
  const db = firestoreDb();
  if (!db) {
    throw new PersistBlockedError("CREDENTIALS", "Firebase Admin Firestore が無い。LIVE は JSON へ落とさない", {
      operation: "firestoreDb()",
    });
  }
  return db;
}

async function runScoped<T>(
  fs: Firestore,
  scope: StoreScope,
  fn: (db: Db) => T | Promise<T>,
  write: boolean,
  transactional: boolean,
): Promise<T> {
  if (scopeIsEmpty(scope)) {
    throw new PersistBlockedError("UNIMPLEMENTED", "Firestore は対象スコープ必須。全件読み/全件書き戻しはしない", {
      operation: "firestoreScoped",
    });
  }
  try {
    if (transactional && write) {
      return await fs.runTransaction(async (tx) => {
        const loaded = await loadScoped(fs, scope, tx);
        const result = await fn(loaded.db);
        await commitScoped(fs, loaded.db, loaded.loadedKeys, loaded.before, tx);
        return result;
      });
    }
    const loaded = await loadScoped(fs, scope);
    const result = await fn(loaded.db);
    if (write) await commitScoped(fs, loaded.db, loaded.loadedKeys, loaded.before);
    return result;
  } catch (e) {
    if (e instanceof PersistBlockedError) throw e;
    const msg = e instanceof Error ? e.message : "firestore scoped failed";
    const kind = classifyPersistFailure({ message: msg, operation: "firestoreScoped" });
    throw new PersistBlockedError(kind, `Firestore 対象更新失敗: ${redactPersistText(msg)}。LIVE は JSON へ落とさない`, {
      operation: transactional ? "runTransaction" : "firestoreScoped",
    });
  }
}

export async function firestoreWithStore<T>(fn: (db: Db) => T | Promise<T>, scope: StoreScope): Promise<T> {
  return runScoped(requireFirestore(), scope, fn, true, false);
}

export async function firestoreReadStore<T>(fn: (db: Db) => T | Promise<T>, scope: StoreScope): Promise<T> {
  return runScoped(requireFirestore(), scope, fn, false, false);
}

export async function firestoreWithTx<T>(fn: (db: Db) => T | Promise<T>, scope: StoreScope): Promise<T> {
  return runScoped(requireFirestore(), scope, fn, true, true);
}
