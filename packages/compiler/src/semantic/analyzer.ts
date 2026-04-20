import {
  buildInvalidParameterCountMessage,
  DiagnosticCodes,
  getDiagnosticConceptualFamily
} from '../diagnostics/codes';
import { makeDiagnostic } from '../diagnostics/engine';
import { getListaMethod, isListaMethodGlobalAllowed, isListaMethodName, isListaProperty } from '../internals/members/lista-methods';
import { getCursorMethodSpec } from '../internals/members/cursor-methods';
import { getInternalSignatures, loadInternalRegistry, type InternalRegistry } from '../internals/registry';
import { getAuthorizedCallSqlLiteral, isEligibleEmbeddedSqlText } from '../embedded-sql/eligibility';
import type { EmbeddedSqlSourceKind, EmbeddedSqlWrapperKind } from '../formatter/types';
import type { SemanticOccurrence, SemanticTokenModifier, SemanticTokenType } from './semantic-tokens';
import type {
  AssignmentNode,
  BlockNode,
  ExpressionNode,
  FileNode,
  FuncDeclNode,
  FuncImplNode,
  IdentifierNode,
  IndexNode,
  MemberNode,
  OrderKey,
  ParamNode,
  TableDeclNode,
  ProgramNode,
  StatementNode,
  TypeName
} from '../parser/ast';
import { casefold } from '../utils/casefold';
import { addSymbol, createScope, forEachSymbol, lookupSymbol, type LspSymbol, type Scope, type ScopeKind } from './symbols';
import type { Diagnostic } from '../index';
import type { Range } from '../source/types';
import { classifySymbolEmission } from './emission-policy';

const CONTROL_FLOW_KEYWORD_IDENTIFIERS = new Set(['pare', 'continue']);

type AnalyzerContext = {
  contextId: string;
  system: 'SENIOR' | 'HCM' | 'ACESSO' | 'ERP';
  registry: InternalRegistry;
  diagnostics: Diagnostic[];
  globalScope: Scope;
  /**
   * When false, global-scope "unused" diagnostics must be suppressed because later files
   * in the context may still reference earlier global declarations.
   */
  isFullContextValidated: boolean;
  occurrencesByFile?: Map<string, SemanticOccurrence[]> | undefined;
  customFunctionDecls: Map<string, { orderKey: { fileIndex: number; startOffset: number }; params: ParamNode[] }>;
  allSymbolsByName: Map<string, Array<{ symbol: LspSymbol; scopeKind: ScopeKind }>>;
  usedIdentifiersByName: Map<string, Array<{ orderKey: { fileIndex: number; startOffset: number } }>>;
  assignedIdentifiersByName: Map<string, Array<{ orderKey: { fileIndex: number; startOffset: number }; insideCustomFunction: boolean }>>;
  declaredTypesByName: Map<
    string,
    {
      typeName: TypeName;
      declaredAt: { fileIndex: number; startOffset: number };
      sourcePath: string;
      declRange: Range;
      implicit: boolean;
    }
  >;
  implicitNumeroAssignmentsByName: Map<string, { fileIndex: number; startOffset: number }>;
  endParamsAssignedByCall: Set<LspSymbol>;
  endParamsExplicitlyAssigned: Set<LspSymbol>;
  endParamCallDiagnostics: Array<{ symbol: LspSymbol; diagnostic: Diagnostic }>;
  labelsByFileAndScope: Map<string, Map<string, Set<string>>>;
  functionScopeKeyById: Map<string, string>;
};

export type SemanticDeclContrib = {
  diagnostics: Diagnostic[];
  symbolsByName: Array<{ nameNormalized: string; entries: Array<{ symbol: LspSymbol; scopeKind: ScopeKind }> }>;
  declaredTypesByName: Array<{
    nameNormalized: string;
    value: {
      typeName: TypeName;
      declaredAt: { fileIndex: number; startOffset: number };
      sourcePath: string;
      declRange: Range;
      implicit: boolean;
    };
  }>;
  occurrences?: SemanticOccurrence[] | undefined;
};

export type SemanticBodyContrib = {
  diagnostics: Diagnostic[];
  symbolsByName: Array<{ nameNormalized: string; entries: Array<{ symbol: LspSymbol; scopeKind: ScopeKind }> }>;
  usedIdentifiersByName: Array<{ nameNormalized: string; entries: Array<{ orderKey: { fileIndex: number; startOffset: number } }> }>;
  assignedIdentifiersByName: Array<{ nameNormalized: string; entries: Array<{ orderKey: { fileIndex: number; startOffset: number }; insideCustomFunction: boolean }> }>;
  declaredTypesByName: Array<{
    nameNormalized: string;
    value: {
      typeName: TypeName;
      declaredAt: { fileIndex: number; startOffset: number };
      sourcePath: string;
      declRange: Range;
      implicit: boolean;
    };
  }>;
  implicitNumeroAssignmentsByName: Array<{
    nameNormalized: string;
    value: { fileIndex: number; startOffset: number };
  }>;
  endParamsAssignedByCall: LspSymbol[];
  endParamsExplicitlyAssigned: LspSymbol[];
  endParamCallDiagnostics: Array<{ symbol: LspSymbol; diagnostic: Diagnostic }>;
  occurrences?: SemanticOccurrence[] | undefined;
};

export type SemanticFileCache = {
  filePath: string;
  fileIndex: number;
  versionKey: string;
  topLevelDeclaredNames: string[];
  /** Fingerprint of top-level declarations (name + signature/type). Used to detect structural changes even when names are unchanged. */
  topLevelDeclFingerprint?: string;
  declContrib?: SemanticDeclContrib;
  bodyContrib: SemanticBodyContrib;
};

export type SemanticCache = {
  files: SemanticFileCache[];
};

type FuncRecord = {
  decl: FuncDeclNode | null;
  impl: FuncImplNode | null;
};

function atribuirEscopo(node: { scopeId?: string } | null, scope: Scope): void {
  if (!node) return;
  node.scopeId = scope.id;
}

function orderCompare(a: { fileIndex: number; startOffset: number }, b: { fileIndex: number; startOffset: number }): number {
  if (a.fileIndex !== b.fileIndex) return a.fileIndex - b.fileIndex;
  return a.startOffset - b.startOffset;
}

function isInsideFunctionScope(scope: Scope): boolean {
  let current: Scope | null = scope;
  while (current) {
    if (current.kind === 'function') return true;
    current = current.parent;
  }
  return false;
}

function isNumero(typeName: TypeName): boolean {
  return typeName === 'Numero';
}

function typeFromParam(param: ParamNode): TypeName {
  return param.typeName;
}

function typeNameFromIdentifier(name: string): TypeName {
  switch (casefold(name)) {
    case 'alfa':
      return 'Alfa';
    case 'numero':
      return 'Numero';
    case 'data':
      return 'Data';
    case 'funcao':
      return 'Funcao';
    case 'lista':
      return 'Lista';
    case 'cursor':
      return 'Cursor';
    case 'tabela':
      return 'Tabela';
    default:
      return 'Desconhecido';
  }
}

function pushDiagnostic(ctx: AnalyzerContext, diagnostic: Diagnostic): void {
  ctx.diagnostics.push(makeDiagnostic(diagnostic));
}

function mkDiag(ctx: AnalyzerContext, input: Omit<Diagnostic, 'contextId'>): Diagnostic {
  const conceptualFamily = input.conceptualFamily ?? getDiagnosticConceptualFamily(input.id);
  return {
    ...input,
    ...(conceptualFamily ? { conceptualFamily } : {}),
    contextId: ctx.contextId
  };
}

function recordOccurrence(
  ctx: AnalyzerContext,
  sourcePath: string,
  range: { start: { line: number; character: number }; end: { line: number; character: number } },
  tokenType: SemanticTokenType,
  tokenModifiers: SemanticTokenModifier[] = [],
  embeddedSql?: { wrapperKind: EmbeddedSqlWrapperKind; sourceKind: EmbeddedSqlSourceKind }
): void {
  if (!ctx.occurrencesByFile) return;
  const list = ctx.occurrencesByFile.get(sourcePath) ?? [];
  list.push({ sourcePath, range, tokenType, tokenModifiers, ...(embeddedSql ? { embeddedSql } : {}) });
  ctx.occurrencesByFile.set(sourcePath, list);
}

function recordEmbeddedSqlLiteralOccurrence(
  ctx: AnalyzerContext,
  literal: ExpressionNode | null,
  embeddedSql: { wrapperKind: EmbeddedSqlWrapperKind; sourceKind: EmbeddedSqlSourceKind }
): void {
  if (!literal || literal.kind !== 'StringLiteral') return;
  const raw = literal.value.slice(1, -1);
  if (!isEligibleEmbeddedSqlText(raw)) return;
  recordOccurrence(ctx, literal.sourcePath, literal.range, 'string', ['defaultLibrary', 'readonly'], embeddedSql);
}

function recordSymbolOccurrence(ctx: AnalyzerContext, id: IdentifierNode, symbol: LspSymbol): void {
  const emission = classifySymbolEmission({
    symbol,
    // Internal constants should always be highlighted as defaultLibrary, even if they were
    // resolved as regular variables due to shadowing or parser fallbacks.
    isKnownInternalVariable: ctx.registry.internalVariables.has(symbol.nameNormalized),
    isGlobalScopeSymbol: symbol.scopeId === ctx.globalScope.id
  });
  if (emission) {
    recordOccurrence(ctx, id.sourcePath, id.range, emission.tokenType, emission.tokenModifiers);
  }
}


function recordAssignedIdentifier(ctx: AnalyzerContext, scope: Scope, id: IdentifierNode): void {
  const list = ctx.assignedIdentifiersByName.get(id.nameNormalized) ?? [];
  // Determinism: avoid accumulating duplicate writes across incremental merges / cached contribs.
  // This must be idempotent for the same (fileIndex,startOffset).
  for (const entry of list) {
    if (entry.orderKey.fileIndex === id.orderKey.fileIndex && entry.orderKey.startOffset === id.orderKey.startOffset) {
      ctx.assignedIdentifiersByName.set(id.nameNormalized, list);
      return;
    }
  }
  list.push({ orderKey: id.orderKey, insideCustomFunction: isInsideFunctionScope(scope) });
  ctx.assignedIdentifiersByName.set(id.nameNormalized, list);
}

function addSymbolCtx(ctx: AnalyzerContext, scope: Scope, symbol: LspSymbol): void {
  addSymbol(scope, symbol);
  const list = ctx.allSymbolsByName.get(symbol.nameNormalized) ?? [];
  list.push({ symbol, scopeKind: scope.kind });
  ctx.allSymbolsByName.set(symbol.nameNormalized, list);
}

function isSameDeclarationSymbol(symbol: LspSymbol | null, stmt: Extract<StatementNode, { kind: 'VarDecl' }>): boolean {
  if (!symbol) return false;
  return (
    symbol.kind === 'variable'
    && symbol.sourcePath === stmt.sourcePath
    && symbol.declaredAt.fileIndex === stmt.orderKey.fileIndex
    && symbol.declaredAt.startOffset === stmt.orderKey.startOffset
  );
}

function parseTableOccurrencesLiteral(tableDecl: TableDeclNode | undefined): number | undefined {
  const occurrencesRaw = tableDecl?.occurrencesLiteral?.trim() ?? '';
  if (!occurrencesRaw) return undefined;
  const occurrences = Number.parseInt(occurrencesRaw, 10);
  if (!Number.isFinite(occurrences) || occurrences <= 0) return undefined;
  return occurrences;
}

function buildTableFieldsForDeclaration(stmt: Extract<StatementNode, { kind: 'VarDecl' }>): Map<string, LspSymbol> | undefined {
  if (stmt.typeName !== 'Tabela' || !stmt.tableDecl) return undefined;
  const fields = new Map<string, LspSymbol>();
  for (const column of stmt.tableDecl.columns) {
    if (!column.nameNormalized) continue;
    if (column.typeName !== 'Alfa' && column.typeName !== 'Numero' && column.typeName !== 'Data') continue;
    fields.set(column.nameNormalized, {
      kind: 'field',
      name: column.name,
      nameNormalized: column.nameNormalized,
      typeName: column.typeName,
      declaredAt: stmt.orderKey,
      range: column.nameRange ?? column.declRange,
      sourcePath: stmt.sourcePath,
      scopeId: '',
      used: false,
      assigned: false,
      readonly: false
    });
  }
  return fields;
}

function predeclareBlockVariables(ctx: AnalyzerContext, scope: Scope, block: BlockNode): void {
  for (const stmt of block.statements) {
    if (stmt.kind !== 'VarDecl') continue;
    const existing = (scope.symbols.get(stmt.nameNormalized) ?? []).find((symbol) => isSameDeclarationSymbol(symbol, stmt));
    if (existing) continue;
    const symbol: LspSymbol = {
      kind: 'variable',
      name: stmt.name,
      nameNormalized: stmt.nameNormalized,
      typeName: stmt.typeName,
      declaredAt: stmt.orderKey,
      range: stmt.range,
      sourcePath: stmt.sourcePath,
      scopeId: scope.id,
      used: false,
      assigned: false,
      outsideFunctionScope: !isInsideFunctionScope(scope),
      predeclared: true
    };
    const fields = buildTableFieldsForDeclaration(stmt);
    if (fields) {
      for (const field of fields.values()) {
        field.scopeId = scope.id;
      }
      symbol.fields = fields;
      const tableOccurrences = parseTableOccurrencesLiteral(stmt.tableDecl);
      if (tableOccurrences !== undefined) {
        symbol.tableOccurrences = tableOccurrences;
      }
    }
    addSymbolCtx(ctx, scope, symbol);
  }
}

function findPriorDeclaredVariable(
  ctx: AnalyzerContext,
  nameNormalized: string,
  declaredAt: { fileIndex: number; startOffset: number }
): LspSymbol | null {
  const list = ctx.allSymbolsByName.get(nameNormalized);
  if (!list || list.length === 0) return null;
  for (const entry of list) {
    const symbol = entry.symbol;
    if (symbol.kind !== 'variable' || symbol.implicit) continue;
    if (orderCompare(symbol.declaredAt, declaredAt) <= 0) return symbol;
  }
  return null;
}

function findAnyPriorDefinition(
  ctx: AnalyzerContext,
  nameNormalized: string,
  declaredAt: { fileIndex: number; startOffset: number }
): LspSymbol | null {
  const list = ctx.allSymbolsByName.get(nameNormalized);
  if (!list || list.length === 0) return null;
  for (const entry of list) {
    const symbol = entry.symbol;
    if (symbol.kind === 'function') continue;
    if (orderCompare(symbol.declaredAt, declaredAt) <= 0) return symbol;
  }
  return null;
}

function findPriorOutsideFunctionDeclaration(
  ctx: AnalyzerContext,
  nameNormalized: string,
  declaredAt: { fileIndex: number; startOffset: number }
): LspSymbol | null {
  const list = ctx.allSymbolsByName.get(nameNormalized);
  if (!list || list.length === 0) return null;
  for (const entry of list) {
    const symbol = entry.symbol;
    if (symbol.kind !== 'variable' || symbol.implicit || !symbol.outsideFunctionScope) continue;
    if (orderCompare(symbol.declaredAt, declaredAt) <= 0) return symbol;
  }
  return null;
}

function declareImplicitNumero(
  ctx: AnalyzerContext,
  scope: Scope,
  id: IdentifierNode,
  declaredAt: { fileIndex: number; startOffset: number } = id.orderKey,
  isAssignmentTarget: boolean = false
): LspSymbol {
  // Explicit prior declarations must win over implicit/derived symbols.
  // Otherwise an earlier implicit Numero can mask a real type conflict and
  // make LSP1002 disappear nondeterministically in full-context runs.
  const prior = findPriorDeclaredVariable(ctx, id.nameNormalized, declaredAt);
  if (prior && prior.typeName !== 'Numero') {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.VariableTypeConflict,
        severity: 'Error',
        message: `Variável já declarada com outro tipo: ${id.name}`,
        sourcePath: id.sourcePath,
        range: id.range
      })
    );
    return prior;
  }
  const anyDef = findAnyPriorDefinition(ctx, id.nameNormalized, declaredAt);
  if (anyDef) {
    if (anyDef.typeName !== 'Numero') {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.VariableTypeConflict,
          severity: 'Error',
          message: `Variável já declarada com outro tipo: ${id.name}`,
          sourcePath: id.sourcePath,
          range: id.range
        })
      );
    } else if (anyDef.scopeId !== ctx.globalScope.id) {
    }
    return anyDef;
  }
  const existing = ctx.declaredTypesByName.get(id.nameNormalized);
  if (existing && existing.typeName !== 'Numero') {
    const cmp = orderCompare(existing.declaredAt, declaredAt);
    if (cmp <= 0) {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.VariableTypeConflict,
          severity: 'Error',
          message: `Variável já declarada com outro tipo: ${id.name}`,
          sourcePath: existing.sourcePath,
          range: existing.declRange
        })
      );
    }
  } else if (!existing) {
    ctx.declaredTypesByName.set(id.nameNormalized, {
      typeName: 'Numero',
      declaredAt,
      sourcePath: id.sourcePath,
      declRange: id.range,
      implicit: true
    });
  }
  const symbol: LspSymbol = createVariableSymbol({
    name: id.name,
    nameNormalized: id.nameNormalized,
    typeName: 'Numero',
    declaredAt,
    range: id.range,
    sourcePath: id.sourcePath,
    scopeId: scope.id,
    used: true,
    assigned: isAssignmentTarget,
    implicit: true
  });
  addSymbolCtx(ctx, scope, symbol);
  return symbol;
}

/**
 * Factory única para criação de símbolos de variável.
 *
 * Observação: esta função é propositalmente "pura" (não registra em escopos/índices).
 * Os side-effects (addSymbolCtx / recordSymbolOccurrence / recordAssignedIdentifier)
 * ficam onde já existiam, para não alterar semântica.
 */
function createVariableSymbol(args: {
  name: string;
  nameNormalized: string;
  typeName: TypeName;
  declaredAt: OrderKey;
  range: Range;
  sourcePath: string;
  scopeId: string;
  used: boolean;
  assigned: boolean;
  implicit?: boolean;
  outsideFunctionScope?: boolean;
}): LspSymbol {
  return {
    kind: 'variable',
    name: args.name,
    nameNormalized: args.nameNormalized,
    typeName: args.typeName,
    declaredAt: args.declaredAt,
    range: args.range,
    sourcePath: args.sourcePath,
    scopeId: args.scopeId,
    used: args.used,
    assigned: args.assigned,
    ...(args.implicit !== undefined ? { implicit: args.implicit } : {}),
    ...(args.outsideFunctionScope !== undefined ? { outsideFunctionScope: args.outsideFunctionScope } : {})
  };
}

function ensureFields(symbol: LspSymbol): Map<string, LspSymbol> {
  if (!symbol.fields) {
    symbol.fields = new Map();
  }
  return symbol.fields;
}

function addField(symbol: LspSymbol, name: string, typeName: TypeName, readonly: boolean, ref: IdentifierNode): void {
  const fields = ensureFields(symbol);
  const key = casefold(name);
  if (fields.has(key)) return;
  fields.set(key, {
    kind: 'field',
    name,
    nameNormalized: key,
    typeName,
    declaredAt: ref.orderKey,
    range: ref.range,
    sourcePath: ref.sourcePath,
    scopeId: symbol.scopeId,
    used: false,
    assigned: false,
    readonly
  });
}

function validateTableDeclaration(ctx: AnalyzerContext, tableName: string, sourcePath: string, tableDecl: TableDeclNode): void {
  const occurrencesRaw = tableDecl.occurrencesLiteral?.trim() ?? '';
  const occurrencesRange = tableDecl.occurrencesRange ?? tableDecl.range;
  const occurrencesNumber = Number.parseInt(occurrencesRaw, 10);
  if (!occurrencesRaw || !Number.isFinite(occurrencesNumber) || occurrencesNumber <= 0) {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.TableOccurrencesInvalid,
        severity: 'Error',
        message: `Tabela ${tableName}: ocorrências devem ser inteiro positivo`,
        sourcePath,
        range: occurrencesRange
      })
    );
  }

  if (tableDecl.columns.length === 0) {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.TableEmpty,
        severity: 'Error',
        message: `Tabela ${tableName}: deve possuir pelo menos uma coluna`,
        sourcePath,
        range: tableDecl.range
      })
    );
    return;
  }

  const seenColumns = new Map<string, { range: Range; name: string }>();
  for (const column of tableDecl.columns) {
    const colRange = column.nameRange ?? column.declRange;
    if (!column.nameNormalized) {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.TableColumnNameMissing,
          severity: 'Error',
          message: `Tabela ${tableName}: coluna sem nome`,
          sourcePath,
          range: colRange
        })
      );
      continue;
    }

    if (column.typeName !== 'Alfa' && column.typeName !== 'Numero' && column.typeName !== 'Data') {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.TableColumnTypeInvalid,
          severity: 'Error',
          message: `Tabela ${tableName}: tipo de coluna inválido (${column.name})`,
          sourcePath,
          range: colRange
        })
      );
    }

    const duplicate = seenColumns.get(column.nameNormalized);
    if (duplicate) {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.TableColumnDuplicated,
          severity: 'Error',
          message: `Tabela ${tableName}: coluna duplicada (${column.name})`,
          sourcePath,
          range: colRange
        })
      );
    } else {
      seenColumns.set(column.nameNormalized, { range: colRange, name: column.name });
    }

    const sizeRaw = column.sizeLiteral?.trim();
    if (sizeRaw !== undefined) {
      const sizeNumber = Number.parseInt(sizeRaw, 10);
      if (column.typeName === 'Alfa') {
        if (!Number.isFinite(sizeNumber) || sizeNumber <= 0) {
          pushDiagnostic(
            ctx,
            mkDiag(ctx, {
              id: DiagnosticCodes.TableColumnSizeInvalid,
              severity: 'Error',
              message: `Tabela ${tableName}: tamanho inválido em coluna Alfa (${column.name})`,
              sourcePath,
              range: column.sizeRange ?? colRange
            })
          );
        }
      } else if (column.typeName === 'Numero' || column.typeName === 'Data') {
        pushDiagnostic(
          ctx,
          mkDiag(ctx, {
            id: DiagnosticCodes.TableColumnSizeNotAllowed,
            severity: 'Error',
            message: `Tabela ${tableName}: tamanho não permitido para coluna ${column.typeName} (${column.name})`,
            sourcePath,
            range: column.sizeRange ?? colRange
          })
        );
      }
    }
  }
}

function extractSelectFields(sqlLiteral: string): string[] {
  // Only the first SELECT matters.
  const selectMatch = /select\s+(distinct\s+)?([\s\S]*?)\s+from\b/i.exec(sqlLiteral);
  if (!selectMatch) return [];
  const projection = selectMatch[2] ?? '';
  return projection
    .split(',')
    .map((part) => part.trim())
    .flatMap((part) => {
      if (part === '*' || part.endsWith('.*')) return '';
      // Handle aliases: "campo as alias" or "t.campo alias"
      const asMatch = /\bas\s+([A-Za-z_][A-Za-z0-9_]*)$/i.exec(part);
      if (asMatch) return asMatch[1] ? [asMatch[1]] : [];
      const tokens = part.split(/\s+/).filter(Boolean);
      const last = tokens[tokens.length - 1] ?? part;
      const dotSplit = last.split('.');
      const clean = (dotSplit[dotSplit.length - 1] ?? '').replace(/[^A-Za-z0-9_]/g, '');
      return clean ? [clean] : [];
    })
    .filter((name): name is string => name.length > 0);
}

function extractSqlBindNames(sqlLiteral: string): string[] {
  const names: string[] = [];
  const re = /:([A-Za-z_][A-Za-z0-9_]*)/g;
  while (true) {
    const match = re.exec(sqlLiteral);
    if (match === null) break;
    const name = match[1];
    if (name) names.push(casefold(name));
  }
  return names;
}

function checkCursorSql(ctx: AnalyzerContext, cursorSymbol: LspSymbol, value: ExpressionNode, targetProp: IdentifierNode): void {
  if (value.kind !== 'StringLiteral') return;
  const raw = value.value.slice(1, -1);
  const hasSelect = /select\b/i.test(raw);
  if (!hasSelect) {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.CursorSqlMissingSelect,
        severity: 'Error',
        message: 'Cursor.SQL deve conter um SELECT',
        sourcePath: targetProp.sourcePath,
        range: targetProp.range
      })
    );
    return;
  }

  const fields = extractSelectFields(raw);
  for (const field of fields) {
    addField(cursorSymbol, field, 'Desconhecido', true, targetProp);
  }
}

function markIdentifierUsed(scope: Scope, nameNormalized: string): void {
  const found = lookupSymbol(scope, nameNormalized).symbol;
  if (found && found.kind !== 'function') {
    found.used = true;
  }
}

function resolveSymbol(ctx: AnalyzerContext, scope: Scope, id: IdentifierNode, isAssignmentTarget: boolean): LspSymbol {
  atribuirEscopo(id, scope);
  const implicitAssign = ctx.implicitNumeroAssignmentsByName.get(id.nameNormalized);
  const declaredTypeRaw = ctx.declaredTypesByName.get(id.nameNormalized);
  const declaredType =
    declaredTypeRaw && orderCompare(declaredTypeRaw.declaredAt, id.orderKey) <= 0
      ? declaredTypeRaw
      : undefined;
  if (!declaredType && implicitAssign && orderCompare(implicitAssign, id.orderKey) <= 0) {
    const lookupImplicit = lookupSymbol(scope, id.nameNormalized);
    const foundImplicit = lookupImplicit.symbol;
    if (!foundImplicit || foundImplicit.typeName !== 'Numero') {
      // IMPORTANT: even on the fast-path we must record assignment + occurrence, otherwise:
      // - write counting becomes incorrect (breaks LSP1203 ">= 2 writes" rule)
      // - incremental/determinism tests can diverge depending on cache paths.
      const symbol = declareImplicitNumero(ctx, scope, id, implicitAssign, isAssignmentTarget);
      if (isAssignmentTarget) {
        recordAssignedIdentifier(ctx, scope, id);
      }
      recordSymbolOccurrence(ctx, id, symbol);
      return symbol;
    }
  }

  const lookup = lookupSymbol(scope, id.nameNormalized);
  const found = lookup.symbol;
  if (!found) {
    if (declaredType) {
      const symbol = createVariableSymbol({
        name: id.name,
        nameNormalized: id.nameNormalized,
        typeName: declaredType.typeName,
        declaredAt: declaredType.declaredAt,
        range: id.range,
        sourcePath: id.sourcePath,
        scopeId: scope.id,
        used: true,
        assigned: isAssignmentTarget,
        implicit: declaredType.implicit
      });
      if (isAssignmentTarget) {
        recordAssignedIdentifier(ctx, scope, id);
      }
      recordSymbolOccurrence(ctx, id, symbol);
      return symbol;
    }

    // Variáveis internas: sempre existem (inclusive como alvo de atribuição).
    // Importante para evitar falso LSP1005 em WEB_HTML e similares.
    const internalConstant = ctx.registry.internalVariables.get(id.nameNormalized);
    if (internalConstant) {
      const symbol: LspSymbol = {
        kind: 'internal',
        name: internalConstant.name,
        nameNormalized: internalConstant.nameNormalized,
        typeName: internalConstant.dataType,
        declaredAt: id.orderKey,
        range: id.range,
        sourcePath: id.sourcePath,
        scopeId: scope.id,
        used: true,
        assigned: isAssignmentTarget,
        isConst: internalConstant.isConst
      };
      recordSymbolOccurrence(ctx, id, symbol);
      return symbol;
    }
    if (isAssignmentTarget && !implicitAssign) {
      const symbol = declareImplicitNumero(ctx, scope, id);
      symbol.assigned = true;
      recordAssignedIdentifier(ctx, scope, id);
      recordSymbolOccurrence(ctx, id, symbol);
      return symbol;
    }
    const globalMatch = lookupSymbol(ctx.globalScope, id.nameNormalized).symbol;
    if (globalMatch && globalMatch.kind !== 'function') {
      globalMatch.used = true;
      if (isAssignmentTarget) {
        globalMatch.assigned = true;
        recordAssignedIdentifier(ctx, scope, id);
      }
      recordSymbolOccurrence(ctx, id, globalMatch);
      return globalMatch;
    }
    if (!isInsideFunctionScope(scope)) {
      const fallback = findPriorOutsideFunctionDeclaration(ctx, id.nameNormalized, id.orderKey);
      if (fallback) {
        fallback.used = true;
        if (isAssignmentTarget) {
          fallback.assigned = true;
          recordAssignedIdentifier(ctx, scope, id);
        }
        recordSymbolOccurrence(ctx, id, fallback);
        return fallback;
      }
    }
    // Unknown identifier on read: do not create implicit Numero.
    const unknownSymbol: LspSymbol = createVariableSymbol({
      name: id.name,
      nameNormalized: id.nameNormalized,
      typeName: 'Desconhecido',
      declaredAt: id.orderKey,
      range: id.range,
      sourcePath: id.sourcePath,
      scopeId: scope.id,
      used: true,
      assigned: false,
      implicit: true
    });
    recordSymbolOccurrence(ctx, id, unknownSymbol);
    return unknownSymbol;
  }

  if (found.implicit && declaredType && declaredType.typeName !== found.typeName) {
    const symbol = createVariableSymbol({
      name: id.name,
      nameNormalized: id.nameNormalized,
      typeName: declaredType.typeName,
      declaredAt: declaredType.declaredAt,
      range: id.range,
      sourcePath: id.sourcePath,
      scopeId: scope.id,
      used: true,
      assigned: false,
      implicit: declaredType.implicit
    });
    recordSymbolOccurrence(ctx, id, symbol);
    return symbol;
  }

  found.used = true;

  if (isAssignmentTarget && scope.kind === 'global' && !isNumero(found.typeName)) {
    const cmpAssign = orderCompare(found.declaredAt, id.orderKey);
    if (cmpAssign > 0) {
      return declareImplicitNumero(ctx, scope, id, id.orderKey, true);
    }
  }

  if (!isNumero(found.typeName)) {
    const cmp = orderCompare(found.declaredAt, id.orderKey);
    const sameScope = lookup.scope?.id === scope.id;
    if (cmp > 0 && sameScope) {
      if (isAssignmentTarget && scope.kind === 'global') {
        return found;
      }
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.UseBeforeDeclaration,
          severity: 'Warning',
          message: `Uso antes da declaração: ${id.name}`,
          sourcePath: id.sourcePath,
          range: id.range
        })
      );
    }
  }

  if (isAssignmentTarget) {
    found.assigned = true;
    recordAssignedIdentifier(ctx, scope, id);
    if (found.kind === 'parameter' && found.isEndParam) {
      ctx.endParamsExplicitlyAssigned.add(found);
    }
  }

  recordSymbolOccurrence(ctx, id, found);
  return found;
}

const MENSAGEM_FIRST_ARG_ALLOWED = new Set(['retorna', 'erro', 'refaz']);

function extractMensagemMode(arg: ExpressionNode): { value: string | null; identifier: IdentifierNode | null } {
  if (arg.kind === 'Identifier') {
    return { value: arg.nameNormalized, identifier: arg };
  }
  if (arg.kind === 'StringLiteral') {
    return { value: casefold(arg.value.slice(1, -1).trim()), identifier: null };
  }
  if (arg.kind === 'Paren' && arg.expr) {
    return extractMensagemMode(arg.expr);
  }
  return { value: null, identifier: null };
}

function validateMensagemFirstArg(ctx: AnalyzerContext, call: Extract<ExpressionNode, { kind: 'Call' }>): void {
  const firstArg = call.args[0];
  if (!firstArg) return;

  const mode = extractMensagemMode(firstArg);
  if (mode.value && MENSAGEM_FIRST_ARG_ALLOWED.has(mode.value)) {
    return;
  }

  pushDiagnostic(
    ctx,
    mkDiag(ctx, {
      id: DiagnosticCodes.MensagemTipoInvalido,
      severity: 'Error',
      message: 'Primeiro parâmetro de Mensagem deve ser Retorna, Erro ou Refaz',
      sourcePath: firstArg.sourcePath,
      range: firstArg.range
    })
  );
}

function isMensagemFirstArgAllowed(arg: ExpressionNode): boolean {
  const mode = extractMensagemMode(arg);
  return Boolean(mode.value && MENSAGEM_FIRST_ARG_ALLOWED.has(mode.value));
}

function typeCheckCall(ctx: AnalyzerContext, scope: Scope, node: ExpressionNode): void {
  atribuirEscopo(node, scope);
  if (node.kind !== 'Call') return;

  if (node.callee.kind === 'Member') {
    const member = node.callee;
    if (member.object.kind === 'Identifier') {
      const objSymbol = resolveSymbol(ctx, scope, member.object, false);
      const cursorMethod = objSymbol.typeName === 'Cursor' ? getCursorMethodSpec(member.property.name) : undefined;
      const listaMethod = objSymbol.typeName === 'Lista' ? getListaMethod(member.property.name) : undefined;
      if (cursorMethod || listaMethod) {
        recordOccurrence(ctx, member.property.sourcePath, member.property.range, 'method', ['defaultLibrary']);
      }

      // Highlight dynamic fields for Lista/Cursor only when referenced via string literal and the field is known.
      if (objSymbol.fields && (objSymbol.typeName === 'Lista' || objSymbol.typeName === 'Cursor')) {
        for (const arg of node.args) {
          if (arg.kind !== 'StringLiteral') continue;
          const raw = arg.value.slice(1, -1).trim();
          if (!raw) continue;
          const key = casefold(raw);
          if (objSymbol.fields.get(key)) {
            recordOccurrence(ctx, arg.sourcePath, arg.range, 'property');
          }
        }
      }
      if (cursorMethod) {
        if (node.args.length < cursorMethod.minArgs || node.args.length > cursorMethod.maxArgs) {
          const expected =
            cursorMethod.minArgs === cursorMethod.maxArgs
              ? `${cursorMethod.minArgs}`
              : `${cursorMethod.minArgs}..${cursorMethod.maxArgs}`;
          pushDiagnostic(
            ctx,
            mkDiag(ctx, {
              id: DiagnosticCodes.CursorMethodArityMismatch,
              severity: 'Warning',
              message: buildInvalidParameterCountMessage(member.property.name, expected, node.args.length),
              sourcePath: node.sourcePath,
              range: node.range
            })
          );
        }
        return;
      }
    }
  }

  if (tryValidateListaCall(ctx, scope, node)) {
    return;
  }

  let calleeName: string | null = null;
  if (node.callee.kind === 'Identifier') {
    calleeName = node.callee.name;
  } else if (node.callee.kind === 'Member' && node.callee.property.kind === 'Identifier') {
    calleeName = node.callee.property.name;
  }

  if (!calleeName) return;

  if (node.callee.kind === 'Identifier') {
    // For syntax highlighting, do not distinguish internal vs custom functions.
    // Both are emitted as the same semantic token type.
    recordOccurrence(ctx, node.callee.sourcePath, node.callee.range, 'function', []);
  }

  if (casefold(calleeName) === 'sql_definircomando') {
    const sqlArg = node.args[1];
    if (sqlArg && sqlArg.kind === 'StringLiteral') {
      const raw = sqlArg.value.slice(1, -1);
      const binds = extractSqlBindNames(raw);
      for (const bind of binds) {
        markIdentifierUsed(scope, bind);
      }
    }
  }

  const authorizedSqlLiteral = getAuthorizedCallSqlLiteral(node);
  if (authorizedSqlLiteral) {
    recordEmbeddedSqlLiteralOccurrence(
      ctx,
      authorizedSqlLiteral.literal,
      {
        wrapperKind: casefold(authorizedSqlLiteral.ownerName) === 'execsqlex' ? 'execsqlex' : 'sql_definircomando',
        sourceKind: 'direct_literal'
      }
    );
  }

  if (node.callee.kind === 'Identifier' && isListaMethodName(calleeName) && !isListaMethodGlobalAllowed(calleeName)) {
    const internalSigs = getInternalSignatures(ctx.registry, calleeName);
    const hasInternal = internalSigs.length > 0;
    const matchesInternalArity = internalSigs.some((sig) => sig.paramTypes.length === node.args.length);
    if (hasInternal && node.args.length > 0 && matchesInternalArity) {
      // Treat as internal function when signature matches.
    } else {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.ListaMethodGlobalOnly,
        severity: 'Error',
        message: `Método de lista deve ser chamado a partir de uma variável do tipo Lista: ${calleeName}`,
        sourcePath: node.sourcePath,
        range: node.range
      })
    );
    return;
    }
  }

  if (casefold(calleeName) === 'convertemascara') {
    if (validateConverteMascara(ctx, scope, node)) {
      return;
    }
  }

  const calleeNorm = casefold(calleeName);
  const customDecl = ctx.customFunctionDecls.get(calleeNorm);
  if (customDecl) {
    if (orderCompare(customDecl.orderKey, node.orderKey) > 0) {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.UseBeforeDeclaration,
          severity: 'Warning',
          message: `Uso antes da declaração: ${calleeName}`,
          sourcePath: node.sourcePath,
          range: node.range
        })
      );
    }
    validateAgainstParams(ctx, scope, node, customDecl.params, calleeName);
    return;
  }
  const symbol = lookupSymbol(scope, calleeNorm).symbol;

  if (symbol && symbol.kind === 'function' && symbol.params) {
    validateAgainstParams(ctx, scope, node, symbol.params, calleeName);
    return;
  }

  const internal = getInternalSignatures(ctx.registry, calleeName);
  if (internal.length === 0) {
    // Unknown function call (identifier): emit explicit error.
    if (node.callee.kind === 'Identifier' && !symbol) {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.FunctionNotFound,
          severity: 'Error',
          message: `Função inexistente: ${calleeName}`,
          sourcePath: node.sourcePath,
          range: node.range
        })
      );
    }
    return;
  }

  const ordered = [...internal].sort((a, b) => {
    const score = (sig: typeof a) => {
      if (ctx.system !== 'SENIOR' && sig.system === ctx.system) return 0;
      if (sig.system === 'SENIOR') return 1;
      return 2;
    };
    return score(a) - score(b);
  });

  const matchingArity = ordered.filter((sig) => sig.paramTypes.length === node.args.length);
  const targetSig = matchingArity[0] ?? ordered[0];
  if (!targetSig) return;
  if (casefold(calleeName) === 'mensagem') {
    validateMensagemFirstArg(ctx, node);
  }
  if (targetSig.params && targetSig.params.length === node.args.length) {
    for (let i = 0; i < targetSig.params.length; i += 1) {
      const param = targetSig.params[i];
      if (!param) continue;
      if (!param.isReturnValue) continue;
      const arg = node.args[i];
      if (!arg) continue;
      if (!isEndParamAssignableExpression(arg)) {
        emitEndParamRequiresVariableDiagnostic(ctx, arg, calleeName, i + 1);
        continue;
      }
      if (arg.kind === 'Identifier') {
        if (targetSig.paramTypes[i] === 'Numero') {
          ensureImplicitNumeroForEndArgument(ctx, scope, arg);
        } else {
          resolveSymbol(ctx, scope, arg, false);
        }
        const sym = lookupSymbol(scope, arg.nameNormalized).symbol;
        if (sym?.kind === 'parameter' && sym.isEndParam) {
          ctx.endParamsAssignedByCall.add(sym);
        }
      }
    }
  }
  validateAgainstTypes(ctx, scope, node, targetSig.paramTypes, calleeName, true);
}

function isCustomFunctionCall(ctx: AnalyzerContext, call: Extract<ExpressionNode, { kind: 'Call' }>): boolean {
  if (call.callee.kind !== 'Identifier') return false;
  if (ctx.customFunctionDecls.has(call.callee.nameNormalized)) return true;
  const sym = lookupSymbol(ctx.globalScope, call.callee.nameNormalized).symbol;
  return sym?.kind === 'function';
}

function validateConverteMascara(ctx: AnalyzerContext, scope: Scope, call: Extract<ExpressionNode, { kind: 'Call' }>): boolean {
  atribuirEscopo(call, scope);
  const argCount = call.args.length;
  if (argCount !== 4) {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.ConverteMascaraArityMismatch,
        severity: 'Error',
        message: buildInvalidParameterCountMessage('ConverteMascara', '4', argCount),
        sourcePath: call.sourcePath,
        range: call.range
      })
    );
    return true;
  }

  const tipoArg = call.args[0];
  const alfaDestino = call.args[2];
  const mascara = call.args[3];
  if (!tipoArg || !alfaDestino || !mascara) return true;

  const isAssignableExpr = (expr: ExpressionNode): boolean =>
    expr.kind === 'Identifier' || expr.kind === 'Member' || expr.kind === 'Index';

  const hasAlfaInOtherScope = (nameNormalized: string, currentScopeId: string): boolean => {
    const list = ctx.allSymbolsByName.get(nameNormalized);
    if (!list) return false;
    return list.some(
      (r) =>
        r.symbol.typeName === 'Alfa' &&
        r.symbol.scopeId !== currentScopeId &&
        (r.scopeKind === 'function' || r.scopeKind === 'block')
    );
  };

  const checkAlfaArg = (arg: ExpressionNode, label: string) => {
    if (arg.kind === 'Identifier') {
      const sym = resolveSymbol(ctx, scope, arg, false);
      const got = sym.typeName;
      if (got !== 'Alfa') {
        if (sym.kind === 'variable' && sym.implicit && hasAlfaInOtherScope(arg.nameNormalized, scope.id)) {
          return;
        }
        if (got === 'Desconhecido') {
          pushDiagnostic(
            ctx,
            mkDiag(ctx, {
              id: label === 'Mascara' ? DiagnosticCodes.ConverteMascaraMascaraAlfa : DiagnosticCodes.ConverteMascaraAlfaDestino,
              severity: 'Error',
              message:
                label === 'Alfa_Origem/Destino'
                  ? `ConverteMascara: A variável ${arg.name} deve ser Alfa e estar definida.`
                  : `ConverteMascara: ${label} deve ser Alfa e estar definida.`,
              sourcePath: arg.sourcePath,
              range: arg.range
            })
          );
          return;
        }
        pushDiagnostic(
          ctx,
          mkDiag(ctx, {
            id: label === 'Mascara' ? DiagnosticCodes.ConverteMascaraMascaraAlfa : DiagnosticCodes.ConverteMascaraAlfaDestino,
            severity: 'Error',
            message:
              label === 'Alfa_Origem/Destino'
                ? `ConverteMascara: A variável ${arg.name} deve ser Alfa.`
                : `ConverteMascara: ${label} deve ser Alfa.`,
            sourcePath: arg.sourcePath,
            range: arg.range
          })
        );
      }
      return;
    }

      const got = inferExprType(ctx, scope, arg);
      if (got !== 'Alfa' && got !== 'Desconhecido') {
        pushDiagnostic(
          ctx,
          mkDiag(ctx, {
            id: label === 'Mascara' ? DiagnosticCodes.ConverteMascaraMascaraAlfa : DiagnosticCodes.ConverteMascaraAlfaDestino,
            severity: 'Error',
            message: `ConverteMascara: ${label} deve ser Alfa.`,
            sourcePath: arg.sourcePath,
            range: arg.range
          })
        );
      }
    };

  checkAlfaArg(alfaDestino, 'Alfa_Origem/Destino');
  checkAlfaArg(mascara, 'Mascara');
  if (!isAssignableExpr(alfaDestino)) {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.ConverteMascaraDestinoAssignable,
        severity: 'Error',
        message: 'ConverteMascara: Alfa_Origem/Destino deve ser uma variável atribuível.',
        sourcePath: alfaDestino.sourcePath,
        range: alfaDestino.range
      })
    );
  }

  const tipoValor = getSignedNumericLiteralValue(tipoArg);
  if (tipoValor === null) {
    // Sem tipo literal, cai na validação padrão.
    return false;
  }
  const valorOrigem = call.args[1];
  if (!valorOrigem) return true;

  if (tipoValor === 1 || tipoValor === 2 || tipoValor === 4) {
    let got = inferExprType(ctx, scope, valorOrigem);
    if (valorOrigem.kind === 'Identifier') {
      const sym = resolveSymbol(ctx, scope, valorOrigem, false);
      got = sym.typeName;
      if (got === 'Desconhecido') {
        pushDiagnostic(
          ctx,
          mkDiag(ctx, {
            id: DiagnosticCodes.ConverteMascaraTipo124Numero,
            severity: 'Error',
            message: `ConverteMascara: a variável ${valorOrigem.name} deve ser Numero e estar definida.`,
            sourcePath: valorOrigem.sourcePath,
            range: valorOrigem.range
          })
        );
        return true;
      }
    }
    if (got === 'Data') {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.ConverteMascaraTipo124Numero,
          severity: 'Warning',
          message: 'ConverteMascara: para Tipo_Dado 1, 2 ou 4, o Valor_Origem deve ser Numero.',
          sourcePath: valorOrigem.sourcePath,
          range: valorOrigem.range
        })
      );
      return true;
    }
    if (got !== 'Numero' && got !== 'Desconhecido') {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.ConverteMascaraTipo124Numero,
          severity: 'Error',
          message: 'ConverteMascara: para Tipo_Dado 1, 2 ou 4, o Valor_Origem deve ser Numero.',
          sourcePath: valorOrigem.sourcePath,
          range: valorOrigem.range
        })
      );
    }
    return true;
  }

  if (tipoValor === 3) {
    const got = inferExprType(ctx, scope, valorOrigem);

    // Tipo_Dado=3 aceita Data ou Numero (sem sugestões de conversão).
    if (got !== 'Data' && got !== 'Numero' && got !== 'Desconhecido') {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.ConverteMascaraTipo3Data,
          severity: 'Error',
          message: 'ConverteMascara: para Tipo_Dado 3, o Valor_Origem deve ser Data ou Numero.',
          sourcePath: valorOrigem.sourcePath,
          range: valorOrigem.range
        })
      );
    }
    return true;
  }

  if (tipoValor === 5) {
    if (getSignedNumericLiteralValue(valorOrigem) !== 0) {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.ConverteMascaraTipo5Zero,
          severity: 'Error',
          message: 'ConverteMascara: para Tipo_Dado 5, o Valor_Origem deve ser o número 0.',
          sourcePath: valorOrigem.sourcePath,
          range: valorOrigem.range
        })
      );
    }
    return true;
  }

  return false;
}

function tryValidateListaCall(ctx: AnalyzerContext, scope: Scope, call: Extract<ExpressionNode, { kind: 'Call' }>): boolean {
  if (call.callee.kind !== 'Member') return false;
  const member = call.callee;
  if (member.object.kind !== 'Identifier') return false;

  const listSymbol = resolveSymbol(ctx, scope, member.object, false);
  if (listSymbol.typeName !== 'Lista') return false;

  const method = getListaMethod(member.property.name);
  if (!method) {
    return true;
  }

  const argCount = call.args.length;
  if (argCount < method.minArgs || argCount > method.maxArgs) {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.ListaMethodArityMismatch,
        severity: 'Warning',
        message: buildInvalidParameterCountMessage(`${member.property.name}`, `${method.minArgs}-${method.maxArgs}`, argCount),
        sourcePath: call.sourcePath,
        range: call.range
      })
    );
    return true;
  }

  const expected = method.paramTypes.slice(0, argCount);
  if (expected.length > 0) {
    validateAgainstTypes(ctx, scope, call, expected, member.property.name, false);
  }

  return true;
}

function isListaAdicionarCampoTypeArg(
  call: Extract<ExpressionNode, { kind: 'Call' }>,
  arg: ExpressionNode,
  index: number
): boolean {
  if (index !== 1 || arg.kind !== 'Identifier') return false;
  if (call.callee.kind !== 'Member') return false;
  if (casefold(call.callee.property.name) !== 'adicionarcampo') return false;
  return typeNameFromIdentifier(arg.name) !== 'Desconhecido';
}

function getSignedNumericLiteralValue(node: ExpressionNode): number | null {
  if (node.kind === 'NumberLiteral') {
    return Number(node.value);
  }
  if (node.kind === 'Unary' && node.operator === '-' && node.operand.kind === 'NumberLiteral') {
    return -Number(node.operand.value);
  }
  return null;
}

function validateTableIndexAccess(
  ctx: AnalyzerContext,
  scope: Scope,
  ownerSymbol: LspSymbol | null,
  indexNode: IndexNode
): void {
  if (!ownerSymbol || ownerSymbol.typeName !== 'Tabela') return;
  const indexType = inferExprType(ctx, scope, indexNode.index);
  if (indexType !== 'Numero') {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.TableIndexTypeMismatch,
        severity: 'Error',
        message: 'Índice de Tabela deve ser Numero.',
        sourcePath: indexNode.index.sourcePath,
        range: indexNode.index.range
      })
    );
    return;
  }
  const literalIndex = getSignedNumericLiteralValue(indexNode.index);
  if (literalIndex === null) return;
  const occurrences = ownerSymbol.tableOccurrences;
  if (occurrences === undefined) return;
  if (literalIndex < 1 || literalIndex > occurrences) {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.TableIndexOutOfRange,
        severity: 'Error',
        message: 'Índice literal fora do intervalo da Tabela.',
        sourcePath: indexNode.index.sourcePath,
        range: indexNode.index.range
      })
    );
  }
}

function inferExprType(ctx: AnalyzerContext, scope: Scope, node: ExpressionNode): TypeName {
  atribuirEscopo(node, scope);
  switch (node.kind) {
    case 'NumberLiteral':
      return 'Numero';
    case 'StringLiteral': {
      const raw = node.value.slice(1, -1);
      const binds = extractSqlBindNames(raw);
      for (const bind of binds) {
        markIdentifierUsed(scope, bind);
        const usedList = ctx.usedIdentifiersByName.get(bind) ?? [];
        usedList.push({ orderKey: node.orderKey });
        ctx.usedIdentifiersByName.set(bind, usedList);
      }
      return 'Alfa';
    }
    case 'ApostropheLiteral':
      return 'Numero';
    case 'Identifier': {
      const usedList = ctx.usedIdentifiersByName.get(node.nameNormalized) ?? [];
      usedList.push({ orderKey: node.orderKey });
      ctx.usedIdentifiersByName.set(node.nameNormalized, usedList);
      const sym = resolveSymbol(ctx, scope, node, false);
      return sym.typeName;
    }
    case 'Paren':
      return node.expr ? inferExprType(ctx, scope, node.expr) : 'Desconhecido';
    case 'Binary':
      {
        const leftType = inferExprType(ctx, scope, node.left);
        const rightType = inferExprType(ctx, scope, node.right);
        const op = node.operator;
        if (['=', '<>', '>', '<', '>=', '<='].includes(op)) {
          return 'Numero';
        }
        if (op === '+' && (leftType === 'Alfa' || rightType === 'Alfa')) {
          return 'Alfa';
        }
        if (['+', '-', '*', '/'].includes(op) && leftType === 'Numero' && rightType === 'Numero') {
          return 'Numero';
        }
        return 'Desconhecido';
      }
    case 'Unary':
      return inferExprType(ctx, scope, node.operand);
    case 'Member':
      return inferMemberType(ctx, scope, node);
    case 'Index':
      return inferIndexType(ctx, scope, node);
    case 'Call':
      // Ensure callee is analyzed so member calls mark the owner variable as used.
      inferExprType(ctx, scope, node.callee);
      typeCheckCall(ctx, scope, node);
      const isCustomCall = isCustomFunctionCall(ctx, node);
      for (const [argIndex, arg] of node.args.entries()) {
        if (arg.kind === 'Identifier') {
          const sym = lookupSymbol(scope, arg.nameNormalized).symbol;
          if (sym?.kind === 'parameter' && sym.isEndParam) {
            if (isCustomCall && !ctx.endParamsAssignedByCall.has(sym)) {
              const diagnostic = mkDiag(ctx, {
                id: DiagnosticCodes.ParamEndAssignedViaCall,
                severity: 'Info',
                message: `Parâmetro END atribuído via chamada; considere usar variável local intermediária: ${sym.name}`,
                sourcePath: arg.sourcePath,
                range: arg.range
              });
              pushDiagnostic(ctx, diagnostic);
              ctx.endParamCallDiagnostics.push({ symbol: sym, diagnostic });
              ctx.endParamsAssignedByCall.add(sym);
            }
          }
        }
        if (isListaAdicionarCampoTypeArg(node, arg, argIndex)) {
          continue;
        }
        inferExprType(ctx, scope, arg);
      }
      return 'Desconhecido';
    default:
      return 'Desconhecido';
  }
}

function inferMemberType(ctx: AnalyzerContext, scope: Scope, node: MemberNode): TypeName {
  const objType = inferExprType(ctx, scope, node.object);
  atribuirEscopo(node.property, scope);
  if (objType === 'Tabela' && node.object.kind !== 'Index') {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.TableIndexRequired,
        severity: 'Error',
        message: 'Acesso a coluna de Tabela exige indexador: use Tabela[...].Coluna',
        sourcePath: node.sourcePath,
        range: node.range
      })
    );
    return 'Desconhecido';
  }
  let ownerSymbol: LspSymbol | null = null;
  if (node.object.kind === 'Identifier') {
    ownerSymbol = resolveSymbol(ctx, scope, node.object, false);
  } else if (node.object.kind === 'Index' && node.object.object.kind === 'Identifier') {
    ownerSymbol = resolveSymbol(ctx, scope, node.object.object, false);
    validateTableIndexAccess(ctx, scope, ownerSymbol, node.object);
  }
  if (ownerSymbol) {
    const field = ownerSymbol.fields?.get(node.property.nameNormalized);
    if (field) {
      field.used = true;
      return field.typeName;
    }
    if (ownerSymbol.typeName === 'Tabela') {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.TableColumnNotFound,
          severity: 'Error',
          message: `Tabela ${ownerSymbol.name}: coluna inexistente (${node.property.name})`,
          sourcePath: node.sourcePath,
          range: node.property.range
        })
      );
      return 'Desconhecido';
    }
  }

  if (objType === 'Lista' && isListaProperty(node.property.name)) {
    recordOccurrence(ctx, node.property.sourcePath, node.property.range, 'method', ['defaultLibrary']);
    return 'Numero';
  }

  if (objType === 'Cursor' && casefold(node.property.name) === 'sql') {
    recordOccurrence(ctx, node.property.sourcePath, node.property.range, 'method', ['defaultLibrary']);
  }

  if (objType === 'Cursor' || objType === 'Lista') {
    // Avoid false positives on unknown members for now.
    return 'Desconhecido';
  }

  return 'Desconhecido';
}

function inferIndexType(ctx: AnalyzerContext, scope: Scope, node: IndexNode): TypeName {
  const objectType = inferExprType(ctx, scope, node.object);
  inferExprType(ctx, scope, node.index);
  if (objectType === 'Tabela') return 'Tabela';
  return 'Desconhecido';
}

function ensureImplicitNumeroForEndArgument(ctx: AnalyzerContext, scope: Scope, arg: IdentifierNode): void {
  const lookup = lookupSymbol(scope, arg.nameNormalized);
  if (lookup.symbol && lookup.symbol.typeName === 'Numero' && lookup.scope?.id === scope.id) {
    lookup.symbol.assigned = true;
    recordSymbolOccurrence(ctx, arg, lookup.symbol);
    return;
  }

  const resolved = resolveSymbol(ctx, scope, arg, true);
  if (resolved.typeName !== 'Numero') return;
  if (resolved.scopeId === scope.id) return;

  const localSymbol: LspSymbol = {
    kind: 'variable',
    name: arg.name,
    nameNormalized: arg.nameNormalized,
    typeName: 'Numero',
    declaredAt: arg.orderKey,
    range: arg.range,
    sourcePath: arg.sourcePath,
    scopeId: scope.id,
    used: true,
    assigned: true,
    implicit: true
  };
  addSymbolCtx(ctx, scope, localSymbol);
  recordSymbolOccurrence(ctx, arg, localSymbol);
}

function isEndParamAssignableExpression(expr: ExpressionNode): boolean {
  if (expr.kind === 'Identifier' || expr.kind === 'Member' || expr.kind === 'Index') return true;
  if (expr.kind === 'Paren' && expr.expr) return isEndParamAssignableExpression(expr.expr);
  return false;
}

function emitEndParamRequiresVariableDiagnostic(ctx: AnalyzerContext, arg: ExpressionNode, name: string, position: number): void {
  pushDiagnostic(
    ctx,
    mkDiag(ctx, {
      id: DiagnosticCodes.EndParamRequiresVariable,
      severity: 'Error',
      message: `Parâmetro END exige variável no argumento ${position} de ${name}`,
      sourcePath: arg.sourcePath,
      range: arg.range
    })
  );
}

function validateAgainstParams(ctx: AnalyzerContext, scope: Scope, call: Extract<ExpressionNode, { kind: 'Call' }>, params: ParamNode[], name: string): void {
  for (let i = 0; i < params.length; i += 1) {
    const param = params[i];
    if (!param?.isEnd) continue;
    const arg = call.args[i];
    if (!arg) continue;
    if (!isEndParamAssignableExpression(arg)) {
      emitEndParamRequiresVariableDiagnostic(ctx, arg, name, i + 1);
      continue;
    }
    if (arg.kind === 'Identifier') {
      if (param.typeName === 'Numero') {
        ensureImplicitNumeroForEndArgument(ctx, scope, arg);
        continue;
      }
      resolveSymbol(ctx, scope, arg, false);
    }
  }
  const expectedTypes = params.map(typeFromParam);
  validateAgainstTypes(ctx, scope, call, expectedTypes, name, false);
}

function validateAgainstTypes(
  ctx: AnalyzerContext,
  scope: Scope,
  call: Extract<ExpressionNode, { kind: 'Call' }>,
  expected: TypeName[],
  name: string,
  _isInternalCall: boolean
): void {
  if (expected.length !== call.args.length) {
    pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.CallArityMismatch,
          severity: 'Warning',
          message: buildInvalidParameterCountMessage(name, `${expected.length}`, call.args.length),
          sourcePath: call.sourcePath,
          range: call.range
        })
      );
    return;
  }

  for (let i = 0; i < expected.length; i += 1) {
    const exp = expected[i];
    const arg = call.args[i];
    if (!exp || !arg) continue;
    if (isListaAdicionarCampoTypeArg(call, arg, i)) continue;
    if (casefold(name) === 'mensagem' && i === 0 && isMensagemFirstArgAllowed(arg)) {
      // The first parameter of Mensagem is handled as lexical/contextual keyword.
      // Avoid semantic identifier resolution here to prevent semantic override.
      continue;
    }
    const got = inferExprType(ctx, scope, arg);
    if (exp === 'Desconhecido' || got === 'Desconhecido') continue;
    if (arg.kind === 'Identifier' && exp !== got) {
      const list = ctx.allSymbolsByName.get(arg.nameNormalized);
      if (list) {
        const hasGlobalExpected = list.some((r) => r.symbol.typeName === exp && r.symbol.scopeId === ctx.globalScope.id);
        if (hasGlobalExpected) {
          continue;
        }
        const hasOtherExpected = list.some(
          (r) =>
            r.symbol.typeName === exp &&
            r.symbol.scopeId !== ctx.globalScope.id &&
            (r.scopeKind === 'function' || r.scopeKind === 'block')
        );
        if (hasOtherExpected) {
          continue;
        }
      }
    }
    if ((exp === 'Numero' && got === 'Data') || (exp === 'Data' && got === 'Numero')) {
      continue;
    }
    if (exp === 'Data' && got === 'Numero' && arg.kind === 'Identifier') {
      const sym = lookupSymbol(scope, arg.nameNormalized).symbol;
      if (sym?.kind === 'variable' && sym.implicit) {
        pushDiagnostic(
          ctx,
          mkDiag(ctx, {
            id: DiagnosticCodes.ImplicitDataSuggestion,
            severity: 'Warning',
            message: `Variável usada como Data sem declaração: ${arg.name}`,
            sourcePath: arg.sourcePath,
            range: arg.range
          })
        );
        continue;
      }
    }
    if (exp !== got) {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.CallTypeMismatch,
          severity: 'Warning',
          message: `Tipo inválido no argumento ${i + 1} de ${name}: esperado ${exp}, recebido ${got}`,
          sourcePath: arg.sourcePath,
          range: arg.range
        })
      );
    }
  }
}

function handleListaAdicionarCampo(ctx: AnalyzerContext, scope: Scope, call: Extract<ExpressionNode, { kind: 'Call' }>): void {
  if (call.callee.kind !== 'Member') return;
  const member = call.callee;
  if (casefold(member.property.name) !== 'adicionarcampo') return;
  if (member.object.kind !== 'Identifier') return;

  const listSymbol = resolveSymbol(ctx, scope, member.object, false);
  if (listSymbol.typeName !== 'Lista') return;

  const [nameArg, typeArg] = call.args;
  if (!nameArg || !typeArg) return;
  if (nameArg.kind !== 'StringLiteral') return;

  const rawName = nameArg.value.slice(1, -1).trim();
  if (!rawName) return;

  // Highlight dynamic field names only when referenced via string literal.
  recordOccurrence(ctx, nameArg.sourcePath, nameArg.range, 'property', ['declaration']);

  let fieldType: TypeName = 'Desconhecido';
  if (typeArg.kind === 'Identifier') {
    fieldType = typeNameFromIdentifier(typeArg.name);
  }

  addField(listSymbol, rawName, fieldType, false, member.property);
}


function isCursorSqlExpressionStatement(ctx: AnalyzerContext, scope: Scope, node: MemberNode): boolean {
  if (casefold(node.property.name) !== 'sql') return false;
  if (node.object.kind !== 'Identifier') return false;
  const objSymbol = resolveSymbol(ctx, scope, node.object, false);
  return objSymbol.typeName === 'Cursor';
}

function isInvalidCursorSqlExpressionStatement(ctx: AnalyzerContext, scope: Scope, node: MemberNode): boolean {
  if (!isCursorSqlExpressionStatement(ctx, scope, node)) return false;
  recordOccurrence(ctx, node.property.sourcePath, node.property.range, 'method', ['defaultLibrary']);
  pushDiagnostic(
    ctx,
    mkDiag(ctx, {
      id: DiagnosticCodes.SyntaxError,
      severity: 'Error',
      message: 'Sintaxe válida para Cursor.SQL é: <variavelCursor>.SQL "<comando_SQL>";',
      sourcePath: node.sourcePath,
      range: node.range
    })
  );
  return true;
}

function analyzeAssignment(ctx: AnalyzerContext, scope: Scope, node: AssignmentNode): void {
  atribuirEscopo(node.target, scope);
  if (node.target.kind === 'Member') {
    atribuirEscopo(node.target.object, scope);
    atribuirEscopo(node.target.property, scope);
  } else if (node.target.kind === 'Index') {
    atribuirEscopo(node.target.object, scope);
    atribuirEscopo(node.target.index, scope);
  }
  if (node.value) {
    atribuirEscopo(node.value, scope);
  }
  // Resolve target first (may create implicit Numero).
  if (node.target.kind === 'Identifier') {
    analyzeIdentifierAssignment(ctx, scope, node.target, node.value);
  } else if (node.target.kind === 'Member') {
    analyzeMemberAssignment(ctx, scope, node.target, node.value, {
      isCursorSqlShorthand: node.isCursorSqlShorthand === true
    });
  }

  if (node.value && node.value.kind === 'Call') {
    handleListaAdicionarCampo(ctx, scope, node.value);
  }
}

function analyzeIdentifierAssignment(
  ctx: AnalyzerContext,
  scope: Scope,
  target: IdentifierNode,
  value: ExpressionNode | null
): void {
  const collectUndeclaredInExpr = (expr: ExpressionNode | null, out: IdentifierNode[]): void => {
    if (!expr) return;
    if (expr.kind === 'Identifier') {
      const lookup = lookupSymbol(scope, expr.nameNormalized).symbol ?? lookupSymbol(ctx.globalScope, expr.nameNormalized).symbol;
      const declaredTypeEntry = ctx.declaredTypesByName.get(expr.nameNormalized);
      const hasDeclaredType = Boolean(declaredTypeEntry && orderCompare(declaredTypeEntry.declaredAt, expr.orderKey) <= 0);
      const implicitAssignEntry = ctx.implicitNumeroAssignmentsByName.get(expr.nameNormalized);
      const hasImplicitAssign = Boolean(implicitAssignEntry && orderCompare(implicitAssignEntry, expr.orderKey) <= 0);
      if (!lookup && !hasDeclaredType && !hasImplicitAssign && !ctx.registry.internalVariables.has(expr.nameNormalized)) {
        out.push(expr);
      }
      return;
    }
    if (expr.kind === 'Binary') {
      collectUndeclaredInExpr(expr.left, out);
      collectUndeclaredInExpr(expr.right, out);
      return;
    }
    if (expr.kind === 'Unary') {
      collectUndeclaredInExpr(expr.operand, out);
      return;
    }
    if (expr.kind === 'Paren') {
      collectUndeclaredInExpr(expr.expr, out);
      return;
    }
    if (expr.kind === 'Member') {
      collectUndeclaredInExpr(expr.object, out);
      return;
    }
    if (expr.kind === 'Index') {
      collectUndeclaredInExpr(expr.object, out);
      collectUndeclaredInExpr(expr.index, out);
      return;
    }
    if (expr.kind === 'Call') {
      collectUndeclaredInExpr(expr.callee, out);
      for (const arg of expr.args) {
        collectUndeclaredInExpr(arg, out);
      }
    }
  };

  const valueType = value ? inferExprType(ctx, scope, value) : 'Desconhecido';
  if (value?.kind === 'StringLiteral') {
    const targetSymbol = resolveSymbol(ctx, scope, target, false);
    if (targetSymbol.typeName === 'Desconhecido') {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.StringLiteralAssignmentUndeclared,
          severity: 'Error',
          message: `Atribuição de literal Alfa exige variável declarada: ${target.name}`,
          sourcePath: target.sourcePath,
          range: target.range
        })
      );
    } else if (targetSymbol.typeName !== 'Alfa') {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.StringLiteralAssignmentTypeMismatch,
          severity: 'Error',
          message: `Atribuição de literal Alfa exige variável Alfa: ${target.name}`,
          sourcePath: target.sourcePath,
          range: target.range
        })
      );
    } else {
      targetSymbol.assigned = true;
      recordAssignedIdentifier(ctx, scope, target);
    }
    return;
  }
  if (value?.kind === 'ApostropheLiteral') {
    const targetSymbol = resolveSymbol(ctx, scope, target, false);
    if (targetSymbol.typeName === 'Desconhecido') {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.SyntaxError,
          severity: 'Error',
          message: `Atribuição de literal com apóstrofo exige variável declarada: ${target.name}`,
          sourcePath: target.sourcePath,
          range: target.range
        })
      );
    } else if (!['Alfa', 'Numero'].includes(targetSymbol.typeName)) {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.SyntaxError,
          severity: 'Error',
          message: `Atribuição de literal com apóstrofo exige variável Alfa ou Numero: ${target.name}`,
          sourcePath: target.sourcePath,
          range: target.range
        })
      );
    } else {
      targetSymbol.assigned = true;
      recordAssignedIdentifier(ctx, scope, target);
    }
    return;
  }
  const existingSymbol = lookupSymbol(scope, target.nameNormalized).symbol ?? lookupSymbol(ctx.globalScope, target.nameNormalized).symbol;
  const existingSymbolVisible = Boolean(existingSymbol && orderCompare(existingSymbol.declaredAt, target.orderKey) <= 0);
  const declaredTypeEntry = ctx.declaredTypesByName.get(target.nameNormalized);
  const hasDeclaredType = Boolean(declaredTypeEntry && orderCompare(declaredTypeEntry.declaredAt, target.orderKey) <= 0);
  const implicitAssignEntry = ctx.implicitNumeroAssignmentsByName.get(target.nameNormalized);
  const hasImplicitAssign = Boolean(implicitAssignEntry && orderCompare(implicitAssignEntry, target.orderKey) <= 0);
  const isInternalTarget = ctx.registry.internalVariables.has(target.nameNormalized);
  const priorDefinition = findAnyPriorDefinition(ctx, target.nameNormalized, target.orderKey);
  const hasTypeConflictCandidate = Boolean(priorDefinition && priorDefinition.typeName !== 'Numero');
  if (!existingSymbolVisible && !hasDeclaredType && !hasImplicitAssign && !isInternalTarget && !hasTypeConflictCandidate && valueType === 'Alfa') {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.VariableUndeclared,
        severity: 'Error',
        message: `Variável não declarada: ${target.name}`,
        sourcePath: target.sourcePath,
        range: target.range
      })
    );

    const missing: IdentifierNode[] = [];
    collectUndeclaredInExpr(value, missing);
    const seen = new Set<string>();
    for (const id of missing) {
      const key = `${id.nameNormalized}:${id.range.start.line}:${id.range.start.character}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.VariableUndeclared,
          severity: 'Error',
          message: `Variável não declarada: ${id.name}`,
          sourcePath: id.sourcePath,
          range: id.range
        })
      );
    }
  }
  if (!isInsideFunctionScope(scope)) {
    const declaredType = ctx.declaredTypesByName.get(target.nameNormalized);
    const implicitAssign = ctx.implicitNumeroAssignmentsByName.get(target.nameNormalized);
    if (
      !existingSymbolVisible
      && !declaredType
      && !isInternalTarget
      && (!implicitAssign || orderCompare(target.orderKey, implicitAssign) < 0)
    ) {
      ctx.implicitNumeroAssignmentsByName.set(target.nameNormalized, target.orderKey);
    }
  }
  const targetSym = resolveSymbol(ctx, scope, target, true);

  // Validate assignment type when both sides are known.
  // Note: LSP allows using Numero and Data interchangeably in some contexts.
  // We accept Data <- Numero and Numero <- Data here.
  if (
    targetSym.typeName !== 'Desconhecido' &&
    valueType !== 'Desconhecido' &&
    targetSym.typeName !== valueType
  ) {

    if (
      (targetSym.typeName === 'Data' && valueType === 'Numero') ||
      (targetSym.typeName === 'Numero' && valueType === 'Data')
    ) {
      return;
    }
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.AssignmentTypeMismatch,
        severity: 'Error',
        message: `Tipo inválido na atribuição: ${target.name} (${targetSym.typeName}) não aceita ${valueType}`,
        sourcePath: target.sourcePath,
        range: target.range
      })
    );
  }
}

function analyzeMemberAssignment(
  ctx: AnalyzerContext,
  scope: Scope,
  target: MemberNode,
  value: ExpressionNode | null,
  options?: { isCursorSqlShorthand?: boolean }
): void {
  let objSymbol: LspSymbol | null = null;
  if (target.object.kind === 'Identifier') {
    objSymbol = resolveSymbol(ctx, scope, target.object, false);
  } else if (target.object.kind === 'Index' && target.object.object.kind === 'Identifier') {
    objSymbol = resolveSymbol(ctx, scope, target.object.object, false);
    validateTableIndexAccess(ctx, scope, objSymbol, target.object);
  }
  if (!objSymbol) return;
  if (objSymbol.typeName === 'Tabela' && target.object.kind !== 'Index') {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.TableIndexRequired,
        severity: 'Error',
        message: 'Atribuição em coluna de Tabela exige indexador: use Tabela[...].Coluna',
        sourcePath: target.sourcePath,
        range: target.range
      })
    );
    return;
  }
  if (options?.isCursorSqlShorthand && casefold(target.property.name) === 'sql' && objSymbol.typeName !== 'Cursor') {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.SyntaxError,
        severity: 'Error',
        message: "Sintaxe '<obj>.SQL \"...\";' é permitida apenas para variáveis do tipo Cursor.",
        sourcePath: target.sourcePath,
        range: target.range
      })
    );
    return;
  }
  const propName = target.property.nameNormalized;
  const field = objSymbol.fields?.get(propName);
  if (field) {
    recordOccurrence(ctx, target.property.sourcePath, target.property.range, 'property', field.readonly ? ['readonly'] : []);
  } else if (objSymbol.typeName === 'Lista' && isListaProperty(target.property.name)) {
    recordOccurrence(ctx, target.property.sourcePath, target.property.range, 'method', ['defaultLibrary']);
  } else if (objSymbol.typeName === 'Cursor' && casefold(target.property.name) === 'sql') {
    recordOccurrence(ctx, target.property.sourcePath, target.property.range, 'method', ['defaultLibrary']);
  } else if (objSymbol.typeName === 'Tabela') {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.TableColumnNotFound,
        severity: 'Error',
        message: `Tabela ${objSymbol.name}: coluna inexistente (${target.property.name})`,
        sourcePath: target.sourcePath,
        range: target.property.range
      })
    );
    return;
  }

  if (objSymbol.typeName === 'Cursor' && casefold(target.property.name) === 'sql') {
    if (!options?.isCursorSqlShorthand) {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.SyntaxError,
          severity: 'Error',
          message: 'Sintaxe válida para Cursor.SQL é: <variavelCursor>.SQL "<comando_SQL>";',
          sourcePath: target.sourcePath,
          range: target.range
        })
      );
      return;
    }
    if (value) {
      checkCursorSql(ctx, objSymbol, value, target.property);
      recordEmbeddedSqlLiteralOccurrence(ctx, value, {
        wrapperKind: 'cursor_sql',
        sourceKind: 'direct_literal'
      });
    }
    return;
  }

  if (objSymbol.typeName === 'Cursor') {
    const field = objSymbol.fields?.get(target.property.nameNormalized);
    if (field && field.readonly) {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.CursorFieldReadonly,
          severity: 'Error',
          message: `Campo de Cursor é somente leitura: ${field.name}`,
          sourcePath: target.sourcePath,
          range: target.range
        })
      );
    }
  }

  if (!field || !value) return;
  field.assigned = true;
  if (objSymbol.typeName !== 'Tabela') return;

  const valueType = inferExprType(ctx, scope, value);
  if (
    field.typeName !== 'Desconhecido'
    && valueType !== 'Desconhecido'
    && field.typeName !== valueType
  ) {
    if (
      (field.typeName === 'Data' && valueType === 'Numero')
      || (field.typeName === 'Numero' && valueType === 'Data')
    ) {
      return;
    }
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.AssignmentTypeMismatch,
        severity: 'Error',
        message: `Tipo inválido na atribuição: ${objSymbol.name}.${field.name} (${field.typeName}) não aceita ${valueType}`,
        sourcePath: target.sourcePath,
        range: target.range
      })
    );
  }
}

function analyzeStatement(
  ctx: AnalyzerContext,
  scope: Scope,
  stmt: StatementNode,
  globalScope: Scope,
  analyzeFunctionBodies = true
): void {
  atribuirEscopo(stmt, scope);
  switch (stmt.kind) {
    case 'Label':
      return;
    case 'VaPara': {
      const scopeKey = resolveLabelScopeKey(ctx, scope);
      const labelsByScope = ctx.labelsByFileAndScope.get(stmt.sourcePath);
      const labelsInScope = labelsByScope?.get(scopeKey);
      if (!labelsInScope || !labelsInScope.has(stmt.targetLabelNormalized)) {
        pushDiagnostic(
          ctx,
          mkDiag(ctx, {
            id: DiagnosticCodes.VaParaLabelNotFoundInFile,
            severity: 'Error',
            message: `VaPara: rótulo não encontrado no arquivo atual: ${stmt.targetLabel}`,
            sourcePath: stmt.sourcePath,
            range: stmt.targetRange ?? stmt.range
          })
        );
      }
      return;
    }
    case 'VarDecl':
      {
      const existingInScope = (scope.symbols.get(stmt.nameNormalized) ?? []).find((symbol) => !symbol.implicit) ?? null;
      const sameDeclaration = isSameDeclarationSymbol(existingInScope, stmt);
      {
        const nameRange = stmt.nameRange ?? stmt.range;
        if (stmt.typeName === 'Tabela' && stmt.tableDecl) {
          validateTableDeclaration(ctx, stmt.name, stmt.sourcePath, stmt.tableDecl);
        }
        if (existingInScope && !sameDeclaration) {
          if (scope.kind === 'global' && existingInScope.sourcePath === stmt.sourcePath) {
            pushDiagnostic(
              ctx,
              mkDiag(ctx, {
                id: DiagnosticCodes.VariableRedeclaredGlobalAcrossFiles,
                severity: 'Warning',
                message: `Redeclaração global não permitida no mesmo arquivo: ${stmt.name}`,
                sourcePath: stmt.sourcePath,
                range: nameRange
              })
            );
            return;
          }
          if (scope.kind !== 'global') {
            pushDiagnostic(
              ctx,
              mkDiag(ctx, {
                id: DiagnosticCodes.VariableRedeclarationNotAllowed,
                severity: 'Warning',
                message: `Redeclaração não permitida no mesmo escopo: ${stmt.name}`,
                sourcePath: stmt.sourcePath,
                range: nameRange
              })
            );
            recordOccurrence(ctx, stmt.sourcePath, nameRange, 'variable', ['declaration']);
            return;
          }
        }

        // declaredTypesByName is a global registry used primarily for global declarations and
        // for implicit numeric variables. Block/function scopes should not trigger a hard type
        // conflict here; instead, they follow the shadowing rule (LSP1406).
        const existing = ctx.declaredTypesByName.get(stmt.nameNormalized);
        if (scope.kind === 'global') {
          if (existing && existing.typeName !== stmt.typeName) {
            pushDiagnostic(
              ctx,
              mkDiag(ctx, {
                id: DiagnosticCodes.VariableTypeConflict,
                severity: 'Error',
                message: `Variável já declarada com outro tipo: ${stmt.name}`,
                sourcePath: existing.sourcePath,
                range: existing.declRange
              })
            );
            return;
          }
          if (existing && existing.implicit && existing.typeName !== stmt.typeName) {
            pushDiagnostic(
              ctx,
              mkDiag(ctx, {
                id: DiagnosticCodes.VariableTypeConflict,
                severity: 'Error',
                message: `Variável já declarada com outro tipo: ${stmt.name}`,
                sourcePath: existing.sourcePath,
                range: existing.declRange
              })
            );
            return;
          }
        }

        // Shadowing rule (LSP1406): only error when shadowing an ancestor with a different type.
        // Do not check sibling scopes (handled naturally by scope chain).
        if (scope.kind !== 'global') {
          let parent = scope.parent;
          while (parent) {
            const list = parent.symbols.get(stmt.nameNormalized);
            if (list && list.length > 0) {
              // Symbols in each scope list are already stored by declaration order.
              const ancestor = list[0];
              if (ancestor && ancestor.typeName !== stmt.typeName) {
                // Range aponta para a declaração original (primeiro ponto), não para a ocorrência atual.
                const nameRange = stmt.nameRange ?? stmt.range;
                pushDiagnostic(
                  ctx,
                  mkDiag(ctx, {
                    id: DiagnosticCodes.AlfaScopeSuggestion,
                    severity: 'Error',
                    message: `Sombreamento de ancestral com tipo diferente: ${stmt.name}`,
                    sourcePath: stmt.sourcePath,
                    range: nameRange
                  })
                );
              }
              break;
            }
            parent = parent.parent;
          }
        }

        if (scope.kind === 'global' && !existing) {
          ctx.declaredTypesByName.set(stmt.nameNormalized, {
            typeName: stmt.typeName,
            declaredAt: stmt.orderKey,
            sourcePath: stmt.sourcePath,
            declRange: nameRange,
            implicit: false
          });
        }
      }
      const variableSymbol: LspSymbol = sameDeclaration && existingInScope
        ? existingInScope
        : {
          kind: 'variable',
          name: stmt.name,
          nameNormalized: stmt.nameNormalized,
          typeName: stmt.typeName,
          declaredAt: stmt.orderKey,
          range: stmt.range,
          sourcePath: stmt.sourcePath,
          scopeId: scope.id,
          used: false,
          assigned: false,
          outsideFunctionScope: !isInsideFunctionScope(scope)
        };
      variableSymbol.kind = 'variable';
      variableSymbol.name = stmt.name;
      variableSymbol.nameNormalized = stmt.nameNormalized;
      variableSymbol.typeName = stmt.typeName;
      variableSymbol.declaredAt = stmt.orderKey;
      variableSymbol.range = stmt.range;
      variableSymbol.sourcePath = stmt.sourcePath;
      variableSymbol.scopeId = scope.id;
      variableSymbol.outsideFunctionScope = !isInsideFunctionScope(scope);
      variableSymbol.predeclared = false;
      const fields = buildTableFieldsForDeclaration(stmt);
      if (fields) {
        for (const field of fields.values()) {
          field.scopeId = scope.id;
        }
        variableSymbol.fields = fields;
        const tableOccurrences = parseTableOccurrencesLiteral(stmt.tableDecl);
        if (tableOccurrences !== undefined) {
          variableSymbol.tableOccurrences = tableOccurrences;
        }
      }
      if (!sameDeclaration) {
        addSymbolCtx(ctx, scope, variableSymbol);
      }
      {
        const nameRange = stmt.nameRange ?? stmt.range;
        const modifiers: SemanticTokenModifier[] = ['declaration'];
        if (scope.kind === 'global') {
          modifiers.push('static');
        }
        recordOccurrence(ctx, stmt.sourcePath, nameRange, 'variable', modifiers);
      }
      return;
      }
    case 'FuncDecl':
      if (scope !== globalScope) {
        pushDiagnostic(
          ctx,
          mkDiag(ctx, {
            id: DiagnosticCodes.FunctionImplGlobalOnly,
            severity: 'Error',
            message: 'Funções só podem ser declaradas no escopo global',
            sourcePath: stmt.sourcePath,
            range: stmt.range
          })
        );
        return;
      }
      if (stmt.params.length > 15) {
        pushDiagnostic(
          ctx,
          mkDiag(ctx, {
            id: DiagnosticCodes.FunctionParamLimitExceeded,
            severity: 'Error',
            message: 'Função com mais de 15 parâmetros',
            sourcePath: stmt.sourcePath,
            range: stmt.range
          })
        );
      }
      for (const param of stmt.params) {
        param.scopeId = scope.id;
      }
      addSymbolCtx(ctx, scope, {
        kind: 'function',
        name: stmt.name,
        nameNormalized: stmt.nameNormalized,
        typeName: 'Funcao',
        declaredAt: stmt.orderKey,
        range: stmt.range,
        sourcePath: stmt.sourcePath,
        scopeId: scope.id,
        used: false,
        assigned: false,
        params: stmt.params,
        declared: true,
        implemented: false
      });
      {
        const nameRange = stmt.nameRange ?? stmt.range;
        // Do not distinguish internal vs custom functions in highlighting.
        recordOccurrence(ctx, stmt.sourcePath, nameRange, 'function', ['declaration']);
        for (const param of stmt.params) {
          const modifiers: SemanticTokenModifier[] = ['declaration'];
          if (param.isEnd) modifiers.push('defaultLibrary');
          recordOccurrence(ctx, stmt.sourcePath, param.nameRange ?? param.range, 'parameter', modifiers);
        }
      }
      return;
    case 'FuncImpl':
      if (scope !== globalScope) {
        pushDiagnostic(
          ctx,
          mkDiag(ctx, {
            id: DiagnosticCodes.FunctionGlobalOnly,
            severity: 'Error',
            message: 'Funções só podem ser implementadas no escopo global',
            sourcePath: stmt.sourcePath,
            range: stmt.range
          })
        );
        return;
      }
      if (stmt.params.length > 15) {
        pushDiagnostic(
          ctx,
          mkDiag(ctx, {
            id: DiagnosticCodes.FunctionParamLimitExceeded,
            severity: 'Error',
            message: 'Função com mais de 15 parâmetros',
            sourcePath: stmt.sourcePath,
            range: stmt.range
          })
        );
      }
      addSymbolCtx(ctx, scope, {
        kind: 'function',
        name: stmt.name,
        nameNormalized: stmt.nameNormalized,
        typeName: 'Funcao',
        declaredAt: stmt.orderKey,
        range: stmt.range,
        sourcePath: stmt.sourcePath,
        scopeId: scope.id,
        used: false,
        assigned: false,
        params: stmt.params,
        declared: false,
        implemented: true
      });
      if (analyzeFunctionBodies) {
        const nameRange = stmt.nameRange ?? stmt.range;
        // Do not distinguish internal vs custom functions in highlighting.
        recordOccurrence(ctx, stmt.sourcePath, nameRange, 'function', ['definition']);
        for (const param of stmt.params) {
          const modifiers: SemanticTokenModifier[] = ['declaration'];
          if (param.isEnd) modifiers.push('defaultLibrary');
          recordOccurrence(ctx, stmt.sourcePath, param.nameRange ?? param.range, 'parameter', modifiers);
        }
      }
      if (stmt.body && analyzeFunctionBodies) {
        const fnScope = createScope('function', scope);
        const fnScopeKey = `function:${stmt.sourcePath}:${stmt.nameNormalized}:${stmt.orderKey.fileIndex}:${stmt.orderKey.startOffset}`;
        ctx.functionScopeKeyById.set(fnScope.id, fnScopeKey);
        for (const param of stmt.params) {
          param.scopeId = fnScope.id;
          addSymbolCtx(ctx, fnScope, {
            kind: 'parameter',
            name: param.name,
            nameNormalized: param.nameNormalized,
            typeName: param.typeName,
            declaredAt: stmt.orderKey,
            range: param.nameRange ?? param.range,
            sourcePath: stmt.sourcePath,
            scopeId: fnScope.id,
            used: false,
            assigned: false,
            isEndParam: param.isEnd
          });
        }
        analyzeBlock(ctx, fnScope, stmt.body, globalScope);
        emitUnusedDiagnostics(ctx, fnScope);
      }
      return;
    case 'Block': {
      const blockScope = createScope('block', scope);
      analyzeBlock(ctx, blockScope, stmt, globalScope);
      emitUnusedDiagnostics(ctx, blockScope);
      return;
    }
    case 'If': {
      if (stmt.condition) inferExprType(ctx, scope, stmt.condition);
      if (stmt.thenBranch) {
        const thenScope = createScope('block', scope);
        analyzeStatement(ctx, thenScope, stmt.thenBranch, globalScope);
        emitUnusedDiagnostics(ctx, thenScope);
      }
      if (stmt.elseBranch) {
        const elseScope = createScope('block', scope);
        analyzeStatement(ctx, elseScope, stmt.elseBranch, globalScope);
        emitUnusedDiagnostics(ctx, elseScope);
      }
      return;
    }
    case 'While': {
      if (stmt.condition) inferExprType(ctx, scope, stmt.condition);
      if (stmt.body) {
        const whileScope = createScope('block', scope);
        analyzeStatement(ctx, whileScope, stmt.body, globalScope);
        emitUnusedDiagnostics(ctx, whileScope);
      }
      return;
    }
    case 'For': {
      if (stmt.init) {
        const initScope = createScope('block', scope);
        analyzeStatement(ctx, initScope, stmt.init, globalScope);
        emitUnusedDiagnostics(ctx, initScope);
      }
      if (stmt.condition) inferExprType(ctx, scope, stmt.condition);
      if (stmt.update) inferExprType(ctx, scope, stmt.update);
      if (stmt.body) {
        const forScope = createScope('block', scope);
        analyzeStatement(ctx, forScope, stmt.body, globalScope);
        emitUnusedDiagnostics(ctx, forScope);
      }
      return;
    }
    case 'ExecSql':
      if (!stmt.sql) {
        pushDiagnostic(
          ctx,
          mkDiag(ctx, {
            id: DiagnosticCodes.SyntaxError,
            severity: 'Error',
            message: 'ExecSql requer um StringLiteral: ExecSql "...";',
            sourcePath: stmt.sourcePath,
            range: stmt.range
          })
        );
        return;
      }
      if (!stmt.terminatedBySemicolon) {
        pushDiagnostic(
          ctx,
          mkDiag(ctx, {
            id: DiagnosticCodes.SyntaxError,
            severity: 'Error',
            message: "ExecSql deve terminar com ';'",
            sourcePath: stmt.sourcePath,
            range: stmt.range
          })
        );
      }
      // Semantic: highlight only the ExecSql keyword like any other function.
      // Keep the SQL literal free for TextMate/string highlighting.
      recordOccurrence(ctx, stmt.sourcePath, stmt.keywordRange, 'function', []);
      recordEmbeddedSqlLiteralOccurrence(ctx, stmt.sql, {
        wrapperKind: 'execsql',
        sourceKind: 'direct_literal'
      });
      return;
    case 'Assignment':
      analyzeAssignment(ctx, scope, stmt);
      return;
    case 'ExprStmt':
      atribuirEscopo(stmt.expr, scope);
      if (stmt.expr.kind === 'Identifier' && CONTROL_FLOW_KEYWORD_IDENTIFIERS.has(stmt.expr.nameNormalized)) {
        return;
      }
      if (stmt.expr.kind === 'Member' && isInvalidCursorSqlExpressionStatement(ctx, scope, stmt.expr)) {
        return;
      }
      if (stmt.expr.kind === 'Call' && stmt.expr.callee.kind === 'Member' && isCursorSqlExpressionStatement(ctx, scope, stmt.expr.callee)) {
        recordOccurrence(ctx, stmt.expr.callee.property.sourcePath, stmt.expr.callee.property.range, 'method', ['defaultLibrary']);
        pushDiagnostic(
          ctx,
          mkDiag(ctx, {
            id: DiagnosticCodes.SyntaxError,
            severity: 'Error',
            message: 'Sintaxe válida para Cursor.SQL é: <variavelCursor>.SQL "<comando_SQL>";',
            sourcePath: stmt.expr.sourcePath,
            range: stmt.expr.range
          })
        );
        return;
      }
      if (stmt.expr.kind === 'Binary' && stmt.expr.operator === '=' && stmt.expr.left.kind === 'Member') {
        atribuirEscopo(stmt.expr.left, scope);
        atribuirEscopo(stmt.expr.left.object, scope);
        atribuirEscopo(stmt.expr.left.property, scope);
        analyzeMemberAssignment(ctx, scope, stmt.expr.left, stmt.expr.right, { isCursorSqlShorthand: false });
        if (stmt.expr.right) inferExprType(ctx, scope, stmt.expr.right);
      } else if (stmt.expr.kind === 'Binary' && stmt.expr.operator === '=' && stmt.expr.left.kind === 'Identifier') {
        analyzeIdentifierAssignment(ctx, scope, stmt.expr.left, stmt.expr.right);
      } else {
        inferExprType(ctx, scope, stmt.expr);
      }
      if (stmt.expr.kind === 'Call') {
        handleListaAdicionarCampo(ctx, scope, stmt.expr);
      }
      return;
    default:
      return;
  }
}

function analyzeBlock(ctx: AnalyzerContext, scope: Scope, block: BlockNode, globalScope: Scope): void {
  atribuirEscopo(block, scope);
  predeclareBlockVariables(ctx, scope, block);
  for (const stmt of block.statements) {
    analyzeStatement(ctx, scope, stmt, globalScope);
  }
}

function ensureLabelsForScope(
  labelsByScope: Map<string, Set<string>>,
  scopeKey: string
): Set<string> {
  const existing = labelsByScope.get(scopeKey);
  if (existing) return existing;
  const created = new Set<string>();
  labelsByScope.set(scopeKey, created);
  return created;
}

function collectLabelsFromStatement(
  stmt: StatementNode,
  labelsByScope: Map<string, Set<string>>,
  scopeKey: string
): void {
  switch (stmt.kind) {
    case 'Label':
      ensureLabelsForScope(labelsByScope, scopeKey).add(stmt.nameNormalized);
      return;
    case 'Block':
      for (const child of stmt.statements) collectLabelsFromStatement(child, labelsByScope, scopeKey);
      return;
    case 'If':
      if (stmt.thenBranch) collectLabelsFromStatement(stmt.thenBranch, labelsByScope, scopeKey);
      if (stmt.elseBranch) collectLabelsFromStatement(stmt.elseBranch, labelsByScope, scopeKey);
      return;
    case 'While':
      if (stmt.body) collectLabelsFromStatement(stmt.body, labelsByScope, scopeKey);
      return;
    case 'For':
      if (stmt.init) collectLabelsFromStatement(stmt.init, labelsByScope, scopeKey);
      if (stmt.body) collectLabelsFromStatement(stmt.body, labelsByScope, scopeKey);
      return;
    case 'FuncImpl':
      if (stmt.body) {
        const fnScopeKey = `function:${stmt.sourcePath}:${stmt.nameNormalized}:${stmt.orderKey.fileIndex}:${stmt.orderKey.startOffset}`;
        collectLabelsFromStatement(stmt.body, labelsByScope, fnScopeKey);
      }
      return;
    default:
      return;
  }
}

function collectLabelsByFileAndScope(files: FileNode[]): Map<string, Map<string, Set<string>>> {
  const labelsByFile = new Map<string, Map<string, Set<string>>>();
  for (const file of files) {
    const labelsByScope = new Map<string, Set<string>>();
    ensureLabelsForScope(labelsByScope, 'global');
    for (const stmt of file.statements) {
      if (stmt.kind === 'FuncImpl') {
        collectLabelsFromStatement(stmt, labelsByScope, 'global');
      } else {
        collectLabelsFromStatement(stmt, labelsByScope, 'global');
      }
    }
    labelsByFile.set(file.sourcePath, labelsByScope);
  }
  return labelsByFile;
}

function resolveLabelScopeKey(ctx: AnalyzerContext, scope: Scope): string {
  let current: Scope | null = scope;
  while (current) {
    const fnScopeKey = ctx.functionScopeKeyById.get(current.id);
    if (fnScopeKey) return fnScopeKey;
    current = current.parent;
  }
  return 'global';
}


function collectDuplicateParams(params: ParamNode[]): ParamNode[] {
  const seen = new Map<string, ParamNode>();
  const duplicates: ParamNode[] = [];
  for (const param of params) {
    const existing = seen.get(param.nameNormalized);
    if (existing) {
      duplicates.push(param);
      continue;
    }
    seen.set(param.nameNormalized, param);
  }
  return duplicates;
}

function emitDuplicateParamDiagnostics(
  ctx: AnalyzerContext,
  fn: FuncDeclNode | FuncImplNode
): void {
  for (const param of collectDuplicateParams(fn.params)) {
    pushDiagnostic(
      ctx,
      mkDiag(ctx, {
        id: DiagnosticCodes.FunctionDuplicateParamName,
        severity: 'Warning',
        message: `Parâmetro duplicado na função ${fn.name}: ${param.name}`,
        sourcePath: fn.sourcePath,
        range: param.nameRange ?? param.range
      })
    );
  }
}
function collectFunctionRecords(files: FileNode[]): Map<string, FuncRecord> {
  const records = new Map<string, FuncRecord>();

  const ensure = (key: string): FuncRecord => {
    const existing = records.get(key);
    if (existing) return existing;
    const created: FuncRecord = { decl: null, impl: null };
    records.set(key, created);
    return created;
  };

  for (const file of files) {
    for (const stmt of file.statements) {
      if (stmt.kind === 'FuncDecl') {
        ensure(stmt.nameNormalized).decl = stmt;
      }
      if (stmt.kind === 'FuncImpl') {
        ensure(stmt.nameNormalized).impl = stmt;
      }
    }
  }

  return records;
}

function emitFunctionDiagnostics(ctx: AnalyzerContext, records: Map<string, FuncRecord>): void {
  for (const record of records.values()) {
    if (record.impl) {
      emitDuplicateParamDiagnostics(ctx, record.impl);
    } else if (record.decl) {
      emitDuplicateParamDiagnostics(ctx, record.decl);
    }
    if (record.decl && !record.impl) {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.FunctionDeclaredNotImplemented,
          severity: 'Warning',
          message: `Função declarada e não implementada: ${record.decl.name}`,
          sourcePath: record.decl.sourcePath,
          range: record.decl.range
        })
      );
    }
    if (!record.decl && record.impl) {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.FunctionImplementedNotDeclared,
          severity: 'Warning',
          message: `Função implementada sem declaração: ${record.impl.name}`,
          sourcePath: record.impl.sourcePath,
          range: record.impl.range
        })
      );
    }
  }
}

function emitUnusedDiagnostics(ctx: AnalyzerContext, scope: Scope): void {
  forEachSymbol(scope, (symbol) => {
    if (symbol.kind === 'function') return;
    if (symbol.kind === 'internal') return;

    // LSP1203 (globals): evaluate from read/write traces, not from `symbol.used`.
    // This keeps behavior correct for write-only globals where assignment paths may set used=true.
    if (scope.kind === 'global' && symbol.kind === 'variable') {
      // Global unused variables must only be computed when the full context has been validated.
      if (!ctx.isFullContextValidated) {
        return;
      }

      const assigns = ctx.assignedIdentifiersByName.get(symbol.nameNormalized) ?? [];
      const uses = ctx.usedIdentifiersByName.get(symbol.nameNormalized) ?? [];

      // Distinct writes after declaration.
      const assignedAfterDecl = new Set<string>();
      for (const a of assigns) {
        if (orderCompare(a.orderKey, symbol.declaredAt) >= 0) {
          assignedAfterDecl.add(`${a.orderKey.fileIndex}:${a.orderKey.startOffset}`);
        }
      }
      if (assignedAfterDecl.size >= 2) {
        return;
      }

      const hasCustomFunctionAssignmentInSameFile = (
        symbol.outsideFunctionScope
        && symbol.typeName === 'Alfa'
        && assigns.some(
          (a) =>
            a.insideCustomFunction
            && a.orderKey.fileIndex === symbol.declaredAt.fileIndex
            && orderCompare(a.orderKey, symbol.declaredAt) >= 0
        )
      );
      if (hasCustomFunctionAssignmentInSameFile) {
        return;
      }

      // Any read after declaration (exclude assignment-target occurrences).
      let hasReadAfterDecl = false;
      for (const u of uses) {
        if (orderCompare(u.orderKey, symbol.declaredAt) < 0) continue;
        const key = `${u.orderKey.fileIndex}:${u.orderKey.startOffset}`;
        if (!assignedAfterDecl.has(key)) {
          hasReadAfterDecl = true;
          break;
        }
      }
      if (hasReadAfterDecl) {
        return;
      }

      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.VariableUnused,
          severity: 'Info',
          message: `Variável não utilizada: ${symbol.name}`,
          sourcePath: symbol.sourcePath,
          range: symbol.range
        })
      );
      return;
    }

    if (!symbol.used && symbol.kind !== 'field' && symbol.kind !== 'parameter') {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.VariableUnused,
          severity: 'Info',
          message: `Variável não utilizada: ${symbol.name}`,
          sourcePath: symbol.sourcePath,
          range: symbol.range
        })
      );
    }

    if (symbol.kind === 'parameter' && !symbol.used) {
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.ParamUnused,
          severity: 'Warning',
          message: `Parâmetro não utilizado: ${symbol.name}`,
          sourcePath: symbol.sourcePath,
          range: symbol.range
        })
      );
    }

    if (symbol.kind === 'parameter' && symbol.isEndParam && !symbol.assigned) {
      if (ctx.endParamsAssignedByCall.has(symbol)) {
        return;
      }
      pushDiagnostic(
        ctx,
        mkDiag(ctx, {
          id: DiagnosticCodes.ParamEndNeverAssigned,
          severity: 'Warning',
          message: `Parâmetro END nunca atribuído: ${symbol.name}`,
          sourcePath: symbol.sourcePath,
          range: symbol.range
        })
      );
    }
  });
}

function emitImplicitTypeConflicts(ctx: AnalyzerContext): void {
  for (const list of ctx.allSymbolsByName.values()) {
    for (const entry of list) {
      const symbol = entry.symbol;
      if (symbol.kind !== 'variable' || symbol.implicit) continue;
      if (symbol.typeName === 'Numero') continue;
      const implicitAssign = ctx.implicitNumeroAssignmentsByName.get(symbol.nameNormalized);
      if (!implicitAssign) continue;
      if (orderCompare(implicitAssign, symbol.declaredAt) <= 0) {
        pushDiagnostic(
          ctx,
          mkDiag(ctx, {
            id: DiagnosticCodes.VariableTypeConflict,
            severity: 'Error',
            message: `Variável já declarada com outro tipo: ${symbol.name}`,
            sourcePath: symbol.sourcePath,
            range: symbol.range
          })
        );
      }
    }
  }
}

function analyzeFileDeclsWithContrib(
  ctx: AnalyzerContext,
  file: FileNode,
  globalScope: Scope
): SemanticDeclContrib {
  const diagStart = ctx.diagnostics.length;
  const symbolsByNameBefore = captureArrayMapLengths(ctx.allSymbolsByName);
  const declaredTypesBefore = new Map(ctx.declaredTypesByName);
  const occBefore = ctx.occurrencesByFile?.get(file.sourcePath)?.length ?? 0;

  analyzeFileDecls(ctx, file, globalScope);

  const diagnostics = ctx.diagnostics.slice(diagStart);
  const symbolsByName = diffArrayMap(symbolsByNameBefore, ctx.allSymbolsByName).map((entry) => ({
    nameNormalized: entry.nameNormalized,
    entries: entry.entries.map((e) => ({
      ...e,
      symbol: { ...e.symbol }
    }))
  }));

  const declaredTypesByName: SemanticDeclContrib['declaredTypesByName'] = [];
  for (const [key, value] of ctx.declaredTypesByName.entries()) {
    const prev = declaredTypesBefore.get(key);
    if (!prev || !sameDeclaredType(prev, value)) {
      declaredTypesByName.push({ nameNormalized: key, value });
    }
  }

  const occList = ctx.occurrencesByFile?.get(file.sourcePath);
  const occurrences = occList ? occList.slice(occBefore) : undefined;

  return {
    diagnostics,
    symbolsByName,
    declaredTypesByName,
    occurrences
  };
}

function applyDeclContrib(ctx: AnalyzerContext, contrib: SemanticDeclContrib): void {
  for (const entry of contrib.symbolsByName) {
    const list = ctx.allSymbolsByName.get(entry.nameNormalized) ?? [];
    list.push(...entry.entries);
    ctx.allSymbolsByName.set(entry.nameNormalized, list);
    for (const e of entry.entries) {
      if (e.scopeKind === 'global') {
        addSymbol(ctx.globalScope, e.symbol);
      }
    }
  }
  for (const entry of contrib.declaredTypesByName) {
    ctx.declaredTypesByName.set(entry.nameNormalized, entry.value);
  }
  if (contrib.occurrences && contrib.occurrences.length > 0 && ctx.occurrencesByFile) {
    const sourcePath = contrib.occurrences[0]?.sourcePath;
    if (sourcePath) {
      const list = ctx.occurrencesByFile.get(sourcePath) ?? [];
      list.push(...contrib.occurrences);
      ctx.occurrencesByFile.set(sourcePath, list);
    }
  }
  ctx.diagnostics.push(...contrib.diagnostics);
}

function collectDeclDirtyIndices(input: {
  files: FileNode[];
  prevCache?: SemanticCache | undefined;
}): Set<number> {
  const dirty = new Set<number>();
  if (!input.prevCache || input.prevCache.files.length !== input.files.length) {
    for (let i = 0; i < input.files.length; i += 1) dirty.add(i);
    return dirty;
  }
  const prevByPath = new Map<string, SemanticFileCache>();
  for (const entry of input.prevCache.files) {
    if (!entry) continue;
    prevByPath.set(casefold(entry.filePath), entry);
  }
  for (let i = 0; i < input.files.length; i += 1) {
    const file = input.files[i];
    if (!file) continue;
    const prev = prevByPath.get(casefold(file.sourcePath));
    if (!prev?.declContrib) {
      dirty.add(i);
      continue;
    }
    const prevDeclared = new Set(prev.topLevelDeclaredNames ?? []);
    const currentDeclared = collectTopLevelDeclaredNames(file);
    let namesChanged = currentDeclared.size !== prevDeclared.size;
    if (!namesChanged) {
      for (const name of currentDeclared) {
        if (!prevDeclared.has(name)) {
          namesChanged = true;
          break;
        }
      }
    }
    if (namesChanged) {
      dirty.add(i);
      continue;
    }
    const prevFingerprint = prev.topLevelDeclFingerprint;
    const currentFingerprint = computeTopLevelDeclFingerprint(file);
    if (prevFingerprint === undefined || prevFingerprint !== currentFingerprint) {
      dirty.add(i);
    }
  }
  return dirty;
}

function analyzeFileDecls(ctx: AnalyzerContext, file: FileNode, globalScope: Scope): void {
  for (const stmt of file.statements) {
    if (stmt.kind === 'VarDecl' || stmt.kind === 'FuncDecl' || stmt.kind === 'FuncImpl') {
      analyzeStatement(ctx, globalScope, stmt, globalScope, false);
    }
  }
}

function captureArrayMapLengths<T>(map: Map<string, T[]>): Map<string, number> {
  const lengths = new Map<string, number>();
  for (const [key, list] of map) {
    lengths.set(key, list.length);
  }
  return lengths;
}

function diffArrayMap<T>(before: Map<string, number>, after: Map<string, T[]>): Array<{ nameNormalized: string; entries: T[] }> {
  const diffs: Array<{ nameNormalized: string; entries: T[] }> = [];
  for (const [key, list] of after) {
    const prevLen = before.get(key) ?? 0;
    if (list.length > prevLen) {
      diffs.push({ nameNormalized: key, entries: list.slice(prevLen) });
    }
  }
  return diffs;
}

function sameDeclaredType(
  a: { typeName: TypeName; declaredAt: { fileIndex: number; startOffset: number }; sourcePath: string; implicit: boolean },
  b: { typeName: TypeName; declaredAt: { fileIndex: number; startOffset: number }; sourcePath: string; implicit: boolean }
): boolean {
  return (
    a.typeName === b.typeName &&
    a.sourcePath === b.sourcePath &&
    a.implicit === b.implicit &&
    a.declaredAt.fileIndex === b.declaredAt.fileIndex &&
    a.declaredAt.startOffset === b.declaredAt.startOffset
  );
}

function analyzeFileBodiesWithContrib(
  ctx: AnalyzerContext,
  file: FileNode,
  globalScope: Scope,
  declOccurrences?: SemanticOccurrence[]
): SemanticBodyContrib {
  const diagStart = ctx.diagnostics.length;
  const symbolsByNameBefore = captureArrayMapLengths(ctx.allSymbolsByName);
  const usedByNameBefore = captureArrayMapLengths(ctx.usedIdentifiersByName);
  const assignedByNameBefore = captureArrayMapLengths(ctx.assignedIdentifiersByName);
  const declaredTypesBefore = new Map(ctx.declaredTypesByName);
  const implicitNumeroBefore = new Map(ctx.implicitNumeroAssignmentsByName);
  const endAssignedBefore = new Set(ctx.endParamsAssignedByCall);
  const endExplicitBefore = new Set(ctx.endParamsExplicitlyAssigned);
  const endCallDiagStart = ctx.endParamCallDiagnostics.length;
  const occBefore = ctx.occurrencesByFile?.get(file.sourcePath)?.length ?? 0;

  for (const stmt of file.statements) {
    if (stmt.kind === 'VarDecl' || stmt.kind === 'FuncDecl') continue;
    analyzeStatement(ctx, globalScope, stmt, globalScope, true);
  }

  const diagnostics = ctx.diagnostics.slice(diagStart);
  // IMPORTANT (determinism): symbols are mutable during analysis (e.g. flags like `used/read`).
  // If we store symbol object references in the cache contrib, later mutations can leak into
  // future compiles that reuse cached contribs, breaking determinism.
  // Snapshot symbols here (shallow clone) so contrib becomes immutable.
  const symbolsByName = diffArrayMap(symbolsByNameBefore, ctx.allSymbolsByName).map((entry) => ({
    nameNormalized: entry.nameNormalized,
    entries: entry.entries.map((e) => ({
      ...e,
      symbol: { ...e.symbol }
    }))
  }));
  const usedIdentifiersByName = diffArrayMap(usedByNameBefore, ctx.usedIdentifiersByName);
  const assignedIdentifiersByName = diffArrayMap(assignedByNameBefore, ctx.assignedIdentifiersByName);

  const declaredTypesByName: SemanticBodyContrib['declaredTypesByName'] = [];
  for (const [key, value] of ctx.declaredTypesByName.entries()) {
    const prev = declaredTypesBefore.get(key);
    if (!prev || !sameDeclaredType(prev, value)) {
      declaredTypesByName.push({ nameNormalized: key, value });
    }
  }

  const implicitNumeroAssignmentsByName: SemanticBodyContrib['implicitNumeroAssignmentsByName'] = [];
  for (const [key, value] of ctx.implicitNumeroAssignmentsByName.entries()) {
    const prev = implicitNumeroBefore.get(key);
    if (!prev || prev.fileIndex !== value.fileIndex || prev.startOffset !== value.startOffset) {
      implicitNumeroAssignmentsByName.push({ nameNormalized: key, value });
    }
  }

  const endParamsAssignedByCall: LspSymbol[] = [];
  for (const sym of ctx.endParamsAssignedByCall) {
    if (!endAssignedBefore.has(sym)) {
      endParamsAssignedByCall.push(sym);
    }
  }

  const endParamsExplicitlyAssigned: LspSymbol[] = [];
  for (const sym of ctx.endParamsExplicitlyAssigned) {
    if (!endExplicitBefore.has(sym)) {
      endParamsExplicitlyAssigned.push(sym);
    }
  }

  const endParamCallDiagnostics = ctx.endParamCallDiagnostics.slice(endCallDiagStart);
  const occList = ctx.occurrencesByFile?.get(file.sourcePath);
  const bodyOccurrences = occList ? occList.slice(occBefore) : undefined;
  const occurrences =
    declOccurrences && declOccurrences.length > 0
      ? [...declOccurrences, ...(bodyOccurrences ?? [])]
      : bodyOccurrences;

  return {
    diagnostics,
    symbolsByName,
    usedIdentifiersByName,
    assignedIdentifiersByName,
    declaredTypesByName,
    implicitNumeroAssignmentsByName,
    endParamsAssignedByCall,
    endParamsExplicitlyAssigned,
    endParamCallDiagnostics,
    occurrences
  };
}

function applyBodyContrib(ctx: AnalyzerContext, contrib: SemanticBodyContrib): void {
  for (const entry of contrib.symbolsByName) {
    const list = ctx.allSymbolsByName.get(entry.nameNormalized) ?? [];
    list.push(...entry.entries);
    ctx.allSymbolsByName.set(entry.nameNormalized, list);

    // Determinism / incremental correctness:
    // When we reuse cached body contribs, `ctx.allSymbolsByName` is restored, but the
    // actual scope symbol tables (e.g. `ctx.globalScope`) would otherwise stay empty.
    // `emitUnusedDiagnostics` iterates scope symbols, so globals created only in file bodies
    // (like implicit Numero variables from assignments) must be re-added to the global scope.
    for (const e of entry.entries) {
      if (e.scopeKind === 'global') {
        addSymbol(ctx.globalScope, e.symbol);
      }
    }
  }
  // Drop implicit symbols when a global declaration exists for the same name.
  for (const [nameNormalized, declared] of ctx.declaredTypesByName.entries()) {
    if (!declared || declared.implicit) continue;
    const list = ctx.allSymbolsByName.get(nameNormalized);
    if (!list || list.length === 0) continue;
    const filtered = list.filter((entry) => !(entry.symbol.kind === 'variable' && entry.symbol.implicit));
    if (filtered.length !== list.length) {
      ctx.allSymbolsByName.set(nameNormalized, filtered);
    }
  }
  for (const entry of contrib.usedIdentifiersByName) {
    const list = ctx.usedIdentifiersByName.get(entry.nameNormalized) ?? [];
    list.push(...entry.entries);
    ctx.usedIdentifiersByName.set(entry.nameNormalized, list);
  }
  for (const entry of contrib.assignedIdentifiersByName) {
    const list = ctx.assignedIdentifiersByName.get(entry.nameNormalized) ?? [];
    list.push(...entry.entries);
    ctx.assignedIdentifiersByName.set(entry.nameNormalized, list);
  }
  for (const entry of contrib.declaredTypesByName) {
    ctx.declaredTypesByName.set(entry.nameNormalized, entry.value);
  }
  for (const entry of contrib.implicitNumeroAssignmentsByName) {
    ctx.implicitNumeroAssignmentsByName.set(entry.nameNormalized, entry.value);
  }
  for (const sym of contrib.endParamsAssignedByCall) {
    ctx.endParamsAssignedByCall.add(sym);
  }
  for (const sym of contrib.endParamsExplicitlyAssigned) {
    ctx.endParamsExplicitlyAssigned.add(sym);
  }
  ctx.endParamCallDiagnostics.push(...contrib.endParamCallDiagnostics);
  if (contrib.occurrences && contrib.occurrences.length > 0 && ctx.occurrencesByFile) {
    const sourcePath = contrib.occurrences[0]?.sourcePath;
    if (!sourcePath) return;
    const list = ctx.occurrencesByFile.get(sourcePath) ?? [];
    list.push(...contrib.occurrences);
    ctx.occurrencesByFile.set(sourcePath, list);
  }
  ctx.diagnostics.push(...contrib.diagnostics);
}

function collectTopLevelDeclaredNames(file: FileNode): Set<string> {
  const names = new Set<string>();
  for (const stmt of file.statements) {
    if (stmt.kind === 'VarDecl' || stmt.kind === 'FuncDecl' || stmt.kind === 'FuncImpl') {
      names.add(stmt.nameNormalized);
    }
  }
  return names;
}


function computeTopLevelDeclFingerprint(file: FileNode): string {
  // Stable, order-preserving fingerprint of top-level declarations.
  // This should change when a top-level signature/type changes, even if names remain the same.
  const parts: string[] = [];
  for (const stmt of file.statements) {
    if (!stmt) continue;
    if (stmt.kind === 'VarDecl') {
      const tableFingerprint = stmt.tableDecl
        ? `:${stmt.tableDecl.occurrencesLiteral ?? ''}:${stmt.tableDecl.columns
          .map((column) => `${column.typeName}:${column.nameNormalized}:${column.sizeLiteral ?? ''}`)
          .join(',')}`
        : '';
      // `typeName` is part of the semantic surface; include table schema when present.
      parts.push(`VarDecl:${stmt.nameNormalized}:${stmt.typeName ?? ''}${tableFingerprint}`);
      continue;
    }
    if (stmt.kind === 'FuncDecl' || stmt.kind === 'FuncImpl') {
      const params =
        (stmt.params ?? [])
          .map((p) => `${p.isEnd ? 'end' : 'in'}:${p.nameNormalized}:${p.typeName ?? ''}`)
          .join(',');
      // Prefer explicit return type if present; otherwise keep empty.
      const ret = (stmt as unknown as { returnTypeName?: string | null }).returnTypeName ?? '';
      parts.push(`${stmt.kind}:${stmt.nameNormalized}(${params})->${ret}`);
      continue;
    }
  }
  return parts.join('|');
}


function intersectsSet<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const item of small) {
    if (large.has(item)) return true;
  }
  return false;
}

type DirtyIndexInstrumentation = {
  firstChangedIndex: number;
  firstChangedReason: string;
  firstMismatchPath?: string | undefined;
  firstMismatchPrevKey?: string | undefined;
  firstMismatchCurrKey?: string | undefined;
  fileOrderOrListChanged: boolean;
  baseChangedCount: number;
  dirtyCount: number;
  declChangedCount: number;
  bodyOnlyChangedCount: number;
};

function collectDirectDependentIndices(
  input: {
  files: FileNode[];
  versionKeys: string[];
  prevCache?: SemanticCache | undefined;
  changedFilePaths?: string[] | undefined;
  },
  out?: DirtyIndexInstrumentation
): Set<number> {
  const hasExplicitChangedPaths = Array.isArray(input.changedFilePaths) && input.changedFilePaths.length > 0;

  // --- Instrumentation: first mismatch / ordering ---
  if (out) {
    out.firstChangedIndex = 0;
    out.firstChangedReason = 'noPrevCache';
    out.firstMismatchPath = undefined;
    out.firstMismatchPrevKey = undefined;
    out.firstMismatchCurrKey = undefined;
    out.fileOrderOrListChanged = false;
    out.baseChangedCount = 0;
    out.dirtyCount = 0;
    out.declChangedCount = 0;
    out.bodyOnlyChangedCount = 0;
    if (input.prevCache && input.prevCache.files.length > 0) {
      const minLen = Math.min(input.prevCache.files.length, input.files.length);
      out.firstChangedIndex = input.files.length;
      out.firstChangedReason = 'none';
      for (let i = 0; i < minLen; i += 1) {
        const prev = input.prevCache.files[i];
        const cur = input.files[i];
        if (!prev || !cur) {
          out.firstChangedIndex = i;
          out.firstChangedReason = !prev ? 'noPrevEntry' : 'noFileEntry';
          out.firstMismatchPath = cur?.sourcePath;
          out.firstMismatchPrevKey = prev?.versionKey;
          out.firstMismatchCurrKey = input.versionKeys[i] ?? '';
          out.fileOrderOrListChanged = true;
          break;
        }
        if (prev.filePath !== cur.sourcePath) {
          out.firstChangedIndex = i;
          out.firstChangedReason = 'filePathMismatch';
          out.firstMismatchPath = cur.sourcePath;
          out.firstMismatchPrevKey = prev.versionKey;
          out.firstMismatchCurrKey = input.versionKeys[i] ?? '';
          out.fileOrderOrListChanged = true;
          break;
        }
        const vk = input.versionKeys[i] ?? '';
        if (prev.versionKey !== vk) {
          out.firstChangedIndex = i;
          out.firstChangedReason = 'versionKeyMismatch';
          out.firstMismatchPath = cur.sourcePath;
          out.firstMismatchPrevKey = prev.versionKey;
          out.firstMismatchCurrKey = vk;
          break;
        }
      }
      if (out.firstChangedReason === 'none' && input.prevCache.files.length !== input.files.length) {
        out.firstChangedIndex = minLen;
        out.firstChangedReason = 'lengthChanged';
      }
    }
  }
  // Compute baseChanged by full path-map diff (O(N)), never by suffix/prefix.
  // This prevents a single open-vs-disk mismatch from invalidating the entire tail.
  const baseChanged = new Set<number>();
  if (!input.prevCache || input.prevCache.files.length === 0) {
    for (let i = 0; i < input.files.length; i += 1) baseChanged.add(i);
    if (out) {
      out.baseChangedCount = baseChanged.size;
      out.dirtyCount = baseChanged.size;
      out.bodyOnlyChangedCount = baseChanged.size;
    }
    return baseChanged;
  }

  const prevByPath = new Map<string, SemanticFileCache>();
  for (const entry of input.prevCache.files) {
    if (!entry) continue;
    prevByPath.set(casefold(entry.filePath), entry);
  }

  // If the host provides explicit changed paths, use them as a strong hint.
  const changedByPath = hasExplicitChangedPaths
    ? new Set((input.changedFilePaths ?? []).map((value) => casefold(value)))
    : new Set<string>();

  for (let i = 0; i < input.files.length; i += 1) {
    const current = input.files[i];
    if (!current) continue;
    const key = input.versionKeys[i] ?? '';
    const prev = prevByPath.get(casefold(current.sourcePath));
    if (!prev) {
      baseChanged.add(i);
      continue;
    }
    if (prev.versionKey !== key) {
      baseChanged.add(i);
      continue;
    }
    if (changedByPath.size > 0 && changedByPath.has(casefold(current.sourcePath))) {
      baseChanged.add(i);
      continue;
    }
  }

  // If there is no explicit changed list and everything matches by path+key, treat as fully clean.
  if (!hasExplicitChangedPaths && baseChanged.size === 0) {
    if (out) {
      out.baseChangedCount = 0;
      out.dirtyCount = 0;
      out.declChangedCount = 0;
      out.bodyOnlyChangedCount = 0;
    }
    return baseChanged;
  }

  if (baseChanged.size === 0) {
    if (out) {
      out.baseChangedCount = 0;
      out.dirtyCount = 0;
      out.declChangedCount = 0;
      out.bodyOnlyChangedCount = 0;
    }
    return baseChanged;
  }

  const declaredByFile = input.files.map(collectTopLevelDeclaredNames);
  const changedDeclaredNames = new Set<string>();
  let declChangedCount = 0;
  let bodyOnlyChangedCount = 0;
  for (const index of baseChanged) {
    const currentDeclared = declaredByFile[index] ?? new Set<string>();
    const current = input.files[index];
    const prev = current ? prevByPath.get(casefold(current.sourcePath)) : undefined;
    const prevDeclared = new Set(prev?.topLevelDeclaredNames ?? []);
    const prevFingerprint = prev?.topLevelDeclFingerprint;
    const currentFingerprint = current ? computeTopLevelDeclFingerprint(current) : '';
    let hasStructuralChange = false;
    if (prevFingerprint !== undefined && prevFingerprint !== null && prevFingerprint !== currentFingerprint) {
      hasStructuralChange = true;
      // Signature/type changed without name changes.
      for (const name of currentDeclared) changedDeclaredNames.add(name);
      for (const name of prevDeclared) changedDeclaredNames.add(name);
    }
    for (const name of currentDeclared) {
      if (!prevDeclared.has(name)) {
        hasStructuralChange = true;
        changedDeclaredNames.add(name);
      }
    }
    for (const name of prevDeclared) {
      if (!currentDeclared.has(name)) {
        hasStructuralChange = true;
        changedDeclaredNames.add(name);
      }
    }
    if (hasStructuralChange) {
      declChangedCount += 1;
      // Only when there is a real structural change do we fan-out dependents.
      // Keeping same names but changing bodies must NOT mark all declarations as dirty.
      for (const name of currentDeclared) {
        changedDeclaredNames.add(name);
      }
    } else {
      bodyOnlyChangedCount += 1;
    }
  }
  if (changedDeclaredNames.size === 0) {
    if (out) {
      out.baseChangedCount = baseChanged.size;
      out.dirtyCount = baseChanged.size;
      out.declChangedCount = declChangedCount;
      out.bodyOnlyChangedCount = bodyOnlyChangedCount;
    }
    return baseChanged;
  }

  const directDependents = new Set<number>(baseChanged);
  for (let i = 0; i < input.files.length; i += 1) {
    if (baseChanged.has(i)) continue;
    const current = input.files[i];
    if (!current) continue;
    const prev = prevByPath.get(casefold(current.sourcePath));
    const versionKey = input.versionKeys[i] ?? '';
    if (!prev || prev.versionKey !== versionKey) {
      directDependents.add(i);
      continue;
    }
    const touchedNames = new Set<string>();
    for (const entry of prev.bodyContrib.usedIdentifiersByName) {
      touchedNames.add(entry.nameNormalized);
    }
    for (const entry of prev.bodyContrib.assignedIdentifiersByName) {
      touchedNames.add(entry.nameNormalized);
    }
    if (intersectsSet(touchedNames, changedDeclaredNames)) {
      directDependents.add(i);
    }
  }
  if (out) {
    out.baseChangedCount = baseChanged.size;
    out.dirtyCount = directDependents.size;
    out.declChangedCount = declChangedCount;
    out.bodyOnlyChangedCount = bodyOnlyChangedCount;
  }
  return directDependents;
}

export async function analyzeProgramIncremental(input: {
  contextId: string;
  system: 'SENIOR' | 'HCM' | 'ACESSO' | 'ERP';
  program: ProgramNode;
  versionKeys: string[];
  prevCache?: SemanticCache | undefined;
  changedFilePaths?: string[] | undefined;
  semanticBudgetFiles?: number | undefined;
  includeSemantics?: boolean | undefined;
  /**
   * True when the compile analyzed the full file list of the context. If false (prefix compiles),
   * global-scope unused diagnostics must be suppressed.
   */
  isFullContextValidated?: boolean | undefined;
}): Promise<{
  diagnostics: Diagnostic[];
  cache: SemanticCache;
  occurrencesByFile?: Map<string, SemanticOccurrence[]> | undefined;
  startIndex: number;
  reusedFiles: number;
  analyzedFiles: number;
  bindMs: number;
  analyzeMs: number;
  incrementalReuseMs: number;
  firstChangedIndex: number;
  firstChangedReason: string;
  firstMismatchPath?: string | undefined;
  firstMismatchPrevKey?: string | undefined;
  firstMismatchCurrKey?: string | undefined;
  fileOrderOrListChanged: boolean;
  baseChangedCount: number;
  dirtyCount: number;
  declChangedCount: number;
  bodyOnlyChangedCount: number;
}> {
  const reuseStart = performance.now();
  const registry = await loadInternalRegistry(input.system);
  const globalScope = createScope('global', null);
  atribuirEscopo(input.program, globalScope);
  for (const file of input.program.files) {
    atribuirEscopo(file, globalScope);
  }
  const functionRecords = collectFunctionRecords(input.program.files);
  const labelsByFileAndScope = collectLabelsByFileAndScope(input.program.files);
  const occurrencesByFile = input.includeSemantics ? new Map<string, SemanticOccurrence[]>() : undefined;
  const declOccurrencesByFile = input.includeSemantics ? new Map<string, SemanticOccurrence[]>() : undefined;

  const customFunctionDecls = new Map<string, { orderKey: { fileIndex: number; startOffset: number }; params: ParamNode[] }>();
  for (const record of functionRecords.values()) {
    if (record.decl) {
      customFunctionDecls.set(record.decl.nameNormalized, { orderKey: record.decl.orderKey, params: record.decl.params });
    }
  }

  const ctx: AnalyzerContext = {
    contextId: input.contextId,
    system: input.system,
    registry,
    diagnostics: [],
    globalScope,
    isFullContextValidated: input.isFullContextValidated ?? true,
    customFunctionDecls,
    allSymbolsByName: new Map(),
    usedIdentifiersByName: new Map(),
    assignedIdentifiersByName: new Map(),
    declaredTypesByName: new Map(),
    implicitNumeroAssignmentsByName: new Map(),
    endParamsAssignedByCall: new Set(),
    endParamsExplicitlyAssigned: new Set(),
    endParamCallDiagnostics: [],
    labelsByFileAndScope,
    functionScopeKeyById: new Map()
  };
  if (occurrencesByFile) {
    ctx.occurrencesByFile = occurrencesByFile;
  }

  const nextCache: SemanticFileCache[] = [];
  const dirtyInstr: DirtyIndexInstrumentation = {
    firstChangedIndex: 0,
    firstChangedReason: 'noPrevCache',
    firstMismatchPath: undefined,
    firstMismatchPrevKey: undefined,
    firstMismatchCurrKey: undefined,
    fileOrderOrListChanged: false,
    baseChangedCount: 0,
    dirtyCount: 0,
    declChangedCount: 0,
    bodyOnlyChangedCount: 0
  };
  const dirtyIndices = collectDirectDependentIndices({
    files: input.program.files,
    versionKeys: input.versionKeys,
    prevCache: input.prevCache,
    changedFilePaths: input.changedFilePaths
  }, dirtyInstr);
  const declDirtyIndices = collectDeclDirtyIndices({
    files: input.program.files,
    prevCache: input.prevCache
  });
  const incrementalReuseMs = performance.now() - reuseStart;
  const startIndex = dirtyIndices.size > 0 ? Math.min(...dirtyIndices) : input.program.files.length;
  let reusedFiles = 0;
  let analyzedFiles = 0;

  // Reuse must be path-based (not index-based) to be robust to any list differences.
  // NOTE: we still let dirtyIndices (computed with strict ordering instrumentation) prevent
  // unsafe reuse when the file order/list changed.
  const prevByPath = new Map<string, SemanticFileCache>();
  if (input.prevCache)
  {
    for (const entry of input.prevCache.files)
    {
      if (!entry) continue;
      prevByPath.set(casefold(entry.filePath), entry);
    }
  }

  const declContribByIndex: Array<SemanticDeclContrib | undefined> = new Array(input.program.files.length);
  const bindStart = performance.now();
  for (let i = 0; i < input.program.files.length; i += 1) {
    const file = input.program.files[i];
    if (!file) continue;
    const prev = prevByPath.get(casefold(file.sourcePath));
    const canReuseDecl = !declDirtyIndices.has(i) && !!prev?.declContrib;
    if (canReuseDecl) {
      applyDeclContrib(ctx, prev.declContrib!);
      declContribByIndex[i] = prev.declContrib;
      if (declOccurrencesByFile) {
        declOccurrencesByFile.set(file.sourcePath, prev.declContrib?.occurrences ?? []);
      }
      continue;
    }
    const declContrib = analyzeFileDeclsWithContrib(ctx, file, globalScope);
    declContribByIndex[i] = declContrib;
    if (declOccurrencesByFile) {
      declOccurrencesByFile.set(file.sourcePath, declContrib.occurrences ?? []);
    }
  }
  const bindMs = performance.now() - bindStart;

  const analyzeStart = performance.now();
  for (let i = 0; i < input.program.files.length; i += 1) {
    const file = input.program.files[i];
    if (!file) continue;
    const versionKey = input.versionKeys[i] ?? '';
    const prev = prevByPath.get(casefold(file.sourcePath));
    const budget = input.semanticBudgetFiles ?? 0;
    const canBudgetReuse =
      budget > 0 &&
      analyzedFiles >= budget &&
      !dirtyIndices.has(i) &&
      prev &&
      prev.filePath === file.sourcePath &&
      prev.versionKey === versionKey;
    if (canBudgetReuse) {
      applyBodyContrib(ctx, prev.bodyContrib);
      nextCache.push(prev);
      reusedFiles += 1;
      continue;
    }
    const canReuse = !dirtyIndices.has(i) && prev && prev.filePath === file.sourcePath && prev.versionKey === versionKey;
    if (canReuse) {
      applyBodyContrib(ctx, prev.bodyContrib);
      nextCache.push(prev);
      reusedFiles += 1;
      continue;
    }
    const contrib = analyzeFileBodiesWithContrib(ctx, file, globalScope, declOccurrencesByFile?.get(file.sourcePath));
    const declContrib = declContribByIndex[i];
    nextCache.push({
      filePath: file.sourcePath,
      fileIndex: i,
      versionKey,
      topLevelDeclaredNames: [...collectTopLevelDeclaredNames(file)],
      topLevelDeclFingerprint: computeTopLevelDeclFingerprint(file),
      ...(declContrib ? { declContrib } : {}),
      bodyContrib: contrib
    });
    analyzedFiles += 1;
  }
  const analyzeMs = performance.now() - analyzeStart;

  emitFunctionDiagnostics(ctx, functionRecords);
  emitUnusedDiagnostics(ctx, globalScope);
  emitImplicitTypeConflicts(ctx);

  if (ctx.endParamsExplicitlyAssigned.size > 0 && ctx.endParamCallDiagnostics.length > 0) {
    const toRemove = new Set<Diagnostic>();
    for (const entry of ctx.endParamCallDiagnostics) {
      if (ctx.endParamsExplicitlyAssigned.has(entry.symbol)) {
        toRemove.add(entry.diagnostic);
      }
    }
    if (toRemove.size > 0) {
      ctx.diagnostics = ctx.diagnostics.filter((diag) => !toRemove.has(diag));
    }
  }

  const baseResult = {
    diagnostics: ctx.diagnostics,
    cache: { files: nextCache },
    startIndex,
    reusedFiles,
    analyzedFiles,
    bindMs,
    analyzeMs,
    incrementalReuseMs,
    firstChangedIndex: dirtyInstr.firstChangedIndex,
    firstChangedReason: dirtyInstr.firstChangedReason,
    firstMismatchPath: dirtyInstr.firstMismatchPath,
    firstMismatchPrevKey: dirtyInstr.firstMismatchPrevKey,
    firstMismatchCurrKey: dirtyInstr.firstMismatchCurrKey,
    fileOrderOrListChanged: dirtyInstr.fileOrderOrListChanged,
    baseChangedCount: dirtyInstr.baseChangedCount,
    dirtyCount: dirtyInstr.dirtyCount,
    declChangedCount: dirtyInstr.declChangedCount,
    bodyOnlyChangedCount: dirtyInstr.bodyOnlyChangedCount
  };
  return occurrencesByFile
    ? { ...baseResult, occurrencesByFile }
    : baseResult;
}

async function analyzeProgramFull(input: {
  contextId: string;
  system: 'SENIOR' | 'HCM' | 'ACESSO' | 'ERP';
  program: ProgramNode;
  includeSemantics: boolean;
}): Promise<{ diagnostics: Diagnostic[]; occurrencesByFile?: Map<string, SemanticOccurrence[]> | undefined }> {
  const registry = await loadInternalRegistry(input.system);
  const globalScope = createScope('global', null);
  atribuirEscopo(input.program, globalScope);
  for (const file of input.program.files) {
    atribuirEscopo(file, globalScope);
  }
  const functionRecords = collectFunctionRecords(input.program.files);
  const labelsByFileAndScope = collectLabelsByFileAndScope(input.program.files);

  const customFunctionDecls = new Map<string, { orderKey: { fileIndex: number; startOffset: number }; params: ParamNode[] }>();
  for (const record of functionRecords.values()) {
    if (record.decl) {
      customFunctionDecls.set(record.decl.nameNormalized, { orderKey: record.decl.orderKey, params: record.decl.params });
    }
  }

  const occurrencesByFile = input.includeSemantics ? new Map<string, SemanticOccurrence[]>() : undefined;
  const ctx: AnalyzerContext = {
    contextId: input.contextId,
    system: input.system,
    registry,
    diagnostics: [],
    globalScope,
    isFullContextValidated: true,
    customFunctionDecls,
    allSymbolsByName: new Map(),
    usedIdentifiersByName: new Map(),
    assignedIdentifiersByName: new Map(),
    declaredTypesByName: new Map(),
    implicitNumeroAssignmentsByName: new Map(),
    endParamsAssignedByCall: new Set(),
    endParamsExplicitlyAssigned: new Set(),
    endParamCallDiagnostics: [],
    labelsByFileAndScope,
    functionScopeKeyById: new Map()
  };
  if (occurrencesByFile) {
    ctx.occurrencesByFile = occurrencesByFile;
  }

  // Pass 1: register global declarations in order (skip function bodies).
  for (const file of input.program.files) {
    for (const stmt of file.statements) {
      if (stmt.kind === 'VarDecl' || stmt.kind === 'FuncDecl' || stmt.kind === 'FuncImpl') {
        analyzeStatement(ctx, globalScope, stmt, globalScope, false);
      }
    }
  }

  // Pass 2: analyze bodies and remaining statements in order.
  for (const file of input.program.files) {
    for (const stmt of file.statements) {
      if (stmt.kind === 'VarDecl' || stmt.kind === 'FuncDecl') continue;
      analyzeStatement(ctx, globalScope, stmt, globalScope, true);
    }
  }

  emitFunctionDiagnostics(ctx, functionRecords);
  emitUnusedDiagnostics(ctx, globalScope);
  emitImplicitTypeConflicts(ctx);

  if (ctx.endParamsExplicitlyAssigned.size > 0 && ctx.endParamCallDiagnostics.length > 0) {
    const toRemove = new Set<Diagnostic>();
    for (const entry of ctx.endParamCallDiagnostics) {
      if (ctx.endParamsExplicitlyAssigned.has(entry.symbol)) {
        toRemove.add(entry.diagnostic);
      }
    }
    if (toRemove.size > 0) {
      ctx.diagnostics = ctx.diagnostics.filter((diag) => !toRemove.has(diag));
    }
  }

  return occurrencesByFile
    ? { diagnostics: ctx.diagnostics, occurrencesByFile }
    : { diagnostics: ctx.diagnostics };
}

export async function analyzeProgramWithSemantics(input: {
  contextId: string;
  system: 'SENIOR' | 'HCM' | 'ACESSO' | 'ERP';
  program: ProgramNode;
}): Promise<{ diagnostics: Diagnostic[]; occurrencesByFile: Map<string, SemanticOccurrence[]> }> {
  const result = await analyzeProgramFull({ ...input, includeSemantics: true });
  return { diagnostics: result.diagnostics, occurrencesByFile: result.occurrencesByFile ?? new Map() };
}

export async function analyzeProgram(input: { contextId: string; system: 'SENIOR' | 'HCM' | 'ACESSO' | 'ERP'; program: ProgramNode }): Promise<{ diagnostics: Diagnostic[] }> {
  const result = await analyzeProgramFull({ ...input, includeSemantics: false });
  return { diagnostics: result.diagnostics };
}
