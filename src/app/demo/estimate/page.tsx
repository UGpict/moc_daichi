"use client";

import { useEffect } from "react";
import { EstimatePreview } from "@/components/estimate-preview";
import { StatusLabel } from "@/components/status-label";
import { useDemo } from "@/components/demo-provider";
import {
  Notice,
  PageTitle,
  PrimaryLink,
  SecondaryLink,
  StickyActions,
} from "@/components/ui";
import { getCheckItemStatus } from "@/lib/inquiry";
import { CHECK_ITEMS } from "@/lib/sample-data";

export default function EstimatePage() {
  const { state, markEstimateReviewed } = useDemo();

  useEffect(() => {
    markEstimateReviewed();
  }, [markEstimateReviewed]);

  return (
    <div className="space-y-6">
      <PageTitle eyebrow="見積もりの確認">
        55万円ですべて収まる、とは限りません
      </PageTitle>
      <p className="text-base text-ink-soft">
        基本プラン以外の費用は、見積書だけでは確定できません。不明な項目は0円として計算しません。
      </p>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <EstimatePreview />

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">確認したい項目</h2>
          {CHECK_ITEMS.map((item) => {
            const status = getCheckItemStatus(item.id, state.inquiryStatus);
            return (
              <article
                key={item.id}
                className="rounded-xl border border-line bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <StatusLabel status={status} />
                </div>
                <p className="mt-2 rounded-md bg-paper-deep px-3 py-2 text-sm">
                  見積書の記載：{item.quote}
                </p>
                <p className="mt-2 text-sm text-ink-soft">{item.why}</p>
                {status === "unconfirmed" ? (
                  <p className="mt-2 text-sm font-medium text-amber">
                    金額は未確定です（0円としては扱いません）
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>

      <Notice>
        この体験では、あらかじめ用意した4つの確認項目を順に見ていきます。実際の見積書のアップロードは行いません。
      </Notice>

      <StickyActions>
        <PrimaryLink href="/demo/agent">質問内容を確認する</PrimaryLink>
        <SecondaryLink href="/demo">準備ホームに戻る</SecondaryLink>
      </StickyActions>
    </div>
  );
}
