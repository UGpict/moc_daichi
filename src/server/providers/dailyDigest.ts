import { getEnv } from "@/config/env";
import { PROVIDER_VERSION } from "@/config/settings";
import type { DailyDigest, DigestItem, Spot } from "@/domain/schemas";
import { realNowIso, tokyoToday } from "@/lib/time";
import { searchHappenings, searchSpots, type ProviderCtx } from "@/server/providers";
import { vibeFromCategories } from "@/server/places/photoName";
import { withStore } from "@/server/repositories/store";

function digestId(areaId: string, lat: number, lng: number, radius: number, date: string) {
  return `digest:${areaId}:${lat.toFixed(5)}:${lng.toFixed(5)}:${radius}:${date}:${PROVIDER_VERSION}`;
}

function ctx(): ProviderCtx {
  return {
    runId: "daily-digest",
    overlays: [],
    cache: new Map(),
    httpAttempts: 0,
    onHttp: () => undefined,
  };
}

export async function readTodayDigest(): Promise<DailyDigest | null> {
  const env = getEnv();
  const id = digestId(env.demoAreaId, env.demoLat, env.demoLng, 2500, tokyoToday());
  return withStore((db) => db.digests?.[id] ?? null);
}

export async function maybeRefreshDailyDigest(): Promise<void> {
  const env = getEnv();
  const date = tokyoToday();
  const id = digestId(env.demoAreaId, env.demoLat, env.demoLng, 2500, date);
  const start = await withStore((db) => {
    db.digests ??= {};
    const cur = db.digests[id];
    if (cur?.status === "READY" && cur.items.length > 0 && (cur.format ?? 1) >= 2) return false;
    if (cur?.status === "FETCHING") {
      const age = Date.now() - new Date(cur.fetchedAt).getTime();
      if (age < 120_000) return false;
    }
    db.digests[id] = {
      id,
      tokyoDate: date,
      areaName: env.demoAreaName,
      lat: env.demoLat,
      lng: env.demoLng,
      fetchedAt: realNowIso(),
      status: "FETCHING",
      note: "Asia/Tokyo の日付で一日一回取得します",
      items: cur?.items ?? [],
      spots: cur?.spots ?? {},
      format: 2,
      areaId: env.demoAreaId,
      radiusMeters: 2500,
      providerVersion: PROVIDER_VERSION,
    };
    return true;
  });
  if (!start) return;

  const area = { lat: env.demoLat, lng: env.demoLng, name: env.demoAreaName };
  const provider = ctx();
  const nearby = [
    { category: "催し", kind: "HAPPENING" as const, query: "催し", why: "周辺の会場・催し向きの場所" },
    { category: "展示", kind: "HAPPENING" as const, query: "展示", why: "周辺の展示・美術館" },
    { category: "散歩", kind: "PLACE" as const, query: "散歩", why: "周辺の散策向きスポット" },
    { category: "カフェ", kind: "PLACE" as const, query: "カフェ", why: "周辺のカフェ・甘いもの" },
  ];
  const texts = [
    { query: "展覧会", kind: "HAPPENING" as const, why: "テキスト検索「展覧会」。開催中と公式確認したわけではない" },
    { query: "イベント", kind: "HAPPENING" as const, why: "テキスト検索「イベント」。開催中と公式確認したわけではない" },
  ];

  const spots: Record<string, Spot> = {};
  const items: DigestItem[] = [];
  const seen = new Set<string>();

  const nearbyResults = await Promise.all(
    nearby.map((q) =>
      searchSpots(provider, { area, category: q.category, radiusMeters: 3000 }).then(
        (r) => ({ q, spots: r.spots }),
        () => ({ q, spots: [] as Spot[] }),
      ),
    ),
  );
  const textResults = await Promise.all(
    texts.map((q) =>
      searchHappenings(provider, { area, query: q.query, radiusMeters: 4000 }).then(
        (r) => ({ q, spots: r.spots }),
        () => ({ q, spots: [] as Spot[] }),
      ),
    ),
  );

  const packs = [...textResults, ...nearbyResults].map((pack) => ({
    ...pack,
    spots: pack.spots.filter((s) => s.id !== "mock:nagoya-station"),
  }));

  let added = true;
  let guard = 0;
  while (items.length < 16 && added && guard < 24) {
    added = false;
    guard += 1;
    for (const pack of packs) {
      const spot = pack.spots.find((s) => !seen.has(s.id));
      if (!spot || items.length >= 16) continue;
      seen.add(spot.id);
      spots[spot.id] = spot;
      items.push({
        spotId: spot.id,
        vibe:
          pack.q.kind === "HAPPENING"
            ? /展/.test(pack.q.query)
              ? "展示"
              : "催し"
            : vibeFromCategories(spot.categories, "SELF"),
        kind: pack.q.kind,
        query: pack.q.query,
        why: pack.q.why,
        occurrenceId: null,
        displayKind: pack.q.kind === "HAPPENING" ? "VENUE" : "PLACE",
      });
      added = true;
    }
  }

  await withStore((db) => {
    db.digests ??= {};
    db.digests[id] = {
      id,
      tokyoDate: date,
      areaName: env.demoAreaName,
      lat: env.demoLat,
      lng: env.demoLng,
      fetchedAt: realNowIso(),
      status: items.length ? "READY" : "FAILED",
      note: items.length
        ? "今日このエリアで取れた候補です。チケット販売中・本日開催とは限りません。"
        : "今日の候補を取得できませんでした",
      items,
      spots,
      format: 2,
      areaId: env.demoAreaId,
      radiusMeters: 2500,
      providerVersion: PROVIDER_VERSION,
    };
  });
}

export function digestKey(areaId: string, lat: number, lng: number, radius: number, date: string) {
  return digestId(areaId, lat, lng, radius, date);
}
