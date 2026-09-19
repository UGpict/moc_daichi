import { ESTIMATE } from "./sample-data";
import type { CostBreakdown, CostConditions, CostLine } from "./types";

export const RATES = {
  basePlan: ESTIMATE.basePlanYen,
  includedStayDays: 2,
  stayExtensionPerDay: 11_000,
  includedTransportKm: 20,
  extraTransportPer10km: 5_500,
  nightTransport: 11_000,
  cremation: 12_000,
  foodAndGifts: 110_000,
} as const;

export function stayExtensionDays(stayDays: number): number {
  return Math.max(0, stayDays - RATES.includedStayDays);
}

export function stayExtensionCost(stayDays: number): number {
  return stayExtensionDays(stayDays) * RATES.stayExtensionPerDay;
}

export function transportOverageUnits(km: number): number {
  if (km <= RATES.includedTransportKm) {
    return 0;
  }

  return Math.ceil((km - RATES.includedTransportKm) / 10);
}

export function transportOverageKm(km: number): number {
  return transportOverageUnits(km) * 10;
}

export function transportOverageCost(km: number): number {
  return transportOverageUnits(km) * RATES.extraTransportPer10km;
}

export function nightTransportCost(nightTransport: boolean): number {
  return nightTransport ? RATES.nightTransport : 0;
}

export function calculateReferenceCost(
  conditions: CostConditions,
): CostBreakdown {
  const extraStayDays = stayExtensionDays(conditions.stayDays);
  const extraKm = transportOverageKm(conditions.transportKm);
  const stayAmount = stayExtensionCost(conditions.stayDays);
  const transportAmount = transportOverageCost(conditions.transportKm);
  const nightAmount = nightTransportCost(conditions.nightTransport);

  const lines: CostLine[] = [
    {
      id: "base",
      label: "一日葬基本プラン",
      amount: RATES.basePlan,
      note: "税込",
    },
    {
      id: "stay",
      label:
        extraStayDays === 0
          ? "安置延長"
          : `安置延長${extraStayDays}日`,
      amount: stayAmount,
      note:
        extraStayDays === 0
          ? "基本プラン内（2日まで）"
          : `1日${RATES.stayExtensionPerDay.toLocaleString("ja-JP")}円 × ${extraStayDays}日`,
    },
    {
      id: "transport",
      label: extraKm === 0 ? "搬送超過" : `搬送超過${extraKm}km`,
      amount: transportAmount,
      note:
        extraKm === 0
          ? "基本プラン内（20kmまで）"
          : `10kmごと${RATES.extraTransportPer10km.toLocaleString("ja-JP")}円（端数切上げ）`,
    },
    {
      id: "night",
      label: "夜間搬送",
      amount: nightAmount,
      note: conditions.nightTransport ? "加算あり" : "なし",
    },
    {
      id: "cremation",
      label: "火葬料",
      amount: RATES.cremation,
      note: "今回の想定",
    },
    {
      id: "food",
      label: "飲食・返礼品（20名）",
      amount: RATES.foodAndGifts,
      note: "税込",
    },
  ];

  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
    includedStayDays: RATES.includedStayDays,
    stayExtensionDays: extraStayDays,
    transportOverageKm: extraKm,
  };
}

export function addedConditionsDifference(total: number): number {
  return total - RATES.basePlan;
}
