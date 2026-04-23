import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { formatText } from '@lsp/compiler';
import { createDocHashHistoryTracker } from '../../../src/server/semantics/doc-hash-history';
import { isLikelyFormatDrivenChange, isUndoLikeHashTransition, type FormatWindow } from '../../../src/server/compile/format-change-classifier';
import { createPullDiagnosticsFollowupTracker } from '../../../src/server/diagnostics/pull-diagnostics-followup';
import { createSemanticRefreshScheduler } from '../../../src/server/semantics/semantic-refresh-scheduler';

function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function findLargeTr805Text(): string | null {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');
  const trDir = path.join(repoRoot, 'exemplos', 'TR');
  if (!fs.existsSync(trDir)) return null;
  const file = fs
    .readdirSync(trDir)
    .filter((name) => /^TR805.*\.txt$/i.test(name))
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    .map((name) => path.join(trDir, name))
    .find((candidate) => fs.statSync(candidate).size >= 8_000);
  if (!file) return null;
  return fs.readFileSync(file, 'utf8');
}

function buildLargeFallbackText(): string {
  const line = 'Inicio\n  nValor=1;\n  Se nValor>0 Entao\n    nValor=nValor+1;\n  FimSe\nFim;\n';
  return line.repeat(600);
}

describe('format/undo deadlock recovery integration', () => {
  it('reproduces format -> undo -> format on large content with stable canonical output', { timeout: 10000 }, () => {
    const originalText = findLargeTr805Text() ?? buildLargeFallbackText();
    const formattedOnce = formatText({
      text: originalText,
      options: { indentSize: 2, useTabs: false }
    }).text;
    const afterUndoText = originalText;
    const formattedTwice = formatText({
      text: afterUndoText,
      options: { indentSize: 2, useTabs: false }
    }).text;

    expect(formattedTwice).toBe(formattedOnce);
    expect(formattedTwice.length).toBeGreaterThan(0);
  });

  it('classifies didChange after format and undo-like transitions in sequence', () => {
    let now = 1_000;
    const realNow = Date.now;
    Date.now = () => now;
    try {
      const tracker = createDocHashHistoryTracker({
        hashText,
        undoLikeWindowMs: 1_200,
        isUndoLikeTransition: isUndoLikeHashTransition
      });

      const uri = 'file:///TR805-test.lspt';
      const v1 = 'Inicio\nnValor=1;\nFim;\n';
      const v2 = formatText({ text: v1, options: { indentSize: 2, useTabs: false } }).text;
      const marker: FormatWindow = { baseVersion: 1, requestedAtMs: now, windowMs: 900 };

      expect(tracker.update(uri, v1).undoLike).toBe(false);
      now += 300;
      expect(isLikelyFormatDrivenChange({ changeVersion: 2, nowMs: now, marker })).toBe(true);
      expect(tracker.update(uri, v2).undoLike).toBe(false);
      now += 250;
      expect(tracker.update(uri, v1).undoLike).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });

  it('avoids follow-up storm by allowing one pending follow-up per context', () => {
    const followup = createPullDiagnosticsFollowupTracker({
      cooldownMs: 250,
      enforceSinglePendingPerContext: true
    });
    const uriA = 'file:///TR805-A.lspt';
    const uriB = 'file:///TR805-B.lspt';

    expect(followup.shouldSchedule('ctx-tr805', uriA, 1, 'didOpenZero')).toBe(true);
    expect(followup.shouldSchedule('ctx-tr805', uriB, 2, 'publicApiZero')).toBe(false);
    followup.clearPending('ctx-tr805', uriA);
    expect(followup.hasPendingForContext('ctx-tr805')).toBe(false);
    expect(followup.shouldSchedule('ctx-tr805', uriB, 2, 'publicApiZero')).toBe(true);
  });

  it('keeps semantic refresh contained while follow-up is pending and resumes after quiescence', () => {
    vi.useFakeTimers();
    try {
      const refresh = vi.fn();
      let hasPendingFollowup = true;
      const scheduler = createSemanticRefreshScheduler({
        refresh,
        hasPendingPullFollowup: () => hasPendingFollowup,
        logWarn: vi.fn()
      });

      scheduler.schedule('compileResult', 10);
      vi.advanceTimersByTime(219);
      expect(refresh).toHaveBeenCalledTimes(0);

      hasPendingFollowup = false;
      scheduler.schedule('compileResult', 10);
      vi.advanceTimersByTime(10);
      expect(refresh).toHaveBeenCalledTimes(1);

      scheduler.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});
