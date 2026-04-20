export type ValidationScheduler = {
  schedule: (input: { contextId: string; trigger: string; delayMs?: number }) => void;
  dispose: () => void;
};

export function createValidationScheduler(input: {
  onRun: (event: { contextId: string; trigger: string }) => void;
  setTimer?: (cb: () => void, ms: number) => NodeJS.Timeout;
  clearTimer?: (timer: NodeJS.Timeout) => void;
}): ValidationScheduler {
  const setTimer = input.setTimer ?? ((cb, ms) => setTimeout(cb, ms));
  const clearTimer = input.clearTimer ?? ((timer) => clearTimeout(timer));
  const timers = new Map<string, NodeJS.Timeout>();
  const latestTrigger = new Map<string, string>();

  function schedule(payload: { contextId: string; trigger: string; delayMs?: number }): void {
    const delayMs = payload.delayMs ?? 0;
    latestTrigger.set(payload.contextId, payload.trigger);
    const existing = timers.get(payload.contextId);
    if (existing) clearTimer(existing);
    const timer = setTimer(() => {
      timers.delete(payload.contextId);
      const trigger = latestTrigger.get(payload.contextId) ?? payload.trigger;
      input.onRun({ contextId: payload.contextId, trigger });
    }, delayMs);
    timers.set(payload.contextId, timer);
  }

  function dispose(): void {
    for (const timer of timers.values()) {
      clearTimer(timer);
    }
    timers.clear();
  }

  return { schedule, dispose };
}
