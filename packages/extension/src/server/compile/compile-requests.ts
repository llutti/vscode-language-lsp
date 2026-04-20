export type CompileRequestState = {
  seq: number;
  latestByContext: Map<string, number>;
  runningByContext: Map<string, number>;
};

export function createCompileRequestState(): CompileRequestState {
  return {
    seq: 0,
    latestByContext: new Map(),
    runningByContext: new Map()
  };
}

export function startCompileRequest(state: CompileRequestState, contextKey: string): number {
  const requestId = state.seq + 1;
  state.seq = requestId;
  state.latestByContext.set(contextKey, requestId);
  state.runningByContext.set(contextKey, requestId);
  return requestId;
}

export function isLatestRequest(state: CompileRequestState, contextKey: string, requestId: number): boolean {
  return state.latestByContext.get(contextKey) === requestId;
}

export function isRunningRequest(state: CompileRequestState, contextKey: string, requestId: number): boolean {
  return state.runningByContext.get(contextKey) === requestId;
}

export function finishCompileRequest(state: CompileRequestState, contextKey: string, requestId: number): boolean {
  if (!isRunningRequest(state, contextKey, requestId)) return false;
  state.runningByContext.delete(contextKey);
  return true;
}


export function clearCompileRequestsForContext(state: CompileRequestState, contextKey: string): void {
  state.latestByContext.delete(contextKey);
  state.runningByContext.delete(contextKey);
}
