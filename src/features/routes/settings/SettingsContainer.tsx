"use client";

import { api } from "@/lib/client";
import { useAuth } from "@/features/common/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModeBanner } from "@/components/mode-banner";
import { useState, useEffect } from "react";

export function SettingsContainer() {
  const { me, refresh, signOutUser } = useAuth();
  const [msg, setMsg] = useState<string | null>(null);
  const [areaId, setAreaId] = useState("area:nagoya-station");
  useEffect(() => {
    const stored = localStorage.getItem("futari.areaId");
    if (stored) setAreaId(stored);
    else if (me?.areas?.length) {
      const match = me.areas.find((a) => a.name === me.demoAreaName);
      if (match) setAreaId(match.id);
    }
  }, [me]);
  if (!me) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">設定</h1>
      <ModeBanner runtime={me.runtime} countedAs={me.countedAs} providers={me.providers} />
      <Card>
        <p className="text-sm">UID: {me.uid}</p>
        <p className="text-sm">couple: {me.coupleId ?? "未作成"}</p>
        {me.persist?.kind ? (
          <p className="mt-2 text-sm text-ink-soft">
            persist {me.persist.kind}
            {me.persist.detail ? ` — ${me.persist.detail}` : ""}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-ink-soft">
          集合エリアを切り替えられます。発表会場そのものは未提供です。名古屋駅周辺のデモは残しています。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(me.areas ?? []).map((a) => (
            <button
              key={a.id}
              type="button"
              className={`rounded-full border px-3 py-1 text-sm ${areaId === a.id ? "border-rose bg-rose/10" : "border-line"}`}
              onClick={() => {
                localStorage.setItem("futari.areaId", a.id);
                setAreaId(a.id);
                setMsg(`集合エリアを ${a.name} にしました。次のプラン作成から使います。`);
              }}
            >
              {a.name}
            </button>
          ))}
        </div>
        <ul className="mt-2 text-sm text-ink-soft">
          {(me.areas ?? []).map((a) => (
            <li key={a.id}>
              {a.name}（{a.lat.toFixed(3)}, {a.lng.toFixed(3)}）{areaId === a.id ? " · 選択中" : ""}
            </li>
          ))}
        </ul>
      </Card>
      {me.blockers.length ? (
        <Card>
          <h2 className="font-medium">BLOCKED</h2>
          <ul className="mt-2 text-sm text-ink-soft">
            {me.blockers.map((b) => (
              <li key={b.code}>{b.item}</li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Button
        variant="secondary"
        onClick={async () => {
          await api("/api/demo/reset", { method: "POST", body: JSON.stringify({ keepReplays: true }) });
          await refresh();
          setMsg("自分のデモデータを初期化しました。REPLAYは残しています。");
        }}
      >
        デモデータをリセット
      </Button>
      <Button
        variant="ghost"
        onClick={async () => {
          await signOutUser();
        }}
      >
        ログアウト
      </Button>
      {msg ? <p className="text-sm">{msg}</p> : null}
    </div>
  );
}
