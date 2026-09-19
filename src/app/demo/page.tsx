"use client";

import { useEffect, useState } from "react";
import { EvidenceDialog } from "@/components/evidence-dialog";
import { FamilyNav } from "@/components/family-nav";
import { ProcedureConcierge } from "@/components/procedure-concierge";
import { useDemo } from "@/components/demo-provider";
import { Notice, PageTitle } from "@/components/ui";
import { MUNICIPALITY } from "@/lib/sample-data";
import type { EvidenceId } from "@/lib/types";

export default function ConsultPage() {
  const { state, ready, applyAction, startProcedure } = useDemo();
  const [evidence, setEvidence] = useState<EvidenceId | null>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (state.track !== "procedure") {
      startProcedure(false);
    }
  }, [ready, state.track, startProcedure]);

  if (!ready || state.track !== "procedure") {
    return <p className="text-lg text-ink-soft">手続きの準備を読み込んでいます…</p>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle eyebrow="しるべに相談する">いま必要なことだけ確認します</PageTitle>
      <Notice>{MUNICIPALITY.note}</Notice>
      <ProcedureConcierge
        state={state}
        onAction={applyAction}
        onStart={() => startProcedure(false)}
        onOpenEvidence={setEvidence}
      />
      <FamilyNav />
      <EvidenceDialog id={evidence} state={state} onClose={() => setEvidence(null)} />
    </div>
  );
}
