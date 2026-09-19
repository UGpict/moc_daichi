import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyPersistFailure,
  PersistBlockedError,
  redactPersistText,
} from "../src/server/repositories/persistErrors";
import { diagnosePersistSync } from "../src/server/repositories/persistDiagnose";
import { stripPlaceholderAdc } from "../src/server/auth/adc";

describe("persist error classification", () => {
  it("keeps credential fetch, permission, and unconfigured apart", () => {
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

describe("persist diagnose without service account checks", () => {
  it("does not require GOOGLE_APPLICATION_CREDENTIALS or type=service_account on LIVE sync", () => {
    const prev = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const prevRuntime = process.env.APP_RUNTIME;
    const prevEmu = process.env.FIRESTORE_EMULATOR_HOST;
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
    if (prevEmu != null) process.env.FIRESTORE_EMULATOR_HOST = prevEmu;
    if (prevAuth != null) process.env.FIREBASE_AUTH_EMULATOR_HOST = prevAuth;
    assert.notEqual(d.kind, "UNIMPLEMENTED");
    assert.equal(d.implemented.userAdc, true);
    assert.equal(d.adc.usesApplicationDefault, true);
    assert.equal(d.kind, "ok");
    assert.match(d.detail, /applicationDefault/);
  });

  it("strips placeholder ADC so applicationDefault can use user credentials", () => {
    const prev = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/service-account.json";
    const result = stripPlaceholderAdc();
    assert.equal(result.stripped, true);
    assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, undefined);
    if (prev != null) process.env.GOOGLE_APPLICATION_CREDENTIALS = prev;
    else delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  });

  it("refuses production when emulator hosts are set but emulator is down", () => {
    const prevRuntime = process.env.APP_RUNTIME;
    const prevFs = process.env.FIRESTORE_EMULATOR_HOST;
    const prevAuth = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    process.env.APP_RUNTIME = "EMULATOR";
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:18080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:19099";
    const d = diagnosePersistSync();
    if (prevRuntime != null) process.env.APP_RUNTIME = prevRuntime;
    else delete process.env.APP_RUNTIME;
    if (prevFs != null) process.env.FIRESTORE_EMULATOR_HOST = prevFs;
    else delete process.env.FIRESTORE_EMULATOR_HOST;
    if (prevAuth != null) process.env.FIREBASE_AUTH_EMULATOR_HOST = prevAuth;
    else delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    assert.equal(d.kind, "CONNECT");
    assert.equal(d.refusedProduction, true);
    assert.equal(d.emulator, true);
    assert.match(d.detail, /本番/);
  });

  it("keeps PersistBlockedError kinds distinct", () => {
    assert.equal(new PersistBlockedError("PERMISSION", "x").kind, "PERMISSION");
    assert.equal(new PersistBlockedError("NOT_CONFIGURED", "x").kind, "NOT_CONFIGURED");
    assert.equal(new PersistBlockedError("CREDENTIALS", "x").kind, "CREDENTIALS");
  });
});
