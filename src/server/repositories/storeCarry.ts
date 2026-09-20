import { AsyncLocalStorage } from "node:async_hooks";
import { gunzipSync, gzipSync } from "node:zlib";
import type { NextResponse } from "next/server";
import {
  STORE_COOKIE_COUNT,
  STORE_COOKIE_PREFIX,
  STORE_HEADER,
  STORE_MAX_CHUNKS,
  STORE_CHUNK,
  joinCarryChunks,
  readCarryHeader,
  splitCarryChunks,
  writeCarryHeaders,
} from "@/lib/storeCarryMeta";
import type { CoupleBundle, Db, SessionBundle } from "./store";

type CarryEnvelope = { v: 1; t: number; db: Db };
type CarrySlot = {
  request: Request | null;
  db: Db | null;
  loaded: boolean;
  dirty: boolean;
};

const als = new AsyncLocalStorage<CarrySlot>();
const HEADER_BUDGET = 12_000;

function emptyCarryDb(): Db {
  return { couples: {}, idempotency: {}, tokens: {}, digests: {}, drafts: {} };
}

function hydrateDb(db: Db): Db {
  db.couples ??= {};
  db.idempotency ??= {};
  db.tokens ??= {};
  db.digests ??= {};
  db.drafts ??= {};
  return db;
}

export function shouldCarryStore(): boolean {
  const runtime = (process.env.APP_RUNTIME ?? "").trim().toUpperCase();
  if (runtime === "LIVE" || runtime === "EMULATOR") return false;
  const flag = (process.env.FUTARI_STORE_CARRY ?? "").trim().toLowerCase();
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;
  return Boolean(process.env.VERCEL || process.env.NOW_REGION);
}

export function resetCarryForTests() {
  als.enterWith({ request: null, db: null, loaded: false, dirty: false });
}

export function getCarrySlot(): CarrySlot {
  let slot = als.getStore();
  if (!slot) {
    slot = { request: null, db: null, loaded: false, dirty: false };
    als.enterWith(slot);
  }
  return slot;
}

export function bindIncomingRequest(request: Request) {
  const existing = als.getStore();
  if (existing?.request === request) return existing;
  const slot: CarrySlot = { request, db: null, loaded: false, dirty: false };
  als.enterWith(slot);
  return slot;
}

export function peekCarriedDb(): Db | null {
  return als.getStore()?.db ?? null;
}

function parseCookieHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const raw = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(raw);
    } catch {
      out[key] = raw;
    }
  }
  return out;
}

function encodedFromCookies(header: string): string | null {
  const cookies = parseCookieHeader(header);
  const n = Number(cookies[STORE_COOKIE_COUNT] ?? 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  const chunks: string[] = [];
  for (let i = 0; i < n; i++) {
    const part = cookies[`${STORE_COOKIE_PREFIX}${i}`];
    if (!part) return null;
    chunks.push(part);
  }
  return joinCarryChunks(chunks);
}

function decodeEnvelope(encoded: string): { t: number; db: Db } | null {
  const tryDecode = (encoding: BufferEncoding) => {
    const json = gunzipSync(Buffer.from(encoded, encoding)).toString("utf8");
    return JSON.parse(json) as CarryEnvelope | Db;
  };
  try {
    let parsed: CarryEnvelope | Db;
    try {
      parsed = tryDecode("base64url");
    } catch {
      parsed = tryDecode("base64");
    }
    if (parsed && typeof parsed === "object" && "v" in parsed && parsed.v === 1 && parsed.db) {
      return { t: Number(parsed.t) || 0, db: hydrateDb(parsed.db) };
    }
    if (parsed && typeof parsed === "object" && "couples" in parsed) {
      return { t: 0, db: hydrateDb(parsed as Db) };
    }
    return null;
  } catch {
    return null;
  }
}

export function decodeDb(encoded: string): Db | null {
  return decodeEnvelope(encoded)?.db ?? null;
}

function dbForCarry(db: Db): Db {
  return {
    couples: db.couples,
    idempotency: db.idempotency,
    tokens: {},
    digests: db.digests ?? {},
    drafts: db.drafts ?? {},
  };
}

function pruneBundle(bundle: SessionBundle): SessionBundle {
  const events = Object.values(bundle.events)
    .sort((a, b) => a.seq - b.seq)
    .slice(-24);
  return {
    ...bundle,
    events: Object.fromEntries(events.map((event) => [event.eventId, event])),
    evidence: {},
  };
}

function pruneDb(db: Db): Db {
  const couples: Record<string, CoupleBundle> = {};
  for (const [id, couple] of Object.entries(db.couples)) {
    const sessions: Record<string, SessionBundle> = {};
    for (const [sid, bundle] of Object.entries(couple.sessions)) {
      sessions[sid] = pruneBundle(bundle);
    }
    couples[id] = { ...couple, sessions, replays: {} };
  }
  return {
    couples,
    idempotency: {},
    tokens: {},
    digests: {},
    drafts: db.drafts ?? {},
  };
}

function pack(db: Db, at: number): string {
  const payload: CarryEnvelope = { v: 1, t: at, db: dbForCarry(db) };
  return gzipSync(Buffer.from(JSON.stringify(payload), "utf8")).toString("base64url");
}

export function encodeDb(db: Db, at = Date.now()): string {
  let encoded = pack(db, at);
  if (encoded.length > STORE_CHUNK * STORE_MAX_CHUNKS) encoded = pack(pruneDb(db), at);
  return encoded;
}

export function incomingEncoded(request: Request): string | null {
  return readCarryHeader((name) => request.headers.get(name)) ?? encodedFromCookies(request.headers.get("cookie") ?? "");
}

function pickNewer(a: string | null, b: string | null): Db | null {
  const left = a ? decodeEnvelope(a) : null;
  const right = b ? decodeEnvelope(b) : null;
  if (left && right) return left.t >= right.t ? left.db : right.db;
  return left?.db ?? right?.db ?? null;
}

export async function ensureCarryLoaded() {
  if (!shouldCarryStore()) return;
  const slot = getCarrySlot();
  if (slot.loaded) return;
  slot.loaded = true;
  const request = slot.request;
  if (!request) return;
  const header = readCarryHeader((name) => request.headers.get(name));
  const cookie = encodedFromCookies(request.headers.get("cookie") ?? "");
  slot.db = pickNewer(header, cookie) ?? emptyCarryDb();
}

export function rememberCarriedDb(db: Db) {
  if (!shouldCarryStore()) return;
  const slot = getCarrySlot();
  slot.db = db;
  slot.loaded = true;
  slot.dirty = true;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24,
    secure: Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production",
  };
}

export function clearCarryCookies(res: NextResponse) {
  const opts = { ...cookieOptions(), maxAge: 0 };
  res.cookies.set(STORE_COOKIE_COUNT, "", opts);
  for (let i = 0; i < STORE_MAX_CHUNKS; i++) {
    res.cookies.set(`${STORE_COOKIE_PREFIX}${i}`, "", opts);
  }
}

export function applyCarryToResponse(res: NextResponse, encoded: string) {
  const chunks = splitCarryChunks(encoded);
  const opts = cookieOptions();
  res.cookies.set(STORE_COOKIE_COUNT, String(chunks.length), opts);
  chunks.forEach((chunk, i) => {
    res.cookies.set(`${STORE_COOKIE_PREFIX}${i}`, chunk, opts);
  });
  for (let i = chunks.length; i < STORE_MAX_CHUNKS; i++) {
    res.cookies.set(`${STORE_COOKIE_PREFIX}${i}`, "", { ...opts, maxAge: 0 });
  }
  if (encoded.length <= HEADER_BUDGET) {
    writeCarryHeaders(encoded, (name, value) => res.headers.set(name, value));
  } else if (encoded.length <= STORE_CHUNK) {
    res.headers.set(STORE_HEADER, encoded);
  }
}

function hasUserData(db: Db): boolean {
  return (
    Object.keys(db.couples).length > 0 ||
    Object.keys(db.drafts ?? {}).length > 0 ||
    Object.keys(db.idempotency ?? {}).length > 0
  );
}

export function attachCarry<T extends NextResponse>(res: T): T {
  if (!shouldCarryStore()) return res;
  const db = als.getStore()?.db;
  if (!db || !hasUserData(db)) return res;
  try {
    applyCarryToResponse(res, encodeDb(db));
  } catch {
    /* 持ち回り失敗でも API 自体は返す */
  }
  return res;
}
