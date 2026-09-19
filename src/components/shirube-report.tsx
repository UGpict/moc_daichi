"use client";

import { ShirubeAvatar } from "@/components/shirube-avatar";
import { useDemo } from "@/components/demo-provider";
import { getShirubeReport } from "@/lib/dashboard";

export function ShirubeReport() {
  const { state } = useDemo();
  const report = getShirubeReport(state);

  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <div className="flex items-start gap-3">
        <ShirubeAvatar size={48} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-forest">しるべさん／AIサポート</p>
          <h2 className="mt-1 text-base font-semibold">しるべさんからの報告</h2>
          <p className="mt-2 text-base leading-relaxed">{report.message}</p>
          <p className="mt-2 text-sm text-ink-soft">{report.next}</p>
        </div>
      </div>
    </section>
  );
}
