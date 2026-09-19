import type { Approval, Plan, Run } from "@/domain/schemas";
import { canApplyPlan, canWriteRun } from "@/server/approvals/service";

/** コレクションはエンティティ単位。巨大 JSON 1 件では保存しない。 */
export type FirestoreCollections = {
  couples: Record<string, { id: string; ownerUid: string; isDemo: boolean; createdAt: string }>;
  sessions: Record<string, { id: string; coupleId: string; ownerUid: string; currentPlanVersion: number | null }>;
  planVersions: Record<string, Plan>;
  runs: Record<string, Run>;
  approvals: Record<string, Approval>;
};

export function planVersionKey(sessionId: string, version: number) {
  return `${sessionId}:${version}`;
}

export function applyProposalInTx(
  db: FirestoreCollections,
  input: { uid: string; approvalId: string; decision: "APPROVE" | "REJECT"; workerId?: string; fencingToken?: number },
): { ok: true } | { ok: false; status: number; error: string } {
  const approval = db.approvals[input.approvalId];
  if (!approval) return { ok: false, status: 404, error: "not found" };
  const session = db.sessions[approval.sessionId];
  if (!session) return { ok: false, status: 404, error: "session" };
  const couple = db.couples[approval.coupleId];
  if (!couple) return { ok: false, status: 404, error: "couple" };
  const nextPlan = db.planVersions[planVersionKey(session.id, approval.planVersionTo)] ?? null;
  const previousPlan =
    approval.planVersionFrom > 0 ? db.planVersions[planVersionKey(session.id, approval.planVersionFrom)] ?? null : null;
  const gate = canApplyPlan({
    callerUid: input.uid,
    ownerUid: couple.ownerUid,
    approval,
    currentVersion: session.currentPlanVersion,
    nextPlan,
    previousPlan,
  });
  if (!gate.ok) return gate;
  const run = db.runs[approval.runId];
  if (run && input.workerId && input.fencingToken != null) {
    if (!canWriteRun({
      leaseOwner: run.leaseOwner,
      leaseFencingToken: run.leaseFencingToken,
      workerId: input.workerId,
      fencingToken: input.fencingToken,
    })) {
      return { ok: false, status: 409, error: "stale lease" };
    }
  }
  if (input.decision === "APPROVE") {
    session.currentPlanVersion = approval.planVersionTo;
    approval.status = "CONSUMED";
    if (run) {
      run.status = "SUCCEEDED";
      run.finishedAt = new Date().toISOString();
    }
  } else {
    approval.status = "REJECTED";
    if (run) {
      run.status = "CANCELLED";
      run.finishedAt = new Date().toISOString();
    }
  }
  approval.consumedAt = new Date().toISOString();
  return { ok: true };
}

function takeLeaseInTx(
  run: Run,
  input: { workerId: string; nowMs: number; leaseMs: number },
): { runId: string; fencingToken: number } | null {
  if (run.leaseOwner && run.leaseExpiresAt && new Date(run.leaseExpiresAt).getTime() > input.nowMs) {
    return null;
  }
  const attempts = (run.dispatchAttempts ?? 0) + 1;
  run.dispatchAttempts = attempts;
  if (attempts > 3) {
    run.status = "FAILED";
    run.error = "dispatch attempts exceeded";
    run.finishedAt = new Date(input.nowMs).toISOString();
    run.leaseOwner = null;
    return null;
  }
  run.status = "RUNNING";
  run.startedAt = run.startedAt ?? new Date(input.nowMs).toISOString();
  run.leaseOwner = input.workerId;
  run.heartbeatAt = new Date(input.nowMs).toISOString();
  run.leaseExpiresAt = new Date(input.nowMs + input.leaseMs).toISOString();
  run.leaseFencingToken = (run.leaseFencingToken ?? 0) + 1;
  return { runId: run.id, fencingToken: run.leaseFencingToken };
}

export function claimRunInTx(
  db: FirestoreCollections,
  input: { workerId: string; nowMs: number; leaseMs: number },
): { runId: string; fencingToken: number } | null {
  const pending = Object.values(db.runs)
    .filter((r) => r.status === "PENDING")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const run = pending[0];
  if (!run) return null;
  return takeLeaseInTx(run, input);
}

export function claimSpecificRunInTx(
  db: FirestoreCollections,
  input: { runId: string; workerId: string; nowMs: number; leaseMs: number },
): { runId: string; fencingToken: number } | null {
  const run = db.runs[input.runId];
  if (!run || run.status !== "PENDING") return null;
  return takeLeaseInTx(run, input);
}
