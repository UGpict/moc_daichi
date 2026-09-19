export type Me = {
  uid: string;
  coupleId: string | null;
  runtime: string;
  demoControls?: boolean;
  demoAreaName: string;
  demoDate: string;
  demoLat: number;
  demoLng: number;
  blockers: { code: string; item: string }[];
};

export type Preference = {
  id: string;
  subject: string;
  content: string;
  priority: string;
  source: string;
};

export type Snapshot = {
  runtime: string;
  couple: { id: string };
  session: {
    id: string;
    status: string;
    input: {
      preferences: Preference[];
      autoApply: { enabled: boolean };
      meet: { name: string };
      end: { name: string };
      dateTokyo: string;
      startTime?: string;
      endTime?: string;
      areaName?: string;
    };
    currentPlanVersion: number | null;
    currentLocation: { label: string | null } | null;
  };
  plan: {
    version: number;
    items: {
      id: string;
      spotId: string;
      startAt: string;
      endAt: string;
      progress: string;
      locked: boolean;
      lockReason: string | null;
      reason: string;
      matchesPreferenceIds: string[];
      memoryIds: string[];
    }[];
    legs: {
      id: string;
      durationMinutes: { value: number | null };
      delayMinutesInjected: number | null;
    }[];
    assumptions: string[];
    validation: { state: string; issues: { code: string; severity: string; message: string }[] };
    planB: {
      id: string;
      trigger: string;
      candidateSpotId: string | null;
      policy: string | null;
      isVerifiedAlternative: boolean;
      itemId?: string | null;
    }[];
    openings?: { spotId: string; state: string }[];
    costEstimate: { totalJpy: { value: number | null } };
    memoryInfluences: { memoryId: string; effect: string; detail: string }[];
    dataMode: string;
  } | null;
  spots: Record<
    string,
    {
      name: string;
      officialUrl: string | null;
      categories?: string[];
      environment: { value: string | null };
      costForTwoJpy: { value: { min: number; max: number } | null };
      photoName?: string | null;
      photoAttribution?: string | null;
    }
  >;
  runs: {
    id: string;
    status: string;
    kind: string;
    cost: {
      llmJpy: number | null;
      apiJpy: number | null;
      mundaneCalls: number;
      hardCalls: number;
      unaccountedCalls: number;
    };
    waitingQuestion: { id: string; prompt: string; options: string[] } | null;
    waitingApprovalId: string | null;
    displayRuntime: string;
    mode: string;
    error?: string | null;
  }[];
  events: {
    eventId: string;
    seq: number;
    type: string;
    summary: string;
    at: string;
    actualModel: string | null;
    pool: string | null;
  }[];
  approvals: {
    id: string;
    status: string;
    summary: string;
    kind: string;
    diff: { summary: string; fromVersion: number; toVersion: number } | null;
  }[];
  memories: { id: string; content: string; active: boolean; subject?: string; evidenceQuote?: string }[];
  memoryCandidates: { id: string; content: string }[];
  overlays: string[];
  scenarios: { kind: string }[];
};

export type PlanSummary = {
  id: string;
  status: string;
  dateTokyo: string;
  areaName: string;
  meetName: string;
  spotNames: string[];
  validationState: string | null;
  costKnown: boolean;
  createdAt: string;
};
