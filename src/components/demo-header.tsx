"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDemo } from "@/components/demo-provider";
import { ShirubeAvatar } from "@/components/shirube-avatar";

const titles: Record<string, string> = {
  "/demo": "案件ホーム",
  "/demo/estimate": "見積もりの確認",
  "/demo/agent": "葬儀社への問い合わせ",
  "/demo/summary": "費用と準備書",
  "/demo/family": "家族向けの準備書",
  "/demo/procedure": "引継ぎと手続き",
};

export function DemoHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { resetDemo } = useDemo();
  const title = titles[pathname] ?? "SougiAgent";

  function handleReset() {
    resetDemo();
    router.push("/");
  }

  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/demo"
          className="flex min-h-11 min-w-11 items-center gap-2 text-forest"
        >
          <ShirubeAvatar size={28} />
          <span className="text-base font-semibold tracking-wide">SougiAgent</span>
        </Link>
        <p className="hidden min-w-0 truncate text-sm text-ink-soft sm:block">
          {title}
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-2 text-sm font-medium text-ink-soft underline-offset-2 hover:text-forest hover:underline"
        >
          <span className="sm:hidden">やり直す</span>
          <span className="hidden sm:inline">最初からやり直す</span>
        </button>
      </div>
    </header>
  );
}
