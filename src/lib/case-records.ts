import {
  CREMATORY_NAME,
  FAMILY,
  LEFTOVER_RECORDS,
  MUNICIPALITY,
  NAME_MEMO,
  NAME_ON_CERTIFICATE,
  NAME_RESULT_BODY,
  ROLES,
} from "./sample-data";
import type { DemoState } from "./types";

export interface RecordRow {
  id: string;
  label: string;
  leftover: string;
  afterDeath: string;
  kind: "clue" | "matched" | "mismatch" | "waiting";
}

export function getRecordRows(state: DemoState): RecordRow[] {
  const nameKind =
    state.nameCheckStatus === "result_received"
      ? "matched"
      : state.nameCheckStatus === "not_compared"
        ? "clue"
        : state.nameCheckStatus === "will_handle" ||
            state.nameCheckStatus === "awaiting_reply"
          ? "waiting"
          : "mismatch";

  return [
    {
      id: "name",
      label: "氏名",
      leftover: `${NAME_MEMO}（本人メモ・手掛かり）`,
      afterDeath:
        state.deathCertificate === "received"
          ? `${NAME_ON_CERTIFICATE}（死亡診断書）`
          : "書類未照合",
      kind: nameKind,
    },
    {
      id: "domicile",
      label: "本籍",
      leftover: `${LEFTOVER_RECORDS.domicile}（メモ・手掛かり）`,
      afterDeath:
        state.domicileStatus === "staff_recorded"
          ? "担当者が申請書案へ反映した報告あり。戸籍原本との照合完了ではない"
          : "公的書類との照合は未了",
      kind: state.domicileStatus === "staff_recorded" ? "matched" : "clue",
    },
    {
      id: "share",
      label: "家族への共有先 / 届出の役割",
      leftover: `${LEFTOVER_RECORDS.shareTo}へ共有`,
      afterDeath: `届出人 ${ROLES.notifier.name}／申請者 ${ROLES.permitApplicant.name}／持参者 ${ROLES.bearer.name}`,
      kind: "clue",
    },
    {
      id: "docs",
      label: "書類の保管場所 / 受領",
      leftover: LEFTOVER_RECORDS.documentPlace,
      afterDeath:
        state.deathCertificate === "received"
          ? "死亡診断書は受領済み。本籍の公的確認は未了"
          : "死亡診断書は未受領",
      kind: state.deathCertificate === "received" ? "matched" : "waiting",
    },
    {
      id: "cremation",
      label: "火葬場所",
      leftover: LEFTOVER_RECORDS.cremationWish,
      afterDeath:
        state.scheduleStatus === "confirmed"
          ? `${CREMATORY_NAME} ${state.proposedCremationDate}（担当者の確定報告）`
          : "対応可能な日時・予約結果は未確定",
      kind: state.scheduleStatus === "confirmed" ? "matched" : "clue",
    },
  ];
}

export function getMismatchNote(state: DemoState): string | null {
  if (state.nameCheckStatus === "not_compared") {
    return null;
  }
  if (state.nameCheckStatus === "result_received") {
    return NAME_RESULT_BODY;
  }
  return `メモ「${NAME_MEMO}」と死亡診断書「${NAME_ON_CERTIFICATE}」は一致していません。推測では直しません。`;
}

export function recordsEyebrow(): string {
  return `${FAMILY.principal}さんの記録 ／ ${MUNICIPALITY.name}`;
}
