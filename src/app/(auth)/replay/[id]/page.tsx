import { ReplayContainer } from "@/features/routes/replay/ReplayContainer";

export default async function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReplayContainer replayId={id} />;
}
