import { getEnv } from "@/config/env";
import { DEADLINES_MS } from "@/config/settings";
import type { AppEvent, Run } from "@/domain/schemas";
import { runPlanningOrchestrator } from "./orchestrator";
import { runReflection } from "./reflection";
import { realNowIso } from "@/lib/time";
import { findRun, readStore, withRun } from "@/server/repositories/store";
import { canWriteRun } from "@/server/approvals/service";
import { WORKER_ID } from "./lease";
import { maskSecrets } from "@/server/security/logMask";

export async function executeRun(runId: string): Promise<void> {
  const env = getEnv();
  const loaded = await readStore((db) => findRun(db, runId), { runId });
  if (!loaded) return;
  if (
    loaded.run.leaseOwner &&
    !canWriteRun({
      leaseOwner: loaded.run.leaseOwner,
      leaseFencingToken: loaded.run.leaseFencingToken,
      workerId: WORKER_ID,
      fencingToken: loaded.run.leaseFencingToken,
    })
  ) {
    return;
  }
  const controller = new AbortController();
  const deadline = DEADLINES_MS[loaded.run.kind] ?? DEADLINES_MS.INITIAL_PLAN;
  const timer = setTimeout(() => controller.abort(), deadline);
  try {
    if (loaded.run.kind === "REFLECTION") {
      await runReflection(runId, controller.signal);
      return;
    }
    await runPlanningOrchestrator(runId, controller.signal);
  } catch (error) {
    const message = maskSecrets(error instanceof Error ? error.message : "unknown error");
    try {
      await withRun(runId, (db) => {
        const found = findRun(db, runId);
        if (!found) return;
        found.run.status = controller.signal.aborted ? "PARTIAL" : "FAILED";
        found.run.error = message;
        found.run.finishedAt = realNowIso();
        found.run.leaseOwner = null;
      });
    } catch {
      /* persist blocked; caller が CREDENTIALS / UNIMPLEMENTED を見る */
    }
  } finally {
    clearTimeout(timer);
    void env;
  }
}

void (0 as unknown as AppEvent);
void (0 as unknown as Run);
