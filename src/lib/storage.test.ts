import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDemoState } from "./storage";
import { DEFAULT_DEMO_STATE } from "./sample-data";

describe("demo state persistence", () => {
  it("restores a valid saved state and rejects broken payloads", () => {
    const parsed = parseDemoState({
      ...DEFAULT_DEMO_STATE,
      inquiryStatus: "answers_confirmed",
      conditions: { stayDays: 5, transportKm: 40, nightTransport: true },
      hasReviewedEstimate: true,
    });

    assert.equal(parsed?.inquiryStatus, "answers_confirmed");
    assert.equal(parsed?.conditions.stayDays, 5);
    assert.equal(parsed?.conditions.transportKm, 40);
    assert.equal(parsed?.conditions.nightTransport, true);

    assert.equal(parseDemoState(null), null);
    assert.equal(parseDemoState({ version: 1 }), null);
    assert.equal(
      parseDemoState({
        ...DEFAULT_DEMO_STATE,
        version: 4,
      }),
      null,
    );
    assert.equal(
      parseDemoState({
        ...DEFAULT_DEMO_STATE,
        inquiryStatus: "sent_to_llm",
      }),
      null,
    );
    assert.equal(
      parseDemoState({
        ...DEFAULT_DEMO_STATE,
        conditions: { stayDays: 1, transportKm: 30, nightTransport: false },
      }),
      null,
    );
  });
});
