import { describe, it, expect, vi } from 'vitest';
import { createValidationScheduler } from '../../../src/server/compile/validation-scheduler';
import { createValidationCycleState, startValidationCycle } from '../../../src/server/compile/validation-cycle';

describe('integration: large context open compiles once per cycle', () => {
  it('coalesces many open/change signals into one compile start', () => {
    vi.useFakeTimers();
    const cycles = createValidationCycleState();
    const started: string[] = [];

    const scheduler = createValidationScheduler({
      onRun: (event) => {
        const cycle = startValidationCycle(cycles, { contextId: event.contextId, trigger: event.trigger });
        started.push(cycle.cycleId);
      }
    });

    for (let i = 0; i < 100; i += 1) {
      scheduler.schedule({ contextId: 'ctx-HR', trigger: 'didOpenTextDocument', delayMs: 50 });
    }
    scheduler.schedule({ contextId: 'ctx-HR', trigger: 'didChangeTextDocument', delayMs: 50 });

    vi.advanceTimersByTime(50);
    expect(started).toEqual(['ctx-HR:1']);

    scheduler.dispose();
    vi.useRealTimers();
  });
});
