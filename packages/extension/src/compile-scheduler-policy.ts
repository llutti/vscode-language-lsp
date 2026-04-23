export type ScheduledCompileEntryLike = {
  executeAt: number;
  queuedAt: number;
  reason: string;
  includeSemantics?: boolean;
};

export function markFullCompileQueued(target: Map<string, number>, contextKey: string): void {
  target.set(contextKey, Date.now());
}

export function clearFullCompileQueued(target: Map<string, number>, contextKey: string): void {
  target.delete(contextKey);
}

export function isFullCompileQueuedOrRunning(
  queuedByContext: Map<string, number>,
  inFlightByContext: Set<string>,
  contextKey: string
): boolean {
  return queuedByContext.has(contextKey) || inFlightByContext.has(contextKey);
}

export function hasContextCompileSignal(input: {
  fullCompileQueuedOrRunning: boolean;
  compileScheduled: boolean;
  compilePending: boolean;
  compileRunning: boolean;
}): boolean {
  return input.fullCompileQueuedOrRunning || input.compileScheduled || input.compilePending || input.compileRunning;
}

export function mergeChangedFilePaths(first?: string[], second?: string[]): string[] | undefined {
  const merged = [...(first ?? []), ...(second ?? [])];
  if (merged.length === 0) return undefined;
  return Array.from(new Set(merged));
}

export function mergeSemanticBudgetFiles(first?: number, second?: number): number | undefined {
  if (first === undefined) return second;
  if (second === undefined) return first;
  return Math.min(first, second);
}

export function shouldQueueAfterRunningCompile(reason: string, includeSemantics: boolean): boolean {
  if (includeSemantics) return false;
  switch (reason) {
    case 'didChangeTextDocument':
    case 'didChangeTextDocumentAfterFormat':
    case 'didUndoLikeChange':
    case 'pullDiagnosticsDidOpenDefer':
    case 'pullDiagnosticsBudgetTimeout':
      return true;
    default:
      return false;
  }
}

export function shouldRequestSemanticsForReason(reason: string): boolean {
  switch (reason) {
    case 'didChangeSemanticFollowup':
    case 'semanticTokensRefresh':
    case 'semanticTokensEnsure':
    case 'pullDiagnosticsGlobalFollowup':
    case 'didOpenContextBootstrap':
      return true;
    case 'didOpenTextDocument':
    case 'didOpenDeferredAfterRefresh':
    case 'didOpenTextDocumentSuppressed':
      return false;
    case 'didChangeTextDocument':
    case 'didChangeTextDocumentAfterFormat':
    case 'didUndoLikeChange':
    case 'pullDiagnosticsDidOpenDefer':
    case 'pullDiagnosticsBudgetTimeout':
    case 'refreshContexts':
    case 'refreshContextsActiveDocument':
    case 'didCloseTextDocument':
    case 'didChangeWatchedFiles':
    case 'pending':
    case 'ensureFile':
      return false;
    default:
      return true;
  }
}

export function resolveIncludeSemanticsForSchedule(reason: string, requested?: boolean): boolean {
  if (requested !== undefined) return requested;
  return shouldRequestSemanticsForReason(reason);
}

export function getScheduledCompileDelay(entry: ScheduledCompileEntryLike): number {
  return Math.max(0, entry.executeAt - performance.now());
}

export function shouldRescheduleCompileEarlier(current: ScheduledCompileEntryLike, nextExecuteAt: number): boolean {
  return nextExecuteAt + 5 < current.executeAt;
}

export function isTypingCompileReason(reason: string): boolean {
  return reason === 'didChangeTextDocument' || reason === 'didChangeTextDocumentAfterFormat' || reason === 'didUndoLikeChange' || reason === 'didChangeSemanticFollowup';
}

export function getAdaptiveCompileDelay(
  contextKey: string,
  baseDelayMs: number,
  reason: string,
  adaptiveTypingDelayByContext: Map<string, number>
): number {
  if (!isTypingCompileReason(reason)) return baseDelayMs;
  const adaptive = adaptiveTypingDelayByContext.get(contextKey);
  if (adaptive === undefined) return baseDelayMs;
  return Math.max(baseDelayMs, adaptive);
}

export function getCompileDelayForReason(
  reason: string,
  isPriority: boolean,
  priorityDelayMs: number,
  secondaryDelayMs: number
): number {
  if (reason === 'didChangeTextDocument') {
    return isPriority ? 180 : 420;
  }
  if (reason === 'didChangeTextDocumentAfterFormat') {
    return isPriority ? 380 : 700;
  }
  if (reason === 'didUndoLikeChange') {
    return isPriority ? 260 : 520;
  }
  if (reason === 'didChangeSemanticFollowup') {
    return isPriority ? 140 : 260;
  }
  if (reason === 'didOpenTextDocument' || reason === 'didOpenDeferredAfterRefresh') {
    return isPriority ? 0 : 120;
  }
  if (reason === 'didOpenContextBootstrap') {
    return 0;
  }
  if (reason === 'didCloseTextDocument' || reason === 'didChangeWatchedFiles') {
    return isPriority ? 40 : 200;
  }
  if (reason === 'refreshContexts' || reason === 'refreshContextsActiveDocument') {
    return isPriority ? 0 : 120;
  }
  if (reason === 'pending' || reason === 'ensureFile') {
    return 0;
  }
  return isPriority ? priorityDelayMs : secondaryDelayMs;
}
