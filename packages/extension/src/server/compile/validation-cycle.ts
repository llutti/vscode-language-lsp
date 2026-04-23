export type ValidationCycle = {
  cycleId: string;
  sequence: number;
  contextId: string;
  trigger: string;
};

export type ValidationCycleState = {
  sequence: number;
  latestByContext: Map<string, string>;
};

export function createValidationCycleState(): ValidationCycleState {
  return {
    sequence: 0,
    latestByContext: new Map<string, string>()
  };
}

export function startValidationCycle(state: ValidationCycleState, input: { contextId: string; trigger: string }): ValidationCycle {
  const sequence = state.sequence + 1;
  state.sequence = sequence;
  const cycleId = `${input.contextId}:${sequence}`;
  state.latestByContext.set(input.contextId, cycleId);
  return {
    cycleId,
    sequence,
    contextId: input.contextId,
    trigger: input.trigger
  };
}

export function isLatestValidationCycle(state: ValidationCycleState, cycle: ValidationCycle): boolean {
  return state.latestByContext.get(cycle.contextId) === cycle.cycleId;
}
