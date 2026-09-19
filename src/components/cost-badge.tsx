"use client";

import { FX } from "@/config/settings";

export function CostBadge(props: {
  llmJpy: number | null;
  apiJpy: number | null;
  hard: number;
  mundane: number;
  unaccounted: number;
  replay?: boolean;
}) {
  const total =
    props.llmJpy != null || props.apiJpy != null
      ? (props.llmJpy ?? 0) + (props.apiJpy ?? 0)
      : null;
  const label = props.replay ? "収録時のコスト" : "今回の概算";
  const amount =
    total == null
      ? `集計可能分・未計上${props.unaccounted}回`
      : `¥${total}・高性能${props.hard}回／安価${props.mundane}回`;
  return (
    <div
      className="pointer-events-none max-w-xs rounded-2xl border border-line bg-card/95 px-3 py-1.5 text-sm shadow-md"
      style={{ position: "fixed", right: 12, bottom: 84, zIndex: 20 }}
    >
      <div className="text-[11px] text-ink-soft">{label}</div>
      <div className="font-medium leading-tight">{amount}</div>
      <div className="text-[10px] text-ink-soft">
        換算 {FX.usdJpy}円/USD（{FX.asOf}）
      </div>
    </div>
  );
}
