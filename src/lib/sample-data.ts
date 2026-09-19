import type { CheckItemId, CostConditions, DemoState } from "./types";

export const CONFIRMATION_DATE = "2026年4月12日";

export const FUNERAL_HOME = {
  name: "葵セレモニー",
  fictionalNote: "架空の葬儀社です",
  phone: "0120-000-000（架空）",
  staff: "佐藤（仮名）",
};

export const FAMILY = {
  principal: "山田 春子（仮名）",
  child: "山田 健一（仮名）",
};

export const WISHES = {
  style: "家族中心・約20名・一日葬",
  budgetYen: 800_000,
  schedule: "未定",
  values: [
    "家族だけで、あわてずに見送りたい",
    "大きな式より、本人の負担が少ない一日葬にしたい",
    "あとから家族が金額で迷わないよう、条件を残しておきたい",
  ],
};

export const ESTIMATE = {
  title: "一日葬基本プラン",
  quoteNumber: "AOS-2026-0412",
  basePlanYen: 550_000,
  included: [
    "式場使用",
    "棺",
    "骨壺",
    "運営スタッフ",
    "安置2日分",
    "搬送20kmまで",
  ],
  notes: [
    { label: "火葬料", value: "別途" },
    { label: "飲食・返礼品", value: "別途" },
    { label: "宗教者への謝礼", value: "含まない" },
    { label: "安置3日目以降の単価", value: "記載なし" },
    { label: "搬送20km超の単価", value: "記載なし" },
  ],
};

export const DEFAULT_CONDITIONS: CostConditions = {
  stayDays: 4,
  transportKm: 30,
  nightTransport: false,
};

export const DEFAULT_DEMO_STATE: DemoState = {
  version: 1,
  inquiryStatus: "awaiting_approval",
  conditions: DEFAULT_CONDITIONS,
  hasReviewedEstimate: false,
  hasViewedFamily: false,
  firstReplyDueAt: null,
  followupReplyDueAt: null,
};

export const REPLY_DELAY_MS = 1000;

export const FIRST_QUESTIONS = [
  "安置が3日目以降になった場合、1日あたりの費用を教えてください。",
  "搬送が20kmを超えた場合の追加費用を教えてください。",
  "火葬料の想定額を教えてください。",
  "会葬者20名分の飲食・返礼品の想定額を教えてください。",
];

export const FIRST_QUESTION_BODY = [
  "お世話になっております。一日葬基本プランの見積もりについて、追加費用の条件を確認させてください。",
  "",
  ...FIRST_QUESTIONS.map((question, index) => `${index + 1}. ${question}`),
].join("\n");

export const FIRST_REPLY_BODY =
  "安置延長は1日11,000円（税込）です。火葬料は今回の想定では12,000円、飲食・返礼品は20名で110,000円（税込）です。搬送の追加料金は距離や状況により異なります。";

export const FOLLOWUP_QUESTION_BODY =
  "20kmを超える場合の単価と、夜間などの加算条件を教えてください。";

export const FOLLOWUP_REPLY_BODY =
  "20km超は10kmごとに5,500円（税込、端数切上げ）、夜間搬送は別途11,000円（税込）です。";

export const CHECK_ITEMS: {
  id: CheckItemId;
  title: string;
  quote: string;
  why: string;
}[] = [
  {
    id: "stay",
    title: "安置延長の1日あたりの費用",
    quote: "安置3日目以降の単価：記載なし",
    why: "基本プランは安置2日分までです。日程が延びたときの追加額を、先に知っておく必要があります。",
  },
  {
    id: "transport",
    title: "搬送距離を超えた場合の費用",
    quote: "搬送20km超の単価：記載なし",
    why: "出発地が20kmを超えると追加料金が発生する可能性があります。単価が分からないと、参考額を出せません。",
  },
  {
    id: "cremation",
    title: "火葬料の想定",
    quote: "火葬料：別途",
    why: "火葬料は基本プランに含まれていません。施設によって額が変わるため、今回の想定を確認します。",
  },
  {
    id: "food",
    title: "20名分の飲食・返礼品の想定",
    quote: "飲食・返礼品：別途",
    why: "家族中心の一日葬でも、飲食と返礼品は別費用になることが一般的です。",
  },
];

export const EXCLUDED_COSTS = [
  "宗教者への謝礼",
  "死亡診断書など、役所手続きの費用",
  "お墓・永代供養",
  "会葬者が増えた場合の追加の飲食・返礼品",
];

export const UNDECIDED_ITEMS = [
  "葬儀の日程",
  "搬送の出発地（距離は仮定です）",
  "宗教儀礼を行うかどうか",
];

export const FAMILY_FIRST_STEPS = [
  "この準備書を家族で読み合わせる",
  "日程が見えたら、葵セレモニー（架空）に空きと最新の料金を確認する",
  "実際の安置日数と搬送距離で、参考額を見直す",
];
