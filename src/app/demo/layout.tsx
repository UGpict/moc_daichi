import { DemoChrome } from "@/components/demo-chrome";
import { DemoHeader } from "@/components/demo-header";
import { DemoProvider, DemoReady } from "@/components/demo-provider";
import type { ReactNode } from "react";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <DemoProvider>
      <DemoHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <DemoReady>
          <DemoChrome>{children}</DemoChrome>
        </DemoReady>
      </main>
    </DemoProvider>
  );
}
