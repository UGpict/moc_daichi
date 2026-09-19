import { json, persistHttp } from "@/server/api/http";
import { authorizeWorkerRequest } from "@/server/jobs/auth";
import { processOneJob } from "@/server/jobs/dispatch";
import { maskSecrets } from "@/server/security/logMask";

export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = authorizeWorkerRequest(request);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const body = (await request.json().catch(() => ({}))) as { runId?: string };
  try {
    const result = await processOneJob(body.runId);
    return json({
      runId: result.runId,
      claimed: result.claimed,
      empty: result.empty,
    });
  } catch (error) {
    const blocked = persistHttp(error);
    if (blocked) return blocked;
    console.error("internal job", maskSecrets(String(error)));
    return json({ error: "job failed" }, 500);
  }
}
