"use client";

import { useDemo } from "@/components/demo-provider";
import { canApplyEvent } from "@/lib/events";
import type { DemoEventId } from "@/lib/types";

const TRIGGERS: { id: DemoEventId; label: string }[] = [
  { id: "receive_first_reply", label: "見積の初回返信" },
  { id: "receive_followup_reply", label: "搬送条件の返信" },
  { id: "receive_family_domicile", label: "家族の本籍確認の返事" },
  { id: "receive_schedule_offer", label: "火葬日程の変更案" },
  { id: "receive_schedule_confirm", label: "葬儀社の確定報告" },
  { id: "receive_municipality_inquiry", label: "自治体の不備照会" },
  { id: "receive_staff_will_handle", label: "「対応します」返信" },
  { id: "receive_staff_completed", label: "担当者の完了報告" },
  { id: "receive_municipality_verified", label: "自治体の確認報告" },
  { id: "receive_permit_issued", label: "許可証の交付連絡" },
  { id: "receive_permit_received", label: "受領報告" },
  { id: "receive_permit_handover", label: "引渡し報告" },
];

export function DemoControls() {
  const { state, triggerEvent, startAutoPlay, stopAutoPlay } = useDemo();

  return (
    <details className="rounded-xl border border-line bg-paper-deep">
      <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 py-2 text-base font-medium">
        デモ操作
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <p className="text-sm text-ink-soft">
          固定シナリオの体験版／外部送信なし。自動再生は、承認が必要なところで止まります。
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {state.autoPlay ? (
            <button
              type="button"
              onClick={stopAutoPlay}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-forest px-3 text-base font-medium text-white"
            >
              自動再生を停止
            </button>
          ) : (
            <button
              type="button"
              onClick={startAutoPlay}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-forest px-3 text-base font-medium text-white"
            >
              デモを自動再生
            </button>
          )}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {TRIGGERS.map((item) => {
            const enabled = canApplyEvent(state, item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!enabled}
                  onClick={() => triggerEvent(item.id)}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line bg-card px-3 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
