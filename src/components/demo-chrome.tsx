"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DemoControls } from "@/components/demo-controls";
import { useDemo } from "@/components/demo-provider";
import { ShirubeReport } from "@/components/shirube-report";

export function DemoChrome({ children }: { children: ReactNode }) {
  const { state } = useDemo();
  const pathname = usePathname();
  const onProcedure = pathname === "/demo/procedure";

  return (
    <div className="space-y-5">
      {onProcedure ? null : <ShirubeReport />}
      {children}
      {state.track === "procedure" ? <DemoControls /> : null}
    </div>
  );
}
