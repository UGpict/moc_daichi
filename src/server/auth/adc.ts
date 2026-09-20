import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Vercel のクライアント／一部ランタイムでは node:fs が空になる。 */
function pathExists(path: string): boolean {
  try {
    return typeof existsSync === "function" && existsSync(path);
  } catch {
    return false;
  }
}

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
  if (isPlaceholderAdcPath(gac) || !pathExists(gac)) {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return { stripped: true, reason: "仮の ADC パスまたは欠落ファイルを削除した。applicationDefault を使う" };
  }
  return { stripped: false, reason: null };
}

export type AdcRuntimeSource = {
  usable: boolean;
  kind: "gac-file" | "user-adc" | "metadata" | "try-local" | "none";
  detail: string;
};

/** gcloud user ADC の既知パス。無ければ null。 */
export function wellKnownAdcPath(): string | null {
  const custom = process.env.CLOUDSDK_CONFIG?.trim();
  if (custom) {
    const p = join(custom, "application_default_credentials.json");
    if (pathExists(p)) return p;
  }
  const unix = join(homedir(), ".config/gcloud/application_default_credentials.json");
  if (pathExists(unix)) return unix;
  const appData = process.env.APPDATA;
  if (appData) {
    const win = join(appData, "gcloud/application_default_credentials.json");
    if (pathExists(win)) return win;
  }
  return null;
}

/**
 * applicationDefault() の最初の RPC が metadata 待ちで固まる環境を同期で切る。
 * Vercel には user ADC も実行 SA も無い。LIVE は JSON へ落とさない。
 */
export function adcRuntimeSource(): AdcRuntimeSource {
  stripPlaceholderAdc();
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (gac && pathExists(gac)) {
    return { usable: true, kind: "gac-file", detail: "GOOGLE_APPLICATION_CREDENTIALS のファイルがある" };
  }
  if (wellKnownAdcPath()) {
    return { usable: true, kind: "user-adc", detail: "gcloud user ADC がある" };
  }
  if (process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.GAE_ENV) {
    return { usable: true, kind: "metadata", detail: "実行環境のサービスアカウント ADC" };
  }
  if (process.env.VERCEL || process.env.NOW_REGION) {
    return {
      usable: false,
      kind: "none",
      detail:
        "Vercel には user ADC も実行 SA も無い。applicationDefault の metadata 待ちをしない。LIVE は JSON へ落とさない",
    };
  }
  return { usable: true, kind: "try-local", detail: "applicationDefault() で接続する" };
}

export function adcRuntimeUsable(): boolean {
  return adcRuntimeSource().usable;
}
