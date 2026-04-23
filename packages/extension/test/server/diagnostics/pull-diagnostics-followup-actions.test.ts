import { describe, expect, it, vi } from 'vitest';
import {
  scheduleDidOpenZeroAuthoritativeFollowup,
  scheduleStickyDiagnosticsFollowup
} from '../../../src/server/diagnostics/pull-diagnostics-followup-actions';
import type { ResolvedContext } from '../../../src/server/server-runtime';

const context: ResolvedContext = {
  key: 'ctx',
  name: 'CTX',
  rootDir: '/tmp',
  filePattern: '*.txt',
  includeSubdirectories: false,
  system: 'HCM',
  workspaceUri: 'file:///tmp',
  diagnosticsIgnoreIds: []
};

describe('pull diagnostics followup actions', () => {
  it('schedules sticky edit burst follow-up only when tracker allows it', () => {
    const noteFollowupTarget = vi.fn();
    const scheduleCompile = vi.fn();

    const scheduled = scheduleStickyDiagnosticsFollowup({
      context,
      uri: 'file:///a.txt',
      filePath: '/tmp/a.txt',
      docVersion: 3,
      dirtyStamp: 7,
      hasPendingOrRecentFollowupForUri: () => false,
      shouldScheduleFollowup: () => true,
      noteFollowupTarget,
      scheduleCompile
    });

    expect(scheduled).toBe(true);
    expect(noteFollowupTarget).toHaveBeenCalledWith('ctx', 'file:///a.txt', 7, 3, 7);
    expect(scheduleCompile).toHaveBeenCalledTimes(1);
  });

  it('skips didOpen zero follow-up when the didOpen window already expired', () => {
    const logDebug = vi.fn();
    const scheduled = scheduleDidOpenZeroAuthoritativeFollowup({
      context,
      uri: 'file:///a.txt',
      filePath: '/tmp/a.txt',
      docVersion: 3,
      dirtyStamp: 7,
      source: 'public-api',
      isAuthoritative: false,
      requestReceivedAtMs: 2_000,
      didOpenReceivedAt: 0,
      didOpenFollowupWindowMs: 500,
      hasPendingOrRecentFollowupForUri: () => false,
      shouldScheduleFollowup: () => true,
      noteFollowupTarget: vi.fn(),
      setFollowupScheduleReason: vi.fn(),
      getFollowupOutcome: () => null,
      scheduleCompile: vi.fn(),
      logDebug
    });

    expect(scheduled).toBe(false);
    expect(logDebug).toHaveBeenCalledWith(
      'pullDiagnostics.authoritativeFollowup skipped=didOpenWindowExpired',
      expect.objectContaining({ skipped: 'didOpenWindowExpired' })
    );
  });

  it('schedules didOpen zero follow-up when eligible', () => {
    const noteFollowupTarget = vi.fn();
    const setFollowupScheduleReason = vi.fn();
    const scheduleCompile = vi.fn();

    const scheduled = scheduleDidOpenZeroAuthoritativeFollowup({
      context,
      uri: 'file:///a.txt',
      filePath: '/tmp/a.txt',
      docVersion: 3,
      dirtyStamp: 7,
      source: 'fallback-compile',
      isAuthoritative: false,
      requestReceivedAtMs: 400,
      didOpenReceivedAt: 100,
      didOpenFollowupWindowMs: 500,
      hasPendingOrRecentFollowupForUri: () => false,
      shouldScheduleFollowup: () => true,
      noteFollowupTarget,
      setFollowupScheduleReason,
      getFollowupOutcome: () => null,
      scheduleCompile,
      logDebug: vi.fn()
    });

    expect(scheduled).toBe(true);
    expect(noteFollowupTarget).toHaveBeenCalledWith('ctx', 'file:///a.txt', 7, 3, 7);
    expect(setFollowupScheduleReason).toHaveBeenCalledWith('ctx', 'file:///a.txt', 7, 'didOpenZero');
    expect(scheduleCompile).toHaveBeenCalledTimes(1);
  });
});
