import { buildContext, type ContentOverrides, type ValidationContextConfig } from './context-manager';
import { parseFiles } from '../parser/parser';
import type { ExpressionNode, ParamNode, ProgramNode, StatementNode, TypeName } from '../parser/ast';
import { casefold } from '../utils/casefold';

export type SymbolKind = 'variable' | 'function';

export type SymbolInfo = {
  kind: SymbolKind;
  name: string;
  nameNormalized: string;
  typeName: TypeName;
  params?: ParamNode[] | undefined;
  declared?: boolean | undefined;
  implemented?: boolean | undefined;
  range?: { start: { line: number; character: number }; end: { line: number; character: number } } | undefined;
  sourcePath: string;
  listFields?: string[] | undefined;
  cursorFields?: string[] | undefined;
  tableOccurrences?: number | undefined;
  tableColumns?: Array<{ name: string; typeName: TypeName; size?: number | undefined }> | undefined;
};

type SymbolCollectContext = {
  symbols: SymbolInfo[];
  firstListByName: Map<string, SymbolInfo>;
  firstCursorByName: Map<string, SymbolInfo>;
};

function collectFromStatement(stmt: StatementNode, ctx: SymbolCollectContext): void {
  if (stmt.kind === 'VarDecl') {
    const symbol: SymbolInfo = {
      kind: 'variable',
      name: stmt.name,
      nameNormalized: stmt.nameNormalized,
      typeName: stmt.typeName,
      range: stmt.range,
      sourcePath: stmt.sourcePath
    };
    if (stmt.typeName === 'Lista') symbol.listFields = [];
    if (stmt.typeName === 'Cursor') symbol.cursorFields = [];
    if (stmt.typeName === 'Tabela' && stmt.tableDecl) {
      const parsedOccurrences = Number.parseInt(stmt.tableDecl.occurrencesLiteral ?? '', 10);
      symbol.tableOccurrences = Number.isFinite(parsedOccurrences) ? parsedOccurrences : undefined;
      symbol.tableColumns = stmt.tableDecl.columns
        .filter((column) => Boolean(column.nameNormalized))
        .map((column) => {
          const parsedSize = column.sizeLiteral !== undefined ? Number.parseInt(column.sizeLiteral, 10) : Number.NaN;
          return {
            name: column.name,
            typeName: column.typeName,
            size: Number.isFinite(parsedSize) ? parsedSize : undefined
          };
        });
    }
    ctx.symbols.push(symbol);
    if (stmt.typeName === 'Lista' && !ctx.firstListByName.has(stmt.nameNormalized)) {
      ctx.firstListByName.set(stmt.nameNormalized, symbol);
    }
    if (stmt.typeName === 'Cursor' && !ctx.firstCursorByName.has(stmt.nameNormalized)) {
      ctx.firstCursorByName.set(stmt.nameNormalized, symbol);
    }
    return;
  }
  if (stmt.kind === 'FuncDecl' || stmt.kind === 'FuncImpl') {
    ctx.symbols.push({
      kind: 'function',
      name: stmt.name,
      nameNormalized: stmt.nameNormalized,
      typeName: 'Funcao',
      params: stmt.params,
      declared: stmt.kind === 'FuncDecl',
      implemented: stmt.kind === 'FuncImpl',
      range: stmt.range,
      sourcePath: stmt.sourcePath
    });
  }
}

function collectListFields(expr: ExpressionNode, ctx: SymbolCollectContext): void {
  if (expr.kind === 'Call' && expr.callee.kind === 'Member') {
    const member = expr.callee;
    if (member.object.kind === 'Identifier' && member.property.nameNormalized === 'adicionarcampo') {
      const objectName = 'nameNormalized' in member.object ? member.object.nameNormalized : '';
      const listSymbol = ctx.firstListByName.get(objectName);
      const nameArg = expr.args[0];
      if (listSymbol && nameArg && nameArg.kind === 'StringLiteral') {
        const field = nameArg.value.slice(1, -1).trim();
        if (field) {
          listSymbol.listFields = listSymbol.listFields ?? [];
          if (!listSymbol.listFields.includes(field)) listSymbol.listFields.push(field);
        }
      }
    }
  }

  if (expr.kind === 'Binary') {
    collectListFields(expr.left, ctx);
    collectListFields(expr.right, ctx);
  }
  if (expr.kind === 'Member') collectListFields(expr.object, ctx);
  if (expr.kind === 'Index') {
    collectListFields(expr.object, ctx);
    collectListFields(expr.index, ctx);
  }
  if (expr.kind === 'Call') {
    for (const arg of expr.args) collectListFields(arg, ctx);
  }
  if (expr.kind === 'Paren' && expr.expr) collectListFields(expr.expr, ctx);
}

function extractSelectFields(sqlLiteral: string): string[] {
  // Normalize common multi-line SQL patterns used in LSP strings:
  // - Line continuation with a trailing backslash
  // - Excess whitespace/newlines
  const normalized = sqlLiteral
    .replace(/\\\r?\n\s*/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const selectMatch = /select\s+(distinct\s+)?([\s\S]*?)\s+from\b/i.exec(normalized);
  if (!selectMatch) return [];
  const projection = selectMatch[2] ?? '';
  return projection
    .split(',')
    .map((part) => part.trim())
    .flatMap((part) => {
      if (part === '*' || part.endsWith('.*')) return '';
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

function collectCursorFieldsFromAssignment(stmt: StatementNode, ctx: SymbolCollectContext): void {
  if (stmt.kind !== 'Assignment') return;
  const target = stmt.target;
  const value = stmt.value;
  if (!value || value.kind !== 'StringLiteral') return;
  if (target.kind !== 'Member') return;
  if (target.object.kind !== 'Identifier') return;
  if (target.property.nameNormalized !== 'sql') return;

  const objectName = 'nameNormalized' in target.object ? target.object.nameNormalized : '';
  const cursor = ctx.firstCursorByName.get(objectName);
  if (!cursor) return;

  const raw = value.value.slice(1, -1);
  const fields = extractSelectFields(raw);
  cursor.cursorFields = cursor.cursorFields ?? [];
  for (const field of fields) {
    if (!cursor.cursorFields.includes(field)) cursor.cursorFields.push(field);
  }
}

function collectCursorFields(expr: ExpressionNode, ctx: SymbolCollectContext): void {
  if (expr.kind === 'Binary' && expr.operator === '=' && expr.left.kind === 'Member') {
    const member = expr.left;
    if (member.object.kind === 'Identifier' && member.property.nameNormalized === 'sql') {
      const objectName = 'nameNormalized' in member.object ? member.object.nameNormalized : '';
      const cursor = ctx.firstCursorByName.get(objectName);
      if (cursor && expr.right.kind === 'StringLiteral') {
        const raw = expr.right.value.slice(1, -1);
        const fields = extractSelectFields(raw);
        cursor.cursorFields = cursor.cursorFields ?? [];
        for (const field of fields) {
          if (!cursor.cursorFields.includes(field)) cursor.cursorFields.push(field);
        }
      }
    }
  }
  if (expr.kind === 'Binary') {
    collectCursorFields(expr.left, ctx);
    collectCursorFields(expr.right, ctx);
  }
  if (expr.kind === 'Member') collectCursorFields(expr.object, ctx);
  if (expr.kind === 'Index') {
    collectCursorFields(expr.object, ctx);
    collectCursorFields(expr.index, ctx);
  }
  if (expr.kind === 'Call') {
    for (const arg of expr.args) collectCursorFields(arg, ctx);
  }
  if (expr.kind === 'Paren' && expr.expr) collectCursorFields(expr.expr, ctx);
}

function visitStatementTree(stmt: StatementNode, visit: (node: StatementNode) => void): void {
  visit(stmt);
  switch (stmt.kind) {
    case 'Block':
      for (const child of stmt.statements) visitStatementTree(child, visit);
      return;
    case 'If':
      if (stmt.thenBranch) visitStatementTree(stmt.thenBranch, visit);
      if (stmt.elseBranch) visitStatementTree(stmt.elseBranch, visit);
      return;
    case 'While':
      if (stmt.body) visitStatementTree(stmt.body, visit);
      return;
    case 'For':
      if (stmt.init) visitStatementTree(stmt.init, visit);
      if (stmt.body) visitStatementTree(stmt.body, visit);
      return;
    case 'FuncImpl':
      if (stmt.body) visitStatementTree(stmt.body, visit);
      return;
    default:
      return;
  }
}

function collectExpressionArtifactsFromStatement(stmt: StatementNode, ctx: SymbolCollectContext): void {
  if (stmt.kind === 'ExprStmt') {
    collectListFields(stmt.expr, ctx);
    collectCursorFields(stmt.expr, ctx);
    return;
  }
  if (stmt.kind === 'Assignment') {
    collectListFields(stmt.target, ctx);
    if (stmt.value) collectListFields(stmt.value, ctx);
    collectCursorFieldsFromAssignment(stmt, ctx);
    collectCursorFields(stmt.target, ctx);
    if (stmt.value) collectCursorFields(stmt.value, ctx);
    return;
  }
  if (stmt.kind === 'If' && stmt.condition) {
    collectListFields(stmt.condition, ctx);
    collectCursorFields(stmt.condition, ctx);
    return;
  }
  if (stmt.kind === 'While' && stmt.condition) {
    collectListFields(stmt.condition, ctx);
    collectCursorFields(stmt.condition, ctx);
    return;
  }
  if (stmt.kind === 'For') {
    if (stmt.condition) {
      collectListFields(stmt.condition, ctx);
      collectCursorFields(stmt.condition, ctx);
    }
    if (stmt.update) {
      collectListFields(stmt.update, ctx);
      collectCursorFields(stmt.update, ctx);
    }
  }
}

function collectFromProgram(program: ProgramNode): SymbolInfo[] {
  const ctx: SymbolCollectContext = {
    symbols: [],
    firstListByName: new Map(),
    firstCursorByName: new Map()
  };
  for (const file of program.files) {
    for (const stmt of file.statements) {
      visitStatementTree(stmt, (node) => {
        collectFromStatement(node, ctx);
        collectExpressionArtifactsFromStatement(node, ctx);
      });
    }
  }

  const unique = new Map<string, SymbolInfo>();
  for (const sym of ctx.symbols) {
    const baseKey = `${sym.kind}:${casefold(sym.name)}`;
    // Keep all function entries (decl + impl) to enable go-to-definition/implementation.
    const key = sym.kind === 'function' ? `${baseKey}:${sym.sourcePath}:${sym.range?.start.line ?? 0}` : baseKey;
    if (!unique.has(key)) {
      unique.set(key, sym);
    }
  }

  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

export function getProgramSymbols(program: ProgramNode): SymbolInfo[] {
  return collectFromProgram(program);
}

export async function getContextSymbols(
  config: ValidationContextConfig,
  contentOverrides?: ContentOverrides
): Promise<SymbolInfo[]> {
  const context = contentOverrides
    ? await buildContext(config, { contentOverrides })
    : await buildContext(config);
  const { program } = parseFiles(context.files);

  return collectFromProgram(program);
}
