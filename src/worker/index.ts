import { WORKER, LIMITS } from "@/config/settings";
import { claimPendingRun, heartbeat } from "@/server/agent/lease";
import { executeRun } from "@/server/agent/execute";
import { maybeRefreshDailyDigest } from "@/server/providers/dailyDigest";
import { maskSecrets } from "@/server/security/logMask";

const inflight = new Set<string>();

async function loop() {
  try {
    const concurrency = 1;
    if (inflight.size >= concurrency) return;
    const runId = await claimPendingRun();
    if (!runId) return;
    inflight.add(runId);
    const beat = setInterval(() => {
      void heartbeat(runId);
    }, WORKER.heartbeatMs);
    try {
      await executeRun(runId);
    } catch (error) {
      console.error("worker run failed", runId, maskSecrets(String(error)));
    } finally {
      clearInterval(beat);
      inflight.delete(runId);
    }
  } catch (error) {
    console.error("worker persist", maskSecrets(String(error)));
  }
}

export function startWorker() {
  void maybeRefreshDailyDigest().catch((e) => console.error("daily digest", e));
  void loop();
  setInterval(() => {
    void loop();
  }, WORKER.pollMs);
  setInterval(() => {
    void maybeRefreshDailyDigest().catch((e) => console.error("daily digest", e));
  }, 60_000);
}

if (process.argv[1]?.includes("worker")) {
  console.log(`ふたりログ worker pid=${process.pid} concurrency=${LIMITS.maxConcurrentExternal}`);
  startWorker();
}
