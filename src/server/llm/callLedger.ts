import type { LlmAttempt } from "@/domain/schemas";

export function mergeAttemptCosts(attempts: LlmAttempt[]): {
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  costJpy: number | null;
} {
  let prompt = 0;
  let completion = 0;
  let usd = 0;
  let anyToken = false;
  let anyUsd = false;
  for (const a of attempts) {
    if (a.promptTokens != null) {
      prompt += a.promptTokens;
      anyToken = true;
    }
    if (a.completionTokens != null) {
      completion += a.completionTokens;
      anyToken = true;
    }
    if (a.costUsd != null) {
      usd += a.costUsd;
      anyUsd = true;
    }
  }
  return {
    promptTokens: anyToken ? prompt : null,
    completionTokens: anyToken ? completion : null,
    costUsd: anyUsd ? usd : null,
    costJpy: anyUsd ? usd * 148.5 : null,
  };
}
