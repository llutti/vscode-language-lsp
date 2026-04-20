import { describe, it, expect } from 'vitest';
import { applyIgnoreIds, mergeIgnoreIds, mergeIgnoredCodes, normalizeDiagnosticCode, removeIgnoredCode } from '../../../src/server/diagnostics/diagnostics-ignore';

describe('diagnosticos ignorados', () => {
  it('normaliza codigo com trim e uppercase', () => {
    expect(normalizeDiagnosticCode(' lsp1404 ')).toBe('LSP1404');
  });

  it('ignora entradas vazias e remove duplicados', () => {
    const result = mergeIgnoredCodes(['LSP1404', ' lsp1404 ', ''], '  ');
    expect(result).toEqual(['LSP1404']);
  });

  it('adiciona o novo codigo normalizado', () => {
    const result = mergeIgnoredCodes(['LSP1404'], 'lsp1204');
    expect(result).toEqual(['LSP1404', 'LSP1204']);
  });

  it('remove codigo ignorado', () => {
    const result = removeIgnoredCode(['LSP1404', 'lsp1204'], ' lsp1404 ');
    expect(result).toEqual(['LSP1204']);
  });

  it('faz merge user+workspace com dedupe', () => {
    const result = mergeIgnoreIds(['lsp1001', 'LSP1002'], ['LSP1002', ' lsp1003 ']);
    expect(result).toEqual(['LSP1001', 'LSP1002', 'LSP1003']);
  });

  it('filtra diagnostics por ignoreIds', () => {
    const diagnostics = [
      { id: 'LSP1001', message: 'a' },
      { id: 'LSP1002', message: 'b' }
    ];
    const result = applyIgnoreIds(diagnostics, new Set(['LSP1002']));
    expect(result).toEqual([{ id: 'LSP1001', message: 'a' }]);
  });
});
