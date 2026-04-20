export type PullDiagnosticsGlobalFollowupOutcome = {
  followupId: string;
  generation: number;
  scheduledAtMs: number;
  scheduleReason: string;
  targetDirtyStamp: number | null;
  targetDocVersion: number | null;
  pendingCountAtSchedule: number;
  startedAtMs?: number;
  finishedAtMs?: number;
  executedAtMs?: number;
  firstObservedAtMs?: number;
  firstObservedResultCount?: number;
  firstObservedSource?: string;
  firstObservedAuthoritative?: boolean;
  lastResultCount?: number;
  lastResultSource?: string;
  lastResultAuthoritative?: boolean;
  resolvedAtMs?: number;
  skippedReason?: string;
  resolvedReason?: string;
  supersededBy?: string;
};

type CreatePullDiagnosticsFollowupTrackerInput = {
  cooldownMs: number;
  enforceSinglePendingPerContext?: boolean;
  onAlreadyScheduled?: (input: { contextKey: string; uri: string; dirtyStamp: number | null; reason: string }) => void;
  onCooldownSuppressed?: (input: {
    contextKey: string;
    uri: string;
    dirtyStamp: number | null;
    reason: string;
    cooldownMs: number;
    elapsedMs: number;
  }) => void;
};

export type PullDiagnosticsFollowupTracker = {
  getKey: (contextKey: string, uri: string, dirtyStamp: number | null) => string;
  shouldSchedule: (contextKey: string, uri: string, dirtyStamp: number | null, reason?: string) => boolean;
  setScheduleReason: (contextKey: string, uri: string, dirtyStamp: number | null, reason: string) => void;
  noteTarget: (contextKey: string, uri: string, dirtyStamp: number | null, targetDocVersion: number | null | undefined, targetDirtyStamp?: number | null) => void;
  releaseForRetry: (contextKey: string, uri: string, dirtyStamp: number | null) => void;
  markStarted: (contextKey: string, uri: string | undefined) => void;
  markFinished: (contextKey: string, uri: string | undefined, diagnosticsCount: number, resultSource?: string, resultAuthoritative?: boolean) => void;
  markSkipped: (contextKey: string, uri: string | undefined, skippedReason: string) => void;
  markObservedResponse: (
    contextKey: string,
    uri: string | undefined,
    dirtyStamp: number | null,
    diagnosticsCount: number,
    resultSource?: string,
    resultAuthoritative?: boolean
  ) => void;
  markExecuted: (
    contextKey: string,
    uri: string | undefined,
    dirtyStamp: number | null,
    diagnosticsCount: number,
    resultSource?: string,
    resultAuthoritative?: boolean
  ) => void;
  getOutcome: (contextKey: string, uri: string, dirtyStamp: number | null) => PullDiagnosticsGlobalFollowupOutcome | null;
  hasPendingOrRecent: (contextKey: string, uri: string, dirtyStamp: number | null, recentWindowMs: number) => boolean;
  hasPendingOrRecentForUri: (contextKey: string, uri: string, recentWindowMs: number) => boolean;
  hasPendingForContext: (contextKey: string) => boolean;
  clearPending: (contextKey: string, uri: string | undefined) => void;
  clearPendingForContext: (contextKey: string) => void;
  clearUriState: (contextKey: string, uri: string | undefined) => void;
  clearAll: () => void;
  pendingCount: () => number;
  getRetryCount: (key: string) => number;
  setRetryCount: (key: string, retryCount: number) => void;
};

export function createPullDiagnosticsFollowupTracker(
  input: CreatePullDiagnosticsFollowupTrackerInput
): PullDiagnosticsFollowupTracker {
  const pendingByKey = new Set<string>();
  const lastScheduledAtByKey = new Map<string, number>();
  const lastScheduledAtByUri = new Map<string, number>();
  const outcomeByKey = new Map<string, PullDiagnosticsGlobalFollowupOutcome>();
  const retryCountByKey = new Map<string, number>();
  const generationByUri = new Map<string, number>();
  let followupSequence = 0;

  function getKey(contextKey: string, uri: string, dirtyStamp: number | null): string {
    return `${contextKey}::${uri}::${dirtyStamp ?? -1}`;
  }

  function getUriKey(contextKey: string, uri: string): string {
    return `${contextKey}::${uri}`;
  }

  function shouldSchedule(contextKey: string, uri: string, dirtyStamp: number | null, reason = 'unspecified'): boolean {
    const key = getKey(contextKey, uri, dirtyStamp);
    if (pendingByKey.has(key)) {
      input.onAlreadyScheduled?.({ contextKey, uri, dirtyStamp, reason });
      return false;
    }
    if (input.enforceSinglePendingPerContext) {
      const contextPrefix = `${contextKey}::`;
      for (const pendingKey of pendingByKey) {
        if (!pendingKey.startsWith(contextPrefix)) continue;
        input.onAlreadyScheduled?.({ contextKey, uri, dirtyStamp, reason });
        return false;
      }
    }

    const settled = outcomeByKey.get(key);
    if (
      settled?.resolvedAtMs !== undefined &&
      settled.lastResultAuthoritative &&
      settled.resolvedReason !== 'released_for_retry'
    ) {
      return false;
    }

    const now = Date.now();
    const lastScheduledAt = lastScheduledAtByKey.get(key);
    if (lastScheduledAt !== undefined && (now - lastScheduledAt) < input.cooldownMs) {
      input.onCooldownSuppressed?.({
        contextKey,
        uri,
        dirtyStamp,
        reason,
        cooldownMs: input.cooldownMs,
        elapsedMs: now - lastScheduledAt
      });
      return false;
    }

    pendingByKey.add(key);
    lastScheduledAtByKey.set(key, now);
    const uriKey = getUriKey(contextKey, uri);
    lastScheduledAtByUri.set(uriKey, now);
    const generation = (generationByUri.get(uriKey) ?? 0) + 1;
    generationByUri.set(uriKey, generation);
    outcomeByKey.set(key, {
      followupId: `followup-${++followupSequence}`,
      generation,
      scheduledAtMs: now,
      scheduleReason: reason,
      targetDirtyStamp: dirtyStamp ?? null,
      targetDocVersion: null,
      pendingCountAtSchedule: pendingByKey.size
    });
    return true;
  }

  function setScheduleReason(contextKey: string, uri: string, dirtyStamp: number | null, reason: string): void {
    const key = getKey(contextKey, uri, dirtyStamp);
    const current = outcomeByKey.get(key);
    if (!current) return;
    current.scheduleReason = reason;
    outcomeByKey.set(key, current);
  }

  function noteTarget(
    contextKey: string,
    uri: string,
    dirtyStamp: number | null,
    targetDocVersion: number | null | undefined,
    targetDirtyStamp?: number | null
  ): void {
    const key = getKey(contextKey, uri, dirtyStamp);
    const current = outcomeByKey.get(key);
    if (!current) return;
    current.targetDocVersion = targetDocVersion ?? null;
    current.targetDirtyStamp = targetDirtyStamp ?? dirtyStamp ?? null;
    outcomeByKey.set(key, current);
  }

  function releaseForRetry(contextKey: string, uri: string, dirtyStamp: number | null): void {
    const key = getKey(contextKey, uri, dirtyStamp);
    const current = outcomeByKey.get(key);
    if (current) {
      current.resolvedReason = 'released_for_retry';
      current.supersededBy = 'retry';
      outcomeByKey.set(key, current);
    }
    pendingByKey.delete(key);
    lastScheduledAtByKey.delete(key);
    retryCountByKey.delete(key);
  }

  function mutateOutcomeByUri(
    contextKey: string,
    uri: string | undefined,
    mutate: (current: PullDiagnosticsGlobalFollowupOutcome) => void
  ): void {
    if (!uri) return;
    const prefix = `${contextKey}::${uri}::`;
    let matched = false;
    for (const [key, current] of outcomeByKey.entries()) {
      if (!key.startsWith(prefix)) continue;
      mutate(current);
      outcomeByKey.set(key, current);
      matched = true;
    }
    if (matched) return;
    const fallbackKey = getKey(contextKey, uri, null);
    const fallback = outcomeByKey.get(fallbackKey);
    if (!fallback) return;
    mutate(fallback);
    outcomeByKey.set(fallbackKey, fallback);
  }

  function markStarted(contextKey: string, uri: string | undefined): void {
    const now = Date.now();
    mutateOutcomeByUri(contextKey, uri, (current) => {
      current.startedAtMs = now;
    });
  }

  function markFinished(
    contextKey: string,
    uri: string | undefined,
    diagnosticsCount: number,
    resultSource?: string,
    resultAuthoritative?: boolean
  ): void {
    const now = Date.now();
    mutateOutcomeByUri(contextKey, uri, (current) => {
      current.finishedAtMs = now;
      current.executedAtMs = now;
      current.lastResultCount = diagnosticsCount;
      current.lastResultSource = resultSource;
      current.lastResultAuthoritative = resultAuthoritative;
      if (resultAuthoritative || diagnosticsCount > 0) current.resolvedAtMs = now;
      current.resolvedReason = resultAuthoritative ? 'executed_authoritative' : (diagnosticsCount > 0 ? 'executed_non_empty' : 'executed_no_change');
    });
  }

  function markSkipped(contextKey: string, uri: string | undefined, skippedReason: string): void {
    const now = Date.now();
    mutateOutcomeByUri(contextKey, uri, (current) => {
      current.finishedAtMs = now;
      current.skippedReason = skippedReason;
      current.resolvedReason = `skipped:${skippedReason}`;
    });
  }



  function markObservedResponse(
    contextKey: string,
    uri: string | undefined,
    dirtyStamp: number | null,
    diagnosticsCount: number,
    resultSource?: string,
    resultAuthoritative?: boolean
  ): void {
    if (!uri) return;
    const key = getKey(contextKey, uri, dirtyStamp);
    const current = outcomeByKey.get(key) ?? getLatestOutcome(contextKey, uri);
    if (!current) return;
    const now = Date.now();
    if (current.firstObservedAtMs === undefined) {
      current.firstObservedAtMs = now;
      current.firstObservedResultCount = diagnosticsCount;
      current.firstObservedSource = resultSource;
      current.firstObservedAuthoritative = resultAuthoritative;
    }
    if (resultAuthoritative && current.resolvedAtMs === undefined) {
      current.resolvedAtMs = now;
      current.resolvedReason = 'observed_authoritative';
    }
    outcomeByKey.set(key, current);
  }

  function markExecuted(
    contextKey: string,
    uri: string | undefined,
    dirtyStamp: number | null,
    diagnosticsCount: number,
    resultSource?: string,
    resultAuthoritative?: boolean
  ): void {
    if (!uri) return;
    const key = getKey(contextKey, uri, dirtyStamp);
    const current = outcomeByKey.get(key);
    if (current) {
      const now = Date.now();
      current.finishedAtMs = now;
      current.executedAtMs = now;
      current.lastResultCount = diagnosticsCount;
      current.lastResultSource = resultSource;
      current.lastResultAuthoritative = resultAuthoritative;
      if (resultAuthoritative || diagnosticsCount > 0) current.resolvedAtMs = now;
      current.resolvedReason = resultAuthoritative ? 'executed_authoritative' : (diagnosticsCount > 0 ? 'executed_non_empty' : 'executed_no_change');
      outcomeByKey.set(key, current);
      return;
    }
    markFinished(contextKey, uri, diagnosticsCount, resultSource, resultAuthoritative);
  }

  function getLatestOutcome(contextKey: string, uri: string): PullDiagnosticsGlobalFollowupOutcome | null {
    const prefix = `${contextKey}::${uri}::`;
    let latest: PullDiagnosticsGlobalFollowupOutcome | null = null;
    for (const [key, value] of outcomeByKey.entries()) {
      if (!key.startsWith(prefix)) continue;
      if (!latest || value.scheduledAtMs > latest.scheduledAtMs) latest = value;
    }
    return latest;
  }

  function getOutcome(contextKey: string, uri: string, dirtyStamp: number | null): PullDiagnosticsGlobalFollowupOutcome | null {
    return outcomeByKey.get(getKey(contextKey, uri, dirtyStamp)) ?? getLatestOutcome(contextKey, uri);
  }

  function hasPendingOrRecent(contextKey: string, uri: string, dirtyStamp: number | null, recentWindowMs: number): boolean {
    const key = getKey(contextKey, uri, dirtyStamp);
    if (pendingByKey.has(key)) return true;
    const scheduledAt = lastScheduledAtByKey.get(key);
    return scheduledAt !== undefined && (Date.now() - scheduledAt) <= recentWindowMs;
  }

  function hasPendingOrRecentForUri(contextKey: string, uri: string, recentWindowMs: number): boolean {
    const prefix = `${contextKey}::${uri}::`;
    const now = Date.now();
    for (const pendingKey of pendingByKey) {
      if (pendingKey.startsWith(prefix)) return true;
    }
    const scheduledAt = lastScheduledAtByUri.get(getUriKey(contextKey, uri));
    return scheduledAt !== undefined && (now - scheduledAt) <= recentWindowMs;
  }

  function clearPending(contextKey: string, uri: string | undefined): void {
    if (!uri) return;
    const prefix = `${contextKey}::${uri}::`;
    for (const key of pendingByKey) {
      if (!key.startsWith(prefix)) continue;
      pendingByKey.delete(key);
      lastScheduledAtByKey.delete(key);
      outcomeByKey.delete(key);
      retryCountByKey.delete(key);
    }
  }

  function hasPendingForContext(contextKey: string): boolean {
    const prefix = `${contextKey}::`;
    for (const key of pendingByKey) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  function clearPendingForContext(contextKey: string): void {
    const prefix = `${contextKey}::`;
    for (const key of pendingByKey) {
      if (!key.startsWith(prefix)) continue;
      pendingByKey.delete(key);
      lastScheduledAtByKey.delete(key);
      outcomeByKey.delete(key);
      retryCountByKey.delete(key);
    }
  }

  function clearUriState(contextKey: string, uri: string | undefined): void {
    if (!uri) return;
    const prefix = `${contextKey}::${uri}::`;
    for (const key of Array.from(pendingByKey)) {
      if (!key.startsWith(prefix)) continue;
      pendingByKey.delete(key);
    }
    for (const key of Array.from(lastScheduledAtByKey.keys())) {
      if (!key.startsWith(prefix)) continue;
      lastScheduledAtByKey.delete(key);
    }
    for (const key of Array.from(outcomeByKey.keys())) {
      if (!key.startsWith(prefix)) continue;
      outcomeByKey.delete(key);
    }
    for (const key of Array.from(retryCountByKey.keys())) {
      if (!key.startsWith(prefix)) continue;
      retryCountByKey.delete(key);
    }
    const uriKey = getUriKey(contextKey, uri);
    lastScheduledAtByUri.delete(uriKey);
    generationByUri.delete(uriKey);
  }

  function clearAll(): void {
    pendingByKey.clear();
    lastScheduledAtByKey.clear();
    outcomeByKey.clear();
    retryCountByKey.clear();
  }

  return {
    getKey,
    shouldSchedule,
    setScheduleReason,
    noteTarget,
    releaseForRetry,
    markStarted,
    markFinished,
    markSkipped,
    markObservedResponse,
    markExecuted,
    getOutcome,
    hasPendingOrRecent,
    hasPendingOrRecentForUri,
    hasPendingForContext,
    clearPending,
    clearPendingForContext,
    clearUriState,
    clearAll,
    pendingCount: () => pendingByKey.size,
    getRetryCount: (key: string) => retryCountByKey.get(key) ?? 0,
    setRetryCount: (key: string, retryCount: number) => {
      retryCountByKey.set(key, retryCount);
    }
  };
}
