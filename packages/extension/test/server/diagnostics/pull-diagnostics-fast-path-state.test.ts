import { describe, expect, it } from 'vitest';
import { createPullDiagnosticsFastPathState } from '../../../src/server/diagnostics/pull-diagnostics-fast-path-state';

describe('pull diagnostics fast path state', () => {
  it('returns visible state only when it still matches the active request', () => {
    const state = createPullDiagnosticsFastPathState();
    state.rememberVisibleState({
      uri: 'file:///a.txt',
      resultId: '2:abc',
      hash: 'abc',
      docVersion: 2,
      dirtyStamp: 5,
      contextKey: 'ctx',
      authoritative: false
    });

    const visible = state.getFastPathVisibleState({
      uri: 'file:///a.txt',
      contextKey: 'ctx',
      docVersion: 2,
      dirtyStamp: 5,
      previousResultId: '2:abc',
      hasRecentEditBurst: true,
      stickyEditWindowMs: 1000
    });

    expect(visible?.resultId).toBe('2:abc');
  });

  it('tracks sticky fast-path reuse budget by result id', () => {
    const state = createPullDiagnosticsFastPathState();
    state.noteStickyFastPathReuse('file:///a.txt', '2:abc', 2);
    expect(state.shouldUseStickyFastPath({
      uri: 'file:///a.txt',
      resultId: '2:abc',
      docVersion: 2,
      withinFormatOrUndoWindow: false
    })).toBe(false);
  });

  it('clears all uri-local fast-path state together', () => {
    const state = createPullDiagnosticsFastPathState();
    state.rememberVisibleState({
      uri: 'file:///a.txt',
      resultId: '2:abc',
      hash: 'abc',
      docVersion: 2,
      dirtyStamp: 5,
      contextKey: 'ctx',
      authoritative: false
    });
    state.noteStickyFastPathReuse('file:///a.txt', '2:abc', 2);
    state.clearUriState('file:///a.txt');
    expect(state.getVisibleState('file:///a.txt')).toBeNull();
  });

  it('tracks and expires projected prefix reuse once the doc version advances outside edit burst', () => {
    const state = createPullDiagnosticsFastPathState();
    const trace = state.updateProjectedPrefixReuseTrace({
      uri: 'file:///a.txt',
      resultId: '2:abc',
      docVersion: 3,
      authorityLevel: 'projected',
      stalenessReason: 'prefix_result',
      hasRecentEditBurst: false
    });

    expect(trace.reuseCount).toBe(1);
    expect(trace.expired).toBe(true);
    expect(state.shouldExpireProjectedPrefixReuse({
      uri: 'file:///a.txt',
      docVersion: 3,
      resultId: '2:abc',
      source: 'context-projected',
      isPrefix: true,
      isAuthoritative: false,
      hasRecentEditBurst: false,
      withinFormatOrUndoWindow: false
    })).toBe(true);
  });
});
