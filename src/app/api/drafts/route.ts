import { json, requireUid } from "@/server/api/http";
import { createDraft, clearDraft, getOpenDraft } from "@/server/agent/drafts";
import { getEnv } from "@/config/env";
import { selectedSpotSchema } from "@/domain/schemas";
import { z } from "zod";

const bodySchema = z.object({
  selectedSpots: z.array(selectedSpotSchema),
  clear: z.boolean().optional(),
});

export async function GET(request: Request) {
  const auth = await requireUid(request);
  if ("error" in auth) return auth.error;
  const draft = await getOpenDraft(auth.uid);
  return json({ draft });
}

export async function POST(request: Request) {
  const auth = await requireUid(request);
  if ("error" in auth) return auth.error;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.message }, 400);
  if (parsed.data.clear) {
    await clearDraft(auth.uid);
    return json({ ok: true, draft: null });
  }
  const env = getEnv();
  const draft = await createDraft(auth.uid, env.demoAreaId, parsed.data.selectedSpots);
  return json({ ok: true, draft });
}
