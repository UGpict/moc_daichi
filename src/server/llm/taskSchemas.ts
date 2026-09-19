import { z } from "zod";

export const planProposalSchema = z.object({
  think: z.string().max(800).optional(),
  orderedSpotIds: z.array(z.string()).min(1).max(6),
  stayMinutes: z.record(z.string(), z.number()).optional(),
  restInsertAfter: z.array(z.string()).optional(),
  preferenceNotes: z
    .array(
      z.object({
        preferenceId: z.string(),
        state: z.enum(["SATISFIED", "PARTIAL", "UNMET", "UNKNOWN"]),
        note: z.string(),
      }),
    )
    .optional(),
  rejected: z.array(z.object({ spotId: z.string(), reason: z.string() })).default([]),
  assumptions: z.array(z.string()).default([]),
  tradeoffs: z.array(z.string()).default([]),
});
export type PlanProposal = z.infer<typeof planProposalSchema>;

export const reflectionStrictSchema = z.object({
  observations: z.array(z.string()),
  hypotheses: z.array(z.string()),
  uncertainties: z.array(z.string()),
  clarification: z
    .object({
      prompt: z.string(),
      options: z.array(z.string()).min(2).max(6),
    })
    .nullable(),
  memoryCandidates: z.array(
    z.object({
      subject: z.enum(["SELF", "PARTNER", "BOTH"]),
      type: z.enum(["CARE", "PREFERENCE", "CONSTRAINT"]),
      content: z.string(),
      sourceType: z.enum(["SELF_REPORT", "PARTNER_STATEMENT_REPORTED", "OBSERVATION", "HYPOTHESIS"]),
      evidenceQuote: z.string(),
      strength: z.enum(["SOFT", "HARD"]),
      scope: z.enum(["NEXT_DATE", "ONGOING"]),
      careTarget: z.enum(["WALKING", "STANDING", "SWEETS", "EXHIBIT", "INDOOR", "REST", "OTHER"]).nullable(),
      careDirection: z.enum(["REDUCE", "INCREASE", "PREFER", "AVOID"]).nullable(),
    }),
  ),
});

export const agentActionLlmSchema = z.object({
  type: z.enum(["CALL_TOOLS", "PROPOSE_PLAN", "ASK_USER", "STOP"]),
  reason: z.string(),
  toolNames: z.array(z.string()),
  orderedSpotIds: z.array(z.string()),
  rejected: z.array(z.object({ spotId: z.string(), reason: z.string() })),
  assumptions: z.array(z.string()),
  questionPrompt: z.string().nullable(),
  questionOptions: z.array(z.string()),
  missingFields: z.array(z.string()),
  lastValidationSeen: z.string().nullable(),
});
export type AgentDecisionLlm = z.infer<typeof agentActionLlmSchema>;

export const agentActionCoerceSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = raw as Record<string, unknown>;
  const type = ["CALL_TOOLS", "PROPOSE_PLAN", "ASK_USER", "STOP"].includes(String(o.type))
    ? o.type
    : Array.isArray(o.orderedSpotIds) && (o.orderedSpotIds as unknown[]).length
      ? "PROPOSE_PLAN"
      : "CALL_TOOLS";
  return {
    type,
    reason: String(o.reason ?? o.rationale ?? ""),
    toolNames: asStringArray(o.toolNames ?? o.tools),
    orderedSpotIds: asStringArray(o.orderedSpotIds ?? o.selectedSpotIds),
    rejected: Array.isArray(o.rejected) ? o.rejected : [],
    assumptions: asStringArray(o.assumptions),
    questionPrompt: typeof o.questionPrompt === "string" ? o.questionPrompt : typeof o.question === "string" ? o.question : null,
    questionOptions: asStringArray(o.questionOptions ?? (typeof o.question === "object" && o.question && "options" in o.question ? (o.question as { options?: unknown }).options : [])),
    missingFields: asStringArray(o.missingFields),
    lastValidationSeen: typeof o.lastValidationSeen === "string" ? o.lastValidationSeen : null,
  };
}, agentActionLlmSchema);

function asStringArray(value: unknown): unknown {
  if (value == null) return [];
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v)));
  return [];
}

function asClarification(value: unknown): unknown {
  if (value == null || value === "" || value === false) return null;
  if (typeof value === "string") return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (typeof o.prompt !== "string" || !Array.isArray(o.options)) return null;
  const options = o.options.filter((x): x is string => typeof x === "string");
  if (options.length < 2) return null;
  return { prompt: o.prompt, options: options.slice(0, 6) };
}

function asCandidates(value: unknown): unknown {
  const list = value == null ? [] : Array.isArray(value) ? value : typeof value === "object" ? [value] : [];
  return list.map((item) => {
    if (!item || typeof item !== "object") return item;
    const o = item as Record<string, unknown>;
    const pick = (key: string, allowed: string[], fallback: string) =>
      allowed.includes(String(o[key])) ? o[key] : fallback;
      const content = String(o.content ?? o.text ?? o.summary ?? o.description ?? o.memory ?? "");
      const evidenceQuote = String(o.evidenceQuote ?? o.quote ?? o.evidence ?? content);
      return {
        ...o,
        subject: pick("subject", ["SELF", "PARTNER", "BOTH"], "PARTNER"),
        type: pick("type", ["CARE", "PREFERENCE", "CONSTRAINT"], "PREFERENCE"),
        content: content || evidenceQuote,
        sourceType: pick(
          "sourceType",
          ["SELF_REPORT", "PARTNER_STATEMENT_REPORTED", "OBSERVATION", "HYPOTHESIS"],
          "OBSERVATION",
        ),
        evidenceQuote: evidenceQuote || content,
        strength: pick("strength", ["SOFT", "HARD"], "SOFT"),
        scope: pick("scope", ["NEXT_DATE", "ONGOING"], "NEXT_DATE"),
      };
  });
}

export const reflectionLlmSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = raw as Record<string, unknown>;
  return {
    ...o,
    observations: asStringArray(o.observations),
    hypotheses: asStringArray(o.hypotheses),
    uncertainties: asStringArray(o.uncertainties),
    clarification: asClarification(o.clarification),
    memoryCandidates: asCandidates(o.memoryCandidates),
  };
}, z.object({
  observations: z.array(z.string()).default([]),
  hypotheses: z.array(z.string()).default([]),
  uncertainties: z.array(z.string()).default([]),
  clarification: z
    .object({
      prompt: z.string(),
      options: z.array(z.string()).min(2).max(6),
    })
    .nullable(),
  memoryCandidates: z
    .array(
      z.object({
        subject: z.enum(["SELF", "PARTNER", "BOTH"]),
        type: z.enum(["CARE", "PREFERENCE", "CONSTRAINT"]),
        content: z.string(),
        sourceType: z.enum(["SELF_REPORT", "PARTNER_STATEMENT_REPORTED", "OBSERVATION", "HYPOTHESIS"]),
        evidenceQuote: z.string(),
        strength: z.enum(["SOFT", "HARD"]),
        scope: z.enum(["NEXT_DATE", "ONGOING"]),
        careTarget: z.enum(["WALKING", "STANDING", "SWEETS", "EXHIBIT", "INDOOR", "REST", "OTHER"]).nullable().optional(),
        careDirection: z.enum(["REDUCE", "INCREASE", "PREFER", "AVOID"]).nullable().optional(),
      }),
    )
    .default([]),
}));
export type ReflectionLlm = z.infer<typeof reflectionLlmSchema>;

export function repairHintFor(schemaName: string): string {
  if (schemaName === "planProposal") {
    return '直前のJSONはスキーマ不一致。orderedSpotIds（候補idのみ）、rejected、assumptions、tradeoffs を含むJSONだけを返す。未知IDは使わない。';
  }
  if (schemaName === "reflection") {
    return '直前のJSONはスキーマ不一致。observations / hypotheses / uncertainties は文字列配列。HYPOTHESIS を OBSERVATION に書き換えない。memoryCandidates は観察または確認済みのみ。clarification は {prompt, options[2-6]} か null。';
  }
  if (schemaName === "agentDecision") {
    return '直前のJSONはスキーマ不一致。type は CALL_TOOLS | PROPOSE_PLAN | ASK_USER | STOP。toolNames, orderedSpotIds, rejected, assumptions, questionPrompt, questionOptions, missingFields, lastValidationSeen, reason を返す。';
  }
  return "直前のJSONはスキーマ不一致。指定スキーマのキーだけを返す。";
}
