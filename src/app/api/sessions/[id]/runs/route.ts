import { json, persistHttp, requireUid, idempotencyKey } from "@/server/api/http";

export const maxDuration = 300;
import { startRun } from "@/server/api/actions";
import { sha256 } from "@/lib/ids";
import type { RunKind } from "@/domain/schemas";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUid(request);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const body = (await request.json()) as { kind?: RunKind; trigger?: string; note?: string };
  const kind = body.kind ?? "INITIAL_PLAN";
  try {
    const result = await startRun({
      uid: auth.uid,
      sessionId: id,
      kind,
      trigger: body.trigger ?? null,
      idempotencyKey: idempotencyKey(request),
      bodyHash: sha256(JSON.stringify({ kind, trigger: body.trigger ?? null, note: body.note ?? null })),
      reflectionNote: body.note ?? null,
    });
    if (!result.ok) return json({ error: result.error }, result.status);
    return json({ runId: result.runId }, 202);
  } catch (error) {
    return persistHttp(error) ?? Promise.reject(error);
  }
}
