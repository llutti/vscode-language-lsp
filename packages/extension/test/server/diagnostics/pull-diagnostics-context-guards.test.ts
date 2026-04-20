import { describe, expect, it } from 'vitest';
import {
  shouldDeferColdDidOpenPull,
  shouldForceDirectCompileForZero,
  shouldRecheckTransientPublicApiZero,
  shouldWaitForAuthoritativeContext
} from '../../../src/server/diagnostics/pull-diagnostics-context-guards';

describe('pull diagnostics context guards', () => {
  it('defers cold didOpen only inside the configured window with reusable snapshot', () => {
    expect(shouldDeferColdDidOpenPull({
      hasDocument: true,
      didOpenReceivedAt: 100,
      reusableSnapshotCount: 2,
      didOpenWindowMs: 200,
      nowMs: 250
    })).toBe(true);

    expect(shouldDeferColdDidOpenPull({
      hasDocument: true,
      didOpenReceivedAt: 100,
      reusableSnapshotCount: 0,
      didOpenWindowMs: 200,
      nowMs: 250
    })).toBe(false);
  });

  it('waits for authoritative context only while the result is still transient', () => {
    expect(shouldWaitForAuthoritativeContext({
      forceRefreshFiles: false,
      projectedAuthoritative: false,
      stableIsFresh: false,
      hasRecentContextFullSignal: true,
      sameDirtyStamp: true
    })).toBe(true);

    expect(shouldWaitForAuthoritativeContext({
      forceRefreshFiles: true,
      projectedAuthoritative: false,
      stableIsFresh: false,
      hasRecentContextFullSignal: true,
      sameDirtyStamp: true
    })).toBe(false);
  });

  it('rechecks transient public-api zero only for non-authoritative zero results with recent full signal', () => {
    expect(shouldRecheckTransientPublicApiZero({
      diagnosticsCount: 0,
      source: 'public-api',
      isAuthoritative: false,
      forceRefreshFiles: false,
      stableIsFresh: false,
      projectedAuthoritative: false,
      sameDirtyStamp: true,
      hasRecentContextFullSignal: true
    })).toBe(true);

    expect(shouldRecheckTransientPublicApiZero({
      diagnosticsCount: 1,
      source: 'public-api',
      isAuthoritative: false,
      forceRefreshFiles: false,
      stableIsFresh: false,
      projectedAuthoritative: false,
      sameDirtyStamp: true,
      hasRecentContextFullSignal: true
    })).toBe(false);
  });

  it('forces direct compile only when there is compiler evidence and no recent full compile signal', () => {
    expect(shouldForceDirectCompileForZero({
      compilerDiagnosticsCount: 2,
      projectedAuthoritative: false,
      activeContextCompileSignal: false,
      hasRecentContextFullSignal: false,
      hasSameDirtyNonEmptySnapshot: true
    })).toBe(true);

    expect(shouldForceDirectCompileForZero({
      compilerDiagnosticsCount: 2,
      projectedAuthoritative: false,
      activeContextCompileSignal: false,
      hasRecentContextFullSignal: true,
      hasSameDirtyNonEmptySnapshot: true
    })).toBe(false);

    expect(shouldForceDirectCompileForZero({
      compilerDiagnosticsCount: 2,
      projectedAuthoritative: false,
      activeContextCompileSignal: true,
      hasRecentContextFullSignal: false,
      hasSameDirtyNonEmptySnapshot: true
    })).toBe(false);
  });
});
