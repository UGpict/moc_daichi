import type { MemoryCandidate } from "@/domain/schemas";

export type NormalizedReflection = {
  observations: string[];
  hypotheses: string[];
  uncertainties: string[];
  clarification: { prompt: string; options: string[] } | null;
  memoryCandidates: Array<{
    subject: "SELF" | "PARTNER" | "BOTH";
    type: "CARE" | "PREFERENCE" | "CONSTRAINT";
    content: string;
    sourceType: "SELF_REPORT" | "PARTNER_STATEMENT_REPORTED" | "OBSERVATION" | "HYPOTHESIS";
    evidenceQuote: string;
    strength: "SOFT" | "HARD";
    scope: "NEXT_DATE" | "ONGOING";
    careTarget: "WALKING" | "STANDING" | "SWEETS" | "EXHIBIT" | "INDOOR" | "REST" | "OTHER" | null;
    careDirection: "REDUCE" | "INCREASE" | "PREFER" | "AVOID" | null;
  }>;
};

const DEFAULT_CAUSE_QUESTION = {
  prompt: "相手が大変そうにしていた点で、いちばん近いものは？",
  options: ["長く立つのがしんどいと言っていた", "歩く距離が長かった", "分からない", "保存しない"],
};

export function noteMentionsFatigue(text: string): boolean {
  return /疲/.test(text);
}

export function noteMentionsStanding(text: string): boolean {
  return /立/.test(text);
}

export function noteMentionsWalkingBurden(text: string): boolean {
  return /歩/.test(text);
}

export function causeUnknown(note: string): boolean {
  return noteMentionsFatigue(note) && !noteMentionsStanding(note) && !noteMentionsWalkingBurden(note);
}

export function interpretConfirmation(answer: string): {
  saveCausal: boolean;
  careTarget: "STANDING" | "WALKING" | "REST" | "OTHER" | null;
  careDirection: "REDUCE" | "INCREASE" | "PREFER" | "AVOID" | null;
  content: string;
} {
  const trimmed = answer.trim();
  if (!trimmed || trimmed === "保存しない") {
    return { saveCausal: false, careTarget: null, careDirection: null, content: trimmed };
  }
  if (trimmed === "分からない") {
    return { saveCausal: false, careTarget: null, careDirection: null, content: trimmed };
  }
  if (/長く立|立ちっぱなし|立つのが/.test(trimmed)) {
    return { saveCausal: true, careTarget: "STANDING", careDirection: "REDUCE", content: trimmed };
  }
  if (/歩く距離|歩行が|歩くのがつら/.test(trimmed)) {
    return { saveCausal: true, careTarget: "WALKING", careDirection: "REDUCE", content: trimmed };
  }
  return { saveCausal: true, careTarget: null, careDirection: null, content: trimmed };
}

/** 原文だけから観察・仮説を分ける。疲→STANDING もカフェ単語→好評も補完しない。 */
export function mockFromNote(masked: string): NormalizedReflection {
  const observations: string[] = [];
  const hypotheses: string[] = [];
  const uncertainties: string[] = [];
  const memoryCandidates: NormalizedReflection["memoryCandidates"] = [];

  if (noteMentionsFatigue(masked)) {
    observations.push("疲労への言及がある");
  }
  if (causeUnknown(masked)) {
    hypotheses.push("疲労の原因は立位または歩行の可能性がある（未確認）");
    uncertainties.push("何が負担だったか");
  }
  if (noteMentionsStanding(masked) && noteMentionsFatigue(masked)) {
    observations.push("立位と疲労が原文にある");
    memoryCandidates.push({
      subject: "PARTNER",
      type: "CARE",
      content: "長く立つと疲れると原文にある",
      sourceType: "OBSERVATION",
      evidenceQuote: masked.slice(0, 80),
      strength: "SOFT",
      scope: "NEXT_DATE",
      careTarget: "STANDING",
      careDirection: "REDUCE",
    });
  }

  return {
    observations: observations.length ? observations : masked.trim() ? ["振り返りの記述がある"] : [],
    hypotheses,
    uncertainties,
    clarification: causeUnknown(masked) ? { ...DEFAULT_CAUSE_QUESTION } : null,
    memoryCandidates,
  };
}

export function stripInferredStanding(
  candidate: NormalizedReflection["memoryCandidates"][number],
  note: string,
): NormalizedReflection["memoryCandidates"][number] | null {
  if (candidate.sourceType === "HYPOTHESIS") return null;
  const quoteAndNote = `${candidate.evidenceQuote}\n${note}`;
  const standingOk = candidate.careTarget === "STANDING" && noteMentionsStanding(quoteAndNote);
  const walkingOk = candidate.careTarget === "WALKING" && noteMentionsWalkingBurden(quoteAndNote);
  if (candidate.careTarget === "STANDING" && !standingOk) {
    return null;
  }
  if (candidate.careTarget === "WALKING" && candidate.type === "CARE" && !walkingOk) {
    return null;
  }
  return candidate;
}

export function normalizeReflectionLlm(
  data: {
    observations?: string[];
    hypotheses?: string[];
    uncertainties?: string[];
    clarification?: { prompt: string; options: string[] } | null;
    memoryCandidates?: NormalizedReflection["memoryCandidates"];
  },
  note: string,
): NormalizedReflection {
  const observations = [...(data.observations ?? [])];
  const hypotheses = [...(data.hypotheses ?? [])];
  const uncertainties = [...(data.uncertainties ?? [])];
  const kept: NormalizedReflection["memoryCandidates"] = [];

  for (const raw of data.memoryCandidates ?? []) {
    if (raw.sourceType === "HYPOTHESIS") {
      hypotheses.push(raw.content);
      continue;
    }
    const cleaned = stripInferredStanding(raw, note);
    if (!cleaned) {
      if (raw.careTarget === "STANDING" || raw.type === "CARE") {
        hypotheses.push(raw.content);
        if (!uncertainties.includes("何が負担だったか") && causeUnknown(note)) {
          uncertainties.push("何が負担だったか");
        }
      }
      continue;
    }
    kept.push(cleaned);
  }

  if (causeUnknown(note) && !hypotheses.some((h) => /原因|立|歩/.test(h))) {
    hypotheses.push("疲労の原因は未確認");
  }

  const clarification = causeUnknown(note)
    ? data.clarification && data.clarification.options.length >= 2
      ? data.clarification
      : { ...DEFAULT_CAUSE_QUESTION }
    : data.clarification ?? null;

  return {
    observations: observations.length ? observations : mockFromNote(note).observations,
    hypotheses,
    uncertainties,
    clarification,
    memoryCandidates: kept.filter((c) => c.sourceType !== "HYPOTHESIS"),
  };
}

export function isSaveableCandidate(candidate: Pick<MemoryCandidate, "sourceType">): boolean {
  return candidate.sourceType !== "HYPOTHESIS";
}
