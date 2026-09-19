export type HttpDecision = {
  action: "RETRY" | "FALLBACK" | "HUMAN";
  status: number | null;
  reason: string;
};

export function classifyHttpError(err: unknown): HttpDecision {
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  if (name === "TimeoutError" || /timeout|aborted/i.test(msg)) {
    return { action: "RETRY", status: null, reason: "timeout: 1 回だけ再試行し、だめなら人間へ返す" };
  }
  const m = msg.match(/\b(400|401|403|404|408|429|500|502|503)\b/);
  const status = m ? Number(m[1]) : null;
  if (status === 429 || status === 503 || status === 502 || status === 408) {
    return { action: "RETRY", status, reason: `${status}: 1 回だけ再試行する` };
  }
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return { action: "HUMAN", status, reason: `${status}: 推測で埋めず人間へ返す` };
  }
  return { action: "HUMAN", status, reason: msg.slice(0, 160) };
}

function throwChaos(code: string): never {
  if (code === "timeout") {
    const e = new Error("TimeoutError: chaos");
    e.name = "TimeoutError";
    throw e;
  }
  throw new Error(`places searchNearby ${code}`);
}

function maybeChaos() {
  const once = process.env.CHAOS_HTTP_ONCE;
  if (once) {
    delete process.env.CHAOS_HTTP_ONCE;
    throwChaos(once);
  }
  const sticky = process.env.CHAOS_HTTP_STATUS;
  if (sticky) throwChaos(sticky);
}

export async function withHttpRetry<T>(
  fn: () => Promise<T>,
  onDecision?: (decision: HttpDecision, attempt: number) => void,
): Promise<T> {
  const run = async () => {
    maybeChaos();
    return fn();
  };
  try {
    return await run();
  } catch (error) {
    const decision = classifyHttpError(error);
    onDecision?.(decision, 1);
    if (decision.action !== "RETRY") throw error;
    try {
      return await run();
    } catch (retryError) {
      const second = classifyHttpError(retryError);
      onDecision?.({ ...second, action: "HUMAN", reason: `再試行失敗: ${second.reason}` }, 2);
      throw retryError;
    }
  }
}
