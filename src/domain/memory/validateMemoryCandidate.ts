import { createHash } from "node:crypto";
import type { MemoryCandidate } from "@/domain/schemas";

export function candidateContentHash(candidate: Pick<MemoryCandidate, "content" | "evidenceQuote" | "subject">): string {
  return createHash("sha256")
    .update(`${candidate.subject}\n${candidate.content}\n${candidate.evidenceQuote}`)
    .digest("hex")
    .slice(0, 24);
}

export function validateMemoryCandidate(candidate: MemoryCandidate): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (candidate.sourceType === "HYPOTHESIS") {
    reasons.push("仮説は記憶にできません");
  }
  if (!candidate.evidenceQuote.trim()) {
    reasons.push("引用根拠が空です");
  }
  if (candidate.content.length < 2) {
    reasons.push("本文が短すぎます");
  }
  if (/性格|精神病|診断|知能/.test(candidate.content) && candidate.type === "CARE") {
    reasons.push("確認されていない健康・性格・心理状態は保存しません");
  }
  return { ok: reasons.length === 0, reasons };
}
