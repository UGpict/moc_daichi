"use client";

import { useEffect, useState } from "react";
import { EvidenceDialog } from "@/components/evidence-dialog";
import { ProcedureConcierge } from "@/components/procedure-concierge";
import { ProcedureDetails } from "@/components/procedure-details";
import { useDemo } from "@/components/demo-provider";
import {
  PageTitle,
  PrimaryButton,
  SecondaryLink,
  StickyActions,
} from "@/components/ui";
import { getProcedureView } from "@/lib/procedure-view";
import type { EvidenceId } from "@/lib/types";

export default function ProcedurePage() {
  const { state, ready, applyAction, startProcedure, startAutoPlay } = useDemo();
  const [evidence, setEvidence] = useState<EvidenceId | null>(null);
  const inProcedure = state.track === "procedure";
  const view = inProcedure ? getProcedureView(state) : null;

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (state.track !== "procedure") {
      startProcedure(state.inquiryStatus === "answers_confirmed");
    }
  }, [ready, state.track, state.inquiryStatus, startProcedure]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-lg text-ink-soft">手続きの準備を読み込んでいます…</p>
      </div>
    );
  }

  if (!inProcedure || !view) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <PageTitle eyebrow="必要になったときの手続き">
          しるべさんと手続きを進める
        </PageTitle>
        <p className="text-lg text-ink-soft">
          事前の希望と見積もりの確認を引き継ぎます。架空のデータで、外部へは送りません。
        </p>
        <PrimaryButton
          type="button"
          onClick={() => startProcedure(state.inquiryStatus === "answers_confirmed")}
        >
          手続きの体験を始める
        </PrimaryButton>
        <SecondaryLink href="/demo">準備に戻る</SecondaryLink>
      </div>
    );
  }

  const primary = view.choices.find((choice) => choice.kind === "primary");

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-28">
      <PageTitle eyebrow="必要になったときの手続き">
        しるべさんと手続きを進める
      </PageTitle>

      <ProcedureConcierge
        state={state}
        onAction={applyAction}
        onStart={startAutoPlay}
        onOpenEvidence={setEvidence}
      />

      <ProcedureDetails state={state} onOpenEvidence={setEvidence} />

      <nav className="space-y-2">
        <SecondaryLink href="/demo">準備に戻る</SecondaryLink>
        <SecondaryLink href="/demo/family">家族向け画面を見る</SecondaryLink>
      </nav>

      {primary ? (
        <StickyActions>
          <PrimaryButton type="button" onClick={() => applyAction(primary.id)}>
            {primary.label}
          </PrimaryButton>
        </StickyActions>
      ) : view.showStart ? (
        <StickyActions>
          <PrimaryButton type="button" onClick={startAutoPlay}>
            手続きの体験を始める
          </PrimaryButton>
        </StickyActions>
      ) : null}

      <EvidenceDialog id={evidence} state={state} onClose={() => setEvidence(null)} />
    </div>
  );
}
