import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const PLACEHOLDER = /\/path\/to\/|path\/to\/service-account\.json/;
const DEFAULT_ADC_FILE = "/tmp/futari-adc.json";

export type AdcMaterializeResult = {
  ok: boolean;
  source: "file" | "FIREBASE_SERVICE_ACCOUNT_JSON" | "GOOGLE_APPLICATION_CREDENTIALS_JSON" | "placeholder" | "none";
  path: string | null;
  detail: string;
};

let lastResult: AdcMaterializeResult | null = null;

export function lastAdcMaterialize(): AdcMaterializeResult | null {
  return lastResult;
}

export function adcMaterializePath(): string {
  return process.env.FUTARI_ADC_PATH?.trim() || DEFAULT_ADC_FILE;
}

function looksLikeJsonObject(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}");
}

function isPlaceholderPath(path: string): boolean {
  return path === "/path/to/service-account.json" || path === "path/to/service-account.json" || PLACEHOLDER.test(path);
}

/** 本文・PEM・メールは返さない。 */
export function validateServiceAccountJson(raw: string): { ok: true } | { ok: false; reason: string } {
  try {
    const parsed = JSON.parse(raw) as { type?: unknown; private_key?: unknown };
    if (parsed.type !== "service_account") {
      return { ok: false, reason: "ADC JSON の type が service_account ではない" };
    }
    if (typeof parsed.private_key !== "string" || !parsed.private_key.includes("BEGIN PRIVATE KEY")) {
      return { ok: false, reason: "ADC JSON に PEM 形式の private_key が無い" };
    }
    if (/PLACEHOLDER|changeme|FIXME|YOUR_/i.test(raw)) {
      return { ok: false, reason: "ADC JSON がプレースホルダ" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "ADC JSON をパースできない" };
  }
}

function materializeJson(raw: string, source: AdcMaterializeResult["source"]): AdcMaterializeResult {
  const valid = validateServiceAccountJson(raw);
  if (!valid.ok) {
    lastResult = { ok: false, source, path: null, detail: valid.reason };
    return lastResult;
  }
  const dest = adcMaterializePath();
  writeFileSync(dest, raw, { encoding: "utf8", mode: 0o600 });
  chmodSync(dest, 0o600);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = dest;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  lastResult = {
    ok: true,
    source,
    path: dest,
    detail: `ADC を ${basename(dest)} に mode 0600 で展開した`,
  };
  return lastResult;
}

/**
 * Runtime Secret の JSON 本文を一時ファイルへ落とす。
 * 本文はログに出さない。展開後は環境変数の JSON を消す。
 */
export function materializeAdcFromEnv(): AdcMaterializeResult {
  const jsonSecret = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ?? "";
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? "";

  if (jsonSecret && looksLikeJsonObject(jsonSecret)) {
    return materializeJson(jsonSecret, "FIREBASE_SERVICE_ACCOUNT_JSON");
  }
  if (gac && looksLikeJsonObject(gac)) {
    return materializeJson(gac, "GOOGLE_APPLICATION_CREDENTIALS_JSON");
  }
  if (gac && !isPlaceholderPath(gac) && existsSync(gac)) {
    lastResult = { ok: true, source: "file", path: gac, detail: "ADC ファイルパスを使用" };
    return lastResult;
  }
  if (gac && isPlaceholderPath(gac)) {
    lastResult = {
      ok: false,
      source: "placeholder",
      path: gac,
      detail: "GOOGLE_APPLICATION_CREDENTIALS がプレースホルダ。Runtime Secret FIREBASE_SERVICE_ACCOUNT_JSON を使う",
    };
    return lastResult;
  }
  if (gac) {
    lastResult = {
      ok: false,
      source: "none",
      path: gac,
      detail: "ADC ファイルが存在しない",
    };
    return lastResult;
  }
  lastResult = {
    ok: false,
    source: "none",
    path: null,
    detail: "FIREBASE_SERVICE_ACCOUNT_JSON も GOOGLE_APPLICATION_CREDENTIALS も無い",
  };
  return lastResult;
}
