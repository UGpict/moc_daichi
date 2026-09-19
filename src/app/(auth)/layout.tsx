import type { ReactNode } from "react";
import { AuthGuard } from "@/features/common/auth/AuthGuard";
import { AppShell } from "@/features/common/layout/AppShell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
