import { NextResponse } from "next/server";
import { getEnv } from "@/config/env";
import { json, requireUid } from "@/server/api/http";
import { parsePlacesPhotoName } from "@/server/places/photoName";

export async function GET(request: Request) {
  const auth = await requireUid(request);
  if ("error" in auth) return auth.error;
  const url = new URL(request.url);
  const name = parsePlacesPhotoName(url.searchParams.get("name"));
  if (!name) return json({ error: "invalid photo name" }, 400);

  if (name.startsWith("mock:")) {
    return json({ error: "mock photo missing" }, 404);
  }

  const env = getEnv();
  if (!env.googleMapsApiKey) return json({ error: "places photo BLOCKED" }, 503);

  const media = new URL(`https://places.googleapis.com/v1/${name}/media`);
  media.searchParams.set("maxWidthPx", "800");
  media.searchParams.set("skipHttpRedirect", "true");
  const res = await fetch(media, {
    headers: { "X-Goog-Api-Key": env.googleMapsApiKey },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return json({ error: `places photo ${res.status}` }, 502);
  const data = (await res.json()) as { photoUri?: string };
  if (!data.photoUri) return json({ error: "photo uri missing" }, 502);
  return NextResponse.redirect(data.photoUri, 302);
}
