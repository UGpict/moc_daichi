import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blockedAll,
  memoryInfluenceVerdict,
  rainVerdict,
  reflectionQuestionVerdict,
  scoreOutcome,
} from "../src/domain/demo/criteria61";
import {
  causeUnknown,
  interpretConfirmation,
  mockFromNote,
  normalizeReflectionLlm,
} from "../src/server/agent/reflectionNormalize";
import { inspectAdc, inspectPersist } from "../src/server/repositories/firestore/repo";
import { PersistBlockedError } from "../src/server/repositories/persistErrors";
import { agentActionCoerceSchema } from "../src/server/llm/taskSchemas";

describe("v0.4 §6.1 scoring", () => {
  it("does not treat rain approval as complete success", () => {
    const rain = rainVerdict({
      autoApplied: false,
      pendingApproval: true,
      nextValidationState: "CONDITIONAL",
      reasons: ["新しい行程は CONDITIONAL で、AUTO_NOTIFY には使えません"],
    });
    assert.equal(rain.verdict, "BLOCKED");
    const outcome = scoreOutcome([
      rain,
      ...blockedAll("x").filter((c) => c.id !== "rain_auto_notify" && c.id !== "persist_backend"),
    ]);
    assert.notEqual(outcome, "完全成功");
  });

  it("fails when there is no confirmation question", () => {
    const q = reflectionQuestionVerdict("WAITING_APPROVAL", false);
    assert.equal(q.verdict, "FAIL");
    assert.match(q.detail, /確認質問なし/);
  });

  it("fails when next plan has no visible memory influence", () => {
    assert.equal(memoryInfluenceVerdict([]).verdict, "FAIL");
    assert.equal(memoryInfluenceVerdict([{ effect: "NONE" }]).verdict, "FAIL");
    assert.equal(memoryInfluenceVerdict([{ effect: "DURATION" }]).verdict, "PASS");
  });

  it("distinguishes FAILED / BLOCKED / 部分成功", () => {
    assert.equal(scoreOutcome([reflectionQuestionVerdict("WAITING_APPROVAL", false)]), "FAILED");
    const allPass = [
      rainVerdict({ autoApplied: true, pendingApproval: false }),
      reflectionQuestionVerdict("WAITING_INPUT", true),
      memoryInfluenceVerdict([{ effect: "DURATION" }]),
    ];
    // incomplete set is 部分成功 or FAILED depending on missing; here only 3 PASS
    assert.equal(scoreOutcome(allPass), "完全成功");
    assert.equal(
      scoreOutcome([
        rainVerdict({ autoApplied: false, pendingApproval: true, nextValidationState: "CONDITIONAL", reasons: ["CONDITIONAL"] }),
        reflectionQuestionVerdict("WAITING_INPUT", true),
      ]),
      "部分成功",
    );
    assert.equal(scoreOutcome(blockedAll("persist CREDENTIALS")), "BLOCKED");
  });
});

describe("reflection split (no auto convert)", () => {
  it("does not turn 疲 into STANDING and asks one question when cause is unknown", () => {
    const note = "カフェは喜んでた。展示は途中で疲れてた";
    assert.equal(causeUnknown(note), true);
    const mock = mockFromNote(note);
    assert.ok(mock.clarification);
    assert.equal(mock.clarification?.options.length, 4);
    assert.ok(mock.hypotheses.length);
    assert.ok(!mock.memoryCandidates.some((c) => c.careTarget === "STANDING"));
    assert.ok(!mock.memoryCandidates.some((c) => c.sourceType === "HYPOTHESIS"));
    assert.ok(!mock.memoryCandidates.some((c) => c.type === "PREFERENCE"));
    assert.ok(!mock.memoryCandidates.some((c) => /カフェが好評/.test(c.content)));
  });

  it("does not invent a cafe preference from the word カフェ alone", () => {
    const mock = mockFromNote("カフェに行った");
    assert.ok(!mock.memoryCandidates.some((c) => c.type === "PREFERENCE"));
    assert.ok(!mock.observations.some((o) => /好評/.test(o)));
    const normalized = normalizeReflectionLlm({ observations: ["カフェに行った"], memoryCandidates: [] }, "カフェに行った");
    assert.ok(!normalized.memoryCandidates.some((c) => c.type === "PREFERENCE"));
    assert.ok(!normalized.memoryCandidates.some((c) => /カフェが好評/.test(c.content)));
  });

  it("does not rewrite HYPOTHESIS to OBSERVATION", () => {
    const note = "カフェは喜んでた。展示は途中で疲れてた";
    const normalized = normalizeReflectionLlm(
      {
        observations: ["疲れていた"],
        hypotheses: [],
        uncertainties: [],
        clarification: null,
        memoryCandidates: [
          {
            subject: "PARTNER",
            type: "CARE",
            content: "立つと疲れる仮説",
            sourceType: "HYPOTHESIS",
            evidenceQuote: "疲れてた",
            strength: "SOFT",
            scope: "NEXT_DATE",
            careTarget: "STANDING",
            careDirection: "REDUCE",
          },
        ],
      },
      note,
    );
    assert.ok(normalized.hypotheses.some((h) => /立つと疲れる/.test(h)));
    assert.ok(!normalized.memoryCandidates.some((c) => c.sourceType === "HYPOTHESIS"));
    assert.ok(!normalized.memoryCandidates.some((c) => c.careTarget === "STANDING"));
    assert.ok(normalized.clarification);
  });

  it("only confirmed standing answer becomes CARE STANDING", () => {
    const no = interpretConfirmation("分からない");
    assert.equal(no.saveCausal, false);
    const yes = interpretConfirmation("長く立つのがしんどいと言っていた");
    assert.equal(yes.saveCausal, true);
    assert.equal(yes.careTarget, "STANDING");
    assert.equal(yes.careDirection, "REDUCE");
  });
});

describe("persist kinds", () => {
  it("reports CREDENTIALS when ADC is missing rather than unimplemented", () => {
    const prev = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const prevRuntime = process.env.APP_RUNTIME;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    process.env.APP_RUNTIME = "LIVE";
    const adc = inspectAdc();
    const persist = inspectPersist();
    if (prev != null) process.env.GOOGLE_APPLICATION_CREDENTIALS = prev;
    else delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (prevRuntime != null) process.env.APP_RUNTIME = prevRuntime;
    else delete process.env.APP_RUNTIME;
    assert.equal(adc.kind, "CREDENTIALS");
    assert.notEqual(persist.kind, "UNIMPLEMENTED");
    const err = new PersistBlockedError("CREDENTIALS", "ADC missing");
    assert.equal(err.kind, "CREDENTIALS");
    assert.notEqual(err.kind, "UNIMPLEMENTED");
  });
});

describe("tool decision schema", () => {
  it("accepts a decision that sees lastValidation", () => {
    const parsed = agentActionCoerceSchema.parse({
      type: "PROPOSE_PLAN",
      reason: "前回 FAIL を見て並べ替えた",
      lastValidationSeen: "FAIL:LATE_TO_END",
      orderedSpotIds: ["a", "b", "c"],
    });
    assert.equal(parsed.type, "PROPOSE_PLAN");
    assert.equal(parsed.lastValidationSeen, "FAIL:LATE_TO_END");
    assert.deepEqual(parsed.orderedSpotIds, ["a", "b", "c"]);
  });
});
