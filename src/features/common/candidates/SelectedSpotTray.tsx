"use client";

import { Button } from "@/components/ui/button";

export type TraySpot = {
  spotId: string;
  name: string;
  intent: "MUST_VISIT" | "PREFER_VISIT";
};

export function SelectedSpotTray(props: {
  spots: TraySpot[];
  onRemove: (id: string) => void;
  onIntent: (id: string, intent: "MUST_VISIT" | "PREFER_VISIT") => void;
  onEditConditions?: () => void;
}) {
  if (!props.spots.length) {
    return (
      <p className="rounded-2xl bg-paper-deep p-3 text-sm text-ink-soft">
        候補は選んでいません。条件入力へ進みます。
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl border border-line bg-card p-3">
      <p className="text-sm font-medium">選んだ候補</p>
      {props.spots.map((s) => (
        <div key={s.spotId} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="flex-1">{s.name}</span>
          <select
            aria-label={`${s.name} の優先`}
            className="rounded-lg border border-line bg-paper px-2 py-1 text-xs"
            value={s.intent}
            onChange={(e) => props.onIntent(s.spotId, e.target.value as TraySpot["intent"])}
          >
            <option value="PREFER_VISIT">できれば行く</option>
            <option value="MUST_VISIT">必ず行く</option>
          </select>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => props.onRemove(s.spotId)}>
            解除
          </Button>
        </div>
      ))}
      {props.onEditConditions ? (
        <Button variant="secondary" className="w-full" onClick={props.onEditConditions}>
          条件を編集
        </Button>
      ) : null}
    </div>
  );
}
