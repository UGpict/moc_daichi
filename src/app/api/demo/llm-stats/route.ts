import { json, requireUid } from "@/server/api/http";
import { getEnv } from "@/config/env";
import { demoAllowed } from "@/server/auth";
import { schemaRates } from "@/server/llm/stats";

export async function GET(request: Request) {
  const auth = await requireUid(request);
  if ("error" in auth) return auth.error;
  const env = getEnv();
  if (!env.enableDemoControls || !demoAllowed(auth.uid)) {
    return json({ error: "demo controls disabled" }, 403);
  }
  return json(schemaRates());
}
