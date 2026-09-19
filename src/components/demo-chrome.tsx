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
  const familyFirst =
    pathname === "/demo" ||
    pathname === "/demo/records" ||
    pathname === "/demo/tasks" ||
    pathname === "/demo/family" ||
    pathname === "/demo/summary" ||
    pathname === "/demo/share";

  return (
    <div className="space-y-5">
      {onProcedure || familyFirst ? null : <ShirubeReport />}
      {children}
      {state.track === "procedure" ? <DemoControls /> : null}
    </div>
  );
}
