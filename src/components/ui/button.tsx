import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition disabled:opacity-60",
        variant === "primary" && "bg-rose text-white hover:bg-rose-hover",
        variant === "secondary" && "border border-line bg-card text-ink hover:bg-paper-deep",
        variant === "ghost" && "text-ink-soft hover:bg-paper-deep",
        className,
      )}
      {...props}
    />
  );
}
