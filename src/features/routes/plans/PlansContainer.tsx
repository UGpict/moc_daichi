"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useAuth } from "@/features/common/auth/AuthContext";
import { PlanCard } from "@/components/plan/plan-card";
import { Button } from "@/components/ui/button";
import type { PlanSummary } from "@/lib/types";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

export function PlansContainer() {
  const { me, refresh } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "reflected">("upcoming");
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    void (async () => {
      try {
        let coupleId = me.coupleId;
        if (!coupleId) {
          const created = await api<{ id: string }>("/api/couples", {
            method: "POST",
            body: JSON.stringify({ isDemo: true }),
          });
          coupleId = created.id;
          await refresh();
        }
        const data = await api<{ sessions: PlanSummary[] }>(`/api/couples/${coupleId}/sessions`);
        setPlans(data.sessions);
      } catch (e) {
        setError(e instanceof Error ? e.message : "error");
      }
    })();
  }, [me, refresh]);

  const upcoming = plans.filter((p) => p.status !== "DONE" && p.status !== "REFLECTED");
  const reflected = plans.filter((p) => p.status === "DONE" || p.status === "REFLECTED");
  const shown = tab === "upcoming" ? upcoming : reflected;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["upcoming", "reflected"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm",
              tab === id ? "bg-rose text-white" : "border border-line",
            )}
          >
            {id === "upcoming" ? "予定" : "振り返り済み"}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-rose">{error}</p> : null}
      {shown.length === 0 ? (
        <p className="text-sm text-ink-soft">まだプランがありません。</p>
      ) : (
        shown.map((p) => <PlanCard key={p.id} plan={p} />)
      )}
      <Button className="w-full" onClick={() => router.push("/plan/new")}>
        プランをつくる
      </Button>
    </div>
  );
}
