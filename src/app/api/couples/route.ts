import { json, persistHttp, requireUid } from "@/server/api/http";
import { createCouple } from "@/server/api/actions";

export async function POST(request: Request) {
  const auth = await requireUid(request);
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => ({}))) as { isDemo?: boolean };
  try {
    const created = await createCouple(auth.uid, body.isDemo !== false);
    return json(created, 201);
  } catch (error) {
    return persistHttp(error) ?? Promise.reject(error);
  }
}
