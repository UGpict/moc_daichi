import { z } from "zod";

export const modeSchema = z.enum(["LIVE", "LIVE_SCENARIO", "REPLAY"]);
export type Mode = z.infer<typeof modeSchema>;

export const sourceKindSchema = z.enum([
  "API",
  "CACHE",
  "ESTIMATED",
  "INJECTED",
  "USER",
  "UNKNOWN",
]);
export type SourceKind = z.infer<typeof sourceKindSchema>;

export const evidenceSchema = z.object({
  id: z.string(),
  kind: sourceKindSchema,
  provider: z.string().nullable(),
  sourceRef: z.string().nullable(),
  sourceField: z.string().nullable(),
  fetchedAt: z.string().nullable(),
  validFor: z
    .object({
      from: z.string(),
      to: z.string(),
    })
    .nullable(),
  note: z.string().nullable(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export function factSchema<T extends z.ZodType>(value: T) {
  return z.object({
    value: value.nullable(),
    evidenceIds: z.array(z.string()),
  });
}

export const preferencePolaritySchema = z.enum(["LIKE", "AVOID"]);
export const preferenceHorizonSchema = z.enum(["THIS_DATE", "ONGOING"]);
export const preferenceTargetSchema = z.enum([
  "WALKING",
  "STANDING",
  "SWEETS",
  "EXHIBIT",
  "INDOOR",
  "REST",
  "OTHER",
]);

export const preferenceSchema = z.object({
  id: z.string(),
  subject: z.enum(["SELF", "PARTNER", "BOTH"]),
  content: z.string().min(1).max(2000),
  priority: z.enum(["MUST", "PREFER"]),
  source: z.enum(["SELF_REPORT", "PARTNER_STATEMENT_REPORTED", "OBSERVATION", "UNKNOWN"]),
  polarity: preferencePolaritySchema.default("LIKE"),
  horizon: preferenceHorizonSchema.default("THIS_DATE"),
  targetKind: preferenceTargetSchema.default("OTHER"),
});
export type Preference = z.infer<typeof preferenceSchema>;

export const environmentSchema = z.enum(["INDOOR", "OUTDOOR", "MIXED"]);
export const restEaseSchema = z.enum(["EASY", "LIMITED"]);
export const standingBurdenSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const spotSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  categories: z.array(z.string()),
  environment: factSchema(environmentSchema),
  costForTwoJpy: factSchema(
    z.object({
      min: z.number(),
      max: z.number(),
    }),
  ),
  restEase: factSchema(restEaseSchema),
  standingBurden: factSchema(standingBurdenSchema),
  officialUrl: z.string().nullable(),
  photoName: z.string().nullable().default(null),
  photoAttribution: z.string().nullable().default(null),
});
export type Spot = z.infer<typeof spotSchema>;

export const planItemSchema = z.object({
  id: z.string(),
  spotId: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  progress: z.enum(["NOT_STARTED", "IN_PROGRESS", "DONE"]),
  locked: z.boolean(),
  lockReason: z.string().nullable(),
  matchesPreferenceIds: z.array(z.string()),
  memoryIds: z.array(z.string()),
  reason: z.string(),
  evidenceIds: z.array(z.string()),
});
export type PlanItem = z.infer<typeof planItemSchema>;

export const travelModeSchema = z.enum(["WALK", "TRANSIT", "DRIVE"]);
export type TravelMode = z.infer<typeof travelModeSchema>;

export const travelLegSchema = z.object({
  id: z.string(),
  from: z.enum(["MEET", "SPOT", "END"]),
  fromSpotId: z.string().nullable(),
  to: z.enum(["SPOT", "END"]),
  toSpotId: z.string().nullable(),
  mode: travelModeSchema,
  departureAt: z.string(),
  durationMinutes: factSchema(z.number()),
  distanceMeters: factSchema(z.number()),
  delayMinutesInjected: z.number().nullable(),
  evidenceIds: z.array(z.string()),
});
export type TravelLeg = z.infer<typeof travelLegSchema>;

export const openingStateSchema = z.enum(["OPEN", "CLOSED", "UNKNOWN"]);
export const openingAssessmentSchema = z.object({
  spotId: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  state: openingStateSchema,
  evidenceIds: z.array(z.string()),
});
export type OpeningAssessment = z.infer<typeof openingAssessmentSchema>;

export const validationIssueSchema = z.object({
  code: z.string(),
  severity: z.enum(["ERROR", "UNKNOWN", "WARNING"]),
  itemIds: z.array(z.string()),
  message: z.string(),
  evidenceIds: z.array(z.string()),
  targetId: z.string().nullable().default(null),
  neededEvidence: z.string().nullable().default(null),
  howToResolve: z.string().nullable().default(null),
});
export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export const validationResultSchema = z.object({
  state: z.enum(["PASS", "CONDITIONAL", "FAIL"]),
  issues: z.array(validationIssueSchema),
});
export type ValidationResult = z.infer<typeof validationResultSchema>;

export const planBSchema = z.object({
  id: z.string(),
  trigger: z.string(),
  itemId: z.string(),
  candidateSpotId: z.string().nullable(),
  policy: z.string().nullable(),
  validation: validationResultSchema.nullable(),
  verifiedAt: z.string().nullable(),
  isVerifiedAlternative: z.boolean(),
});
export type PlanB = z.infer<typeof planBSchema>;

export const costEstimateSchema = z.object({
  mealsJpy: factSchema(z.number()),
  facilitiesJpy: factSchema(z.number()),
  transitJpy: factSchema(z.number()),
  totalJpy: factSchema(z.number()),
});

export const planSchema = z.object({
  version: z.number().int().positive(),
  items: z.array(planItemSchema),
  legs: z.array(travelLegSchema),
  openings: z.array(openingAssessmentSchema),
  assumptions: z.array(z.string()),
  validation: validationResultSchema,
  planB: z.array(planBSchema),
  costEstimate: costEstimateSchema,
  dataMode: modeSchema,
  memoryInfluences: z.array(
    z.object({
      memoryId: z.string(),
      effect: z.enum(["PRIORITY", "DURATION", "REST_INSERT", "INDOOR_PREF", "TRAVEL", "NONE"]),
      detail: z.string(),
      before: z.string().nullable().default(null),
      after: z.string().nullable().default(null),
      reason: z.string().nullable().default(null),
      evidenceIds: z.array(z.string()).default([]),
    }),
  ),
  preferenceOutcomes: z
    .array(
      z.object({
        preferenceId: z.string(),
        state: z.enum(["SATISFIED", "PARTIAL", "UNMET", "UNKNOWN"]),
        spotId: z.string().nullable(),
        evidenceIds: z.array(z.string()).default([]),
        note: z.string(),
      }),
    )
    .default([]),
});
export type Plan = z.infer<typeof planSchema>;

export const planDiffSchema = z.object({
  fromVersion: z.number(),
  toVersion: z.number(),
  keptItemIds: z.array(z.string()),
  replaced: z.array(
    z.object({
      fromItemId: z.string(),
      toItemId: z.string(),
      fromSpotId: z.string(),
      toSpotId: z.string(),
    }),
  ),
  addedItemIds: z.array(z.string()),
  removedItemIds: z.array(z.string()),
  timeShifts: z.array(
    z.object({
      itemId: z.string(),
      startDeltaMin: z.number(),
      endDeltaMin: z.number(),
    }),
  ),
  summary: z.string(),
});
export type PlanDiff = z.infer<typeof planDiffSchema>;

export const fixedAppointmentSchema = z.object({
  id: z.string(),
  label: z.string(),
  spotId: z.string().nullable(),
  spotNameHint: z.string().nullable(),
  startAt: z.string(),
  endAt: z.string(),
  kind: z.literal("TIME_FIXED"),
});
export type FixedAppointment = z.infer<typeof fixedAppointmentSchema>;

export const budgetSchema = z.object({
  mealsJpy: z.number().nullable(),
  facilitiesJpy: z.number().nullable(),
  transitJpy: z.number().nullable(),
});
export type Budget = z.infer<typeof budgetSchema>;

export const autoApplyPolicySchema = z.object({
  enabled: z.boolean(),
  acknowledgedScope: z.string().nullable(),
  validUntil: z.string().nullable(),
});
export type AutoApplyPolicy = z.infer<typeof autoApplyPolicySchema>;

export const meetPointSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  spotId: z.string().nullable(),
  provider: z.enum(["places", "mock", "user"]).default("user"),
  resolved: z.boolean().default(true),
});

export const selectedSpotSchema = z.object({
  spotId: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  intent: z.enum(["MUST_VISIT", "PREFER_VISIT"]).default("PREFER_VISIT"),
});
export type SelectedSpot = z.infer<typeof selectedSpotSchema>;

export const planningInputSchema = z.object({
  dateTokyo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  meet: meetPointSchema,
  end: meetPointSchema,
  budget: budgetSchema,
  preferences: z.array(preferenceSchema).min(1),
  fixedAppointments: z.array(fixedAppointmentSchema),
  autoApply: autoApplyPolicySchema,
  travelMode: travelModeSchema.default("WALK"),
  areaName: z.string(),
  areaId: z.string().default("area:nagoya-station"),
  areaLat: z.number(),
  areaLng: z.number(),
  radiusMeters: z.number().default(2500),
  pickedSpotIds: z.array(z.string()).default([]),
  selectedSpots: z.array(selectedSpotSchema).default([]),
  draftId: z.string().nullable().default(null),
  assembleMode: z.enum(["AI", "MANUAL"]).default("AI"),
});
export type PlanningInput = z.infer<typeof planningInputSchema>;

export const memoryCandidateSchema = z.object({
  id: z.string(),
  coupleId: z.string(),
  sessionId: z.string(),
  reflectionId: z.string(),
  answerId: z.string().nullable(),
  subject: z.enum(["SELF", "PARTNER", "BOTH"]),
  type: z.enum(["CARE", "PREFERENCE", "CONSTRAINT"]),
  content: z.string(),
  sourceType: z.enum([
    "SELF_REPORT",
    "PARTNER_STATEMENT_REPORTED",
    "OBSERVATION",
    "HYPOTHESIS",
  ]),
  evidenceQuote: z.string(),
  strength: z.enum(["SOFT", "HARD"]),
  scope: z.enum(["NEXT_DATE", "ONGOING"]),
  createdAt: z.string(),
  careTarget: preferenceTargetSchema.nullable().optional(),
  careDirection: z.enum(["REDUCE", "INCREASE", "PREFER", "AVOID"]).nullable().optional(),
  injectionFlags: z.array(z.string()).default([]),
});
export type MemoryCandidate = z.infer<typeof memoryCandidateSchema>;

export const memorySchema = z.object({
  id: z.string(),
  coupleId: z.string(),
  subject: z.enum(["SELF", "PARTNER", "BOTH"]),
  type: z.enum(["CARE", "PREFERENCE", "CONSTRAINT"]),
  content: z.string(),
  sourceType: z.enum([
    "SELF_REPORT",
    "PARTNER_STATEMENT_REPORTED",
    "OBSERVATION",
  ]),
  reflectionId: z.string(),
  answerId: z.string(),
  evidenceQuote: z.string(),
  confirmation: z.literal("USER_CONFIRMED"),
  approvedAt: z.string(),
  visibility: z.literal("PRIVATE"),
  strength: z.enum(["SOFT", "HARD"]),
  scope: z.enum(["NEXT_DATE", "ONGOING"]),
  targetSessionId: z.string().nullable(),
  active: z.boolean(),
  version: z.number().int().positive(),
  supersedes: z.string().nullable(),
  careTarget: preferenceTargetSchema.nullable().default(null),
  careDirection: z.enum(["REDUCE", "INCREASE", "PREFER", "AVOID"]).nullable().default(null),
  contentHash: z.string().nullable().default(null),
});
export type Memory = z.infer<typeof memorySchema>;

export const approvalSchema = z.object({
  id: z.string(),
  coupleId: z.string(),
  sessionId: z.string(),
  runId: z.string(),
  planVersionFrom: z.number(),
  planVersionTo: z.number(),
  kind: z.enum(["PLAN_APPLY", "MEMORY_SAVE", "MEMORY_EDIT"]),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CONSUMED", "EXPIRED"]),
  summary: z.string(),
  diff: planDiffSchema.nullable(),
  consumedAt: z.string().nullable(),
  createdAt: z.string(),
  payloadId: z.string().nullable().default(null),
  payloadVersion: z.number().nullable().default(null),
  candidateId: z.string().nullable().default(null),
  candidateVersion: z.number().nullable().default(1),
  sourceMemoryId: z.string().nullable().default(null),
  sourceVersion: z.number().nullable().default(null),
  replacementCandidateId: z.string().nullable().default(null),
  presentedHash: z.string().nullable().default(null),
});
export type Approval = z.infer<typeof approvalSchema>;

export const runKindSchema = z.enum([
  "INITIAL_PLAN",
  "REPLAN",
  "REFLECTION",
  "NEXT_PLAN",
]);
export type RunKind = z.infer<typeof runKindSchema>;

export const runStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "WAITING_INPUT",
  "WAITING_APPROVAL",
  "SUCCEEDED",
  "PARTIAL",
  "FAILED",
  "INTERRUPTED",
  "CANCELLED",
]);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const runSchema = z.object({
  id: z.string(),
  coupleId: z.string(),
  sessionId: z.string(),
  ownerUid: z.string(),
  kind: runKindSchema,
  status: runStatusSchema,
  mode: modeSchema,
  displayRuntime: z.enum(["MOCK", "DEV", "EMULATOR", "LIVE", "REPLAY"]),
  leaseFencingToken: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  deadlineAt: z.string().nullable(),
  leaseOwner: z.string().nullable(),
  leaseExpiresAt: z.string().nullable(),
  heartbeatAt: z.string().nullable(),
  trigger: z.string().nullable(),
  basePlanVersion: z.number().nullable(),
  resultPlanVersion: z.number().nullable(),
  waitingQuestion: z
    .object({
      id: z.string(),
      prompt: z.string(),
      options: z.array(z.string()),
    })
    .nullable(),
  waitingApprovalId: z.string().nullable(),
  error: z.string().nullable(),
  cost: z.object({
    llmJpy: z.number().nullable(),
    apiJpy: z.number().nullable(),
    mundaneCalls: z.number(),
    hardCalls: z.number(),
    unaccountedCalls: z.number(),
  }),
  versions: z.object({
    schema: z.string(),
    prompt: z.string(),
    tool: z.string(),
    modelSettings: z.string(),
    git: z.string().nullable(),
  }),
});
export type Run = z.infer<typeof runSchema>;

export const eventTypeSchema = z.enum([
  "RUN_STARTED",
  "RUN_FINISHED",
  "TOOL_STARTED",
  "TOOL_COMPLETED",
  "CANDIDATE_REJECTED",
  "MODEL_SELECTED",
  "VALIDATION_FAILED",
  "SELF_CORRECTED",
  "INPUT_REQUIRED",
  "APPROVAL_REQUIRED",
  "PLAN_APPLIED",
  "PLAN_AUTO_APPLIED",
  "MEMORY_APPROVED",
  "TIME_BUDGET_REACHED",
  "CACHE_HIT",
  "HTTP_ATTEMPT",
  "LLM_ATTEMPT",
  "SCENARIO_INJECTED",
  "ESCALATED",
  "NOTICE",
  "REPAIR_ATTEMPTED",
  "LLM_COERCED",
  "INJECTION_FLAGGED",
]);
export type EventType = z.infer<typeof eventTypeSchema>;

export const eventSchema = z.object({
  eventId: z.string(),
  runId: z.string(),
  seq: z.number().int().nonnegative(),
  at: z.string(),
  type: eventTypeSchema,
  summary: z.string(),
  evidenceIds: z.array(z.string()),
  model: z.string().nullable(),
  pool: z.enum(["mundane", "hard"]).nullable(),
  requestedModel: z.string().nullable(),
  actualModel: z.string().nullable(),
  usage: z
    .object({
      promptTokens: z.number().nullable(),
      completionTokens: z.number().nullable(),
      costUsd: z.number().nullable(),
      costJpy: z.number().nullable(),
      latencyMs: z.number().nullable(),
      ok: z.boolean(),
    })
    .nullable(),
  payload: z.unknown().nullable(),
});
export type AppEvent = z.infer<typeof eventSchema>;

export const sessionStatusSchema = z.enum([
  "DRAFT",
  "CONFIRMED",
  "IN_PROGRESS",
  "DONE",
  "REFLECTED",
]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const sessionSchema = z.object({
  id: z.string(),
  coupleId: z.string(),
  ownerUid: z.string(),
  status: sessionStatusSchema,
  input: planningInputSchema,
  currentPlanVersion: z.number().nullable(),
  currentLocation: z
    .object({
      lat: z.number(),
      lng: z.number(),
      label: z.string().nullable(),
    })
    .nullable(),
  scheduleNow: z.string().nullable(),
  isDemo: z.boolean(),
  createdAt: z.string(),
});
export type Session = z.infer<typeof sessionSchema>;

export const coupleSchema = z.object({
  id: z.string(),
  ownerUid: z.string(),
  isDemo: z.boolean(),
  createdAt: z.string(),
});
export type Couple = z.infer<typeof coupleSchema>;

export const scenarioKindSchema = z.enum([
  "WEATHER",
  "SPOT_FULL",
  "TRAVEL_DELAY",
  "DEMO_CLOCK",
]);
export type ScenarioKind = z.infer<typeof scenarioKindSchema>;

export const scenarioOverlaySchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  kind: scenarioKindSchema,
  createdAt: z.string(),
  createdByUid: z.string(),
  target: z.object({
    spotId: z.string().nullable(),
    legId: z.string().nullable(),
    from: z.string().nullable(),
    to: z.string().nullable(),
  }),
  overlay: z.record(z.string(), z.unknown()),
  baselineRef: z.string().nullable(),
});
export type ScenarioOverlay = z.infer<typeof scenarioOverlaySchema>;

export const replayManifestSchema = z.object({
  id: z.string(),
  coupleId: z.string(),
  sessionId: z.string(),
  runId: z.string(),
  createdAt: z.string(),
  gitCommit: z.string().nullable(),
  versions: runSchema.shape.versions,
  events: z.array(eventSchema),
  plan: planSchema.nullable(),
  spots: z.array(spotSchema),
  evidence: z.array(evidenceSchema),
  costSnapshot: runSchema.shape.cost,
  notes: z.string(),
});
export type ReplayManifest = z.infer<typeof replayManifestSchema>;

export const publicPlanDtoSchema = z.object({
  dateTokyo: z.string(),
  meetName: z.string(),
  endName: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      startAt: z.string(),
      endAt: z.string(),
      officialUrl: z.string().nullable(),
    }),
  ),
});
export type PublicPlanDTO = z.infer<typeof publicPlanDtoSchema>;

export const digestItemSchema = z.object({
  spotId: z.string(),
  vibe: z.string(),
  kind: z.enum(["HAPPENING", "PLACE"]),
  query: z.string(),
  why: z.string(),
  occurrenceId: z.string().nullable().default(null),
  displayKind: z.enum(["PLACE", "VENUE", "CONFIRMED_EVENT"]).default("PLACE"),
});
export type DigestItem = z.infer<typeof digestItemSchema>;

export const dailyDigestSchema = z.object({
  id: z.string(),
  tokyoDate: z.string(),
  areaName: z.string(),
  lat: z.number(),
  lng: z.number(),
  fetchedAt: z.string(),
  status: z.enum(["FETCHING", "READY", "FAILED"]),
  note: z.string(),
  items: z.array(digestItemSchema),
  spots: z.record(z.string(), spotSchema),
  format: z.number().default(1),
  areaId: z.string().default("area:nagoya-station"),
  radiusMeters: z.number().default(2500),
  providerVersion: z.string().default("v0.7"),
});
export type DailyDigest = z.infer<typeof dailyDigestSchema>;

export const eventOccurrenceSchema = z.object({
  id: z.string(),
  venueSpotId: z.string(),
  title: z.string(),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  timeZone: z.string().default("Asia/Tokyo"),
  officialUrl: z.string().nullable(),
  confirmedAt: z.string(),
  state: z.enum(["CONFIRMED", "UNCONFIRMED", "CANCELLED"]),
  sourceRef: z.string().nullable(),
  evidenceIds: z.array(z.string()).default([]),
});
export type EventOccurrence = z.infer<typeof eventOccurrenceSchema>;

export const selectionDraftSchema = z.object({
  id: z.string(),
  ownerUid: z.string(),
  areaId: z.string(),
  createdAt: z.string(),
  selectedSpots: z.array(selectedSpotSchema),
  status: z.enum(["OPEN", "CONSUMED", "CLEARED"]),
  consumedAt: z.string().nullable().default(null),
});
export type SelectionDraft = z.infer<typeof selectionDraftSchema>;

export const llmAttemptSchema = z.object({
  id: z.string(),
  runId: z.string(),
  task: z.string(),
  attempt: z.number().int().positive(),
  requestedModel: z.string(),
  actualModel: z.string(),
  promptTokens: z.number().nullable(),
  completionTokens: z.number().nullable(),
  costUsd: z.number().nullable(),
  costJpy: z.number().nullable(),
  latencyMs: z.number(),
  ok: z.boolean(),
  repaired: z.boolean(),
  error: z.string().nullable(),
  at: z.string(),
});
export type LlmAttempt = z.infer<typeof llmAttemptSchema>;

export const reflectionSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  coupleId: z.string(),
  rawNote: z.string(),
  maskedNote: z.string(),
  createdAt: z.string(),
});
export type Reflection = z.infer<typeof reflectionSchema>;
