import { Clock, ShieldCheck, UserRoundX } from "lucide-react";
import { ShirubeAvatar } from "@/components/shirube-avatar";
import { StartButtons } from "@/components/start-buttons";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
      <p className="text-sm font-medium tracking-wide text-forest">SougiAgent</p>
      <h1 className="mt-3 text-[1.75rem] font-semibold leading-snug text-ink sm:text-3xl">
        家族が迷わない準備を、いま一緒に。
      </h1>
      <p className="mt-4 text-base leading-relaxed text-ink-soft">
        葬儀の見積もりの分からないところを確認し、希望と費用を家族に残します。必要になったあとの手続きも、同じ担当者が引き継ぎます。
      </p>

      <section className="mt-6 flex items-start gap-3 rounded-xl border border-line bg-card p-4">
        <ShirubeAvatar size={48} />
        <div>
          <p className="text-sm font-medium text-forest">しるべさん／AIサポート</p>
          <p className="mt-1 text-base">
            事前相談から家族への引継ぎ、火葬許可証の受領まで、同じ担当者が状況を報告します。
          </p>
        </div>
      </section>

      <div className="mt-8">
        <StartButtons />
      </div>

      <ul className="mt-8 space-y-3">
        <li className="flex items-start gap-3 text-base text-ink-soft">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          約3〜8分
        </li>
        <li className="flex items-start gap-3 text-base text-ink-soft">
          <UserRoundX className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          登録不要
        </li>
        <li className="flex items-start gap-3 text-base text-ink-soft">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          実際の問い合わせ・契約・届出は行われません
        </li>
      </ul>
    </main>
  );
}
