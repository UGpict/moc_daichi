import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizeWorkerRequest } from "../src/server/jobs/auth";
import { enqueueRun, jobDispatchMode, workerJobsUrl } from "../src/server/jobs/dispatch";
import { claimRunInTx, claimSpecificRunInTx, type FirestoreCollections } from "../src/server/repositories/firestore/tx";
import { stripPlaceholderAdc } from "../src/server/auth/adc";
import type { Run } from "../src/domain/schemas";

function pendingRun(over: Partial<Run> = {}): Run {
  return {
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
    dispatchAttempts: 0,
    trigger: null,
    basePlanVersion: null,
    resultPlanVersion: null,
    waitingQuestion: null,
    waitingApprovalId: null,
    error: null,
    cost: { llmJpy: 0, apiJpy: 0, mundaneCalls: 0, hardCalls: 0, unaccountedCalls: 0 },
    versions: { schema: "0.8.0", prompt: "0.8.0", tool: "0.8.0", modelSettings: "0.8.0", git: null },
    ...over,
  };
}

function emptyDb(run: Run): FirestoreCollections {
  return { couples: {}, sessions: {}, planVersions: {}, runs: { [run.id]: run }, approvals: {} };
}

function withEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    prev[key] = process.env[key];
    const value = vars[key];
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  const restore = () => {
    for (const key of Object.keys(vars)) {
      if (prev[key] == null) delete process.env[key];
      else process.env[key] = prev[key];
    }
  };
  try {
    const result = fn();
    if (result && typeof result === "object" && "then" in result) {
      return result.finally(restore);
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

describe("job dispatch", () => {
  it("defaults to poller off Cloud Run", () => {
    withEnv({ WORKER_MODE: undefined, K_SERVICE: undefined, VERCEL: undefined }, () => {
      assert.equal(jobDispatchMode(), "poller");
    });
  });

  it("uses sync on Vercel so PENDING is not left for a missing worker", () => {
    withEnv({ WORKER_MODE: undefined, K_SERVICE: undefined, VERCEL: "1" }, () => {
      assert.equal(jobDispatchMode(), "sync");
    });
  });

  it("poller enqueue does not call HTTP", async () => {
    await withEnv({ WORKER_MODE: "poller" }, async () => {
      let called = 0;
      const result = await enqueueRun("run_1", {
        fetchFn: (async () => {
          called += 1;
          return new Response("no", { status: 500 });
        }) as typeof fetch,
      });
      assert.equal(result.mode, "poller");
      assert.equal(result.accepted, true);
      assert.equal(called, 0);
    });
  });

  it("http enqueue posts runId without waiting for execution", async () => {
    await withEnv(
      {
        WORKER_MODE: "http",
        WORKER_INVOKE_URL: "http://127.0.0.1:8088",
        WORKER_SHARED_SECRET: "s3cret",
        CLOUD_TASKS_QUEUE: undefined,
      },
      async () => {
        let url = "";
        let auth = "";
        let body = "";
        let release!: () => void;
        const posted = new Promise<void>((resolve) => {
          release = resolve;
        });
        const result = await enqueueRun("run_9", {
          fetchFn: (async (input, init) => {
            url = String(input);
            auth = String((init?.headers as Record<string, string>)?.Authorization ?? "");
            body = String(init?.body ?? "");
            release();
            return new Response("{}", { status: 200 });
          }) as typeof fetch,
        });
        await posted;
        assert.equal(result.accepted, true);
        assert.match(url, /\/api\/internal\/jobs$/);
        assert.equal(auth, "Bearer s3cret");
        assert.match(body, /run_9/);
      },
    );
  });

  it("workerJobsUrl stays null on Cloud Run without WORKER_INVOKE_URL", () => {
    withEnv({ WORKER_INVOKE_URL: undefined, K_SERVICE: "futari-log" }, () => {
      assert.equal(workerJobsUrl(), null);
    });
  });
});

describe("worker auth", () => {
  it("accepts shared secret", () => {
    withEnv({ WORKER_SHARED_SECRET: "abc" }, () => {
      const req = new Request("http://example/api/internal/jobs", {
        headers: { authorization: "Bearer abc" },
      });
      assert.equal(authorizeWorkerRequest(req).ok, true);
    });
  });

  it("refuses Cloud Run LIVE without secret", () => {
    withEnv({ WORKER_SHARED_SECRET: undefined, APP_RUNTIME: "LIVE", K_SERVICE: "futari-log" }, () => {
      const req = new Request("http://example/api/internal/jobs");
      const r = authorizeWorkerRequest(req);
      assert.equal(r.ok, false);
    });
  });

  it("allows localhost without secret in DEV", () => {
    withEnv({ WORKER_SHARED_SECRET: undefined, K_SERVICE: undefined, APP_RUNTIME: "MOCK" }, () => {
      const req = new Request("http://127.0.0.1:3000/api/internal/jobs", {
        headers: { host: "127.0.0.1:3000" },
      });
      assert.equal(authorizeWorkerRequest(req).ok, true);
    });
  });
});

describe("claim and retry", () => {
  it("claimSpecificRunInTx leases only that run", () => {
    const db = emptyDb(pendingRun());
    db.runs.r2 = pendingRun({ id: "r2", createdAt: "s" });
    const claimed = claimSpecificRunInTx(db, { runId: "r2", workerId: "w", nowMs: Date.now(), leaseMs: 30_000 });
    assert.equal(claimed?.runId, "r2");
    assert.equal(db.runs.r2?.status, "RUNNING");
    assert.equal(db.runs.r1?.status, "PENDING");
  });

  it("second claim of a leased run fails", () => {
    const db = emptyDb(pendingRun());
    const now = Date.now();
    const first = claimSpecificRunInTx(db, { runId: "r1", workerId: "w1", nowMs: now, leaseMs: 30_000 });
    const second = claimSpecificRunInTx(db, { runId: "r1", workerId: "w2", nowMs: now + 10, leaseMs: 30_000 });
    assert.ok(first);
    assert.equal(second, null);
    assert.equal(db.runs.r1?.leaseOwner, "w1");
  });

  it("exceeded dispatch attempts fail the run", () => {
    const db = emptyDb(pendingRun({ dispatchAttempts: 3 }));
    const claimed = claimRunInTx(db, { workerId: "w", nowMs: Date.now(), leaseMs: 30_000 });
    assert.equal(claimed, null);
    assert.equal(db.runs.r1?.status, "FAILED");
    assert.match(db.runs.r1?.error ?? "", /dispatch attempts/);
  });
});

describe("no service account key", () => {
  it("strips placeholder GAC so applicationDefault can use user ADC", () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/path/to/service-account.json";
    const r = stripPlaceholderAdc();
    assert.equal(r.stripped, true);
    assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, undefined);
  });
});
