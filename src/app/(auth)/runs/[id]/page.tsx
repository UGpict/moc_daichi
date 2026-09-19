import { RunLogContainer } from "@/features/routes/runLog/RunLogContainer";

export default async function RunLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RunLogContainer runId={id} />;
}
