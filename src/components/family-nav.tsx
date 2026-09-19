"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/demo", label: "しるべに相談する" },
  { href: "/demo/records", label: "情報・書類を確認する" },
  { href: "/demo/tasks", label: "任せている手続きを見る" },
] as const;

export function FamilyNav() {
  const pathname = usePathname();

  return (
    <nav className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {items.map((item) => {
        const current = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-3 text-center text-base ${
              current
                ? "border-forest bg-forest-soft font-medium text-forest"
                : "border-line bg-card text-ink-soft"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
