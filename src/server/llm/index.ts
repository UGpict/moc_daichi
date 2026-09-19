import { getEnv, assertLiveProvider } from "@/config/env";
import { FX, LLM_PRICE_TABLE, MODEL_PARAMS } from "@/config/settings";
import { z, type ZodType } from "zod";
import { toOpenAiJsonSchema } from "./jsonSchema";
import { decideRoute } from "./router";
import { recordSchemaStats } from "./stats";
import { appendLlmTrace } from "./trace";
import { maskSecrets } from "@/server/security/logMask";

export type Pool = "mundane" | "hard";
export type LlmTask =
  | "structure"
  | "candidates"
  | "reflect"
  | "share"
  | "final_plan"
  | "replan"
  | "conflict"
  | "agent_action";

export const TASK_POOL: Record<LlmTask, Pool> = {
  structure: "mundane",
  candidates: "mundane",
  reflect: "mundane",
  share: "mundane",
  final_plan: "hard",
  replan: "hard",
  conflict: "hard",
  agent_action: "mundane",
};

export type SchemaMode = "json_schema_strict" | "json_object" | "mock" | "blocked";

export type LlmCallResult<T> = {
  data: T | null;
  ok: boolean;
  requestedModel: string;
  actualModel: string;
  pool: Pool;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  costJpy: number | null;
  latencyMs: number;
  repaired: boolean;
  coerced: boolean;
  escalated: boolean;
  schemaMode: SchemaMode;
  routeReason: string;
  error: string | null;
  attempts: LlmCallResult<T>[];
  requestId: string | null;
};

function usdToJpy(usd: number | null): number | null {
  if (usd == null) return null;
  return usd * FX.usdJpy;
}

function emptyResult<T>(partial: Partial<LlmCallResult<T>> & Pick<LlmCallResult<T>, "requestedModel" | "pool">): LlmCallResult<T> {
  return {
    data: null,
    ok: false,
    actualModel: "unknown",
    promptTokens: null,
    completionTokens: null,
    costUsd: null,
    costJpy: null,
    latencyMs: 0,
    repaired: false,
    coerced: false,
    escalated: false,
    schemaMode: "blocked",
    routeReason: "",
    error: null,
    attempts: [],
    requestId: null,
    ...partial,
  };
}

export async function callLLM<T>(input: {
  task: LlmTask;
  messages: { role: "system" | "user"; content: string }[];
  schema: ZodType<T>;
  runId: string;
  signal?: AbortSignal;
  mockValue: T;
  schemaName?: string;
  repairHint?: string;
  strictSchema?: ZodType<unknown>;
  coerceSchema?: ZodType<T>;
}): Promise<LlmCallResult<T>> {
  const started = Date.now();
  const env = getEnv();
  const inputChars = input.messages.reduce((n, m) => n + m.content.length, 0);
  let route = decideRoute({ task: input.task, inputChars, previousSchemaFail: false });
  recordSchemaStats({ calls: 1 });

  if (env.profile === "LIVE") {
    try {
      assertLiveProvider("llm");
    } catch (e) {
      const blocked = emptyResult<T>({
        requestedModel: route.model,
        pool: route.pool,
        routeReason: route.reason,
        schemaMode: "blocked",
        error: e instanceof Error ? e.message : "BLOCKED llm",
        latencyMs: Date.now() - started,
      });
      trace(input, blocked);
      return blocked;
    }
  }

  if (env.profile === "DEV" || !env.orcaApiKey) {
    if (env.profile === "LIVE") {
      const blocked = emptyResult<T>({
        requestedModel: route.model,
        pool: route.pool,
        routeReason: route.reason,
        error: "BLOCKED: ORCAROUTER_API_KEY missing",
        latencyMs: Date.now() - started,
      });
      trace(input, blocked);
      return blocked;
    }
    const parsed = input.schema.safeParse(input.mockValue);
    const mock = emptyResult<T>({
      data: parsed.success ? parsed.data : null,
      ok: parsed.success,
      requestedModel: route.model,
      actualModel: "mock/planner-v0.8",
      pool: route.pool,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      costJpy: 0,
      latencyMs: Date.now() - started,
      schemaMode: "mock",
      routeReason: route.reason,
      error: parsed.success ? null : "mock schema mismatch",
    });
    mock.attempts = [mock];
    trace(input, mock);
    return mock;
  }

  const attempts: LlmCallResult<T>[] = [];
  const chat = async (args: {
    model: string;
    pool: Pool;
    mode: "json_schema_strict" | "json_object";
    messages: { role: "system" | "user"; content: string }[];
    repaired: boolean;
    escalated: boolean;
  }): Promise<LlmCallResult<T> & { raw: unknown }> => {
    const responseFormat =
      args.mode === "json_schema_strict"
        ? toOpenAiJsonSchema(input.schemaName ?? input.task, input.strictSchema ?? input.schema)
        : { type: "json_object" as const };
    const res = await fetch(`${env.orcaBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.orcaApiKey}`,
        "Content-Type": "application/json",
        "X-OrcaRouter-Include-Cost": "true",
      },
      body: JSON.stringify({
        model: args.model,
        messages: args.messages,
        temperature: MODEL_PARAMS.temperature,
        max_tokens: MODEL_PARAMS.maxTokens,
        response_format: responseFormat,
      }),
      signal: input.signal ?? AbortSignal.timeout(25000),
    });
    const latencyMs = Date.now() - started;
    const requestId = res.headers.get("X-Orca-Request-Id") ?? res.headers.get("x-orca-request-id");
    const headerModel =
      res.headers.get("X-Orca-Resolved-Model") ??
      res.headers.get("x-orca-resolved-model") ??
      "unknown";
    if (!res.ok) {
      const errText = maskSecrets((await res.text().catch(() => "")).slice(0, 200));
      return {
        ...emptyResult<T>({
          requestedModel: args.model,
          pool: args.pool,
          actualModel: headerModel,
          latencyMs,
          repaired: args.repaired,
          escalated: args.escalated,
          schemaMode: args.mode,
          routeReason: route.reason,
          error: `orcarouter ${res.status} ${errText}`.trim(),
          requestId,
        }),
        raw: null,
      };
    }
    const json = (await res.json()) as {
      model?: string;
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost_usd?: number };
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = null;
    }
    const checked = input.schema.safeParse(parsed);
    const issue = checked.success
      ? null
      : checked.error.issues
          .slice(0, 6)
          .map((i) => `${i.path.join(".") || "root"}:${i.code}`)
          .join(",");
    return {
      data: checked.success ? checked.data : null,
      ok: checked.success,
      requestedModel: args.model,
      actualModel: json.model ?? headerModel,
      pool: args.pool,
      promptTokens: json.usage?.prompt_tokens ?? null,
      completionTokens: json.usage?.completion_tokens ?? null,
      costUsd: json.usage?.cost_usd ?? null,
      costJpy: usdToJpy(json.usage?.cost_usd ?? null),
      latencyMs,
      repaired: args.repaired,
      coerced: false,
      escalated: args.escalated,
      schemaMode: args.mode,
      routeReason: route.reason,
      error: checked.success ? null : `schema validation failed${issue ? ` (${issue})` : ""} ${content.slice(0, 120).replace(/\s+/g, " ")}`.trim(),
      attempts: [],
      requestId,
      raw: parsed,
    };
  };

  const finish = (row: LlmCallResult<T>, extra?: Partial<SchemaStatsPatch>) => {
    const list = attempts.length ? attempts : [row];
    const usd = list.reduce((n, a) => n + (a.costUsd ?? 0), 0);
    const anyUsd = list.some((a) => a.costUsd != null);
    const merged: LlmCallResult<T> = {
      ...row,
      attempts: list,
      costUsd: anyUsd ? usd : row.costUsd,
      costJpy: anyUsd ? usdToJpy(usd) : row.costJpy,
    };
    if (extra) recordSchemaStats(extra);
    if (merged.ok && merged.schemaMode === "json_schema_strict") recordSchemaStats({ strictOk: 1 });
    for (const attempt of list) trace(input, attempt);
    return merged;
  };

  let mode: "json_schema_strict" | "json_object" = "json_schema_strict";
  let first = await chat({
    model: route.model,
    pool: route.pool,
    mode,
    messages: input.messages,
    repaired: false,
    escalated: false,
  });
  attempts.push(first);
  if (!first.ok && first.error?.startsWith("orcarouter 400") && mode === "json_schema_strict") {
    mode = "json_object";
    first = await chat({
      model: route.model,
      pool: route.pool,
      mode,
      messages: input.messages,
      repaired: false,
      escalated: false,
    });
    attempts.push(first);
  }
  if (first.ok) return finish(first);

  if (first.error?.startsWith("schema validation failed")) {
    recordSchemaStats({ schemaFail: 1, retry: 1 });
    const hint =
      input.repairHint ??
      "直前のJSONはスキーマ不一致。指定タスクのスキーマのキーだけを返す。";
    const retried = await chat({
      model: route.model,
      pool: route.pool,
      mode: "json_object",
      messages: [...input.messages, { role: "user", content: hint }],
      repaired: true,
      escalated: false,
    });
    attempts.push(retried);
    if (retried.ok) return finish(retried);

    if (route.pool !== "hard") {
      recordSchemaStats({ escalate: 1 });
      route = decideRoute({ task: input.task, inputChars, previousSchemaFail: true });
      const escalated = await chat({
        model: route.model,
        pool: "hard",
        mode: "json_object",
        messages: [...input.messages, { role: "user", content: hint }],
        repaired: true,
        escalated: true,
      });
      attempts.push(escalated);
      if (escalated.ok) return finish(escalated, {});
      first = escalated;
    } else {
      first = retried;
    }
  }

  const coerceWith = input.coerceSchema ?? input.schema;
  const lastRaw = (attempts.at(-1) as { raw?: unknown } | undefined)?.raw;
  const coerced = coerceWith.safeParse(lastRaw);
  if (coerced.success) {
    recordSchemaStats({ coerce: 1 });
    const row = {
      ...first,
      data: coerced.data,
      ok: true,
      coerced: true,
      error: null,
    };
    return finish(row);
  }

  return finish(first);
}

type SchemaStatsPatch = { schemaFail?: number; retry?: number; escalate?: number; coerce?: number; strictOk?: number };

function trace<T>(
  input: { task: LlmTask; runId: string },
  row: LlmCallResult<T>,
) {
  appendLlmTrace({
    at: new Date().toISOString(),
    runId: input.runId,
    task: input.task,
    pool: row.pool,
    requestedModel: row.requestedModel,
    actualModel: row.actualModel,
    reason: row.routeReason,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    costUsd: row.costUsd,
    costJpy: row.costJpy,
    latencyMs: row.latencyMs,
    ok: row.ok,
    schemaMode: row.schemaMode,
    retried: row.repaired,
    escalated: row.escalated,
    coerced: row.coerced,
  });
}

export function estimateFromTable(
  model: string,
  promptTokens: number | null,
  completionTokens: number | null,
): number | null {
  const row = LLM_PRICE_TABLE.usdPer1M[model as keyof typeof LLM_PRICE_TABLE.usdPer1M];
  if (!row || promptTokens == null || completionTokens == null) return null;
  const usd = (promptTokens * row.input + completionTokens * row.output) / 1_000_000;
  return usdToJpy(usd);
}

const rejectedItemSchema = z
  .object({
    spotId: z.string(),
    reason: z.string(),
  })
  .or(
    z
      .object({ id: z.string(), reason: z.string().optional() })
      .transform((v) => ({ spotId: v.id, reason: v.reason ?? "rejected" })),
  );

export const llmActionSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  const selected = o.orderedSpotIds ?? o.selectedSpotIds ?? o.selected ?? o.spotIds ?? o.ids;
  return {
    think: typeof o.think === "string" ? o.think.slice(0, 400) : undefined,
    selectedSpotIds: Array.isArray(selected)
      ? selected.map((id) =>
          typeof id === "string" ? id : String((id as { id?: string }).id ?? id),
        )
      : [],
    rejected: o.rejected ?? [],
    assumptions: o.assumptions ?? o.assumption ?? [],
  };
}, z.object({
  think: z.string().max(400).optional(),
  selectedSpotIds: z.array(z.string()),
  rejected: z.array(rejectedItemSchema).default([]),
  assumptions: z.array(z.string()).default([]),
}));
export type LlmAction = z.infer<typeof llmActionSchema>;
