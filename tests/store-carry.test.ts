import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextResponse } from "next/server";
import {
  STORE_COOKIE_COUNT,
  STORE_COOKIE_PREFIX,
  STORE_HEADER,
  joinCarryChunks,
  splitCarryChunks,
} from "../src/lib/storeCarryMeta";
import {
  applyCarryToResponse,
  attachCarry,
  bindIncomingRequest,
  decodeDb,
  encodeDb,
  ensureCarryLoaded,
  peekCarriedDb,
  resetCarryForTests,
  shouldCarryStore,
} from "../src/server/repositories/storeCarry";
import { emptyDb, findSession, readStore, withStore } from "../src/server/repositories/store";
import type { Session } from "../src/domain/schemas";

function clearMemory() {
  delete (globalThis as { __futariJsonDb?: unknown }).__futariJsonDb;
}

function withEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    prev[key] = process.env[key];
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  const restore = () => {
    for (const [key, value] of Object.entries(prev)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
    resetCarryForTests();
    clearMemory();
  };
  const result = fn();
  if (result && typeof result === "object" && "then" in result) {
    return result.finally(restore);
  }
  restore();
  return result;
}

function sampleDb(sessionId = "ses_carry") {
  const db = emptyDb();
  db.couples.cpl_1 = {
    couple: { id: "cpl_1", ownerUid: "anon_1", isDemo: true, createdAt: "t" },
    memories: {},
    memoryCandidates: {},
    reflections: {},
    approvals: {},
    sessions: {
      [sessionId]: {
        session: {
          id: sessionId,
          coupleId: "cpl_1",
          ownerUid: "anon_1",
          status: "DRAFT",
          input: { dateTokyo: "2026-09-20" },
          currentPlanVersion: null,
          currentLocation: null,
          scheduleNow: null,
          isDemo: true,
          createdAt: "t",
        } as Session,
        planHistory: {},
        runs: {},
        events: {},
        scenarios: {},
        spots: {},
        evidence: {},
      },
    },
    replays: {},
  };
  return db;
}

describe("store carry meta", () => {
  it("roundtrips chunked payloads", () => {
    const encoded = "a".repeat(5000);
    const chunks = splitCarryChunks(encoded, 2800);
    assert.equal(chunks.length, 2);
    assert.equal(joinCarryChunks(chunks), encoded);
  });
});

describe("store carry encode", () => {
  it("roundtrips a session db", () => {
    const db = sampleDb();
    const encoded = encodeDb(db);
    const decoded = decodeDb(encoded);
    assert.ok(decoded);
    assert.equal(findSession(decoded, "ses_carry")?.bundle.session.id, "ses_carry");
  });

  it("omits tokens from the carried payload", () => {
    const db = sampleDb();
    db.tokens["mock.x"] = { uid: "anon_1", createdAt: "t" };
    const decoded = decodeDb(encodeDb(db));
    assert.deepEqual(decoded?.tokens, {});
  });
});

describe("shouldCarryStore", () => {
  it("is on for Vercel MOCK and off for LIVE", async () => {
    await withEnv({ APP_RUNTIME: "MOCK", VERCEL: "1", FUTARI_STORE_CARRY: undefined }, () => {
      assert.equal(shouldCarryStore(), true);
    });
    await withEnv({ APP_RUNTIME: "LIVE", VERCEL: "1", FUTARI_STORE_CARRY: "1" }, () => {
      assert.equal(shouldCarryStore(), false);
    });
    await withEnv({ APP_RUNTIME: "MOCK", VERCEL: undefined, FUTARI_STORE_CARRY: "1" }, () => {
      assert.equal(shouldCarryStore(), true);
    });
  });
});

describe("cross-isolate session lookup", () => {
  it("finds a session created on another isolate via the carry header", async () => {
    await withEnv({ APP_RUNTIME: "MOCK", VERCEL: "1", FUTARI_STORE_DIR: undefined, FUTARI_STORE_CARRY: "1" }, async () => {
      resetCarryForTests();
      clearMemory();
      bindIncomingRequest(new Request("http://futari.test/api/couples"));
      await withStore((db) => {
        const created = sampleDb("ses_new");
        db.couples = created.couples;
      });
      const encoded = encodeDb(peekCarriedDb() ?? emptyDb());
      assert.match(encoded, /[A-Za-z0-9_-]+/);

      resetCarryForTests();
      clearMemory();
      bindIncomingRequest(new Request("http://futari.test/api/sessions/ses_new/runs"));
      assert.equal(
        await readStore((db) => findSession(db, "ses_new")),
        null,
      );

      bindIncomingRequest(
        new Request("http://futari.test/api/sessions/ses_new/runs", {
          headers: { [STORE_HEADER]: encoded },
        }),
      );
      const found = await readStore((db) => findSession(db, "ses_new"));
      assert.equal(found?.bundle.session.id, "ses_new");
    });
  });

  it("prefers the newer envelope when header and cookies disagree", async () => {
    await withEnv({ APP_RUNTIME: "MOCK", FUTARI_STORE_CARRY: "1", VERCEL: undefined }, async () => {
      const older = encodeDb(sampleDb("ses_old"), 1);
      const newer = encodeDb(sampleDb("ses_new"), 2);
      resetCarryForTests();
      bindIncomingRequest(
        new Request("http://futari.test/api/sessions/x", {
          headers: {
            [STORE_HEADER]: older,
            cookie: `${STORE_COOKIE_COUNT}=1; ${STORE_COOKIE_PREFIX}0=${newer}`,
          },
        }),
      );
      await ensureCarryLoaded();
      assert.equal(findSession(peekCarriedDb()!, "ses_new")?.bundle.session.id, "ses_new");
    });
  });

  it("attaches cookies and the carry header to API responses", () => {
    const encoded = encodeDb(sampleDb());
    const res = NextResponse.json({ ok: true });
    applyCarryToResponse(res, encoded);
    assert.equal(res.headers.get(STORE_HEADER), encoded);
    assert.ok(res.cookies.get(STORE_COOKIE_COUNT)?.value);
    assert.ok(res.cookies.get(`${STORE_COOKIE_PREFIX}0`)?.value);
  });

  it("attachCarry is a no-op without a bound db", () => {
    resetCarryForTests();
    const res = attachCarry(NextResponse.json({ ok: true }));
    assert.equal(res.headers.get(STORE_HEADER), null);
  });
});
