import { describe, expect, it } from 'vitest';
import type { InternalSignatureDoc, SymbolInfo } from '@lsp/compiler';
import
  {
    buildCustomSymbolFingerprint,
    buildOfficialDocVersionFingerprint,
    buildOfficialNameLookupKeys,
    buildOfficialSignatureKey,
    normalizeNameForKey,
    resolveOfficialSymbolKind
  } from '../../../src/server/language/hover-optimization';

describe('hover optimization', () =>
{
  it('builds stable official key by system/kind/name', () =>
  {
    const key = buildOfficialSignatureKey({ system: 'HCM', kind: 'function', name: '  Buscar  ' });
    expect(key).toBe('hcm|function|buscar');
  });

  it('returns lookup keys for function and internal in O(1) map layout', () =>
  {
    expect(buildOfficialNameLookupKeys('ERP', 'CadCod')).toEqual([
      'erp|function|cadcod',
      'erp|internal|cadcod'
    ]);
  });

  it('includes docVersion in official fingerprint', () =>
  {
    const signatures: InternalSignatureDoc[] = [
      {
        name: 'MinhaFuncao',
        originSystem: 'SENIOR',
        symbolKind: 'function',
        docVersion: '6.10.4'
      },
      {
        name: 'MinhaFuncao',
        originSystem: 'HCM',
        symbolKind: 'internal',
        docVersion: ''
      }
    ];

    expect(buildOfficialDocVersionFingerprint(signatures)).toBe('function:minhafuncao:6.10.4|internal:minhafuncao:');
  });

  it('generates custom fingerprint for function params without any', () =>
  {
    const symbol: SymbolInfo = {
      kind: 'function',
      name: 'MinhaFuncao',
      nameNormalized: normalizeNameForKey('MinhaFuncao'),
      typeName: 'Funcao',
      sourcePath: '/tmp/test.lspt',
      params: [
        {
          name: 'p1',
          nameNormalized: 'p1',
          typeName: 'Numero',
          isEnd: false,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 }
          }
        },
        {
          name: 'p2',
          nameNormalized: 'p2',
          typeName: 'Data',
          isEnd: true,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 }
          }
        }
      ]
    };

    expect(buildCustomSymbolFingerprint(symbol)).toBe('function:minhafuncao:Numero:p1,Data:end:p2');
  });

  it('resolves official symbol kind defaulting to function', () =>
  {
    const functionSig: InternalSignatureDoc = { name: 'A', originSystem: 'SENIOR' };
    const internalSig: InternalSignatureDoc = { name: 'B', originSystem: 'HCM', symbolKind: 'internal' };
    expect(resolveOfficialSymbolKind(functionSig)).toBe('function');
    expect(resolveOfficialSymbolKind(internalSig)).toBe('internal');
  });
});
