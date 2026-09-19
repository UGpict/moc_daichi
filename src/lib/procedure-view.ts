import { formatSignedYen, formatYen } from "./format";
import {
  originalStayDaysForOffer,
  previousStayReferenceTotal,
  referenceTotal,
  scheduleStayDaysAfterOffer,
} from "./procedure";
import {
  DOMICILE_CONSULT_BODY,
  DOMICILE_CONSULT_REPLY,
  FUNERAL_HOME,
  LEFTOVER_RECORDS,
  NAME_MEMO,
  NAME_ON_CERTIFICATE,
  NAME_WILL_HANDLE_BODY,
  ROLES,
} from "./sample-data";
import type { DemoState, EvidenceId, UserActionId } from "./types";
import { canApplyUserAction, canViewEvidence, hasEvent } from "./events";

export interface ProcedureChoice {
  id: UserActionId;
  label: string;
  kind: "primary" | "secondary";
}

export interface ProcedureView {
  prompt: string;
  detail: string;
  choices: ProcedureChoice[];
  waiting: string | null;
  progress: string[];
  showStart: boolean;
  sampleNote: boolean;
  consultDraft: boolean;
  consultReply: boolean;
  nameDraft: boolean;
  nameCertificate: boolean;
  scheduleReport: boolean;
  familyPause: boolean;
  evidenceId: EvidenceId | null;
  done: boolean;
}

export function scheduleCostDelta(state: DemoState): {
  beforeTotal: number;
  afterTotal: number;
  delta: number;
  stayBefore: number;
  stayAfter: number;
} {
  const stayBefore = originalStayDaysForOffer();
  const stayAfter = state.conditions.stayDays;
  const beforeTotal = previousStayReferenceTotal(state);
  const afterTotal = referenceTotal(state);
  return {
    beforeTotal,
    afterTotal,
    delta: afterTotal - beforeTotal,
    stayBefore,
    stayAfter,
  };
}

export function getProcedureView(state: DemoState): ProcedureView {
  const cost = scheduleCostDelta(state);
  const offerArrived = hasEvent(state, "receive_schedule_offer");
  const showStart = false;

  const progress: string[] = [];
  if (state.deathCertificate === "received") {
    progress.push("死亡診断書は受領済みとして記録しています。");
  }
  if (
    state.scheduleStatus === "adjusting" &&
    state.handoverHeard &&
    state.nameCheckStatus !== "not_compared" &&
    state.nameCheckStatus !== "mismatch_found"
  ) {
    progress.push(
      "葬儀社には火葬日程を確認しています。返事が届いたら、費用への影響もまとめてお知らせします。",
    );
  } else if (offerArrived && state.domicileStatus === "unknown") {
    progress.push("葬儀社から日程の候補が届いています。本籍の確認のあと、内容をご案内します。");
  } else if (state.scheduleStatus === "awaiting_confirm") {
    progress.push("日程の調整を依頼しました。予約はまだ確定していません。");
  } else if (state.scheduleStatus === "confirmed") {
    progress.push("火葬の候補日は、葬儀社から確定の報告がありました。");
  }
  if (state.domicileStatus === "consulting_sent") {
    progress.push("本籍の確認方法について、担当者へ相談を送っています。");
  }
  if (state.domicileStatus === "sample_provided") {
    progress.push("残されていた資料の内容を、担当者へ共有しています。");
  }
  if (state.formStatus === "submit_requested") {
    progress.push("窓口への提出を担当者へ依頼しました。提出の報告を待ちます。");
  }

  const empty: ProcedureView = {
    prompt: "",
    detail: "",
    choices: [],
    waiting: null,
    progress,
    showStart,
    sampleNote: false,
    consultDraft: false,
    consultReply: false,
    nameDraft: false,
    nameCertificate: false,
    scheduleReport: false,
    familyPause: false,
    evidenceId: null,
    done: false,
  };

  if (state.permit.handedOver) {
    return {
      ...empty,
      prompt: "火葬許可証は佐藤さんが受け取り、火葬場への引渡しも確認できました。",
      detail: "この体験は、許可証の受領と引渡しの確認までです。",
      done: true,
      evidenceId: canViewEvidence(state, "permit") ? "permit" : null,
      showStart: false,
    };
  }

  if (!state.handoverHeard) {
    return {
      ...empty,
      prompt:
        "お母さまは、家族だけでのお見送りを希望され、日程は家族に任せると確認しています。氏名は手掛かりとして「山田 春子」、本籍メモは静岡県葵市さくら町1丁目です。公的書類との照合は、これからします。まず、現在どこまで手配できているか教えてください。",
      detail: "同じ希望は、もう一度聞きません。",
      choices: [
        { id: "report_handover_has_cert", label: "死亡診断書は受け取った", kind: "primary" },
        { id: "report_handover_none", label: "まだ何も手配していない", kind: "secondary" },
      ],
    };
  }

  if (state.nameCheckStatus === "not_compared") {
    return {
      ...empty,
      prompt: "死亡診断書の記載と、お母さまが残したメモを照合します。サンプルを見せていただけますか？",
      detail: "本人の発言は手掛かりです。書類の記載を、推測では埋めません。",
      choices: [
        { id: "provide_death_cert", label: "サンプルの死亡診断書を渡す", kind: "primary" },
      ],
    };
  }

  if (state.nameCheckStatus === "mismatch_found") {
    return {
      ...empty,
      prompt:
        "お母さまが残されたメモと、書類で氏名の表記が異なっています。手続きを進める前に、担当者へ確認する内容をまとめました。",
      detail: `メモ：${NAME_MEMO} ／ 死亡診断書：${NAME_ON_CERTIFICATE}。こちらで直して転記はしません。`,
      nameDraft: true,
      nameCertificate: true,
      choices: [
        { id: "approve_name_check", label: "この内容で担当者へ確認する", kind: "primary" },
      ],
      evidenceId: canViewEvidence(state, "death_certificate") ? "death_certificate" : null,
    };
  }

  if (state.nameCheckStatus === "awaiting_reply") {
    return {
      ...empty,
      prompt: "氏名の表記について、担当者へ確認を依頼しました。",
      detail: "実際の送信は行っていません。返事が届くまで、この項目は確定しません。",
      waiting: "担当者からの返事を待っています。",
      nameDraft: true,
    };
  }

  if (state.domicileStatus === "unknown") {
    return {
      ...empty,
      prompt:
        "本籍は、お母さまのメモを手掛かりにします。分かる資料は、すでに残されています。",
      detail: "同じ質問は繰り返しません。メモの内容を担当者へ伝えてよいか確認します。",
      choices: [
        { id: "choose_domicile_has_docs", label: "本人が残した資料を見る", kind: "primary" },
        { id: "choose_domicile_unknown", label: "分からない", kind: "secondary" },
      ],
    };
  }

  if (
    state.nameCheckStatus === "will_handle" &&
    state.scheduleStatus === "adjusting"
  ) {
    return {
      ...empty,
      prompt:
        "担当者から返事がありました。確認結果はまだ届いていないため、この項目は保留しています。ほかに準備できる部分を先に整理します。",
      detail: `「${NAME_WILL_HANDLE_BODY}」だけでは、氏名の不一致は解消していません。火葬の候補が届き次第、ご案内します。`,
      waiting: "火葬日程の候補と、氏名の確認結果を待っています。",
    };
  }

  if (
    state.domicileStatus === "reviewing_sample" &&
    state.nameCheckStatus === "result_received"
  ) {
    return {
      ...empty,
      prompt:
        "氏名は戸籍上「山田 春子」と確認できました。本籍は、お母さまのメモを手掛かりとして担当者へ伝えます。公的書類との照合が済んだ扱いにはしません。",
      detail: `${LEFTOVER_RECORDS.domicile}。この内容を、確認の手掛かりとして伝えてよいですか？`,
      sampleNote: true,
      choices: [
        {
          id: "provide_domicile_sample",
          label: "メモの内容を手掛かりとして伝える",
          kind: "primary",
        },
      ],
      evidenceId: canViewEvidence(state, "name_result") ? "name_result" : null,
    };
  }

  if (state.domicileStatus === "consulting") {
    return {
      ...empty,
      prompt: "承知しました。確認方法を葬儀社の担当者に相談する文章を用意します。",
      detail: `宛先は${FUNERAL_HOME.name}の${FUNERAL_HOME.staff}です。この内容で相談してよいですか？`,
      consultDraft: true,
      choices: [
        {
          id: "approve_domicile_consult",
          label: "この内容で相談する",
          kind: "primary",
        },
      ],
    };
  }

  if (state.domicileStatus === "consult_replied") {
    return {
      ...empty,
      prompt: "担当者から、確認の進め方について返事がありました。",
      detail: DOMICILE_CONSULT_REPLY,
      consultReply: true,
      choices: [
        {
          id: "acknowledge_domicile_consult",
          label: "内容を確認した",
          kind: "primary",
        },
      ],
    };
  }

  if (state.scheduleStatus === "paused_for_family") {
    return {
      ...empty,
      prompt: "家族に相談してから決める、と残しました。",
      detail: `候補日は${state.proposedCremationDate}、安置は${cost.stayAfter}日、参考額は${formatYen(cost.afterTotal)}です。予約は確定していません。`,
      familyPause: true,
      choices: [
        {
          id: "resume_schedule_decision",
          label: "確認できたので戻る",
          kind: "primary",
        },
      ],
      evidenceId: canViewEvidence(state, "schedule_offer") ? "schedule_offer" : null,
    };
  }

  if (state.scheduleStatus === "awaiting_adjust_approval") {
    return {
      ...empty,
      prompt: `生前に「日程は家族に任せる」と確認しています。葬儀社から、翌日なら予約できると連絡がありました。安置が1日延びるため、参考額は${formatYen(cost.delta)}増えて${formatYen(cost.afterTotal)}になります。過去の見積額や空きは、いまも有効とは限りません。`,
      detail: "予約は、この場の承認だけでは確定しません。氏名の確認結果は、まだ保留のままです。",
      scheduleReport: true,
      choices: [
        {
          id: "approve_schedule_adjust",
          label: "この候補で調整をお願いする",
          kind: "primary",
        },
        {
          id: "pause_schedule_for_family",
          label: "家族に相談してから決める",
          kind: "secondary",
        },
      ],
      evidenceId: canViewEvidence(state, "schedule_offer") ? "schedule_offer" : null,
    };
  }

  if (state.nameCheckStatus === "will_handle") {
    return {
      ...empty,
      prompt:
        "担当者から返事がありました。確認結果はまだ届いていないため、この項目は保留しています。ほかに準備できる部分を先に整理します。",
      detail: `「${NAME_WILL_HANDLE_BODY}」だけでは完了ではありません。氏名の確認結果を待ちます。`,
      waiting: "氏名の確認結果を待っています。",
    };
  }

  if (canApplyUserAction(state, "approve_submit")) {
    return {
      ...empty,
      prompt: `窓口への持参は佐藤さんが担当します。お名前と申請内容をご確認ください。`,
      detail: `届出人は${ROLES.notifier.name}、持参者は${ROLES.bearer.name}です。提出の依頼だけ確認してください。`,
      choices: [
        {
          id: "approve_submit",
          label: "提出を依頼する",
          kind: "primary",
        },
      ],
    };
  }

  if (canApplyUserAction(state, "approve_municipality_check")) {
    return {
      ...empty,
      prompt: "自治体から、申請書の火葬場名と予約内容の確認が届きました。",
      detail: "葬儀社へ照合を頼む内容をまとめました。この内容で確認してよいですか？",
      choices: [
        {
          id: "approve_municipality_check",
          label: "葬儀社へ確認を頼む",
          kind: "primary",
        },
      ],
      evidenceId: canViewEvidence(state, "municipality_inquiry")
        ? "municipality_inquiry"
        : null,
    };
  }

  if (state.permit.issued && !state.permit.received) {
    return {
      ...empty,
      prompt: "許可証が交付されました。佐藤さんが受け取ったか確認しています。",
      detail: "交付の連絡と、受領の報告は分けて確認します。",
      waiting: "担当者の受領報告を待っています。",
      evidenceId: canViewEvidence(state, "permit") ? "permit" : null,
    };
  }

  if (state.permit.received && !state.permit.handedOver) {
    return {
      ...empty,
      prompt: "佐藤さんが火葬許可証を受け取りました。火葬場への引渡しを確認しています。",
      detail: "引渡しの報告が届くまで待ちましょう。",
      waiting: "火葬場への引渡し報告を待っています。",
      evidenceId: canViewEvidence(state, "permit") ? "permit" : null,
    };
  }

  if (
    state.caseInquiry.staffWillHandle &&
    !state.caseInquiry.staffCompleted
  ) {
    return {
      ...empty,
      prompt: "担当者から「対応します」と連絡がありました。",
      detail: "対応の予定だけでは、確認はまだ終わっていません。完了の報告を待ちます。",
      waiting: "修正・確認の完了報告を待っています。",
    };
  }

  if (state.formStatus === "submit_requested") {
    return {
      ...empty,
      prompt: "提出の依頼を受け取りました。担当者の提出報告を待ちます。",
      detail: "依頼しただけでは、提出済みにはしません。",
      waiting: "担当者の提出報告を待っています。",
    };
  }

  if (state.formStatus === "submitted" && !state.caseInquiry.received) {
    return {
      ...empty,
      prompt: "担当者から、窓口へ提出したとの報告がありました。",
      detail: "自治体からの確認があれば、内容を見て判断します。",
      waiting: "自治体からの連絡を待っています。",
    };
  }

  if (state.domicileStatus === "consulting_sent") {
    return {
      ...empty,
      prompt: "担当者へ、本籍の確認方法の相談を送りました。",
      detail: "実際の送信は行っていません。返事が届くまで待ちましょう。",
      waiting: "担当者からの返事を待っています。",
    };
  }

  if (state.domicileStatus === "sample_provided") {
    return {
      ...empty,
      prompt: "資料の内容を担当者へ伝えました。申請書への反映を待っています。",
      detail: "こちらで進めています。",
      waiting: "担当者の反映報告を待っています。",
    };
  }

  if (state.scheduleStatus === "awaiting_confirm") {
    return {
      ...empty,
      prompt: "日程の調整を依頼しました。葬儀社の確定報告を待ちます。",
      detail: "依頼しただけでは、予約は確定しません。",
      waiting: "葬儀社の確定報告を待っています。",
      evidenceId: canViewEvidence(state, "schedule_offer") ? "schedule_offer" : null,
    };
  }

  return {
    ...empty,
    prompt: "いま進んでいる手続きを整理しています。",
    detail: "次の連絡が届くまで、こちらで待ちます。",
    waiting: "次の報告を待っています。",
  };
}

export function consultDraftBody(): string {
  return DOMICILE_CONSULT_BODY;
}

export function scheduleChangeLines(state: DemoState) {
  const cost = scheduleCostDelta(state);
  return [
    {
      label: "火葬日",
      from: state.originalCremationDate,
      to: state.proposedCremationDate,
    },
    {
      label: "安置",
      from: `${cost.stayBefore}日`,
      to: `${cost.stayAfter}日`,
    },
    {
      label: "参考額",
      from: formatYen(cost.beforeTotal),
      to: formatYen(cost.afterTotal),
    },
  ];
}

export function scheduleRequestSummary(state: DemoState): string {
  const extra = scheduleStayDaysAfterOffer() - originalStayDaysForOffer();
  return `翌日の枠（${state.proposedCremationDate}）で調整を依頼します。安置が${extra}日延びることと、申請書案の火葬日の確認も含めます。`;
}

export function familyConsultSummary(state: DemoState): string {
  const cost = scheduleCostDelta(state);
  return [
    `候補日：${state.originalCremationDate} → ${state.proposedCremationDate}`,
    `安置：${cost.stayBefore}日 → ${cost.stayAfter}日`,
    `参考額：${formatYen(cost.beforeTotal)} → ${formatYen(cost.afterTotal)}（${formatSignedYen(cost.delta)}）`,
    "予約は未確定です。書類の日付確認も必要です。",
  ].join("\n");
}
