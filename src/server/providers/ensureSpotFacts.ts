import type { Evidence, Spot } from "@/domain/schemas";
import { getSpotDetails, checkOpen, type ProviderCtx } from "@/server/providers";

export type SpotFactField =
  | "opening"
  | "cost"
  | "environment"
  | "restEase"
  | "standingBurden"
  | "officialUrl";

function missing(spot: Spot, field: SpotFactField): boolean {
  if (field === "cost") return spot.costForTwoJpy.value == null;
  if (field === "environment") return spot.environment.value == null;
  if (field === "restEase") return spot.restEase.value == null;
  if (field === "standingBurden") return spot.standingBurden.value == null;
  if (field === "officialUrl") return !spot.officialUrl;
  return false;
}

export async function ensureSpotFacts(args: {
  ctx: ProviderCtx;
  spots: Record<string, Spot>;
  spotIds: string[];
  requiredFields: SpotFactField[];
  targetDate: string;
  maxAge?: number;
  signal?: AbortSignal;
}): Promise<{ spots: Record<string, Spot>; evidence: Evidence[]; fetchedIds: string[] }> {
  void args.signal;
  void args.maxAge;
  const spots = { ...args.spots };
  const evidence: Evidence[] = [];
  const fetchedIds: string[] = [];
  const need = args.spotIds.filter((id) => {
    const s = spots[id];
    if (!s) return true;
    const fields = args.requiredFields.filter((f) => f !== "opening");
    return fields.some((f) => missing(s, f)) || args.requiredFields.includes("opening");
  });

  for (const id of need.slice(0, 6)) {
    const d = await getSpotDetails(args.ctx, { spotId: id });
    evidence.push(...d.evidence);
    if (d.spot) {
      spots[d.spot.id] = d.spot;
      fetchedIds.push(d.spot.id);
    }
    if (args.requiredFields.includes("opening") && spots[id]) {
      const open = await checkOpen(args.ctx, {
        spotId: id,
        startAt: `${args.targetDate}T13:00:00+09:00`,
        endAt: `${args.targetDate}T14:00:00+09:00`,
      });
      void open;
    }
  }
  return { spots, evidence, fetchedIds };
}
