import { describe, expect, it } from 'vitest';
import {
  getAuthoritativeStableSnapshotOverride,
  getEditBurstSnapshotOverride,
  pickStickyPullDiagnosticsSnapshot,
  shouldRetainStickySnapshotDuringEditBurst
} from '../../../src/server/diagnostics/pull-diagnostics-sticky-snapshots';

describe('pull diagnostics sticky snapshots', () => {
  it('picks the newest non-empty sticky snapshot for the same context', () => {
    const picked = pickStickyPullDiagnosticsSnapshot({
      contextKey: 'ctx',
      hasRecentEditBurst: true,
      computedDirtyStamp: 3,
      candidates: [
        {
          contextKey: 'ctx',
          dirtyStamp: 2,
          resultId: '1:a',
          hash: 'a',
          diagnostics: [{ message: 'old', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } }],
          reportedAtMs: 10
        },
        {
          contextKey: 'ctx',
          dirtyStamp: 3,
          resultId: '1:b',
          hash: 'b',
          diagnostics: [{ message: 'new', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } }],
          reportedAtMs: 20
        }
      ]
    });

    expect(picked?.resultId).toBe('1:b');
  });


  it('does not pick a stale non-empty sticky snapshot when a newer stable zero already exists', () => {
    const picked = pickStickyPullDiagnosticsSnapshot({
      contextKey: 'ctx',
      hasRecentEditBurst: true,
      computedDirtyStamp: 5,
      candidates: [
        {
          contextKey: 'ctx',
          dirtyStamp: 4,
          resultId: '10:stale-errors',
          hash: 'stale-errors',
          diagnostics: [{ message: 'older', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } }],
          reportedAtMs: 20
        },
        {
          contextKey: 'ctx',
          dirtyStamp: 5,
          resultId: '11:clean',
          hash: 'clean',
          diagnostics: [],
          reportedAtMs: 30
        }
      ]
    });

    expect(picked).toBeNull();
  });

  it('keeps authoritative stable override only when it still belongs to the same context', () => {
    const override = getAuthoritativeStableSnapshotOverride({
      context: {
        key: 'ctx',
        name: 'CTX',
        rootDir: '/tmp',
        filePattern: '*.txt',
        includeSubdirectories: false,
        system: 'HCM',
        workspaceUri: 'file:///tmp',
        diagnosticsIgnoreIds: []
      },
      uri: 'file:///a.txt',
      dirtyStamp: 4,
      currentResultId: '4:new',
      diagnosticsCount: 1,
      source: 'context-projected',
      isAuthoritative: false,
      stableSnapshot: {
        contextKey: 'ctx',
        dirtyStamp: 4,
        resultId: '4:old',
        hash: 'old',
        diagnostics: [{ message: 'stable', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } }],
        reportedAtMs: 10
      },
      withinFormatProtection: false
    });

    expect(override?.resultId).toBe('4:old');
  });

  it('reuses a smaller snapshot instead of flashing new authoritative diagnostics during edit burst', () => {
    const override = getEditBurstSnapshotOverride({
      context: {
        key: 'ctx',
        name: 'CTX',
        rootDir: '/tmp',
        filePattern: '*.txt',
        includeSubdirectories: false,
        system: 'HCM',
        workspaceUri: 'file:///tmp',
        diagnosticsIgnoreIds: []
      },
      hasRecentEditBurst: true,
      withinFormatProtection: false,
      currentDiagnosticsCount: 5,
      isAuthoritative: true,
      candidates: [
        {
          contextKey: 'ctx',
          dirtyStamp: 10,
          resultId: '9:clean',
          hash: 'clean',
          diagnostics: [],
          reportedAtMs: 20
        },
        {
          contextKey: 'ctx',
          dirtyStamp: 10,
          resultId: '9:older-errors',
          hash: 'older-errors',
          diagnostics: [{ message: 'older', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } }],
          reportedAtMs: 10
        }
      ]
    });

    expect(override?.resultId).toBe('9:clean');
  });


  it('does not retain a stale sticky snapshot when fallback or projected computation already cleaned to zero', () => {
    for (const source of ['fallback-compile', 'context-projected'] as const) {
      const shouldRetain = shouldRetainStickySnapshotDuringEditBurst({
        stickySnapshot: {
          contextKey: 'ctx',
          dirtyStamp: 10,
          resultId: '6:stale',
          hash: 'stale',
          diagnostics: [{ message: 'older', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } }],
          reportedAtMs: 20
        },
        currentHash: 'clean',
        currentDiagnosticsCount: 0,
        isAuthoritative: false,
        source
      });

      expect(shouldRetain).toBe(false);
    }
  });


  it('does not retain a stale sticky snapshot when a fresher public-api zero arrives during edit burst', () => {
    const shouldRetain = shouldRetainStickySnapshotDuringEditBurst({
      stickySnapshot: {
        contextKey: 'ctx',
        dirtyStamp: 10,
        resultId: '6:stale',
        hash: 'stale',
        diagnostics: [{ message: 'older', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } }],
        reportedAtMs: 20
      },
      currentHash: 'clean',
      currentDiagnosticsCount: 0,
      isAuthoritative: false,
      source: 'public-api'
    });

    expect(shouldRetain).toBe(false);
  });

});
