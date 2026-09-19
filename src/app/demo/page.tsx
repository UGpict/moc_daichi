"use client";

import { useState } from "react";
import { ProgressSteps } from "@/components/progress-steps";
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
  PrimaryLink,
  SecondaryLink,
} from "@/components/ui";
import {
  getActivity,
  getApprovals,
  getInProgress,
  getOverallSteps,
  getWaiting,
} from "@/lib/dashboard";
import { formatYen } from "@/lib/format";
import { FAMILY, FUNERAL_HOME, WISHES } from "@/lib/sample-data";
import type { EvidenceId } from "@/lib/types";

export default function DemoHomePage() {
  const { state, applyAction } = useDemo();
  const [evidence, setEvidence] = useState<EvidenceId | null>(null);
  const approvals = getApprovals(state);
  const inProgress = getInProgress(state);
  const waiting = getWaiting(state);
  const activity = getActivity(state);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle eyebrow="案件のいま">しるべさんが進めている準備</PageTitle>
      <p className="text-base text-ink-soft">
        見積もりの照合や再計算は自動で進めています。外部への問い合わせと提出だけ、内容を見て承認してください。
      </p>

      <Card>
        <h2 className="text-lg font-semibold">あなたに確認してほしいこと</h2>
        {approvals.length === 0 ? (
          <p className="mt-3 text-base text-ink-soft">
            いま承認が必要な外部連絡はありません。
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {approvals.map((item) => (
              <li key={item.id} className="space-y-2">
                <PrimaryButton type="button" onClick={() => applyAction(item.id)}>
                  {item.label}
                </PrimaryButton>
                <SecondaryLink href={item.href}>内容を見てから判断する</SecondaryLink>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">しるべさんが進めていること</h2>
        <ul className="mt-3 space-y-3">
          {inProgress.map((item) => (
            <li key={item.id}>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-ink-soft">{item.detail}</p>
              {item.evidenceId ? (
                <EvidenceButton id={item.evidenceId} onOpen={setEvidence} />
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">相手の回答を待っていること</h2>
        {waiting.length === 0 ? (
          <p className="mt-3 text-base text-ink-soft">いま待っている返信はありません。</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {waiting.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-ink-soft">{item.detail}</p>
                </div>
                <StatusLabel status="waiting" />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">活動履歴</h2>
        <ul className="mt-3 space-y-4">
          {activity.map((item) => (
            <li key={item.id} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm">確認したこと：{item.checked}</p>
              <p className="text-sm">分かったこと：{item.found}</p>
              <p className="text-sm text-ink-soft">
                未解決：{item.unresolved ?? "いまは残っていません"}
              </p>
              {item.evidenceId ? (
                <EvidenceButton id={item.evidenceId} onOpen={setEvidence} />
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">進み具合</h2>
        <div className="mt-4">
          <ProgressSteps steps={getOverallSteps(state)} />
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">このサンプルの前提</h2>
        <dl className="mt-3 space-y-2 text-base">
          <div>
            <dt className="text-sm text-ink-soft">だれが準備しているか</dt>
            <dd>
              {FAMILY.principal}さんと、子ども世代の{FAMILY.child}さん
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">希望</dt>
            <dd>{WISHES.style}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">予算の目安</dt>
            <dd>{formatYen(WISHES.budgetYen)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">見積書</dt>
            <dd>
              {FUNERAL_HOME.name}（{FUNERAL_HOME.fictionalNote}）1社分
            </dd>
          </div>
        </dl>
      </Card>

      <Notice>
        契約・支払い・日程確定を、しるべさんが独断で行うことはありません。自治体によって手順は異なります。
      </Notice>

      <div className="flex flex-col gap-2">
        <PrimaryLink href={state.track === "procedure" ? "/demo/procedure" : "/demo/estimate"}>
          {state.track === "procedure" ? "手続きの明細を見る" : "見積書と確認項目を見る"}
        </PrimaryLink>
        {state.inquiryStatus === "answers_confirmed" ? (
          <SecondaryLink href="/demo/family">家族向けの準備書を見る</SecondaryLink>
        ) : null}
      </div>

      <EvidenceDialog id={evidence} state={state} onClose={() => setEvidence(null)} />
    </div>
  );
}
