"use client";

import { MessageCircle, Reply } from "lucide-react";
import type { ReactNode } from "react";
import { StatusLabel } from "@/components/status-label";
import { useDemo } from "@/components/demo-provider";
import {
  Card,
  Notice,
  PageTitle,
  PrimaryButton,
  PrimaryLink,
  SecondaryLink,
  StickyActions,
} from "@/components/ui";
import {
  getCheckItemStatus,
  hasReceivedFirstReply,
  hasReceivedFollowup,
  hasSentFirstInquiry,
  hasSentFollowup,
  isWaitingForReply,
} from "@/lib/inquiry";
import {
  CHECK_ITEMS,
  FIRST_QUESTION_BODY,
  FIRST_REPLY_BODY,
  FOLLOWUP_QUESTION_BODY,
  FOLLOWUP_REPLY_BODY,
  FUNERAL_HOME,
} from "@/lib/sample-data";

function MessageBubble({
  from,
  children,
}: {
  from: "user" | "home";
  children: ReactNode;
}) {
  const isUser = from === "user";
  return (
    <article
      className={`rounded-xl border p-4 ${
        isUser
          ? "border-forest/20 bg-forest-soft"
          : "border-line bg-card"
      }`}
    >
      <p className="flex items-center gap-2 text-base font-medium text-forest">
        {isUser ? (
          <MessageCircle className="h-4 w-4" aria-hidden />
        ) : (
          <Reply className="h-4 w-4" aria-hidden />
        )}
        {isUser
          ? `${FUNERAL_HOME.name}への質問`
          : `${FUNERAL_HOME.name}からの返事（体験）`}
      </p>
      <div className="mt-2 whitespace-pre-wrap text-base leading-relaxed">
        {children}
      </div>
    </article>
  );
}

export default function InquiryPage() {
  const { state, applyAction } = useDemo();
  const { inquiryStatus } = state;
  const sentFirst = hasSentFirstInquiry(inquiryStatus);
  const gotFirst = hasReceivedFirstReply(inquiryStatus);
  const sentFollowup = hasSentFollowup(inquiryStatus);
  const gotFollowup = hasReceivedFollowup(inquiryStatus);
  const waiting = isWaitingForReply(inquiryStatus);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle eyebrow="聞いてよいか確認">
        この内容で、葬儀社に聞いてよいですか
      </PageTitle>
      <Notice>
        あらかじめ用意したやりとりを、あなたの操作で進めます。実際の問い合わせは行いません。
      </Notice>

      <Card>
        <h2 className="text-xl font-semibold">聞く内容</h2>
        <dl className="mt-3 space-y-2 text-base">
          <div>
            <dt className="text-base text-ink-soft">宛先</dt>
            <dd>
              {FUNERAL_HOME.name}（{FUNERAL_HOME.fictionalNote}）
            </dd>
          </div>
          <div>
            <dt className="text-base text-ink-soft">目的</dt>
            <dd>書いていない費用の条件を確認</dd>
          </div>
          <div>
            <dt className="text-base text-ink-soft">いまの状態</dt>
            <dd>
              {inquiryStatus === "awaiting_approval"
                ? "まだ聞いていません。内容を見て決めてください"
                : waiting
                  ? "返事を待っています（体験）"
                  : gotFollowup
                    ? "返事が揃いました"
                    : "返事の確認"}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="space-y-4">
        <MessageBubble from="user">
          {FIRST_QUESTION_BODY}
          {!sentFirst ? (
            <p className="mt-3 text-sm font-medium text-amber">
              この内容は、まだ聞いていません。
            </p>
          ) : null}
        </MessageBubble>

        {inquiryStatus === "awaiting_first_reply" ? (
          <p className="rounded-xl border border-line bg-card px-4 py-3 text-base text-ink-soft">
            葬儀社からの返事を待っています…
          </p>
        ) : null}

        {gotFirst ? (
          <MessageBubble from="home">{FIRST_REPLY_BODY}</MessageBubble>
        ) : null}

        {gotFirst && !gotFollowup ? (
          <div className="rounded-xl border border-amber/30 bg-amber-soft p-4">
            <p className="text-base font-semibold text-amber">
              返事は届きました。搬送の追加料金は、まだ分かっていません。
            </p>
            <p className="mt-2 text-base text-ink">
              「距離や状況による」だけでは、いくらかかるか計算できません。
            </p>
          </div>
        ) : null}

        {gotFirst ? (
          <Card>
            <h2 className="text-xl font-semibold">分かったこと・まだ分からないこと</h2>
            <ul className="mt-3 space-y-3">
              {CHECK_ITEMS.map((item) => {
                const status = getCheckItemStatus(item.id, inquiryStatus);
                return (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <p className="min-w-0 text-base">{item.title}</p>
                    <StatusLabel status={status} />
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}

        {gotFirst ? (
          <MessageBubble from="user">
            {FOLLOWUP_QUESTION_BODY}
            {!sentFollowup ? (
              <p className="mt-3 text-sm font-medium text-amber">
                この確認は、まだ聞いていません。
              </p>
            ) : null}
          </MessageBubble>
        ) : null}

        {inquiryStatus === "awaiting_followup_reply" ? (
          <p className="rounded-xl border border-line bg-card px-4 py-3 text-base text-ink-soft">
            もう一度聞いた内容の返事を待っています…
          </p>
        ) : null}

        {gotFollowup ? (
          <>
            <MessageBubble from="home">{FOLLOWUP_REPLY_BODY}</MessageBubble>
            <div className="rounded-xl border border-forest/20 bg-forest-soft p-4">
              <p className="text-base font-semibold text-forest">
                今回の質問4件の返事が揃いました
              </p>
              <p className="mt-2 text-base text-ink">
                分かった条件から、目安の金額を出せます。将来の総額が決まったわけではありません。
              </p>
            </div>
          </>
        ) : null}
      </div>

      <StickyActions>
        {inquiryStatus === "awaiting_approval" ? (
          <PrimaryButton type="button" onClick={() => applyAction("approve_inquiry")}>
            この内容で聞いてよい
          </PrimaryButton>
        ) : null}
        {inquiryStatus === "awaiting_followup_approval" ? (
          <PrimaryButton type="button" onClick={() => applyAction("approve_followup")}>
            もう一度聞いてよい
          </PrimaryButton>
        ) : null}
        {waiting ? (
          <PrimaryButton type="button" disabled>
            返事を待っています
          </PrimaryButton>
        ) : null}
        {gotFollowup ? (
          <PrimaryLink href="/demo/share">家族に残す内容を見る</PrimaryLink>
        ) : null}
        <SecondaryLink href="/demo">しるべと話す</SecondaryLink>
      </StickyActions>
    </div>
  );
}
