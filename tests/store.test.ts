import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { issueAnonymous } from "../src/server/auth";
import { jsonStoreFile, jsonStoreRoot, withStore } from "../src/server/repositories/store";

function clearMemory() {
  delete (globalThis as { __futariJsonDb?: unknown }).__futariJsonDb;
}

describe("json store on Vercel", () => {
  it("uses /tmp when VERCEL=1", () => {
    const prev = process.env.VERCEL;
    const prevDir = process.env.FUTARI_STORE_DIR;
    delete process.env.FUTARI_STORE_DIR;
    process.env.VERCEL = "1";
    try {
      assert.equal(jsonStoreRoot(), join("/tmp", "futari-log"));
      assert.equal(jsonStoreFile(), join("/tmp", "futari-log", "store.json"));
    } finally {
      if (prev != null) process.env.VERCEL = prev;
      else delete process.env.VERCEL;
      if (prevDir != null) process.env.FUTARI_STORE_DIR = prevDir;
    }
  });

  it("writes a guest token outside the repo .data directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "futari-store-"));
    const prevDir = process.env.FUTARI_STORE_DIR;
    const prevRuntime = process.env.APP_RUNTIME;
    process.env.FUTARI_STORE_DIR = dir;
    process.env.APP_RUNTIME = "MOCK";
    clearMemory();
    try {
      await withStore((db) => {
        db.tokens["mock.x"] = { uid: "anon_1", createdAt: "t" };
      }, { token: "mock.x" });
      const file = join(dir, "store.json");
      assert.equal(existsSync(file), true);
      const db = JSON.parse(readFileSync(file, "utf8")) as { tokens: Record<string, { uid: string }> };
      assert.equal(db.tokens["mock.x"].uid, "anon_1");
    } finally {
      clearMemory();
      if (prevDir != null) process.env.FUTARI_STORE_DIR = prevDir;
      else delete process.env.FUTARI_STORE_DIR;
      if (prevRuntime != null) process.env.APP_RUNTIME = prevRuntime;
      else delete process.env.APP_RUNTIME;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("issues a DEV guest token even if the token write is skipped", async () => {
    const prevRuntime = process.env.APP_RUNTIME;
    process.env.APP_RUNTIME = "MOCK";
    const issued = await issueAnonymous();
    if (prevRuntime != null) process.env.APP_RUNTIME = prevRuntime;
    else delete process.env.APP_RUNTIME;
    assert.match(issued.uid, /^anon_/);
    assert.match(issued.token, /^mock\./);
  });
});
