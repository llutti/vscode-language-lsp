import { describe, expect, it } from 'vitest';
import type { SemanticOccurrence } from '@lsp/compiler';
import {
  getCommittedSemanticOccurrences,
  shouldLoadSystemAfterActiveContext,
  shouldServeCustomFromCommittedCache
} from '../../../src/server/runtime/m9-gating';

describe('m9 gating', () => {
  it('carrega systems adicionais somente apos contexto ativo', () => {
    expect(shouldLoadSystemAfterActiveContext('SENIOR')).toBe(false);
    expect(shouldLoadSystemAfterActiveContext('HCM')).toBe(true);
    expect(shouldLoadSystemAfterActiveContext('ERP')).toBe(true);
  });

  it('libera custom somente com cache committed', () => {
    expect(shouldServeCustomFromCommittedCache(undefined)).toBe(false);
    expect(shouldServeCustomFromCommittedCache({ symbols: [] })).toBe(false);
    expect(shouldServeCustomFromCommittedCache({ symbols: [{ name: 'MinhaFuncao' }] })).toBe(true);
  });

  it('busca semantic occurrences por path normalizado', () => {
    const list: SemanticOccurrence[] = [{ range: { start: { line: 1, character: 0 }, end: { line: 1, character: 3 } }, tokenType: 'function', tokenModifiers: [] }];
    const cache = {
      symbols: [],
      semanticsByFile: new Map<string, SemanticOccurrence[]>([['/tmp/HR858.TXT', list]])
    };
    expect(getCommittedSemanticOccurrences(cache, '/tmp/hr858.txt')).toBe(list);
  });
});
