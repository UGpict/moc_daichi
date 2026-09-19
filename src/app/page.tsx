import { Clock, ShieldCheck, UserRoundX } from "lucide-react";
import { ShirubeAvatar } from "@/components/shirube-avatar";
import { StartButtons } from "@/components/start-buttons";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
      <p className="text-base font-medium tracking-wide text-forest">しるべ／SougiAgent</p>
      <h1 className="mt-3 text-[1.85rem] font-semibold leading-snug text-ink sm:text-4xl">
        書類の不備を、関係者への確認で進めて完了する
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-soft">
        お母さまが残した記録を手掛かりに、死亡診断書との不一致を推測では埋めません。担当者へ聞き、返事が足りるか見てから、許可証の引渡しまで追います。
      </p>

      <section className="mt-6 flex items-start gap-3 rounded-xl border border-line bg-card p-5">
        <ShirubeAvatar size={56} />
        <div>
          <p className="text-base font-medium text-forest">しるべさん／AIサポート</p>
          <p className="mt-1 text-lg leading-relaxed">
            「確認します」だけでは完了にしません。家族が答えることだけを、前に出します。
          </p>
        </div>
      </section>

      <div className="mt-8">
        <StartButtons />
      </div>

      <ul className="mt-8 space-y-3">
        <li className="flex items-start gap-3 text-lg text-ink-soft">
          <Clock className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
          架空の一案件・約5分
        </li>
        <li className="flex items-start gap-3 text-lg text-ink-soft">
          <UserRoundX className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
          登録は不要です
        </li>
        <li className="flex items-start gap-3 text-lg text-ink-soft">
          <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
          実際の問い合わせや行政申請は行いません
        </li>
      </ul>
    </main>
  );
}
