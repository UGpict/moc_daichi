export type PersistBlockKind = "CREDENTIALS" | "UNIMPLEMENTED" | "CONNECT";

export class PersistBlockedError extends Error {
  readonly kind: PersistBlockKind;
  readonly persist = true as const;

  constructor(kind: PersistBlockKind, message: string) {
    super(message);
    this.name = "PersistBlockedError";
    this.kind = kind;
  }
}

export function isPersistBlocked(error: unknown): error is PersistBlockedError {
  return error instanceof PersistBlockedError;
}
