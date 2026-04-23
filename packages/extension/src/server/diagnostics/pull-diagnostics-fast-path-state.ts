import { performance } from 'node:perf_hooks';

export type VisiblePullDiagnosticsState = {
  resultId: string;
  hash: string;
  docVersion: number | null;
  dirtyStamp: number | null;
  contextKey: string | null;
  authoritative: boolean;
  reportedAtMs: number;
};

type ProjectedPrefixReuseTrace = {
  resultId: string;
  firstServedAtMs: number;
  lastServedAtMs: number;
  reuseCount: number;
  baseDocVersion: number | null;
  currentDocVersion: number | null;
};

type StickyFastPathTrace = {
  resultId: string;
  firstServedAtMs: number;
  lastServedAtMs: number;
  reuseCount: number;
  lastDocVersion: number | null;
};

export function createPullDiagnosticsFastPathState() {
  const lastVisibleByUri = new Map<string, VisiblePullDiagnosticsState>();
  const projectedPrefixReuseTraceByUri = new Map<string, ProjectedPrefixReuseTrace>();
  const stickyFastPathTraceByUri = new Map<string, StickyFastPathTrace>();

  function getVisibleState(uri: string): VisiblePullDiagnosticsState | null {
    return lastVisibleByUri.get(uri) ?? null;
  }

  function getFastPathVisibleState(input: {
    uri: string;
    contextKey: string | null;
    docVersion: number | undefined;
    dirtyStamp: number | null;
    previousResultId: string | undefined;
    hasRecentEditBurst: boolean;
    stickyEditWindowMs: number;
  }): VisiblePullDiagnosticsState | null {
    if (!input.previousResultId) return null;
    if (!input.hasRecentEditBurst) return null;
    const visible = lastVisibleByUri.get(input.uri);
    if (!visible) return null;
    if ((performance.now() - visible.reportedAtMs) > input.stickyEditWindowMs) return null;
    if (visible.resultId !== input.previousResultId) return null;
    if (input.contextKey !== null && visible.contextKey !== null && visible.contextKey !== input.contextKey) return null;
    if (input.docVersion !== undefined && visible.docVersion !== null && visible.docVersion !== input.docVersion) return null;
    if (input.dirtyStamp !== null && visible.dirtyStamp !== null && visible.dirtyStamp !== input.dirtyStamp) return null;
    return visible;
  }

  function getProjectedPrefixReuseTrace(uri: string): ProjectedPrefixReuseTrace | null {
    return projectedPrefixReuseTraceByUri.get(uri) ?? null;
  }

  function getResultVersion(resultId: string | undefined): number | null {
    if (typeof resultId !== 'string') return null;
    const sep = resultId.indexOf(':');
    if (sep <= 0) return null;
    const raw = Number(resultId.slice(0, sep));
    return Number.isFinite(raw) ? raw : null;
  }

  function updateProjectedPrefixReuseTrace(input: {
    uri?: string;
    resultId?: string;
    docVersion?: number;
    authorityLevel: 'authoritative' | 'projected' | 'non_authoritative';
    stalenessReason: string | null;
    hasRecentEditBurst: boolean;
  }): {
    reuseCount: number | null;
    firstServedAtMs: number | null;
    lastServedAtMs: number | null;
    ttlMs: number | null;
    expired: boolean;
    expiryReason: string | null;
    baseResultId: string | null;
    baseDocVersion: number | null;
    currentDocVersion: number | null;
  } {
    if (!input.uri) {
      return { reuseCount: null, firstServedAtMs: null, lastServedAtMs: null, ttlMs: null, expired: false, expiryReason: null, baseResultId: null, baseDocVersion: null, currentDocVersion: input.docVersion ?? null };
    }
    const now = Date.now();
    const shouldTrack = input.authorityLevel === 'projected' && input.stalenessReason === 'prefix_result' && typeof input.resultId === 'string';
    if (!shouldTrack) {
      projectedPrefixReuseTraceByUri.delete(input.uri);
      return { reuseCount: null, firstServedAtMs: null, lastServedAtMs: null, ttlMs: null, expired: false, expiryReason: null, baseResultId: null, baseDocVersion: null, currentDocVersion: input.docVersion ?? null };
    }
    const existing = projectedPrefixReuseTraceByUri.get(input.uri);
    const trackedResultId = input.resultId as string;
    let traceState: ProjectedPrefixReuseTrace;
    if (!existing || existing.resultId !== trackedResultId) {
      traceState = {
        resultId: trackedResultId,
        firstServedAtMs: now,
        lastServedAtMs: now,
        reuseCount: 1,
        baseDocVersion: getResultVersion(trackedResultId),
        currentDocVersion: input.docVersion ?? null
      };
    } else {
      traceState = {
        ...existing,
        lastServedAtMs: now,
        reuseCount: existing.reuseCount + 1,
        currentDocVersion: input.docVersion ?? existing.currentDocVersion ?? null
      };
    }
    projectedPrefixReuseTraceByUri.set(input.uri, traceState);
    const expired = typeof traceState.currentDocVersion === 'number' && typeof traceState.baseDocVersion === 'number'
      ? traceState.currentDocVersion > traceState.baseDocVersion && !input.hasRecentEditBurst
      : false;
    const expiryReason = expired ? 'doc_version_advanced' : null;
    return {
      reuseCount: traceState.reuseCount,
      firstServedAtMs: traceState.firstServedAtMs,
      lastServedAtMs: traceState.lastServedAtMs,
      ttlMs: Math.max(0, traceState.lastServedAtMs - traceState.firstServedAtMs),
      expired,
      expiryReason,
      baseResultId: traceState.resultId,
      baseDocVersion: traceState.baseDocVersion,
      currentDocVersion: traceState.currentDocVersion
    };
  }

  function getStickyFastPathTrace(uri: string, resultId: string): { reuseCount: number; ttlMs: number; lastDocVersion: number | null } {
    const trace = stickyFastPathTraceByUri.get(uri);
    if (!trace || trace.resultId !== resultId) return { reuseCount: 0, ttlMs: 0, lastDocVersion: null };
    return {
      reuseCount: trace.reuseCount,
      ttlMs: Math.max(0, trace.lastServedAtMs - trace.firstServedAtMs),
      lastDocVersion: trace.lastDocVersion ?? null
    };
  }

  function noteStickyFastPathReuse(uri: string, resultId: string, docVersion: number | undefined): void {
    const now = Date.now();
    const existing = stickyFastPathTraceByUri.get(uri);
    if (!existing || existing.resultId !== resultId) {
      stickyFastPathTraceByUri.set(uri, {
        resultId,
        firstServedAtMs: now,
        lastServedAtMs: now,
        reuseCount: 1,
        lastDocVersion: docVersion ?? null
      });
      return;
    }
    stickyFastPathTraceByUri.set(uri, {
      ...existing,
      lastServedAtMs: now,
      reuseCount: existing.reuseCount + 1,
      lastDocVersion: docVersion ?? existing.lastDocVersion ?? null
    });
  }

  function clearStickyFastPathReuse(uri: string, resultId?: string): void {
    const existing = stickyFastPathTraceByUri.get(uri);
    if (!existing) return;
    if (resultId && existing.resultId !== resultId) return;
    stickyFastPathTraceByUri.delete(uri);
  }

  function shouldUseStickyFastPath(input: {
    uri: string;
    resultId: string;
    docVersion: number | undefined;
    withinFormatOrUndoWindow: boolean;
  }): boolean {
    const trace = getStickyFastPathTrace(input.uri, input.resultId);
    if (trace.lastDocVersion !== null && typeof input.docVersion === 'number' && input.docVersion > trace.lastDocVersion + 1) return false;
    if (input.withinFormatOrUndoWindow) {
      if (trace.reuseCount >= 2) return false;
      if (trace.ttlMs >= 220) return false;
      return true;
    }
    if (trace.reuseCount >= 1) return false;
    if (trace.ttlMs >= 120) return false;
    return true;
  }

  function shouldExpireProjectedPrefixReuse(input: {
    uri: string;
    docVersion: number | undefined;
    resultId: string | undefined;
    source: 'public-api' | 'context-projected' | 'fallback-compile' | 'boot-empty' | 'persisted-cache';
    isPrefix: boolean;
    isAuthoritative: boolean;
    hasRecentEditBurst: boolean;
    withinFormatOrUndoWindow: boolean;
  }): boolean {
    if (input.isAuthoritative) return false;
    if (!input.isPrefix) return false;
    if (input.source !== 'context-projected' && input.source !== 'fallback-compile') return false;
    if (typeof input.docVersion !== 'number') return false;
    const resultVersion = getResultVersion(input.resultId);
    if (resultVersion === null) return false;
    if (!(input.docVersion > resultVersion)) return false;

    const projectedTrace = getProjectedPrefixReuseTrace(input.uri);
    const projectedReuseCount = projectedTrace?.resultId === input.resultId ? (projectedTrace?.reuseCount ?? 0) : 0;
    const projectedTtlMs = projectedTrace?.resultId === input.resultId
      ? Math.max(0, (projectedTrace?.lastServedAtMs ?? 0) - (projectedTrace?.firstServedAtMs ?? 0))
      : 0;
    const docVersionDistance = input.docVersion - resultVersion;

    if (!input.hasRecentEditBurst) return true;
    if (docVersionDistance >= 2) return true;
    if (input.withinFormatOrUndoWindow && (projectedReuseCount >= 2 || projectedTtlMs >= 150)) return true;
    if (projectedReuseCount >= 3) return true;
    if (projectedTtlMs >= 300) return true;
    return false;
  }

  function rememberVisibleState(input: {
    uri: string;
    resultId: string;
    hash: string;
    docVersion: number | null | undefined;
    dirtyStamp: number | null;
    contextKey: string | null;
    authoritative: boolean;
  }): void {
    const previous = lastVisibleByUri.get(input.uri);
    if (!previous || previous.resultId !== input.resultId || input.authoritative) {
      clearStickyFastPathReuse(input.uri);
    }
    lastVisibleByUri.set(input.uri, {
      resultId: input.resultId,
      hash: input.hash,
      docVersion: input.docVersion ?? null,
      dirtyStamp: input.dirtyStamp,
      contextKey: input.contextKey,
      authoritative: input.authoritative,
      reportedAtMs: performance.now()
    });
  }

  function clearUriState(uri: string): void {
    lastVisibleByUri.delete(uri);
    projectedPrefixReuseTraceByUri.delete(uri);
    stickyFastPathTraceByUri.delete(uri);
  }

  function clearAll(): void {
    lastVisibleByUri.clear();
    projectedPrefixReuseTraceByUri.clear();
    stickyFastPathTraceByUri.clear();
  }

  return {
    state: {
      lastVisibleByUri,
      projectedPrefixReuseTraceByUri,
      stickyFastPathTraceByUri
    },
    getVisibleState,
    getFastPathVisibleState,
    getProjectedPrefixReuseTrace,
    getResultVersion,
    updateProjectedPrefixReuseTrace,
    getStickyFastPathTrace,
    noteStickyFastPathReuse,
    clearStickyFastPathReuse,
    shouldUseStickyFastPath,
    shouldExpireProjectedPrefixReuse,
    rememberVisibleState,
    clearUriState,
    clearAll
  };
}
