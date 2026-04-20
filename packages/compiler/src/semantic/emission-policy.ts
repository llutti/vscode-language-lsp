import type { SemanticTokenModifier, SemanticTokenType } from './semantic-tokens';
import type { LspSymbol } from './symbols';

export type EmissionPolicyInput = {
  symbol: LspSymbol;
  isKnownInternalVariable: boolean;
  isGlobalScopeSymbol: boolean;
};

export type EmissionPolicyResult = {
  tokenType: SemanticTokenType;
  tokenModifiers: SemanticTokenModifier[];
};

export function classifySymbolEmission(input: EmissionPolicyInput): EmissionPolicyResult | null {
  const symbol = input.symbol;

  if (symbol.kind === 'function') {
    // Do not differentiate internal vs custom functions for highlighting.
    return { tokenType: 'function', tokenModifiers: [] };
  }

  if (symbol.kind === 'parameter') {
    const tokenModifiers: SemanticTokenModifier[] = [];
    if (symbol.isEndParam) tokenModifiers.push('defaultLibrary');
    return { tokenType: 'parameter', tokenModifiers };
  }

  if (symbol.kind === 'internal') {
    const tokenModifiers: SemanticTokenModifier[] = ['defaultLibrary', 'internal'];
    if (symbol.isConst) tokenModifiers.push('readonly');
    return { tokenType: 'variable', tokenModifiers };
  }

  if (symbol.kind === 'field') {
    const tokenModifiers: SemanticTokenModifier[] = symbol.readonly ? ['readonly'] : [];
    return { tokenType: 'property', tokenModifiers };
  }

  if (symbol.kind === 'variable') {
    const tokenModifiers: SemanticTokenModifier[] = [];
    if (input.isKnownInternalVariable) {
      tokenModifiers.push('defaultLibrary');
    }
    // Custom variables intentionally do not differentiate global vs local for syntax highlighting.
    return { tokenType: 'variable', tokenModifiers };
  }

  return null;
}
