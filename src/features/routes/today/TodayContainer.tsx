"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/common/auth/AuthContext";
import { CandidateCard, type CandidateItem } from "@/features/common/candidates/CandidateCard";
import { SelectedSpotTray } from "@/features/common/candidates/SelectedSpotTray";

type Today = {
  tokyoDate: string | null;
  fetchedAt: string | null;
  status: string;
  note: string;
  areaName: string | null;
  items: (CandidateItem & { spot: CandidateItem["spot"] & { lat?: number; lng?: number } })[];
};

const picksKey = (uid: string) => `futari.v07.picks.${uid}`;

export function TodayContainer() {
  const { me } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Today | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [intents, setIntents] = useState<Record<string, "MUST_VISIT" | "PREFER_VISIT">>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    let stop = false;
    let ready = false;
    let failed = false;
    const load = async () => {
      try {
        const next = await api<Today>("/api/today");
        if (stop) return;
        setData(next);
        ready = next.status === "READY" && next.items.length > 0;
      } catch (e) {
        failed = true;
        if (!stop) setError(e instanceof Error ? e.message : "error");
      }
    };
    void load();
    const t = setInterval(() => {
      if (!ready && !failed) void load();
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

  async function persistDraft(ids: string[]) {
    if (!me || !data) return;
    const selected = data.items.filter((i) => ids.includes(i.spotId));
    const selectedSpots = selected.map((i) => ({
      spotId: i.spotId,
      name: i.spot.name,
      lat: i.spot.lat ?? 0,
      lng: i.spot.lng ?? 0,
      intent: intents[i.spotId] ?? "PREFER_VISIT",
    }));
    try {
      sessionStorage.setItem(
        picksKey(me.uid),
        JSON.stringify({
          ids,
          names: selected.map((i) => i.spot.name),
          vibes: [...new Set(selected.map((i) => i.vibe))],
          intents: selectedSpots.map((s) => s.intent),
        }),
      );
    } catch {
      /* ignore broken storage */
    }
    await api("/api/drafts", { method: "POST", body: JSON.stringify({ selectedSpots }) });
  }

  async function goPlan() {
    await persistDraft(picked);
    router.push("/plan/new");
  }

  async function goWithoutPicks() {
    if (!me) return;
    try {
      sessionStorage.removeItem(picksKey(me.uid));
    } catch {
      /* ignore */
    }
    await api("/api/drafts", { method: "POST", body: JSON.stringify({ selectedSpots: [], clear: true }) });
    router.push("/plan/new?clearPicks=1");
  }

  const ready = data?.status === "READY" && (data.items?.length ?? 0) > 0;
  const tray = (data?.items ?? [])
    .filter((i) => picked.includes(i.spotId))
    .map((i) => ({
      spotId: i.spotId,
      name: i.spot.name,
      intent: intents[i.spotId] ?? "PREFER_VISIT",
    }));

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
      <SelectedSpotTray
        spots={tray}
        onRemove={(id) => setPicked((c) => c.filter((x) => x !== id))}
        onIntent={(id, intent) => setIntents((m) => ({ ...m, [id]: intent }))}
      />
      {!ready ? (
        <p className="rounded-2xl bg-paper-deep p-4 text-sm text-ink-soft">
          {data?.status === "FETCHING" || !data
            ? "朝の定期取得を待っています。ここで何分も待たせる処理はしません。"
            : "今日の候補はまだ空です。"}
        </p>
      ) : (
        data.items.map((item) => (
          <CandidateCard
            key={item.spotId}
            item={{ ...item, fetchedAt: data.fetchedAt }}
            selected={picked.includes(item.spotId)}
            onToggle={() => toggle(item.spotId)}
          />
        ))
      )}
      <Button className="w-full" disabled={picked.length < 3} onClick={() => void goPlan()}>
        {picked.length < 3 ? "3〜4件選んでデートにする" : `選んだ${picked.length}件でデートをつくる`}
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => void goWithoutPicks()}>
        候補なしで条件だけ入れる
      </Button>
    </div>
  );
}
