/** v0.4 §6.1 合格条件。雨の承認待ち・確認質問なし・記憶影響なしは完全成功にしない。 */

export const CRITERION_VERDICTS = ["PASS", "FAIL", "BLOCKED", "PARTIAL"] as const;
export type CriterionVerdict = (typeof CRITERION_VERDICTS)[number];

export const RUN_OUTCOMES = ["完全成功", "EMULATOR成功", "部分成功", "FAILED", "BLOCKED"] as const;
export type RunOutcome = (typeof RUN_OUTCOMES)[number];
export type PersistScoreTarget = "live" | "emulator" | "json";

export const CRITERION_IDS = [
  "spots_3_to_4",
  "locked_item",
  "no_closed",
  "initial_not_fail",
  "rain_auto_notify",
  "delay_waiting_approval",
  "delay_not_applied_early",
  "reflection_one_question",
  "memory_not_saved_before_approval",
  "memory_saved_after_approval",
  "next_plan_memory_influence",
  "persist_backend",
] as const;
export type CriterionId = (typeof CRITERION_IDS)[number];

export type CriterionJudgment = {
  id: CriterionId;
  label: string;
  verdict: CriterionVerdict;
  detail: string;
};

export const CRITERION_LABELS: Record<CriterionId, string> = {
  spots_3_to_4: "滞在は3〜4件",
  locked_item: "固定予定がある",
  no_closed: "CLOSED の店を入れない",
  initial_not_fail: "初回検証が FAIL ではない",
  rain_auto_notify: "雨は AUTO_NOTIFY（承認待ちは完全成功にしない）",
  delay_waiting_approval: "遅延は承認待ち",
  delay_not_applied_early: "遅延承認前に行程を変えない",
  reflection_one_question: "振り返りで確認質問が1問",
  memory_not_saved_before_approval: "承認前に記憶を保存しない",
  memory_saved_after_approval: "承認後に記憶がある",
  next_plan_memory_influence: "次回行程に記憶の影響が見える",
  persist_backend: "LIVE 永続化は Firestore（JSON へ黙って落とさない）",
};

export function judgment(id: CriterionId, verdict: CriterionVerdict, detail: string): CriterionJudgment {
  return { id, label: CRITERION_LABELS[id], verdict, detail };
}

export function scoreOutcome(criteria: CriterionJudgment[], persist: PersistScoreTarget = "live"): RunOutcome {
  if (criteria.some((c) => c.verdict === "FAIL")) return "FAILED";
  if (criteria.every((c) => c.verdict === "PASS")) {
    if (persist === "emulator") return "EMULATOR成功";
    if (persist === "live") return "完全成功";
    return "部分成功";
  }
  if (criteria.every((c) => c.verdict === "BLOCKED")) return "BLOCKED";
  if (criteria.some((c) => c.verdict === "PASS") && criteria.every((c) => c.verdict !== "FAIL")) {
    return "部分成功";
  }
  return "BLOCKED";
}

export function blockedAll(detail: string, persist?: CriterionJudgment): CriterionJudgment[] {
  return CRITERION_IDS.map((id) => {
    if (id === "persist_backend" && persist) return persist;
    return judgment(id, "BLOCKED", detail);
  });
}

export function visibleMemoryInfluences(
  influences: { effect?: string | null }[] | null | undefined,
): { effect: string }[] {
  return (influences ?? []).filter((i) => i.effect && i.effect !== "NONE") as { effect: string }[];
}

export function rainVerdict(input: {
  autoApplied: boolean;
  pendingApproval: boolean;
  nextValidationState?: string | null;
  reasons?: string[];
}): CriterionJudgment {
  if (input.autoApplied) {
    return judgment("rain_auto_notify", "PASS", "PLAN_AUTO_APPLIED");
  }
  const blockedByUnknown = (input.reasons ?? []).some((r) =>
    /CONDITIONAL|UNKNOWN|不明|営業時間|金額|移動時間/.test(r),
  );
  if (input.pendingApproval && (blockedByUnknown || input.nextValidationState === "CONDITIONAL")) {
    return judgment(
      "rain_auto_notify",
      "BLOCKED",
      `承認待ち（AUTO_NOTIFY 未達）。validation=${input.nextValidationState ?? "?"} ${(input.reasons ?? []).slice(0, 3).join(" / ")}`,
    );
  }
  if (input.pendingApproval) {
    return judgment(
      "rain_auto_notify",
      "FAIL",
      `PASS 相当なのに承認待ちにした。${(input.reasons ?? []).slice(0, 3).join(" / ")}`,
    );
  }
  return judgment("rain_auto_notify", "FAIL", "雨で AUTO_NOTIFY も承認も無い");
}

export function reflectionQuestionVerdict(status: string, hasQuestion: boolean): CriterionJudgment {
  if (status === "WAITING_INPUT" && hasQuestion) {
    return judgment("reflection_one_question", "PASS", "WAITING_INPUT + 1問");
  }
  if (status === "WAITING_APPROVAL") {
    return judgment("reflection_one_question", "FAIL", "確認質問なし。保存候補の承認へ進んだ（完全成功にしない）");
  }
  return judgment("reflection_one_question", "FAIL", `振り返り status=${status} question=${hasQuestion}`);
}

export function memoryInfluenceVerdict(influences: { effect?: string | null }[] | null | undefined): CriterionJudgment {
  const visible = visibleMemoryInfluences(influences);
  if (visible.length) {
    return judgment("next_plan_memory_influence", "PASS", visible.map((i) => i.effect).join(","));
  }
  return judgment("next_plan_memory_influence", "FAIL", "memoryInfluences が空、または NONE のみ（完全成功にしない）");
}
