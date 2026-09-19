import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySummaryDecision,
  applyTalkInput,
  buildFamilyScheduleProposal,
  completeShare,
  familyCanSeePrivateConsult,
  getSharedMemories,
  getTalkView,
  getWishSummary,
  hasConfirmedDirectBurial,
  MEMORY_IDS,
  switchToFamilyView,
} from "./conversation";
import { applyDemoEvent, applyUserAction } from "./events";
import { createPrepStartState } from "./procedure";
import { CREMATION_FIRST_DATE, CREMATION_NEXT_DATE } from "./sample-data";

function talkToSummary() {
  let state = createPrepStartState();
  state = applyTalkInput(state, "burden");
  state = applyTalkInput(state, "choices");
  state = applyTalkInput(state, "family_only");
  state = applyTalkInput(state, "family_decides");
  state = applyTalkInput(state, "modest");
  return state;
}

describe("conversation-first mother flow", () => {
  it("asks one question at a time and accepts 今日はここまで", () => {
    let state = createPrepStartState();
    const opening = getTalkView(state);
    assert.equal(opening.chips.filter((chip) => chip.id !== "stop").length, 1);

    state = applyTalkInput(state, "子どもには迷惑をかけたくないんだけど、何をしておけばいいの？");
    assert.equal(state.talkStep, "clarify_burden");
    assert.equal(getTalkView(state).chips.some((chip) => chip.id === "choices"), true);

    state = applyTalkInput(state, "stop");
    assert.equal(state.talkStep, "paused");
    assert.match(getTalkView(state).chips[0]?.label ?? "", /続き/);
  });

  it("does not confirm 直葬 from 質素でいい", () => {
    const state = talkToSummary();
    const modest = state.memories.find((item) => item.id === MEMORY_IDS.saidModest);
    const interp = state.memories.find((item) => item.id === MEMORY_IDS.interpModest);
    assert.equal(modest?.text, "質素でいい");
    assert.match(interp?.text ?? "", /形式は未確定/);
    assert.equal(hasConfirmedDirectBurial(state), false);
    assert.equal(
      state.memories.some((item) => /直葬/.test(item.text) && item.kind === "confirmed"),
      false,
    );
  });

  it("keeps まだ決めない playable and does not lock confirmed wishes", () => {
    const deferred = applySummaryDecision(talkToSummary(), "deferred");
    assert.equal(deferred.summaryDecision, "deferred");
    assert.equal(deferred.talkStep, "inquiry_offer");
    assert.equal(
      deferred.memories.some((item) => item.kind === "confirmed"),
      false,
    );
    const view = getTalkView(deferred);
    assert.match(view.prompt, /確認してもよいですか/);
  });

  it("promotes interpretations only after 合っている", () => {
    const confirmed = applySummaryDecision(talkToSummary(), "confirmed");
    assert.equal(confirmed.summaryDecision, "confirmed");
    assert.ok(confirmed.memories.some((item) => item.id === MEMORY_IDS.confirmedSchedule));
    assert.ok(
      confirmed.memories.some(
        (item) => item.id === MEMORY_IDS.confirmedSchedule && item.text.includes("任せる"),
      ),
    );
    assert.ok(confirmed.memories.some((item) => item.id === MEMORY_IDS.confirmedWho));
  });

  it("lets a correction change later wishes without inventing 直葬", () => {
    let state = applySummaryDecision(talkToSummary(), "confirmed");
    state = applySummaryDecision(state, "correct");
    assert.equal(state.talkStep, "correct_who");
    state = applyTalkInput(state, "close_friends");
    state = applyTalkInput(state, "family_decides");
    const who = state.memories.find((item) => item.id === MEMORY_IDS.saidWho);
    assert.match(who?.text ?? "", /親しい人/);
    assert.equal(hasConfirmedDirectBurial(state), false);
  });
});

describe("share and family memory", () => {
  it("hides private consults from the family view by default", () => {
    const confirmed = applySummaryDecision(talkToSummary(), "confirmed");
    assert.ok(confirmed.memories.some((item) => item.private));
    assert.equal(confirmed.share.includePrivate, false);
    assert.equal(familyCanSeePrivateConsult(confirmed), false);
    assert.equal(
      getSharedMemories(confirmed).some((item) => item.private),
      false,
    );
  });

  it("uses confirmed 日程は家族に任せる as the reason for a post-death proposal", () => {
    let state = applySummaryDecision(talkToSummary(), "confirmed");
    state = completeShare(state);
    state = switchToFamilyView(state);
    assert.equal(state.viewerRole, "family");
    assert.equal(state.timePassed, true);
    assert.match(state.messages.at(-1)?.text ?? "", /確認しています/);
    assert.doesNotMatch(state.messages.at(-1)?.text ?? "", /ならこう望む/);

    state = applyTalkInput(state, "none");
    state = applyTalkInput(state, "apr16_evening");
    const proposal = buildFamilyScheduleProposal(state);
    assert.equal(proposal.date, CREMATION_NEXT_DATE);
    assert.match(proposal.reason, /日程は家族に任せる/);
    assert.match(proposal.reason, /確認しています/);
    assert.doesNotMatch(proposal.reason, /ならこう望む/);
  });

  it("changes the proposal when the family corrects the arrival time", () => {
    let state = applySummaryDecision(talkToSummary(), "confirmed");
    state = switchToFamilyView(completeShare(state));
    state = applyTalkInput(state, "none");
    state = applyTalkInput(state, "apr16_evening");
    assert.equal(buildFamilyScheduleProposal(state).date, CREMATION_NEXT_DATE);

    state = applyTalkInput(state, "correct");
    state = applyTalkInput(state, "apr16_morning");
    const proposal = buildFamilyScheduleProposal(state);
    assert.equal(proposal.date, CREMATION_FIRST_DATE);
    assert.equal(state.familyJudgment.arrival, "apr16_morning");
    const said = state.memories.find((item) => item.id === MEMORY_IDS.saidSchedule);
    assert.equal(said?.text, "日程は家族に任せる");
  });

  it("shows a conflict without forcing a conclusion when relatives are added", () => {
    let state = applySummaryDecision(talkToSummary(), "confirmed");
    state = switchToFamilyView(completeShare(state));
    state = applyTalkInput(state, "none");
    state = applyTalkInput(state, "apr16_evening");
    state = applyTalkInput(state, "correct");
    state = applyTalkInput(state, "relatives");
    const proposal = buildFamilyScheduleProposal(state);
    assert.match(proposal.conflict ?? "", /家族だけ/);
    assert.ok(proposal.alternatives.length >= 2);
    assert.equal(state.familyJudgment.wantsRelatives, true);
    const motherWho = state.memories.find((item) => item.id === MEMORY_IDS.saidWho);
    assert.equal(motherWho?.text, "家族だけ");
  });

  it("records funeral-home replies as external facts, not as Shirube confirmations", () => {
    let state = applySummaryDecision(talkToSummary(), "confirmed");
    state = applyTalkInput(state, "approve_inquiry");
    state = applyUserAction(state, "approve_inquiry");
    state = applyDemoEvent(state, "receive_first_reply");
    const summary = getWishSummary(state);
    assert.ok(summary.externalFacts.some((item) => /安置延長/.test(item)));
    assert.ok(summary.externalFacts.some((item) => /未解決/.test(item)));
    assert.equal(state.talkStep, "inquiry_followup");

    state = applyTalkInput(state, "approve_followup");
    state = applyUserAction(state, "approve_followup");
    state = applyDemoEvent(state, "receive_followup_reply");
    assert.equal(state.talkStep, "share");
    assert.ok(
      getWishSummary(state).externalFacts.some((item) => /20km超/.test(item)),
    );
  });
});
