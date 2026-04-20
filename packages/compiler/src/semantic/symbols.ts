import type { OrderKey, ParamNode, TypeName } from '../parser/ast';
import type { Range } from '../source/types';

export type ScopeKind = 'global' | 'function' | 'block';

export type LspSymbol = {
  kind: 'variable' | 'function' | 'parameter' | 'internal' | 'field';
  /** Apenas para kind='internal' (variáveis internas). */
  isConst?: boolean;
  name: string;
  nameNormalized: string;
  typeName: TypeName;
  declaredAt: OrderKey;
  range: Range;
  sourcePath: string;
  scopeId: string;
  used: boolean;
  /** true quando a variável foi lida como valor (não conta escrita/atribuição). Usado por algumas regras como LSP1203 para variáveis implícitas. */
  read?: boolean;
  assigned: boolean;
  implicit?: boolean;
  /** true when variable declaration happened outside any function implementation. */
  outsideFunctionScope?: boolean;
  isEndParam?: boolean;
  readonly?: boolean;
  params?: ParamNode[];
  implemented?: boolean;
  declared?: boolean;
  fields?: Map<string, LspSymbol>;
  tableOccurrences?: number;
  predeclared?: boolean;
};

export type Scope = {
  id: string;
  kind: ScopeKind;
  parent: Scope | null;
  symbols: Map<string, LspSymbol[]>;
};

let scopeSeq = 0;

function compareOrder(a: OrderKey, b: OrderKey): number {
  if (a.fileIndex !== b.fileIndex) return a.fileIndex - b.fileIndex;
  return a.startOffset - b.startOffset;
}

export function createScope(kind: ScopeKind, parent: Scope | null): Scope {
  scopeSeq += 1;
  return {
    id: `${kind}-${scopeSeq}`,
    kind,
    parent,
    symbols: new Map()
  };
}

export function addSymbol(scope: Scope, symbol: LspSymbol): void {
  const key = symbol.nameNormalized;
  const list = scope.symbols.get(key);
  if (list) {
    // LSP rule: first declaration is the canonical one. Keep list sorted by declaration order.
    let inserted = false;
    for (let i = 0; i < list.length; i += 1) {
      const current = list[i];
      if (current && compareOrder(symbol.declaredAt, current.declaredAt) < 0) {
        list.splice(i, 0, symbol);
        inserted = true;
        break;
      }
    }
    if (!inserted) list.push(symbol);
    return;
  }
  scope.symbols.set(key, [symbol]);
}

export function lookupSymbol(scope: Scope, nameNormalized: string): { symbol: LspSymbol | null; scope: Scope | null } {
  let current: Scope | null = scope;
  while (current) {
    const list = current.symbols.get(nameNormalized);
    if (list && list.length > 0) {
      // First declaration is canonical in LSP.
      return { symbol: list[0] ?? null, scope: current };
    }
    current = current.parent;
  }
  return { symbol: null, scope: null };
}

export function forEachSymbol(scope: Scope, visit: (symbol: LspSymbol) => void): void {
  for (const list of scope.symbols.values()) {
    for (const symbol of list) {
      visit(symbol);
    }
  }
}
