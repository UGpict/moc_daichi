"use client";

import { useState } from "react";
import { ShirubeAvatar } from "@/components/shirube-avatar";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { getTalkView } from "@/lib/conversation";
import type { DemoState } from "@/lib/types";

export function TalkPanel({
  state,
  onSubmit,
  speakerLabel = "春子さん",
}: {
  state: DemoState;
  onSubmit: (value: string) => void;
  speakerLabel?: string;
}) {
  const view = getTalkView(state);
  const [draft, setDraft] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  function send(value: string) {
    const next = value.trim();
    if (!next) {
      return;
    }
    setDraft("");
    onSubmit(next);
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col items-center text-center">
        <ShirubeAvatar size={96} />
        <p className="mt-3 text-base font-medium text-forest">しるべさん／AIサポート</p>
        <p className="mt-2 text-lg font-semibold leading-relaxed">{view.prompt}</p>
        {view.waiting ? (
          <p className="mt-2 text-base text-ink-soft">返事を待っています…</p>
        ) : null}
      </div>

      <ol className="space-y-3">
        {state.messages
          .filter((message) => state.viewerRole !== "family" || !message.private)
          .map((message) => (
          <li
            key={message.id}
            className={`rounded-xl border px-4 py-3 text-base leading-relaxed ${
              message.from === "shirube"
                ? "border-line bg-card"
                : "border-forest/20 bg-forest-soft"
            }`}
          >
            <p className="text-sm font-medium text-forest">
              {message.from === "shirube" ? "しるべ" : speakerLabel}
              {message.private ? "（私的な相談）" : ""}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{message.text}</p>
          </li>
        ))}
      </ol>

      {view.showInquiryDetails && view.inquiryBody ? (
        <div className="rounded-xl border border-line bg-card px-4 py-3">
          <button
            type="button"
            className="text-base font-medium text-forest underline-offset-2 hover:underline"
            onClick={() => setDetailsOpen((open) => !open)}
          >
            {detailsOpen ? "質問の詳細を閉じる" : "詳しい質問文を見る"}
          </button>
          {detailsOpen ? (
            <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed">
              {view.inquiryBody}
            </p>
          ) : null}
        </div>
      ) : null}

      {view.chips.length > 0 ? (
        <div className="flex flex-col gap-2">
          {view.chips.map((chip) =>
            chip.id === "stop" ? (
              <SecondaryButton key={chip.id} type="button" onClick={() => send(chip.id)}>
                {chip.label}
              </SecondaryButton>
            ) : (
              <PrimaryButton key={chip.id} type="button" onClick={() => send(chip.id)}>
                {chip.label}
              </PrimaryButton>
            ),
          )}
        </div>
      ) : null}

      {view.allowText ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <label className="block">
            <span className="sr-only">文字で答える</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              className="min-h-20 w-full rounded-xl border border-line bg-card px-3 py-3 text-lg"
              placeholder="言葉で答える"
            />
          </label>
          <PrimaryButton type="submit" disabled={!draft.trim()}>
            送る
          </PrimaryButton>
        </form>
      ) : null}
    </section>
  );
}
