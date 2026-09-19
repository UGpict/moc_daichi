import { getEnv, assertLiveProvider } from "@/config/env";
import { FX, LLM_PRICE_TABLE, MODEL_PARAMS } from "@/config/settings";
import { z, type ZodType } from "zod";

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
  error: string | null;
  attempts: LlmCallResult<T>[];
  requestId: string | null;
};

function modelFor(pool: Pool): string {
  const env = getEnv();
  return pool === "hard" ? env.orcaHardModel : env.orcaMundaneModel;
}

function usdToJpy(usd: number | null): number | null {
  if (usd == null) return null;
  return usd * FX.usdJpy;
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
}): Promise<LlmCallResult<T>> {
  const pool = TASK_POOL[input.task];
  const requestedModel = modelFor(pool);
  const started = Date.now();
  const env = getEnv();
  const attempts: LlmCallResult<T>[] = [];

  if (env.profile === "LIVE") {
    try {
      assertLiveProvider("llm");
    } catch (e) {
      return {
        data: null,
        ok: false,
        requestedModel,
        actualModel: "unknown",
        pool,
        promptTokens: null,
        completionTokens: null,
        costUsd: null,
        costJpy: null,
        latencyMs: Date.now() - started,
        repaired: false,
        error: e instanceof Error ? e.message : "BLOCKED llm",
        attempts,
        requestId: null,
      };
    }
  }

  if (env.profile === "DEV" || !env.orcaApiKey) {
    if (env.profile === "LIVE") {
      return {
        data: null,
        ok: false,
        requestedModel,
        actualModel: "unknown",
        pool,
        promptTokens: null,
        completionTokens: null,
        costUsd: null,
        costJpy: null,
        latencyMs: Date.now() - started,
        repaired: false,
        error: "BLOCKED: ORCAROUTER_API_KEY missing",
        attempts,
        requestId: null,
      };
    }
    const parsed = input.schema.safeParse(input.mockValue);
    const mock: LlmCallResult<T> = {
      data: parsed.success ? parsed.data : null,
      ok: parsed.success,
      requestedModel,
      actualModel: "mock/planner-v0.7",
      pool,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      costJpy: 0,
      latencyMs: Date.now() - started,
      repaired: false,
      error: parsed.success ? null : "mock schema mismatch",
      attempts: [],
      requestId: null,
    };
    mock.attempts = [mock];
    return mock;
  }

  const body = {
    model: requestedModel,
    messages: input.messages,
    temperature: MODEL_PARAMS.temperature,
    max_tokens: MODEL_PARAMS.maxTokens,
    response_format: {
      type: "json_object" as const,
    },
  };

  const attempt = async (): Promise<LlmCallResult<T>> => {
    const res = await fetch(`${env.orcaBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.orcaApiKey}`,
        "Content-Type": "application/json",
        "X-OrcaRouter-Include-Cost": "true",
      },
      body: JSON.stringify({ ...body, messages: input.messages }),
      signal: input.signal ?? AbortSignal.timeout(25000),
    });
    const latencyMs = Date.now() - started;
    const requestId = res.headers.get("X-Orca-Request-Id") ?? res.headers.get("x-orca-request-id");
    const actualModel =
      res.headers.get("X-Orca-Resolved-Model") ??
      res.headers.get("x-orca-resolved-model") ??
      res.headers.get("X-Orca-Fallback-Model") ??
      "unknown";
    const base = {
      requestedModel,
      actualModel,
      pool,
      repaired: false,
      attempts: [] as LlmCallResult<T>[],
      requestId,
    };
    if (!res.ok) {
      return {
        ...base,
        data: null,
        ok: false,
        promptTokens: null,
        completionTokens: null,
        costUsd: null,
        costJpy: null,
        latencyMs,
        error: `orcarouter ${res.status}`,
      };
    }
    const json = (await res.json()) as {
      model?: string;
      choices?: { message?: { content?: string } }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        cost_usd?: number;
      };
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
      ...base,
      data: checked.success ? checked.data : null,
      ok: checked.success,
      actualModel: json.model ?? actualModel,
      promptTokens: json.usage?.prompt_tokens ?? null,
      completionTokens: json.usage?.completion_tokens ?? null,
      costUsd: json.usage?.cost_usd ?? null,
      costJpy: usdToJpy(json.usage?.cost_usd ?? null),
      latencyMs,
      error: checked.success ? null : `schema validation failed${issue ? ` (${issue})` : ""}`,
    };
  };

  const first = await attempt();
  attempts.push(first);
  if (!first.ok && first.error?.startsWith("schema validation failed")) {
    const hint =
      input.repairHint ??
      "直前のJSONはスキーマ不一致。指定タスクのスキーマのキーだけを返す。selectedSpotIds 固定の行程スキーマを要求しない。";
    input.messages = [...input.messages, { role: "user", content: hint }];
    const repaired = await attempt();
    repaired.repaired = true;
    attempts.push(repaired);
    const usd = attempts.reduce((n, a) => n + (a.costUsd ?? 0), 0);
    const anyUsd = attempts.some((a) => a.costUsd != null);
    repaired.attempts = attempts;
    repaired.costUsd = anyUsd ? usd : repaired.costUsd;
    repaired.costJpy = anyUsd ? usdToJpy(usd) : repaired.costJpy;
    repaired.promptTokens = attempts.reduce((n, a) => n + (a.promptTokens ?? 0), repaired.promptTokens ?? 0);
    repaired.completionTokens = attempts.reduce((n, a) => n + (a.completionTokens ?? 0), repaired.completionTokens ?? 0);
    return repaired;
  }
  first.attempts = attempts;
  return first;
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
