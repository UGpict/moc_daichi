import { getEnv } from "@/config/env";

export type Pool = "mundane" | "hard";
export type RouteTask =
  | "structure"
  | "candidates"
  | "reflect"
  | "share"
  | "final_plan"
  | "replan"
  | "conflict"
  | "agent_action";

export type RouteDecision = {
  pool: Pool;
  model: string;
  reason: string;
  namedRouterAttempted: boolean;
};

const HARD_TASKS = new Set<RouteTask>(["final_plan", "replan", "conflict"]);

export function decideRoute(args: {
  task: RouteTask;
  inputChars: number;
  previousSchemaFail: boolean;
}): RouteDecision {
  const env = getEnv();
  const named = env.orcaMundaneModel.startsWith("orcarouter/") || env.orcaHardModel.startsWith("orcarouter/");
  if (args.previousSchemaFail || args.inputChars > 6000 || HARD_TASKS.has(args.task)) {
    return {
      pool: "hard",
      model: env.orcaHardModel,
      reason: args.previousSchemaFail
        ? "直前のスキーマ失敗のため hard へエスカレート"
        : args.inputChars > 6000
          ? "入力が大きいため hard"
          : `タスク ${args.task} は最終判断なので hard`,
      namedRouterAttempted: named,
    };
  }
  return {
    pool: "mundane",
    model: env.orcaMundaneModel,
    reason: `タスク ${args.task} は構造化抽出なので mundane`,
    namedRouterAttempted: named,
  };
}
