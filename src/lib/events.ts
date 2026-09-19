import { calculateReferenceCost } from "./cost";
import { applyInquiryAction, canApplyInquiryAction } from "./inquiry";
import {
  canSubmitForms,
  hasFormDateMismatch,
  scheduleStayDaysAfterOffer,
} from "./procedure";
import { CREMATION_NEXT_DATE, REPLY_DELAY_MS } from "./sample-data";
import type { DemoEventId, DemoState, UserActionId } from "./types";

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
    case "receive_family_domicile":
      return (
        state.track === "procedure" && state.domicileStatus === "ask_family"
      );
    case "receive_schedule_offer":
      return state.scheduleStatus === "adjusting";
    case "receive_schedule_confirm":
      return state.scheduleStatus === "awaiting_confirm";
    case "receive_municipality_inquiry":
      return state.formStatus === "submitted" && !state.caseInquiry.received;
    case "receive_staff_will_handle":
      return (
        state.caseInquiry.checkSent &&
        !state.caseInquiry.staffWillHandle &&
        !state.caseInquiry.staffCompleted
      );
    case "receive_staff_completed":
      return (
        state.caseInquiry.checkSent && !state.caseInquiry.staffCompleted
      );
    case "receive_municipality_verified":
      return (
        state.caseInquiry.received &&
        state.caseInquiry.staffCompleted &&
        !state.caseInquiry.municipalityVerified
      );
    case "receive_permit_issued":
      return (
        state.caseInquiry.municipalityVerified && !state.permit.issued
      );
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
      return {
        ...marked,
        inquiryStatus: applyInquiryAction(state.inquiryStatus, "receive_first"),
        firstReplyDueAt: null,
      };
    case "receive_followup_reply":
      return {
        ...marked,
        inquiryStatus: applyInquiryAction(
          state.inquiryStatus,
          "receive_followup",
        ),
        followupReplyDueAt: null,
      };
    case "receive_family_domicile":
      return { ...marked, domicileStatus: "family_will_attach" };
    case "receive_schedule_offer": {
      const stayDays = scheduleStayDaysAfterOffer();
      const next = {
        ...marked,
        scheduleStatus: "awaiting_adjust_approval" as const,
        proposedCremationDate: CREMATION_NEXT_DATE,
        conditions: { ...state.conditions, stayDays },
      };
      return {
        ...next,
        formStatus: hasFormDateMismatch(next) ? "mismatch" : next.formStatus,
      };
    }
    case "receive_schedule_confirm":
      return {
        ...marked,
        scheduleStatus: "confirmed",
        applicationCremationDate: state.proposedCremationDate,
        formStatus: "updated",
      };
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
    case "approve_schedule_adjust":
      return state.scheduleStatus === "awaiting_adjust_approval";
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
    case "approve_schedule_adjust":
      return { ...state, scheduleStatus: "awaiting_confirm" };
    case "approve_submit":
      return { ...state, formStatus: "submitted" };
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

export function getNextAutoEvent(state: DemoState): DemoEventId | "wait_user" | null {
  const automatic: DemoEventId[] = [
    "receive_first_reply",
    "receive_followup_reply",
    "receive_family_domicile",
    "receive_schedule_offer",
    "receive_schedule_confirm",
    "receive_municipality_inquiry",
    "receive_staff_will_handle",
    "receive_staff_completed",
    "receive_municipality_verified",
    "receive_permit_issued",
    "receive_permit_received",
    "receive_permit_handover",
  ];

  for (const id of automatic) {
    if (canApplyEvent(state, id)) {
      return id;
    }
  }

  if (
    canApplyUserAction(state, "approve_inquiry") ||
    canApplyUserAction(state, "approve_followup") ||
    canApplyUserAction(state, "approve_schedule_adjust") ||
    canApplyUserAction(state, "approve_submit") ||
    canApplyUserAction(state, "approve_municipality_check")
  ) {
    return "wait_user";
  }

  return null;
}

export function dueExternalEvent(state: DemoState, now = Date.now()): DemoEventId | null {
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
