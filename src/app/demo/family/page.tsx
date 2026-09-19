"use client";

import { TalkPanel } from "@/components/talk-panel";
import { useDemo } from "@/components/demo-provider";
import {
  Card,
  Notice,
  PageTitle,
  PrimaryLink,
  SecondaryLink,
} from "@/components/ui";
import {
  buildFamilyScheduleProposal,
  familyCanSeePrivateConsult,
  getFamilyPrepBook,
} from "@/lib/conversation";
import { FAMILY, FAMILY_HANDOVER_DATE, FUNERAL_HOME } from "@/lib/sample-data";

export default function FamilyPage() {
  const { state, applyTalk, startProcedure } = useDemo();
  const book = getFamilyPrepBook(state);
  const proposal = buildFamilyScheduleProposal(state);
  const privateVisible = familyCanSeePrivateConsult(state);

  function handleSubmit(value: string) {
    applyTalk(value);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle eyebrow="家族の画面">
        {FAMILY.principal}さんから引き継いだ内容
      </PageTitle>
      <Notice>
        {FAMILY_HANDOVER_DATE}（デモ：時間が経ちました）。招待済みの家族として見ています。本人の発言は、家族が直しても上書きしません。
      </Notice>

      <Card>
        <h2 className="text-xl font-semibold">本人の希望</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-lg">
          {book.wishes.length > 0 ? (
            book.wishes.map((item) => <li key={item}>{item}</li>)
          ) : (
            <li>共有された希望はありません</li>
          )}
        </ul>
        {book.reasons.length > 0 ? (
          <p className="mt-3 text-base text-ink-soft">理由：{book.reasons.join("／")}</p>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">確認済みの条件</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-lg">
          {book.confirmed.length > 0 ? (
            book.confirmed.map((item) => <li key={item}>{item}</li>)
          ) : (
            <li>本人確認前の内容です</li>
          )}
        </ul>
        {book.flexibility.length > 0 ? (
          <p className="mt-3 text-base">家族に任せている範囲：{book.flexibility.join("／")}</p>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">未決定のこと</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-lg">
          {book.undecided.length > 0 ? (
            book.undecided.map((item) => <li key={item}>{item}</li>)
          ) : (
            <li>共有された未決定事項はありません</li>
          )}
        </ul>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">相談先と、必要になったときの最初の行動</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-lg">
          {book.contacts.map((item) => (
            <li key={item}>{item}</li>
          ))}
          {book.firstAction.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {book.estimate.length > 0 ? (
          <div className="mt-3">
            <p className="text-base text-ink-soft">見積もりと確認できた事実（前提・確認日つき）</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {book.estimate.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-3 text-base text-ink-soft">
          契約・予約は、まだしていない前提です。{FUNERAL_HOME.name}の過去の見積額は、いまも有効とは限りません。
        </p>
      </Card>

      {!privateVisible ? (
        <p className="text-base text-ink-soft">
          私的な相談は、本人が選んでいないため、この画面には出ていません。
        </p>
      ) : (
        <Notice>本人が選んだ私的な相談も、共有されています。</Notice>
      )}

      <Card>
        <h2 className="text-xl font-semibold">家族の判断（本人の希望とは別）</h2>
        <p className="mt-2 text-lg">
          到着の見込み：
          {state.familyJudgment.arrival === "apr16_morning"
            ? "16日の朝"
            : state.familyJudgment.arrival === "apr16_evening"
              ? "16日の夕方"
              : "未記入"}
        </p>
        {state.familyJudgment.proposedDate ? (
          <p className="mt-2 text-lg">
            家族側の候補日：{state.familyJudgment.proposedDate}
          </p>
        ) : null}
        {state.familyJudgment.proposedReason ? (
          <p className="mt-2 text-base text-ink-soft">{state.familyJudgment.proposedReason}</p>
        ) : null}
        {proposal.conflict ? (
          <p className="mt-3 text-base text-amber">{proposal.conflict}</p>
        ) : null}
        {proposal.alternatives.length > 0 && state.talkStep === "family_proposal" ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-base">
            {proposal.alternatives.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </Card>

      {state.viewerRole === "family" || state.timePassed ? (
        <TalkPanel
          state={state}
          onSubmit={handleSubmit}
          speakerLabel="健一さん"
        />
      ) : (
        <Notice>まだ本人側の画面です。共有のあと、時間経過で家族画面へ切り替わります。</Notice>
      )}

      {state.talkStep === "family_ready" || state.familyJudgment.acceptedProposal ? (
        <div className="flex flex-col gap-2">
          <PrimaryLink
            href="/demo/procedure"
            onClick={() => startProcedure(true)}
          >
            手続きの不足を確認する
          </PrimaryLink>
        </div>
      ) : null}

      <SecondaryLink href="/demo/share">共有内容に戻る</SecondaryLink>
    </div>
  );
}
