"use client";

import { PrimaryLink } from "@/components/ui";
import { startProcedureStore } from "@/lib/demo-store";

export function StartButtons() {
  return (
    <PrimaryLink href="/demo" onClick={() => startProcedureStore()}>
      手続きをはじめる
    </PrimaryLink>
  );
}
