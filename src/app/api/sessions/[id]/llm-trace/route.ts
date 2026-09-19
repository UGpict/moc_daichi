import { json, requireUid } from "@/server/api/http";
import { tracesForRuns } from "@/server/llm/trace";
import { getSessionSnapshot } from "@/server/api/actions";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUid(request);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const result = await getSessionSnapshot(auth.uid, id);
  if (!result.ok) return json({ error: result.error }, result.status);
  const runIds = result.data.runs.map((r) => r.id);
  const trace = tracesForRuns(runIds);
  const runCostJpy = result.data.runs.reduce((n, r) => n + (r.cost.llmJpy ?? 0), 0);
  const matchesSum = Math.abs(trace.costJpy - runCostJpy) < 0.05;
  return json({
    sessionId: id,
    runIds,
    rows: trace.rows,
    costUsd: trace.costUsd,
    costJpy: trace.costJpy,
    runCostJpy,
    matchesSum,
  });
}
