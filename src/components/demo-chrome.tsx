"use client";

import type { ReactNode } from "react";
import { DemoControls } from "@/components/demo-controls";
import { useDemo } from "@/components/demo-provider";
import { ShirubeReport } from "@/components/shirube-report";

export function DemoChrome({ children }: { children: ReactNode }) {
  const { state } = useDemo();

  return (
    <div className="space-y-5">
      <ShirubeReport />
      {state.track === "procedure" ? <DemoControls /> : null}
      {children}
    </div>
  );
}
