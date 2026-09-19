import { json, requireUid } from "@/server/api/http";
import { tracesForRun } from "@/server/llm/trace";
import { findRun, withStore } from "@/server/repositories/store";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUid(request);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const allowed = await withStore((db) => {
    const found = findRun(db, id);
    if (!found) return false;
    return found.couple.couple.ownerUid === auth.uid;
  });
  if (!allowed) return json({ error: "not found" }, 404);
  const trace = tracesForRun(id);
  return json({
    runId: id,
    rows: trace.rows,
    costUsd: trace.costUsd,
    costJpy: trace.costJpy,
    matchesSum: true,
  });
}
