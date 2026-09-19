"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/features/common/auth/AuthContext";
import { PreferenceSwipe, type LikedSpot } from "@/features/routes/onboarding/PreferenceSwipe";

export function OnboardingContainer() {
  const router = useRouter();
  const { me } = useAuth();
  const [step, setStep] = useState(0);
  const [selfLiked, setSelfLiked] = useState<LikedSpot[]>([]);
  const [partnerLiked, setPartnerLiked] = useState<LikedSpot[]>([]);
  const [source, setSource] = useState<"PARTNER_STATEMENT_REPORTED" | "OBSERVATION" | "UNKNOWN">(
    "PARTNER_STATEMENT_REPORTED",
  );

  function summarize(liked: LikedSpot[], fallback: string) {
    const vibes = [...new Set(liked.map((l) => l.vibe))];
    const names = liked.map((l) => l.name);
    if (liked.length === 0) return fallback;
    return `${vibes.join("・")}（${names.join("、")}が気になる）`;
  }

  function finish(skip = false) {
    if (me) {
      window.localStorage.setItem(`futari.onboarded.${me.uid}`, "1");
      if (!skip) {
        window.sessionStorage.setItem(
          `futari.draft.${me.uid}`,
          JSON.stringify({
            self: summarize(selfLiked, "散歩と展示"),
            partner: summarize(partnerLiked, "甘いもの"),
            partnerSource: source === "UNKNOWN" ? "OBSERVATION" : source,
            selfLiked,
            partnerLiked,
          }),
        );
      }
    }
    router.push("/today");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        ステップ {step + 1} / 3 · 実在スポットのカードで今回の希望だけを選びます（スキップ可・長期記憶にはしません）。
      </p>
      {step === 0 ? <PreferenceSwipe key="self" subject="SELF" liked={selfLiked} onChange={setSelfLiked} /> : null}
      {step === 1 ? (
        <PreferenceSwipe key="partner" subject="PARTNER" liked={partnerLiked} onChange={setPartnerLiked} />
      ) : null}
      {step === 2 ? (
        <Card>
          <h1 className="text-xl font-semibold">その情報の根拠</h1>
          <div className="mt-4 space-y-2">
            {(
              [
                ["PARTNER_STATEMENT_REPORTED", "相手が言っていた（伝聞）"],
                ["OBSERVATION", "自分が観察した"],
                ["UNKNOWN", "よく分からない"],
              ] as const
            ).map(([id, label]) => (
              <label key={id} className="flex items-center gap-2 text-sm">
                <input type="radio" checked={source === id} onChange={() => setSource(id)} />
                {label}
              </label>
            ))}
          </div>
        </Card>
      ) : null}
      <div className="flex gap-2">
        {step > 0 ? (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
            戻る
          </Button>
        ) : null}
        {step < 2 ? (
          <Button className="flex-1" onClick={() => setStep((s) => s + 1)}>
            次へ
          </Button>
        ) : (
          <Button className="flex-1" onClick={() => finish(false)}>
            プラン条件へ
          </Button>
        )}
        <Button variant="ghost" onClick={() => finish(true)}>
          スキップ
        </Button>
      </div>
    </div>
  );
}
