"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useAuth } from "@/features/common/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Mem = {
  id: string;
  content: string;
  active: boolean;
  strength: string;
  sourceType: string;
  evidenceQuote: string;
  confirmation: string;
  version: number;
  subject?: string;
};
type Cand = { id: string; content: string; evidenceQuote: string };

export function MemoryContainer() {
  const { me, refresh } = useAuth();
  const [memories, setMemories] = useState<Mem[]>([]);
  const [candidates, setCandidates] = useState<Cand[]>([]);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  async function load(coupleId: string) {
    const data = await api<{ memories: Mem[]; candidates: Cand[] }>(`/api/couples/${coupleId}/memory`);
    setMemories(data.memories);
    setCandidates(data.candidates);
  }

  useEffect(() => {
    if (!me) return;
    void (async () => {
      let coupleId = me.coupleId;
      if (!coupleId) {
        const created = await api<{ id: string }>("/api/couples", { method: "POST", body: JSON.stringify({ isDemo: true }) });
        coupleId = created.id;
        await refresh();
      }
      await load(coupleId);
    })();
  }, [me, refresh]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">ふたりのメモ</h1>
      <p className="text-sm text-ink-soft">
        確認回答は承認ではありません。保存する具体文への明示承認で初めて記憶になります。visibility=PRIVATE。
      </p>
      {msg ? <p className="text-sm">{msg}</p> : null}
      {memories.map((m) => (
        <Card key={m.id}>
          <div className="text-xs text-ink-soft">
            {m.subject ?? "—"} / {m.active ? "有効" : "無効"} / {m.strength} / {m.sourceType} / {m.confirmation} / v{m.version}
          </div>
          <p className="mt-1">{m.content}</p>
          <p className="mt-1 text-sm text-ink-soft">根拠: {m.evidenceQuote}</p>
          <textarea
            className="mt-3 w-full rounded-xl border border-line bg-paper p-2 text-sm"
            value={edit[m.id] ?? m.content}
            onChange={(e) => setEdit({ ...edit, [m.id]: e.target.value })}
          />
          <div className="mt-2 flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                await api(`/api/memory/${m.id}/revisions`, {
                  method: "POST",
                  body: JSON.stringify({ content: edit[m.id] ?? m.content }),
                });
                setMsg("編集候補を作りました。再承認が必要です。");
                if (me?.coupleId) await load(me.coupleId);
              }}
            >
              編集して再承認
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await api(`/api/memory/${m.id}/deactivate`, { method: "POST", body: "{}" });
                if (me?.coupleId) await load(me.coupleId);
              }}
            >
              無効化
            </Button>
          </div>
        </Card>
      ))}
      {candidates.map((c) => (
        <Card key={c.id}>
          <div className="text-xs text-ink-soft">候補（未承認）</div>
          <p>{c.content}</p>
          <p className="text-sm text-ink-soft">根拠: {c.evidenceQuote}</p>
        </Card>
      ))}
    </div>
  );
}
