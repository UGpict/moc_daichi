"use client";

import { useState } from "react";
import { api } from "@/lib/client";

export type PickedPlace = { id: string; name: string; lat: number; lng: number };

export function LocationPicker(props: {
  label: string;
  value: PickedPlace | null;
  onChange: (v: PickedPlace) => void;
}) {
  const [q, setQ] = useState(props.value?.name ?? "");
  const [hits, setHits] = useState<PickedPlace[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function search() {
    setErr(null);
    try {
      const data = await api<{ spots: PickedPlace[]; error?: string }>(`/api/places/search?q=${encodeURIComponent(q)}`);
      setHits(data.spots);
      if (data.error) setErr(data.error);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "search failed");
    }
  }

  return (
    <label className="mt-3 block text-sm">
      {props.label}
      <input
        className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => void search()}
      />
      {props.value ? (
        <p className="mt-1 text-[11px] text-ink-soft">
          確定: {props.value.name} ({props.value.lat.toFixed(5)}, {props.value.lng.toFixed(5)}) / {props.value.id}
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-rose">未解決の自由入力です。候補から選んでください。</p>
      )}
      {err ? <p className="text-xs text-rose">{err}</p> : null}
      {hits.length ? (
        <ul className="mt-1 max-h-40 overflow-auto rounded-xl border border-line bg-card text-sm">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-paper-deep"
                onClick={() => {
                  setQ(h.name);
                  props.onChange(h);
                  setHits([]);
                }}
              >
                {h.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}
