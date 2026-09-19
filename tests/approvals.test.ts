import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canApplyPlan, canApproveMemory, canWriteRun } from "../src/server/approvals/service";
import { applyProposalInTx, claimRunInTx, planVersionKey, type FirestoreCollections } from "../src/server/repositories/firestore/tx";
import { parseClientPicks } from "../src/server/agent/drafts";
import type { Approval, Plan, Run } from "../src/domain/schemas";

function fact<T>(value: T | null) {
  return { value, evidenceIds: [] as string[] };
}

function emptyPlan(over: Partial<Plan> = {}): Plan {
  return {
    version: 1,
    items: [],
    legs: [],
    openings: [],
    assumptions: [],
    validation: { state: "PASS", issues: [] },
    planB: [],
    costEstimate: {
      mealsJpy: fact(null),
      facilitiesJpy: fact(null),
      transitJpy: fact(null),
      totalJpy: fact(null),
    },
    dataMode: "LIVE",
    memoryInfluences: [],
    preferenceOutcomes: [],
    ...over,
  };
}

const pending: Approval = {
  id: "ap1",
  coupleId: "c1",
  sessionId: "s1",
  runId: "r1",
  planVersionFrom: 1,
  planVersionTo: 2,
  kind: "PLAN_APPLY",
  status: "PENDING",
  summary: "x",
  diff: null,
  consumedAt: null,
  createdAt: "t",
  payloadId: "plan:s1:2",
  payloadVersion: 2,
  candidateId: null,
  candidateVersion: 1,
  sourceMemoryId: null,
  sourceVersion: null,
  replacementCandidateId: null,
  presentedHash: null,
};

describe("approvals and firestore tx", () => {
  it("refuses FAIL plans even with manual approval", () => {
    const r = canApplyPlan({
      callerUid: "u1",
      ownerUid: "u1",
      approval: pending,
      currentVersion: 1,
      nextPlan: emptyPlan({ version: 2, validation: { state: "FAIL", issues: [] } }),
      previousPlan: emptyPlan(),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, "FAIL plan cannot be applied");
  });

  it("refuses other uid and double apply", () => {
    const other = canApplyPlan({
      callerUid: "u2",
      ownerUid: "u1",
      approval: pending,
      currentVersion: 1,
      nextPlan: emptyPlan({ version: 2 }),
      previousPlan: emptyPlan(),
    });
    assert.equal(other.ok, false);
    const consumed = canApplyPlan({
      callerUid: "u1",
      ownerUid: "u1",
      approval: { ...pending, status: "CONSUMED" },
      currentVersion: 1,
      nextPlan: emptyPlan({ version: 2 }),
      previousPlan: emptyPlan(),
    });
    assert.equal(consumed.ok, false);
  });

  it("binds memory approval to candidateId not text", () => {
    const r = canApproveMemory({
      callerUid: "u1",
      ownerUid: "u1",
      approval: { ...pending, kind: "MEMORY_SAVE", candidateId: "mc_1", presentedHash: "aaa" },
      candidateId: "mc_2",
      presentedHash: "aaa",
      currentHash: "aaa",
      sourceVersion: null,
      memoryVersion: null,
    });
    assert.equal(r.ok, false);
  });

  it("rejects stale fencing token writes", () => {
    assert.equal(
      canWriteRun({ leaseOwner: "w1", leaseFencingToken: 2, workerId: "w1", fencingToken: 1 }),
      false,
    );
    assert.equal(
      canWriteRun({ leaseOwner: "w1", leaseFencingToken: 2, workerId: "w1", fencingToken: 2 }),
      true,
    );
  });

  it("applyProposalInTx is document-scoped and rejects stale lease", () => {
    const run: Run = {
      id: "r1",
      coupleId: "c1",
      sessionId: "s1",
      ownerUid: "u1",
      kind: "REPLAN",
      status: "WAITING_APPROVAL",
      mode: "LIVE",
      displayRuntime: "DEV",
      leaseFencingToken: 3,
      createdAt: "t",
      startedAt: "t",
      finishedAt: null,
      deadlineAt: null,
      leaseOwner: "worker_a",
      leaseExpiresAt: "2099-01-01T00:00:00.000Z",
      heartbeatAt: "t",
      trigger: null,
      basePlanVersion: 1,
      resultPlanVersion: 2,
      waitingQuestion: null,
      waitingApprovalId: "ap1",
      error: null,
      cost: { llmJpy: 0, apiJpy: 0, mundaneCalls: 0, hardCalls: 0, unaccountedCalls: 0 },
      versions: { schema: "0.7.0", prompt: "0.7.0", tool: "0.7.0", modelSettings: "0.7.0", git: null },
    };
    const db: FirestoreCollections = {
      couples: { c1: { id: "c1", ownerUid: "u1", isDemo: true, createdAt: "t" } },
      sessions: { s1: { id: "s1", coupleId: "c1", ownerUid: "u1", currentPlanVersion: 1 } },
      planVersions: {
        [planVersionKey("s1", 1)]: emptyPlan({ version: 1 }),
        [planVersionKey("s1", 2)]: emptyPlan({ version: 2 }),
      },
      runs: { r1: run },
      approvals: { ap1: pending },
    };
    const stale = applyProposalInTx(db, {
      uid: "u1",
      approvalId: "ap1",
      decision: "APPROVE",
      workerId: "worker_a",
      fencingToken: 1,
    });
    assert.equal(stale.ok, false);
    const ok = applyProposalInTx(db, {
      uid: "u1",
      approvalId: "ap1",
      decision: "APPROVE",
      workerId: "worker_a",
      fencingToken: 3,
    });
    assert.equal(ok.ok, true);
    assert.equal(db.sessions.s1?.currentPlanVersion, 2);
    const again = applyProposalInTx(db, { uid: "u1", approvalId: "ap1", decision: "APPROVE" });
    assert.equal(again.ok, false);
  });

  it("claimRun increments fencing token", () => {
    const db: FirestoreCollections = {
      couples: {},
      sessions: {},
      planVersions: {},
      runs: {
        r1: {
          id: "r1",
          coupleId: "c1",
          sessionId: "s1",
          ownerUid: "u1",
          kind: "INITIAL_PLAN",
          status: "PENDING",
          mode: "LIVE",
          displayRuntime: "DEV",
          leaseFencingToken: 0,
          createdAt: "t",
          startedAt: null,
          finishedAt: null,
          deadlineAt: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          heartbeatAt: null,
          trigger: null,
          basePlanVersion: null,
          resultPlanVersion: null,
          waitingQuestion: null,
          waitingApprovalId: null,
          error: null,
          cost: { llmJpy: 0, apiJpy: 0, mundaneCalls: 0, hardCalls: 0, unaccountedCalls: 0 },
          versions: { schema: "0.7.0", prompt: "0.7.0", tool: "0.7.0", modelSettings: "0.7.0", git: null },
        },
      },
      approvals: {},
    };
    const first = claimRunInTx(db, { workerId: "w", nowMs: Date.now(), leaseMs: 30000 });
    assert.equal(first?.fencingToken, 1);
    db.runs.r1!.status = "PENDING";
    db.runs.r1!.leaseOwner = null;
    db.runs.r1!.leaseExpiresAt = null;
    const second = claimRunInTx(db, { workerId: "w", nowMs: Date.now(), leaseMs: 30000 });
    assert.equal(second?.fencingToken, 2);
  });

  it("ignores broken sessionStorage JSON", () => {
    assert.equal(parseClientPicks("{not json"), null);
    assert.equal(parseClientPicks(null), null);
    const ok = parseClientPicks(JSON.stringify({ ids: ["a"], names: ["A"], vibes: ["x"] }));
    assert.equal(ok?.ids[0], "a");
  });
});
