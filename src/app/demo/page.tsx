"use client";

import { ProgressSteps } from "@/components/progress-steps";
import { useDemo } from "@/components/demo-provider";
import { Card, PageTitle, PrimaryLink, SecondaryLink } from "@/components/ui";
import { formatYen } from "@/lib/format";
import { getDemoProgress } from "@/lib/inquiry";
import { FAMILY, FUNERAL_HOME, WISHES } from "@/lib/sample-data";

export default function DemoHomePage() {
  const { state } = useDemo();
  const progress = getDemoProgress(state);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageTitle eyebrow="ご自身の準備">いま確認すること</PageTitle>
      <p className="text-lg leading-relaxed text-ink-soft">
        難しい手続きは、あとからです。いまは希望と、見積もりの分からないところだけ見ます。
      </p>

      <Card>
        <h2 className="text-xl font-semibold">{FAMILY.principal}さんの希望</h2>
        <p className="mt-3 text-lg">{WISHES.style}</p>
        <p className="mt-1 text-lg text-ink-soft">
          予算の目安 {formatYen(WISHES.budgetYen)}
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-lg">
          {WISHES.values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
        <p className="mt-4 text-base text-ink-soft">
          見積書は{FUNERAL_HOME.name}（{FUNERAL_HOME.fictionalNote}）1社分です。
        </p>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">進み方</h2>
        <div className="mt-4">
          <ProgressSteps steps={progress.steps} />
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <PrimaryLink href={progress.ctaHref}>{progress.ctaLabel}</PrimaryLink>
        {state.track === "procedure" ? (
          <SecondaryLink href="/demo/procedure">手続きの続きを見る</SecondaryLink>
        ) : null}
      </div>
    </div>
  );
}
