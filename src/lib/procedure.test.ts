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
import { getRecordRows } from "./case-records";
import {
  canSubmitForms,
  createPrepStartState,
  createProcedureStartState,
  isDomicileConfirmed,
  isNameResolved,
  NEXT_DAY_TOTAL,
} from "./procedure";
import { getProcedureView } from "./procedure-view";
import { CREMATION_FIRST_DATE, CREMATION_NEXT_DATE } from "./sample-data";

function handover(state = createProcedureStartState()) {
  return applyUserAction(state, "report_handover_has_cert");
}

function sendNameCheck(state = createProcedureStartState()) {
  let next = handover(state);
  next = applyUserAction(next, "provide_death_cert");
  next = applyUserAction(next, "approve_name_check");
  next = applyDemoEvent(next, "receive_name_will_handle");
  return next;
}

function confirmSchedule(state = sendNameCheck()) {
  let next = applyDemoEvent(state, "receive_schedule_offer");
  next = applyUserAction(next, "approve_schedule_adjust");
  next = applyDemoEvent(next, "receive_schedule_confirm");
  return next;
}

function resolveNameAndDomicile(state = createProcedureStartState()) {
  let next = confirmSchedule(sendNameCheck(state));
  next = applyDemoEvent(next, "receive_name_result");
  next = applyUserAction(next, "provide_domicile_sample");
  next = applyDemoEvent(next, "receive_domicile_recorded");
  return next;
}

describe("procedure and schedule change", () => {
  it("starts from leftover records and does not re-ask known wishes", () => {
    const state = createProcedureStartState();
    assert.equal(state.track, "procedure");
    assert.equal(state.conditions.stayDays, 4);
    assert.equal(calculateReferenceCost(state.conditions).total, 699_500);
    assert.equal(state.deathCertificate, "unchecked");
    assert.equal(state.handoverHeard, false);
    assert.equal(state.nameCheckStatus, "not_compared");
    assert.equal(isDomicileConfirmed(state), false);

    const view = getProcedureView(state);
    assert.match(view.prompt, /日程は家族に任せる/);
    assert.match(view.prompt, /山田 春子/);
    assert.doesNotMatch(view.prompt, /どんな人に見送ってもらいたい/);
    assert.doesNotMatch(view.prompt, /分かるものはお手元にありますか/);
    assert.equal(view.choices[0]?.id, "report_handover_has_cert");
    assert.equal(getNextAutoEvent(state), "wait_user");
  });

  it("does not auto-correct a name mismatch or resolve it from 確認します", () => {
    let state = handover();
    state = applyUserAction(state, "provide_death_cert");
    assert.equal(state.nameCheckStatus, "mismatch_found");
    const mismatch = getProcedureView(state);
    assert.match(mismatch.prompt, /氏名の表記が異なっています/);
    assert.match(mismatch.detail, /山田 はる子/);
    assert.equal(isNameResolved(state), false);

    const rows = getRecordRows(state);
    const name = rows.find((row) => row.id === "name");
    assert.equal(name?.kind, "mismatch");

    state = applyUserAction(state, "approve_name_check");
    state = applyDemoEvent(state, "receive_name_will_handle");
    assert.equal(state.nameCheckStatus, "will_handle");
    assert.equal(isNameResolved(state), false);
    assert.match(getProcedureView(state).prompt, /確認結果はまだ届いていない/);
    assert.equal(canApplyEvent(state, "receive_name_result"), false);
  });

  it("recalculates cost when the next-day offer arrives after name check is sent", () => {
    const held = sendNameCheck();
    const offered = applyDemoEvent(held, "receive_schedule_offer");

    assert.equal(offered.conditions.stayDays, 5);
    assert.equal(offered.proposedCremationDate, CREMATION_NEXT_DATE);
    assert.equal(offered.applicationCremationDate, CREMATION_FIRST_DATE);
    assert.equal(offered.formStatus, "mismatch");
    assert.equal(offered.scheduleStatus, "awaiting_adjust_approval");
    assert.equal(calculateReferenceCost(offered.conditions).total, NEXT_DAY_TOTAL);
    assert.match(getProcedureView(offered).prompt, /日程は家族に任せる/);
    assert.equal(canApplyUserAction(offered, "approve_schedule_adjust"), true);
    assert.equal(canViewEvidence(offered, "schedule_offer"), true);
    assert.equal(canViewEvidence(createProcedureStartState(), "schedule_offer"), false);
  });

  it("does not treat approval as a reservation, and only confirms after the funeral home report", () => {
    const offered = applyDemoEvent(sendNameCheck(), "receive_schedule_offer");
    const requested = applyUserAction(offered, "approve_schedule_adjust");
    assert.equal(requested.scheduleStatus, "awaiting_confirm");
    assert.equal(canApplyEvent(requested, "receive_schedule_confirm"), true);

    const confirmed = applyDemoEvent(requested, "receive_schedule_confirm");
    assert.equal(confirmed.scheduleStatus, "confirmed");
    assert.equal(confirmed.applicationCremationDate, CREMATION_NEXT_DATE);
    assert.equal(confirmed.formStatus, "updated");
    assert.equal(canSubmitForms(confirmed), false);
    assert.equal(confirmed.nameCheckStatus, "will_handle");
  });

  it("keeps a family consultation pause from becoming a reservation", () => {
    const offered = applyDemoEvent(sendNameCheck(), "receive_schedule_offer");
    const paused = applyUserAction(offered, "pause_schedule_for_family");
    assert.equal(paused.scheduleStatus, "paused_for_family");
    assert.equal(canApplyEvent(paused, "receive_schedule_confirm"), false);
    assert.equal(getNextAutoEvent(paused), "wait_user");

    const resumed = applyUserAction(paused, "resume_schedule_decision");
    assert.equal(resumed.scheduleStatus, "awaiting_adjust_approval");
  });

  it("does not allow submit until name and domicile are recorded, and splits submit request from staff report", () => {
    const scheduled = confirmSchedule();
    assert.equal(canSubmitForms(scheduled), false);

    const recorded = resolveNameAndDomicile();
    assert.equal(recorded.nameCheckStatus, "result_received");
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
    let state = resolveNameAndDomicile();
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
    let state = resolveNameAndDomicile();
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
    assert.equal(getNextAutoEvent(start), "wait_user");

    const afterName = sendNameCheck();
    assert.equal(getNextAutoEvent(afterName), "receive_schedule_offer");

    const afterOffer = applyDemoEvent(afterName, "receive_schedule_offer");
    assert.equal(getNextAutoEvent(afterOffer), "wait_user");
    assert.equal(canApplyUserAction(afterOffer, "approve_schedule_adjust"), true);
  });
});
