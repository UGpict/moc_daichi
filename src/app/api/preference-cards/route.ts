import { json, requireUid } from "@/server/api/http";
import { listPreferenceCards } from "@/server/providers/preferenceCards";
import { getEnv } from "@/config/env";

export async function GET(request: Request) {
  const auth = requireUid(request);
  if ("error" in auth) return auth.error;
  const url = new URL(request.url);
  const subject = url.searchParams.get("subject") === "PARTNER" ? "PARTNER" : "SELF";
  const env = getEnv();
  const data = await listPreferenceCards({
    subject,
    lat: env.demoLat,
    lng: env.demoLng,
    areaName: env.demoAreaName,
  });
  return json({ ...data, subject, areaName: env.demoAreaName });
}
