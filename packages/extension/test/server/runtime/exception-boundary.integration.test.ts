import { describe, it, expect } from 'vitest';
import { runWithBoundary } from '../../../src/server/runtime/exception-boundary';

describe('integration: exception boundary', () => {
  it('captures task exception and avoids partial commit', () => {
    const published: string[] = [];
    const errors: Array<{ cycleId: string; message: string }> = [];

    const ok = runWithBoundary({
      cycleId: 'ctx-1:10',
      task: () => {
        throw new Error('boom');
      },
      onError: (error, cycleId) => {
        errors.push({ cycleId, message: String(error) });
      }
    });

    expect(ok).toBe(false);
    expect(published).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].cycleId).toBe('ctx-1:10');
  });
});
