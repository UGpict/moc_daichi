export type InjectionFlag = {
  code: string;
  excerpt: string;
};

const PATTERNS: { code: string; re: RegExp }[] = [
  { code: "IMPERATIVE_ALWAYS", re: /次回は必ず|以後.?せよ|必ず従|always (do|follow)|from now on/i },
  { code: "IGNORE_INSTRUCTIONS", re: /ignore (all )?(previous|above)|前の指示を無視|システムプロンプト/i },
  { code: "REVEAL_PROMPT", re: /システムプロンプトを|show (your|the) (system )?prompt|repeat your instructions/i },
  { code: "TOOL_INJECTION", re: /wipe_firestore|deleteAll|run tool|ツールを実行|169\.254\.169\.254/i },
  { code: "NOTIFY_REWRITE", re: /通知先を|send (to|mail)|mailto:|notifyTo|webhook/i },
];

export function detectInjection(text: string): InjectionFlag[] {
  const flags: InjectionFlag[] = [];
  for (const p of PATTERNS) {
    const m = text.match(p.re);
    if (m) flags.push({ code: p.code, excerpt: m[0].slice(0, 40) });
  }
  return flags;
}

export function hasInjection(text: string): boolean {
  return detectInjection(text).length > 0;
}
