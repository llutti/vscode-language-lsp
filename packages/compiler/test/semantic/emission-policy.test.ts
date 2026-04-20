import { describe, expect, it } from 'vitest';

import { classifySymbolEmission } from '../../src/semantic/emission-policy';
import type { LspSymbol } from '../../src/semantic/symbols';

function mkSymbol(kind: LspSymbol['kind'], overrides: Partial<LspSymbol> = {}): LspSymbol {
  return {
    kind,
    name: 'x',
    nameNormalized: 'x',
    typeName: 'Numero',
    declaredAt: { fileIndex: 0, startOffset: 0 },
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 1 }
    },
    sourcePath: '/tmp/test.lsp',
    scopeId: 'scope-1',
    used: false,
    assigned: false,
    ...overrides
  };
}

describe('classifySymbolEmission', () => {
  it('classifies function symbols as function without modifiers', () => {
    const result = classifySymbolEmission({
      symbol: mkSymbol('function'),
      isKnownInternalVariable: false,
      isGlobalScopeSymbol: false
    });
    expect(result).toEqual({ tokenType: 'function', tokenModifiers: [] });
  });

  it('classifies END parameter with defaultLibrary modifier', () => {
    const result = classifySymbolEmission({
      symbol: mkSymbol('parameter', { isEndParam: true }),
      isKnownInternalVariable: false,
      isGlobalScopeSymbol: false
    });
    expect(result).toEqual({ tokenType: 'parameter', tokenModifiers: ['defaultLibrary'] });
  });

  it('classifies internal constant as defaultLibrary internal readonly variable', () => {
    const result = classifySymbolEmission({
      symbol: mkSymbol('internal', { isConst: true }),
      isKnownInternalVariable: false,
      isGlobalScopeSymbol: false
    });
    expect(result).toEqual({
      tokenType: 'variable',
      tokenModifiers: ['defaultLibrary', 'internal', 'readonly']
    });
  });

  it('classifies readonly field as readonly property', () => {
    const result = classifySymbolEmission({
      symbol: mkSymbol('field', { readonly: true }),
      isKnownInternalVariable: false,
      isGlobalScopeSymbol: false
    });
    expect(result).toEqual({ tokenType: 'property', tokenModifiers: ['readonly'] });
  });

  it('classifies global custom variable without static modifier', () => {
    const result = classifySymbolEmission({
      symbol: mkSymbol('variable'),
      isKnownInternalVariable: false,
      isGlobalScopeSymbol: true
    });
    expect(result).toEqual({ tokenType: 'variable', tokenModifiers: [] });
  });

  it('classifies known internal variable fallback with defaultLibrary modifier', () => {
    const result = classifySymbolEmission({
      symbol: mkSymbol('variable'),
      isKnownInternalVariable: true,
      isGlobalScopeSymbol: false
    });
    expect(result).toEqual({ tokenType: 'variable', tokenModifiers: ['defaultLibrary'] });
  });
});
