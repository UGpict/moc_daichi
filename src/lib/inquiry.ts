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
      label: "希望を見る",
      status: "done",
      statusLabel: "確認済み",
    },
    {
      id: "estimate",
      label: "見積もりの分からないところ",
      status: estimateDone ? "done" : "current",
      statusLabel: estimateDone ? "確認済み" : "未確認",
    },
    {
      id: "inquiry",
      label: "聞いてよいか確認",
      status: inquiryDone ? "done" : estimateDone ? "current" : "todo",
      statusLabel: inquiryDone
        ? "確認済み"
        : inquiryStarted
          ? "返事待ち"
          : "未確認",
    },
    {
      id: "family",
      label: "子どもに一枚残す",
      status: familyDone ? "done" : confirmed ? "current" : "todo",
      statusLabel: familyDone ? "確認済み" : confirmed ? "未確認" : "未確認",
    },
  ];

  if (!estimateDone) {
    return {
      steps,
      headline: "見積もりの、書いていないところを見てみましょう",
      ctaLabel: "見積もりを見る",
      ctaHref: "/demo/estimate",
    };
  }

  if (inquiryStatus === "awaiting_approval") {
    return {
      steps,
      headline: "見積もりの分からないところを、葬儀社に聞いてよいですか",
      ctaLabel: "質問を見て決める",
      ctaHref: "/demo/agent",
    };
  }

  if (inquiryStatus === "awaiting_followup_approval") {
    return {
      steps,
      headline: "返事は届きました。まだ分からないことがあります",
      ctaLabel: "もう一度聞いてよいか見る",
      ctaHref: "/demo/agent",
    };
  }

  if (isWaitingForReply(inquiryStatus)) {
    return {
      steps,
      headline: "葬儀社からの返事を待ちましょう",
      ctaLabel: "返事を見る",
      ctaHref: "/demo/agent",
    };
  }

  if (hasViewedFamily) {
    return {
      steps,
      headline: "子どもに残す一枚の準備ができています",
      ctaLabel: "家族が見る画面を開く",
      ctaHref: "/demo/family",
    };
  }

  return {
    steps,
    headline: "分かったことを、子どもに一枚で残しましょう",
    ctaLabel: "子どもに残す一枚を見る",
    ctaHref: "/demo/summary",
  };
}
