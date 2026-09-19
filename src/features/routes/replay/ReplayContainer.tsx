"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CostBadge } from "@/components/cost-badge";
import { ModeBanner } from "@/components/mode-banner";

type Replay = {
  replay: {
    id: string;
    events: { eventId: string; seq: number; type: string; summary: string }[];
    plan: { items: { id: string; spotId: string; startAt: string; endAt: string; reason: string }[] } | null;
    spots: { id: string; name: string }[];
    costSnapshot: {
      llmJpy: number | null;
      apiJpy: number | null;
      mundaneCalls: number;
      hardCalls: number;
      unaccountedCalls: number;
    };
    notes: string;
  };
};

export function ReplayContainer({ replayId }: { replayId: string }) {
  const [data, setData] = useState<Replay["replay"] | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    void api<Replay>(`/api/replays/${replayId}`).then((r) => setData(r.replay));
  }, [replayId]);

  useEffect(() => {
    if (!playing || !data) return;
    const t = setInterval(() => setIndex((i) => Math.min(i + 1, data.events.length - 1)), 700);
    return () => clearInterval(t);
  }, [playing, data]);

  if (!data) return <p className="text-ink-soft">読み込み中…</p>;
  const visible = data.events.slice(0, index + 1);
  const spots = Object.fromEntries(data.spots.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-4">
      <ModeBanner runtime="REPLAY" replay />
      <h1 className="text-2xl font-semibold">REPLAY</h1>
      <p className="text-sm text-ink-soft">{data.notes}</p>
      <div className="flex gap-2">
        <Button onClick={() => setPlaying((p) => !p)}>{playing ? "停止" : "再生"}</Button>
        <Button variant="secondary" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
          戻る
        </Button>
        <Button variant="secondary" onClick={() => setIndex((i) => Math.min(data.events.length - 1, i + 1))}>
          進む
        </Button>
      </div>
      <ol className="space-y-2 text-sm">
        {visible.map((e) => (
          <li key={e.eventId} className="rounded-xl bg-card p-3">
            <span className="text-ink-soft">{e.type}</span> {e.summary}
          </li>
        ))}
      </ol>
      {data.plan ? (
        <Card>
          <h2 className="font-medium">収録時の行程</h2>
          <ul className="mt-2 text-sm">
            {data.plan.items.map((it) => (
              <li key={it.id}>
                {spots[it.spotId] ?? it.spotId} {it.startAt}–{it.endAt}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <CostBadge
        replay
        llmJpy={data.costSnapshot.llmJpy}
        apiJpy={data.costSnapshot.apiJpy}
        hard={data.costSnapshot.hardCalls}
        mundane={data.costSnapshot.mundaneCalls}
        unaccounted={data.costSnapshot.unaccountedCalls}
      />
    </div>
  );
}
