"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDemo } from "@/components/demo-provider";

export default function ProcedureAliasPage() {
  const router = useRouter();
  const { ready, state, startProcedure } = useDemo();

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (state.track !== "procedure") {
      startProcedure(false);
    }
    router.replace("/demo");
  }, [ready, router, startProcedure, state.track]);

  return <p className="text-lg text-ink-soft">しるべとの相談へ移ります…</p>;
}
