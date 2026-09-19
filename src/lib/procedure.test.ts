import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateReferenceCost } from "./cost";
import {
  applyDemoEvent,
  applyUserAction,
  canApplyEvent,
  canApplyUserAction,
  canViewEvidence,
  getNextAutoEvent,
} from "./events";
import { getShirubeReport } from "./dashboard";
import {
  canSubmitForms,
  createPrepStartState,
  createProcedureStartState,
  isDomicileConfirmed,
  NEXT_DAY_TOTAL,
} from "./procedure";
import { getProcedureView } from "./procedure-view";
import { CREMATION_FIRST_DATE, CREMATION_NEXT_DATE } from "./sample-data";

function advanceUnknownPath(state = createProcedureStartState()) {
  let next = applyUserAction(state, "choose_domicile_unknown");
  next = applyUserAction(next, "approve_domicile_consult");
  next = applyDemoEvent(next, "receive_domicile_consult_reply");
  next = applyUserAction(next, "acknowledge_domicile_consult");
  next = applyDemoEvent(next, "receive_domicile_recorded");
  return next;
}

function confirmSchedule(state = createProcedureStartState()) {
  let next = applyDemoEvent(state, "receive_schedule_offer");
  next = applyUserAction(next, "approve_schedule_adjust");
  next = applyDemoEvent(next, "receive_schedule_confirm");
  return next;
}

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
    assert.equal(state.domicileStatus, "unknown");
    assert.equal(isDomicileConfirmed(state), false);
  });

  it("asks about domicile first and keeps the two confirmation paths apart", () => {
    const start = createProcedureStartState();
    const view = getProcedureView(start);
    assert.match(view.prompt, /お母さまの本籍/);
    assert.equal(view.choices[0]?.id, "choose_domicile_has_docs");
    assert.equal(view.choices[1]?.id, "choose_domicile_unknown");

    const hasDocs = applyUserAction(start, "choose_domicile_has_docs");
    const unknown = applyUserAction(start, "choose_domicile_unknown");
    assert.equal(hasDocs.domicileStatus, "reviewing_sample");
    assert.equal(unknown.domicileStatus, "consulting");
    assert.equal(canSubmitForms(hasDocs), false);
    assert.equal(canSubmitForms(unknown), false);
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
    const offeredView = getProcedureView(offered);
    assert.match(offeredView.prompt, /お母さまの本籍/);
    assert.match(offeredView.progress.join("\n"), /日程/);
    assert.equal(
      calculateReferenceCost(offered.conditions).total,
      NEXT_DAY_TOTAL,
    );
    assert.equal(canApplyUserAction(offered, "approve_schedule_adjust"), true);
    assert.equal(isReservationLike(offered), false);
    assert.equal(canViewEvidence(offered, "schedule_offer"), true);
    assert.equal(
      canViewEvidence(createProcedureStartState(), "schedule_offer"),
      false,
    );
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
    assert.equal(canSubmitForms(confirmed), false);
  });

  it("keeps a family consultation pause from becoming a reservation", () => {
    const offered = applyDemoEvent(
      createProcedureStartState(),
      "receive_schedule_offer",
    );
    const paused = applyUserAction(offered, "pause_schedule_for_family");
    assert.equal(paused.scheduleStatus, "paused_for_family");
    assert.equal(canApplyEvent(paused, "receive_schedule_confirm"), false);
    assert.equal(getNextAutoEvent(paused), "wait_user");

    const resumed = applyUserAction(paused, "resume_schedule_decision");
    assert.equal(resumed.scheduleStatus, "awaiting_adjust_approval");
    assert.equal(isReservationLike(resumed), false);
  });

  it("does not allow submit until domicile is recorded and staff report submission separately", () => {
    const scheduled = confirmSchedule();
    assert.equal(canSubmitForms(scheduled), false);

    const recorded = advanceUnknownPath(scheduled);
    assert.equal(recorded.domicileStatus, "staff_recorded");
    assert.equal(recorded.formStatus, "ready");
    assert.equal(canSubmitForms(recorded), true);

    const requested = applyUserAction(recorded, "approve_submit");
    assert.equal(requested.formStatus, "submit_requested");
    assert.equal(canApplyEvent(requested, "receive_municipality_inquiry"), false);

    const submitted = applyDemoEvent(requested, "receive_forms_submitted");
    assert.equal(submitted.formStatus, "submitted");
    assert.equal(canApplyEvent(submitted, "receive_municipality_inquiry"), true);
  });

  it("does not resolve a municipality inquiry from a will-handle reply", () => {
    let state = confirmSchedule(advanceUnknownPath());
    assert.equal(canApplyUserAction(state, "approve_submit"), true);
    state = applyUserAction(state, "approve_submit");
    state = applyDemoEvent(state, "receive_forms_submitted");
    state = applyDemoEvent(state, "receive_municipality_inquiry");
    state = applyUserAction(state, "approve_municipality_check");
    state = applyDemoEvent(state, "receive_staff_will_handle");

    assert.equal(state.caseInquiry.staffWillHandle, true);
    assert.equal(state.caseInquiry.staffCompleted, false);
    assert.equal(state.caseInquiry.municipalityVerified, false);
    assert.match(getShirubeReport(state).message, /対応します/);
    assert.match(getProcedureView(state).waiting ?? "", /完了報告を待っています/);
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
    let state = confirmSchedule(advanceUnknownPath());
    state = applyUserAction(state, "approve_submit");
    state = applyDemoEvent(state, "receive_forms_submitted");
    state = applyDemoEvent(state, "receive_municipality_inquiry");
    state = applyUserAction(state, "approve_municipality_check");
    state = applyDemoEvent(state, "receive_staff_completed");
    state = applyDemoEvent(state, "receive_municipality_verified");
    state = applyDemoEvent(state, "receive_permit_issued");
    assert.equal(state.permit.issued, true);
    assert.equal(state.permit.received, false);
    assert.equal(state.permit.handedOver, false);
    assert.equal(canViewEvidence(state, "permit"), true);

    state = applyDemoEvent(state, "receive_permit_received");
    assert.equal(state.permit.received, true);
    assert.equal(state.permit.handedOver, false);

    state = applyDemoEvent(state, "receive_permit_handover");
    assert.equal(state.permit.handedOver, true);
    assert.match(getShirubeReport(state).message, /佐藤さんが受け取り/);
    assert.match(getShirubeReport(state).message, /引渡し/);
    assert.doesNotMatch(getShirubeReport(state).message, /火葬実施済み|葬儀完了/);
  });

  it("stops autoplay planning when a user approval is required, without turning off play mode", () => {
    const prep = createPrepStartState();
    assert.equal(getNextAutoEvent(prep), "wait_user");
    assert.equal(canApplyUserAction(prep, "approve_inquiry"), true);

    const start = createProcedureStartState();
    assert.equal(getNextAutoEvent(start), "receive_schedule_offer");

    const afterOffer = applyDemoEvent(start, "receive_schedule_offer");
    assert.equal(getNextAutoEvent(afterOffer), "wait_user");
    assert.equal(canApplyUserAction(afterOffer, "choose_domicile_unknown"), true);
  });
});

function isReservationLike(state: { scheduleStatus: string }) {
  return state.scheduleStatus === "confirmed";
}
