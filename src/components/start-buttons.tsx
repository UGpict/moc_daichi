"use client";

import { PrimaryLink } from "@/components/ui";
import { startPrepStore } from "@/lib/demo-store";

export function StartButtons() {
  return (
    <PrimaryLink href="/demo" onClick={() => startPrepStore()}>
      準備をはじめる
    </PrimaryLink>
  );
}
