"use client";

import { useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { me, loading, error, signInGuest } = useAuth();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (loading) {
    return <div className="px-5 py-16 text-center text-ink-soft">認証を確認しています…</div>;
  }
  if (!me) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-ink-soft">{localError ?? error ?? "未ログインです"}</p>
        <button
          type="button"
          className="mt-4 rounded-full bg-rose px-4 py-2 text-sm text-white disabled:opacity-60"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setLocalError(null);
            void signInGuest()
              .catch((e) => setLocalError(e instanceof Error ? e.message : "ゲストログインに失敗しました"))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "はじめています…" : "ゲストではじめる"}
        </button>
      </div>
    );
  }
  return <div key={me.uid}>{children}</div>;
}
