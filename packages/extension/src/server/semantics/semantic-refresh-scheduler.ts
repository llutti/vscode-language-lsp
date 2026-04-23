export type SemanticRefreshScheduler = {
  schedule: (reason: string, delayMs?: number) => void;
  dispose: () => void;
};

type CreateSemanticRefreshSchedulerInput = {
  refresh: () => void;
  hasPendingPullFollowup: () => boolean;
  logWarn: (reason: string, error: unknown) => void;
};

export function createSemanticRefreshScheduler(input: CreateSemanticRefreshSchedulerInput): SemanticRefreshScheduler {
  let timer: NodeJS.Timeout | null = null;

  function schedule(reason: string, delayMs: number = 75): void {
    let resolvedDelayMs = delayMs;
    if (reason === 'compileResult' && input.hasPendingPullFollowup()) {
      resolvedDelayMs = Math.max(resolvedDelayMs, 220);
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      try {
        input.refresh();
      } catch (error) {
        input.logWarn(reason, error);
      }
    }, Math.max(0, resolvedDelayMs));
  }

  function dispose(): void {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  }

  return { schedule, dispose };
}
