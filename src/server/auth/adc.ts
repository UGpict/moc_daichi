import { existsSync } from "node:fs";

const PLACEHOLDER = /\/path\/to\/|path\/to\/service-account\.json/;

export function isPlaceholderAdcPath(path: string): boolean {
  return path === "/path/to/service-account.json" || path === "path/to/service-account.json" || PLACEHOLDER.test(path);
}

/**
 * 仮パスや存在しないファイルを GOOGLE_APPLICATION_CREDENTIALS から外す。
 * applicationDefault() がユーザー ADC（gcloud auth application-default login）を使えるようにする。
 * サービスアカウント JSON の必須チェックはしない。
 */
export function stripPlaceholderAdc(): { stripped: boolean; reason: string | null } {
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? "";
  if (!gac) return { stripped: false, reason: null };
  if (gac.startsWith("{")) {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return { stripped: true, reason: "GAC に JSON 本文が入っていたので削除した。applicationDefault を使う" };
  }
  if (isPlaceholderAdcPath(gac) || !existsSync(gac)) {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return { stripped: true, reason: "仮の ADC パスまたは欠落ファイルを削除した。applicationDefault を使う" };
  }
  return { stripped: false, reason: null };
}
