"use client";

import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { me, loading, error, signInGuest } = useAuth();

  if (loading) {
    return <div className="px-5 py-16 text-center text-ink-soft">認証を確認しています…</div>;
  }
  if (!me) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-ink-soft">{error ?? "未ログインです"}</p>
        <button
          type="button"
          className="mt-4 rounded-full bg-rose px-4 py-2 text-sm text-white"
          onClick={() => void signInGuest()}
        >
          ゲストではじめる
        </button>
      </div>
    );
  }
  return <div key={me.uid}>{children}</div>;
}
