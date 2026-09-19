import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validatePlan } from "../src/domain/plan/validatePlan";
import { evaluateAutoApply } from "../src/domain/plan/evaluateAutoApply";
import { diffPlan } from "../src/domain/plan/diffPlan";
import { inferPolarity, inferTargetKind, walkingAvoid, walkingLike, structurePreference } from "../src/domain/planning/requirements";
import { validateTransition } from "../src/domain/planning/validateTransition";
import { candidateContentHash, validateMemoryCandidate } from "../src/domain/memory/validateMemoryCandidate";
import { mergeAttemptCosts } from "../src/server/llm/callLedger";
import { occurrencesFromPlacesSearch, venueDisplayNote } from "../src/server/providers/eventOccurrences";
import { planningInputSchema, type Plan, type PlanningInput, type Spot } from "../src/domain/schemas";

function fact<T>(value: T | null) {
  return { value, evidenceIds: [] as string[] };
}

const input: PlanningInput = planningInputSchema.parse({
  dateTokyo: "2026-09-19",
  startTime: "13:00",
  endTime: "18:00",
  meet: { name: "名古屋駅", lat: 35.17, lng: 136.88, spotId: "a" },
  end: { name: "名古屋駅", lat: 35.17, lng: 136.88, spotId: "a" },
  budget: { mealsJpy: 8000, facilitiesJpy: 4000, transitJpy: 2000 },
  preferences: [
    {
      id: "p1",
      subject: "PARTNER",
      content: "甘いもの",
      priority: "MUST",
      source: "PARTNER_STATEMENT_REPORTED",
    },
  ],
  fixedAppointments: [],
  autoApply: { enabled: true, acknowledgedScope: "demo", validUntil: "2099-01-01T00:00:00.000Z" },
  areaName: "名古屋駅周辺",
  areaLat: 35.17,
  areaLng: 136.88,
});

const spots: Record<string, Spot> = {
  cafe: {
    id: "cafe",
    name: "カフェ",
    lat: 35.17,
    lng: 136.88,
    categories: ["cafe"],
    environment: fact("INDOOR"),
    costForTwoJpy: fact({ min: 1000, max: 2000 }),
    restEase: fact("EASY"),
    standingBurden: fact("LOW"),
    officialUrl: "https://example.invalid/cafe",
    photoName: null,
    photoAttribution: null,
  },
  park: {
    id: "park",
    name: "公園",
    lat: 35.18,
    lng: 136.89,
    categories: ["park"],
    environment: fact("OUTDOOR"),
    costForTwoJpy: fact({ min: 0, max: 0 }),
    restEase: fact("LIMITED"),
    standingBurden: fact("HIGH"),
    officialUrl: null,
    photoName: null,
    photoAttribution: null,
  },
  museum: {
    id: "museum",
    name: "美術館",
    lat: 35.17,
    lng: 136.9,
    categories: ["museum"],
    environment: fact("INDOOR"),
    costForTwoJpy: fact({ min: 5000, max: 6000 }),
    restEase: fact("LIMITED"),
    standingBurden: fact("HIGH"),
    officialUrl: null,
    photoName: null,
    photoAttribution: null,
  },
};

function emptyPlan(over: Partial<Plan> = {}): Plan {
  return {
    version: 1,
    items: [],
    legs: [],
    openings: [],
    assumptions: [],
    validation: { state: "PASS", issues: [] },
    planB: [],
    costEstimate: {
      mealsJpy: fact(null),
      facilitiesJpy: fact(null),
      transitJpy: fact(null),
      totalJpy: fact(null),
    },
    dataMode: "LIVE",
    memoryInfluences: [],
    preferenceOutcomes: [],
    ...over,
  };
}

describe("v0.7 regression", () => {
  it("does not treat 歩きたくない as wanting a walk", () => {
    assert.equal(inferPolarity("歩きたくない"), "AVOID");
    assert.equal(inferTargetKind("歩きたくない"), "WALKING");
    assert.equal(inferPolarity("歩くのが好き"), "LIKE");
    const avoid = structurePreference({
      id: "a",
      subject: "SELF",
      content: "歩きたくない",
      priority: "MUST",
      source: "SELF_REPORT",
      polarity: "AVOID",
      horizon: "THIS_DATE",
      targetKind: "WALKING",
    });
    const like = structurePreference({
      id: "b",
      subject: "SELF",
      content: "歩くのが好き",
      priority: "PREFER",
      source: "SELF_REPORT",
      polarity: "LIKE",
      horizon: "THIS_DATE",
      targetKind: "WALKING",
    });
    assert.equal(walkingAvoid(avoid), true);
    assert.equal(walkingLike(like), true);
    assert.equal(walkingLike(avoid), false);
  });

  it("keeps transit out of meal/facility budget and honors 0 yen", () => {
    const plan = emptyPlan({
      items: [
        {
          id: "i1",
          spotId: "museum",
          startAt: "2026-09-19T04:00:00.000Z",
          endAt: "2026-09-19T05:00:00.000Z",
          progress: "NOT_STARTED",
          locked: false,
          lockReason: null,
          matchesPreferenceIds: [],
          memoryIds: [],
          reason: "x",
          evidenceIds: [],
        },
      ],
      legs: [
        {
          id: "l1",
          from: "MEET",
          fromSpotId: null,
          to: "SPOT",
          toSpotId: "museum",
          mode: "WALK",
          departureAt: "2026-09-19T03:50:00.000Z",
          durationMinutes: fact(10),
          distanceMeters: fact(800),
          delayMinutesInjected: null,
          evidenceIds: [],
        },
        {
          id: "l2",
          from: "SPOT",
          fromSpotId: "museum",
          to: "END",
          toSpotId: null,
          mode: "WALK",
          departureAt: "2026-09-19T05:00:00.000Z",
          durationMinutes: fact(10),
          distanceMeters: fact(800),
          delayMinutesInjected: null,
          evidenceIds: [],
        },
      ],
      openings: [{ spotId: "museum", startAt: "2026-09-19T04:00:00.000Z", endAt: "2026-09-19T05:00:00.000Z", state: "OPEN", evidenceIds: [] }],
    });
    const zeroFacilities = { ...input, budget: { mealsJpy: 8000, facilitiesJpy: 0, transitJpy: 2000 }, preferences: [{ ...input.preferences[0]!, priority: "PREFER" as const }] };
    const r = validatePlan(plan, { spots, input: zeroFacilities });
    assert.equal(r.state, "FAIL");
    assert.ok(r.issues.some((i) => i.code === "OVER_BUDGET_FACILITIES"));
  });

  it("does not display Places event search as a confirmed occurrence", () => {
    assert.equal(occurrencesFromPlacesSearch().length, 0);
    assert.match(venueDisplayNote(), /未確認/);
  });

  it("protects done items across replan", () => {
    const prev = emptyPlan({
      items: [
        {
          id: "d1",
          spotId: "cafe",
          startAt: "2026-09-19T04:00:00.000Z",
          endAt: "2026-09-19T05:00:00.000Z",
          progress: "DONE",
          locked: false,
          lockReason: null,
          matchesPreferenceIds: [],
          memoryIds: [],
          reason: "x",
          evidenceIds: [],
        },
      ],
    });
    const next = emptyPlan({ items: [] });
    const t = validateTransition({ previous: prev, next });
    assert.equal(t.ok, false);
  });

  it("binds memory approval to candidateId hash not partial text", () => {
    const c = {
      id: "mc_1",
      coupleId: "cpl",
      sessionId: "ses",
      reflectionId: "ref",
      answerId: "a",
      subject: "PARTNER" as const,
      type: "CARE" as const,
      content: "長く立つと疲れる",
      sourceType: "OBSERVATION" as const,
      evidenceQuote: "長く立つと疲れる",
      strength: "SOFT" as const,
      scope: "NEXT_DATE" as const,
      createdAt: "2026-09-19T00:00:00.000Z",
    };
    const h = candidateContentHash(c);
    const other = candidateContentHash({ ...c, content: "カフェが良かった" });
    assert.notEqual(h, other);
    assert.equal(validateMemoryCandidate({ ...c, sourceType: "HYPOTHESIS" }).ok, false);
  });

  it("sums both LLM attempts", () => {
    const merged = mergeAttemptCosts([
      {
        id: "1",
        runId: "r",
        task: "final_plan",
        attempt: 1,
        requestedModel: "a",
        actualModel: "a",
        promptTokens: 10,
        completionTokens: 5,
        costUsd: 0.01,
        costJpy: 1.5,
        latencyMs: 10,
        ok: false,
        repaired: false,
        error: "schema",
        at: "t",
      },
      {
        id: "2",
        runId: "r",
        task: "final_plan",
        attempt: 2,
        requestedModel: "a",
        actualModel: "a",
        promptTokens: 12,
        completionTokens: 8,
        costUsd: 0.02,
        costJpy: 3,
        latencyMs: 12,
        ok: true,
        repaired: true,
        error: null,
        at: "t",
      },
    ]);
    assert.equal(merged.promptTokens, 22);
    assert.equal(merged.costUsd, 0.03);
  });

  it("refuses auto-apply of FAIL plans", () => {
    const prev = emptyPlan({ version: 1, validation: { state: "PASS", issues: [] } });
    const next = emptyPlan({ version: 2, validation: { state: "FAIL", issues: [{ code: "X", severity: "ERROR", itemIds: [], message: "x", evidenceIds: [], targetId: null, neededEvidence: null, howToResolve: null }] } });
    const d = diffPlan(prev, next);
    const r = evaluateAutoApply({
      previous: prev,
      next,
      diff: d,
      policy: { enabled: true, acknowledgedScope: "x", validUntil: "2099-01-01T00:00:00.000Z" },
      nowIso: "2026-09-19T00:00:00.000Z",
      expectedBaseVersion: 1,
    });
    assert.equal(r.apply, false);
  });
});
