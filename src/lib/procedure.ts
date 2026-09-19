import { seededMotherMemories } from "./conversation";
import {
  CREMATION_FIRST_DATE,
  DEFAULT_CONDITIONS,
  DEFAULT_DEMO_STATE,
  DEFAULT_FAMILY_JUDGMENT,
  DEFAULT_SHARE,
  EMPTY_CASE_INQUIRY,
  EMPTY_PERMIT,
} from "./sample-data";
import type { DemoState } from "./types";
import { calculateReferenceCost } from "./cost";

export function cloneState(base: DemoState): DemoState {
  return {
    ...base,
    conditions: { ...base.conditions },
    caseInquiry: { ...base.caseInquiry },
    permit: { ...base.permit },
    appliedEventIds: [...base.appliedEventIds],
    messages: base.messages.map((item) => ({ ...item })),
    memories: base.memories.map((item) => ({ ...item })),
    share: { ...base.share },
    familyJudgment: { ...base.familyJudgment },
  };
}

export function createPrepStartState(): DemoState {
  return cloneState(DEFAULT_DEMO_STATE);
}

export function createProcedureStartState(
  from?: Pick<DemoState, "conditions">,
): DemoState {
  return {
    ...cloneState(DEFAULT_DEMO_STATE),
    track: "procedure",
    inquiryStatus: "answers_confirmed",
    conditions: {
      ...(from?.conditions ?? DEFAULT_CONDITIONS),
      stayDays: 4,
    },
    hasReviewedEstimate: true,
    hasViewedFamily: true,
    deathCertificate: "unchecked",
    domicileStatus: "reviewing_sample",
    scheduleStatus: "adjusting",
    originalCremationDate: CREMATION_FIRST_DATE,
    proposedCremationDate: CREMATION_FIRST_DATE,
    applicationCremationDate: CREMATION_FIRST_DATE,
    formStatus: "drafted",
    caseInquiry: { ...EMPTY_CASE_INQUIRY },
    permit: { ...EMPTY_PERMIT },
    autoPlay: false,
    nextAutoAt: null,
    appliedEventIds: [],
    viewerRole: "family",
    talkStep: "family_ready",
    resumeStep: "family_ready",
    memories: seededMotherMemories(),
    summaryDecision: "confirmed",
    share: { ...DEFAULT_SHARE, sharedWithKenichi: true },
    familyJudgment: { ...DEFAULT_FAMILY_JUDGMENT },
    timePassed: true,
    nameCheckStatus: "not_compared",
    handoverHeard: false,
  };
}

export function beginProcedureFromPrep(state: DemoState): DemoState {
  const next = createProcedureStartState({ conditions: state.conditions });
  return {
    ...next,
    messages: state.messages.map((item) => ({ ...item })),
    memories: state.memories.length > 0 ? state.memories.map((item) => ({ ...item })) : next.memories,
    share: { ...state.share, sharedWithKenichi: true },
    familyJudgment: { ...state.familyJudgment },
    summaryDecision: state.summaryDecision,
    messageSeq: state.messageSeq,
    viewerRole: "family",
    timePassed: true,
  };
}

export function hasFormDateMismatch(state: DemoState): boolean {
  return state.applicationCremationDate !== state.proposedCremationDate;
}

export function isReservationConfirmed(state: DemoState): boolean {
  return state.scheduleStatus === "confirmed";
}

export function isCaseInquiryResolved(state: DemoState): boolean {
  return (
    state.caseInquiry.staffCompleted && state.caseInquiry.municipalityVerified
  );
}

export function isDomicileConfirmed(state: DemoState): boolean {
  return state.domicileStatus === "staff_recorded";
}

export function isNameResolved(state: DemoState): boolean {
  return state.nameCheckStatus === "result_received";
}

export function canSubmitForms(state: DemoState): boolean {
  return (
    state.track === "procedure" &&
    state.scheduleStatus === "confirmed" &&
    state.formStatus === "ready" &&
    isDomicileConfirmed(state) &&
    isNameResolved(state) &&
    !state.caseInquiry.received
  );
}

export function refreshFormStatus(state: DemoState): DemoState {
  if (
    state.formStatus === "submit_requested" ||
    state.formStatus === "submitted"
  ) {
    return state;
  }

  if (hasFormDateMismatch(state)) {
    return state.formStatus === "mismatch" ? state : { ...state, formStatus: "mismatch" };
  }

  if (state.scheduleStatus === "confirmed" && isDomicileConfirmed(state)) {
    return state.formStatus === "ready" ? state : { ...state, formStatus: "ready" };
  }

  if (state.scheduleStatus === "confirmed") {
    return state.formStatus === "updated" ? state : { ...state, formStatus: "updated" };
  }

  return state;
}

export function referenceTotal(state: DemoState): number {
  return calculateReferenceCost(state.conditions).total;
}

export function previousStayReferenceTotal(state: DemoState): number {
  return calculateReferenceCost({
    ...state.conditions,
    stayDays: originalStayDaysForOffer(),
  }).total;
}

export function scheduleStayDaysAfterOffer(): 5 {
  return 5;
}

export function originalStayDaysForOffer(): 4 {
  return 4;
}

export const NEXT_DAY_TOTAL = 710_500;
