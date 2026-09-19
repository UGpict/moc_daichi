import type { Plan, TravelMode, ValidationIssue } from "@/domain/schemas";

export type RepairStrategy =
  | "DROP_FLEXIBLE"
  | "DROP_CLOSED"
  | "SHORTEN_STAYS"
  | "REORDER_NEAREST"
  | "CHANGE_MODE_TRANSIT";

export type RepairChoice = {
  strategy: RepairStrategy;
  nextIds: string[];
  stayScale: number;
  travelMode: TravelMode | null;
  reason: string;
};

export type RepairAttemptRecord = {
  n: number;
  failCodes: string[];
  strategy: RepairStrategy;
  reason: string;
  beforeIds: string[];
  afterIds: string[];
  stayScale: number;
  travelMode: TravelMode | null;
  revalidation: string;
  remainingCodes: string[];
};

function droppable(ids: string[], locked: Set<string>, must: Set<string>): string[] {
  return ids.filter((id) => !locked.has(id) && !must.has(id));
}

export function chooseRepairStrategy(args: {
  codes: string[];
  attemptIndex: number;
  orderedIds: string[];
  lockedIds: string[];
  mustVisit: string[];
  closedSpotIds?: string[];
}): RepairChoice | null {
  const locked = new Set(args.lockedIds.filter(Boolean));
  const must = new Set(args.mustVisit.filter(Boolean));
  const ids = args.orderedIds.filter(Boolean);
  const flexible = droppable(ids, locked, must);
  const codes = new Set(args.codes);

  if (codes.has("CLOSED") && flexible.length) {
    const closed = (args.closedSpotIds ?? []).find((id) => flexible.includes(id));
    const drop = closed ?? flexible.at(-1)!;
    return {
      strategy: "DROP_CLOSED",
      nextIds: ids.filter((id) => id !== drop),
      stayScale: 1,
      travelMode: null,
      reason: `閉店の候補（${drop}）を外して再検証する`,
    };
  }

  if ((codes.has("LATE_TO_END") || codes.has("WAIT_OR_TRAVEL") || codes.has("OVERLAP")) && args.attemptIndex === 0 && flexible.length && ids.length > 3) {
    const drop = flexible.at(-1)!;
    return {
      strategy: "DROP_FLEXIBLE",
      nextIds: ids.filter((id) => id !== drop),
      stayScale: 1,
      travelMode: null,
      reason: `終了遅れのため固定以外の 1 件（${drop}）を外す`,
    };
  }

  if ((codes.has("LATE_TO_END") || codes.has("WAIT_OR_TRAVEL") || codes.has("OVERLAP")) && args.attemptIndex <= 1) {
    return {
      strategy: "SHORTEN_STAYS",
      nextIds: ids,
      stayScale: 0.55,
      travelMode: null,
      reason: "滞在を短縮して終了時刻に間に合わせる（条件の上限は緩めない）",
    };
  }

  if (codes.has("LATE_TO_END") || codes.has("WAIT_OR_TRAVEL")) {
    if (args.attemptIndex >= 1 && flexible.length >= 2) {
      const next = [ids[0], ...ids.slice(1).reverse()];
      return {
        strategy: "REORDER_NEAREST",
        nextIds: [...new Set(next.filter(Boolean))],
        stayScale: 0.55,
        travelMode: null,
        reason: "訪問順を入れ替えて移動を短くする",
      };
    }
    return {
      strategy: "CHANGE_MODE_TRANSIT",
      nextIds: ids,
      stayScale: 0.55,
      travelMode: "TRANSIT",
      reason: "徒歩では間に合わないので TRANSIT で再検証する",
    };
  }

  if (flexible.length && ids.length > 3) {
    const drop = flexible.at(-1)!;
    return {
      strategy: "DROP_FLEXIBLE",
      nextIds: ids.filter((id) => id !== drop),
      stayScale: 1,
      travelMode: null,
      reason: `FAIL (${args.codes.join(",")}) のため固定以外を 1 件外す`,
    };
  }

  return null;
}

export function repairSummary(plan: Plan): { codes: string[]; itemIds: string[] } {
  const errors = plan.validation.issues.filter((i) => i.severity === "ERROR");
  return {
    codes: [...new Set(errors.map((i: ValidationIssue) => i.code))],
    itemIds: plan.items.map((i) => i.spotId),
  };
}

export const HUMAN_REPAIR_OPTIONS = ["この行程は捨てる", "固定以外をもう 1 件外して再実行", "終了時刻を自分が延ばす"] as const;
