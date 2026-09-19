"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/common/auth/AuthContext";
import { cn } from "@/lib/cn";

type Item = {
  spotId: string;
  vibe: string;
  kind: "HAPPENING" | "PLACE";
  why: string;
  query: string;
  spot: {
    id: string;
    name: string;
    categories: string[];
    photoName: string | null;
    photoAttribution: string | null;
  };
};

type Today = {
  tokyoDate: string | null;
  fetchedAt: string | null;
  status: string;
  note: string;
  areaName: string | null;
  items: Item[];
};

export function TodayContainer() {
  const { me } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Today | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    let stop = false;
    let ready = false;
    const load = async () => {
      try {
        const next = await api<Today>("/api/today");
        if (stop) return;
        setData(next);
        ready = next.status === "READY" && next.items.length > 0;
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "error");
      }
    };
    void load();
    const t = setInterval(() => {
      if (!ready) void load();
    }, 800);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [me]);

  function toggle(id: string) {
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 4) return cur;
      return [...cur, id];
    });
  }

  function goPlan() {
    if (!me) return;
    const selected = (data?.items ?? []).filter((i) => picked.includes(i.spotId));
    window.sessionStorage.setItem(
      `futari.picks.${me.uid}`,
      JSON.stringify({
        ids: picked,
        names: selected.map((i) => i.spot.name),
        vibes: [...new Set(selected.map((i) => i.vibe))],
      }),
    );
    router.push("/plan/new");
  }

  const ready = data?.status === "READY" && (data.items?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">今日の候補</h1>
        <p className="text-sm text-ink-soft">
          {data?.areaName ?? "エリア"} · {data?.tokyoDate ?? "日付待ち"} · 一日一回まとめて取得します。デートのたびに探さないので待ちません。
        </p>
        <p className="mt-1 text-xs text-ink-soft">{data?.note}</p>
        {data?.fetchedAt ? <p className="text-xs text-ink-soft">取得 {data.fetchedAt}</p> : null}
      </div>
      {error ? <p className="text-sm text-rose">{error}</p> : null}
      {!ready ? (
        <p className="rounded-2xl bg-paper-deep p-4 text-sm text-ink-soft">
          {data?.status === "FETCHING" || !data
            ? "朝の定期取得を待っています。ここで何分も待たせる処理はしません。"
            : "今日の候補はまだ空です。"}
        </p>
      ) : (
        data.items.map((item) => {
          const on = picked.includes(item.spotId);
          const src = item.spot.photoName
            ? `/api/places/photo?name=${encodeURIComponent(item.spot.photoName)}`
            : null;
          return (
            <button
              key={item.spotId}
              type="button"
              onClick={() => toggle(item.spotId)}
              className={cn(
                "w-full overflow-hidden rounded-2xl border bg-card text-left shadow-sm",
                on ? "border-rose ring-2 ring-rose/30" : "border-line",
              )}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-24 items-center justify-center bg-paper-deep text-xs text-ink-soft">
                  写真未取得
                </div>
              )}
              <div className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap gap-1 text-[11px]">
                  <span className="rounded-full bg-rose-soft px-2 py-0.5 text-rose">{item.vibe}</span>
                  <span className="rounded-full bg-paper-deep px-2 py-0.5">
                    {item.kind === "HAPPENING" ? "催し検索" : "周辺"}
                  </span>
                  {on ? <span className="rounded-full bg-moss-soft px-2 py-0.5 text-moss">デートに使う</span> : null}
                </div>
                <h2 className="text-lg font-medium">{item.spot.name}</h2>
                <p className="text-xs text-ink-soft">{item.why}</p>
                {item.spot.photoAttribution ? (
                  <p className="text-[10px] text-ink-soft">写真: {item.spot.photoAttribution}</p>
                ) : null}
              </div>
            </button>
          );
        })
      )}
      <Button className="w-full" disabled={picked.length < 3} onClick={goPlan}>
        {picked.length < 3 ? "3〜4件選んでデートにする" : `選んだ${picked.length}件でデートをつくる`}
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => router.push("/plan/new")}>
        候補なしで条件だけ入れる
      </Button>
    </div>
  );
}
