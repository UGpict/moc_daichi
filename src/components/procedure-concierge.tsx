"use client";

import { EvidenceButton } from "@/components/evidence-dialog";
import { ShirubeAvatar } from "@/components/shirube-avatar";
import { Card, PrimaryButton, SecondaryButton } from "@/components/ui";
import {
  consultDraftBody,
  familyConsultSummary,
  getProcedureView,
  scheduleChangeLines,
  scheduleRequestSummary,
} from "@/lib/procedure-view";
import {
  DOMICILE_SAMPLE_NOTE,
  FUNERAL_HOME,
  NAME_CHECK_DRAFT,
  NAME_MEMO,
  NAME_ON_CERTIFICATE,
} from "@/lib/sample-data";
import type { DemoState, EvidenceId, UserActionId } from "@/lib/types";

export function ProcedureConcierge({
  state,
  onAction,
  onStart,
  onOpenEvidence,
}: {
  state: DemoState;
  onAction: (action: UserActionId) => void;
  onStart: () => void;
  onOpenEvidence: (id: EvidenceId) => void;
}) {
  const view = getProcedureView(state);

  return (
    <section className="space-y-5">
      <div className="flex items-start gap-4">
        <ShirubeAvatar size={88} />
        <div className="min-w-0">
          <p className="text-base font-medium text-forest">しるべさん／AIサポート</p>
          <p className="mt-2 text-lg font-semibold leading-relaxed">{view.prompt}</p>
          {view.detail ? (
            <p className="mt-2 text-base leading-relaxed text-ink-soft">{view.detail}</p>
          ) : null}
        </div>
      </div>

      {view.showStart ? (
        <PrimaryButton type="button" onClick={onStart}>
          手続きの体験を始める
        </PrimaryButton>
      ) : null}

      {view.nameCertificate ? (
        <Card>
          <h2 className="text-xl font-semibold">照合した氏名</h2>
          <p className="mt-3 text-lg">本人メモ（手掛かり）：{NAME_MEMO}</p>
          <p className="mt-2 text-lg">死亡診断書：{NAME_ON_CERTIFICATE}</p>
          <p className="mt-2 text-base text-ink-soft">推測して、どちらかに揃えません。</p>
        </Card>
      ) : null}

      {view.nameDraft ? (
        <Card>
          <h2 className="text-xl font-semibold">担当者へ確認する内容</h2>
          <p className="mt-2 text-base text-ink-soft">
            宛先：{FUNERAL_HOME.name}（{FUNERAL_HOME.fictionalNote}）／{FUNERAL_HOME.staff}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed">{NAME_CHECK_DRAFT}</p>
        </Card>
      ) : null}

      {view.sampleNote ? (
        <Card>
          <h2 className="text-xl font-semibold">{DOMICILE_SAMPLE_NOTE.title}</h2>
          <p className="mt-3 text-lg">{DOMICILE_SAMPLE_NOTE.domicile}</p>
          <p className="mt-2 text-base text-ink-soft">{DOMICILE_SAMPLE_NOTE.note}</p>
        </Card>
      ) : null}

      {view.consultDraft ? (
        <Card>
          <h2 className="text-xl font-semibold">相談する内容</h2>
          <p className="mt-2 text-base text-ink-soft">
            宛先：{FUNERAL_HOME.name}（{FUNERAL_HOME.fictionalNote}）／{FUNERAL_HOME.staff}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed">
            {consultDraftBody()}
          </p>
        </Card>
      ) : null}

      {view.consultReply ? (
        <Card>
          <h2 className="text-xl font-semibold">担当者からの返事</h2>
          <p className="mt-3 text-lg leading-relaxed">{view.detail}</p>
        </Card>
      ) : null}

      {view.scheduleReport ? (
        <Card>
          <h2 className="text-xl font-semibold">変更の内容</h2>
          <dl className="mt-3 divide-y divide-line border-y border-line">
            {scheduleChangeLines(state).map((line) => (
              <div
                key={line.label}
                className="flex items-start justify-between gap-3 py-3 text-lg"
              >
                <dt className="text-ink-soft">{line.label}</dt>
                <dd className="text-right font-medium">
                  {line.from} → {line.to}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-base">{scheduleRequestSummary(state)}</p>
        </Card>
      ) : null}

      {view.familyPause ? (
        <Card>
          <h2 className="text-xl font-semibold">家族に相談する内容</h2>
          <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed">
            {familyConsultSummary(state)}
          </p>
        </Card>
      ) : null}

      {view.choices.length > 0 ? (
        <div className="space-y-2">
          {view.choices.map((choice) =>
            choice.kind === "primary" ? (
              <PrimaryButton
                key={choice.id}
                type="button"
                onClick={() => onAction(choice.id)}
              >
                {choice.label}
              </PrimaryButton>
            ) : (
              <SecondaryButton
                key={choice.id}
                type="button"
                onClick={() => onAction(choice.id)}
              >
                {choice.label}
              </SecondaryButton>
            ),
          )}
        </div>
      ) : null}

      {view.waiting ? (
        <p className="rounded-xl border border-line bg-card px-4 py-3 text-lg text-ink-soft">
          {view.waiting}
        </p>
      ) : null}

      {view.progress.length > 0 ? (
        <Card>
          <h2 className="text-xl font-semibold">こちらで進めています</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-lg">
            {view.progress.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {view.evidenceId ? (
        <EvidenceButton
          id={view.evidenceId}
          state={state}
          onOpen={onOpenEvidence}
          label={
            view.evidenceId === "schedule_offer"
              ? "届いた返信を見る"
              : undefined
          }
        />
      ) : null}

      {state.autoPlay && !view.done ? (
        <p className="text-base text-ink-soft">
          自動進行は演出です。実際の通信やAI処理ではありません。
        </p>
      ) : null}
    </section>
  );
}
