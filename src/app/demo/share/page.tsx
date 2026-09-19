"use client";

import { useRouter } from "next/navigation";
import { useDemo } from "@/components/demo-provider";
import {
  Card,
  Notice,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
  SecondaryLink,
} from "@/components/ui";
import { getFamilyPrepBook, getWishSummary } from "@/lib/conversation";
import { FAMILY } from "@/lib/sample-data";

export default function SharePage() {
  const router = useRouter();
  const { state, updateShare, completeShare, switchToFamily } = useDemo();
  const book = getFamilyPrepBook(state);
  const summary = getWishSummary(state);

  function finishShare() {
    completeShare();
  }

  function goFamily() {
    if (!state.share.sharedWithKenichi) {
      completeShare();
    }
    switchToFamily();
    router.push("/demo/family");
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle eyebrow="家族に残す内容">
        誰に、何を残すか、春子さんが選びます
      </PageTitle>
      <Notice>
        私的な相談は、選ばない限り家族の画面に出しません。実際の通知は行いません。
      </Notice>

      <Card>
        <h2 className="text-xl font-semibold">残す相手</h2>
        <label className="mt-3 flex items-start gap-3 text-lg">
          <input
            type="checkbox"
            className="mt-2 h-5 w-5"
            checked={state.share.sharedWithKenichi || state.talkStep === "handover_ready"}
            onChange={(event) =>
              updateShare({ sharedWithKenichi: event.target.checked })
            }
          />
          <span>{FAMILY.child}さん（招待済みの家族）</span>
        </label>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">残す範囲</h2>
        <fieldset className="mt-3 space-y-3 text-lg">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-2 h-5 w-5"
              checked={state.share.includeWishes}
              onChange={(event) => updateShare({ includeWishes: event.target.checked })}
            />
            <span>本人の希望</span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-2 h-5 w-5"
              checked={state.share.includeConfirmed}
              onChange={(event) => updateShare({ includeConfirmed: event.target.checked })}
            />
            <span>確認済みの条件</span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-2 h-5 w-5"
              checked={state.share.includeUndecided}
              onChange={(event) => updateShare({ includeUndecided: event.target.checked })}
            />
            <span>未決定のこと</span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-2 h-5 w-5"
              checked={state.share.includeEstimate}
              onChange={(event) => updateShare({ includeEstimate: event.target.checked })}
            />
            <span>見積もりと外部から確認できた事実</span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-2 h-5 w-5"
              checked={state.share.includePrivate}
              onChange={(event) => updateShare({ includePrivate: event.target.checked })}
            />
            <span>私的な相談（初期状態では共有しません）</span>
          </label>
        </fieldset>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">家族に見える内容</h2>
        <dl className="mt-3 space-y-3 text-lg">
          <div>
            <dt className="text-base text-ink-soft">希望</dt>
            <dd>{book.wishes.join("／") || "共有しない"}</dd>
          </div>
          <div>
            <dt className="text-base text-ink-soft">確認済み</dt>
            <dd>{book.confirmed.join("／") || "共有しない、または未確認"}</dd>
          </div>
          <div>
            <dt className="text-base text-ink-soft">未決定</dt>
            <dd>{book.undecided.join("／") || "共有しない"}</dd>
          </div>
          <div>
            <dt className="text-base text-ink-soft">外部の事実</dt>
            <dd>{book.estimate.join("／") || "共有しない、または未確認"}</dd>
          </div>
        </dl>
        {book.privateHidden ? (
          <p className="mt-3 text-base text-amber">
            「子どもには迷惑をかけたくない」などの私的な相談は、家族画面に出ません。
          </p>
        ) : null}
        {summary.said.some((item) => item.includes("迷惑")) && state.share.includePrivate ? (
          <p className="mt-3 text-base">私的な相談も、今回は共有する設定です。</p>
        ) : null}
      </Card>

      <div className="flex flex-col gap-2">
        {state.talkStep !== "handover_ready" ? (
          <PrimaryButton type="button" onClick={finishShare}>
            この内容で残す
          </PrimaryButton>
        ) : (
          <PrimaryButton type="button" onClick={goFamily}>
            時間が経ちました。家族の画面へ
          </PrimaryButton>
        )}
        {state.talkStep === "handover_ready" ? (
          <SecondaryButton type="button" onClick={goFamily}>
            招待された家族として見る
          </SecondaryButton>
        ) : null}
        <SecondaryLink href="/demo">会話に戻る</SecondaryLink>
      </div>
    </div>
  );
}
