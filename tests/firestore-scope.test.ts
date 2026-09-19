import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { materializeAdcFromEnv, validateServiceAccountJson } from "../src/server/auth/adc";
import { diffDocs, type FireDoc } from "../src/server/repositories/firestore/scoped";
import { redactPersistText } from "../src/server/repositories/persistErrors";
import { diagnosePersistSync } from "../src/server/repositories/persistDiagnose";

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

describe("ADC materialize", () => {
  it("writes JSON secret to a 0600 temp file and does not keep the env body", () => {
    const dir = mkdtempSync(join(tmpdir(), "futari-adc-"));
    const dest = join(dir, "adc.json");
    const prevPath = process.env.FUTARI_ADC_PATH;
    const prevSecret = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const prevGac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    process.env.FUTARI_ADC_PATH = dest;
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: "service_account",
      private_key: "-----BEGIN PRIVATE KEY-----\nMIIBTEST\n-----END PRIVATE KEY-----\n",
      client_email: "probe@example.com",
    });
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const result = materializeAdcFromEnv();
    assert.equal(result.ok, true);
    assert.equal(result.source, "FIREBASE_SERVICE_ACCOUNT_JSON");
    assert.equal(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, undefined);
    assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, dest);
    const written = readFileSync(dest, "utf8");
    assert.match(written, /service_account/);
    const redacted = redactPersistText(written);
    assert.doesNotMatch(redacted, /BEGIN PRIVATE KEY/);
    if (prevPath != null) process.env.FUTARI_ADC_PATH = prevPath;
    else delete process.env.FUTARI_ADC_PATH;
    if (prevSecret != null) process.env.FIREBASE_SERVICE_ACCOUNT_JSON = prevSecret;
    else delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (prevGac != null) process.env.GOOGLE_APPLICATION_CREDENTIALS = prevGac;
    else delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects invalid JSON without echoing the body", () => {
    const result = validateServiceAccountJson("{not-json");
    assert.equal(result.ok, false);
    if (!result.ok) assert.doesNotMatch(result.reason, /not-json/);
  });
});

describe("diagnose after materialize flags", () => {
  it("keeps placeholder ADC as CREDENTIALS and records scoped writes as implemented", () => {
    const prev = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const prevRuntime = process.env.APP_RUNTIME;
    const prevSecret = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    process.env.APP_RUNTIME = "LIVE";
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/service-account.json";
    const d = diagnosePersistSync();
    if (prev != null) process.env.GOOGLE_APPLICATION_CREDENTIALS = prev;
    else delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (prevRuntime != null) process.env.APP_RUNTIME = prevRuntime;
    else delete process.env.APP_RUNTIME;
    if (prevSecret != null) process.env.FIREBASE_SERVICE_ACCOUNT_JSON = prevSecret;
    assert.equal(d.kind, "CREDENTIALS");
    assert.equal(d.implemented.scopedWrites, true);
    assert.equal(d.implemented.approvalTransaction, true);
    assert.equal(d.adc.pathIsPlaceholder, true);
  });
});
