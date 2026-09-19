"use client";

import { useEffect } from "react";
import { FamilyDocument } from "@/components/family-document";
import { useDemo } from "@/components/demo-provider";
import { Notice, PageTitle, SecondaryLink } from "@/components/ui";
import { calculateReferenceCost } from "@/lib/cost";
import { FAMILY } from "@/lib/sample-data";

export default function FamilyPage() {
  const { state, markFamilyViewed } = useDemo();
  const breakdown = calculateReferenceCost(state.conditions);

  useEffect(() => {
    markFamilyViewed();
  }, [markFamilyViewed]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle eyebrow="家族向け画面のプレビュー">
        {FAMILY.principal}さんが残した準備
      </PageTitle>
      <Notice>
        これは家族向け画面のプレビューです。実際の共有や通知は行っていません。契約・予約はまだ行っていません。
      </Notice>
      <FamilyDocument conditions={state.conditions} breakdown={breakdown} />
      <div className="pt-2">
        <SecondaryLink href="/demo/summary">費用の整理に戻る</SecondaryLink>
      </div>
    </div>
  );
}
