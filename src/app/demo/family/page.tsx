"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FamilyDocument } from "@/components/family-document";
import { useDemo } from "@/components/demo-provider";
import {
  Notice,
  PageTitle,
  SecondaryButton,
  SecondaryLink,
} from "@/components/ui";
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
      <PageTitle eyebrow="家族が見る画面">
        {FAMILY.principal}さんが残した準備
      </PageTitle>
      <Notice>
        子どもが読むための一枚です。実際の共有や通知は行っていません。契約や予約は、まだしていません。
      </Notice>
      <FamilyDocument conditions={state.conditions} breakdown={breakdown} />
      <div className="space-y-3 pt-2">
        <SecondaryLink href="/demo">準備に戻る</SecondaryLink>
        <p className="text-base text-ink-soft">
          役所の手続きは、必要になったときだけ見れば十分です。
        </p>
        <SecondaryButton
          type="button"
          onClick={() => {
            startProcedure(state.inquiryStatus === "answers_confirmed");
            router.push("/demo/procedure");
          }}
        >
          必要になったときの手続きを見る
        </SecondaryButton>
      </div>
    </div>
  );
}
