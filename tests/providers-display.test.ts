import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countedAsLabel,
  connectionLabel,
  persistLabel,
  providersLine,
} from "../src/domain/demo/providersDisplay";
import { jobDispatchMode } from "../src/server/jobs/dispatch";

describe("provider display", () => {
  it("does not call emulator persist LIVE", () => {
    assert.equal(countedAsLabel("EMULATOR"), "EMULATOR（LIVE成功に数えない）");
    assert.equal(countedAsLabel("LIVE"), "LIVE（完全成功の対象）");
    assert.equal(persistLabel("firestore-emulator"), "Firestore Emulator");
    assert.equal(persistLabel("firestore-live"), "本物 Firestore");
    assert.equal(connectionLabel("LIVE"), "実接続");
    assert.equal(connectionLabel("MOCK"), "モック");
  });

  it("lists persist llm places routes separately", () => {
    const line = providersLine({
      persist: "firestore-emulator",
      llm: "LIVE",
      places: "MOCK",
      routes: "MOCK",
    });
    assert.match(line, /永続化 Firestore Emulator/);
    assert.match(line, /LLM 実接続/);
    assert.match(line, /Places モック/);
    assert.match(line, /Routes モック/);
  });
});

describe("enqueue retry", () => {
  it("stays poller when WORKER_MODE=poller", () => {
    const prev = process.env.WORKER_MODE;
    process.env.WORKER_MODE = "poller";
    assert.equal(jobDispatchMode(), "poller");
    if (prev) process.env.WORKER_MODE = prev;
    else delete process.env.WORKER_MODE;
  });
});
