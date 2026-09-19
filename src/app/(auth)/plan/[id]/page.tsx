import { PlanDetailContainer } from "@/features/routes/planDetail/PlanDetailContainer";

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanDetailContainer sessionId={id} />;
}
