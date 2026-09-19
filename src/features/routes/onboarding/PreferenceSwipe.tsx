"use client";

import { useCallback, useEffect, useState, type PointerEvent } from "react";
import { Heart, X } from "lucide-react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type LikedSpot = { id: string; name: string; vibe: string };

type Card = {
  id: string;
  name: string;
  vibe: string;
  categories: string[];
  photoName: string | null;
  attribution: string | null;
  photoSource: "PLACES" | "NONE";
};

export function PreferenceSwipe(props: {
  subject: "SELF" | "PARTNER";
  liked: LikedSpot[];
  onChange: (liked: LikedSpot[]) => void;
}) {
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api<{ cards: Card[]; note: string }>(`/api/preference-cards?subject=${props.subject}`)
      .then((data) => {
        if (cancelled) return;
        setCards(data.cards);
        setNote(data.note);
        setLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "cards");
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [props.subject]);

  const current = cards[index] ?? null;

  const decide = useCallback(
    (like: boolean) => {
      if (!current) return;
      if (like && !props.liked.some((l) => l.id === current.id)) {
        props.onChange([...props.liked, { id: current.id, name: current.name, vibe: current.vibe }]);
      }
      setDx(like ? 420 : -420);
      window.setTimeout(() => {
        setDx(0);
        setIndex((i) => i + 1);
      }, 180);
    },
    [current, props],
  );

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    (e.currentTarget as HTMLDivElement & { _x?: number })._x = e.clientX;
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const start = (e.currentTarget as HTMLDivElement & { _x?: number })._x ?? e.clientX;
    setDx(e.clientX - start);
  }
  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (dx > 72) decide(true);
    else if (dx < -72) decide(false);
    else setDx(0);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">
        {props.subject === "SELF" ? "自分の希望" : "相手について分かっていること"} · 右が気になる、左が今回はパス。ボタンでも同じです。長期記憶にはしません。
      </p>
      {note ? <p className="text-xs text-ink-soft">{note}</p> : null}
      {error ? <p className="text-sm text-rose">{error}</p> : null}

      <div className="relative mx-auto h-[360px] w-full max-w-[360px] overflow-hidden">
        {current ? (
          <div
            className="absolute inset-0 cursor-grab touch-none select-none rounded-3xl border border-line bg-card shadow-md active:cursor-grabbing"
            style={{
              transform: `translateX(${dx}px) rotate(${dx / 28}deg)`,
              transition: dragging ? "none" : "transform 180ms ease",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <PhotoFace card={current} />
            <div className="space-y-1 px-4 py-3">
              <p className="text-xs text-rose">{current.vibe}</p>
              <h2 className="text-xl font-semibold leading-tight">{current.name}</h2>
              <p className="text-xs text-ink-soft">{current.categories.slice(0, 3).join(" / ") || "カテゴリ未取得"}</p>
              {current.attribution ? (
                <p className="text-[10px] text-ink-soft">写真: {current.attribution}</p>
              ) : null}
            </div>
            <span
              className={cn(
                "absolute left-4 top-4 rounded-full px-3 py-1 text-sm font-medium",
                dx > 40 ? "bg-moss-soft text-moss" : "hidden",
              )}
            >
              気になる
            </span>
            <span
              className={cn(
                "absolute right-4 top-4 rounded-full px-3 py-1 text-sm font-medium",
                dx < -40 ? "bg-rose-soft text-rose" : "hidden",
              )}
            >
              パス
            </span>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-line bg-paper-deep px-4 text-center text-sm text-ink-soft">
            { !loaded ? "候補を読み込み中…" : cards.length === 0 ? "このエリアのカードを取得できませんでした。" : "カードはここまで。下のチップで外せます。"}
          </div>
        )}
      </div>

      <div className="flex justify-center gap-3">
        <Button variant="secondary" className="min-w-28" disabled={!current} onClick={() => decide(false)}>
          <X className="mr-1 h-4 w-4" />
          パス
        </Button>
        <Button className="min-w-28" disabled={!current} onClick={() => decide(true)}>
          <Heart className="mr-1 h-4 w-4" />
          気になる
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {props.liked.length === 0 ? (
          <p className="text-xs text-ink-soft">まだ選んでいません。</p>
        ) : (
          props.liked.map((l) => (
            <button
              key={l.id}
              type="button"
              className="rounded-full bg-rose-soft px-3 py-1 text-xs text-rose"
              onClick={() => props.onChange(props.liked.filter((x) => x.id !== l.id))}
            >
              {l.vibe} · {l.name} ×
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function PhotoFace({ card }: { card: Card }) {
  const [failed, setFailed] = useState(false);
  const src =
    card.photoName && card.photoSource === "PLACES" && !failed
      ? `/api/places/photo?name=${encodeURIComponent(card.photoName)}`
      : null;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-52 w-full rounded-t-3xl object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className="flex h-52 w-full flex-col items-center justify-center rounded-t-3xl bg-paper-deep px-4 text-center">
      <p className="text-4xl" aria-hidden>
        {card.vibe === "展示" ? "🖼️" : card.vibe.includes("甘") || card.vibe === "カフェ" ? "☕" : "🚶"}
      </p>
      <p className="mt-2 text-xs text-ink-soft">写真未取得。店名だけで選びます。</p>
    </div>
  );
}
