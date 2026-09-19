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

export const agentActionLlmSchema = z.object({
  type: z.enum(["CALL_TOOLS", "PROPOSE_PLAN", "ASK_USER", "FINISH", "STOP"]),
  reason: z.string(),
  toolNames: z.array(z.string()).optional(),
  question: z.string().optional(),
  missingFields: z.array(z.string()).optional(),
});

export const reflectionLlmSchema = z.object({
  observations: z.array(z.string()).default([]),
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
});
export type ReflectionLlm = z.infer<typeof reflectionLlmSchema>;

export function repairHintFor(schemaName: string): string {
  if (schemaName === "planProposal") {
    return '直前のJSONはスキーマ不一致。orderedSpotIds（候補idのみ）、rejected、assumptions、tradeoffs を含むJSONだけを返す。未知IDは使わない。';
  }
  if (schemaName === "reflection") {
    return '直前のJSONはスキーマ不一致。observations, uncertainties, clarification, memoryCandidates だけのJSONを返す。行程の selectedSpotIds は不要。質問が不要なら clarification は null。';
  }
  return "直前のJSONはスキーマ不一致。指定スキーマのキーだけを返す。";
}
