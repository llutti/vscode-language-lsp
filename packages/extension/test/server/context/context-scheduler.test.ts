import { describe, it, expect } from 'vitest';
import { buildCompilationPlan } from '../../../src/server/compile/context-scheduler';

describe('agendamento de compilacao por contexto', () => {
  it('mantem a ordem quando nao ha ativo', () => {
    const plan = buildCompilationPlan(['ctx1', 'ctx2'], null);
    expect(plan.priorityKey).toBeNull();
    expect(plan.orderedKeys).toEqual(['ctx1', 'ctx2']);
  });

  it('prioriza o contexto ativo quando esta aberto', () => {
    const plan = buildCompilationPlan(['ctx1', 'ctx2', 'ctx3'], 'ctx2');
    expect(plan.priorityKey).toBe('ctx2');
    expect(plan.orderedKeys).toEqual(['ctx2', 'ctx1', 'ctx3']);
  });

  it('ignora ativo que nao esta aberto', () => {
    const plan = buildCompilationPlan(['ctx1'], 'ctx9');
    expect(plan.priorityKey).toBeNull();
    expect(plan.orderedKeys).toEqual(['ctx1']);
  });

  it('remove duplicados mantendo a primeira ocorrencia', () => {
    const plan = buildCompilationPlan(['ctx1', 'ctx2', 'ctx1'], 'ctx1');
    expect(plan.priorityKey).toBe('ctx1');
    expect(plan.orderedKeys).toEqual(['ctx1', 'ctx2']);
  });
});
