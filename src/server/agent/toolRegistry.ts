import { z } from "zod";

export const allowedToolCallSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("search_spots"),
    args: z.object({
      category: z.enum(["散歩", "展示", "甘いもの", "カフェ", "屋内"]),
      radiusMeters: z.number().int().min(200).max(8000).optional(),
    }),
  }),
  z.object({
    name: z.literal("get_spot_details"),
    args: z.object({ spotId: z.string().min(1).max(200) }),
  }),
  z.object({
    name: z.literal("check_opening"),
    args: z.object({
      spotId: z.string().min(1),
      startAt: z.string(),
      endAt: z.string(),
    }),
  }),
  z.object({
    name: z.literal("get_weather"),
    args: z.object({
      lat: z.number(),
      lng: z.number(),
      at: z.string(),
    }),
  }),
  z.object({
    name: z.literal("estimate_travel"),
    args: z.object({
      fromSpotId: z.string().nullable(),
      toSpotId: z.string().nullable(),
      mode: z.enum(["WALK", "TRANSIT", "DRIVE"]),
      departureAt: z.string(),
    }),
  }),
  z.object({
    name: z.literal("read_memories"),
    args: z.object({}),
  }),
  z.object({
    name: z.literal("validate_plan"),
    args: z.object({ orderedSpotIds: z.array(z.string()).max(6) }),
  }),
  z.object({
    name: z.literal("compute_diff"),
    args: z.object({ fromVersion: z.number(), toVersion: z.number() }),
  }),
  z.object({
    name: z.literal("propose_candidates"),
    args: z.object({ query: z.string().max(80), indoorOnly: z.boolean().optional() }),
  }),
  z.object({
    name: z.literal("ask_clarification"),
    args: z.object({
      prompt: z.string().max(400),
      options: z.array(z.string()).min(2).max(6),
    }),
  }),
]);
export type AllowedToolCall = z.infer<typeof allowedToolCallSchema>;

export const agentActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("CALL_TOOLS"),
    calls: z.array(allowedToolCallSchema).min(1).max(4),
    reason: z.string(),
  }),
  z.object({
    type: z.literal("PROPOSE_PLAN"),
    orderedSpotIds: z.array(z.string()).min(1).max(6),
    rejected: z.array(z.object({ spotId: z.string(), reason: z.string() })).default([]),
    assumptions: z.array(z.string()).default([]),
    reason: z.string(),
  }),
  z.object({
    type: z.literal("ASK_USER"),
    question: z.object({
      prompt: z.string(),
      options: z.array(z.string()).min(2).max(6),
    }),
    reason: z.string(),
  }),
  z.object({
    type: z.literal("PROPOSE_MEMORY"),
    candidates: z.array(z.object({ content: z.string(), evidenceQuote: z.string() })),
    reason: z.string(),
  }),
  z.object({
    type: z.literal("FINISH"),
    resultRef: z.string(),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal("STOP"),
    reason: z.string(),
    missingFields: z.array(z.string()),
  }),
]);
export type AgentAction = z.infer<typeof agentActionSchema>;

export const ALLOWED_TOOL_NAMES = allowedToolCallSchema.options.map((o) => o.shape.name.value);
