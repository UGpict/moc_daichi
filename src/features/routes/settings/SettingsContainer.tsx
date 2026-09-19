"use client";

import { api } from "@/lib/client";
import { useAuth } from "@/features/common/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModeBanner } from "@/components/mode-banner";
import { useState } from "react";

export function SettingsContainer() {
  const { me, refresh, signOutUser } = useAuth();
  const [msg, setMsg] = useState<string | null>(null);
  if (!me) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">設定</h1>
      <ModeBanner runtime={me.runtime} />
      <Card>
        <p className="text-sm">UID: {me.uid}</p>
        <p className="text-sm">couple: {me.coupleId ?? "未作成"}</p>
        <p className="mt-2 text-sm text-ink-soft">
          開発デモの集合は {me.demoAreaName}（{me.demoDate}）。東京の発表会場は未提供です。
        </p>
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
