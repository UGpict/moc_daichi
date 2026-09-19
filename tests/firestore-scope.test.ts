import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stripPlaceholderAdc } from "../src/server/auth/adc";
import { diffDocs, type FireDoc } from "../src/server/repositories/firestore/scoped";
import { diagnosePersistSync } from "../src/server/repositories/persistDiagnose";
import { scoreOutcome } from "../src/domain/demo/criteria61";

describe("scoped firestore writes", () => {
  it("writes only changed and new docs and deletes only loaded missing ones", () => {
    const before: FireDoc[] = [
      { collection: "sessions", id: "s1", data: { id: "s1", currentPlanVersion: 1 } },
      { collection: "runs", id: "r1", data: { id: "r1", status: "WAITING_APPROVAL" } },
    ];
    const after: FireDoc[] = [
      { collection: "sessions", id: "s1", data: { id: "s1", currentPlanVersion: 2 } },
      { collection: "runs", id: "r1", data: { id: "r1", status: "SUCCEEDED" } },
      { collection: "approvals", id: "a1", data: { id: "a1", status: "CONSUMED" } },
    ];
    const loaded = new Set(["sessions/s1", "runs/r1", "approvals/old"]);
    const diff = diffDocs(before, after, loaded);
    assert.equal(diff.set.length, 3);
    assert.deepEqual(
      diff.set.map((d) => `${d.collection}/${d.id}`).sort(),
      ["approvals/a1", "runs/r1", "sessions/s1"],
    );
    assert.deepEqual(diff.del, [{ collection: "approvals", id: "old" }]);
  });

  it("does not emit writes for unchanged loaded docs", () => {
    const doc: FireDoc = { collection: "couples", id: "c1", data: { id: "c1", ownerUid: "u1" } };
    const diff = diffDocs([doc], [doc], new Set(["couples/c1"]));
    assert.equal(diff.set.length, 0);
    assert.equal(diff.del.length, 0);
  });
});

describe("ADC is user applicationDefault, not a service account file", () => {
  it("drops a fake GAC path", () => {
    const prev = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/absolute/path/to/service-account.json";
    const result = stripPlaceholderAdc();
    assert.equal(result.stripped, true);
    if (prev != null) process.env.GOOGLE_APPLICATION_CREDENTIALS = prev;
    else delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  });
});

describe("emulator vs LIVE scoring", () => {
  it("does not count emulator all-pass as LIVE 完全成功", () => {
    const allPass = [
      { id: "rain_auto_notify" as const, label: "x", verdict: "PASS" as const, detail: "" },
      { id: "reflection_one_question" as const, label: "x", verdict: "PASS" as const, detail: "" },
    ];
    assert.equal(scoreOutcome(allPass, "emulator"), "EMULATOR成功");
    assert.equal(scoreOutcome(allPass, "live"), "完全成功");
    assert.equal(scoreOutcome(allPass, "json"), "部分成功");
  });

  it("records scoped writes as implemented without a service-account file", () => {
    const prev = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const prevRuntime = process.env.APP_RUNTIME;
    const prevFs = process.env.FIRESTORE_EMULATOR_HOST;
    const prevAuth = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    process.env.APP_RUNTIME = "LIVE";
    const d = diagnosePersistSync();
    if (prev != null) process.env.GOOGLE_APPLICATION_CREDENTIALS = prev;
    else delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (prevRuntime != null) process.env.APP_RUNTIME = prevRuntime;
    else delete process.env.APP_RUNTIME;
    if (prevFs != null) process.env.FIRESTORE_EMULATOR_HOST = prevFs;
    if (prevAuth != null) process.env.FIREBASE_AUTH_EMULATOR_HOST = prevAuth;
    assert.equal(d.implemented.scopedWrites, true);
    assert.equal(d.implemented.approvalTransaction, true);
    assert.equal(d.implemented.userAdc, true);
  });
});
