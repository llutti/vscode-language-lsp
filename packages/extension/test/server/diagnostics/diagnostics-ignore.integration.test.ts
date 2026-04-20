import { describe, expect, it } from 'vitest';
import { applyIgnoreIds, mergeIgnoredCodes, removeIgnoredCode } from '../../../src/server/diagnostics/diagnostics-ignore';
import { clearIgnoredCodes, listEffectiveIgnoredCodes } from '../../../src/server/diagnostics/diagnostics-ignore-commands';

type FakeConfigState = {
  workspace: string[];
  user: string[];
};

function ignoreId(state: FakeConfigState, rawId: string, scope: 'workspace' | 'user'): FakeConfigState {
  if (scope === 'workspace') {
    return {
      workspace: mergeIgnoredCodes(state.workspace, rawId),
      user: [...state.user]
    };
  }
  return {
    workspace: [...state.workspace],
    user: mergeIgnoredCodes(state.user, rawId)
  };
}

function unignoreId(state: FakeConfigState, rawId: string, scope: 'workspace' | 'user'): FakeConfigState {
  if (scope === 'workspace') {
    return {
      workspace: removeIgnoredCode(state.workspace, rawId),
      user: [...state.user]
    };
  }
  return {
    workspace: [...state.workspace],
    user: removeIgnoredCode(state.user, rawId)
  };
}

describe('diagnostics ignore integration', () => {
  it('ignore/unignore por scope atualiza settings e reflete na publicacao', () => {
    let state: FakeConfigState = { workspace: [], user: [] };
    const diagnostics = [
      { id: 'LSP1404', message: 'a' },
      { id: 'LSP1204', message: 'b' }
    ];

    state = ignoreId(state, ' lsp1404 ', 'workspace');
    let effective = new Set(listEffectiveIgnoredCodes(state));
    let filtered = applyIgnoreIds(diagnostics, effective);
    expect(state.workspace).toEqual(['LSP1404']);
    expect(filtered).toEqual([{ id: 'LSP1204', message: 'b' }]);

    state = ignoreId(state, 'lsp1204', 'user');
    effective = new Set(listEffectiveIgnoredCodes(state));
    filtered = applyIgnoreIds(diagnostics, effective);
    expect(state.user).toEqual(['LSP1204']);
    expect(filtered).toEqual([]);

    state = unignoreId(state, 'lsp1404', 'workspace');
    effective = new Set(listEffectiveIgnoredCodes(state));
    filtered = applyIgnoreIds(diagnostics, effective);
    expect(filtered).toEqual([{ id: 'LSP1404', message: 'a' }]);
  });

  it('clear ignored IDs por scope limpa somente o alvo', () => {
    const state: FakeConfigState = {
      workspace: ['LSP1404'],
      user: ['LSP1204']
    };
    const clearedWorkspace = clearIgnoredCodes(state, 'workspace');
    expect(clearedWorkspace.workspace).toEqual([]);
    expect(clearedWorkspace.user).toEqual(['LSP1204']);

    const clearedUser = clearIgnoredCodes(state, 'user');
    expect(clearedUser.workspace).toEqual(['LSP1404']);
    expect(clearedUser.user).toEqual([]);
  });
});
