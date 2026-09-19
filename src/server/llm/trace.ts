import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { maskSecrets } from "@/server/security/logMask";

export type LlmTraceRow = {
  at: string;
  runId: string;
  task: string;
  pool: string;
  requestedModel: string;
  actualModel: string;
  reason: string;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  costJpy: number | null;
  latencyMs: number;
  ok: boolean;
  schemaMode: "json_schema_strict" | "json_object" | "mock" | "blocked";
  retried: boolean;
  escalated: boolean;
  coerced: boolean;
};

const PATH = join(process.cwd(), ".data", "llm-traces.json");

export function appendLlmTrace(row: LlmTraceRow) {
  mkdirSync(join(process.cwd(), ".data"), { recursive: true });
  const list = readLlmTraces();
  list.push(row);
  writeFileSync(PATH, maskSecrets(JSON.stringify(list)));
}

export function readLlmTraces(): LlmTraceRow[] {
  if (!existsSync(PATH)) return [];
  try {
    return JSON.parse(readFileSync(PATH, "utf8")) as LlmTraceRow[];
  } catch {
    return [];
  }
}

export function tracesForRun(runId: string): { rows: LlmTraceRow[]; costUsd: number; costJpy: number } {
  return tracesForRuns([runId]);
}

export function tracesForRuns(runIds: string[]): { rows: LlmTraceRow[]; costUsd: number; costJpy: number } {
  const allow = new Set(runIds);
  const rows = readLlmTraces().filter((r) => allow.has(r.runId));
  const costUsd = rows.reduce((n, r) => n + (r.costUsd ?? 0), 0);
  const costJpy = rows.reduce((n, r) => n + (r.costJpy ?? 0), 0);
  return { rows, costUsd, costJpy };
}
