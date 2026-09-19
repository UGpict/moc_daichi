import {
  INQUIRY_STATUSES,
  type CheckItemId,
  type DemoState,
  type InquiryStatus,
  type ItemReviewStatus,
  type ProgressStep,
} from "./types";

export type InquiryAction =
  | "approve"
  | "receive_first"
  | "approve_followup"
  | "receive_followup";

const ACTION_RESULT: Record<InquiryAction, InquiryStatus> = {
  approve: "awaiting_first_reply",
  receive_first: "awaiting_followup_approval",
  approve_followup: "awaiting_followup_reply",
  receive_followup: "answers_confirmed",
};

const ACTION_REQUIRED: Record<InquiryAction, InquiryStatus> = {
  approve: "awaiting_approval",
  receive_first: "awaiting_first_reply",
  approve_followup: "awaiting_followup_approval",
  receive_followup: "awaiting_followup_reply",
};

export function canApplyInquiryAction(
  status: InquiryStatus,
  action: InquiryAction,
): boolean {
  return status === ACTION_REQUIRED[action];
}

export function applyInquiryAction(
  status: InquiryStatus,
  action: InquiryAction,
): InquiryStatus {
  if (!canApplyInquiryAction(status, action)) {
    return status;
  }

  return ACTION_RESULT[action];
}

export function inquiryIndex(status: InquiryStatus): number {
  return INQUIRY_STATUSES.indexOf(status);
}

export function getCheckItemStatus(
  itemId: CheckItemId,
  inquiryStatus: InquiryStatus,
): ItemReviewStatus {
  if (itemId === "transport") {
    switch (inquiryStatus) {
      case "awaiting_approval":
        return "unconfirmed";
      case "awaiting_first_reply":
        return "waiting";
      case "awaiting_followup_approval":
        return "unconfirmed";
      case "awaiting_followup_reply":
        return "waiting";
      case "answers_confirmed":
        return "confirmed";
    }
  }

  switch (inquiryStatus) {
    case "awaiting_approval":
      return "unconfirmed";
    case "awaiting_first_reply":
      return "waiting";
    case "awaiting_followup_approval":
    case "awaiting_followup_reply":
    case "answers_confirmed":
      return "confirmed";
  }
}

export function areAnswersConfirmed(status: InquiryStatus): boolean {
  return status === "answers_confirmed";
}

export function hasSentFirstInquiry(status: InquiryStatus): boolean {
  return inquiryIndex(status) >= inquiryIndex("awaiting_first_reply");
}

export function hasReceivedFirstReply(status: InquiryStatus): boolean {
  return inquiryIndex(status) >= inquiryIndex("awaiting_followup_approval");
}

export function hasSentFollowup(status: InquiryStatus): boolean {
  return inquiryIndex(status) >= inquiryIndex("awaiting_followup_reply");
}

export function hasReceivedFollowup(status: InquiryStatus): boolean {
  return status === "answers_confirmed";
}

export function isWaitingForReply(status: InquiryStatus): boolean {
  return (
    status === "awaiting_first_reply" || status === "awaiting_followup_reply"
  );
}

export function getDemoProgress(state: DemoState): {
  steps: ProgressStep[];
  headline: string;
  ctaLabel: string;
  ctaHref: "/demo/estimate" | "/demo/agent" | "/demo/summary" | "/demo/family";
} {
  const { inquiryStatus, hasReviewedEstimate, hasViewedFamily } = state;
  const inquiryStarted = inquiryStatus !== "awaiting_approval";
  const confirmed = areAnswersConfirmed(inquiryStatus);

  const estimateDone = hasReviewedEstimate || inquiryStarted;
  const inquiryDone = confirmed;
  const familyDone = hasViewedFamily;

  const steps: ProgressStep[] = [
    {
      id: "wishes",
      label: "希望を整理",
      status: "done",
      statusLabel: "確認済み",
    },
    {
      id: "estimate",
      label: "見積もりを確認",
      status: estimateDone ? "done" : "current",
      statusLabel: estimateDone ? "確認済み" : "未確認",
    },
    {
      id: "inquiry",
      label: "不明点を問い合わせ",
      status: inquiryDone ? "done" : estimateDone ? "current" : "todo",
      statusLabel: inquiryDone
        ? "確認済み"
        : inquiryStarted
          ? "回答待ち"
          : "未確認",
    },
    {
      id: "family",
      label: "家族に共有",
      status: familyDone ? "done" : confirmed ? "current" : "todo",
      statusLabel: familyDone ? "確認済み" : confirmed ? "未確認" : "未確認",
    },
  ];

  if (!estimateDone) {
    return {
      steps,
      headline: "見積もりに含まれる費用を確認しましょう",
      ctaLabel: "見積もりを確認する",
      ctaHref: "/demo/estimate",
    };
  }

  if (inquiryStatus === "awaiting_approval") {
    return {
      steps,
      headline: "見積もりの不明点を葬儀社に確認しましょう",
      ctaLabel: "質問内容を確認する",
      ctaHref: "/demo/agent",
    };
  }

  if (inquiryStatus === "awaiting_followup_approval") {
    return {
      steps,
      headline: "返信が届きました。搬送の追加料金は、まだ確認が必要です",
      ctaLabel: "返信を確認する",
      ctaHref: "/demo/agent",
    };
  }

  if (isWaitingForReply(inquiryStatus)) {
    return {
      steps,
      headline: "葬儀社からの返信を確認しましょう",
      ctaLabel: "返信を確認する",
      ctaHref: "/demo/agent",
    };
  }

  if (hasViewedFamily) {
    return {
      steps,
      headline: "確認できた条件を、家族が読める準備書に残せています",
      ctaLabel: "家族向けの準備書を見る",
      ctaHref: "/demo/family",
    };
  }

  return {
    steps,
    headline: "確認できた条件を家族に残しましょう",
    ctaLabel: "家族向けの準備書を見る",
    ctaHref: "/demo/summary",
  };
}
