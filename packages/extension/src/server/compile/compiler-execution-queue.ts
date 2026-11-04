export type QueueItem<T> = {
  id: number;
  run: () => Promise<T>;
};

export type QueueSnapshot = {
  queued: number;
  active: boolean;
  maxDepth: number;
  completed: number;
  failed: number;
};

export class CompilerExecutionQueue<T> {
  private readonly items: QueueItem<T>[] = [];
  private running = false;
  private maxDepth = 0;
  private completed = 0;
  private failed = 0;
  private closed = false;
  private drainPromise: Promise<void> = Promise.resolve();

  enqueue(item: QueueItem<T>): void {
    if (this.closed) throw new Error('Compiler execution queue is closed');
    this.items.push(item);
    this.maxDepth = Math.max(this.maxDepth, this.items.length);
    this.drainPromise = this.drainPromise.then(() => this.drain());
  }

  close(): void {
    this.closed = true;
    this.items.length = 0;
  }

  snapshot(): QueueSnapshot {
    return {
      queued: this.items.length,
      active: this.running,
      maxDepth: this.maxDepth,
      completed: this.completed,
      failed: this.failed
    };
  }

  async whenIdle(): Promise<void> {
    await this.drainPromise;
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    const item = this.items.shift();
    if (!item) return;
    this.running = true;
    try {
      await item.run();
      this.completed += 1;
    } catch {
      this.failed += 1;
    } finally {
      this.running = false;
      if (this.items.length > 0) await this.drain();
    }
  }
}
