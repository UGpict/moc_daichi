"use client";

import { useEffect, useState } from "react";
import { StatusLabel } from "@/components/status-label";
import { useDemo } from "@/components/demo-provider";
import {
  EvidenceButton,
  EvidenceDialog,
} from "@/components/evidence-dialog";
import {
  Card,
  Notice,
  PageTitle,
  PrimaryButton,
  SecondaryLink,
  StickyActions,
} from "@/components/ui";
import { calculateReferenceCost } from "@/lib/cost";
import { formatYen } from "@/lib/format";
import { canApplyUserAction } from "@/lib/events";
import { isCaseInquiryResolved, isReservationConfirmed } from "@/lib/procedure";
import {
  CREMATORY_NAME,
  FAMILY,
  MUNICIPALITY_CHECK_REQUEST,
  MUNICIPALITY_INQUIRY_BODY,
  ROLES,
  SCHEDULE_ADJUST_REQUEST,
  SCHEDULE_OFFER_BODY,
} from "@/lib/sample-data";
import type { EvidenceId } from "@/lib/types";

export default function ProcedurePage() {
  const { state, applyAction, startProcedure } = useDemo();
  const [evidence, setEvidence] = useState<EvidenceId | null>(null);
  const breakdown = calculateReferenceCost(state.conditions);
  const inProcedure = state.track === "procedure";

  useEffect(() => {
    if (state.track !== "procedure") {
      startProcedure(state.inquiryStatus === "answers_confirmed");
    }
  }, [state.track, state.inquiryStatus, startProcedure]);

  if (!inProcedure) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageTitle eyebrow="家族への引継ぎ・手続き">
          事前準備の内容を引き継いで始めます
        </PageTitle>
        <Notice>
          本人の希望・見積もり・確認済みの条件を引き継ぎます。自治体によって手順は異なり、全国共通の案内ではありません。今回は斎場予約を先に進める固定シナリオです。
        </Notice>
        <PrimaryButton
          type="button"
          onClick={() => startProcedure(state.inquiryStatus === "answers_confirmed")}
        >
          手続きデモを始める
        </PrimaryButton>
        <SecondaryLink href="/demo">案件ホームに戻る</SecondaryLink>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle eyebrow="死亡後の手続き">受領・日程・提出・許可証</PageTitle>
      <Notice>
        自治体によって手順は異なります。全国共通の案内ではありません。今回のデモは、斎場予約を先に進める固定シナリオです。契約や正式な受理をAIが決めることはありません。
      </Notice>

      <Card>
        <h2 className="text-lg font-semibold">役割（混同しない）</h2>
        <dl className="mt-3 space-y-3">
          {Object.values(ROLES).map((role) => (
            <div key={role.label}>
              <dt className="text-sm text-ink-soft">{role.label}</dt>
              <dd className="font-medium">{role.name}</dd>
              <dd className="text-sm text-ink-soft">{role.note}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">1. 書類の受領状況</h2>
          <StatusLabel
            status={state.deathCertificate === "received" ? "confirmed" : "unconfirmed"}
          />
        </div>
        <p className="mt-2 text-base">
          死亡診断書：{state.deathCertificate === "received" ? "受領済み（サンプル）" : "未確認"}
        </p>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">2. 不足情報</h2>
          <StatusLabel
            status={state.domicileStatus === "family_will_attach" ? "waiting" : "unconfirmed"}
            label={
              state.domicileStatus === "family_will_attach" ? "回答待ち" : "未確認"
            }
          />
        </div>
        <p className="mt-2 text-base">
          本籍は空欄です。推測では埋めません。確認先は{ROLES.notifier.name}さんです。
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          {state.domicileStatus === "family_will_attach"
            ? "家族から、戸籍で確認して追記するとの返事があります。記載内容は未入手です。"
            : "戸籍謄本で確認してもらう必要があります。"}
        </p>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">3. 火葬日程</h2>
          <StatusLabel
            status={
              isReservationConfirmed(state)
                ? "confirmed"
                : state.scheduleStatus === "adjusting"
                  ? "waiting"
                  : "unconfirmed"
            }
            label={
              isReservationConfirmed(state)
                ? "確定報告あり"
                : state.scheduleStatus === "awaiting_adjust_approval"
                  ? "未確認"
                  : "回答待ち"
            }
          />
        </div>
        <dl className="mt-3 space-y-2 text-base">
          <div>
            <dt className="text-sm text-ink-soft">当初の候補</dt>
            <dd>{state.originalCremationDate}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">いまの候補</dt>
            <dd>{state.proposedCremationDate}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">安置日数</dt>
            <dd>{state.conditions.stayDays}日</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">参考合計</dt>
            <dd className="font-semibold tabular-nums">{formatYen(breakdown.total)}</dd>
          </div>
        </dl>
        {state.scheduleStatus !== "adjusting" && state.scheduleStatus !== "not_started" ? (
          <p className="mt-3 rounded-lg bg-paper-deep px-3 py-3 text-sm">
            葬儀社の返信：{SCHEDULE_OFFER_BODY}
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">火葬日程は調整中です。行政への提出はまだ行っていません。</p>
        )}
        {state.scheduleStatus === "awaiting_adjust_approval" ? (
          <div className="mt-4 space-y-3">
            <p className="text-base">{SCHEDULE_ADJUST_REQUEST}</p>
            <PrimaryButton
              type="button"
              onClick={() => applyAction("approve_schedule_adjust")}
            >
              この内容で調整を依頼する（デモ）
            </PrimaryButton>
          </div>
        ) : null}
        {state.scheduleStatus === "awaiting_confirm" ? (
          <p className="mt-3 text-sm text-amber">
            調整を依頼済みです。承認だけで予約確定にはしていません。
          </p>
        ) : null}
        {isReservationConfirmed(state) ? (
          <p className="mt-3 text-sm">
            葬儀社から確定報告がありました。契約手続きは別途です。
          </p>
        ) : null}
        <div className="mt-2">
          <EvidenceButton id="schedule_offer" onOpen={setEvidence} />
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">4〜5. 申請書案と提出</h2>
          <StatusLabel
            status={
              state.formStatus === "submitted"
                ? "confirmed"
                : state.formStatus === "mismatch"
                  ? "unconfirmed"
                  : state.formStatus === "updated"
                    ? "waiting"
                    : "unconfirmed"
            }
            label={
              state.formStatus === "submitted"
                ? "提出準備済み"
                : state.formStatus === "mismatch"
                  ? "未確認"
                  : state.formStatus === "updated"
                    ? "確認済み"
                    : "未確認"
            }
          />
        </div>
        <p className="mt-2 text-base">
          申請書案の火葬日：{state.applicationCremationDate}
        </p>
        <p className="text-base">火葬場：{CREMATORY_NAME}</p>
        <p className="text-base">故人：{FAMILY.principal}</p>
        <p className="mt-2 text-sm text-ink-soft">
          本籍欄は空欄です。届出人は{ROLES.notifier.name}、持参者は{ROLES.bearer.name}、火葬許可申請者は
          {ROLES.permitApplicant.name}です。
        </p>
        {state.formStatus === "mismatch" ? (
          <p className="mt-3 text-sm text-amber">
            申請書案の日程と、新しい候補日が一致していません。
          </p>
        ) : null}
        {canApplyUserAction(state, "approve_submit") ? (
          <div className="mt-4">
            <PrimaryButton type="button" onClick={() => applyAction("approve_submit")}>
              提出準備を進める（デモ）
            </PrimaryButton>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">6. 自治体からの照会</h2>
          <StatusLabel
            status={
              isCaseInquiryResolved(state)
                ? "confirmed"
                : state.caseInquiry.received
                  ? "waiting"
                  : "unconfirmed"
            }
            label={
              isCaseInquiryResolved(state)
                ? "確認済み"
                : state.caseInquiry.staffWillHandle && !state.caseInquiry.staffCompleted
                  ? "回答待ち"
                  : state.caseInquiry.received
                    ? "未確認"
                    : "未確認"
            }
          />
        </div>
        {state.caseInquiry.received ? (
          <>
            <p className="mt-2 text-base">{MUNICIPALITY_INQUIRY_BODY}</p>
            <p className="mt-2 text-sm">{MUNICIPALITY_CHECK_REQUEST}</p>
            {state.caseInquiry.staffWillHandle && !state.caseInquiry.staffCompleted ? (
              <p className="mt-3 rounded-lg bg-amber-soft px-3 py-3 text-sm text-amber">
                対応予定の連絡が届きました。修正・確認の完了報告を待っています。
              </p>
            ) : null}
            {canApplyUserAction(state, "approve_municipality_check") ? (
              <div className="mt-4">
                <PrimaryButton
                  type="button"
                  onClick={() => applyAction("approve_municipality_check")}
                >
                  葬儀社へ確認する（デモ）
                </PrimaryButton>
              </div>
            ) : null}
            <EvidenceButton id="municipality_inquiry" onOpen={setEvidence} />
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">
            提出後に照会があれば表示します。AIが正式な受理を決めることはありません。
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">7〜8. 許可証の交付・受領・引渡し</h2>
        <ul className="mt-3 space-y-2">
          <li className="flex items-center justify-between gap-3">
            <span>自治体からの交付連絡</span>
            <StatusLabel
              status={state.permit.issued ? "confirmed" : "unconfirmed"}
            />
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>担当者による受領報告</span>
            <StatusLabel
              status={state.permit.received ? "confirmed" : "unconfirmed"}
            />
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>火葬場への引渡し報告</span>
            <StatusLabel
              status={state.permit.handedOver ? "confirmed" : "unconfirmed"}
            />
          </li>
        </ul>
        {state.permit.handedOver ? (
          <p className="mt-3 font-medium text-forest">
            火葬許可証の受領と、火葬場への引渡しを確認しました。
          </p>
        ) : null}
        <p className="mt-2 text-sm text-ink-soft">
          この体験は許可証の受領と引渡しの確認までです。実施や式の完了は扱いません。
        </p>
        <EvidenceButton id="permit" onOpen={setEvidence} />
      </Card>

      <StickyActions>
        <SecondaryLink href="/demo">案件ホームに戻る</SecondaryLink>
        <SecondaryLink href="/demo/family">家族向け画面を見る</SecondaryLink>
      </StickyActions>

      <EvidenceDialog id={evidence} state={state} onClose={() => setEvidence(null)} />
    </div>
  );
}
