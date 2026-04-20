import { describe, it, expect, vi } from 'vitest';
import { createValidationScheduler } from '../../../src/server/compile/validation-scheduler';

describe('integration: scheduler coalescing', () => {
  it('didOpen + multiple didChange coalesce into one final run', () => {
    vi.useFakeTimers();
    const runs: Array<{ contextId: string; trigger: string }> = [];
    const scheduler = createValidationScheduler({
      onRun: (event) => runs.push(event)
    });

    scheduler.schedule({ contextId: 'ctx-hr', trigger: 'didOpenTextDocument', delayMs: 100 });
    scheduler.schedule({ contextId: 'ctx-hr', trigger: 'didChangeTextDocument', delayMs: 100 });
    scheduler.schedule({ contextId: 'ctx-hr', trigger: 'didChangeTextDocument', delayMs: 100 });
    scheduler.schedule({ contextId: 'ctx-hr', trigger: 'didChangeTextDocument', delayMs: 100 });

    vi.advanceTimersByTime(99);
    expect(runs).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(runs).toEqual([{ contextId: 'ctx-hr', trigger: 'didChangeTextDocument' }]);

    scheduler.dispose();
    vi.useRealTimers();
  });
});
