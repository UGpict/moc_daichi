"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TalkPanel } from "@/components/talk-panel";
import { useDemo } from "@/components/demo-provider";
import { Notice, PrimaryLink, SecondaryLink } from "@/components/ui";
import { conversationRoute } from "@/lib/conversation";

export default function TalkPage() {
  const router = useRouter();
  const { state, ready, applyTalk } = useDemo();

  useEffect(() => {
    if (!ready) {
      return;
    }
    const next = conversationRoute(state);
    if (next !== "/demo") {
      router.replace(next);
    }
  }, [ready, router, state]);

  function handleSubmit(value: string) {
    const next = applyTalk(value);
    const route = conversationRoute(next);
    if (route !== "/demo") {
      router.push(route);
    }
  }

  if (!ready) {
    return <p className="text-lg text-ink-soft">読み込んでいます…</p>;
  }

  if (conversationRoute(state) !== "/demo") {
    return <p className="text-lg text-ink-soft">次の画面へ移ります…</p>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Notice>
        体験版です。音声入力は使わず、言葉と短い選択肢で進めます。一度に一つだけ聞きます。
      </Notice>
      <TalkPanel
        state={state}
        onSubmit={handleSubmit}
        speakerLabel={state.viewerRole === "family" ? "健一さん" : "春子さん"}
      />
      {state.talkStep === "paused" && state.memories.length > 0 ? (
        <SecondaryLink href="/demo/summary">いままでのまとめを見る</SecondaryLink>
      ) : null}
      {state.talkStep === "family_ready" ? (
        <PrimaryLink href="/demo/procedure">手続きの続きを見る</PrimaryLink>
      ) : null}
    </div>
  );
}
