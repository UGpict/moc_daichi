"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemo } from "@/components/demo-provider";
import { ShirubeAvatar } from "@/components/shirube-avatar";

const titles: Record<string, string> = {
  "/demo": "ご自身の準備",
  "/demo/estimate": "見積もりの確認",
  "/demo/agent": "聞いてよいか確認",
  "/demo/summary": "子どもに残す一枚",
  "/demo/family": "家族が見る画面",
  "/demo/procedure": "必要になったときの手続き",
};

export function DemoHeader() {
  const pathname = usePathname();
  const { resetDemo } = useDemo();
  const title = titles[pathname] ?? "SougiAgent";

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
        <Link
          href="/"
          onClick={resetDemo}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-2 text-sm font-medium text-ink-soft underline-offset-2 hover:text-forest hover:underline"
        >
          <span className="sm:hidden">やり直す</span>
          <span className="hidden sm:inline">最初からやり直す</span>
        </Link>
      </div>
    </header>
  );
}
