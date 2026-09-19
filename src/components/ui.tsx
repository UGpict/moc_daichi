import Link from "next/link";
import type { ReactNode } from "react";

const primaryClassName =
  "inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-forest px-4 text-center text-lg font-medium text-white transition-colors hover:bg-forest-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:bg-forest/40";

const secondaryClassName =
  "inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-line bg-card px-4 text-center text-lg font-medium text-forest transition-colors hover:bg-forest-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${primaryClassName} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${secondaryClassName} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function PrimaryLink({
  href,
  children,
  className = "",
  onClick,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link href={href} onClick={onClick} className={`${primaryClassName} ${className}`}>
      {children}
    </Link>
  );
}

export function SecondaryLink({
  href,
  children,
  className = "",
  onClick,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link href={href} onClick={onClick} className={`${secondaryClassName} ${className}`}>
      {children}
    </Link>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-line bg-card p-4 sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function PageTitle({
  eyebrow,
  children,
}: {
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <header className="space-y-2">
      {eyebrow ? (
        <p className="text-base font-medium text-forest">{eyebrow}</p>
      ) : null}
      <h1 className="text-[1.75rem] font-semibold leading-snug text-ink sm:text-3xl">
        {children}
      </h1>
    </header>
  );
}

export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-line bg-paper/95 px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-col gap-2">{children}</div>
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-paper-deep px-4 py-3 text-base leading-relaxed text-ink-soft">
      {children}
    </p>
  );
}
