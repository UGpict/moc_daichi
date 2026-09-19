import { getEnv } from "@/config/env";
import { searchSpots, type ProviderCtx } from "@/server/providers";
import { parsePlacesPhotoName, vibeFromCategories } from "@/server/places/photoName";

export type PreferenceCard = {
  id: string;
  name: string;
  vibe: string;
  categories: string[];
  photoName: string | null;
  attribution: string | null;
  photoSource: "PLACES" | "NONE";
};

const cache: ProviderCtx["cache"] = new Map();

function ctx(): ProviderCtx {
  return {
    runId: "preference-cards",
    overlays: [],
    cache,
    httpAttempts: 0,
    onHttp: () => undefined,
  };
}

const QUERIES: Record<"SELF" | "PARTNER", { category: string }[]> = {
  SELF: [{ category: "散歩" }, { category: "展示" }, { category: "カフェ" }],
  PARTNER: [{ category: "甘いもの" }, { category: "カフェ" }, { category: "散歩" }],
};

export async function listPreferenceCards(args: {
  subject: "SELF" | "PARTNER";
  lat: number;
  lng: number;
  areaName: string;
}): Promise<{ cards: PreferenceCard[]; note: string; photoMode: "PLACES" | "NONE" }> {
  const env = getEnv();
  const queries = QUERIES[args.subject];
  const results = await Promise.all(
    queries.map((q) =>
      searchSpots(ctx(), {
        area: { lat: args.lat, lng: args.lng, name: args.areaName },
        category: q.category,
        radiusMeters: 2500,
      }).catch(() => ({ spots: [], evidence: [] })),
    ),
  );

  const seen = new Set<string>();
  const buckets = results.map((r, i) =>
    r.spots
      .filter((s) => s.id !== "mock:nagoya-station")
      .map((s) => {
        const photoName = parsePlacesPhotoName(s.photoName);
        return {
          id: s.id,
          name: s.name,
          vibe: vibeFromCategories(s.categories, args.subject) || queries[i]!.category,
          categories: s.categories,
          photoName,
          attribution: s.photoAttribution,
          photoSource: photoName && !photoName.startsWith("mock:") ? ("PLACES" as const) : ("NONE" as const),
        };
      }),
  );

  const cards: PreferenceCard[] = [];
  let round = 0;
  while (cards.length < 8) {
    let added = false;
    for (const bucket of buckets) {
      const next = bucket.find((c) => !seen.has(c.id));
      if (!next) continue;
      seen.add(next.id);
      cards.push(next);
      added = true;
      if (cards.length >= 8) break;
    }
    if (!added) break;
    round += 1;
    if (round > 8) break;
  }

  const hasPlacesPhoto = cards.some((c) => c.photoSource === "PLACES");
  return {
    cards,
    photoMode: hasPlacesPhoto ? "PLACES" : "NONE",
    note: hasPlacesPhoto
      ? "写真は Google Places の取得分だけです。無いカードは写真未取得と表示します。"
      : env.runtime === "LIVE"
        ? "Places から写真名を取れませんでした。店名とカテゴリだけで選びます。"
        : "MOCK のため施設写真は出しません。LIVE では Places の写真を使います。",
  };
}
