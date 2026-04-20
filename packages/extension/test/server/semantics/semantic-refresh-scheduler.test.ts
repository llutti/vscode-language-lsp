import { describe, expect, it, vi } from 'vitest';
import { createSemanticRefreshScheduler } from '../../../src/server/semantics/semantic-refresh-scheduler';

describe('semantic refresh scheduler', () => {
  it('applies compileResult extra delay when diagnostics follow-up is pending', () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const scheduler = createSemanticRefreshScheduler({
      refresh,
      hasPendingPullFollowup: () => true,
      logWarn: vi.fn()
    });

    scheduler.schedule('compileResult', 50);
    vi.advanceTimersByTime(219);
    expect(refresh).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    scheduler.dispose();
    vi.useRealTimers();
  });

  it('coalesces timers and logs refresh failures', () => {
    vi.useFakeTimers();
    const logWarn = vi.fn();
    const scheduler = createSemanticRefreshScheduler({
      refresh: () => {
        throw new Error('boom');
      },
      hasPendingPullFollowup: () => false,
      logWarn
    });

    scheduler.schedule('a', 100);
    scheduler.schedule('b', 50);
    vi.advanceTimersByTime(50);
    expect(logWarn).toHaveBeenCalledTimes(1);
    expect(logWarn.mock.calls[0]?.[0]).toBe('b');

    scheduler.dispose();
    vi.useRealTimers();
  });
});
