import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { digestKey } from "../src/server/providers/dailyDigest";
import { searchCatalog } from "../src/server/providers/catalog";
import { planningInputSchema } from "../src/domain/schemas";

describe("daily digest", () => {
  it("keys one catalog per areaId, coords, radius, Tokyo date and provider version", () => {
    const a = digestKey("area:nagoya-station", 35.17092, 136.88154, 2500, "2026-09-19");
    const b = digestKey("area:nagoya-station", 35.17092, 136.88154, 2500, "2026-09-20");
    assert.match(a, /^digest:area:nagoya-station:/);
    assert.notEqual(a, b);
  });

  it("treats 催し and イベント as venue-like catalog search in MOCK", () => {
    const happenings = searchCatalog("催し");
    const events = searchCatalog("イベント");
    assert.ok(happenings.length >= 3);
    assert.ok(events.some((s) => s.categories.includes("museum") || s.categories.includes("tourist_attraction")));
    assert.ok(!happenings.some((s) => s.id === "mock:nagoya-station"));
  });

  it("accepts pickedSpotIds so a date can be assembled from today's catalog", () => {
    const parsed = planningInputSchema.parse({
      dateTokyo: "2026-09-19",
      startTime: "13:00",
      endTime: "18:00",
      meet: { name: "名古屋駅", lat: 35.17, lng: 136.88, spotId: null },
      end: { name: "名古屋駅", lat: 35.17, lng: 136.88, spotId: null },
      budget: { mealsJpy: 8000, facilitiesJpy: 4000, transitJpy: 2000 },
      preferences: [{ id: "p1", subject: "SELF", content: "催し", priority: "PREFER", source: "SELF_REPORT" }],
      fixedAppointments: [],
      autoApply: { enabled: false, acknowledgedScope: null, validUntil: null },
      areaName: "名古屋駅周辺",
      areaLat: 35.17,
      areaLng: 136.88,
      pickedSpotIds: ["mock:aichi-art-museum", "mock:noritake-garden", "mock:komeda-meieki"],
    });
    assert.equal(parsed.pickedSpotIds.length, 3);
  });
});
