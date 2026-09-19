import type { Approval, Plan, PlanItem } from "@/domain/schemas";

export function canApplyPlan(args: {
  callerUid: string;
  ownerUid: string;
  approval: Approval;
  currentVersion: number | null;
  nextPlan: Plan | null;
  previousPlan: Plan | null;
}): { ok: true } | { ok: false; status: number; error: string } {
  if (args.callerUid !== args.ownerUid) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  if (args.approval.status !== "PENDING") {
    return { ok: false, status: 409, error: "already consumed" };
  }
  if (args.approval.kind !== "PLAN_APPLY") {
    return { ok: false, status: 400, error: "kind" };
  }
  if (args.currentVersion !== args.approval.planVersionFrom) {
    return { ok: false, status: 409, error: "stale version" };
  }
  if (args.nextPlan?.validation.state === "FAIL") {
    return { ok: false, status: 409, error: "FAIL plan cannot be applied" };
  }
  if (args.previousPlan && args.nextPlan) {
    const broken = protectedBroken(args.previousPlan.items, args.nextPlan.items);
    if (broken) return { ok: false, status: 409, error: "protected items changed" };
  }
  return { ok: true };
}

export function canApproveMemory(args: {
  callerUid: string;
  ownerUid: string;
  approval: Approval;
  candidateId: string | null | undefined;
  presentedHash: string | null | undefined;
  currentHash: string | null | undefined;
  sourceVersion: number | null | undefined;
  memoryVersion: number | null | undefined;
}): { ok: true } | { ok: false; status: number; error: string } {
  if (args.callerUid !== args.ownerUid) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  if (args.approval.status !== "PENDING") {
    return { ok: false, status: 409, error: "already consumed" };
  }
  if (!args.candidateId || args.approval.candidateId !== args.candidateId) {
    return { ok: false, status: 409, error: "candidateId required" };
  }
  if (args.approval.presentedHash && args.currentHash && args.approval.presentedHash !== args.currentHash) {
    return { ok: false, status: 409, error: "content hash mismatch; re-approve" };
  }
  if (
    args.approval.kind === "MEMORY_EDIT" &&
    args.memoryVersion != null &&
    args.sourceVersion != null &&
    args.memoryVersion !== args.sourceVersion
  ) {
    return { ok: false, status: 409, error: "source version mismatch" };
  }
  return { ok: true };
}

export function canWriteRun(args: {
  leaseOwner: string | null;
  leaseFencingToken: number;
  workerId: string;
  fencingToken: number;
}): boolean {
  return args.leaseOwner === args.workerId && args.leaseFencingToken === args.fencingToken;
}

function protectedBroken(prev: PlanItem[], next: PlanItem[]): boolean {
  return prev.some(
    (i) =>
      (i.locked || i.progress === "DONE" || i.progress === "IN_PROGRESS") &&
      !next.some((n) => n.spotId === i.spotId && n.startAt === i.startAt && n.endAt === i.endAt),
  );
}
