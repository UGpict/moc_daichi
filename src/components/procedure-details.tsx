"use client";

import { StatusLabel } from "@/components/status-label";
import { EvidenceButton } from "@/components/evidence-dialog";
import { Card } from "@/components/ui";
import { calculateReferenceCost } from "@/lib/cost";
import { canViewEvidence } from "@/lib/events";
import { formatYen } from "@/lib/format";
import {
  isCaseInquiryResolved,
  isDomicileConfirmed,
  isReservationConfirmed,
} from "@/lib/procedure";
import { CREMATORY_NAME, FAMILY, ROLES } from "@/lib/sample-data";
import type { DemoState, EvidenceId } from "@/lib/types";

function domicileLabel(state: DemoState): string {
  switch (state.domicileStatus) {
    case "unknown":
      return "未確認";
    case "reviewing_sample":
      return "資料を確認中";
    case "sample_provided":
      return "資料の共有済み";
    case "consulting":
    case "consulting_sent":
      return "確認方法の相談中";
    case "consult_replied":
    case "consult_acknowledged":
      return "相談の返事あり";
    case "staff_recorded":
      return "担当者が反映済み";
  }
}

function formLabel(state: DemoState): string {
  switch (state.formStatus) {
    case "not_started":
    case "drafted":
      return "書類案";
    case "mismatch":
      return "日程の確認が必要";
    case "updated":
      return "日付を合わせた書類案";
    case "ready":
      return "提出できる準備";
    case "submit_requested":
      return "提出を依頼済み";
    case "submitted":
      return "提出報告あり";
  }
}

export function ProcedureDetails({
  state,
  onOpenEvidence,
}: {
  state: DemoState;
  onOpenEvidence: (id: EvidenceId) => void;
}) {
  const breakdown = calculateReferenceCost(state.conditions);

  return (
    <details className="rounded-xl border border-line bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 py-3 text-lg font-medium">
        手続き全体・書類を見る
      </summary>
      <div className="space-y-4 px-4 pb-4">
        <p className="text-base text-ink-soft">
          架空のデータです。外部への送信はありません。自治体によって手順は異なります。
        </p>

        <Card>
          <h3 className="text-lg font-semibold">役割</h3>
          <dl className="mt-3 space-y-3">
            {Object.values(ROLES).map((role) => (
              <div key={role.label}>
                <dt className="text-base text-ink-soft">{role.label}</dt>
                <dd className="font-medium">{role.name}</dd>
                <dd className="text-base text-ink-soft">{role.note}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold">書類の受領</h3>
            <StatusLabel
              status={state.deathCertificate === "received" ? "confirmed" : "unconfirmed"}
            />
          </div>
          <p className="mt-2 text-lg">
            死亡診断書：
            {state.deathCertificate === "received" ? "受領済み（サンプル）" : "未確認"}
          </p>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold">本籍</h3>
            <StatusLabel
              status={isDomicileConfirmed(state) ? "confirmed" : "unconfirmed"}
              label={domicileLabel(state)}
            />
          </div>
          <p className="mt-2 text-lg">
            {isDomicileConfirmed(state)
              ? "担当者が申請書案へ反映した、との報告があります。"
              : "本籍の確認が必要です。推測では埋めません。"}
          </p>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold">火葬日程</h3>
            <StatusLabel
              status={
                isReservationConfirmed(state)
                  ? "confirmed"
                  : state.scheduleStatus === "adjusting"
                    ? "waiting"
                    : "unconfirmed"
              }
            />
          </div>
          <dl className="mt-3 space-y-2 text-lg">
            <div>
              <dt className="text-base text-ink-soft">当初の候補</dt>
              <dd>{state.originalCremationDate}</dd>
            </div>
            <div>
              <dt className="text-base text-ink-soft">いまの候補</dt>
              <dd>{state.proposedCremationDate}</dd>
            </div>
            <div>
              <dt className="text-base text-ink-soft">安置日数</dt>
              <dd>{state.conditions.stayDays}日</dd>
            </div>
            <div>
              <dt className="text-base text-ink-soft">参考合計</dt>
              <dd className="font-semibold tabular-nums">
                {formatYen(breakdown.total)}
              </dd>
            </div>
          </dl>
          {canViewEvidence(state, "schedule_offer") ? (
            <EvidenceButton
              id="schedule_offer"
              state={state}
              onOpen={onOpenEvidence}
              label="届いた返信を見る"
            />
          ) : null}
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold">申請書と提出</h3>
            <StatusLabel
              status={state.formStatus === "submitted" ? "confirmed" : "unconfirmed"}
              label={formLabel(state)}
            />
          </div>
          <p className="mt-2 text-lg">申請書案の火葬日：{state.applicationCremationDate}</p>
          <p className="text-lg">火葬場：{CREMATORY_NAME}</p>
          <p className="text-lg">故人：{FAMILY.principal}</p>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold">自治体からの照会</h3>
            <StatusLabel
              status={
                isCaseInquiryResolved(state)
                  ? "confirmed"
                  : state.caseInquiry.received
                    ? "waiting"
                    : "unconfirmed"
              }
            />
          </div>
          {canViewEvidence(state, "municipality_inquiry") ? (
            <EvidenceButton
              id="municipality_inquiry"
              state={state}
              onOpen={onOpenEvidence}
            />
          ) : (
            <p className="mt-2 text-base text-ink-soft">
              提出報告のあと、照会があればここでも確認できます。
            </p>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold">許可証の交付・受領・引渡し</h3>
          <ul className="mt-3 space-y-2 text-lg">
            <li className="flex items-center justify-between gap-3">
              <span>自治体からの交付連絡</span>
              <StatusLabel status={state.permit.issued ? "confirmed" : "unconfirmed"} />
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>佐藤さんによる受領報告</span>
              <StatusLabel status={state.permit.received ? "confirmed" : "unconfirmed"} />
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>火葬場への引渡し報告</span>
              <StatusLabel
                status={state.permit.handedOver ? "confirmed" : "unconfirmed"}
              />
            </li>
          </ul>
          {canViewEvidence(state, "permit") ? (
            <EvidenceButton id="permit" state={state} onOpen={onOpenEvidence} />
          ) : null}
        </Card>
      </div>
    </details>
  );
}
