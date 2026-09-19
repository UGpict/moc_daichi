import { structurePreference, walkingAvoid, walkingLike } from "@/domain/planning/requirements";
import type {
  Plan,
  PlanItem,
  Spot,
  TravelLeg,
  ValidationIssue,
  ValidationResult,
  PlanningInput,
  Preference,
} from "@/domain/schemas";
export type PlanContext = {
  spots: Record<string, Spot>;
  input: PlanningInput;
};

function issue(
  code: string,
  severity: ValidationIssue["severity"],
  message: string,
  itemIds: string[] = [],
  evidenceIds: string[] = [],
  extra: { targetId?: string | null; neededEvidence?: string | null; howToResolve?: string | null } = {},
): ValidationIssue {
  return {
    code,
    severity,
    message,
    itemIds,
    evidenceIds,
    targetId: extra.targetId ?? itemIds[0] ?? null,
    neededEvidence: extra.neededEvidence ?? null,
    howToResolve: extra.howToResolve ?? null,
  };
}

export function validatePlan(plan: Plan, ctx: PlanContext): ValidationResult {
  const issues: ValidationIssue[] = [];
  const items = plan.items;
  const spots = ctx.spots;
  const input = ctx.input;

  if (items.length < 1) {
    issues.push(issue("NO_ITEMS", "ERROR", "行程が空です"));
  }
  if (items.length > 4) {
    issues.push(
      issue(
        "TOO_MANY_ITEMS",
        "WARNING",
        "Day 1 の目安は 3〜4 件です",
        items.map((i) => i.id),
      ),
    );
  }

  const seenSpot = new Set<string>();
  for (const item of items) {
    const spot = spots[item.spotId];
    if (!spot) {
      issues.push(
        issue("UNKNOWN_SPOT", "ERROR", `未知の候補IDは採用できません: ${item.spotId}`, [
          item.id,
        ]),
      );
      continue;
    }
    if (seenSpot.has(item.spotId)) {
      issues.push(issue("DUPLICATE_SPOT", "ERROR", `${spot.name} が重複しています`, [item.id]));
    }
    seenSpot.add(item.spotId);
    if (new Date(item.endAt) <= new Date(item.startAt)) {
      issues.push(issue("TIME_ORDER", "ERROR", "終了が開始以前です", [item.id]));
    }
  }

  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];
    if (new Date(curr.startAt) < new Date(prev.endAt)) {
      issues.push(
        issue("OVERLAP", "ERROR", "滞在時間が重なっています", [prev.id, curr.id]),
      );
    }
  }

  const legsByKey = new Map<string, TravelLeg>();
  for (const leg of plan.legs) {
    const key = `${leg.fromSpotId ?? "MEET"}->${leg.toSpotId ?? "END"}`;
    legsByKey.set(key, leg);
  }

  const meetToFirst = plan.legs.find((l) => l.from === "MEET");
  const lastToEnd = plan.legs.find((l) => l.to === "END");
  if (!meetToFirst) {
    issues.push(issue("MISSING_LEG_START", "ERROR", "集合から最初のスポットへの移動がありません"));
  }
  if (!lastToEnd) {
    issues.push(issue("MISSING_LEG_END", "ERROR", "最後のスポットから終了地点への移動がありません"));
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const prevSpot = i === 0 ? null : items[i - 1].spotId;
    const from = i === 0 ? "MEET" : prevSpot;
    const leg =
      i === 0
        ? meetToFirst
        : plan.legs.find((l) => l.fromSpotId === from && l.toSpotId === item.spotId);
    if (!leg) {
      issues.push(
        issue("MISSING_LEG", "ERROR", "区間の移動が見つかりません", [item.id]),
      );
      continue;
    }
    const dur = leg.durationMinutes.value;
    const delay = leg.delayMinutesInjected ?? 0;
    if (dur == null) {
      issues.push(
        issue(
          "TRAVEL_UNKNOWN",
          "UNKNOWN",
          "移動時間が未検証です。0分にも直線距離にもしていません",
          [item.id],
          leg.evidenceIds,
          { neededEvidence: "routes.duration", howToResolve: "Routes API で当該区間を再取得する" },
        ),
      );
    } else {
      const arrive = new Date(leg.departureAt).getTime() + (dur + delay) * 60_000;
      if (arrive > new Date(item.startAt).getTime() + 60_000) {
        issues.push(
          issue("WAIT_OR_TRAVEL", "ERROR", "移動を含めると開始に間に合いません", [item.id], leg.evidenceIds),
        );
      }
    }
  }

  if (lastToEnd && items.length > 0) {
    const last = items[items.length - 1];
    const dur = lastToEnd.durationMinutes.value;
    const delay = lastToEnd.delayMinutesInjected ?? 0;
    const sessionEnd = tokyoEnd(input);
    if (dur == null) {
      issues.push(
        issue("END_TRAVEL_UNKNOWN", "UNKNOWN", "終了地点への移動時間が未検証です", [last.id]),
      );
    } else {
      const arriveEnd = new Date(last.endAt).getTime() + (dur + delay) * 60_000;
      if (arriveEnd > new Date(sessionEnd).getTime() + 60_000) {
        issues.push(
          issue("LATE_TO_END", "ERROR", "指定終了時刻までに終了地点へ着けません", [last.id]),
        );
      }
    }
  }

  for (const item of items) {
    const opening = plan.openings.find((o) => o.spotId === item.spotId);
    if (!opening) {
      issues.push(
        issue("OPENING_MISSING", "UNKNOWN", "営業時間が未検証です", [item.id]),
      );
    } else if (opening.state === "CLOSED") {
      issues.push(
        issue("CLOSED", "ERROR", "指定滞在時間帯は閉店です", [item.id], opening.evidenceIds),
      );
    } else if (opening.state === "UNKNOWN") {
      issues.push(
        issue("OPENING_UNKNOWN", "UNKNOWN", "営業時間が不明です", [item.id], opening.evidenceIds),
      );
    }
  }

  const mealMaxes: number[] = [];
  const facilityMaxes: number[] = [];
  let mealUnknown = false;
  let facilityUnknown = false;
  for (const item of items) {
    const spot = spots[item.spotId];
    if (!spot) continue;
    const isMeal = spot.categories.some((c) => /cafe|bakery|restaurant|food/.test(c));
    if (spot.costForTwoJpy.value == null) {
      if (isMeal) mealUnknown = true;
      else facilityUnknown = true;
      issues.push(
        issue(
          "COST_UNKNOWN",
          "UNKNOWN",
          `${spot.name} の二人料金は不明です。予算内とは断定しません`,
          [item.id],
          spot.costForTwoJpy.evidenceIds,
          { neededEvidence: "places.priceRange", howToResolve: "Place Details の priceRange を取得する。カテゴリから円を作らない" },
        ),
      );
    } else if (isMeal) mealMaxes.push(spot.costForTwoJpy.value.max);
    else facilityMaxes.push(spot.costForTwoJpy.value.max);
  }
  const mealSum = mealMaxes.reduce((a, b) => a + b, 0);
  const facilitySum = facilityMaxes.reduce((a, b) => a + b, 0);
  if (input.budget.mealsJpy != null && mealMaxes.length + (mealUnknown ? 1 : 0) > 0) {
    if (mealSum > input.budget.mealsJpy) {
      issues.push(
        issue(
          "OVER_BUDGET_MEALS",
          "ERROR",
          `食事の既知上限 ¥${mealSum} が食事予算 ¥${input.budget.mealsJpy} を超えます`,
          [],
          [],
          { howToResolve: "食事候補を替えるか予算を上げる。交通費は含めない" },
        ),
      );
    }
  }
  if (input.budget.facilitiesJpy != null && facilityMaxes.length + (facilityUnknown ? 1 : 0) > 0) {
    if (facilitySum > input.budget.facilitiesJpy) {
      issues.push(
        issue(
          "OVER_BUDGET_FACILITIES",
          "ERROR",
          `施設の既知上限 ¥${facilitySum} が施設予算 ¥${input.budget.facilitiesJpy} を超えます`,
          [],
          [],
          { howToResolve: "施設候補を替える。交通費・食事は別枠" },
        ),
      );
    }
  }

  const mustVisits = (input.selectedSpots ?? []).filter((s) => s.intent === "MUST_VISIT");
  for (const sel of mustVisits) {
    if (!items.some((it) => it.spotId === sel.spotId)) {
      issues.push(
        issue(
          "MUST_VISIT_MISSING",
          "ERROR",
          `必ず行くスポット「${sel.name}」が行程にありません`,
          [],
          [],
          { targetId: sel.spotId, howToResolve: "順序を変えるか、不成立理由と代替を提示する" },
        ),
      );
    }
  }

  for (const appt of input.fixedAppointments) {
    const match = items.find((it) => {
      if (appt.spotId && it.spotId === appt.spotId) return true;
      const spot = spots[it.spotId];
      return Boolean(
        appt.spotNameHint && spot && spot.name.includes(appt.spotNameHint),
      );
    });
    if (!match) {
      issues.push(
        issue("FIXED_MISSING", "ERROR", `時刻固定の予定「${appt.label}」が行程にありません`),
      );
      continue;
    }
    if (!match.locked) {
      issues.push(
        issue("FIXED_UNLOCKED", "ERROR", "時刻固定の予定がロックされていません", [match.id]),
      );
    }
    if (
      match.startAt !== appt.startAt ||
      match.endAt !== appt.endAt
    ) {
      issues.push(
        issue("FIXED_MOVED", "ERROR", "時刻固定の予定の時間が変わっています", [match.id]),
      );
    }
  }

  const musts = input.preferences.filter((p) => p.priority === "MUST");
  for (const pref of musts) {
    const outcomes = items.flatMap((it) => {
      const spot = spots[it.spotId];
      if (!spot) return [];
      return preferenceMatchIds(spot, [pref]).includes(pref.id) ? [it] : [];
    });
    if (outcomes.length === 0) {
      issues.push(
        issue(
          "MUST_UNMET",
          "ERROR",
          `必須の希望が満たされていません: ${pref.content}`,
          [],
          [],
          { targetId: pref.id, howToResolve: "両立できない場合は質問する。平均点で消さない" },
        ),
      );
    }
  }

  const errors = issues.filter((i) => i.severity === "ERROR");
  const unknowns = issues.filter((i) => i.severity === "UNKNOWN");
  const state: ValidationResult["state"] =
    errors.length > 0 ? "FAIL" : unknowns.length > 0 ? "CONDITIONAL" : "PASS";
  return { state, issues };
}

function tokyoEnd(input: PlanningInput): string {
  return `${input.dateTokyo}T${input.endTime}:00+09:00`;
}

export function preferenceMatchIds(spot: Spot, prefs: Preference[]): string[] {
  const ids: string[] = [];
  for (const raw of prefs) {
    const pref = structurePreference(raw);
    const outdoorWalk = spot.categories.includes("park") || spot.environment.value === "OUTDOOR";
    const exhibit =
      spot.categories.includes("art_gallery") ||
      spot.categories.includes("museum") ||
      /美術館|科学館/.test(spot.name);
    const sweet =
      spot.categories.includes("cafe") ||
      spot.categories.includes("bakery") ||
      /珈琲|カフェ|スイーツ/.test(spot.name);

    if (walkingAvoid(pref) && outdoorWalk) continue;
    if (pref.polarity === "AVOID" && pref.targetKind === "STANDING" && spot.standingBurden.value === "HIGH") continue;
    if (walkingLike(pref) && outdoorWalk) {
      ids.push(pref.id);
      continue;
    }
    if (pref.polarity === "LIKE" && pref.targetKind === "EXHIBIT" && exhibit) {
      ids.push(pref.id);
      continue;
    }
    if (pref.polarity === "LIKE" && pref.targetKind === "SWEETS" && sweet) {
      ids.push(pref.id);
      continue;
    }
    if (pref.polarity === "AVOID") continue;
    const blob = `${spot.name} ${spot.categories.join(" ")}`.toLowerCase();
    if (pref.targetKind === "OTHER" && blob.includes(pref.content.toLowerCase())) ids.push(pref.id);
  }
  return ids;
}

export function doneItemsPreserved(prev: PlanItem[], next: PlanItem[]): boolean {
  const nextBySpot = new Map(next.map((i) => [i.spotId, i]));
  for (const item of prev.filter((i) => i.progress === "DONE" || i.progress === "IN_PROGRESS")) {
    const found = nextBySpot.get(item.spotId);
    if (!found) return false;
    if (found.startAt !== item.startAt || found.endAt !== item.endAt) return false;
  }
  return true;
}
