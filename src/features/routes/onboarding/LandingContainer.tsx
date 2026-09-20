"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeBanner } from "@/components/mode-banner";
import { useAuth } from "@/features/common/auth/AuthContext";

export function LandingContainer() {
  const router = useRouter();
  const { me, error, signInGuest, signInWithGoogle } = useAuth();
  const [starting, setStarting] = useState<"guest" | "google" | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  async function start() {
    setStarting("guest");
    setLocalError(null);
    try {
      const next = me ?? (await signInGuest());
      const onboarded = window.localStorage.getItem(`futari.onboarded.${next.uid}`);
      router.push(onboarded ? "/today" : "/onboarding");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "ゲストログインに失敗しました");
    } finally {
      setStarting(null);
    }
  }

  async function google() {
    setStarting("google");
    setLocalError(null);
    try {
      const next = await signInWithGoogle();
      const onboarded = window.localStorage.getItem(`futari.onboarded.${next.uid}`);
      router.push(onboarded ? "/today" : "/onboarding");
    } catch {
      try {
        const next = me ?? (await signInGuest());
        const onboarded = window.localStorage.getItem(`futari.onboarded.${next.uid}`);
        router.push(onboarded ? "/today" : "/onboarding");
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : "ログインに失敗しました");
      }
    } finally {
      setStarting(null);
    }
  }

  const persistBlocked = me?.persist?.kind && me.persist.kind !== "ok" ? me.persist.detail : null;
  const shownError = localError ?? error ?? persistBlocked;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center px-6 py-12">
      <p className="text-sm tracking-widest text-rose">FUTARI LOG</p>
      <h1 className="mt-2 text-3xl font-semibold">ふたりログ</h1>
      <p className="mt-3 text-ink-soft">
        一日一回、このエリアの催しや散歩先をまとめて取っておく。デートを作るときはその候補から選ぶので、認証待ちで止まらない。相手はこのアプリを使いません。
      </p>
      {me ? (
        <div className="mt-4">
          <ModeBanner runtime={me.runtime} countedAs={me.countedAs} providers={me.providers} />
        </div>
      ) : null}
      {shownError ? <p className="mt-4 text-sm text-rose">{shownError}</p> : null}
      <Button className="mt-8 w-full py-3" disabled={starting !== null} onClick={() => void start()}>
        <Heart className="mr-2 h-4 w-4" />
        {starting === "guest" ? "はじめています…" : "ゲストではじめる"}
      </Button>
      <Button variant="secondary" className="mt-3 w-full" disabled={starting !== null} onClick={() => void google()}>
        {starting === "google" ? "接続しています…" : "Googleで続ける（利用できる場合）"}
      </Button>
      {me?.coupleId ? (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => router.push("/today")}>
          今日の候補を見る
        </Button>
      ) : null}
    </main>
  );
}
