import { describe, expect, it } from 'vitest';
import { hasContextCompileSignal } from '../../../src/compile-scheduler-policy';

describe('compile scheduler policy', () => {
  it('treats scheduled, pending, running, and full compile states as active compile signals', () => {
    expect(hasContextCompileSignal({
      fullCompileQueuedOrRunning: false,
      compileScheduled: false,
      compilePending: false,
      compileRunning: false
    })).toBe(false);

    expect(hasContextCompileSignal({
      fullCompileQueuedOrRunning: false,
      compileScheduled: true,
      compilePending: false,
      compileRunning: false
    })).toBe(true);

    expect(hasContextCompileSignal({
      fullCompileQueuedOrRunning: false,
      compileScheduled: false,
      compilePending: true,
      compileRunning: false
    })).toBe(true);

    expect(hasContextCompileSignal({
      fullCompileQueuedOrRunning: false,
      compileScheduled: false,
      compilePending: false,
      compileRunning: true
    })).toBe(true);

    expect(hasContextCompileSignal({
      fullCompileQueuedOrRunning: true,
      compileScheduled: false,
      compilePending: false,
      compileRunning: false
    })).toBe(true);
  });
});
