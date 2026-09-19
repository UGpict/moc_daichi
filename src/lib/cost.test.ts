import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addedConditionsDifference,
  calculateReferenceCost,
  RATES,
  stayExtensionCost,
  stayExtensionDays,
  transportOverageCost,
  transportOverageUnits,
} from "./cost";
import { DEFAULT_CONDITIONS } from "./sample-data";

describe("cost calculation", () => {
  it("charges stay extension only after the included 2 days", () => {
    assert.equal(stayExtensionDays(2), 0);
    assert.equal(stayExtensionCost(2), 0);
    assert.equal(stayExtensionDays(4), 2);
    assert.equal(stayExtensionCost(4), 22_000);
    assert.equal(stayExtensionDays(7), 5);
    assert.equal(stayExtensionCost(7), 55_000);
  });

  it("rounds transport overage up in 10km units after 20km", () => {
    assert.equal(transportOverageUnits(10), 0);
    assert.equal(transportOverageUnits(20), 0);
    assert.equal(transportOverageUnits(21), 1);
    assert.equal(transportOverageUnits(30), 1);
    assert.equal(transportOverageUnits(31), 2);
    assert.equal(transportOverageUnits(40), 2);
    assert.equal(transportOverageCost(30), 5_500);
    assert.equal(transportOverageCost(40), 11_000);
  });

  it("matches the demo default reference total of 699,500 yen", () => {
    const breakdown = calculateReferenceCost(DEFAULT_CONDITIONS);

    assert.equal(breakdown.stayExtensionDays, 2);
    assert.equal(breakdown.transportOverageKm, 10);
    assert.deepEqual(
      breakdown.lines.map((line) => line.amount),
      [550_000, 22_000, 5_500, 0, 12_000, 110_000],
    );
    assert.equal(breakdown.total, 699_500);
    assert.equal(addedConditionsDifference(breakdown.total), 149_500);
  });

  it("updates the total when stay, distance, or night transport changes", () => {
    const fiveDays = calculateReferenceCost({
      stayDays: 5,
      transportKm: 30,
      nightTransport: false,
    });
    assert.equal(fiveDays.total, 710_500);
    assert.equal(fiveDays.total, 699_500 + RATES.stayExtensionPerDay);

    const fortyKm = calculateReferenceCost({
      stayDays: 4,
      transportKm: 40,
      nightTransport: false,
    });
    assert.equal(fortyKm.total, 699_500 + RATES.extraTransportPer10km);

    const night = calculateReferenceCost({
      stayDays: 4,
      transportKm: 30,
      nightTransport: true,
    });
    assert.equal(night.total, 699_500 + RATES.nightTransport);

    const includedOnly = calculateReferenceCost({
      stayDays: 2,
      transportKm: 20,
      nightTransport: false,
    });
    assert.equal(includedOnly.total, 550_000 + 12_000 + 110_000);
  });
});
