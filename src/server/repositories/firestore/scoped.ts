import type { DocumentReference, Firestore, Query, Transaction } from "firebase-admin/firestore";
import type { Couple, Session } from "@/domain/schemas";
import { emptyDb, type Db, type SessionBundle } from "../store";
import type { StoreScope } from "../storeScope";

export type FireDoc = { collection: string; id: string; data: Record<string, unknown> };

export function docId(raw: string): string {
  return raw.replace(/\//g, "_").slice(0, 1400);
}

export function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function flattenDb(db: Db): FireDoc[] {
  const out: FireDoc[] = [];
  for (const couple of Object.values(db.couples)) {
    const ownerUid = couple.couple.ownerUid;
    out.push({ collection: "couples", id: couple.couple.id, data: { ...couple.couple, ownerUid } });
    for (const mem of Object.values(couple.memories)) {
      out.push({ collection: "memories", id: mem.id, data: { ...mem, ownerUid } });
    }
    for (const cand of Object.values(couple.memoryCandidates)) {
      out.push({ collection: "memoryCandidates", id: cand.id, data: { ...cand, ownerUid } });
    }
    for (const ref of Object.values(couple.reflections)) {
      out.push({ collection: "reflections", id: ref.id, data: { ...ref, ownerUid } });
    }
    for (const ap of Object.values(couple.approvals)) {
      out.push({ collection: "approvals", id: ap.id, data: { ...ap, ownerUid } });
    }
    for (const replay of Object.values(couple.replays)) {
      out.push({ collection: "replays", id: replay.id, data: { ...replay, ownerUid } });
    }
    for (const bundle of Object.values(couple.sessions)) {
      out.push({
        collection: "sessions",
        id: bundle.session.id,
        data: { ...bundle.session, ownerUid },
      });
      for (const plan of Object.values(bundle.planHistory)) {
        out.push({
          collection: "planVersions",
          id: `${bundle.session.id}:${plan.version}`,
          data: { plan, sessionId: bundle.session.id, coupleId: couple.couple.id, ownerUid },
        });
      }
      for (const run of Object.values(bundle.runs)) {
        out.push({ collection: "runs", id: run.id, data: { ...run, ownerUid } });
      }
      for (const ev of Object.values(bundle.events)) {
        out.push({
          collection: "events",
          id: ev.eventId,
          data: { ...ev, sessionId: bundle.session.id, coupleId: couple.couple.id, ownerUid },
        });
      }
      for (const sc of Object.values(bundle.scenarios)) {
        out.push({ collection: "scenarios", id: sc.id, data: { ...sc, ownerUid } });
      }
      for (const spot of Object.values(bundle.spots)) {
        out.push({
          collection: "spots",
          id: `${bundle.session.id}:${spot.id}`,
          data: { spot, sessionId: bundle.session.id, coupleId: couple.couple.id, ownerUid },
        });
      }
      for (const evd of Object.values(bundle.evidence)) {
        out.push({
          collection: "evidence",
          id: evd.id,
          data: { ...evd, sessionId: bundle.session.id, coupleId: couple.couple.id, ownerUid },
        });
      }
    }
  }
  for (const d of Object.values(db.drafts)) {
    out.push({ collection: "drafts", id: d.id, data: { ...d, ownerUid: d.ownerUid } });
  }
  for (const r of Object.values(db.idempotency)) {
    out.push({ collection: "idempotency", id: docId(r.key), data: { ...r } });
  }
  for (const [key, v] of Object.entries(db.tokens)) {
    out.push({ collection: "tokens", id: docId(key), data: { token: key, ...v } });
  }
  for (const [id, d] of Object.entries(db.digests)) {
    out.push({ collection: "digests", id: docId(id), data: { ...d } });
  }
  return out;
}

export function stableDocJson(data: Record<string, unknown>): string {
  return JSON.stringify(stripUndefined(data));
}

export function diffDocs(
  before: FireDoc[],
  after: FireDoc[],
  loadedKeys: Set<string>,
): { set: FireDoc[]; del: Array<{ collection: string; id: string }> } {
  const beforeByKey = new Map(before.map((d) => [`${d.collection}/${d.id}`, d]));
  const afterByKey = new Map(after.map((d) => [`${d.collection}/${d.id}`, d]));
  const set: FireDoc[] = [];
  const del: Array<{ collection: string; id: string }> = [];
  for (const [key, doc] of afterByKey) {
    const prev = beforeByKey.get(key);
    if (!prev || stableDocJson(prev.data) !== stableDocJson(doc.data)) set.push(doc);
  }
  for (const key of loadedKeys) {
    if (afterByKey.has(key)) continue;
    const [collection, ...rest] = key.split("/");
    const id = rest.join("/");
    if (collection && id) del.push({ collection, id });
  }
  return { set, del };
}

type Snap = { id: string; data: () => Record<string, unknown>; exists: boolean };

type Reader = {
  getDoc(collection: string, id: string): Promise<Snap | null>;
  query(collection: string, field: string, value: string, extra?: { orderBy?: string; limit?: number }): Promise<Snap[]>;
};

function wrapSnap(id: string, exists: boolean, data: Record<string, unknown> | undefined): Snap {
  return { id, exists, data: () => data ?? {} };
}

export function makeReader(fs: Firestore, tx?: Transaction): Reader {
  return {
    async getDoc(collection, id) {
      const ref = fs.collection(collection).doc(id);
      const snap = tx ? await tx.get(ref) : await ref.get();
      if (!snap.exists) return null;
      return wrapSnap(snap.id, true, snap.data() as Record<string, unknown>);
    },
    async query(collection, field, value, extra) {
      let q: Query = fs.collection(collection).where(field, "==", value);
      if (extra?.orderBy) q = q.orderBy(extra.orderBy);
      if (extra?.limit != null) q = q.limit(extra.limit);
      const snap = tx ? await tx.get(q) : await q.get();
      return snap.docs.map((d) => wrapSnap(d.id, true, d.data() as Record<string, unknown>));
    },
  };
}

function emptyCouple(couple: Couple): Db["couples"][string] {
  return {
    couple,
    memories: {},
    memoryCandidates: {},
    reflections: {},
    approvals: {},
    sessions: {},
    replays: {},
  };
}

function emptySession(session: Session): SessionBundle {
  return { session, planHistory: {}, runs: {}, events: {}, scenarios: {}, spots: {}, evidence: {} };
}

function ensureCouple(db: Db, coupleId: string, couple?: Couple): Db["couples"][string] {
  if (!db.couples[coupleId]) {
    db.couples[coupleId] = emptyCouple(
      couple ?? { id: coupleId, ownerUid: "unknown", isDemo: false, createdAt: new Date().toISOString() },
    );
  } else if (couple) {
    db.couples[coupleId]!.couple = couple;
  }
  return db.couples[coupleId]!;
}

function ensureSession(db: Db, session: Session): SessionBundle {
  const couple = ensureCouple(db, session.coupleId);
  if (!couple.sessions[session.id]) couple.sessions[session.id] = emptySession(session);
  else couple.sessions[session.id]!.session = session;
  return couple.sessions[session.id]!;
}

function findBundle(db: Db, sessionId: string): SessionBundle | null {
  for (const couple of Object.values(db.couples)) {
    if (couple.sessions[sessionId]) return couple.sessions[sessionId]!;
  }
  return null;
}

function ingestCoupleDoc(db: Db, snap: Snap) {
  const data = snap.data() as Couple;
  ensureCouple(db, snap.id, {
    id: data.id ?? snap.id,
    ownerUid: data.ownerUid,
    isDemo: data.isDemo,
    createdAt: data.createdAt,
  });
}

function ingestSessionDoc(db: Db, snap: Snap) {
  const session = snap.data() as Session;
  if (!session.id) session.id = snap.id;
  ensureSession(db, session);
}

export async function loadScoped(
  fs: Firestore,
  scope: StoreScope,
  tx?: Transaction,
): Promise<{ db: Db; loadedKeys: Set<string>; before: FireDoc[] }> {
  const reader = makeReader(fs, tx);
  const db = emptyDb();
  const loadedKeys = new Set<string>();
  const seenSnaps: Array<{ collection: string; snap: Snap }> = [];

  const remember = (collection: string, snap: Snap | null) => {
    if (!snap) return;
    loadedKeys.add(`${collection}/${snap.id}`);
    seenSnaps.push({ collection, snap });
  };

  const get = async (collection: string, id: string) => {
    const snap = await reader.getDoc(collection, id);
    remember(collection, snap);
    return snap;
  };

  const queryEq = async (
    collection: string,
    field: string,
    value: string,
    extra?: { orderBy?: string; limit?: number },
  ) => {
    const snaps = await reader.query(collection, field, value, extra);
    for (const snap of snaps) remember(collection, snap);
    return snaps;
  };

  const coupleIds = new Set<string>();
  const sessionIds = new Set<string>();
  let loadAllSessions = Boolean(scope.coupleId && !scope.sessionId && !scope.runId) || Boolean(scope.demoReset);

  if (scope.runId) {
    const run = await get("runs", scope.runId);
    if (run) {
      const data = run.data() as { sessionId?: string; coupleId?: string };
      if (data.sessionId) sessionIds.add(data.sessionId);
      if (data.coupleId) coupleIds.add(data.coupleId);
    }
  }
  if (scope.sessionId) {
    const session = await get("sessions", scope.sessionId);
    if (session) {
      const data = session.data() as Session;
      sessionIds.add(data.id ?? session.id);
      if (data.coupleId) coupleIds.add(data.coupleId);
    } else {
      sessionIds.add(scope.sessionId);
    }
  }
  if (scope.approvalId) {
    const ap = await get("approvals", scope.approvalId);
    if (ap) {
      const data = ap.data() as { coupleId?: string; sessionId?: string };
      if (data.coupleId) coupleIds.add(data.coupleId);
      if (data.sessionId) sessionIds.add(data.sessionId);
    }
  }
  if (scope.memoryId) {
    const mem = await get("memories", scope.memoryId);
    if (mem) {
      const data = mem.data() as { coupleId?: string };
      if (data.coupleId) coupleIds.add(data.coupleId);
    }
  }
  if (scope.coupleId) coupleIds.add(scope.coupleId);
  if (scope.replayId) {
    const replay = await get("replays", scope.replayId);
    if (replay) {
      const data = replay.data() as { coupleId?: string };
      if (data.coupleId) coupleIds.add(data.coupleId);
    }
  }
  if (scope.ownerUid) {
    const couples = await queryEq("couples", "ownerUid", scope.ownerUid, { limit: 20 });
    for (const snap of couples) coupleIds.add(snap.id);
  }
  if (scope.pendingRun) {
    const pending = await queryEq("runs", "status", "PENDING", { orderBy: "createdAt", limit: 1 });
    const running = await queryEq("runs", "status", "RUNNING", { limit: 50 });
    for (const snap of [...pending, ...running]) {
      const data = snap.data() as { sessionId?: string; coupleId?: string };
      if (data.sessionId) sessionIds.add(data.sessionId);
      if (data.coupleId) coupleIds.add(data.coupleId);
    }
  }
  if (scope.demoReset) loadAllSessions = true;

  if (loadAllSessions) {
    for (const coupleId of coupleIds) {
      const sessions = await queryEq("sessions", "coupleId", coupleId);
      for (const snap of sessions) sessionIds.add(snap.data().id as string ?? snap.id);
    }
  }

  for (const coupleId of coupleIds) {
    if (![...seenSnaps].some((s) => s.collection === "couples" && s.snap.id === coupleId)) {
      await get("couples", coupleId);
    }
    await queryEq("memories", "coupleId", coupleId);
    await queryEq("memoryCandidates", "coupleId", coupleId);
    await queryEq("reflections", "coupleId", coupleId);
    await queryEq("approvals", "coupleId", coupleId);
    await queryEq("replays", "coupleId", coupleId);
    const coupleRuns = await queryEq("runs", "coupleId", coupleId);
    for (const snap of coupleRuns) {
      const data = snap.data() as { sessionId?: string };
      if (data.sessionId && !sessionIds.has(data.sessionId) && !loadAllSessions) {
        /* stub session via run only */
      }
    }
  }

  for (const sessionId of sessionIds) {
    if (![...seenSnaps].some((s) => s.collection === "sessions" && s.snap.id === sessionId)) {
      await get("sessions", sessionId);
    }
    await queryEq("planVersions", "sessionId", sessionId);
    await queryEq("runs", "sessionId", sessionId);
    await queryEq("events", "sessionId", sessionId);
    await queryEq("scenarios", "sessionId", sessionId);
    await queryEq("spots", "sessionId", sessionId);
    await queryEq("evidence", "sessionId", sessionId);
  }

  if (scope.idempotencyKey) await get("idempotency", docId(scope.idempotencyKey));
  if (scope.draftId) await get("drafts", scope.draftId);
  if (scope.draftsForOwner && scope.ownerUid) await queryEq("drafts", "ownerUid", scope.ownerUid);
  if (scope.token) await get("tokens", docId(scope.token));
  if (scope.digestId) await get("digests", docId(scope.digestId));

  for (const { collection, snap } of seenSnaps) {
    const data = snap.data();
    if (collection === "couples") ingestCoupleDoc(db, snap);
    else if (collection === "sessions") ingestSessionDoc(db, snap);
    else if (collection === "memories") {
      const m = data as Db["couples"][string]["memories"][string];
      if (m.coupleId) ensureCouple(db, m.coupleId).memories[m.id ?? snap.id] = m;
    } else if (collection === "memoryCandidates") {
      const m = data as Db["couples"][string]["memoryCandidates"][string];
      if (m.coupleId) ensureCouple(db, m.coupleId).memoryCandidates[m.id ?? snap.id] = m;
    } else if (collection === "reflections") {
      const m = data as Db["couples"][string]["reflections"][string];
      if (m.coupleId) ensureCouple(db, m.coupleId).reflections[m.id ?? snap.id] = m;
    } else if (collection === "approvals") {
      const m = data as Db["couples"][string]["approvals"][string];
      if (m.coupleId) ensureCouple(db, m.coupleId).approvals[m.id ?? snap.id] = m;
    } else if (collection === "replays") {
      const m = data as Db["couples"][string]["replays"][string];
      if (m.coupleId) ensureCouple(db, m.coupleId).replays[m.id ?? snap.id] = m;
    } else if (collection === "planVersions") {
      const payload = data as { plan?: SessionBundle["planHistory"][string]; sessionId?: string };
      const bundle = payload.sessionId ? findBundle(db, payload.sessionId) : null;
      if (bundle && payload.plan) bundle.planHistory[String(payload.plan.version)] = payload.plan;
    } else if (collection === "runs") {
      const run = data as SessionBundle["runs"][string];
      if (run.coupleId && run.sessionId) {
        const couple = ensureCouple(db, run.coupleId);
        if (!couple.sessions[run.sessionId]) {
          couple.sessions[run.sessionId] = emptySession({
            id: run.sessionId,
            coupleId: run.coupleId,
            ownerUid: run.ownerUid,
            status: "DRAFT",
            input: {} as Session["input"],
            currentPlanVersion: null,
            currentLocation: null,
            scheduleNow: null,
            isDemo: false,
            createdAt: run.createdAt,
          });
        }
        couple.sessions[run.sessionId]!.runs[run.id ?? snap.id] = run;
      }
    } else if (collection === "events") {
      const ev = data as SessionBundle["events"][string] & { sessionId?: string };
      const bundle = ev.sessionId ? findBundle(db, ev.sessionId) : null;
      if (bundle) bundle.events[ev.eventId ?? snap.id] = ev;
    } else if (collection === "scenarios") {
      const sc = data as SessionBundle["scenarios"][string];
      const bundle = findBundle(db, sc.sessionId);
      if (bundle) bundle.scenarios[sc.id ?? snap.id] = sc;
    } else if (collection === "spots") {
      const payload = data as { spot?: SessionBundle["spots"][string]; sessionId?: string };
      const bundle = payload.sessionId ? findBundle(db, payload.sessionId) : null;
      if (bundle && payload.spot) bundle.spots[payload.spot.id] = payload.spot;
    } else if (collection === "evidence") {
      const evd = data as SessionBundle["evidence"][string] & { sessionId?: string };
      const bundle = evd.sessionId ? findBundle(db, evd.sessionId) : null;
      if (bundle) bundle.evidence[evd.id ?? snap.id] = evd;
    } else if (collection === "drafts") {
      const d = data as Db["drafts"][string];
      db.drafts[d.id ?? snap.id] = d;
    } else if (collection === "idempotency") {
      const r = data as Db["idempotency"][string];
      if (r.key) db.idempotency[r.key] = r;
    } else if (collection === "tokens") {
      const t = data as { token?: string; uid: string; createdAt: string };
      if (t.token) db.tokens[t.token] = { uid: t.uid, createdAt: t.createdAt };
    } else if (collection === "digests") {
      const d = data as Db["digests"][string];
      const id = (d as { id?: string }).id ?? snap.id;
      db.digests[id] = d;
    }
  }

  return { db, loadedKeys, before: flattenDb(db) };
}

export async function commitScoped(
  fs: Firestore,
  afterDb: Db,
  loadedKeys: Set<string>,
  before: FireDoc[],
  tx?: Transaction,
): Promise<{ setCount: number; delCount: number }> {
  const { set, del } = diffDocs(before, flattenDb(afterDb), loadedKeys);
  const writes: Array<{ ref: DocumentReference; data?: Record<string, unknown>; del?: boolean }> = [];
  for (const d of del) writes.push({ ref: fs.collection(d.collection).doc(d.id), del: true });
  for (const d of set) writes.push({ ref: fs.collection(d.collection).doc(d.id), data: stripUndefined(d.data) });

  if (tx) {
    for (const w of writes) {
      if (w.del) tx.delete(w.ref);
      else tx.set(w.ref, w.data ?? {});
    }
    return { setCount: set.length, delCount: del.length };
  }

  for (let i = 0; i < writes.length; i += 400) {
    const batch = fs.batch();
    for (const w of writes.slice(i, i + 400)) {
      if (w.del) batch.delete(w.ref);
      else batch.set(w.ref, w.data ?? {});
    }
    await batch.commit();
  }
  return { setCount: set.length, delCount: del.length };
}
