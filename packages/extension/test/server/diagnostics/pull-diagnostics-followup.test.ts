import { describe, expect, it, vi } from 'vitest';
import { createPullDiagnosticsFollowupTracker } from '../../../src/server/diagnostics/pull-diagnostics-followup';

describe('pull diagnostics followup tracker', () => {
  it('deduplicates pending schedule for same key and emits callback', () => {
    const onAlreadyScheduled = vi.fn();
    const tracker = createPullDiagnosticsFollowupTracker({
      cooldownMs: 100,
      onAlreadyScheduled
    });

    expect(tracker.shouldSchedule('ctx', 'file:///a.lspt', 1, 'r1')).toBe(true);
    expect(tracker.shouldSchedule('ctx', 'file:///a.lspt', 1, 'r2')).toBe(false);
    expect(onAlreadyScheduled).toHaveBeenCalledTimes(1);
    expect(onAlreadyScheduled.mock.calls[0]?.[0]).toMatchObject({
      contextKey: 'ctx',
      uri: 'file:///a.lspt',
      dirtyStamp: 1
    });
  });

  it('allows immediate retry after release and still tracks outcome lifecycle', () => {
    vi.useFakeTimers();
    const onCooldownSuppressed = vi.fn();
    const tracker = createPullDiagnosticsFollowupTracker({
      cooldownMs: 1000,
      onCooldownSuppressed
    });

    const uri = 'file:///a.lspt';
    expect(tracker.shouldSchedule('ctx', uri, 2, 'initial')).toBe(true);
    tracker.markStarted('ctx', uri);
    tracker.markExecuted('ctx', uri, 2, 3, 'context-projected', true);
    tracker.releaseForRetry('ctx', uri, 2);

    expect(tracker.shouldSchedule('ctx', uri, 2, 'retry-fast')).toBe(true);
    expect(onCooldownSuppressed).toHaveBeenCalledTimes(0);

    tracker.releaseForRetry('ctx', uri, 2);
    vi.advanceTimersByTime(1001);
    expect(tracker.shouldSchedule('ctx', uri, 2, 'retry-late')).toBe(true);

    const outcome = tracker.getOutcome('ctx', uri, 2);
    expect(outcome?.scheduleReason).toBe('retry-late');
    vi.useRealTimers();
  });

  it('enforces at most one pending follow-up per context when enabled', () => {
    const tracker = createPullDiagnosticsFollowupTracker({
      cooldownMs: 100,
      enforceSinglePendingPerContext: true
    });

    expect(tracker.shouldSchedule('ctx', 'file:///a.lspt', 1, 'first')).toBe(true);
    expect(tracker.shouldSchedule('ctx', 'file:///b.lspt', 2, 'second')).toBe(false);
    expect(tracker.shouldSchedule('ctx-other', 'file:///c.lspt', 1, 'other-context')).toBe(true);

    tracker.clearPending('ctx', 'file:///a.lspt');
    expect(tracker.shouldSchedule('ctx', 'file:///b.lspt', 2, 'after-clear')).toBe(true);
  });

  it('prevents storm reschedule for same key and allows recovery after clear', () => {
    const tracker = createPullDiagnosticsFollowupTracker({
      cooldownMs: 1000
    });
    const uri = 'file:///storm.lspt';

    expect(tracker.shouldSchedule('ctx', uri, 10, 'r1')).toBe(true);
    expect(tracker.shouldSchedule('ctx', uri, 10, 'r2')).toBe(false);
    tracker.markExecuted('ctx', uri, 10, 0, 'context-projected', false);

    tracker.clearPending('ctx', uri);
    expect(tracker.shouldSchedule('ctx', uri, 10, 'r3')).toBe(true);
  });

  it('treats recent schedules for the same uri as hot across dirty stamps', () => {
    vi.useFakeTimers();
    const tracker = createPullDiagnosticsFollowupTracker({
      cooldownMs: 1000
    });
    const uri = 'file:///storm.lspt';

    expect(tracker.shouldSchedule('ctx', uri, 10, 'r1')).toBe(true);
    tracker.markExecuted('ctx', uri, 10, 0, 'context-projected', false);
    tracker.clearPending('ctx', uri);

    expect(tracker.hasPendingOrRecentForUri('ctx', uri, 2500)).toBe(true);
    vi.advanceTimersByTime(2501);
    expect(tracker.hasPendingOrRecentForUri('ctx', uri, 2500)).toBe(false);
    vi.useRealTimers();
  });
});
