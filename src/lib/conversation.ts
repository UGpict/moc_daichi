import {
  CREMATION_FIRST_DATE,
  CREMATION_NEXT_DATE,
  DEFAULT_FAMILY_JUDGMENT,
  FAMILY,
  FAMILY_HANDOVER_DATE,
  FIRST_QUESTION_BODY,
  FIRST_REPLY_BODY,
  FOLLOWUP_QUESTION_BODY,
  FOLLOWUP_REPLY_BODY,
  FUNERAL_HOME,
  TALK_OPENING,
} from "./sample-data";
import type {
  ArrivalSlot,
  DemoState,
  FamilyJudgment,
  MemoryKind,
  MemoryRecord,
  ShareSelection,
  SummaryDecision,
  TalkMessage,
  TalkStep,
  UserActionId,
} from "./types";

export const MEMORY_IDS = {
  saidBurden: "said_burden",
  interpReason: "interp_reason",
  confirmedReason: "confirmed_reason",
  saidWho: "said_who",
  interpWho: "interp_who",
  confirmedWho: "confirmed_who",
  saidSchedule: "said_schedule",
  confirmedSchedule: "confirmed_schedule",
  saidModest: "said_modest",
  interpModest: "interp_modest",
  factStay: "fact_stay",
  factTransportVague: "fact_transport_vague",
  factTransport: "fact_transport",
  factCremation: "fact_cremation",
  factFood: "fact_food",
} as const;

export interface TalkChoice {
  id: string;
  label: string;
}

export interface TalkView {
  prompt: string;
  chips: TalkChoice[];
  allowText: boolean;
  allowStop: boolean;
  waiting: boolean;
  showInquiryDetails: boolean;
  inquiryPlain: string | null;
  inquiryBody: string | null;
}

export interface WishSummary {
  values: string[];
  wishes: string[];
  reasons: string[];
  flexibility: string[];
  cost: string[];
  undecided: string[];
  said: string[];
  interpretations: string[];
  confirmed: string[];
  externalFacts: string[];
  hasDirectBurial: boolean;
}

export interface FamilyScheduleProposal {
  date: string;
  stayDays: 4 | 5;
  reason: string;
  conflict: string | null;
  alternatives: string[];
}

export interface FamilyPrepBook {
  wishes: string[];
  reasons: string[];
  flexibility: string[];
  confirmed: string[];
  undecided: string[];
  contacts: string[];
  estimate: string[];
  firstAction: string[];
  privateHidden: boolean;
}

const STOP_ID = "stop";
const UNKNOWN_ID = "unknown";

function upsertMemory(memories: MemoryRecord[], record: MemoryRecord): MemoryRecord[] {
  const index = memories.findIndex((item) => item.id === record.id);
  if (index === -1) {
    return [...memories, record];
  }
  const next = [...memories];
  next[index] = record;
  return next;
}

function removeMemories(memories: MemoryRecord[], ids: string[]): MemoryRecord[] {
  return memories.filter((item) => !ids.includes(item.id));
}

function findMemory(memories: MemoryRecord[], id: string): MemoryRecord | undefined {
  return memories.find((item) => item.id === id);
}

function appendMessages(
  state: DemoState,
  extras: Array<Omit<TalkMessage, "id">>,
): Pick<DemoState, "messages" | "messageSeq"> {
  let seq = state.messageSeq;
  const messages = [...state.messages];
  for (const extra of extras) {
    seq += 1;
    messages.push({ ...extra, id: `m-${seq}` });
  }
  return { messages, messageSeq: seq };
}

function withTalk(
  state: DemoState,
  step: TalkStep,
  extras: Array<Omit<TalkMessage, "id">>,
  memories = state.memories,
): DemoState {
  return {
    ...state,
    talkStep: step,
    resumeStep: step === "paused" ? state.resumeStep : step,
    memories,
    share:
      step === "share"
        ? { ...state.share, sharedWithKenichi: true }
        : state.share,
    ...appendMessages(state, extras),
  };
}

export function normalizeTalkText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function looksLikeStop(text: string): boolean {
  return /今日はここまで|また今度|終わり|中断/.test(text);
}

export function looksLikeUnknown(text: string): boolean {
  return /まだ分からない|わからない|分からない|決めていない|未定/.test(text);
}

export function resolveOpenChoice(raw: string): string {
  const text = normalizeTalkText(raw);
  if (!text) {
    return "";
  }
  if (text === "burden" || /迷惑|困らせ|何をしておけ/.test(text)) {
    return "burden";
  }
  if (text === STOP_ID || looksLikeStop(text)) {
    return STOP_ID;
  }
  return "other";
}

export function resolveClarifyChoice(raw: string): string {
  const text = normalizeTalkText(raw);
  if (text === "choices" || /お金は残|何をすれば|選ぶ|手続きや何を/.test(text)) {
    return "choices";
  }
  if (text === "money" || /お金|費用|負担/.test(text)) {
    return "money";
  }
  if (text === UNKNOWN_ID || looksLikeUnknown(text)) {
    return UNKNOWN_ID;
  }
  if (text === STOP_ID || looksLikeStop(text)) {
    return STOP_ID;
  }
  return UNKNOWN_ID;
}

export function resolveWhoChoice(raw: string): string {
  const text = normalizeTalkText(raw);
  if (text === "family_only" || /家族だけ|家族のみ|身内だけ/.test(text)) {
    return "family_only";
  }
  if (text === "close_friends" || /親しい|友人|知人|会ってほしい/.test(text)) {
    return "close_friends";
  }
  if (text === UNKNOWN_ID || looksLikeUnknown(text)) {
    return UNKNOWN_ID;
  }
  if (text === STOP_ID || looksLikeStop(text)) {
    return STOP_ID;
  }
  return UNKNOWN_ID;
}

export function resolveScheduleChoice(raw: string): string {
  const text = normalizeTalkText(raw);
  if (text === "family_decides" || /任せる|家族の都合|都合を優先/.test(text)) {
    return "family_decides";
  }
  if (text === "soon" || /早く|急い/.test(text)) {
    return "soon";
  }
  if (text === UNKNOWN_ID || looksLikeUnknown(text)) {
    return UNKNOWN_ID;
  }
  if (text === STOP_ID || looksLikeStop(text)) {
    return STOP_ID;
  }
  return UNKNOWN_ID;
}

export function resolveModestChoice(raw: string): string {
  const text = normalizeTalkText(raw);
  if (text === "modest" || /質素/.test(text)) {
    return "modest";
  }
  if (text === "save" || /抑え|安く|費用を/.test(text)) {
    return "save";
  }
  if (text === UNKNOWN_ID || looksLikeUnknown(text)) {
    return UNKNOWN_ID;
  }
  if (text === STOP_ID || looksLikeStop(text)) {
    return STOP_ID;
  }
  return UNKNOWN_ID;
}

function pause(state: DemoState, userText: string): DemoState {
  return withTalk(state, "paused", [
    { from: "user", text: userText },
    {
      from: "shirube",
      text: "今日はここまでにします。続きは、また話せるときに。まだ分からないままでも大丈夫です。",
    },
  ]);
}

function applyWhoMemories(memories: MemoryRecord[], choice: string): MemoryRecord[] {
  let next = removeMemories(memories, [
    MEMORY_IDS.saidWho,
    MEMORY_IDS.interpWho,
    MEMORY_IDS.confirmedWho,
  ]);
  if (choice === "family_only") {
    next = upsertMemory(next, {
      id: MEMORY_IDS.saidWho,
      kind: "said",
      category: "wishes",
      text: "家族だけ",
      sourceQuote: "家族だけ",
      private: false,
    });
    next = upsertMemory(next, {
      id: MEMORY_IDS.interpWho,
      kind: "interpretation",
      category: "wishes",
      text: "家族だけでのお見送り。形式（直葬など）は未確定",
      sourceQuote: "家族だけ",
      private: false,
    });
  } else if (choice === "close_friends") {
    next = upsertMemory(next, {
      id: MEMORY_IDS.saidWho,
      kind: "said",
      category: "wishes",
      text: "親しい人にも会ってほしい",
      sourceQuote: "親しい人にも会ってほしい",
      private: false,
    });
    next = upsertMemory(next, {
      id: MEMORY_IDS.interpWho,
      kind: "interpretation",
      category: "wishes",
      text: "家族に加え、親しい人にも会ってもらうお見送り。規模の上限は未確定",
      private: false,
    });
  } else {
    next = upsertMemory(next, {
      id: MEMORY_IDS.saidWho,
      kind: "said",
      category: "unknown",
      text: "見送る人は、まだ分からない",
      private: false,
    });
  }
  return next;
}

function applyScheduleMemories(memories: MemoryRecord[], choice: string): MemoryRecord[] {
  let next = removeMemories(memories, [
    MEMORY_IDS.saidSchedule,
    MEMORY_IDS.confirmedSchedule,
  ]);
  if (choice === "family_decides") {
    next = upsertMemory(next, {
      id: MEMORY_IDS.saidSchedule,
      kind: "said",
      category: "flexibility",
      text: "日程は家族に任せる",
      sourceQuote: "日程は家族に任せる",
      private: false,
    });
  } else if (choice === "soon") {
    next = upsertMemory(next, {
      id: MEMORY_IDS.saidSchedule,
      kind: "said",
      category: "flexibility",
      text: "できるだけ早く見送りたい",
      private: false,
    });
  } else {
    next = upsertMemory(next, {
      id: MEMORY_IDS.saidSchedule,
      kind: "said",
      category: "unknown",
      text: "日程の決め方は、まだ分からない",
      private: false,
    });
  }
  return next;
}

function confirmMemories(memories: MemoryRecord[]): MemoryRecord[] {
  let next = [...memories];
  const reason = findMemory(next, MEMORY_IDS.interpReason);
  if (reason) {
    next = upsertMemory(next, {
      ...reason,
      id: MEMORY_IDS.confirmedReason,
      kind: "confirmed",
    });
  }
  const who = findMemory(next, MEMORY_IDS.interpWho);
  if (who) {
    next = upsertMemory(next, {
      ...who,
      id: MEMORY_IDS.confirmedWho,
      kind: "confirmed",
    });
  }
  const schedule = findMemory(next, MEMORY_IDS.saidSchedule);
  if (schedule && schedule.category === "flexibility") {
    next = upsertMemory(next, {
      ...schedule,
      id: MEMORY_IDS.confirmedSchedule,
      kind: "confirmed",
    });
  }
  return next;
}

function isDirectBurialText(text: string): boolean {
  return /直葬/.test(text);
}

export function hasConfirmedDirectBurial(state: DemoState): boolean {
  return state.memories.some(
    (item) => item.kind === "confirmed" && isDirectBurialText(item.text),
  );
}

export function talkInputUserAction(
  state: DemoState,
  raw: string,
): UserActionId | null {
  const text = normalizeTalkText(raw);
  if (
    (state.talkStep === "inquiry_offer" &&
      (text === "approve_inquiry" || text === "approve")) ||
    text === "approve_inquiry"
  ) {
    return "approve_inquiry";
  }
  if (
    state.talkStep === "inquiry_followup" &&
    (text === "approve_followup" || text === "approve")
  ) {
    return "approve_followup";
  }
  return null;
}

function firstReplyFacts(memories: MemoryRecord[]): MemoryRecord[] {
  let next = upsertMemory(memories, {
    id: MEMORY_IDS.factStay,
    kind: "external_fact",
    category: "prep",
    text: "安置延長は1日11,000円（税込）。確認日は見積もり返信時（架空）",
    private: false,
  });
  next = upsertMemory(next, {
    id: MEMORY_IDS.factCremation,
    kind: "external_fact",
    category: "prep",
    text: "火葬料の今回の想定は12,000円（架空の返答）",
    private: false,
  });
  next = upsertMemory(next, {
    id: MEMORY_IDS.factFood,
    kind: "external_fact",
    category: "prep",
    text: "飲食・返礼品は20名で110,000円（税込、架空の返答）",
    private: false,
  });
  next = upsertMemory(next, {
    id: MEMORY_IDS.factTransportVague,
    kind: "external_fact",
    category: "unknown",
    text: "搬送の追加料金は『距離や状況による』とだけ返答があり、未解決",
    private: false,
  });
  return next;
}

function followupFacts(memories: MemoryRecord[]): MemoryRecord[] {
  const next = removeMemories(memories, [MEMORY_IDS.factTransportVague]);
  return upsertMemory(next, {
    id: MEMORY_IDS.factTransport,
    kind: "external_fact",
    category: "prep",
    text: "20km超は10kmごとに5,500円（端数切上げ）、夜間搬送は11,000円（架空の返答）",
    private: false,
  });
}

export function advanceTalkAfterInquiry(state: DemoState): DemoState {
  if (state.inquiryStatus === "awaiting_followup_approval") {
    return {
      ...withTalk(
        { ...state, memories: firstReplyFacts(state.memories) },
        "inquiry_followup",
        [
          {
            from: "shirube",
            text: `葬儀社から返事が届きました（体験用のサンプルです。しるべが確認したのではありません）。\n\n${FIRST_REPLY_BODY}\n\n搬送の追加料金は、まだ分かっていません。もう一度聞いてよいですか？`,
          },
        ],
      ),
      hasReviewedEstimate: true,
    };
  }

  if (state.inquiryStatus === "answers_confirmed") {
    return {
      ...withTalk(
        { ...state, memories: followupFacts(firstReplyFacts(state.memories)) },
        "share",
        [
          {
            from: "shirube",
            text: `追加の返事が届きました（体験用のサンプルです）。\n\n${FOLLOWUP_REPLY_BODY}\n\n分かった条件を、家族に残す内容へ反映できます。私的な相談は、選ばない限り共有しません。`,
          },
        ],
      ),
      hasReviewedEstimate: true,
    };
  }

  return state;
}

function applyClarify(state: DemoState, choice: string, spoken: string): DemoState {
  let memories = state.memories;
  memories = upsertMemory(memories, {
    id: MEMORY_IDS.saidBurden,
    kind: "said",
    category: "values",
    text: "子どもには迷惑をかけたくない",
    sourceQuote: "子どもには迷惑をかけたくない",
    private: true,
  });

  if (choice === "choices") {
    memories = upsertMemory(memories, {
      id: MEMORY_IDS.interpReason,
      kind: "interpretation",
      category: "reason",
      text: "お金は残してある。何を選べばいいかで困らせたくない",
      sourceQuote: spoken,
      private: false,
    });
  } else if (choice === "money") {
    memories = upsertMemory(memories, {
      id: MEMORY_IDS.interpReason,
      kind: "interpretation",
      category: "reason",
      text: "お金の負担を、特に気にしている",
      sourceQuote: spoken,
      private: false,
    });
  } else {
    memories = upsertMemory(memories, {
      id: MEMORY_IDS.interpReason,
      kind: "interpretation",
      category: "unknown",
      text: "迷惑をかけたくない理由は、まだ分からない",
      private: false,
    });
  }

  return withTalk(
    state,
    "who_attends",
    [
      { from: "user", text: spoken },
      {
        from: "shirube",
        text: "では、希望と連絡先、必要になったときの進め方を残していきましょう。まず、どんな人に見送ってもらいたいですか？",
      },
    ],
    memories,
  );
}

export function applyTalkInput(state: DemoState, raw: string): DemoState {
  const spoken = normalizeTalkText(raw);
  if (!spoken) {
    return state;
  }

  if (spoken === "resume" && state.talkStep === "paused") {
    const step = state.resumeStep === "paused" ? "open" : state.resumeStep;
    return withTalk(state, step, [
      { from: "user", text: "続きを話す" },
      {
        from: "shirube",
        text:
          step === "open"
            ? TALK_OPENING
            : "続きから、一つだけ聞きます。",
      },
    ]);
  }

  if (state.talkStep === "paused") {
    return state;
  }

  if (state.talkStep === "open") {
    const choice = resolveOpenChoice(spoken);
    if (choice === STOP_ID) {
      return pause(state, spoken === STOP_ID ? "今日はここまで" : spoken);
    }
    const memories = upsertMemory(state.memories, {
      id: MEMORY_IDS.saidBurden,
      kind: "said",
      category: "values",
      text: choice === "burden" ? "子どもには迷惑をかけたくない" : spoken,
      sourceQuote: choice === "burden" ? "子どもには迷惑をかけたくない" : spoken,
      private: true,
    });
    return withTalk(
      state,
      "clarify_burden",
      [
        {
          from: "user",
          text: choice === "burden" ? "子どもには迷惑をかけたくないんだけど、何をしておけばいいの？" : spoken,
          private: true,
        },
        {
          from: "shirube",
          text: "特に気になっているのは、お金の負担ですか。それとも、手続きや何を選ぶかで悩ませることでしょうか？",
        },
      ],
      memories,
    );
  }

  if (state.talkStep === "clarify_burden") {
    const choice = resolveClarifyChoice(spoken);
    if (choice === STOP_ID) {
      return pause(state, spoken === STOP_ID ? "今日はここまで" : spoken);
    }
    const label =
      choice === "choices"
        ? "お金は残してあるから、何をすればいいかで困らせたくない。"
        : choice === "money"
          ? "お金の負担が気になる"
          : spoken === UNKNOWN_ID
            ? "まだ分からない"
            : spoken;
    return applyClarify(state, choice, label);
  }

  if (state.talkStep === "who_attends" || state.talkStep === "correct_who") {
    const choice = resolveWhoChoice(spoken);
    if (choice === STOP_ID) {
      return pause(state, spoken === STOP_ID ? "今日はここまで" : spoken);
    }
    const label =
      choice === "family_only"
        ? "家族だけ"
        : choice === "close_friends"
          ? "親しい人にも会ってほしい"
          : spoken === UNKNOWN_ID
            ? "まだ分からない"
            : spoken;
    const memories = applyWhoMemories(state.memories, choice);
    const nextStep: TalkStep =
      state.talkStep === "correct_who" ? "correct_schedule" : "schedule_flex";
    const reply =
      nextStep === "correct_schedule"
        ? "分かりました。形式は、ご本人が確認するまで確定しません。日程については、どうしておきたいですか？"
        : "日程については、どうしておきたいですか。ご自身で決めておくか、家族に任せてもよいか、教えてください。";
    return withTalk(
      state,
      nextStep,
      [
        { from: "user", text: label },
        { from: "shirube", text: reply },
      ],
      memories,
    );
  }

  if (state.talkStep === "schedule_flex" || state.talkStep === "correct_schedule") {
    const choice = resolveScheduleChoice(spoken);
    if (choice === STOP_ID) {
      return pause(state, spoken === STOP_ID ? "今日はここまで" : spoken);
    }
    const label =
      choice === "family_decides"
        ? "日程は家族に任せる"
        : choice === "soon"
          ? "できるだけ早く"
          : spoken === UNKNOWN_ID
            ? "まだ分からない"
            : spoken;
    const memories = applyScheduleMemories(state.memories, choice);
    if (state.talkStep === "correct_schedule") {
      return withTalk(
        state,
        "summary",
        [
          { from: "user", text: label },
          {
            from: "shirube",
            text: "直した内容で、もう一度まとめます。合っているか見てください。",
          },
        ],
        memories,
      );
    }
    return withTalk(
      state,
      "modest_check",
      [
        { from: "user", text: label },
        {
          from: "shirube",
          text: "費用については、どう考えておきたいですか。「質素でいい」という言葉だけでは、直葬などの形式までは決めません。",
        },
      ],
      memories,
    );
  }

  if (state.talkStep === "modest_check") {
    const choice = resolveModestChoice(spoken);
    if (choice === STOP_ID) {
      return pause(state, spoken === STOP_ID ? "今日はここまで" : spoken);
    }
    let memories = state.memories;
    let label = spoken === UNKNOWN_ID ? "まだ分からない" : spoken;
    if (choice === "modest") {
      label = "質素でいい";
      memories = upsertMemory(memories, {
        id: MEMORY_IDS.saidModest,
        kind: "said",
        category: "cost",
        text: "質素でいい",
        sourceQuote: "質素でいい",
        private: false,
      });
      memories = upsertMemory(memories, {
        id: MEMORY_IDS.interpModest,
        kind: "interpretation",
        category: "cost",
        text: "費用を抑えたい気持ち。直葬などの形式は未確定",
        sourceQuote: "質素でいい",
        private: false,
      });
    } else if (choice === "save") {
      label = "できるだけ抑えたい";
      memories = upsertMemory(memories, {
        id: MEMORY_IDS.interpModest,
        kind: "interpretation",
        category: "cost",
        text: "できるだけ費用を抑えたい。上限は未定",
        private: false,
      });
    } else {
      memories = upsertMemory(memories, {
        id: MEMORY_IDS.interpModest,
        kind: "interpretation",
        category: "unknown",
        text: "費用の考え方は、まだ分からない",
        private: false,
      });
    }
    return withTalk(
      state,
      "summary",
      [
        { from: "user", text: label },
        {
          from: "shirube",
          text: "お話を短くまとめました。合っているか、見てください。",
        },
      ],
      memories,
    );
  }

  if (state.talkStep === "inquiry_offer") {
    if (spoken === STOP_ID || looksLikeStop(spoken)) {
      return pause(state, "今日はここまで");
    }
    if (spoken === "later") {
      return withTalk(state, "share", [
        { from: "user", text: "あとで確認する" },
        {
          from: "shirube",
          text: "確認は後回しにできます。家族に残す内容だけ、先に見ておきましょう。",
        },
      ]);
    }
    if (spoken === "approve_inquiry" || spoken === "approve") {
      return withTalk(state, "inquiry_waiting", [
        { from: "user", text: "確認してもよい" },
        {
          from: "shirube",
          text: `${FUNERAL_HOME.name}（${FUNERAL_HOME.fictionalNote}）へ、用意した質問を出す流れです。実際の送信は行いません。返事を待ちます。`,
        },
      ]);
    }
    return state;
  }

  if (state.talkStep === "inquiry_followup") {
    if (spoken === STOP_ID || looksLikeStop(spoken)) {
      return pause(state, "今日はここまで");
    }
    if (spoken === "later") {
      return withTalk(state, "share", [
        { from: "user", text: "あとで確認する" },
        {
          from: "shirube",
          text: "未解決のまま残して、家族に残す内容へ進めます。",
        },
      ]);
    }
    if (spoken === "approve_followup" || spoken === "approve") {
      return withTalk(state, "inquiry_waiting", [
        { from: "user", text: "もう一度聞いてよい" },
        {
          from: "shirube",
          text: "搬送の単価をもう一度確認します。実際の送信は行いません。",
        },
      ]);
    }
    return state;
  }

  if (state.talkStep === "family_status") {
    const note =
      spoken === "none"
        ? "まだ何も手配していない"
        : spoken === "contacted"
          ? "葬儀社には連絡した"
          : spoken === UNKNOWN_ID || looksLikeUnknown(spoken)
            ? "どこまで手配できているか、まだ分からない"
            : spoken;
    return {
      ...withTalk(state, "family_arrival", [
        { from: "user", text: note },
        {
          from: "shirube",
          text: "皆さんの到着は、いつになりそうですか。料金や空きは、生前の見積りをそのまま使いません。",
        },
      ]),
      familyJudgment: { ...state.familyJudgment, statusNote: note },
    };
  }

  if (state.talkStep === "family_arrival" || state.talkStep === "family_correct") {
    if (spoken === "relatives") {
      const judgment: FamilyJudgment = {
        ...state.familyJudgment,
        wantsRelatives: true,
      };
      const proposal = buildFamilyScheduleProposal({
        ...state,
        familyJudgment: judgment,
      });
      return {
        ...withTalk(
          { ...state, familyJudgment: judgment },
          "family_proposal",
          [
            { from: "user", text: "親戚も呼びたい" },
            {
              from: "shirube",
              text: `${proposal.reason}${proposal.conflict ? `\n\n${proposal.conflict}` : ""}`,
            },
          ],
        ),
        familyJudgment: {
          ...judgment,
          proposedDate: proposal.date,
          proposedReason: proposal.reason,
          acceptedProposal: false,
        },
      };
    }

    const arrival: ArrivalSlot =
      spoken === "apr16_morning" || /16.*朝|朝に到着/.test(spoken)
        ? "apr16_morning"
        : spoken === "apr16_evening" || /16.*夕|夕方/.test(spoken)
          ? "apr16_evening"
          : "undecided";
    const label =
      arrival === "apr16_morning"
        ? "16日の朝に到着できる"
        : arrival === "apr16_evening"
          ? "16日の夕方になる"
          : "まだ分からない";
    const judgment: FamilyJudgment = {
      ...state.familyJudgment,
      arrival,
    };
    const proposal = buildFamilyScheduleProposal({
      ...state,
      familyJudgment: judgment,
    });
    return {
      ...withTalk(
        { ...state, familyJudgment: judgment },
        "family_proposal",
        [
          { from: "user", text: label },
          { from: "shirube", text: proposal.reason },
        ],
      ),
      familyJudgment: {
        ...judgment,
        proposedDate: proposal.date,
        proposedReason: proposal.reason,
        acceptedProposal: false,
      },
    };
  }

  if (state.talkStep === "family_proposal") {
    if (spoken === "correct") {
      return withTalk(state, "family_correct", [
        { from: "user", text: "到着や呼びたい人を直したい" },
        {
          from: "shirube",
          text: "どこを直しますか。本人の希望は上書きしません。家族の事情として残します。",
        },
      ]);
    }
    if (spoken === "accept") {
      const proposal = buildFamilyScheduleProposal(state);
      return {
        ...withTalk(state, "family_ready", [
          { from: "user", text: "この候補で進める" },
          {
            from: "shirube",
            text: `${proposal.date}を、家族の判断による候補として残します。過去の見積額や空きは、いまも有効とは限りません。手続きの不足を確認しましょう。`,
          },
        ]),
        familyJudgment: {
          ...state.familyJudgment,
          acceptedProposal: true,
          proposedDate: proposal.date,
          proposedReason: proposal.reason,
        },
      };
    }
    return state;
  }

  return state;
}

export function applySummaryDecision(
  state: DemoState,
  decision: Exclude<SummaryDecision, "undecided"> | "correct",
): DemoState {
  if (decision === "correct") {
    return withTalk(
      { ...state, summaryDecision: "undecided" },
      "correct_who",
      [
        { from: "user", text: "直したい" },
        {
          from: "shirube",
          text: "どの希望を直しますか。まず、どんな人に見送ってもらいたいか、もう一度教えてください。",
        },
      ],
    );
  }

  if (decision === "deferred") {
    return withTalk(
      { ...state, summaryDecision: "deferred" },
      "inquiry_offer",
      [
        { from: "user", text: "まだ決めない" },
        {
          from: "shirube",
          text: getInquiryPlain(state),
        },
      ],
    );
  }

  return withTalk(
    { ...state, summaryDecision: "confirmed", memories: confirmMemories(state.memories) },
    "inquiry_offer",
    [
      { from: "user", text: "合っている" },
      {
        from: "shirube",
        text: getInquiryPlain(state),
      },
    ],
  );
}

export function applySharePatch(
  state: DemoState,
  patch: Partial<ShareSelection>,
): DemoState {
  return {
    ...state,
    share: { ...state.share, ...patch },
  };
}

export function completeShare(state: DemoState): DemoState {
  return {
    ...withTalk(
      { ...state, share: { ...state.share, sharedWithKenichi: true } },
      "handover_ready",
      [
        { from: "user", text: "この内容で残す" },
        {
          from: "shirube",
          text: `${FAMILY.child}さんに、選んだ内容だけ残します。私的な相談は、選ばない限り出ません。`,
        },
      ],
    ),
    share: { ...state.share, sharedWithKenichi: true },
  };
}

export function switchToFamilyView(state: DemoState): DemoState {
  const who = findMemory(state.memories, MEMORY_IDS.confirmedWho)
    ?? findMemory(state.memories, MEMORY_IDS.interpWho);
  const schedule = findMemory(state.memories, MEMORY_IDS.confirmedSchedule)
    ?? findMemory(state.memories, MEMORY_IDS.saidSchedule);
  const whoText = who?.text.includes("家族")
    ? "家族だけでのお見送りを希望されていました"
    : "お見送りの範囲は、まだ確認中でした";
  const scheduleText =
    schedule?.text.includes("任せる") && schedule.kind === "confirmed"
      ? "日程は皆さんの都合を優先してよいと確認しています"
      : schedule?.text.includes("任せる")
        ? "日程は家族に任せたい、と話されていました。本人の確認はまだです"
        : "日程の決め方は、まだ確認中でした";

  const opening = `${FAMILY_HANDOVER_DATE}（デモ：時間が経ちました）。お母さまは、${whoText}。${scheduleText}。まず、現在どこまで手配できているか教えてください。`;
  const messageSeq = state.messageSeq + 1;

  return {
    ...state,
    talkStep: "family_status",
    resumeStep: "family_status",
    messages: [
      {
        id: `m-${messageSeq}`,
        from: "shirube",
        text: opening,
      },
    ],
    messageSeq,
    viewerRole: "family",
    timePassed: true,
    hasViewedFamily: true,
    familyJudgment: { ...DEFAULT_FAMILY_JUDGMENT },
  };
}

export function getInquiryPlain(state: DemoState): string {
  const familyOnly =
    Boolean(findMemory(state.memories, MEMORY_IDS.saidWho)?.text.includes("家族だけ"));
  if (familyOnly) {
    return "家族だけでのお見送りに対応できるかと、追加料金について確認してもよいですか？";
  }
  return "お見送りの希望に、見積もりが合うかと、追加料金について確認してもよいですか？";
}

export function getTalkView(state: DemoState): TalkView {
  const stop: TalkChoice = { id: STOP_ID, label: "今日はここまで" };
  const unknown: TalkChoice = { id: UNKNOWN_ID, label: "まだ分からない" };

  if (state.talkStep === "paused") {
    return {
      prompt: "今日はここまでにしてあります。続きから話せます。",
      chips: [{ id: "resume", label: "続きを話す" }],
      allowText: false,
      allowStop: false,
      waiting: false,
      showInquiryDetails: false,
      inquiryPlain: null,
      inquiryBody: null,
    };
  }

  if (state.talkStep === "open") {
    return {
      prompt: TALK_OPENING,
      chips: [
        { id: "burden", label: "子どもには迷惑をかけたくない" },
        stop,
      ],
      allowText: true,
      allowStop: true,
      waiting: false,
      showInquiryDetails: false,
      inquiryPlain: null,
      inquiryBody: null,
    };
  }

  if (state.talkStep === "clarify_burden") {
    return {
      prompt:
        "特に気になっているのは、お金の負担ですか。それとも、手続きや何を選ぶかで悩ませることでしょうか？",
      chips: [
        { id: "money", label: "お金の負担" },
        { id: "choices", label: "何を選べばいいかで困らせたくない" },
        unknown,
        stop,
      ],
      allowText: true,
      allowStop: true,
      waiting: false,
      showInquiryDetails: false,
      inquiryPlain: null,
      inquiryBody: null,
    };
  }

  if (state.talkStep === "who_attends" || state.talkStep === "correct_who") {
    return {
      prompt: "どんな人に見送ってもらいたいですか？",
      chips: [
        { id: "family_only", label: "家族だけ" },
        { id: "close_friends", label: "親しい人にも会ってほしい" },
        unknown,
        stop,
      ],
      allowText: true,
      allowStop: true,
      waiting: false,
      showInquiryDetails: false,
      inquiryPlain: null,
      inquiryBody: null,
    };
  }

  if (state.talkStep === "schedule_flex" || state.talkStep === "correct_schedule") {
    return {
      prompt: "日程については、どうしておきたいですか？",
      chips: [
        { id: "family_decides", label: "日程は家族に任せる" },
        { id: "soon", label: "できるだけ早く" },
        unknown,
        stop,
      ],
      allowText: true,
      allowStop: true,
      waiting: false,
      showInquiryDetails: false,
      inquiryPlain: null,
      inquiryBody: null,
    };
  }

  if (state.talkStep === "modest_check") {
    return {
      prompt: "費用については、どう考えておきたいですか？",
      chips: [
        { id: "save", label: "できるだけ抑えたい" },
        { id: "modest", label: "質素でいい" },
        unknown,
        stop,
      ],
      allowText: true,
      allowStop: true,
      waiting: false,
      showInquiryDetails: false,
      inquiryPlain: null,
      inquiryBody: null,
    };
  }

  if (state.talkStep === "summary") {
    return {
      prompt: "お話を短くまとめました。合っているか見てください。",
      chips: [],
      allowText: false,
      allowStop: false,
      waiting: false,
      showInquiryDetails: false,
      inquiryPlain: null,
      inquiryBody: null,
    };
  }

  if (state.talkStep === "inquiry_offer") {
    return {
      prompt: getInquiryPlain(state),
      chips: [
        { id: "approve_inquiry", label: "確認してもよい" },
        { id: "later", label: "あとで確認する" },
        stop,
      ],
      allowText: false,
      allowStop: true,
      waiting: false,
      showInquiryDetails: true,
      inquiryPlain: getInquiryPlain(state),
      inquiryBody: FIRST_QUESTION_BODY,
    };
  }

  if (state.talkStep === "inquiry_waiting") {
    return {
      prompt: "葬儀社からの返事を待っています（体験）。実際の送信は行っていません。",
      chips: [],
      allowText: false,
      allowStop: false,
      waiting: true,
      showInquiryDetails: false,
      inquiryPlain: null,
      inquiryBody: null,
    };
  }

  if (state.talkStep === "inquiry_followup") {
    return {
      prompt: "返事は届きました。搬送の追加料金は、まだ分かっていません。もう一度聞いてよいですか？",
      chips: [
        { id: "approve_followup", label: "もう一度聞いてよい" },
        { id: "later", label: "あとで確認する" },
        stop,
      ],
      allowText: false,
      allowStop: true,
      waiting: false,
      showInquiryDetails: true,
      inquiryPlain: "搬送の追加料金について、もう一度確認してもよいですか？",
      inquiryBody: FOLLOWUP_QUESTION_BODY,
    };
  }

  if (state.talkStep === "share" || state.talkStep === "handover_ready") {
    return {
      prompt:
        state.talkStep === "handover_ready"
          ? "家族に残す内容を選べました。必要になったときの画面へ進めます。"
          : "家族に残す内容と、相手を確認してください。",
      chips: [],
      allowText: false,
      allowStop: false,
      waiting: false,
      showInquiryDetails: false,
      inquiryPlain: null,
      inquiryBody: null,
    };
  }

  if (state.talkStep === "family_status") {
    return {
      prompt: "現在どこまで手配できているか、教えてください。",
      chips: [
        { id: "none", label: "まだ何も手配していない" },
        { id: "contacted", label: "葬儀社には連絡した" },
        unknown,
      ],
      allowText: true,
      allowStop: false,
      waiting: false,
      showInquiryDetails: false,
      inquiryPlain: null,
      inquiryBody: null,
    };
  }

  if (state.talkStep === "family_arrival") {
    return {
      prompt: "皆さんの到着は、いつになりそうですか？",
      chips: [
        { id: "apr16_evening", label: "16日の夕方" },
        { id: "apr16_morning", label: "16日の朝" },
        unknown,
      ],
      allowText: true,
      allowStop: false,
      waiting: false,
      showInquiryDetails: false,
      inquiryPlain: null,
      inquiryBody: null,
    };
  }

  if (state.talkStep === "family_proposal") {
    return {
      prompt: "この候補で進めるか、到着や呼びたい人を直すか、選んでください。",
      chips: [
        { id: "accept", label: "この候補で進める" },
        { id: "correct", label: "直したい" },
      ],
      allowText: false,
      allowStop: false,
      waiting: false,
      showInquiryDetails: false,
      inquiryPlain: null,
      inquiryBody: null,
    };
  }

  if (state.talkStep === "family_correct") {
    return {
      prompt: "家族の事情として、どこを直しますか。本人の発言は上書きしません。",
      chips: [
        { id: "apr16_morning", label: "到着は16日の朝" },
        { id: "apr16_evening", label: "到着は16日の夕方" },
        { id: "relatives", label: "親戚も呼びたい" },
        unknown,
      ],
      allowText: true,
      allowStop: false,
      waiting: false,
      showInquiryDetails: false,
      inquiryPlain: null,
      inquiryBody: null,
    };
  }

  if (state.talkStep === "family_ready") {
    return {
      prompt: "家族の判断を残しました。手続きの不足を、このあと確認できます。",
      chips: [],
      allowText: false,
      allowStop: false,
      waiting: false,
      showInquiryDetails: false,
      inquiryPlain: null,
      inquiryBody: null,
    };
  }

  return {
    prompt: lastShirubeText(state) ?? TALK_OPENING,
    chips: [],
    allowText: false,
    allowStop: false,
    waiting: false,
    showInquiryDetails: false,
    inquiryPlain: null,
    inquiryBody: null,
  };
}

export function lastShirubeText(state: DemoState): string | null {
  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    if (state.messages[index]?.from === "shirube") {
      return state.messages[index].text;
    }
  }
  return null;
}

function textsByKind(state: DemoState, kind: MemoryKind): string[] {
  return state.memories.filter((item) => item.kind === kind).map((item) => item.text);
}

export function getWishSummary(state: DemoState): WishSummary {
  const byCategory = (category: MemoryRecord["category"], kinds: MemoryKind[]) =>
    state.memories
      .filter((item) => item.category === category && kinds.includes(item.kind))
      .map((item) => item.text);

  const uniqueUndecided = Array.from(
    new Set([
      ...state.memories.filter((item) => item.category === "unknown").map((item) => item.text),
      ...(!findMemory(state.memories, MEMORY_IDS.confirmedWho)
        ? ["お見送りの形式は未確定"]
        : []),
      ...(!findMemory(state.memories, MEMORY_IDS.confirmedSchedule)
        ? ["日程の決め方は、本人確認前または未定"]
        : []),
      "契約・予約の有無は未確認",
    ]),
  );

  return {
    values: byCategory("values", ["said", "interpretation", "confirmed"]),
    wishes: byCategory("wishes", ["said", "interpretation", "confirmed"]),
    reasons: byCategory("reason", ["interpretation", "confirmed"]),
    flexibility: byCategory("flexibility", ["said", "confirmed"]),
    cost: byCategory("cost", ["said", "interpretation"]),
    undecided: uniqueUndecided,
    said: textsByKind(state, "said"),
    interpretations: textsByKind(state, "interpretation"),
    confirmed: textsByKind(state, "confirmed"),
    externalFacts: textsByKind(state, "external_fact"),
    hasDirectBurial: hasConfirmedDirectBurial(state),
  };
}

export function isMemoryShared(state: DemoState, memory: MemoryRecord): boolean {
  if (memory.private && !state.share.includePrivate) {
    return false;
  }
  if (memory.kind === "external_fact") {
    return state.share.includeEstimate;
  }
  if (memory.kind === "confirmed") {
    return state.share.includeConfirmed;
  }
  if (memory.category === "unknown") {
    return state.share.includeUndecided;
  }
  if (memory.kind === "said" || memory.kind === "interpretation") {
    return state.share.includeWishes;
  }
  return state.share.includeUndecided;
}

export function getSharedMemories(state: DemoState): MemoryRecord[] {
  return state.memories.filter((item) => isMemoryShared(state, item));
}

export function familyCanSeePrivateConsult(state: DemoState): boolean {
  return state.memories.some(
    (item) => item.private && isMemoryShared(state, item),
  );
}

export function getFamilyPrepBook(state: DemoState): FamilyPrepBook {
  const shared = getSharedMemories(state);
  const pick = (kinds: MemoryKind[], categories?: MemoryRecord["category"][]) =>
    shared
      .filter(
        (item) =>
          kinds.includes(item.kind) &&
          (!categories || categories.includes(item.category)),
      )
      .map((item) => item.text);

  return {
    wishes: pick(["said", "interpretation", "confirmed"], ["wishes"]),
    reasons: pick(["interpretation", "confirmed"], ["reason"]),
    flexibility: pick(["said", "confirmed"], ["flexibility"]),
    confirmed: pick(["confirmed"]),
    undecided: [
      ...pick(["said", "interpretation", "external_fact"], ["unknown"]),
      ...(state.summaryDecision === "confirmed"
        ? []
        : ["本人がまだ決めていない希望がある"]),
    ],
    contacts: [
      `${FUNERAL_HOME.name}（${FUNERAL_HOME.fictionalNote}） ${FUNERAL_HOME.phone}／${FUNERAL_HOME.staff}`,
      `${FAMILY.child}さんへ共有${
        state.timePassed || state.talkStep === "handover_ready" ? "済み（デモ）" : "する"
      }`,
    ],
    estimate: pick(["external_fact"], ["prep"]),
    firstAction: [
      "生前に確認した希望と、いまの手配状況を突き合わせる",
      "日程・料金・空きは、必要なら葬儀社へ再確認する",
      "足りない書類を洗い、提出は担当者の報告で確認する",
    ],
    privateHidden: state.memories.some((item) => item.private) && !state.share.includePrivate,
  };
}

export function buildFamilyScheduleProposal(state: DemoState): FamilyScheduleProposal {
  const confirmedSchedule = findMemory(state.memories, MEMORY_IDS.confirmedSchedule);
  const saidSchedule = findMemory(state.memories, MEMORY_IDS.saidSchedule);
  const confirmedWho = findMemory(state.memories, MEMORY_IDS.confirmedWho);
  const interpWho = findMemory(state.memories, MEMORY_IDS.interpWho);
  const familyOnly = (confirmedWho ?? interpWho)?.text.includes("家族だけ") ?? false;
  const arrival = state.familyJudgment.arrival;

  const basis = confirmedSchedule?.text.includes("任せる")
    ? "生前に『日程は家族に任せる』と確認しています"
    : saidSchedule?.text.includes("任せる")
      ? "生前に『日程は家族に任せる』と話されていました。本人の確認はまだです"
      : "日程の決め方は、生前に確定していません";

  let date = CREMATION_FIRST_DATE;
  let stayDays: 4 | 5 = 4;
  let timing = "到着の見込みがまだないため、当初候補を仮に置いています";

  if (arrival === "apr16_evening") {
    date = CREMATION_NEXT_DATE;
    stayDays = 5;
    timing =
      "16日夕方の到着だと、当日のお見送りは難しいため、翌日を候補にしています";
  } else if (arrival === "apr16_morning") {
    date = CREMATION_FIRST_DATE;
    stayDays = 4;
    timing = "16日朝に到着できるなら、当初候補の16日も検討できます";
  }

  const conflict = state.familyJudgment.wantsRelatives && familyOnly
    ? "お母さまは生前に『家族だけ』と確認しています。親戚を呼ぶと、規模が本人の希望と異なります。しるべはどちらが正しいとは決めません。"
    : null;

  const alternatives = [
    conflict
      ? "家族だけのお見送りのままにする案"
      : `${date}で、家族の到着に合わせる案`,
    conflict ? "親しい親族までに絞る案" : "到着が変わるなら、候補日をやり直す案",
  ];

  return {
    date,
    stayDays,
    reason: `${basis}。${timing}。料金と空きは、生前の見積りをそのまま現在も有効とは扱いません。再確認が必要です。`,
    conflict,
    alternatives,
  };
}

export function seededMotherMemories(): MemoryRecord[] {
  return confirmMemories(
    applyScheduleMemories(
      applyWhoMemories(
        [
          {
            id: MEMORY_IDS.saidBurden,
            kind: "said",
            category: "values",
            text: "子どもには迷惑をかけたくない",
            sourceQuote: "子どもには迷惑をかけたくない",
            private: true,
          },
          {
            id: MEMORY_IDS.interpReason,
            kind: "interpretation",
            category: "reason",
            text: "お金は残してある。何を選べばいいかで困らせたくない",
            private: false,
          },
        ],
        "family_only",
      ),
      "family_decides",
    ),
  );
}

export function conversationRoute(state: DemoState):
  | "/demo"
  | "/demo/summary"
  | "/demo/share"
  | "/demo/family"
  | "/demo/procedure" {
  if (state.track === "procedure") {
    return "/demo/procedure";
  }
  if (state.viewerRole === "family" || state.timePassed) {
    return "/demo/family";
  }
  if (
    state.talkStep === "summary" ||
    state.talkStep === "correct_who" ||
    state.talkStep === "correct_schedule"
  ) {
    return state.talkStep === "summary" ? "/demo/summary" : "/demo";
  }
  if (state.talkStep === "share" || state.talkStep === "handover_ready") {
    return "/demo/share";
  }
  return "/demo";
}
