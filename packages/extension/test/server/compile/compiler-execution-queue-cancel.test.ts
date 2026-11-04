import { describe, expect, it } from 'vitest';
import { CompilerExecutionQueue } from '../../../src/server/compile/compiler-execution-queue';

describe('CompilerExecutionQueue cancellation', () => {
  it('remove uma tarefa que ainda não começou', async () => {
    const queue = new CompilerExecutionQueue<void>();
    const events: string[] = [];
    queue.enqueue({ id: 1, run: async () => { events.push('one'); } });
    queue.enqueue({ id: 2, run: async () => { events.push('two'); } });
    expect(queue.cancel(2)).toBe(true);
    await queue.whenIdle();
    expect(events).toEqual(['one']);
  });
});
