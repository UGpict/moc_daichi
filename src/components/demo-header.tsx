"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Signpost } from "lucide-react";
import { useDemo } from "@/components/demo-provider";

const titles: Record<string, string> = {
  "/demo": "準備ホーム",
  "/demo/estimate": "見積もりの確認",
  "/demo/agent": "葬儀社への問い合わせ",
  "/demo/summary": "費用と準備書",
  "/demo/family": "家族向けの準備書",
};

export function DemoHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { resetDemo } = useDemo();
  const title = titles[pathname] ?? "しるべ";

  function handleReset() {
    resetDemo();
    router.push("/demo");
  }

  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/demo"
          className="flex min-h-11 min-w-11 items-center gap-2 text-forest"
        >
          <Signpost className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-base font-semibold tracking-wide">しるべ</span>
        </Link>
        <p className="min-w-0 truncate text-sm text-ink-soft">{title}</p>
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
