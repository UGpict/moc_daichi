import { Clock, ShieldCheck, UserRoundX } from "lucide-react";
import { ShirubeAvatar } from "@/components/shirube-avatar";
import { StartButtons } from "@/components/start-buttons";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
      <p className="text-base font-medium tracking-wide text-forest">SougiAgent</p>
      <h1 className="mt-3 text-[1.85rem] font-semibold leading-snug text-ink sm:text-4xl">
        自分の希望を、家族が迷わない形で残す
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-soft">
        見積もりの分からないところを確認し、子どもに一枚で残します。役所の手続きは、必要になったあとに見られます。
      </p>

      <section className="mt-6 flex items-start gap-3 rounded-xl border border-line bg-card p-5">
        <ShirubeAvatar size={56} />
        <div>
          <p className="text-base font-medium text-forest">しるべさん／AIサポート</p>
          <p className="mt-1 text-lg leading-relaxed">
            難しい言葉は使いません。いまは、希望と見積もりだけ一緒に見ましょう。
          </p>
        </div>
      </section>

      <div className="mt-8">
        <StartButtons />
      </div>

      <ul className="mt-8 space-y-3">
        <li className="flex items-start gap-3 text-lg text-ink-soft">
          <Clock className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
          約3〜8分
        </li>
        <li className="flex items-start gap-3 text-lg text-ink-soft">
          <UserRoundX className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
          登録は不要です
        </li>
        <li className="flex items-start gap-3 text-lg text-ink-soft">
          <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
          実際の問い合わせや契約は行いません
        </li>
      </ul>
    </main>
  );
}
