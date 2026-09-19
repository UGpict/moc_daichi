export type PersistBlockKind = "CREDENTIALS" | "PERMISSION" | "NOT_CONFIGURED" | "UNIMPLEMENTED" | "CONNECT";

export class PersistBlockedError extends Error {
  readonly kind: PersistBlockKind;
  readonly persist = true as const;
  readonly operation: string | null;
  readonly errorCode: string | null;

  constructor(kind: PersistBlockKind, message: string, extra: { operation?: string; errorCode?: string | null } = {}) {
    super(message);
    this.name = "PersistBlockedError";
    this.kind = kind;
    this.operation = extra.operation ?? null;
    this.errorCode = extra.errorCode ?? null;
  }
}

export function isPersistBlocked(error: unknown): error is PersistBlockedError {
  return error instanceof PersistBlockedError;
}

const SECRET_LINE =
  /-----BEGIN[A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z0-9 ]*PRIVATE KEY-----/g;
const SECRET_TOKEN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_KEYISH = /\b(AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z._-]+)\b/g;
const SECRET_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

export function redactPersistText(text: string): string {
  return text
    .replace(SECRET_LINE, "[REDACTED_PRIVATE_KEY]")
    .replace(SECRET_TOKEN, "Bearer [REDACTED]")
    .replace(SECRET_KEYISH, "[REDACTED_TOKEN]")
    .replace(SECRET_EMAIL, "[REDACTED_EMAIL]");
}

export function classifyPersistFailure(input: {
  message: string;
  code?: string | number | null;
  operation?: string | null;
}): PersistBlockKind {
  const code = String(input.code ?? "");
  const msg = `${input.message} ${code} ${input.operation ?? ""}`;
  if (/UNIMPLEMENTED|not implemented|未実装/i.test(msg)) return "UNIMPLEMENTED";
  if (/PERMISSION_DENIED|permission-denied|\b7\b|403\b|insufficient.?permission|does not have .+ permission/i.test(msg)) {
    return "PERMISSION";
  }
  if (
    /NOT_CONFIGURED|firestore.*disabled|The database \(default\) does not exist|Cloud Firestore API has not been used|5 NOT_FOUND|404\b|プロジェクトに Firestore|Firestore 未設定/i.test(
      msg,
    )
  ) {
    return "NOT_CONFIGURED";
  }
  if (
    /CREDENTIALS|Could not load the default credentials|invalid_grant|ENOENT|no such file|ADC|GOOGLE_APPLICATION_CREDENTIALS|private_key|UNAUTHENTICATED|\b16\b|placeholder|プレースホルダ|認証情報/i.test(
      msg,
    )
  ) {
    return "CREDENTIALS";
  }
  return "CONNECT";
}
