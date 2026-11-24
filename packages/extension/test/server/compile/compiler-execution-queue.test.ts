import { describe, expect, it } from 'vitest';
import { CompilerExecutionQueue } from '../../../src/server/compile/compiler-execution-queue';

describe('CompilerExecutionQueue', () => {
  it('executa somente uma tarefa por vez e preserva a ordem', async () => {
    const queue = new CompilerExecutionQueue<void>();
    const events: string[] = [];
    let active = 0;
    let maxActive = 0;
    const run = (id: string) => async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      events.push(`start:${id}`);
      await Promise.resolve();
      events.push(`end:${id}`);
      active -= 1;
    };
    queue.enqueue({ id: 1, run: run('one') });
    queue.enqueue({ id: 2, run: run('two') });
    queue.enqueue({ id: 3, run: run('three') });
    await queue.whenIdle();
    expect(maxActive).toBe(1);
    expect(events).toEqual(['start:one', 'end:one', 'start:two', 'end:two', 'start:three', 'end:three']);
    expect(queue.snapshot()).toMatchObject({ queued: 0, active: false, completed: 3, failed: 0, maxDepth: 3 });
  });

  it('continua após uma tarefa falhar', async () => {
    const queue = new CompilerExecutionQueue<void>();
    const events: string[] = [];
    queue.enqueue({ id: 1, run: async () => { events.push('failed'); throw new Error('boom'); } });
    queue.enqueue({ id: 2, run: async () => { events.push('completed'); } });
    await queue.whenIdle();
    expect(events).toEqual(['failed', 'completed']);
    expect(queue.snapshot()).toMatchObject({ completed: 1, failed: 1 });
  });
});
