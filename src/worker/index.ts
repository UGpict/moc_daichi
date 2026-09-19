import { WORKER, LIMITS } from "@/config/settings";
import { processOneJob } from "@/server/jobs/dispatch";
import { maybeRefreshDailyDigest } from "@/server/providers/dailyDigest";
import { maskSecrets } from "@/server/security/logMask";

let busy = false;

async function loop() {
  if (busy) return;
  busy = true;
  try {
    await processOneJob();
  } catch (error) {
    console.error("worker persist", maskSecrets(String(error)));
  } finally {
    busy = false;
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
