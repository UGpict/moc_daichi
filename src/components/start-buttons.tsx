"use client";

import { useRouter } from "next/navigation";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { startPrepStore, startProcedureStore } from "@/lib/demo-store";

export function StartButtons() {
  const router = useRouter();

  return (
    <div className="space-y-3">
      <PrimaryButton
        type="button"
        onClick={() => {
          startPrepStore();
          router.push("/demo");
        }}
      >
        生前の準備を体験する
      </PrimaryButton>
      <SecondaryButton
        type="button"
        onClick={() => {
          startProcedureStore();
          router.push("/demo/procedure");
        }}
      >
        家族への引継ぎ・手続きを体験する
      </SecondaryButton>
    </div>
  );
}
