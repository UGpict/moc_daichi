import {
  CREMATION_FIRST_DATE,
  DEFAULT_CONDITIONS,
  DEFAULT_DEMO_STATE,
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
    deathCertificate: "received",
    domicileStatus: "ask_family",
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
  };
}

export function beginProcedureFromPrep(state: DemoState): DemoState {
  return createProcedureStartState({ conditions: state.conditions });
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

export function canSubmitForms(state: DemoState): boolean {
  return (
    state.track === "procedure" &&
    state.scheduleStatus === "confirmed" &&
    state.formStatus === "updated" &&
    state.domicileStatus === "family_will_attach" &&
    !state.caseInquiry.received
  );
}

export function referenceTotal(state: DemoState): number {
  return calculateReferenceCost(state.conditions).total;
}

export function scheduleStayDaysAfterOffer(): 5 {
  return 5;
}

export const NEXT_DAY_TOTAL = 710_500;
