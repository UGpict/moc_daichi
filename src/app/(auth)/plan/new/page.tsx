import { Suspense } from "react";
import { PlanCreateContainer } from "@/features/routes/planCreate/PlanCreateContainer";

export default function PlanNewPage() {
  return (
    <Suspense fallback={<p className="text-ink-soft">読み込み中…</p>}>
      <PlanCreateContainer />
    </Suspense>
  );
}
