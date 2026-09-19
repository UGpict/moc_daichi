import { Clock, ShieldCheck, UserRoundX } from "lucide-react";
import { PrimaryLink } from "@/components/ui";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
      <p className="text-sm font-medium tracking-wide text-forest">SougiAgent</p>
      <h1 className="mt-3 text-[1.75rem] font-semibold leading-snug text-ink sm:text-3xl">
        家族が迷わない準備を、いま一緒に。
      </h1>
      <p className="mt-4 text-base leading-relaxed text-ink-soft">
        葬儀の見積もりの分からないところを確認し、希望と費用を家族に残します。
      </p>

      <div className="mt-8">
        <PrimaryLink href="/demo">サンプルで体験する</PrimaryLink>
      </div>

      <ul className="mt-8 space-y-3">
        <li className="flex items-start gap-3 text-base text-ink-soft">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          約3分
        </li>
        <li className="flex items-start gap-3 text-base text-ink-soft">
          <UserRoundX className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          登録不要
        </li>
        <li className="flex items-start gap-3 text-base text-ink-soft">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          実際の問い合わせ・契約は行われません
        </li>
      </ul>
    </main>
  );
}
