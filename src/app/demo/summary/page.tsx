"use client";

import { useRouter } from "next/navigation";
import { useDemo } from "@/components/demo-provider";
import { TalkPanel } from "@/components/talk-panel";
import {
  Card,
  Notice,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
  SecondaryLink,
} from "@/components/ui";
import { getWishSummary } from "@/lib/conversation";

export default function SummaryPage() {
  const router = useRouter();
  const { state, applySummary, applyTalk } = useDemo();
  const summary = getWishSummary(state);
  const correcting =
    state.talkStep === "correct_who" || state.talkStep === "correct_schedule";

  function decide(decision: "confirmed" | "correct" | "deferred") {
    const next = applySummary(decision);
    if (decision === "correct") {
      router.push("/demo");
      return;
    }
    if (next.talkStep === "inquiry_offer") {
      router.push("/demo");
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle eyebrow="お話をまとめました">
        本人が話したことと、しるべの整理を分けています
      </PageTitle>
      <Notice>
        「質素でいい」だけでは、直葬などの形式にはしません。まだ決めなくても、続けられます。
      </Notice>

      {correcting ? (
        <TalkPanel state={state} onSubmit={(value) => {
          const next = applyTalk(value);
          if (next.talkStep === "summary") {
            router.replace("/demo/summary");
          }
        }} />
      ) : (
        <>
          <Card>
            <h2 className="text-xl font-semibold">本人が話した内容</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-lg">
              {summary.said.length > 0 ? (
                summary.said.map((item) => <li key={item}>{item}</li>)
              ) : (
                <li>まだ、言葉としては残っていません</li>
              )}
            </ul>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold">しるべが整理した解釈</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-lg">
              {summary.interpretations.length > 0 ? (
                summary.interpretations.map((item) => <li key={item}>{item}</li>)
              ) : (
                <li>まだ整理していません</li>
              )}
            </ul>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold">本人が確認した希望</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-lg">
              {summary.confirmed.length > 0 ? (
                summary.confirmed.map((item) => <li key={item}>{item}</li>)
              ) : (
                <li>まだ確認前です。「合っている」で確認できます。</li>
              )}
            </ul>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold">まだ決めていないこと</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-lg">
              {summary.undecided.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>

          {summary.hasDirectBurial ? (
            <Notice>直葬を希望として確認しています。</Notice>
          ) : (
            <p className="text-base text-ink-soft">
              直葬などの形式は、本人の確認なしには確定していません。
            </p>
          )}

          <div className="flex flex-col gap-2">
            <PrimaryButton type="button" onClick={() => decide("confirmed")}>
              合っている
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => decide("correct")}>
              直したい
            </SecondaryButton>
            <SecondaryButton type="button" onClick={() => decide("deferred")}>
              まだ決めない
            </SecondaryButton>
            <SecondaryLink href="/demo">会話に戻る</SecondaryLink>
          </div>
        </>
      )}
    </div>
  );
}
