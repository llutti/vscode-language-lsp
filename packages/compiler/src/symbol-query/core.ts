import { buildContext, type ContentOverrides, type ValidationContextConfig } from '../context/context-manager';
import { loadInternalRegistry } from '../internals/registry';
import type {
  AssignmentNode,
  BlockNode,
  ExpressionNode,
  FileNode,
  ForNode,
  FuncDeclNode,
  FuncImplNode,
  IdentifierNode,
  IfNode,
  StatementNode,
  WhileNode
} from '../parser/ast';
import { parseFiles } from '../parser/parser';
import { createSourceFile, positionToOffset, type SourceFile } from '../source/source-file';
import { comparePosition, type Position, type Range } from '../source/types';
import { tokenize, type Token, type TokenType } from '../lexer/tokenizer';
import { casefold } from '../utils/casefold';
import type { LspSystem } from '../index';

export type SymbolQueryResolvedKind = 'variable' | 'customFunction' | 'officialFunction' | 'internal' | 'unknown';

export type SymbolQueryDefinitionLocation = {
  sourcePath: string;
  range: Range;
};

export type ResolvedSymbol = {
  id: string;
  name: string;
  nameNormalized: string;
  kind: SymbolQueryResolvedKind;
  sourcePath: string;
  nameRange: Range;
  definitionLocations: SymbolQueryDefinitionLocation[];
  canRename: boolean;
};

export type SymbolRenameTextEdit = {
  range: Range;
  newText: string;
};

export type PrepareRenameResult = {
  range: Range;
  placeholder: string;
  kind: SymbolQueryResolvedKind;
};

export type RenameRejectReason =
  | 'blockedToken'
  | 'symbolNotFound'
  | 'symbolNotRenameable'
  | 'invalidName'
  | 'collision';

export type RenameResult =
  | { ok: true; edits: Map<string, SymbolRenameTextEdit[]>; resolved: ResolvedSymbol }
  | { ok: false; reason: RenameRejectReason };

export type SymbolQueryScope = {
  files: string[];
  textByFile: Map<string, string>;
  fileTokens: Map<string, Token[]>;
  occurrenceBySymbol: Map<string, Map<string, Range[]>>;
  resolvedAtRangeByFile: Map<string, ResolvedOccurrence[]>;
  symbolsById: Map<string, SymbolRecord>;
};

type ScopeKind = 'global' | 'function' | 'block';

type ScopeNode = {
  id: string;
  kind: ScopeKind;
  parent: ScopeNode | null;
  declarationsByName: Map<string, SymbolRecord[]>;
};

type SymbolRecord = {
  id: string;
  kind: SymbolQueryResolvedKind;
  name: string;
  nameNormalized: string;
  sourcePath: string;
  declarationScopeId: string;
  declarationOrder: { fileIndex: number; startOffset: number };
  nameRange: Range;
  definitionLocations: SymbolQueryDefinitionLocation[];
  canRename: boolean;
};

type ResolvedOccurrence = {
  symbolId: string;
  range: Range;
};

type BuildState = {
  scopeSeq: number;
  globalScope: ScopeNode;
  occurrenceBySymbol: Map<string, Map<string, Range[]>>;
  resolvedAtRangeByFile: Map<string, ResolvedOccurrence[]>;
  symbolsById: Map<string, SymbolRecord>;
  customFunctionIdsByName: Map<string, string>;
};

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const LSP_KEYWORDS = new Set([
  'definir',
  'limpar',
  'funcao',
  'inicio',
  'fim',
  'se',
  'senao',
  'enquanto',
  'para',
  'continue',
  'pare',
  'vapara',
  'execsql',
  'end'
]);

function pathKey(filePath: string): string {
  return casefold(filePath);
}

function tokenContainsPosition(token: Token, position: Position): boolean {
  return comparePosition(token.range.start, position) <= 0 && comparePosition(position, token.range.end) < 0;
}

function rangeContainsPosition(range: Range, position: Position): boolean {
  return comparePosition(range.start, position) <= 0 && comparePosition(position, range.end) < 0;
}

function pushOccurrence(target: Map<string, Map<string, Range[]>>, symbolId: string, sourcePath: string, range: Range): void {
  const byFile = target.get(symbolId) ?? new Map<string, Range[]>();
  const list = byFile.get(sourcePath) ?? [];
  list.push(range);
  byFile.set(sourcePath, list);
  target.set(symbolId, byFile);
}

function pushResolvedOccurrence(target: Map<string, ResolvedOccurrence[]>, sourcePath: string, symbolId: string, range: Range): void {
  const list = target.get(sourcePath) ?? [];
  list.push({ symbolId, range });
  target.set(sourcePath, list);
}

function createScope(state: BuildState, kind: ScopeKind, parent: ScopeNode | null): ScopeNode {
  state.scopeSeq += 1;
  return {
    id: `${kind}-${state.scopeSeq}`,
    kind,
    parent,
    declarationsByName: new Map<string, SymbolRecord[]>()
  };
}

function registerDeclaration(scope: ScopeNode, symbol: SymbolRecord): void {
  const list = scope.declarationsByName.get(symbol.nameNormalized) ?? [];
  list.push(symbol);
  list.sort((a, b) => {
    if (a.declarationOrder.fileIndex !== b.declarationOrder.fileIndex) {
      return a.declarationOrder.fileIndex - b.declarationOrder.fileIndex;
    }
    return a.declarationOrder.startOffset - b.declarationOrder.startOffset;
  });
  scope.declarationsByName.set(symbol.nameNormalized, list);
}

function addDefinitionLocation(record: SymbolRecord, sourcePath: string, range: Range): void {
  if (record.definitionLocations.some((entry) => entry.sourcePath === sourcePath && comparePosition(entry.range.start, range.start) === 0 && comparePosition(entry.range.end, range.end) === 0)) {
    return;
  }
  record.definitionLocations.push({ sourcePath, range });
}

function createVariableId(sourcePath: string, fileIndex: number, startOffset: number, nameNormalized: string): string {
  return `var:${pathKey(sourcePath)}:${fileIndex}:${startOffset}:${nameNormalized}`;
}

function createParamId(sourcePath: string, fileIndex: number, startOffset: number, nameNormalized: string): string {
  return `param:${pathKey(sourcePath)}:${fileIndex}:${startOffset}:${nameNormalized}`;
}

function createFunctionId(nameNormalized: string): string {
  return `fn:${nameNormalized}`;
}

function createVariableRecord(input: {
  id: string;
  name: string;
  nameNormalized: string;
  sourcePath: string;
  declarationScopeId: string;
  fileIndex: number;
  startOffset: number;
  nameRange: Range;
}): SymbolRecord {
  return {
    id: input.id,
    kind: 'variable',
    name: input.name,
    nameNormalized: input.nameNormalized,
    sourcePath: input.sourcePath,
    declarationScopeId: input.declarationScopeId,
    declarationOrder: { fileIndex: input.fileIndex, startOffset: input.startOffset },
    nameRange: input.nameRange,
    definitionLocations: [{ sourcePath: input.sourcePath, range: input.nameRange }],
    canRename: true
  };
}

function createFunctionRecord(input: {
  id: string;
  name: string;
  nameNormalized: string;
  sourcePath: string;
  fileIndex: number;
  startOffset: number;
  nameRange: Range;
}): SymbolRecord {
  return {
    id: input.id,
    kind: 'customFunction',
    name: input.name,
    nameNormalized: input.nameNormalized,
    sourcePath: input.sourcePath,
    declarationScopeId: 'global-0',
    declarationOrder: { fileIndex: input.fileIndex, startOffset: input.startOffset },
    nameRange: input.nameRange,
    definitionLocations: [{ sourcePath: input.sourcePath, range: input.nameRange }],
    canRename: true
  };
}

function createParamRecord(input: {
  id: string;
  name: string;
  nameNormalized: string;
  sourcePath: string;
  declarationScopeId: string;
  fileIndex: number;
  startOffset: number;
  nameRange: Range;
}): SymbolRecord {
  return {
    id: input.id,
    kind: 'variable',
    name: input.name,
    nameNormalized: input.nameNormalized,
    sourcePath: input.sourcePath,
    declarationScopeId: input.declarationScopeId,
    declarationOrder: { fileIndex: input.fileIndex, startOffset: input.startOffset },
    nameRange: input.nameRange,
    definitionLocations: [{ sourcePath: input.sourcePath, range: input.nameRange }],
    canRename: true
  };
}

function resolveVariableLike(scope: ScopeNode, nameNormalized: string): SymbolRecord | null {
  let current: ScopeNode | null = scope;
  while (current) {
    const list = current.declarationsByName.get(nameNormalized);
    if (list && list.length > 0) {
      return list[0] ?? null;
    }
    current = current.parent;
  }
  return null;
}

function registerRecord(state: BuildState, symbol: SymbolRecord): void {
  state.symbolsById.set(symbol.id, symbol);
}

function recordReference(state: BuildState, record: SymbolRecord, range: Range, sourcePath: string): void {
  pushOccurrence(state.occurrenceBySymbol, record.id, sourcePath, range);
  pushResolvedOccurrence(state.resolvedAtRangeByFile, sourcePath, record.id, range);
}

function getFunctionRecord(state: BuildState, node: FuncDeclNode | FuncImplNode): SymbolRecord {
  const key = node.nameNormalized;
  const existingId = state.customFunctionIdsByName.get(key);
  if (existingId) {
    const existing = state.symbolsById.get(existingId);
    if (existing) {
      addDefinitionLocation(existing, node.sourcePath, node.nameRange ?? node.range);
      return existing;
    }
  }

  const created = createFunctionRecord({
    id: createFunctionId(key),
    name: node.name,
    nameNormalized: key,
    sourcePath: node.sourcePath,
    fileIndex: node.orderKey.fileIndex,
    startOffset: node.orderKey.startOffset,
    nameRange: node.nameRange ?? node.range
  });
  state.customFunctionIdsByName.set(key, created.id);
  registerRecord(state, created);
  registerDeclaration(state.globalScope, created);
  return created;
}

function findTokenAtPosition(tokens: Token[], position: Position): Token | null {
  for (const token of tokens) {
    if (tokenContainsPosition(token, position)) return token;
  }
  return null;
}

function classifyPositionToken(token: Token | null): 'identifier' | 'comment' | 'string' | 'keyword' | 'other' {
  if (!token) return 'other';
  if (token.type === 'CommentLine' || token.type === 'CommentBlock') return 'comment';
  if (token.type === 'String') return 'string';
  if (token.type === 'Keyword' || token.type === 'Type') return 'keyword';
  if (token.type === 'Identifier') return 'identifier';
  return 'other';
}

function isKeywordNormalized(nameNormalized: string): boolean {
  return LSP_KEYWORDS.has(nameNormalized);
}

function visitStatement(input: {
  state: BuildState;
  statement: StatementNode;
  scope: ScopeNode;
  registryFunctions: Set<string>;
  registryVariables: Set<string>;
}): void {
  const { state, statement, scope, registryFunctions, registryVariables } = input;
  switch (statement.kind) {
    case 'VarDecl': {
      const record = createVariableRecord({
        id: createVariableId(
          statement.sourcePath,
          statement.orderKey.fileIndex,
          statement.orderKey.startOffset,
          statement.nameNormalized
        ),
        name: statement.name,
        nameNormalized: statement.nameNormalized,
        sourcePath: statement.sourcePath,
        declarationScopeId: scope.id,
        fileIndex: statement.orderKey.fileIndex,
        startOffset: statement.orderKey.startOffset,
        nameRange: statement.nameRange ?? statement.range
      });
      registerRecord(state, record);
      registerDeclaration(scope, record);
      recordReference(state, record, record.nameRange, statement.sourcePath);
      break;
    }
    case 'FuncDecl': {
      const fnRecord = getFunctionRecord(state, statement);
      const fnNameRange = statement.nameRange ?? statement.range;
      recordReference(state, fnRecord, fnNameRange, statement.sourcePath);
      break;
    }
    case 'FuncImpl': {
      const fnRecord = getFunctionRecord(state, statement);
      const fnNameRange = statement.nameRange ?? statement.range;
      recordReference(state, fnRecord, fnNameRange, statement.sourcePath);

      const fnScope = createScope(state, 'function', state.globalScope);
      for (const param of statement.params) {
        const paramRecord = createParamRecord({
          id: createParamId(
            statement.sourcePath,
            statement.orderKey.fileIndex,
            statement.orderKey.startOffset + param.range.start.character,
            param.nameNormalized
          ),
          name: param.name,
          nameNormalized: param.nameNormalized,
          sourcePath: statement.sourcePath,
          declarationScopeId: fnScope.id,
          fileIndex: statement.orderKey.fileIndex,
          startOffset: statement.orderKey.startOffset + param.range.start.character,
          nameRange: param.nameRange ?? param.range
        });
        registerRecord(state, paramRecord);
        registerDeclaration(fnScope, paramRecord);
        recordReference(state, paramRecord, param.nameRange ?? param.range, statement.sourcePath);
      }
      if (statement.body) {
        visitBlock({
          state,
          block: statement.body,
          parentScope: fnScope,
          registryFunctions,
          registryVariables,
          reuseScope: true
        });
      }
      break;
    }
    case 'Block': {
      visitBlock({
        state,
        block: statement,
        parentScope: scope,
        registryFunctions,
        registryVariables,
        reuseScope: false
      });
      break;
    }
    case 'If': {
      visitIf({ state, node: statement, scope, registryFunctions, registryVariables });
      break;
    }
    case 'While': {
      visitWhile({ state, node: statement, scope, registryFunctions, registryVariables });
      break;
    }
    case 'For': {
      visitFor({ state, node: statement, scope, registryFunctions, registryVariables });
      break;
    }
    case 'Assignment': {
      visitAssignment({ state, node: statement, scope, registryFunctions, registryVariables });
      break;
    }
    case 'ExprStmt': {
      if (
        statement.expr.kind === 'Binary'
        && statement.expr.operator === '='
        && statement.expr.left.kind === 'Identifier'
      ) {
        resolveIdentifierUsage({
          state,
          id: statement.expr.left,
          scope,
          registryFunctions,
          registryVariables,
          asCallee: false,
          isAssignmentTarget: true
        });
        visitExpression({
          state,
          expr: statement.expr.right,
          scope,
          registryFunctions,
          registryVariables,
          asCallee: false,
          isAssignmentTarget: false
        });
        break;
      }
      visitExpression({
        state,
        expr: statement.expr,
        scope,
        registryFunctions,
        registryVariables,
        asCallee: false,
        isAssignmentTarget: false
      });
      break;
    }
    default:
      break;
  }
}

function visitBlock(input: {
  state: BuildState;
  block: BlockNode;
  parentScope: ScopeNode;
  registryFunctions: Set<string>;
  registryVariables: Set<string>;
  reuseScope: boolean;
}): void {
  const blockScope = input.reuseScope ? input.parentScope : createScope(input.state, 'block', input.parentScope);
  for (const statement of input.block.statements) {
    visitStatement({
      state: input.state,
      statement,
      scope: blockScope,
      registryFunctions: input.registryFunctions,
      registryVariables: input.registryVariables
    });
  }
}

function visitIf(input: {
  state: BuildState;
  node: IfNode;
  scope: ScopeNode;
  registryFunctions: Set<string>;
  registryVariables: Set<string>;
}): void {
  const { state, node, scope, registryFunctions, registryVariables } = input;
  if (node.condition) {
    visitExpression({
      state,
      expr: node.condition,
      scope,
      registryFunctions,
      registryVariables,
      asCallee: false,
      isAssignmentTarget: false
    });
  }
  if (node.thenBranch) {
    visitStatement({ state, statement: node.thenBranch, scope: createScope(state, 'block', scope), registryFunctions, registryVariables });
  }
  if (node.elseBranch) {
    visitStatement({ state, statement: node.elseBranch, scope: createScope(state, 'block', scope), registryFunctions, registryVariables });
  }
}

function visitWhile(input: {
  state: BuildState;
  node: WhileNode;
  scope: ScopeNode;
  registryFunctions: Set<string>;
  registryVariables: Set<string>;
}): void {
  const { state, node, scope, registryFunctions, registryVariables } = input;
  if (node.condition) {
    visitExpression({
      state,
      expr: node.condition,
      scope,
      registryFunctions,
      registryVariables,
      asCallee: false,
      isAssignmentTarget: false
    });
  }
  if (node.body) {
    visitStatement({ state, statement: node.body, scope: createScope(state, 'block', scope), registryFunctions, registryVariables });
  }
}

function visitFor(input: {
  state: BuildState;
  node: ForNode;
  scope: ScopeNode;
  registryFunctions: Set<string>;
  registryVariables: Set<string>;
}): void {
  const { state, node, scope, registryFunctions, registryVariables } = input;
  const forScope = createScope(state, 'block', scope);
  if (node.init) {
    visitStatement({ state, statement: node.init, scope: forScope, registryFunctions, registryVariables });
  }
  if (node.condition) {
    visitExpression({
      state,
      expr: node.condition,
      scope: forScope,
      registryFunctions,
      registryVariables,
      asCallee: false,
      isAssignmentTarget: false
    });
  }
  if (node.update) {
    visitExpression({
      state,
      expr: node.update,
      scope: forScope,
      registryFunctions,
      registryVariables,
      asCallee: false,
      isAssignmentTarget: false
    });
  }
  if (node.body) {
    visitStatement({ state, statement: node.body, scope: forScope, registryFunctions, registryVariables });
  }
}

function visitAssignment(input: {
  state: BuildState;
  node: AssignmentNode;
  scope: ScopeNode;
  registryFunctions: Set<string>;
  registryVariables: Set<string>;
}): void {
  const { state, node, scope, registryFunctions, registryVariables } = input;
  if (node.target.kind === 'Identifier') {
    visitExpression({
      state,
      expr: node.target,
      scope,
      registryFunctions,
      registryVariables,
      asCallee: false,
      isAssignmentTarget: true
    });
  } else {
    visitExpression({
      state,
      expr: node.target,
      scope,
      registryFunctions,
      registryVariables,
      asCallee: false,
      isAssignmentTarget: false
    });
  }
  if (node.value) {
    visitExpression({
      state,
      expr: node.value,
      scope,
      registryFunctions,
      registryVariables,
      asCallee: false,
      isAssignmentTarget: false
    });
  }
}

function visitExpression(input: {
  state: BuildState;
  expr: ExpressionNode;
  scope: ScopeNode;
  registryFunctions: Set<string>;
  registryVariables: Set<string>;
  asCallee: boolean;
  isAssignmentTarget: boolean;
}): void {
  const { state, expr, scope, registryFunctions, registryVariables, asCallee, isAssignmentTarget } = input;
  switch (expr.kind) {
    case 'Identifier': {
      resolveIdentifierUsage({
        state,
        id: expr,
        scope,
        registryFunctions,
        registryVariables,
        asCallee,
        isAssignmentTarget
      });
      break;
    }
    case 'Call': {
      visitExpression({
        state,
        expr: expr.callee,
        scope,
        registryFunctions,
        registryVariables,
        asCallee: true,
        isAssignmentTarget: false
      });
      for (const arg of expr.args) {
        visitExpression({
          state,
          expr: arg,
          scope,
          registryFunctions,
          registryVariables,
          asCallee: false,
          isAssignmentTarget: false
        });
      }
      break;
    }
    case 'Member': {
      visitExpression({
        state,
        expr: expr.object,
        scope,
        registryFunctions,
        registryVariables,
        asCallee: false,
        isAssignmentTarget: false
      });
      break;
    }
    case 'Index': {
      visitExpression({
        state,
        expr: expr.object,
        scope,
        registryFunctions,
        registryVariables,
        asCallee: false,
        isAssignmentTarget: false
      });
      visitExpression({
        state,
        expr: expr.index,
        scope,
        registryFunctions,
        registryVariables,
        asCallee: false,
        isAssignmentTarget: false
      });
      break;
    }
    case 'Binary': {
      visitExpression({
        state,
        expr: expr.left,
        scope,
        registryFunctions,
        registryVariables,
        asCallee: false,
        isAssignmentTarget: false
      });
      visitExpression({
        state,
        expr: expr.right,
        scope,
        registryFunctions,
        registryVariables,
        asCallee: false,
        isAssignmentTarget: false
      });
      break;
    }
    case 'Unary': {
      visitExpression({
        state,
        expr: expr.operand,
        scope,
        registryFunctions,
        registryVariables,
        asCallee: false,
        isAssignmentTarget: false
      });
      break;
    }
    case 'Paren': {
      if (expr.expr) {
        visitExpression({
          state,
          expr: expr.expr,
          scope,
          registryFunctions,
          registryVariables,
          asCallee: false,
          isAssignmentTarget: false
        });
      }
      break;
    }
    default:
      break;
  }
}

function resolveIdentifierUsage(input: {
  state: BuildState;
  id: IdentifierNode;
  scope: ScopeNode;
  registryFunctions: Set<string>;
  registryVariables: Set<string>;
  asCallee: boolean;
  isAssignmentTarget: boolean;
}): void {
  const { state, id, scope, registryFunctions, registryVariables, asCallee, isAssignmentTarget } = input;
  const variableLike = resolveVariableLike(scope, id.nameNormalized);
  if (variableLike) {
    recordReference(state, variableLike, id.range, id.sourcePath);
    return;
  }

  if (isAssignmentTarget && !asCallee) {
    const implicitRecord = createVariableRecord({
      id: createVariableId(
        id.sourcePath,
        id.orderKey.fileIndex,
        id.orderKey.startOffset,
        id.nameNormalized
      ),
      name: id.name,
      nameNormalized: id.nameNormalized,
      sourcePath: id.sourcePath,
      declarationScopeId: scope.id,
      fileIndex: id.orderKey.fileIndex,
      startOffset: id.orderKey.startOffset,
      nameRange: id.range
    });
    registerRecord(state, implicitRecord);
    registerDeclaration(scope, implicitRecord);
    recordReference(state, implicitRecord, id.range, id.sourcePath);
    return;
  }

  if (asCallee) {
    const fnId = state.customFunctionIdsByName.get(id.nameNormalized);
    if (fnId) {
      const record = state.symbolsById.get(fnId);
      if (record) {
        recordReference(state, record, id.range, id.sourcePath);
        return;
      }
    }
    if (registryFunctions.has(id.nameNormalized)) {
      const officialId = `official:${id.nameNormalized}`;
      const existing = state.symbolsById.get(officialId);
      const record = existing ?? {
        id: officialId,
        kind: 'officialFunction' as const,
        name: id.name,
        nameNormalized: id.nameNormalized,
        sourcePath: id.sourcePath,
        declarationScopeId: scope.id,
        declarationOrder: id.orderKey,
        nameRange: id.range,
        definitionLocations: [],
        canRename: false
      };
      if (!existing) registerRecord(state, record);
      recordReference(state, record, id.range, id.sourcePath);
      return;
    }
  }

  if (registryVariables.has(id.nameNormalized)) {
    const internalId = `internal:${id.nameNormalized}`;
    const existing = state.symbolsById.get(internalId);
    const record = existing ?? {
      id: internalId,
      kind: 'internal' as const,
      name: id.name,
      nameNormalized: id.nameNormalized,
      sourcePath: id.sourcePath,
      declarationScopeId: scope.id,
      declarationOrder: id.orderKey,
      nameRange: id.range,
      definitionLocations: [],
      canRename: false
    };
    if (!existing) registerRecord(state, record);
    recordReference(state, record, id.range, id.sourcePath);
    return;
  }

  const unknownId = `unknown:${pathKey(id.sourcePath)}:${id.orderKey.fileIndex}:${id.orderKey.startOffset}`;
  const existing = state.symbolsById.get(unknownId);
  const record = existing ?? {
    id: unknownId,
    kind: 'unknown' as const,
    name: id.name,
    nameNormalized: id.nameNormalized,
    sourcePath: id.sourcePath,
    declarationScopeId: scope.id,
    declarationOrder: id.orderKey,
    nameRange: id.range,
    definitionLocations: [],
    canRename: false
  };
  if (!existing) registerRecord(state, record);
  recordReference(state, record, id.range, id.sourcePath);
}

function sortAndDedupeOccurrences(scope: SymbolQueryScope): void {
  for (const [symbolId, byFile] of scope.occurrenceBySymbol.entries()) {
    for (const [filePath, ranges] of byFile.entries()) {
      ranges.sort((a, b) => comparePosition(a.start, b.start));
      const unique: Range[] = [];
      for (const range of ranges) {
        const prev = unique[unique.length - 1];
        if (prev && comparePosition(prev.start, range.start) === 0 && comparePosition(prev.end, range.end) === 0) {
          continue;
        }
        unique.push(range);
      }
      byFile.set(filePath, unique);
    }
    scope.occurrenceBySymbol.set(symbolId, byFile);
  }

  for (const [filePath, entries] of scope.resolvedAtRangeByFile.entries()) {
    entries.sort((a, b) => comparePosition(a.range.start, b.range.start));
    const unique: ResolvedOccurrence[] = [];
    for (const entry of entries) {
      const prev = unique[unique.length - 1];
      if (prev && prev.symbolId === entry.symbolId && comparePosition(prev.range.start, entry.range.start) === 0 && comparePosition(prev.range.end, entry.range.end) === 0) {
        continue;
      }
      unique.push(entry);
    }
    scope.resolvedAtRangeByFile.set(filePath, unique);
  }
}

async function buildSymbolQueryScope(input: {
  files: SourceFile[];
  system: LspSystem;
}): Promise<SymbolQueryScope> {
  const registry = await loadInternalRegistry(input.system);
  const registryFunctions = new Set<string>(registry.functions.keys());
  const registryVariables = new Set<string>(registry.internalVariables.keys());
  const { program } = parseFiles(input.files);

  const state: BuildState = {
    scopeSeq: 0,
    globalScope: {
      id: 'global-0',
      kind: 'global',
      parent: null,
      declarationsByName: new Map<string, SymbolRecord[]>()
    },
    occurrenceBySymbol: new Map<string, Map<string, Range[]>>(),
    resolvedAtRangeByFile: new Map<string, ResolvedOccurrence[]>(),
    symbolsById: new Map<string, SymbolRecord>(),
    customFunctionIdsByName: new Map<string, string>()
  };

  // Pre-register custom functions globally so calls resolve consistently.
  for (const file of program.files) {
    for (const statement of file.statements) {
      if (statement.kind === 'FuncDecl' || statement.kind === 'FuncImpl') {
        getFunctionRecord(state, statement);
      }
    }
  }

  for (const file of program.files) {
    visitFile({ state, file, registryFunctions, registryVariables });
  }

  const textByFile = new Map<string, string>();
  const fileTokens = new Map<string, Token[]>();
  const fileList: string[] = [];
  for (const source of input.files) {
    fileList.push(source.path);
    textByFile.set(source.path, source.text);
    fileTokens.set(source.path, tokenize(source).tokens);
  }

  const scope: SymbolQueryScope = {
    files: fileList,
    textByFile,
    fileTokens,
    occurrenceBySymbol: state.occurrenceBySymbol,
    resolvedAtRangeByFile: state.resolvedAtRangeByFile,
    symbolsById: state.symbolsById
  };
  sortAndDedupeOccurrences(scope);
  return scope;
}

function visitFile(input: {
  state: BuildState;
  file: FileNode;
  registryFunctions: Set<string>;
  registryVariables: Set<string>;
}): void {
  for (const statement of input.file.statements) {
    visitStatement({
      state: input.state,
      statement,
      scope: input.state.globalScope,
      registryFunctions: input.registryFunctions,
      registryVariables: input.registryVariables
    });
  }
}

export async function buildSymbolQueryScopeForContext(
  config: ValidationContextConfig,
  contentOverrides?: ContentOverrides
): Promise<SymbolQueryScope> {
  const context = contentOverrides
    ? await buildContext(config, { contentOverrides })
    : await buildContext(config);
  return buildSymbolQueryScope({ files: context.files, system: config.system });
}

export async function buildSymbolQueryScopeForSingleFile(input: {
  filePath: string;
  text: string;
  system: LspSystem;
}): Promise<SymbolQueryScope> {
  const source = createSourceFile(input.filePath, input.text);
  return buildSymbolQueryScope({ files: [source], system: input.system });
}

export function resolveSymbolAtPosition(input: {
  scope: SymbolQueryScope;
  filePath: string;
  position: Position;
}): ResolvedSymbol | null {
  const tokens = input.scope.fileTokens.get(input.filePath);
  const token = tokens ? findTokenAtPosition(tokens, input.position) : null;
  const tokenKind = classifyPositionToken(token);
  if (tokenKind !== 'identifier') return null;

  const ranges = input.scope.resolvedAtRangeByFile.get(input.filePath) ?? [];
  const hit = ranges.find((entry) => rangeContainsPosition(entry.range, input.position));
  if (!hit) return null;

  const symbol = input.scope.symbolsById.get(hit.symbolId);
  if (!symbol) return null;

  return {
    id: symbol.id,
    name: symbol.name,
    nameNormalized: symbol.nameNormalized,
    kind: symbol.kind,
    sourcePath: input.filePath,
    nameRange: hit.range,
    definitionLocations: symbol.definitionLocations,
    canRename: symbol.canRename
  };
}

export function getOccurrences(resolved: ResolvedSymbol, scope: SymbolQueryScope): Map<string, Range[]> {
  const byFile = scope.occurrenceBySymbol.get(resolved.id);
  if (!byFile) return new Map<string, Range[]>();
  const out = new Map<string, Range[]>();
  for (const [filePath, ranges] of byFile.entries()) {
    out.set(filePath, [...ranges]);
  }
  return out;
}

export function isValidRenameIdentifier(name: string): boolean {
  if (!IDENTIFIER_RE.test(name)) return false;
  const normalized = casefold(name);
  if (isKeywordNormalized(normalized)) return false;
  return true;
}

export function hasRenameCollision(input: {
  scope: SymbolQueryScope;
  resolved: ResolvedSymbol;
  newName: string;
}): boolean {
  const normalized = casefold(input.newName);
  for (const symbol of input.scope.symbolsById.values()) {
    if (symbol.id === input.resolved.id) continue;
    if (symbol.nameNormalized !== normalized) continue;

    if (input.resolved.kind === 'customFunction') {
      if (symbol.kind === 'customFunction') return true;
      continue;
    }

    if (input.resolved.kind === 'variable') {
      if (symbol.kind !== 'variable') continue;
      const current = input.scope.symbolsById.get(input.resolved.id);
      if (!current) return false;
      if (symbol.declarationScopeId === current.declarationScopeId) return true;
    }
  }
  return false;
}

export function buildRenameEdits(input: {
  scope: SymbolQueryScope;
  resolved: ResolvedSymbol;
  newName: string;
}): Map<string, SymbolRenameTextEdit[]> {
  const out = new Map<string, SymbolRenameTextEdit[]>();
  const occurrences = getOccurrences(input.resolved, input.scope);
  for (const [filePath, ranges] of occurrences.entries()) {
    out.set(
      filePath,
      ranges.map((range) => ({ range, newText: input.newName }))
    );
  }
  return out;
}

export function isRenameBlockedByToken(input: {
  scope: SymbolQueryScope;
  filePath: string;
  position: Position;
}): boolean {
  const tokens = input.scope.fileTokens.get(input.filePath) ?? [];
  const token = findTokenAtPosition(tokens, input.position);
  if (!token) return true;
  if (token.type === 'CommentLine' || token.type === 'CommentBlock') return true;
  if (token.type === 'String') return true;
  if (token.type === 'Keyword' || token.type === 'Type') return true;
  return false;
}

export function findTokenTypeAtPosition(input: {
  scope: SymbolQueryScope;
  filePath: string;
  position: Position;
}): TokenType | null {
  const tokens = input.scope.fileTokens.get(input.filePath) ?? [];
  const token = findTokenAtPosition(tokens, input.position);
  return token?.type ?? null;
}

export function getWordAtPositionFromScope(input: {
  scope: SymbolQueryScope;
  filePath: string;
  position: Position;
}): string | null {
  const text = input.scope.textByFile.get(input.filePath);
  if (text === undefined) return null;
  const source = createSourceFile(input.filePath, text);
  const offset = positionToOffset(source, input.position);
  let start = offset;
  let end = offset;
  while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1] ?? '')) start -= 1;
  while (end < text.length && /[A-Za-z0-9_]/.test(text[end] ?? '')) end += 1;
  if (start === end) return null;
  return text.slice(start, end);
}

export function symbolKindAllowsRename(kind: SymbolQueryResolvedKind): boolean {
  return kind === 'variable' || kind === 'customFunction';
}

export function prepareRename(input: {
  scope: SymbolQueryScope;
  filePath: string;
  position: Position;
}): PrepareRenameResult | null {
  if (isRenameBlockedByToken({ scope: input.scope, filePath: input.filePath, position: input.position })) {
    return null;
  }
  const resolved = resolveSymbolAtPosition({
    scope: input.scope,
    filePath: input.filePath,
    position: input.position
  });
  if (!resolved) return null;
  if (!resolved.canRename || !symbolKindAllowsRename(resolved.kind)) return null;
  if (resolved.kind === 'internal' || resolved.kind === 'officialFunction') return null;
  return {
    range: resolved.nameRange,
    placeholder: resolved.name,
    kind: resolved.kind
  };
}

export function renameSymbol(input: {
  scope: SymbolQueryScope;
  filePath: string;
  position: Position;
  newName: string;
}): RenameResult {
  if (isRenameBlockedByToken({ scope: input.scope, filePath: input.filePath, position: input.position })) {
    return { ok: false, reason: 'blockedToken' };
  }
  const resolved = resolveSymbolAtPosition({
    scope: input.scope,
    filePath: input.filePath,
    position: input.position
  });
  if (!resolved) return { ok: false, reason: 'symbolNotFound' };
  if (!resolved.canRename || !symbolKindAllowsRename(resolved.kind)) {
    return { ok: false, reason: 'symbolNotRenameable' };
  }
  if (resolved.kind === 'internal' || resolved.kind === 'officialFunction') {
    return { ok: false, reason: 'symbolNotRenameable' };
  }
  const trimmedName = input.newName.trim();
  if (!isValidRenameIdentifier(trimmedName)) return { ok: false, reason: 'invalidName' };
  if (hasRenameCollision({ scope: input.scope, resolved, newName: trimmedName })) {
    return { ok: false, reason: 'collision' };
  }
  const edits = buildRenameEdits({
    scope: input.scope,
    resolved,
    newName: trimmedName
  });
  return { ok: true, edits, resolved };
}
