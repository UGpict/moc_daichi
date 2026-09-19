import { json, requireUid } from "@/server/api/http";
import { listMemory } from "@/server/api/actions";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ coupleId: string }> },
) {
  const auth = requireUid(request);
  if ("error" in auth) return auth.error;
  const { coupleId } = await ctx.params;
  const result = await listMemory(auth.uid, coupleId);
  if (!result.ok) return json({ error: result.error }, result.status);
  return json(result);
}
