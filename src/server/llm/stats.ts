import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { maskSecrets } from "@/server/security/logMask";

export type SchemaStats = {
  calls: number;
  schemaFail: number;
  retry: number;
  escalate: number;
  coerce: number;
  strictOk: number;
};

const PATH = join(process.cwd(), "docs/reports/llm-schema-stats.json");

const empty = (): SchemaStats => ({
  calls: 0,
  schemaFail: 0,
  retry: 0,
  escalate: 0,
  coerce: 0,
  strictOk: 0,
});

export function readSchemaStats(): SchemaStats {
  if (!existsSync(PATH)) return empty();
  try {
    return { ...empty(), ...(JSON.parse(readFileSync(PATH, "utf8")) as SchemaStats) };
  } catch {
    return empty();
  }
}

export function recordSchemaStats(patch: Partial<SchemaStats>) {
  const cur = readSchemaStats();
  const next = { ...cur };
  for (const [k, v] of Object.entries(patch) as [keyof SchemaStats, number | undefined][]) {
    if (typeof v === "number") next[k] = (next[k] ?? 0) + v;
  }
  mkdirSync(join(process.cwd(), "docs/reports"), { recursive: true });
  writeFileSync(PATH, maskSecrets(JSON.stringify(next, null, 2)));
  const rates = schemaRates(next);
  writeFileSync(
    join(process.cwd(), "docs/reports/llm-schema.md"),
    [
      "# LLM スキーマ強制の集計",
      "",
      `最終更新: ${new Date().toISOString()}`,
      "",
      `| 指標 | 値 |`,
      `|---|---|`,
      `| 呼び出し | ${rates.calls} |`,
      `| スキーマ失敗 | ${rates.schemaFail}（率 ${(rates.schemaFailRate * 100).toFixed(1)}%） |`,
      `| 同モデル再試行 | ${rates.retry}（率 ${(rates.retryRate * 100).toFixed(1)}%） |`,
      `| hard エスカレート | ${rates.escalate}（率 ${(rates.escalateRate * 100).toFixed(1)}%） |`,
      `| 寛容パース（最終手段） | ${rates.coerce}（率 ${(rates.coerceRate * 100).toFixed(1)}%） |`,
      `| strict 成功 | ${rates.strictOk} |`,
      "",
    ].join("\n"),
  );
}

export function schemaRates(s: SchemaStats = readSchemaStats()) {
  const n = Math.max(1, s.calls);
  return {
    ...s,
    schemaFailRate: s.schemaFail / n,
    retryRate: s.retry / n,
    escalateRate: s.escalate / n,
    coerceRate: s.coerce / n,
  };
}
