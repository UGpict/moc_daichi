import { FUNERAL_HOME, MUNICIPALITY, ROLES } from "./sample-data";
import type { DemoState } from "./types";

export interface TaskRow {
  id: string;
  actor: string;
  work: string;
  waiting: string | null;
}

export function getTaskRows(state: DemoState): TaskRow[] {
  const rows: TaskRow[] = [
    {
      id: "family",
      actor: ROLES.notifier.name,
      work: "現状の伝達、提案の選択、確認と提出依頼の承認",
      waiting: null,
    },
    {
      id: "staff",
      actor: `${FUNERAL_HOME.name} ${FUNERAL_HOME.staff}`,
      work: "氏名確認、日程調整、窓口への持参、照会への回答",
      waiting: null,
    },
    {
      id: "city",
      actor: MUNICIPALITY.name,
      work: "申請の確認、火葬許可証の交付",
      waiting: null,
    },
  ];

  if (!state.handoverHeard || state.nameCheckStatus === "not_compared") {
    rows[0] = {
      ...rows[0],
      waiting: "家族からの現状または書類の提供",
    };
  } else if (state.nameCheckStatus === "mismatch_found") {
    rows[0] = { ...rows[0], waiting: "氏名確認の依頼承認" };
  } else if (state.nameCheckStatus === "awaiting_reply") {
    rows[1] = { ...rows[1], waiting: "氏名確認の返事" };
  } else if (state.nameCheckStatus === "will_handle") {
    rows[1] = { ...rows[1], waiting: "氏名の確認結果（「確認します」では完了しない）" };
  }

  if (state.scheduleStatus === "adjusting") {
    rows[1] = {
      ...rows[1],
      waiting: rows[1].waiting
        ? `${rows[1].waiting}／火葬日程の候補`
        : "火葬日程の候補",
    };
  } else if (state.scheduleStatus === "awaiting_adjust_approval") {
    rows[0] = { ...rows[0], waiting: "日程候補の判断" };
  } else if (state.scheduleStatus === "awaiting_confirm") {
    rows[1] = {
      ...rows[1],
      waiting: rows[1].waiting
        ? `${rows[1].waiting}／日程の確定報告`
        : "日程の確定報告",
    };
  }

  if (state.formStatus === "submit_requested") {
    rows[1] = { ...rows[1], waiting: "提出したという報告" };
  }
  if (state.caseInquiry.checkSent && !state.caseInquiry.staffCompleted) {
    rows[1] = {
      ...rows[1],
      waiting: state.caseInquiry.staffWillHandle
        ? "照会の完了報告（対応予定のみでは未了）"
        : "照会への対応",
    };
  }
  if (state.caseInquiry.staffCompleted && !state.caseInquiry.municipalityVerified) {
    rows[2] = { ...rows[2], waiting: "自治体側で確認できたという報告" };
  }
  if (state.permit.issued && !state.permit.received) {
    rows[1] = { ...rows[1], waiting: "許可証の受領報告" };
  }
  if (state.permit.received && !state.permit.handedOver) {
    rows[1] = { ...rows[1], waiting: "火葬場への引渡し報告" };
  }

  return rows;
}
