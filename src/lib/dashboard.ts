import { formatYen } from "./format";
import {
  areAnswersConfirmed,
  getCheckItemStatus,
  hasReceivedFirstReply,
  isWaitingForReply,
} from "./inquiry";
import { isCaseInquiryResolved, referenceTotal } from "./procedure";
import { CREMATORY_NAME, FUNERAL_HOME, ROLES } from "./sample-data";
import type {
  ActivityItem,
  ApprovalItem,
  DashboardItem,
  DemoState,
  ProgressStep,
  ShirubeReport,
} from "./types";

export function getShirubeReport(state: DemoState): ShirubeReport {
  if (state.permit.handedOver) {
    return {
      message: "火葬許可証の受領と、火葬場への引渡しを確認しました。",
      next: "火葬の実施や葬儀の完了までは、この体験では扱いません。",
    };
  }
  if (state.permit.received) {
    return {
      message: "葬儀社担当者が火葬許可証を受領した、と報告がありました。",
      next: "火葬場への引渡し報告を待ちます。交付・受領・引渡しは別の確認です。",
    };
  }
  if (state.permit.issued) {
    return {
      message: "自治体から火葬許可証の交付連絡が届きました。",
      next: "担当者の受領報告と、火葬場への引渡し報告を分けて確認します。",
    };
  }
  if (
    state.caseInquiry.staffWillHandle &&
    !state.caseInquiry.staffCompleted
  ) {
    return {
      message:
        "対応予定の連絡が届きました。修正・確認の完了報告を待っています。",
      next: "「対応します」だけでは、照会はまだ解決していません。",
    };
  }
  if (state.caseInquiry.checkSent && !state.caseInquiry.staffCompleted) {
    return {
      message: "葬儀社へ、申請書と予約内容の照合を依頼しました。",
      next: "担当者の完了報告と、自治体側の確認報告の両方を待ちます。",
    };
  }
  if (state.caseInquiry.received && !state.caseInquiry.checkApproved) {
    return {
      message: "自治体から、申請書の火葬場名と予約内容の確認照会が届きました。",
      next: "葬儀社への確認案をまとめました。内容を見て承認してください。",
    };
  }
  if (state.formStatus === "submitted") {
    return {
      message: "窓口への提出準備を記録しました。正式な受理は、自治体の判断です。",
      next: "不備照会があれば、内容を確認してから対応します。",
    };
  }
  if (state.scheduleStatus === "awaiting_adjust_approval") {
    return {
      message: `翌日なら予約できるそうです。安置費用が11,000円増えるため、参考額は${formatYen(referenceTotal(state))}になります。申請書案の日程も確認が必要です。`,
      next: "変更内容を確認し、調整の依頼だけ承認してください。予約はまだ確定しません。",
    };
  }
  if (state.scheduleStatus === "awaiting_confirm") {
    return {
      message: "日程変更による費用と書類への影響を整理し、調整を依頼しました。",
      next: "葬儀社の確定報告を待っています。承認だけで予約確定にはしません。",
    };
  }
  if (state.scheduleStatus === "confirmed" && state.formStatus === "updated") {
    return {
      message: "葬儀社から翌日枠の確定報告がありました。申請書案の火葬日も合わせました。",
      next: "届出人と持参者を混同せず、提出内容を確認してください。",
    };
  }
  if (state.track === "procedure" && state.scheduleStatus === "adjusting") {
    return {
      message: "死亡診断書は受領済みです。本籍は空欄のまま、確認先だけ残しています。",
      next: "今回の体験では斎場予約を先に進めます。火葬日程の返事を待ちます。",
    };
  }
  if (state.inquiryStatus === "awaiting_followup_approval") {
    return {
      message:
        "返事は届きましたが、搬送の追加料金はまだ分かりません。もう一度聞いてよいですか？",
      next: "『距離や状況による』だけでは、いくらかかるか計算できません。",
    };
  }
  if (isWaitingForReply(state.inquiryStatus)) {
    return {
      message: "葬儀社に聞きました。返事を待ちましょう。",
      next: "実際の送信は行っていません。",
    };
  }
  if (areAnswersConfirmed(state.inquiryStatus) && state.track === "prep") {
    return {
      message: state.hasViewedFamily
        ? "子どもに残す一枚の準備ができています。"
        : "今回の質問の返事が揃いました。子どもに一枚で残せます。",
      next: "役所の手続きは、必要になったあとで見られます。",
    };
  }
  if (!state.hasReviewedEstimate && state.inquiryStatus === "awaiting_approval") {
    return {
      message: "まず、見積もりの書いていないところを一緒に見ましょう。",
      next: "希望はここに残してあります。分からない費用は、0円にはしません。",
    };
  }
  return {
    message: "見積もりの、書いていないところをまとめました。",
    next: "内容を見て、葬儀社に聞いてよいか決めてください。",
  };
}

export function getApprovals(state: DemoState): ApprovalItem[] {
  const items: ApprovalItem[] = [];
  if (state.inquiryStatus === "awaiting_approval") {
    items.push({
      id: "approve_inquiry",
      label: "この内容で聞いてよい",
      href: "/demo/agent",
    });
  }
  if (state.inquiryStatus === "awaiting_followup_approval") {
    items.push({
      id: "approve_followup",
      label: "もう一度聞いてよい",
      href: "/demo/agent",
    });
  }
  if (state.scheduleStatus === "awaiting_adjust_approval") {
    items.push({
      id: "approve_schedule_adjust",
      label: "この内容で調整を依頼する（デモ）",
      href: "/demo/procedure",
    });
  }
  if (
    state.scheduleStatus === "confirmed" &&
    state.formStatus === "updated" &&
    state.domicileStatus === "family_will_attach"
  ) {
    items.push({
      id: "approve_submit",
      label: "提出準備を進める（デモ）",
      href: "/demo/procedure",
    });
  }
  if (state.caseInquiry.received && !state.caseInquiry.checkApproved) {
    items.push({
      id: "approve_municipality_check",
      label: "葬儀社へ確認する（デモ）",
      href: "/demo/procedure",
    });
  }
  return items;
}

export function getInProgress(state: DemoState): DashboardItem[] {
  const items: DashboardItem[] = [];
  if (state.hasReviewedEstimate && state.inquiryStatus === "awaiting_approval") {
    items.push({
      id: "draft-questions",
      title: "見積書の照合と質問案",
      detail: "安置延長・搬送超過・火葬料・飲食返礼品の記載漏れを検出し、質問を作成済みです。",
      href: "/demo/estimate",
      evidenceId: "estimate",
    });
  }
  if (hasReceivedFirstReply(state.inquiryStatus) && getCheckItemStatus("transport", state.inquiryStatus) === "unconfirmed") {
    items.push({
      id: "detect-transport",
      title: "未回答の検知",
      detail: "搬送費は条件が曖昧なため、確認済みにしていません。再質問案を用意しました。",
      href: "/demo/agent",
      evidenceId: "first_reply",
    });
  }
  if (state.scheduleStatus === "awaiting_adjust_approval") {
    items.push({
      id: "recalc",
      title: "費用の再計算と書類の照合",
      detail: `安置5日で参考額を${formatYen(referenceTotal(state))}に更新し、申請書案の火葬日との不一致を検出しています。`,
      href: "/demo/procedure",
      evidenceId: "schedule_offer",
    });
  }
  if (state.track === "procedure" && state.deathCertificate === "received") {
    items.push({
      id: "docs",
      title: "受領書類の整理",
      detail: "死亡診断書は受領済みとして記録しています。本籍は推測せず、空欄のままにしています。",
      href: "/demo/procedure",
    });
  }
  if (items.length === 0) {
    items.push({
      id: "idle",
      title: "経過の整理",
      detail: "いま自動で進められる内部作業はありません。",
    });
  }
  return items;
}

export function getWaiting(state: DemoState): DashboardItem[] {
  const items: DashboardItem[] = [];
  if (isWaitingForReply(state.inquiryStatus)) {
    items.push({
      id: "wait-estimate",
      title: `${FUNERAL_HOME.name}からの見積条件の返信`,
      detail: "追加費用の条件を確認中です。",
      href: "/demo/agent",
    });
  }
  if (state.track === "procedure" && state.domicileStatus === "ask_family") {
    items.push({
      id: "wait-domicile",
      title: `${ROLES.notifier.name}さんへの本籍の確認`,
      detail: "本籍は記入せず、戸籍で確認してもらう旨だけ伝えています。",
      href: "/demo/procedure",
    });
  }
  if (state.scheduleStatus === "adjusting") {
    items.push({
      id: "wait-slot",
      title: "火葬日程の調整結果",
      detail: "斎場予約を先に進める固定シナリオです。候補枠の返事を待っています。",
      href: "/demo/procedure",
    });
  }
  if (state.scheduleStatus === "awaiting_confirm") {
    items.push({
      id: "wait-confirm",
      title: "日程調整の確定報告",
      detail: "依頼は送りましたが、予約確定にはしていません。",
      href: "/demo/procedure",
    });
  }
  if (state.caseInquiry.checkSent && !state.caseInquiry.staffCompleted) {
    items.push({
      id: "wait-staff-done",
      title: "葬儀社の修正・確認の完了報告",
      detail:
        state.caseInquiry.staffWillHandle
          ? "対応予定の連絡は届いています。完了報告はまだです。"
          : "照合の依頼を送っています。",
      href: "/demo/procedure",
      evidenceId: state.caseInquiry.staffWillHandle ? "staff_will_handle" : undefined,
    });
  }
  if (state.caseInquiry.staffCompleted && !state.caseInquiry.municipalityVerified) {
    items.push({
      id: "wait-city",
      title: "自治体側で確認できたという報告",
      detail: "担当者の完了報告だけでは、照会は解決していません。",
      href: "/demo/procedure",
      evidenceId: "staff_completed",
    });
  }
  if (state.permit.issued && !state.permit.received) {
    items.push({
      id: "wait-receive",
      title: "担当者による許可証の受領報告",
      detail: "交付連絡と受領は別の確認です。",
      href: "/demo/procedure",
      evidenceId: "permit",
    });
  }
  if (state.permit.received && !state.permit.handedOver) {
    items.push({
      id: "wait-handover",
      title: "火葬場への引渡し報告",
      detail: `${CREMATORY_NAME}への引渡しを待ちます。`,
      href: "/demo/procedure",
      evidenceId: "permit",
    });
  }
  if (state.formStatus === "submitted" && !state.caseInquiry.received) {
    items.push({
      id: "wait-inquiry",
      title: "自治体からの照会の有無",
      detail: "提出後の確認です。正式な受理をAIが決めることはありません。",
      href: "/demo/procedure",
    });
  }
  return items;
}

export function getActivity(state: DemoState): ActivityItem[] {
  const items: ActivityItem[] = [];
  items.push({
    id: "wishes",
    title: "本人の希望を整理",
    checked: "家族中心・約20名・一日葬、予算の目安80万円",
    found: "日程は未定。見積は葵セレモニー（架空）1社分。",
    unresolved: null,
  });
  if (state.hasReviewedEstimate) {
    items.push({
      id: "estimate",
      title: "見積書を照合",
      checked: "基本プラン55万円に含まれる範囲",
      found: "火葬料・飲食返礼品は別途。安置延長と搬送超過の単価は記載なし。",
      unresolved: "総額は未確定（不明項目は0円にしていません）",
      evidenceId: "estimate",
    });
  }
  if (hasReceivedFirstReply(state.inquiryStatus)) {
    items.push({
      id: "first-reply",
      title: "葬儀社の初回返信",
      checked: "安置延長・火葬料・飲食返礼品",
      found: "安置1日11,000円、火葬料12,000円、飲食返礼品110,000円。",
      unresolved:
        getCheckItemStatus("transport", state.inquiryStatus) === "confirmed"
          ? null
          : "搬送費は『距離や状況による』ため未解決",
      evidenceId: "first_reply",
    });
  }
  if (areAnswersConfirmed(state.inquiryStatus)) {
    items.push({
      id: "followup-reply",
      title: "搬送条件の再確認",
      checked: "20km超と夜間加算",
      found: "10kmごと5,500円（端数切上げ）、夜間11,000円。",
      unresolved: null,
      evidenceId: "followup_reply",
    });
  }
  if (state.deathCertificate === "received") {
    items.push({
      id: "death-cert",
      title: "死亡診断書などの受領",
      checked: "死亡診断書の受領状況",
      found: "受領済み（サンプル）。",
      unresolved: null,
    });
  }
  if (state.domicileStatus !== "unknown") {
    items.push({
      id: "domicile",
      title: "本籍などの不足情報",
      checked: "誰に確認するか",
      found: `${ROLES.notifier.name}さんに、戸籍で本籍を確認してもらう。`,
      unresolved:
        state.domicileStatus === "family_will_attach"
          ? "本籍の文字は未入手のため空欄"
          : "本籍は未確認。推測では埋めません。",
    });
  }
  if (state.scheduleStatus !== "not_started" && state.scheduleStatus !== "adjusting") {
    items.push({
      id: "schedule",
      title: "火葬日程の変更",
      checked: "当初候補と翌日案、安置日数",
      found: `翌日案 ${state.proposedCremationDate}、安置${state.conditions.stayDays}日、参考額${formatYen(referenceTotal(state))}。`,
      unresolved:
        state.scheduleStatus === "confirmed"
          ? null
          : "予約は未確定。申請書案の日付も確認が必要",
      evidenceId: "schedule_offer",
    });
  }
  if (state.caseInquiry.received) {
    items.push({
      id: "city-inquiry",
      title: "自治体からの不備照会",
      checked: "照会文",
      found: "申請書の火葬場名と予約内容の確認が必要。",
      unresolved: isCaseInquiryResolved(state)
        ? null
        : state.caseInquiry.staffWillHandle && !state.caseInquiry.staffCompleted
          ? "対応予定のみ。完了報告待ち"
          : "修正・確認の完了前",
      evidenceId: "municipality_inquiry",
    });
  }
  if (state.permit.issued || state.permit.received || state.permit.handedOver) {
    items.push({
      id: "permit",
      title: "許可証の交付・受領・引渡し",
      checked: "交付連絡、受領報告、引渡し報告",
      found: [
        state.permit.issued ? "交付連絡あり" : null,
        state.permit.received ? "受領報告あり" : null,
        state.permit.handedOver ? "引渡し報告あり" : null,
      ]
        .filter(Boolean)
        .join(" / "),
      unresolved: state.permit.handedOver
        ? null
        : "3つの報告は独立して確認します",
      evidenceId: "permit",
    });
  }
  return items;
}

export function getOverallSteps(state: DemoState): ProgressStep[] {
  const prepDone = areAnswersConfirmed(state.inquiryStatus);
  const familyDone = state.hasViewedFamily || state.track === "procedure";
  const procedureStarted = state.track === "procedure";
  const handed = state.permit.handedOver;

  return [
    {
      id: "prep",
      label: "希望と見積もりの確認",
      status: prepDone ? "done" : "current",
      statusLabel: prepDone ? "確認済み" : "進行中",
    },
    {
      id: "family",
      label: "家族への引継ぎ",
      status: familyDone ? "done" : prepDone ? "current" : "todo",
      statusLabel: familyDone ? "確認済み" : prepDone ? "未確認" : "未確認",
    },
    {
      id: "procedure",
      label: "死亡後の手続き",
      status: handed ? "done" : procedureStarted ? "current" : "todo",
      statusLabel: handed ? "確認済み" : procedureStarted ? "進行中" : "未確認",
    },
  ];
}
