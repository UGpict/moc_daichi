"use client";

import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeBanner } from "@/components/mode-banner";
import { useAuth } from "@/features/common/auth/AuthContext";

export function LandingContainer() {
  const router = useRouter();
  const { me, loading, signInGuest, signInWithGoogle } = useAuth();

  async function start() {
    const next = me ?? (await signInGuest());
    const onboarded = window.localStorage.getItem(`futari.onboarded.${next.uid}`);
    router.push(onboarded ? "/today" : "/onboarding");
  }

  async function google() {
    try {
      const next = await signInWithGoogle();
      const onboarded = window.localStorage.getItem(`futari.onboarded.${next.uid}`);
      router.push(onboarded ? "/today" : "/onboarding");
    } catch {
      await start();
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center px-6 py-12">
      <p className="text-sm tracking-widest text-rose">FUTARI LOG</p>
      <h1 className="mt-2 text-3xl font-semibold">ふたりログ</h1>
      <p className="mt-3 text-ink-soft">
        一日一回、このエリアの催しや散歩先をまとめて取っておく。デートを作るときはその候補から選ぶので、準備中で待たせない。相手はこのアプリを使いません。
      </p>
      {me ? (
        <div className="mt-4">
          <ModeBanner runtime={me.runtime} countedAs={me.countedAs} providers={me.providers} />
        </div>
      ) : null}
      <Button className="mt-8 w-full py-3" disabled={loading} onClick={() => void start()}>
        <Heart className="mr-2 h-4 w-4" />
        ゲストではじめる
      </Button>
      <Button variant="secondary" className="mt-3 w-full" disabled={loading} onClick={() => void google()}>
        Googleで続ける（利用できる場合）
      </Button>
      {me?.coupleId ? (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => router.push("/today")}>
          今日の候補を見る
        </Button>
      ) : null}
    </main>
  );
}
