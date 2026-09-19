"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { CostBadge } from "@/components/cost-badge";
import { Card } from "@/components/ui/card";

type View = {
  run: {
    id: string;
    status: string;
    kind: string;
    displayRuntime: string;
    mode: string;
    error: string | null;
    cost: { llmJpy: number | null; apiJpy: number | null; mundaneCalls: number; hardCalls: number; unaccountedCalls: number };
  };
  events: { eventId: string; seq: number; type: string; summary: string; actualModel: string | null; pool: string | null }[];
};

export function RunLogContainer({ runId }: { runId: string }) {
  const [data, setData] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const view = await api<View>(`/api/runs/${runId}`);
        if (!cancelled) setData(view);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "error");
      }
    };
    void load();
    const t = setInterval(() => void load(), 1200);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [runId]);

  if (!data) return <p className="text-ink-soft">{error ?? "読み込み中…"}</p>;
  const c = data.run.cost;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">実行ログ</h1>
      <p className="text-sm text-ink-soft">
        {data.run.kind} / {data.run.status} / {data.run.displayRuntime} / {data.run.mode}
      </p>
      {data.run.error ? <p className="text-sm text-rose">{data.run.error}</p> : null}
      <Card>
        <ol className="space-y-2 text-sm">
          {data.events.map((e) => (
            <li key={e.eventId}>
              <span className="text-ink-soft">{e.type}</span> {e.summary}
              {e.actualModel ? ` (${e.pool}/${e.actualModel})` : ""}
            </li>
          ))}
        </ol>
      </Card>
      <CostBadge llmJpy={c.llmJpy} apiJpy={c.apiJpy} hard={c.hardCalls} mundane={c.mundaneCalls} unaccounted={c.unaccountedCalls} />
    </div>
  );
}
