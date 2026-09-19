"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/features/common/auth/AuthContext";
import { cn } from "@/lib/cn";

const SELF_CHIPS = ["散歩", "展示", "カフェ", "屋内中心", "短い移動"];
const PARTNER_CHIPS = ["甘いもの", "のんびり", "写真", "座って休みたい"];

export function OnboardingContainer() {
  const router = useRouter();
  const { me } = useAuth();
  const [step, setStep] = useState(0);
  const [self, setSelf] = useState<string[]>(["散歩", "展示"]);
  const [partner, setPartner] = useState<string[]>(["甘いもの"]);
  const [source, setSource] = useState<"PARTNER_STATEMENT_REPORTED" | "OBSERVATION" | "UNKNOWN">(
    "PARTNER_STATEMENT_REPORTED",
  );

  function toggle(list: string[], set: (v: string[]) => void, item: string) {
    set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  function finish(skip = false) {
    if (me) {
      window.localStorage.setItem(`futari.onboarded.${me.uid}`, "1");
      if (!skip) {
        window.sessionStorage.setItem(
          `futari.draft.${me.uid}`,
          JSON.stringify({
            self: self.join("・") || "散歩と展示",
            partner: partner.join("・") || "甘いもの",
            partnerSource: source === "UNKNOWN" ? "OBSERVATION" : source,
          }),
        );
      }
    }
    router.push("/plan/new");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">ステップ {step + 1} / 3 · スキップできます。これは今回の希望入力であり、長期記憶にはしません。</p>
      {step === 0 ? (
        <Card>
          <h1 className="text-xl font-semibold">自分の希望</h1>
          <p className="mt-1 text-sm text-ink-soft">SELF / 自己申告</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SELF_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggle(self, setSelf, c)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  self.includes(c) ? "border-rose bg-rose-soft text-rose" : "border-line",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Card>
      ) : null}
      {step === 1 ? (
        <Card>
          <h1 className="text-xl font-semibold">相手について分かっていること</h1>
          <p className="mt-1 text-sm text-ink-soft">PARTNER · 相手はアプリを使いません</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {PARTNER_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggle(partner, setPartner, c)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  partner.includes(c) ? "border-rose bg-rose-soft text-rose" : "border-line",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Card>
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
