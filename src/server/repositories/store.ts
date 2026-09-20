import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, unlinkSync, openSync, closeSync } from "node:fs";
import { dirname, join } from "node:path";
import type { StoreScope } from "./storeScope";
import type {
  Approval,
  AppEvent,
  Couple,
  DailyDigest,
  Evidence,
  Memory,
  MemoryCandidate,
  Plan,
  ReplayManifest,
  Reflection,
  Run,
  ScenarioOverlay,
  SelectionDraft,
  Session,
  Spot,
} from "@/domain/schemas";

export type CoupleBundle = {
  couple: Couple;
  memories: Record<string, Memory>;
  memoryCandidates: Record<string, MemoryCandidate>;
  reflections: Record<string, Reflection>;
  approvals: Record<string, Approval>;
  sessions: Record<string, SessionBundle>;
  replays: Record<string, ReplayManifest>;
};

export type SessionBundle = {
  session: Session;
  planHistory: Record<string, Plan>;
  runs: Record<string, Run>;
  events: Record<string, AppEvent>;
  scenarios: Record<string, ScenarioOverlay>;
  spots: Record<string, Spot>;
  evidence: Record<string, Evidence>;
};

export type IdempotencyRecord = {
  key: string;
  uid: string;
  target: string;
  op: string;
  bodyHash: string;
  status: number;
  response: unknown;
};

export type Db = {
  couples: Record<string, CoupleBundle>;
  idempotency: Record<string, IdempotencyRecord>;
  tokens: Record<string, { uid: string; createdAt: string }>;
  digests: Record<string, DailyDigest>;
  drafts: Record<string, SelectionDraft>;
};

function isReadonlyFs(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
  return code === "EROFS" || code === "EACCES" || code === "EPERM";
}

/** Vercel のデプロイ FS は読めても書けない。見た目デモは /tmp とプロセスメモリに置く。 */
export function jsonStoreRoot(): string {
  const override = process.env.FUTARI_STORE_DIR?.trim();
  if (override) return override;
  if (process.env.VERCEL || process.env.NOW_REGION) return join("/tmp", "futari-log");
  return join(process.cwd(), ".data");
}

export function jsonStoreFile(): string {
  return join(jsonStoreRoot(), "store.json");
}

function storePath() {
  return jsonStoreFile();
}

function lockPath() {
  return join(jsonStoreRoot(), "store.lock");
}

type JsonMemory = { __futariJsonDb?: Db };
function memorySlot(): JsonMemory {
  return globalThis as JsonMemory;
}

export function emptyDb(): Db {
  return { couples: {}, idempotency: {}, tokens: {}, digests: {}, drafts: {} };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function acquireLock(): Promise<number> {
  mkdirSync(dirname(storePath()), { recursive: true });
  const lock = lockPath();
  for (let i = 0; i < 80; i++) {
    try {
      return openSync(lock, "wx");
    } catch {
      await sleep(25);
    }
  }
  try {
    unlinkSync(lock);
  } catch {
    /* ignore */
  }
  return openSync(lock, "wx");
}

function releaseLock(fd: number) {
  try {
    closeSync(fd);
  } catch {
    /* ignore */
  }
  try {
    unlinkSync(lockPath());
  } catch {
    /* ignore */
  }
}

function hydrate(db: Db): Db {
  db.digests ??= {};
  db.drafts ??= {};
  return db;
}

function readDb(): Db {
  const mem = memorySlot().__futariJsonDb;
  if (mem) return mem;
  const path = storePath();
  if (!existsSync(path)) return emptyDb();
  try {
    return hydrate(JSON.parse(readFileSync(path, "utf8")) as Db);
  } catch {
    return emptyDb();
  }
}

function writeDb(db: Db) {
  memorySlot().__futariJsonDb = db;
  const path = storePath();
  try {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(db));
    renameSync(tmp, path);
  } catch (error) {
    if (!isReadonlyFs(error)) throw error;
  }
}

async function jsonWithStore<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  try {
    const fd = await acquireLock();
    try {
      const db = readDb();
      const result = await fn(db);
      writeDb(db);
      return result;
    } finally {
      releaseLock(fd);
    }
  } catch (error) {
    if (!isReadonlyFs(error)) throw error;
    const db = readDb();
    const result = await fn(db);
    memorySlot().__futariJsonDb = db;
    return result;
  }
}

async function jsonReadStore<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  try {
    const fd = await acquireLock();
    try {
      return await fn(readDb());
    } finally {
      releaseLock(fd);
    }
  } catch (error) {
    if (!isReadonlyFs(error)) throw error;
    return fn(readDb());
  }
}

export async function withStore<T>(fn: (db: Db) => T | Promise<T>, scope: StoreScope = {}): Promise<T> {
  const { getEnv } = await import("@/config/env");
  const env = getEnv();
  if (env.persistBackend === "json") return jsonWithStore(fn);
  const { firestoreWithStore } = await import("./firestore/repo");
  return firestoreWithStore(fn, scope);
}

export async function readStore<T>(fn: (db: Db) => T | Promise<T>, scope: StoreScope = {}): Promise<T> {
  const { getEnv } = await import("@/config/env");
  const env = getEnv();
  if (env.persistBackend === "json") return jsonReadStore(fn);
  const { firestoreReadStore } = await import("./firestore/repo");
  return firestoreReadStore(fn, scope);
}

export async function withStoreTx<T>(fn: (db: Db) => T | Promise<T>, scope: StoreScope): Promise<T> {
  const { getEnv } = await import("@/config/env");
  const env = getEnv();
  if (env.persistBackend === "json") return jsonWithStore(fn);
  const { firestoreWithTx } = await import("./firestore/repo");
  return firestoreWithTx(fn, scope);
}

export function withRun<T>(runId: string, fn: (db: Db) => T | Promise<T>): Promise<T> {
  return withStore(fn, { runId });
}

export function withSession<T>(sessionId: string, fn: (db: Db) => T | Promise<T>): Promise<T> {
  return withStore(fn, { sessionId });
}

export function withCouple<T>(coupleId: string, fn: (db: Db) => T | Promise<T>): Promise<T> {
  return withStore(fn, { coupleId });
}

export type { StoreScope } from "./storeScope";

export function findSession(
  db: Db,
  sessionId: string,
): { couple: CoupleBundle; bundle: SessionBundle } | null {
  for (const couple of Object.values(db.couples)) {
    const bundle = couple.sessions[sessionId];
    if (bundle) return { couple, bundle };
  }
  return null;
}

export function findRun(
  db: Db,
  runId: string,
): { couple: CoupleBundle; bundle: SessionBundle; run: Run } | null {
  for (const couple of Object.values(db.couples)) {
    for (const bundle of Object.values(couple.sessions)) {
      const run = bundle.runs[runId];
      if (run) return { couple, bundle, run };
    }
  }
  return null;
}

export function findApproval(
  db: Db,
  approvalId: string,
): { couple: CoupleBundle; approval: Approval } | null {
  for (const couple of Object.values(db.couples)) {
    const approval = couple.approvals[approvalId];
    if (approval) return { couple, approval };
  }
  return null;
}

export function findMemory(
  db: Db,
  memoryId: string,
): { couple: CoupleBundle; memory: Memory } | null {
  for (const couple of Object.values(db.couples)) {
    const memory = couple.memories[memoryId];
    if (memory) return { couple, memory };
  }
  return null;
}
