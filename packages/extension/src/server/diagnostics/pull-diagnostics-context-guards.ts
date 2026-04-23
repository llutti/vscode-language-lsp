import type { PullDiagnosticsSource } from './pull-diagnostics-observability';

export function shouldDeferColdDidOpenPull(input: {
  hasDocument: boolean;
  didOpenReceivedAt?: number;
  reusableSnapshotCount: number;
  didOpenWindowMs: number;
  nowMs: number;
}): boolean {
  return Boolean(
    input.hasDocument
    && input.didOpenReceivedAt !== undefined
    && input.nowMs - input.didOpenReceivedAt <= input.didOpenWindowMs
    && input.reusableSnapshotCount > 0
  );
}

export function shouldWaitForAuthoritativeContext(input: {
  forceRefreshFiles: boolean;
  projectedAuthoritative: boolean;
  stableIsFresh: boolean;
  hasRecentContextFullSignal: boolean;
  sameDirtyStamp: boolean;
}): boolean {
  return Boolean(
    !input.forceRefreshFiles
    && !input.projectedAuthoritative
    && !input.stableIsFresh
    && input.hasRecentContextFullSignal
    && input.sameDirtyStamp
  );
}

export function shouldRecheckTransientPublicApiZero(input: {
  diagnosticsCount: number;
  source: PullDiagnosticsSource;
  isAuthoritative: boolean;
  forceRefreshFiles: boolean;
  stableIsFresh: boolean;
  projectedAuthoritative: boolean;
  sameDirtyStamp: boolean;
  hasRecentContextFullSignal: boolean;
}): boolean {
  return Boolean(
    input.diagnosticsCount === 0
    && input.source === 'public-api'
    && !input.isAuthoritative
    && !input.forceRefreshFiles
    && !input.stableIsFresh
    && !input.projectedAuthoritative
    && input.sameDirtyStamp
    && input.hasRecentContextFullSignal
  );
}

export function shouldForceDirectCompileForZero(input: {
  compilerDiagnosticsCount: number;
  projectedAuthoritative: boolean;
  activeContextCompileSignal: boolean;
  hasRecentContextFullSignal: boolean;
  hasSameDirtyNonEmptySnapshot: boolean;
}): boolean {
  return Boolean(
    input.compilerDiagnosticsCount > 0
    && !input.projectedAuthoritative
    && !input.activeContextCompileSignal
    && !input.hasRecentContextFullSignal
    && input.hasSameDirtyNonEmptySnapshot
  );
}
