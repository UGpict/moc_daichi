"use client";

import { EstimatePreview } from "@/components/estimate-preview";
import { Card } from "@/components/ui";
import { formatYen } from "@/lib/format";
import { calculateReferenceCost } from "@/lib/cost";
import {
  CREMATION_NEXT_DATE,
  CREMATORY_NAME,
  FAMILY,
  FIRST_REPLY_BODY,
  FOLLOWUP_REPLY_BODY,
  FUNERAL_HOME,
  MUNICIPALITY_INQUIRY_BODY,
  MUNICIPALITY_VERIFIED_BODY,
  PERMIT_CARD,
  SCHEDULE_OFFER_BODY,
  STAFF_COMPLETED_BODY,
  STAFF_WILL_HANDLE_BODY,
} from "@/lib/sample-data";
import type { DemoState, EvidenceId } from "@/lib/types";

const titles: Record<EvidenceId, string> = {
  estimate: "見積書サンプル",
  first_reply: "葬儀社の初回返信",
  followup_reply: "搬送条件の返信",
  schedule_offer: "日程変更の返信",
  municipality_inquiry: "自治体からの照会",
  staff_will_handle: "担当者の対応予定",
  staff_completed: "担当者の完了報告",
  municipality_verified: "自治体の確認報告",
  permit: "許可証カード（デモ・無効）",
};

export function EvidenceBody({
  id,
  state,
}: {
  id: EvidenceId;
  state: DemoState;
}) {
  if (id === "estimate") {
    return <EstimatePreview />;
  }

  if (id === "permit") {
    const breakdown = calculateReferenceCost(state.conditions);
    return (
      <Card>
        <p className="text-sm font-medium text-amber">{PERMIT_CARD.warning}</p>
        <h3 className="mt-3 text-lg font-semibold">{PERMIT_CARD.title}</h3>
        <dl className="mt-3 space-y-2 text-base">
          <div>
            <dt className="text-sm text-ink-soft">番号</dt>
            <dd>{PERMIT_CARD.number}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">故人</dt>
            <dd>{FAMILY.principal}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">火葬場</dt>
            <dd>{CREMATORY_NAME}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">火葬日（案）</dt>
            <dd>{state.proposedCremationDate || CREMATION_NEXT_DATE}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">交付連絡</dt>
            <dd>{state.permit.issued ? "あり" : "まだありません"}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">受領報告</dt>
            <dd>{state.permit.received ? "あり" : "まだありません"}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">引渡し報告</dt>
            <dd>{state.permit.handedOver ? "あり" : "まだありません"}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">いまの参考合計</dt>
            <dd>{formatYen(breakdown.total)}</dd>
          </div>
        </dl>
      </Card>
    );
  }

  const body =
    id === "first_reply"
      ? FIRST_REPLY_BODY
      : id === "followup_reply"
        ? FOLLOWUP_REPLY_BODY
        : id === "schedule_offer"
          ? SCHEDULE_OFFER_BODY
          : id === "municipality_inquiry"
            ? MUNICIPALITY_INQUIRY_BODY
            : id === "staff_will_handle"
              ? STAFF_WILL_HANDLE_BODY
              : id === "staff_completed"
                ? STAFF_COMPLETED_BODY
                : MUNICIPALITY_VERIFIED_BODY;

  return (
    <Card>
      <p className="text-sm text-ink-soft">
        {id === "municipality_inquiry" || id === "municipality_verified"
          ? "架空の自治体からの連絡"
          : `${FUNERAL_HOME.name}（${FUNERAL_HOME.fictionalNote}）`}
      </p>
      <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed">{body}</p>
    </Card>
  );
}

export function EvidenceButton({
  id,
  onOpen,
}: {
  id: EvidenceId;
  onOpen: (id: EvidenceId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(id)}
      className="inline-flex min-h-11 items-center text-sm font-medium text-forest underline-offset-2 hover:underline"
    >
      {titles[id]}を開く
    </button>
  );
}

export function EvidenceDialog({
  id,
  state,
  onClose,
}: {
  id: EvidenceId | null;
  state: DemoState;
  onClose: () => void;
}) {
  if (!id) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-title"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-paper p-4"
      >
        <h2 id="evidence-title" className="text-lg font-semibold">
          {titles[id]}
        </h2>
        <div className="mt-4">
          <EvidenceBody id={id} state={state} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line bg-card text-base font-medium"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
