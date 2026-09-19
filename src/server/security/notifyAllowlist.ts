import { getEnv } from "@/config/env";

const DEFAULT_TARGETS = ["in-app"];

export function notifyAllowlist(): string[] {
  const extra = (process.env.NOTIFY_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_TARGETS, ...extra])];
}

/** LLM 出力の宛先は使わない。許可リスト外なら送らない。 */
export function resolveNotifyTarget(requested: string | null | undefined): string | null {
  void getEnv;
  const allow = notifyAllowlist();
  if (!requested) return allow.includes("in-app") ? "in-app" : allow[0] ?? null;
  const normalized = requested.trim().toLowerCase();
  return allow.map((a) => a.toLowerCase()).includes(normalized) ? requested.trim() : null;
}
