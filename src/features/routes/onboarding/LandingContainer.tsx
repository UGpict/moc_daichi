"use client";

import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeBanner } from "@/components/mode-banner";
import { useAuth } from "@/features/common/auth/AuthContext";

export function LandingContainer() {
  const router = useRouter();
  const { me, loading, signInGuest } = useAuth();

  async function start() {
    const next = me ?? (await signInGuest());
    const onboarded = window.localStorage.getItem(`futari.onboarded.${next.uid}`);
    router.push(onboarded ? "/plans" : "/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center px-6 py-12">
      <p className="text-sm tracking-widest text-rose">FUTARI LOG</p>
      <h1 className="mt-2 text-3xl font-semibold">ふたりログ</h1>
      <p className="mt-3 text-ink-soft">
        二人の希望を調整し、予定が崩れたら組み直し、確かめた記憶を次のデートに活かす。相手はこのアプリを使いません。
      </p>
      {me ? <div className="mt-4"><ModeBanner runtime={me.runtime} /></div> : null}
      <Button className="mt-8 w-full py-3" disabled={loading} onClick={() => void start()}>
        <Heart className="mr-2 h-4 w-4" />
        ゲストではじめる
      </Button>
      {me?.coupleId ? (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => router.push("/plans")}>
          プランを見る
        </Button>
      ) : null}
    </main>
  );
}
