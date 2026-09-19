import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyInquiryAction,
  canApplyInquiryAction,
  getCheckItemStatus,
  getDemoProgress,
  hasReceivedFirstReply,
  hasSentFirstInquiry,
} from "./inquiry";
import { createInitialDemoState } from "./storage";
import type { InquiryStatus } from "./types";

describe("inquiry state transitions", () => {
  it("advances only in the demo order and ignores out-of-order actions", () => {
    const flow: Array<[InquiryStatus, Parameters<typeof applyInquiryAction>[1], InquiryStatus]> = [
      ["awaiting_approval", "approve", "awaiting_first_reply"],
      ["awaiting_first_reply", "receive_first", "awaiting_followup_approval"],
      ["awaiting_followup_approval", "approve_followup", "awaiting_followup_reply"],
      ["awaiting_followup_reply", "receive_followup", "answers_confirmed"],
    ];

    for (const [from, action, to] of flow) {
      assert.equal(canApplyInquiryAction(from, action), true);
      assert.equal(applyInquiryAction(from, action), to);
    }

    assert.equal(applyInquiryAction("awaiting_approval", "receive_first"), "awaiting_approval");
    assert.equal(applyInquiryAction("awaiting_approval", "approve_followup"), "awaiting_approval");
    assert.equal(
      applyInquiryAction("awaiting_followup_approval", "approve"),
      "awaiting_followup_approval",
    );
    assert.equal(applyInquiryAction("answers_confirmed", "approve"), "answers_confirmed");
    assert.equal(
      applyInquiryAction("awaiting_first_reply", "approve"),
      "awaiting_first_reply",
    );
  });

  it("does not mark a vague transport reply as confirmed", () => {
    assert.equal(getCheckItemStatus("stay", "awaiting_approval"), "unconfirmed");
    assert.equal(getCheckItemStatus("transport", "awaiting_approval"), "unconfirmed");

    assert.equal(getCheckItemStatus("stay", "awaiting_first_reply"), "waiting");
    assert.equal(getCheckItemStatus("transport", "awaiting_first_reply"), "waiting");

    assert.equal(getCheckItemStatus("stay", "awaiting_followup_approval"), "confirmed");
    assert.equal(getCheckItemStatus("cremation", "awaiting_followup_approval"), "confirmed");
    assert.equal(getCheckItemStatus("food", "awaiting_followup_approval"), "confirmed");
    assert.equal(getCheckItemStatus("transport", "awaiting_followup_approval"), "unconfirmed");

    assert.equal(getCheckItemStatus("transport", "awaiting_followup_reply"), "waiting");
    assert.equal(getCheckItemStatus("transport", "answers_confirmed"), "confirmed");
  });

  it("keeps the home CTA aligned with the current inquiry stage", () => {
    const initial = createInitialDemoState();
    const start = getDemoProgress(initial);
    assert.equal(start.ctaHref, "/demo/estimate");
    assert.equal(start.ctaLabel, "見積もりを見る");
    assert.match(start.headline, /書いていないところ/);

    const reviewed = getDemoProgress({ ...initial, hasReviewedEstimate: true });
    assert.equal(reviewed.ctaHref, "/demo/agent");
    assert.equal(reviewed.ctaLabel, "質問を見て決める");
    assert.match(reviewed.headline, /聞いてよいですか/);

    const waiting = getDemoProgress({
      ...initial,
      hasReviewedEstimate: true,
      inquiryStatus: "awaiting_first_reply",
    });
    assert.equal(waiting.ctaLabel, "返事を見る");
    assert.equal(hasSentFirstInquiry("awaiting_first_reply"), true);
    assert.equal(hasReceivedFirstReply("awaiting_first_reply"), false);

    const needsFollowup = getDemoProgress({
      ...initial,
      hasReviewedEstimate: true,
      inquiryStatus: "awaiting_followup_approval",
    });
    assert.equal(needsFollowup.ctaHref, "/demo/agent");
    assert.match(needsFollowup.headline, /まだ分からない/);

    const confirmed = getDemoProgress({
      ...initial,
      hasReviewedEstimate: true,
      inquiryStatus: "answers_confirmed",
    });
    assert.equal(confirmed.ctaHref, "/demo/summary");
    assert.equal(confirmed.ctaLabel, "子どもに残す一枚を見る");
  });
});
