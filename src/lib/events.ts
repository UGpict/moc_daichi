import { advanceTalkAfterInquiry } from "./conversation";
import { calculateReferenceCost } from "./cost";
import { applyInquiryAction, canApplyInquiryAction } from "./inquiry";
import {
  canSubmitForms,
  hasFormDateMismatch,
  originalStayDaysForOffer,
  refreshFormStatus,
  scheduleStayDaysAfterOffer,
} from "./procedure";
import { CREMATION_NEXT_DATE, REPLY_DELAY_MS } from "./sample-data";
import type { DemoEventId, DemoState, EvidenceId, UserActionId } from "./types";

export function hasEvent(state: DemoState, id: DemoEventId): boolean {
  return state.appliedEventIds.includes(id);
}

function withEvent(state: DemoState, id: DemoEventId): DemoState {
  if (hasEvent(state, id)) {
    return state;
  }
  return { ...state, appliedEventIds: [...state.appliedEventIds, id] };
}

export function canApplyEvent(state: DemoState, id: DemoEventId): boolean {
  if (hasEvent(state, id)) {
    return false;
  }

  switch (id) {
    case "receive_first_reply":
      return state.inquiryStatus === "awaiting_first_reply";
    case "receive_followup_reply":
      return state.inquiryStatus === "awaiting_followup_reply";
    case "receive_schedule_offer":
      return (
        state.scheduleStatus === "adjusting" &&
        state.handoverHeard &&
        (state.nameCheckStatus === "awaiting_reply" ||
          state.nameCheckStatus === "will_handle" ||
          state.nameCheckStatus === "result_received")
      );
    case "receive_schedule_confirm":
      return state.scheduleStatus === "awaiting_confirm";
    case "receive_name_will_handle":
      return state.nameCheckStatus === "awaiting_reply";
    case "receive_name_result":
      return (
        state.nameCheckStatus === "will_handle" &&
        state.scheduleStatus === "confirmed"
      );
    case "receive_domicile_consult_reply":
      return state.domicileStatus === "consulting_sent";
    case "receive_domicile_recorded":
      return (
        state.domicileStatus === "sample_provided" ||
        state.domicileStatus === "consult_acknowledged"
      );
    case "receive_forms_submitted":
      return state.formStatus === "submit_requested";
    case "receive_municipality_inquiry":
      return state.formStatus === "submitted" && !state.caseInquiry.received;
    case "receive_staff_will_handle":
      return (
        state.caseInquiry.checkSent &&
        !state.caseInquiry.staffWillHandle &&
        !state.caseInquiry.staffCompleted
      );
    case "receive_staff_completed":
      return state.caseInquiry.checkSent && !state.caseInquiry.staffCompleted;
    case "receive_municipality_verified":
      return (
        state.caseInquiry.received &&
        state.caseInquiry.staffCompleted &&
        !state.caseInquiry.municipalityVerified
      );
    case "receive_permit_issued":
      return state.caseInquiry.municipalityVerified && !state.permit.issued;
    case "receive_permit_received":
      return state.permit.issued && !state.permit.received;
    case "receive_permit_handover":
      return state.permit.received && !state.permit.handedOver;
  }
}

export function applyDemoEvent(state: DemoState, id: DemoEventId): DemoState {
  if (!canApplyEvent(state, id)) {
    return state;
  }

  const marked = withEvent(state, id);

  switch (id) {
    case "receive_first_reply":
      return advanceTalkAfterInquiry({
        ...marked,
        inquiryStatus: applyInquiryAction(state.inquiryStatus, "receive_first"),
        firstReplyDueAt: null,
      });
    case "receive_followup_reply":
      return advanceTalkAfterInquiry({
        ...marked,
        inquiryStatus: applyInquiryAction(
          state.inquiryStatus,
          "receive_followup",
        ),
        followupReplyDueAt: null,
      });
    case "receive_schedule_offer": {
      const stayDays = scheduleStayDaysAfterOffer();
      const next = {
        ...marked,
        scheduleStatus: "awaiting_adjust_approval" as const,
        proposedCremationDate: CREMATION_NEXT_DATE,
        conditions: { ...state.conditions, stayDays },
      };
      return refreshFormStatus({
        ...next,
        formStatus: hasFormDateMismatch(next) ? "mismatch" : next.formStatus,
      });
    }
    case "receive_schedule_confirm":
      return refreshFormStatus({
        ...marked,
        scheduleStatus: "confirmed",
        applicationCremationDate: state.proposedCremationDate,
        formStatus: "updated",
      });
    case "receive_name_will_handle":
      return {
        ...marked,
        nameCheckStatus: "will_handle",
      };
    case "receive_name_result":
      return {
        ...marked,
        nameCheckStatus: "result_received",
      };
    case "receive_domicile_consult_reply":
      return refreshFormStatus({
        ...marked,
        domicileStatus: "consult_replied",
      });
    case "receive_domicile_recorded":
      return refreshFormStatus({
        ...marked,
        domicileStatus: "staff_recorded",
      });
    case "receive_forms_submitted":
      return { ...marked, formStatus: "submitted" };
    case "receive_municipality_inquiry":
      return {
        ...marked,
        caseInquiry: { ...state.caseInquiry, received: true },
      };
    case "receive_staff_will_handle":
      return {
        ...marked,
        caseInquiry: { ...state.caseInquiry, staffWillHandle: true },
      };
    case "receive_staff_completed":
      return {
        ...marked,
        caseInquiry: {
          ...state.caseInquiry,
          staffWillHandle: true,
          staffCompleted: true,
        },
      };
    case "receive_municipality_verified":
      return {
        ...marked,
        caseInquiry: { ...state.caseInquiry, municipalityVerified: true },
      };
    case "receive_permit_issued":
      return { ...marked, permit: { ...state.permit, issued: true } };
    case "receive_permit_received":
      return { ...marked, permit: { ...state.permit, received: true } };
    case "receive_permit_handover":
      return { ...marked, permit: { ...state.permit, handedOver: true } };
  }
}

export function canApplyUserAction(
  state: DemoState,
  action: UserActionId,
): boolean {
  switch (action) {
    case "approve_inquiry":
      return canApplyInquiryAction(state.inquiryStatus, "approve");
    case "approve_followup":
      return canApplyInquiryAction(state.inquiryStatus, "approve_followup");
    case "report_handover_has_cert":
    case "report_handover_none":
      return state.track === "procedure" && !state.handoverHeard;
    case "provide_death_cert":
      return (
        state.track === "procedure" &&
        state.handoverHeard &&
        state.nameCheckStatus === "not_compared"
      );
    case "approve_name_check":
      return state.nameCheckStatus === "mismatch_found";
    case "choose_domicile_has_docs":
      return state.track === "procedure" && state.domicileStatus === "unknown";
    case "choose_domicile_unknown":
      return state.track === "procedure" && state.domicileStatus === "unknown";
    case "provide_domicile_sample":
      return (
        state.domicileStatus === "reviewing_sample" &&
        state.nameCheckStatus === "result_received"
      );
    case "approve_domicile_consult":
      return state.domicileStatus === "consulting";
    case "acknowledge_domicile_consult":
      return state.domicileStatus === "consult_replied";
    case "approve_schedule_adjust":
      return state.scheduleStatus === "awaiting_adjust_approval";
    case "pause_schedule_for_family":
      return state.scheduleStatus === "awaiting_adjust_approval";
    case "resume_schedule_decision":
      return state.scheduleStatus === "paused_for_family";
    case "approve_submit":
      return canSubmitForms(state);
    case "approve_municipality_check":
      return state.caseInquiry.received && !state.caseInquiry.checkApproved;
  }
}

export function applyUserAction(
  state: DemoState,
  action: UserActionId,
  now = Date.now(),
): DemoState {
  if (!canApplyUserAction(state, action)) {
    return state;
  }

  switch (action) {
    case "approve_inquiry":
      return {
        ...state,
        hasReviewedEstimate: true,
        inquiryStatus: applyInquiryAction(state.inquiryStatus, "approve"),
        firstReplyDueAt: now + REPLY_DELAY_MS,
      };
    case "approve_followup":
      return {
        ...state,
        inquiryStatus: applyInquiryAction(
          state.inquiryStatus,
          "approve_followup",
        ),
        followupReplyDueAt: now + REPLY_DELAY_MS,
      };
    case "report_handover_has_cert":
      return { ...state, handoverHeard: true };
    case "report_handover_none":
      return { ...state, handoverHeard: true };
    case "provide_death_cert":
      return {
        ...state,
        deathCertificate: "received",
        nameCheckStatus: "mismatch_found",
      };
    case "approve_name_check":
      return { ...state, nameCheckStatus: "awaiting_reply" };
    case "choose_domicile_has_docs":
      return { ...state, domicileStatus: "reviewing_sample" };
    case "choose_domicile_unknown":
      return { ...state, domicileStatus: "consulting" };
    case "provide_domicile_sample":
      return refreshFormStatus({ ...state, domicileStatus: "sample_provided" });
    case "approve_domicile_consult":
      return { ...state, domicileStatus: "consulting_sent" };
    case "acknowledge_domicile_consult":
      return refreshFormStatus({
        ...state,
        domicileStatus: "consult_acknowledged",
      });
    case "approve_schedule_adjust":
      return { ...state, scheduleStatus: "awaiting_confirm" };
    case "pause_schedule_for_family":
      return { ...state, scheduleStatus: "paused_for_family" };
    case "resume_schedule_decision":
      return { ...state, scheduleStatus: "awaiting_adjust_approval" };
    case "approve_submit":
      return { ...state, formStatus: "submit_requested" };
    case "approve_municipality_check":
      return {
        ...state,
        caseInquiry: {
          ...state.caseInquiry,
          checkApproved: true,
          checkSent: true,
        },
      };
  }
}

const AUTOMATIC_EVENTS: DemoEventId[] = [
  "receive_first_reply",
  "receive_followup_reply",
  "receive_name_will_handle",
  "receive_schedule_offer",
  "receive_schedule_confirm",
  "receive_name_result",
  "receive_domicile_consult_reply",
  "receive_domicile_recorded",
  "receive_forms_submitted",
  "receive_municipality_inquiry",
  "receive_staff_will_handle",
  "receive_staff_completed",
  "receive_municipality_verified",
  "receive_permit_issued",
  "receive_permit_received",
  "receive_permit_handover",
];

const WAIT_USER_ACTIONS: UserActionId[] = [
  "approve_inquiry",
  "approve_followup",
  "report_handover_has_cert",
  "report_handover_none",
  "provide_death_cert",
  "approve_name_check",
  "choose_domicile_has_docs",
  "choose_domicile_unknown",
  "provide_domicile_sample",
  "approve_domicile_consult",
  "acknowledge_domicile_consult",
  "approve_schedule_adjust",
  "pause_schedule_for_family",
  "resume_schedule_decision",
  "approve_submit",
  "approve_municipality_check",
];

export function getNextAutoEvent(
  state: DemoState,
): DemoEventId | "wait_user" | null {
  for (const id of AUTOMATIC_EVENTS) {
    if (canApplyEvent(state, id)) {
      return id;
    }
  }

  if (WAIT_USER_ACTIONS.some((action) => canApplyUserAction(state, action))) {
    return "wait_user";
  }

  return null;
}

export function dueExternalEvent(
  state: DemoState,
  now = Date.now(),
): DemoEventId | null {
  if (
    state.inquiryStatus === "awaiting_first_reply" &&
    (state.firstReplyDueAt ?? 0) <= now &&
    canApplyEvent(state, "receive_first_reply")
  ) {
    return "receive_first_reply";
  }
  if (
    state.inquiryStatus === "awaiting_followup_reply" &&
    (state.followupReplyDueAt ?? 0) <= now &&
    canApplyEvent(state, "receive_followup_reply")
  ) {
    return "receive_followup_reply";
  }
  return null;
}

export function nextDayReferenceTotal(state: DemoState): number {
  return calculateReferenceCost({
    ...state.conditions,
    stayDays: scheduleStayDaysAfterOffer(),
  }).total;
}

export function previousStayReferenceTotal(state: DemoState): number {
  return calculateReferenceCost({
    ...state.conditions,
    stayDays: originalStayDaysForOffer(),
  }).total;
}

export function canViewEvidence(state: DemoState, id: EvidenceId): boolean {
  switch (id) {
    case "estimate":
      return state.hasReviewedEstimate;
    case "first_reply":
      return hasEvent(state, "receive_first_reply");
    case "followup_reply":
      return hasEvent(state, "receive_followup_reply");
    case "schedule_offer":
      return hasEvent(state, "receive_schedule_offer");
    case "death_certificate":
      return state.deathCertificate === "received";
    case "name_memo":
      return state.track === "procedure";
    case "name_will_handle":
      return hasEvent(state, "receive_name_will_handle");
    case "name_result":
      return hasEvent(state, "receive_name_result");
    case "municipality_inquiry":
      return state.caseInquiry.received;
    case "staff_will_handle":
      return state.caseInquiry.staffWillHandle;
    case "staff_completed":
      return state.caseInquiry.staffCompleted;
    case "municipality_verified":
      return state.caseInquiry.municipalityVerified;
    case "permit":
      return state.permit.issued;
  }
}

export const PROCEDURE_USER_ACTIONS: UserActionId[] = [
  "report_handover_has_cert",
  "report_handover_none",
  "provide_death_cert",
  "approve_name_check",
  "choose_domicile_has_docs",
  "choose_domicile_unknown",
  "provide_domicile_sample",
  "approve_domicile_consult",
  "acknowledge_domicile_consult",
  "approve_schedule_adjust",
  "pause_schedule_for_family",
  "resume_schedule_decision",
  "approve_submit",
  "approve_municipality_check",
];
