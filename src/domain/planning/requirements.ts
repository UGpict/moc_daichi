import type { Preference } from "@/domain/schemas";

export type StructuredPreference = Preference & {
  polarity: "LIKE" | "AVOID";
  targetKind: Preference["targetKind"];
};

export function inferTargetKind(content: string): Preference["targetKind"] {
  if (/歩きたくない|歩くのがつら|長く歩|歩行が負担|立ちっぱなし/.test(content)) return "WALKING";
  if (/立/.test(content) && /つら|負担|疲/.test(content)) return "STANDING";
  if (/散歩|散策|歩くのが好き|歩きたい/.test(content) && !/たくない|つらい/.test(content)) return "WALKING";
  if (/展示|美術館|博物館|展覧/.test(content)) return "EXHIBIT";
  if (/甘い|スイーツ|カフェ|デザート|ケーキ/.test(content)) return "SWEETS";
  if (/屋内|雨/.test(content)) return "INDOOR";
  if (/休憩|座/.test(content)) return "REST";
  return "OTHER";
}

export function inferPolarity(content: string): "LIKE" | "AVOID" {
  if (/たくない|ない方が|避け|負担|つら|疲れて|嫌/.test(content) && !/好き|したい|したい/.test(content.replace(/たくない/g, ""))) {
    return "AVOID";
  }
  if (/歩きたくない|立ちたくない|避けたい/.test(content)) return "AVOID";
  return "LIKE";
}

export function structurePreference(pref: Preference): StructuredPreference {
  const content = pref.content;
  return {
    ...pref,
    polarity: pref.polarity ?? inferPolarity(content),
    targetKind: pref.targetKind && pref.targetKind !== "OTHER" ? pref.targetKind : inferTargetKind(content),
    horizon: pref.horizon ?? "THIS_DATE",
  };
}

export function walkingAvoid(pref: StructuredPreference): boolean {
  return pref.polarity === "AVOID" && pref.targetKind === "WALKING";
}

export function walkingLike(pref: StructuredPreference): boolean {
  return pref.polarity === "LIKE" && pref.targetKind === "WALKING";
}
