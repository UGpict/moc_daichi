"use client";

import { useState } from "react";
import { SourceChip } from "@/components/mode-banner";
import { formatTokyoHm } from "@/lib/time";
import type { Preference, Snapshot } from "@/lib/types";

function prefLabel(subject: string) {
  if (subject === "SELF") return "自分の希望";
  if (subject === "PARTNER") return "相手の希望";
  return "二人とも";
}

export function SpotCard(props: {
  item: NonNullable<Snapshot["plan"]>["items"][number];
  spot: Snapshot["spots"][string] | undefined;
  prefs: Preference[];
  opening?: string;
  travelMinutes: number | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { item, spot } = props;
  const mins = Math.round((new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) / 60000);
  const matched = props.prefs.filter((p) => item.matchesPreferenceIds.includes(p.id));
  const opening = props.opening ?? "UNKNOWN";
  return (
    <article className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm text-ink-soft">
            {formatTokyoHm(item.startAt)}–{formatTokyoHm(item.endAt)} · 滞在{mins}分
            {props.travelMinutes != null ? ` · 移動${props.travelMinutes}分` : " · 移動不明"}
          </div>
          <h3 className="text-lg font-medium">{spot?.name ?? item.spotId}</h3>
          <p className="text-xs text-ink-soft">{(spot?.categories ?? []).slice(0, 3).join(" / ") || "カテゴリ未取得"}</p>
        </div>
        <div className="flex flex-wrap gap-1 text-[11px]">
          {item.locked ? <span className="rounded-full bg-amber-soft px-2 py-1">時刻固定</span> : null}
          <span className="rounded-full bg-paper-deep px-2 py-1">{item.progress}</span>
          <span className="rounded-full bg-paper-deep px-2 py-1">営業 {opening}</span>
          {spot?.environment.value ? <SourceChip kind="API" /> : <SourceChip kind="UNKNOWN" />}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {matched.map((p) => (
          <span key={p.id} className="rounded-full bg-rose-soft px-2 py-0.5 text-[11px] text-rose">
            {prefLabel(p.subject)}
          </span>
        ))}
      </div>
      {spot?.costForTwoJpy.value ? (
        <p className="mt-2 text-sm text-ink-soft">二人料金 上限¥{spot.costForTwoJpy.value.max}（取得）</p>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">料金不明。予算内とは断定しません</p>
      )}
      <button type="button" className="mt-2 text-sm text-rose" onClick={() => setOpen((v) => !v)}>
        {open ? "根拠を閉じる" : "採用理由と根拠"}
      </button>
      {open ? <p className="mt-1 text-sm">{item.reason}</p> : null}
      {spot?.officialUrl ? (
        <a className="mt-2 block text-sm text-rose underline" href={spot.officialUrl} target="_blank" rel="noreferrer">
          公式サイト
        </a>
      ) : null}
      <button type="button" className="mt-3 rounded-full border border-line px-3 py-1 text-xs" onClick={props.onDone}>
        完了にする
      </button>
    </article>
  );
}
