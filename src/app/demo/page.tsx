"use client";

import { ProgressSteps } from "@/components/progress-steps";
import { useDemo } from "@/components/demo-provider";
import { Card, Notice, PageTitle, PrimaryLink } from "@/components/ui";
import { formatYen } from "@/lib/format";
import { getDemoProgress } from "@/lib/inquiry";
import { FAMILY, FUNERAL_HOME, WISHES } from "@/lib/sample-data";

export default function DemoHomePage() {
  const { state } = useDemo();
  const progress = getDemoProgress(state);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle eyebrow="事前準備">いま確認すること</PageTitle>
      <p className="text-xl font-semibold leading-relaxed text-forest sm:text-2xl">
        {progress.headline}
      </p>

      <Card>
        <h2 className="text-lg font-semibold">このサンプルの前提</h2>
        <dl className="mt-3 space-y-2 text-base">
          <div>
            <dt className="text-sm text-ink-soft">だれが準備しているか</dt>
            <dd>
              {FAMILY.principal}さんと、子ども世代の{FAMILY.child}
              さんが、いっしょに事前準備しています。
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">希望</dt>
            <dd>{WISHES.style}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">予算の目安</dt>
            <dd>{formatYen(WISHES.budgetYen)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">見積書</dt>
            <dd>
              {FUNERAL_HOME.name}（{FUNERAL_HOME.fictionalNote}）1社分
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">葬儀日程</dt>
            <dd>{WISHES.schedule}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">進み具合</h2>
        <div className="mt-4">
          <ProgressSteps steps={progress.steps} />
        </div>
      </Card>

      <Notice>
        最安値を探す体験ではありません。本人の希望に沿って、想定外の支出と家族の迷いを減らすことが目的です。
      </Notice>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-paper/95 px-4 py-3">
        <PrimaryLink href={progress.ctaHref}>{progress.ctaLabel}</PrimaryLink>
      </div>
    </div>
  );
}
