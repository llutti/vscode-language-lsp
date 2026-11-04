import { describe, expect, it } from 'vitest';
import { CompilerExecutionQueue } from '../../../src/server/compile/compiler-execution-queue';

describe('CompilerExecutionQueue cancellation', () => {
  it('remove uma tarefa que ainda não começou', async () => {
    const queue = new CompilerExecutionQueue<void>();
    const events: string[] = [];
    queue.enqueue({ id: 1, run: async () => { events.push('one'); } });
    queue.enqueue({ id: 2, run: async () => { events.push('two'); } });
    expect(queue.cancel(2)).toBe(true);
    expect(queue.isRunning(2)).toBe(false);
    await queue.whenIdle();
    expect(events).toEqual(['one']);
  });

  it('identifica a tarefa ativa sem removê-la', async () => {
    const queue = new CompilerExecutionQueue<void>();
    let release!: () => void;
    const active = new Promise<void>((resolve) => { release = resolve; });
    queue.enqueue({ id: 7, run: async () => active });
    await Promise.resolve();
    expect(queue.isRunning(7)).toBe(true);
    expect(queue.cancel(7)).toBe(false);
    release();
    await queue.whenIdle();
    expect(queue.isRunning(7)).toBe(false);
  });
});
