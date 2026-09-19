"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PlanSummary } from "@/lib/types";

export function PlanCard({ plan }: { plan: PlanSummary }) {
  const router = useRouter();
  const reflected = plan.status === "DONE" || plan.status === "REFLECTED";
  return (
    <Card
      className="cursor-pointer transition hover:shadow-md"
      onClick={() => router.push(`/plan/${plan.id}`)}
    >
      <div className="flex items-center justify-between text-xs text-ink-soft">
        <span>{reflected ? "振り返り済み" : "予定"}</span>
        <span>{plan.validationState ?? "未生成"}</span>
      </div>
      <h2 className="mt-1 text-lg font-medium">
        {plan.dateTokyo} {plan.meetName}
      </h2>
      <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
        <MapPin className="h-3.5 w-3.5" />
        {plan.areaName}
      </p>
      <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
        <Calendar className="h-3.5 w-3.5" />
        {plan.spotNames.slice(0, 4).join(" → ") || "スポット未確定"}
      </p>
      <p className="mt-2 text-sm">
        {plan.costKnown ? "費用レンジあり" : "料金不明。予算内とは断定しません"}
      </p>
      <Link href={`/plan/${plan.id}`} className="mt-2 inline-block text-sm text-rose">
        詳細を開く
      </Link>
    </Card>
  );
}
