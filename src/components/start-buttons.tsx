"use client";

import { PrimaryLink, SecondaryLink } from "@/components/ui";
import { startPrepStore, startProcedureStore } from "@/lib/demo-store";

export function StartButtons() {
  return (
    <div className="space-y-3">
      <PrimaryLink href="/demo" className="" onClick={() => startPrepStore()}>
        生前の準備を体験する
      </PrimaryLink>
      <SecondaryLink
        href="/demo/procedure"
        onClick={() => startProcedureStore()}
      >
        家族への引継ぎ・手続きを体験する
      </SecondaryLink>
    </div>
  );
}
