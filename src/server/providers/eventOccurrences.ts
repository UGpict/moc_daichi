import type { EventOccurrence } from "@/domain/schemas";
import { realNowIso } from "@/lib/time";

/** Places の「イベント」検索は会場候補であり、本日開催の確定ではない。 */
export function occurrencesFromPlacesSearch(): EventOccurrence[] {
  return [];
}

export function venueDisplayNote(): string {
  return "開催情報は未確認です。施設・会場候補として表示します。";
}

export function toUnconfirmedVenueCard(spotId: string): Pick<EventOccurrence, "venueSpotId" | "state"> {
  return { venueSpotId: spotId, state: "UNCONFIRMED" };
}

void realNowIso;
