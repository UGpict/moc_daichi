import { existsSync, readFileSync } from "node:fs";
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { getEnv } from "@/config/env";
import { firestoreDb } from "@/server/auth/firebase";
import { PersistBlockedError, type PersistBlockKind } from "../persistErrors";
import { emptyDb, type Db } from "../store";

export type PersistInspect = {
  backend: "json" | "firestore";
  kind: "ok" | PersistBlockKind;
  detail: string;
};

const META_LOCK = "_meta/lock";

export function inspectAdc(): { kind: "ok" | "CREDENTIALS"; detail: string } {
  const env = getEnv();
  if (env.firestoreEmulatorHost) return { kind: "ok", detail: "FIRESTORE_EMULATOR_HOST" };
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? null;
  if (!path) return { kind: "CREDENTIALS", detail: "GOOGLE_APPLICATION_CREDENTIALS が無い" };
  if (!existsSync(path)) return { kind: "CREDENTIALS", detail: "ADC ファイルが存在しない" };
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as { type?: string; private_key?: string };
    if (parsed.type !== "service_account") {
      return { kind: "CREDENTIALS", detail: "ADC の type が service_account ではない" };
    }
    if (typeof parsed.private_key !== "string" || !parsed.private_key.includes("BEGIN PRIVATE KEY")) {
      return { kind: "CREDENTIALS", detail: "ADC に有効な private_key が無い" };
    }
    if (/PLACEHOLDER|changeme|FIXME|YOUR_/i.test(raw)) {
      return { kind: "CREDENTIALS", detail: "ADC がプレースホルダ" };
    }
    return { kind: "ok", detail: "service_account" };
  } catch {
    return { kind: "CREDENTIALS", detail: "ADC をJSONとして読めない" };
  }
}

export function inspectPersist(): PersistInspect {
  const env = getEnv();
  if (env.persistBackend === "json") {
    return { backend: "json", kind: "ok", detail: "DEV はローカル JSON" };
  }
  const adc = inspectAdc();
  if (adc.kind === "CREDENTIALS") {
    return { backend: "firestore", kind: "CREDENTIALS", detail: adc.detail };
  }
  try {
    const db = firestoreDb();
    if (!db) {
      return { backend: "firestore", kind: "CREDENTIALS", detail: "Firebase Admin を初期化できない（認証情報不足）" };
    }
  } catch (e) {
    return {
      backend: "firestore",
      kind: "CONNECT",
      detail: e instanceof Error ? e.message : "Firestore 初期化に失敗",
    };
  }
  return { backend: "firestore", kind: "ok", detail: "Admin Firestore" };
}

function requireFirestore() {
  const env = getEnv();
  if (env.persistBackend === "json") {
    throw new PersistBlockedError("UNIMPLEMENTED", "json バックエンドで Firestore repo は呼ばない");
  }
  const inspected = inspectPersist();
  if (inspected.kind === "CREDENTIALS") {
    throw new PersistBlockedError("CREDENTIALS", `Firestore 認証情報不足: ${inspected.detail}。LIVE は JSON へ落とさない`);
  }
  if (inspected.kind === "UNIMPLEMENTED") {
    throw new PersistBlockedError("UNIMPLEMENTED", inspected.detail);
  }
  if (inspected.kind === "CONNECT") {
    throw new PersistBlockedError("CONNECT", inspected.detail);
  }
  const db = firestoreDb();
  if (!db) {
    throw new PersistBlockedError("CREDENTIALS", "Firebase Admin Firestore が無い。LIVE は JSON へ落とさない");
  }
  return db;
}

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function docId(raw: string): string {
  return raw.replace(/\//g, "_").slice(0, 1400);
}

type FireDoc = { id: string; data: Record<string, unknown> };

function flattenDb(db: Db): Record<string, FireDoc[]> {
  const couples: FireDoc[] = [];
  const sessions: FireDoc[] = [];
  const planVersions: FireDoc[] = [];
  const runs: FireDoc[] = [];
  const events: FireDoc[] = [];
  const approvals: FireDoc[] = [];
  const memories: FireDoc[] = [];
  const memoryCandidates: FireDoc[] = [];
  const reflections: FireDoc[] = [];
  const drafts: FireDoc[] = [];
  const spots: FireDoc[] = [];
  const evidence: FireDoc[] = [];
  const scenarios: FireDoc[] = [];
  const replays: FireDoc[] = [];

  for (const couple of Object.values(db.couples)) {
    const ownerUid = couple.couple.ownerUid;
    couples.push({ id: couple.couple.id, data: { ...couple.couple, ownerUid } });
    for (const mem of Object.values(couple.memories)) {
      memories.push({ id: mem.id, data: { ...mem, ownerUid } });
    }
    for (const cand of Object.values(couple.memoryCandidates)) {
      memoryCandidates.push({ id: cand.id, data: { ...cand, ownerUid } });
    }
    for (const ref of Object.values(couple.reflections)) {
      reflections.push({ id: ref.id, data: { ...ref, ownerUid } });
    }
    for (const ap of Object.values(couple.approvals)) {
      approvals.push({ id: ap.id, data: { ...ap, ownerUid } });
    }
    for (const replay of Object.values(couple.replays)) {
      replays.push({ id: replay.id, data: { ...replay, ownerUid } });
    }
    for (const bundle of Object.values(couple.sessions)) {
      sessions.push({ id: bundle.session.id, data: { ...bundle.session, ownerUid } });
      for (const plan of Object.values(bundle.planHistory)) {
        planVersions.push({
          id: `${bundle.session.id}:${plan.version}`,
          data: { plan, sessionId: bundle.session.id, coupleId: couple.couple.id, ownerUid },
        });
      }
      for (const run of Object.values(bundle.runs)) {
        runs.push({ id: run.id, data: { ...run, ownerUid } });
      }
      for (const ev of Object.values(bundle.events)) {
        events.push({
          id: ev.eventId,
          data: { ...ev, sessionId: bundle.session.id, coupleId: couple.couple.id, ownerUid },
        });
      }
      for (const sc of Object.values(bundle.scenarios)) {
        scenarios.push({ id: sc.id, data: { ...sc, ownerUid } });
      }
      for (const spot of Object.values(bundle.spots)) {
        spots.push({
          id: `${bundle.session.id}:${spot.id}`,
          data: { spot, sessionId: bundle.session.id, coupleId: couple.couple.id, ownerUid },
        });
      }
      for (const evd of Object.values(bundle.evidence)) {
        evidence.push({
          id: evd.id,
          data: { ...evd, sessionId: bundle.session.id, coupleId: couple.couple.id, ownerUid },
        });
      }
    }
  }

  return {
    couples,
    sessions,
    planVersions,
    runs,
    events,
    approvals,
    memories,
    memoryCandidates,
    reflections,
    drafts: Object.values(db.drafts).map((d) => ({ id: d.id, data: { ...d, ownerUid: d.ownerUid } })),
    spots,
    evidence,
    scenarios,
    replays,
    idempotency: Object.values(db.idempotency).map((r) => ({ id: docId(r.key), data: { ...r } })),
    tokens: Object.entries(db.tokens).map(([key, v]) => ({ id: docId(key), data: { token: key, ...v } })),
    digests: Object.entries(db.digests).map(([id, d]) => ({ id: docId(id), data: { ...d } })),
  };
}

async function loadDb(fs: Firestore): Promise<Db> {
  const db = emptyDb();
  try {
    const names = [
      "couples",
      "memories",
      "memoryCandidates",
      "reflections",
      "approvals",
      "sessions",
      "planVersions",
      "runs",
      "events",
      "scenarios",
      "spots",
      "evidence",
      "replays",
      "drafts",
      "idempotency",
      "tokens",
      "digests",
    ];
    const snaps = await Promise.all(names.map((n) => fs.collection(n).get()));
    const byName = Object.fromEntries(names.map((n, i) => [n, snaps[i]!]));

    for (const doc of byName.couples!.docs) {
      const data = doc.data() as Db["couples"][string]["couple"];
      db.couples[doc.id] = {
        couple: { id: data.id ?? doc.id, ownerUid: data.ownerUid, isDemo: data.isDemo, createdAt: data.createdAt },
        memories: {},
        memoryCandidates: {},
        reflections: {},
        approvals: {},
        sessions: {},
        replays: {},
      };
    }
    const ensureCouple = (coupleId: string) => {
      if (!db.couples[coupleId]) {
        db.couples[coupleId] = {
          couple: { id: coupleId, ownerUid: "unknown", isDemo: false, createdAt: new Date().toISOString() },
          memories: {},
          memoryCandidates: {},
          reflections: {},
          approvals: {},
          sessions: {},
          replays: {},
        };
      }
      return db.couples[coupleId]!;
    };

    for (const doc of byName.memories!.docs) {
      const m = doc.data() as Db["couples"][string]["memories"][string];
      ensureCouple(m.coupleId).memories[m.id] = m;
    }
    for (const doc of byName.memoryCandidates!.docs) {
      const m = doc.data() as Db["couples"][string]["memoryCandidates"][string];
      ensureCouple(m.coupleId).memoryCandidates[m.id] = m;
    }
    for (const doc of byName.reflections!.docs) {
      const m = doc.data() as Db["couples"][string]["reflections"][string];
      ensureCouple(m.coupleId).reflections[m.id] = m;
    }
    for (const doc of byName.approvals!.docs) {
      const m = doc.data() as Db["couples"][string]["approvals"][string];
      ensureCouple(m.coupleId).approvals[m.id] = m;
    }
    for (const doc of byName.sessions!.docs) {
      const session = doc.data() as Db["couples"][string]["sessions"][string]["session"];
      const couple = ensureCouple(session.coupleId);
      couple.sessions[session.id] = {
        session,
        planHistory: {},
        runs: {},
        events: {},
        scenarios: {},
        spots: {},
        evidence: {},
      };
    }
    for (const doc of byName.planVersions!.docs) {
      const data = doc.data() as { plan: Db["couples"][string]["sessions"][string]["planHistory"][string]; sessionId: string };
      const bundle = Object.values(db.couples)
        .flatMap((c) => Object.values(c.sessions))
        .find((b) => b.session.id === data.sessionId);
      if (bundle && data.plan) bundle.planHistory[String(data.plan.version)] = data.plan;
    }
    for (const doc of byName.runs!.docs) {
      const run = doc.data() as Db["couples"][string]["sessions"][string]["runs"][string];
      const couple = db.couples[run.coupleId];
      const bundle = couple?.sessions[run.sessionId];
      if (bundle) bundle.runs[run.id] = run;
    }
    for (const doc of byName.events!.docs) {
      const ev = doc.data() as Db["couples"][string]["sessions"][string]["events"][string] & { sessionId?: string };
      const bundle = Object.values(db.couples)
        .flatMap((c) => Object.values(c.sessions))
        .find((b) => b.session.id === ev.sessionId || Object.values(b.runs).some((r) => r.id === ev.runId));
      if (bundle) bundle.events[ev.eventId] = ev;
    }
    for (const doc of byName.scenarios!.docs) {
      const sc = doc.data() as Db["couples"][string]["sessions"][string]["scenarios"][string];
      const bundle = Object.values(db.couples)
        .flatMap((c) => Object.values(c.sessions))
        .find((b) => b.session.id === sc.sessionId);
      if (bundle) bundle.scenarios[sc.id] = sc;
    }
    for (const doc of byName.spots!.docs) {
      const data = doc.data() as { spot: Db["couples"][string]["sessions"][string]["spots"][string]; sessionId: string };
      const bundle = Object.values(db.couples)
        .flatMap((c) => Object.values(c.sessions))
        .find((b) => b.session.id === data.sessionId);
      if (bundle && data.spot) bundle.spots[data.spot.id] = data.spot;
    }
    for (const doc of byName.evidence!.docs) {
      const evd = doc.data() as Db["couples"][string]["sessions"][string]["evidence"][string] & { sessionId?: string };
      const bundle = Object.values(db.couples)
        .flatMap((c) => Object.values(c.sessions))
        .find((b) => b.session.id === evd.sessionId);
      if (bundle) bundle.evidence[evd.id] = evd;
    }
    for (const doc of byName.replays!.docs) {
      const r = doc.data() as Db["couples"][string]["replays"][string];
      const couple = db.couples[r.coupleId];
      if (couple) couple.replays[r.id] = r;
    }
    for (const doc of byName.drafts!.docs) {
      const d = doc.data() as Db["drafts"][string];
      db.drafts[d.id] = d;
    }
    for (const doc of byName.idempotency!.docs) {
      const r = doc.data() as Db["idempotency"][string];
      db.idempotency[r.key] = r;
    }
    for (const doc of byName.tokens!.docs) {
      const t = doc.data() as { token?: string; uid: string; createdAt: string };
      if (t.token) db.tokens[t.token] = { uid: t.uid, createdAt: t.createdAt };
    }
    for (const doc of byName.digests!.docs) {
      const d = doc.data() as Db["digests"][string];
      const id = (d as { id?: string }).id ?? doc.id;
      db.digests[id] = d;
    }
    return db;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "load failed";
    if (/UNAUTHENTICATED|invalid_grant|Could not load the default credentials|credential/i.test(msg)) {
      throw new PersistBlockedError("CREDENTIALS", `Firestore 認証失敗: ${msg}。LIVE は JSON へ落とさない`);
    }
    throw new PersistBlockedError("CONNECT", `Firestore 読み込み失敗: ${msg}`);
  }
}

async function commitDb(fs: Firestore, db: Db): Promise<void> {
  const flat = flattenDb(db);
  try {
    const names = Object.keys(flat);
    const existing = await Promise.all(names.map((n) => fs.collection(n).listDocuments()));
    const keep = new Map<string, Set<string>>();
    for (const [name, docs] of Object.entries(flat)) {
      keep.set(name, new Set(docs.map((d) => d.id)));
    }
    const writes: Array<{ ref: DocumentReference; data?: Record<string, unknown>; del?: boolean }> = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i]!;
      const ids = keep.get(name) ?? new Set();
      for (const ref of existing[i] ?? []) {
        if (!ids.has(ref.id)) writes.push({ ref, del: true });
      }
      for (const doc of flat[name] ?? []) {
        writes.push({ ref: fs.collection(name).doc(doc.id), data: stripUndefined(doc.data) });
      }
    }
    for (let i = 0; i < writes.length; i += 400) {
      const batch = fs.batch();
      for (const w of writes.slice(i, i + 400)) {
        if (w.del) batch.delete(w.ref);
        else batch.set(w.ref, w.data ?? {});
      }
      await batch.commit();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "write failed";
    if (/UNAUTHENTICATED|invalid_grant|Could not load the default credentials|credential/i.test(msg)) {
      throw new PersistBlockedError("CREDENTIALS", `Firestore 書き込み認証失敗: ${msg}。LIVE は JSON へ落とさない`);
    }
    throw new PersistBlockedError("CONNECT", `Firestore 書き込み失敗: ${msg}`);
  }
}

async function acquireRemoteLock(fs: Firestore): Promise<void> {
  const ref = fs.doc(META_LOCK);
  for (let i = 0; i < 40; i++) {
    const now = Date.now();
    const ok = await fs.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const until = Number(snap.data()?.untilMs ?? 0);
      if (until > now) return false;
      tx.set(ref, { untilMs: now + 20_000, owner: String(process.pid), at: new Date().toISOString() });
      return true;
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 50 + i * 10));
  }
  throw new PersistBlockedError("CONNECT", "Firestore ロックを取得できない");
}

async function releaseRemoteLock(fs: Firestore): Promise<void> {
  try {
    await fs.doc(META_LOCK).delete();
  } catch {
    /* ignore */
  }
}

export async function firestoreWithStore<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const fs = requireFirestore();
  await acquireRemoteLock(fs);
  try {
    const db = await loadDb(fs);
    const result = await fn(db);
    await commitDb(fs, db);
    return result;
  } finally {
    await releaseRemoteLock(fs);
  }
}

export async function firestoreReadStore<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const fs = requireFirestore();
  const db = await loadDb(fs);
  return fn(db);
}
