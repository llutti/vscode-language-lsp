import { describe, expect, it } from 'vitest';
import { createDocHashHistoryTracker } from '../../../src/server/semantics/doc-hash-history';

describe('doc hash history tracker', () => {
  it('detects undo-like transition when hash returns to previous snapshot inside window', () => {
    let now = 1000;
    const realNow = Date.now;
    try {
      Date.now = () => now;

      const tracker = createDocHashHistoryTracker({
        hashText: (text) => text,
        undoLikeWindowMs: 5000,
        isUndoLikeTransition: ({ nextHash, previousHash, beforePreviousHash, elapsedMs, windowMs }) =>
          Boolean(previousHash && beforePreviousHash && nextHash === beforePreviousHash && elapsedMs <= windowMs)
      });

      expect(tracker.update('file:///a', 'v1')).toEqual({ hash: 'v1', undoLike: false });
      now += 200;
      expect(tracker.update('file:///a', 'v2')).toEqual({ hash: 'v2', undoLike: false });
      now += 200;
      expect(tracker.update('file:///a', 'v1')).toEqual({ hash: 'v1', undoLike: true });
    } finally {
      Date.now = realNow;
    }
  });
});
