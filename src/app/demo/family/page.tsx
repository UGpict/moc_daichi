"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FamilyDocument } from "@/components/family-document";
import { useDemo } from "@/components/demo-provider";
import { Notice, PageTitle, PrimaryButton, SecondaryLink } from "@/components/ui";
import { calculateReferenceCost } from "@/lib/cost";
import { FAMILY } from "@/lib/sample-data";

export default function FamilyPage() {
  const router = useRouter();
  const { state, markFamilyViewed, startProcedure } = useDemo();
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
      <div className="space-y-2 pt-2">
        <PrimaryButton
          type="button"
          onClick={() => {
            startProcedure(state.inquiryStatus === "answers_confirmed");
            router.push("/demo/procedure");
          }}
        >
          家族への引継ぎ・手続きを体験する
        </PrimaryButton>
        <SecondaryLink href="/demo/summary">費用の整理に戻る</SecondaryLink>
      </div>
    </div>
  );
}
