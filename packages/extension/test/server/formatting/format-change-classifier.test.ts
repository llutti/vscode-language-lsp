import { describe, expect, it } from 'vitest';
import { isLikelyFormatDrivenChange, isUndoLikeHashTransition } from '../../../src/server/compile/format-change-classifier';

describe('format change classifier', () => {
  it('detects format-driven change inside marker window', () => {
    expect(isLikelyFormatDrivenChange({
      changeVersion: 8,
      nowMs: 1500,
      marker: {
        baseVersion: 7,
        requestedAtMs: 1000,
        windowMs: 600
      }
    })).toBe(true);
  });

  it('detects undo-like hash transition returning to previous snapshot', () => {
    expect(isUndoLikeHashTransition({
      nextHash: 'h1',
      previousHash: 'h2',
      beforePreviousHash: 'h1',
      elapsedMs: 300,
      windowMs: 1200
    })).toBe(true);
  });

  it('does not classify stale reversion outside undo window as undo-like', () => {
    expect(isUndoLikeHashTransition({
      nextHash: 'h1',
      previousHash: 'h2',
      beforePreviousHash: 'h1',
      elapsedMs: 5000,
      windowMs: 1200
    })).toBe(false);
  });
});
