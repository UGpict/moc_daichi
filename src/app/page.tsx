import { Clock, ShieldCheck, UserRoundX } from "lucide-react";
import { ShirubeAvatar } from "@/components/shirube-avatar";
import { StartButtons } from "@/components/start-buttons";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
      <p className="text-base font-medium tracking-wide text-forest">しるべ／SougiAgent</p>
      <h1 className="mt-3 text-[1.85rem] font-semibold leading-snug text-ink sm:text-4xl">
        話すことで、自分の希望が家族の使える準備になる
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-soft">
        しるべは、春子さんの話を聞いて希望とその理由を整理します。亡くなったあとは、共有を許可された情報だけを家族に引き継ぎます。
      </p>

      <section className="mt-6 flex items-start gap-3 rounded-xl border border-line bg-card p-5">
        <ShirubeAvatar size={56} />
        <div>
          <p className="text-base font-medium text-forest">しるべさん／AIサポート</p>
          <p className="mt-1 text-lg leading-relaxed">
            春子さんそのものを再現するのではありません。聞いたことを覚えている担当者として、一つずつ聞きます。
          </p>
        </div>
      </section>

      <div className="mt-8">
        <StartButtons />
      </div>

      <ul className="mt-8 space-y-3">
        <li className="flex items-start gap-3 text-lg text-ink-soft">
          <Clock className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
          話して、短く確認するだけです
        </li>
        <li className="flex items-start gap-3 text-lg text-ink-soft">
          <UserRoundX className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
          登録は不要です
        </li>
        <li className="flex items-start gap-3 text-lg text-ink-soft">
          <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
          実際の問い合わせや契約、行政申請は行いません
        </li>
      </ul>
    </main>
  );
}
