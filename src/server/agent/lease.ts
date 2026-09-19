import { LIMITS, WORKER } from "@/config/settings";
import type { AppEvent, Run } from "@/domain/schemas";
import { realNowIso } from "@/lib/time";
import { findRun, withStore, withStoreTx } from "@/server/repositories/store";
import { newId } from "@/lib/ids";

export function workerInstanceId(): string {
  const rev = process.env.K_REVISION || process.env.HOSTNAME || "local";
  return `worker_${rev}_${process.pid}`;
}

export const WORKER_ID = workerInstanceId();

function takeLease(run: Run, now: number): boolean {
  const attempts = (run.dispatchAttempts ?? 0) + 1;
  run.dispatchAttempts = attempts;
  if (attempts > WORKER.maxDispatchAttempts) {
    run.status = "FAILED";
    run.error = "dispatch attempts exceeded";
    run.finishedAt = realNowIso();
    run.leaseOwner = null;
    return false;
  }
  run.status = "RUNNING";
  run.startedAt = run.startedAt ?? realNowIso();
  run.leaseOwner = WORKER_ID;
  run.heartbeatAt = realNowIso();
  run.leaseExpiresAt = new Date(now + WORKER.leaseMs).toISOString();
  run.leaseFencingToken = (run.leaseFencingToken ?? 0) + 1;
  return true;
}

export async function claimPendingRun(): Promise<string | null> {
  return withStoreTx((db) => {
    const now = Date.now();
    for (const couple of Object.values(db.couples)) {
      for (const bundle of Object.values(couple.sessions)) {
        for (const run of Object.values(bundle.runs)) {
          if (run.status === "RUNNING" && run.leaseExpiresAt) {
            if (new Date(run.leaseExpiresAt).getTime() < now) {
              run.status = "INTERRUPTED";
              run.leaseOwner = null;
              run.error = "lease expired; not restarted from scratch";
              run.finishedAt = realNowIso();
              const seq = Object.keys(bundle.events).length;
              const event: AppEvent = {
                eventId: newId("evt"),
                runId: run.id,
                seq,
                at: realNowIso(),
                type: "RUN_FINISHED",
                summary: "lease切れのため INTERRUPTED。既存イベントとプランは保持",
                evidenceIds: [],
                model: null,
                pool: null,
                requestedModel: null,
                actualModel: null,
                usage: null,
                payload: { status: "INTERRUPTED" },
              };
              bundle.events[event.eventId] = event;
            }
          }
        }
      }
    }

    const pending: Run[] = [];
    for (const couple of Object.values(db.couples)) {
      for (const bundle of Object.values(couple.sessions)) {
        pending.push(
          ...Object.values(bundle.runs).filter((r) => r.status === "PENDING"),
        );
      }
    }
    pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const run = pending[0];
    if (!run) return null;
    const found = findRun(db, run.id);
    if (!found) return null;
    if (found.run.leaseOwner && found.run.leaseExpiresAt && new Date(found.run.leaseExpiresAt).getTime() > now) {
      return null;
    }
    if (!takeLease(found.run, now)) return null;
    return found.run.id;
  }, { pendingRun: true });
}

export async function claimSpecificRun(runId: string): Promise<string | null> {
  return withStoreTx((db) => {
    const now = Date.now();
    const found = findRun(db, runId);
    if (!found) return null;
    if (found.run.status !== "PENDING") return null;
    if (found.run.leaseOwner && found.run.leaseExpiresAt && new Date(found.run.leaseExpiresAt).getTime() > now) {
      return null;
    }
    if (!takeLease(found.run, now)) return null;
    return found.run.id;
  }, { runId });
}

export async function heartbeat(runId: string, fencingToken?: number): Promise<boolean> {
  return withStore((db) => {
    const found = findRun(db, runId);
    if (!found) return false;
    if (found.run.leaseOwner !== WORKER_ID) return false;
    if (fencingToken != null && found.run.leaseFencingToken !== fencingToken) return false;
    found.run.heartbeatAt = realNowIso();
    found.run.leaseExpiresAt = new Date(Date.now() + WORKER.leaseMs).toISOString();
    return true;
  }, { runId });
}

void LIMITS;
