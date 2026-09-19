import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyPersistFailure,
  PersistBlockedError,
  redactPersistText,
} from "../src/server/repositories/persistErrors";
import { diagnosePersistSync } from "../src/server/repositories/persistDiagnose";

describe("persist error classification", () => {
  it("keeps credential fetch, permission, and unconfigured apart", () => {
    assert.equal(
      classifyPersistFailure({ message: "ENOENT: no such file", code: "ENOENT", operation: "open ADC file" }),
      "CREDENTIALS",
    );
    assert.equal(
      classifyPersistFailure({ message: "Could not load the default credentials", operation: "initializeApp" }),
      "CREDENTIALS",
    );
    assert.equal(
      classifyPersistFailure({ message: "7 PERMISSION_DENIED: Missing or insufficient permissions.", code: 7 }),
      "PERMISSION",
    );
    assert.equal(
      classifyPersistFailure({
        message: "5 NOT_FOUND: The database (default) does not exist for project foo",
        code: 5,
        operation: "firestore.collection('couples').limit(1).get",
      }),
      "NOT_CONFIGURED",
    );
    assert.equal(classifyPersistFailure({ message: "Cloud Firestore API has not been used" }), "NOT_CONFIGURED");
    assert.equal(classifyPersistFailure({ message: "feature not implemented" }), "UNIMPLEMENTED");
  });

  it("does not print private keys or tokens", () => {
    const raw = redactPersistText(
      "key -----BEGIN PRIVATE KEY-----ABC-----END PRIVATE KEY----- Bearer ya29.abc AIzaSyDummyTokenValue1234567890 user@example.com",
    );
    assert.doesNotMatch(raw, /BEGIN PRIVATE KEY/);
    assert.doesNotMatch(raw, /ya29/);
    assert.doesNotMatch(raw, /AIza/);
    assert.doesNotMatch(raw, /Bearer ya29/);
    assert.doesNotMatch(raw, /user@example.com/);
  });
});

describe("persist diagnose vs leftover JSON", () => {
  it("treats placeholder ADC as CREDENTIALS and says Firestore repo is implemented", () => {
    const prev = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const prevRuntime = process.env.APP_RUNTIME;
    process.env.APP_RUNTIME = "LIVE";
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/service-account.json";
    const d = diagnosePersistSync();
    if (prev != null) process.env.GOOGLE_APPLICATION_CREDENTIALS = prev;
    else delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (prevRuntime != null) process.env.APP_RUNTIME = prevRuntime;
    else delete process.env.APP_RUNTIME;
    assert.equal(d.kind, "CREDENTIALS");
    assert.equal(d.implemented.firestoreRepo, true);
    assert.equal(d.implemented.switchByPersistBackend, true);
    assert.equal(d.adc.pathIsPlaceholder, true);
    assert.equal(d.operation, "open GOOGLE_APPLICATION_CREDENTIALS");
    assert.equal(d.currentWriteTarget, "none");
    assert.notEqual(d.kind, "UNIMPLEMENTED");
    assert.notEqual(d.kind, "PERMISSION");
    assert.notEqual(d.kind, "NOT_CONFIGURED");
  });

  it("keeps PersistBlockedError kinds distinct", () => {
    assert.equal(new PersistBlockedError("PERMISSION", "x").kind, "PERMISSION");
    assert.equal(new PersistBlockedError("NOT_CONFIGURED", "x").kind, "NOT_CONFIGURED");
    assert.equal(new PersistBlockedError("CREDENTIALS", "x").kind, "CREDENTIALS");
  });
});
