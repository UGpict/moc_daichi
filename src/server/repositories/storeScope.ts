export type StoreScope = {
  coupleId?: string;
  sessionId?: string;
  runId?: string;
  approvalId?: string;
  memoryId?: string;
  ownerUid?: string;
  idempotencyKey?: string;
  draftId?: string;
  draftsForOwner?: boolean;
  token?: string;
  digestId?: string;
  replayId?: string;
  pendingRun?: boolean;
  demoReset?: boolean;
};

export function scopeIsEmpty(scope: StoreScope | undefined): boolean {
  if (!scope) return true;
  return !(
    scope.coupleId ||
    scope.sessionId ||
    scope.runId ||
    scope.approvalId ||
    scope.memoryId ||
    scope.ownerUid ||
    scope.idempotencyKey ||
    scope.draftId ||
    scope.draftsForOwner ||
    scope.token ||
    scope.digestId ||
    scope.replayId ||
    scope.pendingRun ||
    scope.demoReset
  );
}
