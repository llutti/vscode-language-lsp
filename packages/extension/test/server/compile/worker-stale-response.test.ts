import { describe, it, expect } from 'vitest';
import { createCompileRequestState, isLatestRequest, startCompileRequest } from '../../../src/server/compile/compile-requests';

describe('worker stale response', () => {
  it('ignora resposta antiga quando ha request mais recente', () => {
    const state = createCompileRequestState();
    const contextKey = 'ctx-1';

    const first = startCompileRequest(state, contextKey);
    const second = startCompileRequest(state, contextKey);

    expect(isLatestRequest(state, contextKey, first)).toBe(false);
    expect(isLatestRequest(state, contextKey, second)).toBe(true);
  });
});
