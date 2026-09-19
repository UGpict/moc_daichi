import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { diagnosePersist, diagnosePersistSync } from "../src/server/repositories/persistDiagnose";
import { redactPersistText } from "../src/server/repositories/persistErrors";

async function probeReadWrite(): Promise<{
  attempted: boolean;
  kind: string;
  wrote: boolean;
  readBack: boolean;
  deleted: boolean;
  operation: string | null;
  detail: string;
}> {
  const full = await diagnosePersist();
  if (full.kind !== "ok") {
    return {
      attempted: false,
      kind: full.kind,
      wrote: false,
      readBack: false,
      deleted: false,
      operation: full.operation,
      detail: full.detail,
    };
  }
  try {
    const { firestoreDb } = await import("../src/server/auth/firebase");
    const db = firestoreDb();
    if (!db) {
      return {
        attempted: true,
        kind: "CREDENTIALS",
        wrote: false,
        readBack: false,
        deleted: false,
        operation: "firestoreDb()",
        detail: "Admin Firestore が無い",
      };
    }
    const id = `probe_${Date.now()}`;
    await db.collection("couples").doc(id).set({
      id,
      ownerUid: "persist-probe",
      isDemo: true,
      createdAt: new Date().toISOString(),
    });
    const read = await db.collection("couples").doc(id).get();
    await db.collection("couples").doc(id).delete();
    return {
      attempted: true,
      kind: "ok",
      wrote: true,
      readBack: read.exists,
      deleted: true,
      operation: "couples.doc(probe_*).set/get/delete",
      detail: "probe ドキュメントの書き込み・読み戻し・削除が成功",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      attempted: true,
      kind: "error",
      wrote: false,
      readBack: false,
      deleted: false,
      operation: "couples.doc(probe_*).set/get/delete",
      detail: redactPersistText(message),
    };
  }
}

async function main() {
  const sync = diagnosePersistSync();
  const full = await diagnosePersist();
  const probe = await probeReadWrite();
  const out = {
    at: new Date().toISOString(),
    sync,
    probe: full,
    readWrite: probe,
  };
  mkdirSync("docs/reports", { recursive: true });
  const file = join("docs/reports", "persist-diagnosis.json");
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

void main();
