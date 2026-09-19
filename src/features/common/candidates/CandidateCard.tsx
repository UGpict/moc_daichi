"use client";

import { api } from "@/lib/client";
import { cn } from "@/lib/cn";

export type CandidateItem = {
  spotId: string;
  vibe: string;
  kind: "HAPPENING" | "PLACE";
  displayKind?: "PLACE" | "VENUE" | "CONFIRMED_EVENT";
  why: string;
  query: string;
  fetchedAt?: string | null;
  spot: {
    id: string;
    name: string;
    categories: string[];
    photoName: string | null;
    photoAttribution: string | null;
  };
};

export function CandidateCard(props: {
  item: CandidateItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const { item, selected, onToggle } = props;
  const src = item.spot.photoName ? `/api/places/photo?name=${encodeURIComponent(item.spot.photoName)}` : null;
  const kindLabel =
    item.displayKind === "CONFIRMED_EVENT"
      ? "開催確認済み"
      : item.displayKind === "VENUE" || item.kind === "HAPPENING"
        ? "会場候補（開催未確認）"
        : "周辺スポット";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "w-full overflow-hidden rounded-2xl border bg-card text-left shadow-sm",
        selected ? "border-rose ring-2 ring-rose/30" : "border-line",
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-24 items-center justify-center bg-paper-deep text-xs text-ink-soft">写真未取得</div>
      )}
      <div className="space-y-1 px-4 py-3">
        <div className="flex flex-wrap gap-1 text-[11px]">
          <span className="rounded-full bg-rose-soft px-2 py-0.5 text-rose">{item.vibe}</span>
          <span className="rounded-full bg-paper-deep px-2 py-0.5">{kindLabel}</span>
          {selected ? <span className="rounded-full bg-moss-soft px-2 py-0.5 text-moss">デートに使う</span> : null}
        </div>
        <h2 className="text-lg font-medium">{item.spot.name}</h2>
        <p className="text-xs text-ink-soft">{item.why}</p>
        {item.fetchedAt ? <p className="text-[10px] text-ink-soft">取得 {item.fetchedAt}</p> : null}
        {item.spot.photoAttribution ? (
          <p className="text-[10px] text-ink-soft">写真: {item.spot.photoAttribution}</p>
        ) : null}
      </div>
    </button>
  );
}

void api;
