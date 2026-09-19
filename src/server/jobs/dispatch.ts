import { getEnv } from "@/config/env";
import { WORKER } from "@/config/settings";
import { claimPendingRun, claimSpecificRun, heartbeat } from "@/server/agent/lease";
import { executeRun } from "@/server/agent/execute";
import { maskSecrets } from "@/server/security/logMask";

export type JobDispatchMode = "poller" | "http" | "inline";

export function jobDispatchMode(): JobDispatchMode {
  const env = getEnv();
  const raw = env.workerMode;
  if (raw === "http" || raw === "inline" || raw === "poller") return raw;
  return env.cloudRunService ? "http" : "poller";
}

export function workerJobsUrl(): string | null {
  const env = getEnv();
  if (env.workerInvokeUrl) {
    const base = env.workerInvokeUrl.replace(/\/$/, "");
    return base.endsWith("/api/internal/jobs") ? base : `${base}/api/internal/jobs`;
  }
  if (env.cloudRunService) return null;
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}/api/internal/jobs`;
}

export type EnqueueResult = {
  mode: JobDispatchMode;
  accepted: boolean;
  detail: string;
};

const retryScheduled = new Set<string>();

/** HTTP 起動の取りこぼし用。poller では何もしない。実行中の最初からやり直しはしない。 */
export function scheduleEnqueueRetry(runId: string) {
  if (jobDispatchMode() === "poller") return;
  if (retryScheduled.has(runId)) return;
  retryScheduled.add(runId);
  const delays = [1_500, 6_000, 15_000];
  for (const ms of delays) {
    setTimeout(() => {
      void enqueueRun(runId).catch((error) => {
        console.error("job retry", maskSecrets(String(error)));
      });
    }, ms);
  }
}

export async function enqueueRun(
  runId: string,
  deps: { fetchFn?: typeof fetch } = {},
): Promise<EnqueueResult> {
  const mode = jobDispatchMode();
  if (mode === "poller") {
    return { mode, accepted: true, detail: "poller が PENDING を取る" };
  }
  if (mode === "inline") {
    void processOneJob(runId).catch((error) => {
      console.error("inline job", maskSecrets(String(error)));
    });
    return { mode, accepted: true, detail: "同一プロセスで実行" };
  }
  const viaTasks = await enqueueCloudTask(runId, deps).catch((error) => {
    console.error("cloud tasks", maskSecrets(String(error)));
    return false;
  });
  if (viaTasks) {
    return { mode, accepted: true, detail: "Cloud Tasks に投入" };
  }
  const url = workerJobsUrl();
  if (!url) {
    return { mode, accepted: false, detail: "WORKER_INVOKE_URL が無い。常駐 poller には落とさない" };
  }
  const env = getEnv();
  const fetchFn = deps.fetchFn ?? fetch;
  try {
    void fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.workerSharedSecret ? { Authorization: `Bearer ${env.workerSharedSecret}` } : {}),
      },
      body: JSON.stringify({ runId }),
    }).catch((error) => {
      console.error("job http", maskSecrets(String(error)));
    });
    return { mode, accepted: true, detail: `HTTP ${url}` };
  } catch (error) {
    return { mode, accepted: false, detail: maskSecrets(error instanceof Error ? error.message : "enqueue") };
  }
}

async function enqueueCloudTask(runId: string, deps: { fetchFn?: typeof fetch }): Promise<boolean> {
  const env = getEnv();
  const queue = env.cloudTasksQueue;
  const url = workerJobsUrl();
  if (!queue || !url) return false;
  const fetchFn = deps.fetchFn ?? fetch;
  const accessToken = await metadataAccessToken();
  if (!accessToken) return false;
  const body = Buffer.from(JSON.stringify({ runId })).toString("base64");
  const res = await fetchFn(`https://cloudtasks.googleapis.com/v2/${queue}/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      task: {
        httpRequest: {
          httpMethod: "POST",
          url,
          headers: {
            "Content-Type": "application/json",
            ...(env.workerSharedSecret ? { Authorization: `Bearer ${env.workerSharedSecret}` } : {}),
          },
          body,
        },
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok;
}

export async function processOneJob(runId?: string): Promise<{
  runId: string | null;
  claimed: boolean;
  empty: boolean;
}> {
  const id = runId ? await claimSpecificRun(runId) : await claimPendingRun();
  if (!id) return { runId: runId ?? null, claimed: false, empty: true };
  const beat = setInterval(() => {
    void heartbeat(id);
  }, WORKER.heartbeatMs);
  try {
    await executeRun(id);
    return { runId: id, claimed: true, empty: false };
  } finally {
    clearInterval(beat);
  }
}

async function metadataAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(2000) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch {
    return null;
  }
}
