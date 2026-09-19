import { json, requireUid } from "@/server/api/http";
import { getEnv, assertLiveProvider } from "@/config/env";
import { searchHappenings, searchSpots, type ProviderCtx } from "@/server/providers";

export async function GET(request: Request) {
  const auth = await requireUid(request);
  if ("error" in auth) return auth.error;
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  if (q.length < 2) return json({ spots: [], note: "2文字以上" });
  const env = getEnv();
  if (env.profile === "LIVE") {
    try {
      assertLiveProvider("places");
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "BLOCKED", spots: [] }, 503);
    }
  }
  const ctx: ProviderCtx = {
    runId: "place-search",
    overlays: [],
    cache: new Map(),
    httpAttempts: 0,
    onHttp: () => undefined,
  };
  const area = { lat: env.demoLat, lng: env.demoLng, name: env.demoAreaName };
  const result = await searchHappenings(ctx, { area, query: q, radiusMeters: 4000 }).catch(() =>
    searchSpots(ctx, { area, category: q, radiusMeters: 3000 }),
  );
  return json({
    spots: result.spots.slice(0, 8).map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      categories: s.categories,
      photoName: s.photoName,
    })),
    note: env.profile === "LIVE" ? "Places Text Search。開催中確認ではない" : "DEV カタログ検索",
  });
}
