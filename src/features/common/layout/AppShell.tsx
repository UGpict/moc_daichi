"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookHeart, PlusCircle, Map, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/plan/new", label: "つくる", icon: PlusCircle, match: (p: string) => p.startsWith("/plan/new") || p.startsWith("/onboarding") },
  { href: "/plans", label: "プラン", icon: Map, match: (p: string) => p === "/plans" || (p.startsWith("/plan/") && !p.startsWith("/plan/new")) },
  { href: "/memory", label: "ふたりのメモ", icon: BookHeart, match: (p: string) => p.startsWith("/memory") },
] as const;

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const pathname = usePathname() ?? "/";
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col lg:max-w-[1120px]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur">
        <Link href="/plans" className="text-sm tracking-widest text-rose">
          FUTARI LOG
        </Link>
        <div className="flex items-center gap-3">
          {title ? <span className="text-sm font-medium">{title}</span> : null}
          <Link href="/settings" aria-label="設定" className="text-ink-soft">
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </header>
      <div className="flex-1 px-4 pb-28 pt-4 lg:px-6">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-[440px] grid-cols-3 lg:max-w-[1120px]">
          {NAV.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-xs",
                  active ? "text-rose" : "text-ink-soft",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
