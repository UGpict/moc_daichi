import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateReferenceCost } from "./cost";
import {
  applyDemoEvent,
  applyUserAction,
  canApplyEvent,
  canApplyUserAction,
  getNextAutoEvent,
} from "./events";
import { getShirubeReport } from "./dashboard";
import {
  createPrepStartState,
  createProcedureStartState,
  NEXT_DAY_TOTAL,
} from "./procedure";
import { CREMATION_FIRST_DATE, CREMATION_NEXT_DATE } from "./sample-data";

describe("procedure and schedule change", () => {
  it("starts the handover sample at 4 days and 699,500 yen", () => {
    const state = createProcedureStartState();
    assert.equal(state.track, "procedure");
    assert.equal(state.inquiryStatus, "answers_confirmed");
    assert.equal(state.conditions.stayDays, 4);
    assert.equal(state.scheduleStatus, "adjusting");
    assert.equal(state.formStatus, "drafted");
    assert.equal(state.applicationCremationDate, CREMATION_FIRST_DATE);
    assert.equal(calculateReferenceCost(state.conditions).total, 699_500);
    assert.equal(state.deathCertificate, "received");
    assert.equal(state.domicileStatus, "ask_family");
  });

  it("recalculates cost and detects a form mismatch when the next-day offer arrives", () => {
    const offered = applyDemoEvent(
      createProcedureStartState(),
      "receive_schedule_offer",
    );

    assert.equal(offered.conditions.stayDays, 5);
    assert.equal(offered.proposedCremationDate, CREMATION_NEXT_DATE);
    assert.equal(offered.applicationCremationDate, CREMATION_FIRST_DATE);
    assert.equal(offered.formStatus, "mismatch");
    assert.equal(offered.scheduleStatus, "awaiting_adjust_approval");
    assert.equal(calculateReferenceCost(offered.conditions).total, NEXT_DAY_TOTAL);
    assert.equal(NEXT_DAY_TOTAL, 710_500);
    assert.match(getShirubeReport(offered).message, /710,500円/);
    assert.equal(canApplyUserAction(offered, "approve_schedule_adjust"), true);
    assert.equal(isReservationLike(offered), false);
  });

  it("does not treat approval as a reservation, and only confirms after the funeral home report", () => {
    const offered = applyDemoEvent(
      createProcedureStartState(),
      "receive_schedule_offer",
    );
    const requested = applyUserAction(offered, "approve_schedule_adjust");
    assert.equal(requested.scheduleStatus, "awaiting_confirm");
    assert.equal(canApplyEvent(requested, "receive_schedule_confirm"), true);

    const confirmed = applyDemoEvent(requested, "receive_schedule_confirm");
    assert.equal(confirmed.scheduleStatus, "confirmed");
    assert.equal(confirmed.applicationCremationDate, CREMATION_NEXT_DATE);
    assert.equal(confirmed.formStatus, "updated");
  });

  it("does not resolve a municipality inquiry from a will-handle reply", () => {
    let state = createProcedureStartState();
    state = applyDemoEvent(state, "receive_family_domicile");
    state = applyDemoEvent(state, "receive_schedule_offer");
    state = applyUserAction(state, "approve_schedule_adjust");
    state = applyDemoEvent(state, "receive_schedule_confirm");
    assert.equal(canApplyUserAction(state, "approve_submit"), true);
    state = applyUserAction(state, "approve_submit");
    state = applyDemoEvent(state, "receive_municipality_inquiry");
    state = applyUserAction(state, "approve_municipality_check");
    state = applyDemoEvent(state, "receive_staff_will_handle");

    assert.equal(state.caseInquiry.staffWillHandle, true);
    assert.equal(state.caseInquiry.staffCompleted, false);
    assert.equal(state.caseInquiry.municipalityVerified, false);
    assert.match(getShirubeReport(state).message, /完了報告を待っています/);
    assert.equal(canApplyEvent(state, "receive_municipality_verified"), false);

    const completed = applyDemoEvent(state, "receive_staff_completed");
    assert.equal(completed.caseInquiry.staffCompleted, true);
    assert.equal(completed.caseInquiry.municipalityVerified, false);
    assert.equal(canApplyEvent(completed, "receive_permit_issued"), false);

    const verified = applyDemoEvent(completed, "receive_municipality_verified");
    assert.equal(verified.caseInquiry.municipalityVerified, true);
    assert.equal(canApplyEvent(verified, "receive_permit_issued"), true);
  });

  it("keeps permit issuance, receipt, and handover independent", () => {
    let state = createProcedureStartState();
    for (const event of [
      "receive_family_domicile",
      "receive_schedule_offer",
    ] as const) {
      state = applyDemoEvent(state, event);
    }
    state = applyUserAction(state, "approve_schedule_adjust");
    state = applyDemoEvent(state, "receive_schedule_confirm");
    state = applyUserAction(state, "approve_submit");
    state = applyDemoEvent(state, "receive_municipality_inquiry");
    state = applyUserAction(state, "approve_municipality_check");
    state = applyDemoEvent(state, "receive_staff_completed");
    state = applyDemoEvent(state, "receive_municipality_verified");
    state = applyDemoEvent(state, "receive_permit_issued");
    assert.equal(state.permit.issued, true);
    assert.equal(state.permit.received, false);
    assert.equal(state.permit.handedOver, false);

    state = applyDemoEvent(state, "receive_permit_received");
    assert.equal(state.permit.received, true);
    assert.equal(state.permit.handedOver, false);

    state = applyDemoEvent(state, "receive_permit_handover");
    assert.equal(state.permit.handedOver, true);
    assert.match(getShirubeReport(state).message, /引渡しを確認しました/);
    assert.doesNotMatch(getShirubeReport(state).message, /火葬実施済み|葬儀完了/);
  });

  it("stops autoplay planning when a user approval is required", () => {
    const prep = createPrepStartState();
    assert.equal(getNextAutoEvent(prep), "wait_user");
    assert.equal(canApplyUserAction(prep, "approve_inquiry"), true);

    const afterOffer = applyDemoEvent(
      createProcedureStartState(),
      "receive_schedule_offer",
    );
    assert.equal(getNextAutoEvent(afterOffer), "receive_family_domicile");
    const readyToApprove = applyDemoEvent(afterOffer, "receive_family_domicile");
    assert.equal(getNextAutoEvent(readyToApprove), "wait_user");
  });
});

function isReservationLike(state: { scheduleStatus: string }) {
  return state.scheduleStatus === "confirmed";
}
