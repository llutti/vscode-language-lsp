import type { Token } from '../lexer/tokenizer';
import type { FileNode, StatementNode } from '../parser/ast';
import { concat, group, indent, line, text, type Doc } from './doc';

// Estratégia (Patch A/B/C/D): formato canônico inspirado no formatter do TypeScript,
// adaptado para sintaxe LSP (Se/Senao/Enquanto/Para, Inicio/Fim, { }).
//
// Regras obrigatórias do milestone:
// - Apenas whitespace (o token.value é sempre impresso como átomo).
// - Strings e comentários (inclusive SQL/HTML dentro de string) são intocados.

const CONTROL_KEYWORDS = new Set(['se', 'enquanto', 'para']);
const LOGICAL_KEYWORDS = new Set(['e', 'ou']);

const NO_SPACE_BEFORE = new Set([')', ']', '}', ',', ';', '.', ':']);
const OPEN_DELIMS = new Set(['(', '[', '{']);
const CLOSE_DELIMS = new Set([')', ']', '}']);

function isKeyword(t: Token, normalized: string): boolean {
  return t.type === 'Keyword' && t.normalized === normalized;
}

function isDelimiter(t: Token, value: string): boolean {
  return t.type === 'Delimiter' && t.value === value;
}

function isWordish(t: Token): boolean {
  return t.type === 'Identifier' || t.type === 'Keyword' || t.type === 'Type' || t.type === 'Number' || t.type === 'String' || t.type === 'Apostrophe';
}

function isUnaryPrefixOperator(op: Token, prevPrev: Token | null): boolean {
  if (op.type !== 'Operator') return false;
  // Operadores que normalmente são unários prefixados.
  if (op.value === '!' || op.value === '~') return true;
  if (op.value !== '+' && op.value !== '-') return false;

  // Heurística TS-like: "+"/"-" é unário quando não há "valor" à esquerda.
  // Exemplos: -(x), +1, a = -(b), foo(-1)
  if (!prevPrev) return true;
  if (prevPrev.type === 'Operator') return true;
  if (
    prevPrev.type === 'Delimiter' &&
    (OPEN_DELIMS.has(prevPrev.value) || prevPrev.value === ',' || prevPrev.value === ';' || prevPrev.value === ':')
  ) {
    return true;
  }
  return false;
}

function shouldSpaceBefore(curr: Token, prev: Token | null, prevPrev: Token | null, atLineStart: boolean): boolean {
  if (!prev || atLineStart) return false;
  // Sempre 1 espaço após vírgula em listas/args.
  if (prev.type === 'Delimiter' && prev.value === ',') return true;
  if (curr.type === 'Delimiter' && NO_SPACE_BEFORE.has(curr.value)) return false;
  if (prev.type === 'Delimiter' && OPEN_DELIMS.has(prev.value)) return false;
  if (prev.type === 'Delimiter' && prev.value === '.') return false;
  if (curr.type === 'Delimiter' && curr.value === '[') return false;
  if (curr.type === 'Delimiter' && curr.value === '(') {
    // Se ( ... ), Enquanto ( ... ), Para ( ... )
    // e/ou ( ... ) também pode aparecer como Identifier dependendo do tokenizer.
    // Espaço obrigatório em headers de controle: Se ( ... ), Enquanto ( ... ), Para ( ... )
    if ((prev.type === 'Keyword' || prev.type === 'Identifier') && CONTROL_KEYWORDS.has(prev.normalized)) return true;

    // e/ou ( ... ) também pode aparecer como Identifier dependendo do tokenizer.
    if (
      (prev.type === 'Keyword' || prev.type === 'Identifier' || prev.type === 'Operator') &&
      LOGICAL_KEYWORDS.has(prev.normalized)
    ) {
      return true;
    }

    // TS-like: após operador binário deve haver espaço antes de "(".
    // Ex.: x - (y + 2), x >= (y)
    // Mas preserva unário prefixado: -(x), +(x), !(x)
    if (prev.type === 'Operator') {
      return !isUnaryPrefixOperator(prev, prevPrev);
    }

    // Chamadas/índices: foo(, arr[(, etc) não têm espaço.
    return false;
  }
  if (curr.type === 'Operator') {
    if (prev.type === 'Operator') {
      return isUnaryPrefixOperator(curr, prev) ? !isUnaryPrefixOperator(prev, prevPrev) : false;
    }
    if (prev.type === 'Delimiter' && OPEN_DELIMS.has(prev.value)) return false;
    if (prev.type === 'Delimiter' && prev.value === ',') return false;
    // Operadores unários pós-fixados (TS-like): não separar com espaço do identificador.
    // Ex.: x--; x++; obj.prop--; arr[i]++;
    if ((curr.value === '++' || curr.value === '--') &&
        (isWordish(prev) || (prev.type === 'Delimiter' && CLOSE_DELIMS.has(prev.value)))) {
      return false;
    }

    return true;
  }
  if (curr.type === 'Delimiter' && (curr.value === '.' || curr.value === ':')) return false;
  if (prev.type === 'Operator' && isUnaryPrefixOperator(prev, prevPrev)) return false;
  return isWordish(prev) || (prev.type === 'Delimiter' && CLOSE_DELIMS.has(prev.value)) || prev.type === 'Operator';
}

function isLineComment(t: Token): boolean {
  return t.type === 'CommentLine';
}

function isBlockComment(t: Token): boolean {
  return t.type === 'CommentBlock';
}

function hasNextNonWsOnSameLineFrom(sourceText: string, offset: number): boolean {
  for (let i = Math.max(0, offset); i < sourceText.length; i++) {
    const ch = sourceText[i];
    if (ch === ' ' || ch === '\t') continue;
    // sourceText is normalized to \n in format.ts, but keep this robust.
    if (ch === '\r') continue;
    if (ch === '\n') return false;
    return true;
  }
  return false;
}

function hasNewlineBetween(sourceText: string, a: number, b: number): boolean {
  const start = Math.max(0, Math.min(a, b));
  const end = Math.max(0, Math.max(a, b));
  // sourceText is normalized to \n in format.ts, but keep CR robust.
  for (let i = start; i < Math.min(end, sourceText.length); i += 1) {
    const ch = sourceText[i];
    if (ch === '\n' || ch === '\r') return true;
  }
  return false;
}

function commentLogicalEndOffset(t: Token): number {
  // Do not rely on tokenizer's endOffset in edge-cases. Token.value is the exact
  // text slice, so startOffset + value.length is a robust end marker.
  return t.startOffset + t.value.length;
}

function hasOriginalNewlineAfterLineComment(sourceText: string, commentEndExclusive: number): boolean {
  // In some legacy inputs the comment is followed by spaces before the EOL.
  // We must preserve the original line break in those cases.
  for (let i = Math.max(0, commentEndExclusive); i < sourceText.length; i += 1) {
    const ch = sourceText[i]!;
    if (ch === ' ' || ch === '\t') continue;
    return ch === '\n' || ch === '\r';
  }
  return false;
}


function getOriginalInlineSpacingBeforeComment(sourceText: string, commentStartOffset: number): string | null {
  if (commentStartOffset <= 0 || commentStartOffset > sourceText.length) return null;
  let cursor = commentStartOffset - 1;
  while (cursor >= 0) {
    const ch = sourceText[cursor]!;
    if (ch === ' ' || ch === '\t') {
      cursor -= 1;
      continue;
    }
    if (ch === '\n' || ch === '\r') return null;
    const spacing = sourceText.slice(cursor + 1, commentStartOffset);
    return spacing.length > 0 ? spacing : null;
  }
  return null;
}

function collectSingleStatementRanges(file: FileNode): Map<number, number> {
  const ranges = new Map<number, number>();

  const walk = (stmt: StatementNode | null): void => {
    if (!stmt) return;
    switch (stmt.kind) {
      case 'If':
        if (stmt.thenBranch && stmt.thenBranch.kind !== 'Block') {
          ranges.set(stmt.thenBranch.range.start.line, stmt.thenBranch.range.end.line);
        }
        if (stmt.elseBranch && stmt.elseBranch.kind !== 'Block') {
          ranges.set(stmt.elseBranch.range.start.line, stmt.elseBranch.range.end.line);
        }
        walk(stmt.thenBranch);
        walk(stmt.elseBranch);
        return;
      case 'While':
        if (stmt.body && stmt.body.kind !== 'Block') {
          ranges.set(stmt.body.range.start.line, stmt.body.range.end.line);
        }
        walk(stmt.body);
        return;
      case 'For':
        if (stmt.body && stmt.body.kind !== 'Block') {
          ranges.set(stmt.body.range.start.line, stmt.body.range.end.line);
        }
        walk(stmt.body);
        return;
      case 'Block':
        for (const child of stmt.statements) walk(child);
        return;
      case 'FuncImpl':
        walk(stmt.body);
        return;
      default:
        return;
    }
  };

  for (const stmt of file.statements) walk(stmt);
  return ranges;
}

function collectTableLayoutMarkers(tokens: Token[]): {
  tableEqualsIndices: Set<number>;
  tableOpenBraceIndices: Set<number>;
  tableCloseBraceIndices: Set<number>;
  tableLegacyInicioIndices: Set<number>;
  tableLegacyFimIndices: Set<number>;
} {
  const tableEqualsIndices = new Set<number>();
  const tableOpenBraceIndices = new Set<number>();
  const tableCloseBraceIndices = new Set<number>();
  const tableLegacyInicioIndices = new Set<number>();
  const tableLegacyFimIndices = new Set<number>();

  const nextSignificantIndex = (from: number): number => {
    for (let i = from; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      if (!token || token.type === 'EOF') return -1;
      if (isLineComment(token) || isBlockComment(token)) continue;
      return i;
    }
    return -1;
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (!token || token.type === 'EOF') break;
    if (!isKeyword(token, 'definir')) continue;

    const typeIndex = nextSignificantIndex(i + 1);
    if (typeIndex < 0) break;
    const typeToken = tokens[typeIndex]!;
    if (!typeToken || typeToken.normalized !== 'tabela') continue;

    let paren = 0;
    let bracket = 0;
    let brace = 0;
    let eqIndex = -1;
    let openBraceIndex = -1;
    let closeBraceIndex = -1;
    let legacyInicioIndex = -1;
    let legacyFimIndex = -1;
    let semicolonIndex = -1;

    for (let j = typeIndex + 1; j < tokens.length; j += 1) {
      const current = tokens[j]!;
      if (!current || current.type === 'EOF') break;
      if (isLineComment(current) || isBlockComment(current)) continue;

      if (isDelimiter(current, '(')) {
        paren += 1;
        continue;
      }
      if (isDelimiter(current, ')')) {
        paren = Math.max(0, paren - 1);
        continue;
      }
      if (isDelimiter(current, '[')) {
        bracket += 1;
        continue;
      }
      if (isDelimiter(current, ']')) {
        bracket = Math.max(0, bracket - 1);
        continue;
      }
      if (isDelimiter(current, '{')) {
        if (paren === 0 && bracket === 0 && brace === 0 && openBraceIndex < 0) {
          openBraceIndex = j;
        }
        brace += 1;
        continue;
      }
      if (isDelimiter(current, '}')) {
        if (brace === 1) closeBraceIndex = j;
        brace = Math.max(0, brace - 1);
        continue;
      }
      if (isKeyword(current, 'inicio') && paren === 0 && bracket === 0 && brace === 0 && legacyInicioIndex < 0) {
        legacyInicioIndex = j;
        continue;
      }
      if (isKeyword(current, 'fim') && paren === 0 && bracket === 0 && brace === 0 && legacyInicioIndex >= 0) {
        legacyFimIndex = j;
        continue;
      }
      if (current.type === 'Operator' && current.value === '=' && paren === 0 && bracket === 0 && brace === 0 && eqIndex < 0) {
        eqIndex = j;
        continue;
      }
      if (isDelimiter(current, ';') && paren === 0 && bracket === 0 && brace === 0) {
        semicolonIndex = j;
        break;
      }
    }

    if (eqIndex >= 0 && semicolonIndex >= 0) {
      tableEqualsIndices.add(eqIndex);
      if (openBraceIndex >= 0 && closeBraceIndex >= 0) {
        tableOpenBraceIndices.add(openBraceIndex);
        tableCloseBraceIndices.add(closeBraceIndex);
      }
      if (legacyInicioIndex >= 0 && legacyFimIndex >= 0) {
        tableLegacyInicioIndices.add(legacyInicioIndex);
        tableLegacyFimIndices.add(legacyFimIndex);
      }
      i = semicolonIndex;
    }
  }

  return {
    tableEqualsIndices,
    tableOpenBraceIndices,
    tableCloseBraceIndices,
    tableLegacyInicioIndices,
    tableLegacyFimIndices
  };
}

/**
 * Printer (Nível B): token stream -> Doc
 *
 * Padrão canônico (TS-like) + exceção apenas para comentário de linha:
 * - Comentário de linha pode permanecer inline se já estiver inline; caso contrário, fica em linha própria.
 */
export function printTokensToDoc(
  tokens: Token[],
  sourceText: string,
  fileAst?: FileNode,
  options?: { maxParamsPerLine?: number }
): Doc {
  const root: Doc[] = [];

  const stack: Doc[][] = [];
  let current = root;

  // Some legacy/edge token streams have unreliable start/end offsets for comments.
  // To preserve original line breaks deterministically, we keep a monotonic search
  // cursor to locate each line comment's raw text (t.value) inside sourceText.
  // This does NOT change any token content; it only helps deciding inline vs EOL.
  let lineCommentSearchPos = 0;

  const INDENT_SIZE = 2;
  const maxParamsPerLine = options?.maxParamsPerLine && options.maxParamsPerLine > 0 ? options.maxParamsPerLine : 4;
  let indentLevel = 0;
  let currentColumn = 0;


  const pushIndent = () => {
    const child: Doc[] = [];
    current.push(indent(concat(child)));
    stack.push(current);
    current = child;
    indentLevel += 1;
  };

  const popIndent = () => {
    const parent = stack.pop();
    if (parent) {
      current = parent;
      indentLevel = Math.max(0, indentLevel - 1);
    }
  };

  let atLineStart = true;
  let pendingSpace = false;
  let prev: Token | null = null;
  let prevPrev: Token | null = null;
  let movedConcatPlusAfterComment = false;

  // V20: When the original source has a newline after a line comment, we must force a line break
  // BEFORE emitting the next token, regardless of whether we're in the main loop or inside an inline span.
  // This avoids relying on tokenizer offsets/ranges for CommentLine.
  let pendingLineBreakAfterLineComment = false;
  const flushPendingLineBreakAfterLineComment = () => {
    if (!pendingLineBreakAfterLineComment) return;
    // Only emit a line break if we are not already at the start of a new line.
    if (!atLineStart) emitLine();
    pendingLineBreakAfterLineComment = false;
    // Prevent the next token from being glued to the comment.
    pendingSpace = false;
  };

  // Para preservar 1 linha em branco (máx.) quando o arquivo já tinha um "gap" real.
  let prevSourceLine: number | null = null;

  // Parênteses gerais (para listas multilinha) e headers de controle.
  let parenDepth = 0;

  let parenContinuationActive = false;

  let controlHeader: null | 'se' | 'enquanto' | 'para' = null;
  let controlParenDepth = 0;
  let controlContinuationActive = false; // continuação TS-like de condição multilinha
  let assignmentAlignColumn: number | null = null;

  // single-statement (Se/Enquanto/Para sem Inicio/{)
  const singleStmtEndLines: number[] = [];
  const singleStatementRanges = fileAst ? collectSingleStatementRanges(fileAst) : new Map<number, number>();
  const tableLayoutMarkers = collectTableLayoutMarkers(tokens);
  let suppressSingleStatementIndentLine: number | null = null;

  const closeCompletedSingleStatements = (line: number) => {
    while (singleStmtEndLines.length > 0) {
      const topEnd = singleStmtEndLines[singleStmtEndLines.length - 1]!;
      if (line < topEnd) break;
      popIndent();
      singleStmtEndLines.pop();
    }
  };

  const emitText = (v: string) => {
    if (pendingSpace) {
      current.push(text(' '));
      currentColumn += 1;
    }
    pendingSpace = false;
    if (atLineStart) {
      currentColumn = indentLevel * INDENT_SIZE;
    }
    current.push(text(v));
    currentColumn += v.length;
    atLineStart = false;
  };


  const emitRawWhitespace = (v: string) => {
    if (!v) return;
    pendingSpace = false;
    if (atLineStart) {
      currentColumn = indentLevel * INDENT_SIZE;
    }
    current.push(text(v));
    currentColumn += v.length;
    atLineStart = false;
  };

  const emitIndentSpaces = (n: number) => {
    if (n <= 0) return;
    if (atLineStart) {
      currentColumn = indentLevel * INDENT_SIZE;
    }
    current.push(text(' '.repeat(n)));
    currentColumn += n;
    atLineStart = false;
    pendingSpace = false;
  };

  const emitLine = () => {
    current.push(line());
    currentColumn = 0;
    atLineStart = true;
    pendingSpace = false;
  };

  const ensureBlankLineFromGap = (t: Token) => {
    if (!atLineStart || prevSourceLine === null) return;
    const gap = t.range.start.line - prevSourceLine;
    const blankLinesToPreserve = Math.max(0, gap - 1);
    for (let n = 0; n < blankLinesToPreserve; n += 1) {
      emitLine();
    }
  };

  const nextSignificant = (from: number): Token | null => {
    for (let j = from; j < tokens.length; j++) {
      const t = tokens[j]!;
      if (t.type === 'EOF') return null;
      if (isLineComment(t) || isBlockComment(t)) continue;
      return t;
    }
    return null;
  };

  const nextSignificantIndex = (from: number): number => {
    for (let j = from; j < tokens.length; j++) {
      const t = tokens[j]!;
      if (!t) continue;
      if (t.type === 'EOF') return -1;
      if (isLineComment(t) || isBlockComment(t)) continue;
      return j;
    }
    return -1;
  };

  const isStatementBoundary = (token: Token | null): boolean => {
    if (!token) return true;
    if (isDelimiter(token, ';') || isDelimiter(token, '{') || isDelimiter(token, '}')) return true;
    if (isKeyword(token, 'inicio') || isKeyword(token, 'senao') || isKeyword(token, 'fim')) return true;
    return false;
  };

  const nextStatementSemicolon = (start: number): number => {
    let paren = 0;
    let bracket = 0;
    let brace = 0;
    for (let j = start; j < tokens.length; j++) {
      const t = tokens[j]!;
      if (!t || t.type === 'EOF') return -1;
      if (isDelimiter(t, '(')) paren += 1;
      else if (isDelimiter(t, ')')) paren = Math.max(0, paren - 1);
      else if (isDelimiter(t, '[')) bracket += 1;
      else if (isDelimiter(t, ']')) bracket = Math.max(0, bracket - 1);
      else if (isDelimiter(t, '{')) brace += 1;
      else if (isDelimiter(t, '}')) brace = Math.max(0, brace - 1);

      if (isDelimiter(t, ';') && paren === 0 && bracket === 0 && brace === 0) {
        return j;
      }
    }
    return -1;
  };

  const previousSignificantIndex = (fromInclusive: number): number => {
    for (let j = fromInclusive; j >= 0; j--) {
      const t = tokens[j]!;
      if (!t) continue;
      if (t.type === 'EOF' || isLineComment(t) || isBlockComment(t)) continue;
      return j;
    }
    return -1;
  };


  const locateLineCommentStart = (commentValue: string): number => {
    let locatedIndex = sourceText.indexOf(commentValue, lineCommentSearchPos);
    if (locatedIndex < 0) locatedIndex = sourceText.indexOf(commentValue);
    if (locatedIndex >= 0) {
      lineCommentSearchPos = locatedIndex + commentValue.length;
    }
    return locatedIndex;
  };

  const earliestInlineSeIndexByLine = new Map<number, number>();
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token || !isKeyword(token, 'se')) continue;
    const prevSigIndex = previousSignificantIndex(i - 1);
    if (prevSigIndex < 0) continue;
    const prevSig = tokens[prevSigIndex];
    if (!prevSig) continue;
    if (prevSig.range.end.line !== token.range.start.line) continue;
    const current = earliestInlineSeIndexByLine.get(token.range.start.line);
    if (current === undefined || i < current) {
      earliestInlineSeIndexByLine.set(token.range.start.line, i);
    }
  }

  const isElseIfHeadAtIndex = (index: number): boolean => {
    const token = tokens[index]!;
    if (!token) return false;
    if ((token.type !== 'Keyword' && token.type !== 'Identifier') || token.normalized !== 'se') return false;
    const prevSigIndex = previousSignificantIndex(index - 1);
    if (prevSigIndex < 0) return false;
    const prevSig = tokens[prevSigIndex]!;
    if (!prevSig) return false;
    return (prevSig.type === 'Keyword' || prevSig.type === 'Identifier') && prevSig.normalized === 'senao';
  };

  const isFunctionParamListOpen = (index: number): boolean => {
    const t = tokens[index]!;
    if (!t || !isDelimiter(t, '(')) return false;

    const prev1Index = previousSignificantIndex(index - 1);
    if (prev1Index < 0) return false;
    const prev1 = tokens[prev1Index]!;
    if (!prev1 || prev1.type !== 'Identifier') return false;

    const prev2Index = previousSignificantIndex(prev1Index - 1);
    if (prev2Index < 0) return false;
    const prev2 = tokens[prev2Index]!;
    if (!prev2 || !isKeyword(prev2, 'funcao')) return false;

    return true;
  };

  const collectFunctionParams = (openIndex: number): { closeIndex: number; params: Array<[number, number]> } | null => {
    let depth = 0;
    let start = openIndex + 1;
    const params: Array<[number, number]> = [];

    const pushParam = (s: number, e: number) => {
      if (e < s) return;
      for (let k = s; k <= e; k++) {
        const token = tokens[k]!;
        if (!token || token.type === 'EOF') continue;
        if (isLineComment(token) || isBlockComment(token)) {
          return null;
        }
      }
      params.push([s, e]);
      return true;
    };

    for (let j = openIndex + 1; j < tokens.length; j++) {
      const t = tokens[j]!;
      if (!t || t.type === 'EOF') return null;

      if (isDelimiter(t, '(')) {
        depth += 1;
        continue;
      }

      if (isDelimiter(t, ')')) {
        if (depth === 0) {
          const ok = pushParam(start, j - 1);
          if (ok === null) return null;
          return { closeIndex: j, params };
        }
        depth -= 1;
        continue;
      }

      if (depth === 0 && isDelimiter(t, ',')) {
        const ok = pushParam(start, j - 1);
        if (ok === null) return null;
        start = j + 1;
      }
    }

    return null;
  };

  const isCallArgumentListOpen = (index: number): boolean => {
    const t = tokens[index]!;
    if (!t || !isDelimiter(t, '(')) return false;
    const prevIndex = previousSignificantIndex(index - 1);
    if (prevIndex < 0) return false;
    const prevToken = tokens[prevIndex]!;
    if (!prevToken) return false;
    if (prevToken.type === 'Identifier') return true;
    if (prevToken.type === 'Delimiter' && (prevToken.value === ')' || prevToken.value === ']')) return true;
    return false;
  };

  const collectCallArguments = (
    openIndex: number
  ): { closeIndex: number; args: Array<[number, number]>; breakAfter: Set<number>; isMultiline: boolean } | null => {
    let depth = 0;
    let start = openIndex + 1;
    const args: Array<[number, number]> = [];
    const breakAfter = new Set<number>();

    const pushArg = (s: number, e: number) => {
      if (e < s) return;
      for (let k = s; k <= e; k++) {
        const token = tokens[k]!;
        if (!token || token.type === 'EOF') continue;
        if (isLineComment(token) || isBlockComment(token)) return null;
      }
      args.push([s, e]);
      return true;
    };

    for (let j = openIndex + 1; j < tokens.length; j++) {
      const t = tokens[j]!;
      if (!t || t.type === 'EOF') return null;

      if (isDelimiter(t, '(')) {
        depth += 1;
        continue;
      }

      if (isDelimiter(t, ')')) {
        if (depth === 0) {
          const ok = pushArg(start, j - 1);
          if (ok === null) return null;
          return {
            closeIndex: j,
            args,
            breakAfter,
            isMultiline: tokens[openIndex]!!.range.start.line !== t.range.end.line
          };
        }
        depth -= 1;
        continue;
      }

      if (depth === 0 && isDelimiter(t, ',')) {
        const ok = pushArg(start, j - 1);
        if (ok === null) return null;
        const next = nextSignificant(j + 1);
        if (next && next.range.start.line > t.range.end.line && args.length > 0) {
          breakAfter.add(args.length - 1);
        }
        start = j + 1;
      }
    }

    return null;
  };

  const emitTokenSpanInline = (start: number, end: number) => {
    let localPrev: Token | null = null;
    let localPrevPrev: Token | null = null;
    let movedPlusForInlineLineComment = false;
    for (let k = start; k <= end; k++) {
      const token = tokens[k]!;
      if (!token || token.type === 'EOF') continue;
      flushPendingLineBreakAfterLineComment();
      if (token.type === 'Operator' && token.value === '+') {
        const nextRaw = tokens[k + 1]! ?? null;
        if (nextRaw && isLineComment(nextRaw)) {
          const nextAfterComment = nextSignificant(k + 2);
          if (nextAfterComment && nextAfterComment.type === 'String' && nextAfterComment.range.start.line === nextRaw.range.start.line) {
            // Keep legacy SQL style where comments after "+" are trailing comments for the previous term.
            // The "+" is then moved to the next continuation line before the string literal.
            movedPlusForInlineLineComment = true;
            localPrevPrev = localPrev;
            localPrev = token;
            continue;
          }
        }
      }
      if (isLineComment(token) || isBlockComment(token)) {
        // Comentários podem aparecer dentro de concatenação de strings; não alteramos o conteúdo.
        if (movedPlusForInlineLineComment && isLineComment(token)) {
          if (pendingSpace) pendingSpace = false;
          emitText(' ');
          emitText(token.value);
          pendingLineBreakAfterLineComment = true;
          const indentBase = indentLevel * INDENT_SIZE;
          const alignColumn = assignmentAlignColumn ?? indentBase;
          emitIndentSpaces(Math.max(0, alignColumn - indentBase));
          emitText('+');
          pendingSpace = true;
          movedPlusForInlineLineComment = false;
          localPrevPrev = localPrev;
          localPrev = token;
          continue;
        }
        if (isLineComment(token) && localPrev && !atLineStart) {
          const locatedIndex = locateLineCommentStart(token.value);
          const originalSpacing = locatedIndex >= 0 ? getOriginalInlineSpacingBeforeComment(sourceText, locatedIndex) : null;
          if (originalSpacing) {
            emitRawWhitespace(originalSpacing);
          } else if (pendingSpace) {
            emitText(' ');
            pendingSpace = false;
          } else {
            emitText(' ');
          }
        } else if (pendingSpace) {
          emitText(' ');
          pendingSpace = false;
        }
        emitText(token.value);

        // Mesmo fallback do loop principal: quando o comentário de linha aparece após ';'
        // fora de parênteses, encerre a linha para não colar o próximo statement.
        if (
          isLineComment(token) &&
          !controlHeader &&
          parenDepth === 0 &&
          localPrev &&
          localPrev.type === 'Delimiter' &&
          localPrev.value === ';'
        ) {
          emitLine();
        }

        movedPlusForInlineLineComment = false;
        localPrevPrev = localPrev;
        localPrev = token;
        continue;
      }
      if (shouldSpaceBefore(token, localPrev, localPrevPrev, atLineStart)) pendingSpace = true;
      emitText(token.value);
      localPrevPrev = localPrev;
      localPrev = token;
    }
  };

  const tryPrintConcatAssignmentStatement = (startIndex: number): number | null => {
    if (controlHeader) return null;
    const startToken = tokens[startIndex]!;
    if (!startToken || startToken.type === 'EOF' || isLineComment(startToken) || isBlockComment(startToken)) return null;
    if (isDelimiter(startToken, '{') || isDelimiter(startToken, '}')) return null;
    if ((startToken.type === 'Keyword' || startToken.type === 'Identifier') && CONTROL_KEYWORDS.has(startToken.normalized)) return null;

    const prevSigIndex = previousSignificantIndex(startIndex - 1);
    const prevSig = prevSigIndex >= 0 ? tokens[prevSigIndex]! ?? null : null;
    if (!isStatementBoundary(prevSig)) return null;

    const semiIndex = nextStatementSemicolon(startIndex);
    if (semiIndex < 0) return null;
    // Só reestrutura concatenação por '+' quando o statement já era multilinha.
    if (tokens[startIndex]!!.range.start.line === tokens[semiIndex]!!.range.end.line) return null;

    let eqIndex = -1;
    let paren = 0;
    let bracket = 0;
    let brace = 0;
    for (let j = startIndex; j < semiIndex; j++) {
      const t = tokens[j]!;
      if (!t) continue;
      if (isDelimiter(t, '(')) paren += 1;
      else if (isDelimiter(t, ')')) paren = Math.max(0, paren - 1);
      else if (isDelimiter(t, '[')) bracket += 1;
      else if (isDelimiter(t, ']')) bracket = Math.max(0, bracket - 1);
      else if (isDelimiter(t, '{')) brace += 1;
      else if (isDelimiter(t, '}')) brace = Math.max(0, brace - 1);

      if (paren === 0 && bracket === 0 && brace === 0 && t.type === 'Operator' && t.value === '=') {
        eqIndex = j;
        break;
      }
    }
    if (eqIndex < 0) return null;
    if (eqIndex <= startIndex || eqIndex + 1 >= semiIndex) return null;

    // Fora do escopo desta regra.
    if (startToken && startToken.type === 'Keyword' && startToken.normalized === 'definir') return null;
    if (startToken && startToken.type === 'Keyword' && startToken.normalized === 'funcao') return null;

    // Nunca reestruturar quando o "statement" começa com keywords estruturais.
    // Caso contrário, é possível colapsar blocos do tipo:
    //   Senao\nInicio\n  a = a + ...
    // em uma única linha: "Senao Inicio a = a + ...".
    // A reestruturação deve iniciar no primeiro token significativo do statement real (ex.: identificador).
    if (
      startToken &&
      (startToken.type === 'Keyword' || startToken.type === 'Identifier') &&
      (startToken.normalized === 'inicio' || startToken.normalized === 'fim' || startToken.normalized === 'senao')
    ) {
      return null;
    }

    const rhsStart = eqIndex + 1;
    const rhsEnd = semiIndex - 1;
    if (rhsEnd < rhsStart) return null;

    // Comentários:
    // - Permitir **comentário de linha** (`@ ... @`) dentro da concatenação.
    //   Esse padrão é comum em SQL montado em strings, por exemplo:
    //     "..." + @-- comentário --@
    //     "..."
    //   Como o formatter não pode alterar o conteúdo do comentário, mas pode ajustar whitespace,
    //   mantemos o comentário como token normal dentro do termo.
    // - Bloquear **comentário de bloco** para evitar reordenação inesperada em spans longos.
    for (let j = startIndex; j <= semiIndex; j++) {
      const t = tokens[j]!;
      if (!t || t.type === 'EOF') continue;
      if (isBlockComment(t)) return null;
    }

    let plusCount = 0;
    let hasStringLiteral = false;
    const terms: Array<[number, number]> = [];
    // Comentários de linha logo após um '+' (no topo) costumam ser usados como anotação
    // entre termos de concatenação (SQL montado em strings), por exemplo:
    //   "..." + @-- comentário --@
    //   "..."
    // Nesses casos, o '+' semântico pertence ao próximo termo, e o comentário deve
    // ficar inline no fim da linha anterior.
    // Guardamos o comentário como "trailing" do termo fechado.
    const trailingLineCommentsByTermIndex: Array<[number, number] | null> = [];

    paren = 0;
    bracket = 0;
    brace = 0;
    let termStart = rhsStart;

		// Detecta quebra de linha real no source entre offsets (robusto mesmo quando range.line é impreciso).
		const hasNewlineBetweenOffsets = (fromOffset: number, toOffset: number): boolean => {
			if (fromOffset < 0 || toOffset < 0) return false;
			if (toOffset <= fromOffset) return false;
			const slice = sourceText.slice(fromOffset, toOffset);
			return slice.includes('\n') || slice.includes('\r');
		};

		// Próximo token existente (não-EOF), sem pular comentários.
		const nextNonEofIndex = (from: number): number => {
			for (let k = from; k <= rhsEnd; k++) {
				const t = tokens[k]!;
				if (!t || t.type === 'EOF') continue;
				return k;
			}
			return -1;
		};

    for (let j = rhsStart; j <= rhsEnd; j++) {
      const t = tokens[j]!;
      if (!t || t.type === 'EOF') continue;
      if (t.type === 'String') hasStringLiteral = true;

      if (isDelimiter(t, '(')) paren += 1;
      else if (isDelimiter(t, ')')) paren = Math.max(0, paren - 1);
      else if (isDelimiter(t, '[')) bracket += 1;
      else if (isDelimiter(t, ']')) bracket = Math.max(0, bracket - 1);
      else if (isDelimiter(t, '{')) brace += 1;
      else if (isDelimiter(t, '}')) brace = Math.max(0, brace - 1);

      if (paren === 0 && bracket === 0 && brace === 0 && t.type === 'Operator' && t.value === '+') {
        // Caso especial: "+" seguido de comentário de linha e o próximo token significativo
        // começa em outra linha. O '+' deve ser considerado como separador para o próximo
        // termo, e o comentário fica como trailing do termo anterior.
				const commentIdx = nextNonEofIndex(j + 1);
        const commentTok = commentIdx >= 0 ? tokens[commentIdx]! ?? null : null;
        if (commentTok && isLineComment(commentTok)) {
          const afterCommentIdx = nextSignificantIndex(commentIdx + 1);
          const afterCommentTok = afterCommentIdx >= 0 ? tokens[afterCommentIdx]! ?? null : null;

          // Comentário logo após '+' é tratado como anotação entre termos.
          // Mesmo que o próximo token ainda esteja na mesma linha no source (entrada "quebrada"),
          // o formatter normaliza para: termo + (comentário trailing) \n + próximo termo.
          if (afterCommentTok) {
            plusCount += 1;
            terms.push([termStart, j - 1]);
            trailingLineCommentsByTermIndex.push([commentIdx, commentIdx]);
            termStart = afterCommentIdx;
            // pula o comentário (e deixa o loop continuar a partir do próximo token)
            j = afterCommentIdx - 1;
            continue;
          }
        }

        plusCount += 1;
        terms.push([termStart, j - 1]);
        trailingLineCommentsByTermIndex.push(null);
        termStart = j + 1;
      }
    }
    terms.push([termStart, rhsEnd]);
    trailingLineCommentsByTermIndex.push(null);

    if (plusCount < 2 || !hasStringLiteral || terms.length < 2) return null;

    const segments: Array<[number, number]> = [];
    const trailingLineCommentsBySegmentIndex: Array<[number, number] | null> = [];
    for (let idx = 0; idx < terms.length;) {
      const [segStart, segEndInitial] = terms[idx]!;
      let segEnd = segEndInitial;
      let nextIdx = idx + 1;
      while (nextIdx < terms.length) {
        const [nextStart, nextEnd] = terms[nextIdx]!;
        // Não mesclar termos quando o termo anterior possui comentário trailing (força quebra).
        const prevTermIdx = nextIdx - 1;
        if (prevTermIdx >= 0 && trailingLineCommentsByTermIndex[prevTermIdx]) break;
        // Mesma "linha" somente se não houver quebra de linha real entre o fim do termo anterior e o início do próximo.
        const prevEndOffset = tokens[segEnd]!?.endOffset ?? -1;
        const nextStartOffset = tokens[nextStart]!?.startOffset ?? -1;
        if (hasNewlineBetweenOffsets(prevEndOffset, nextStartOffset)) break;
        segEnd = nextEnd;
        nextIdx += 1;
      }
      segments.push([segStart, segEnd]);
      // "Trailing" do segmento = trailing do último termo incluído no segmento.
      const lastTermIdxInSegment = nextIdx - 1;
      trailingLineCommentsBySegmentIndex.push(trailingLineCommentsByTermIndex[lastTermIdxInSegment] ?? null);
      idx = nextIdx;
    }

    emitTokenSpanInline(startIndex, eqIndex - 1);

    pendingSpace = true;
    const equalSignColumn = pendingSpace ? currentColumn + 1 : currentColumn;
    emitText(tokens[eqIndex]!!.value); // "="
    pendingSpace = true;
    emitTokenSpanInline(segments[0]![0], segments[0]![1]);
    // Se o primeiro segmento tiver um comentário trailing (caso raro), anexa inline.
    const firstTrailing = trailingLineCommentsBySegmentIndex[0];
    if (firstTrailing) {
      if (pendingSpace) pendingSpace = false;
      emitText(' ');
      emitTokenSpanInline(firstTrailing[0], firstTrailing[1]);
    }

    const alignColumn = equalSignColumn;
    assignmentAlignColumn = alignColumn;

    for (let p = 1; p < segments.length; p++) {
      emitLine();
      const indentBase = indentLevel * INDENT_SIZE;
      const pad = Math.max(0, alignColumn - indentBase);
      emitIndentSpaces(pad);
      emitText('+');
      pendingSpace = true;
      emitTokenSpanInline(segments[p]![0], segments[p]![1]);
      const trailing = trailingLineCommentsBySegmentIndex[p];
      if (trailing) {
        if (pendingSpace) pendingSpace = false;
        emitText(' ');
        emitTokenSpanInline(trailing[0], trailing[1]);
      }
    }

    emitText(tokens[semiIndex]!!.value); // ";"
    const next = nextSignificant(semiIndex + 1);
    const nextSameLine = !!next && next.range.start.line === tokens[semiIndex]!!.range.end.line;
    if (nextSameLine) {
      pendingSpace = true;
    } else {
      emitLine();
    }
    closeCompletedSingleStatements(tokens[semiIndex]!!.range.end.line);
    assignmentAlignColumn = null;
    prevPrev = prev;
    prev = tokens[semiIndex]!!;
    prevSourceLine = tokens[semiIndex]!!.range.end.line;
    return semiIndex;
  };



  const tryPrintAdditiveAssignmentStatement = (startIndex: number): number | null => {
    if (controlHeader) return null;
    const startToken = tokens[startIndex]!;
    if (!startToken || startToken.type === 'EOF' || isLineComment(startToken) || isBlockComment(startToken)) return null;
    if (isDelimiter(startToken, '{') || isDelimiter(startToken, '}')) return null;
    if ((startToken.type === 'Keyword' || startToken.type === 'Identifier') && CONTROL_KEYWORDS.has(startToken.normalized)) return null;

    const prevSigIndex = previousSignificantIndex(startIndex - 1);
    const prevSig = prevSigIndex >= 0 ? tokens[prevSigIndex]! ?? null : null;
    if (!isStatementBoundary(prevSig)) return null;

    const semiIndex = nextStatementSemicolon(startIndex);
    if (semiIndex < 0) return null;
    if (tokens[startIndex]!!.range.start.line === tokens[semiIndex]!!.range.end.line) return null;

    let eqIndex = -1;
    let paren = 0;
    let bracket = 0;
    let brace = 0;
    for (let j = startIndex; j < semiIndex; j++) {
      const t = tokens[j]!;
      if (!t) continue;
      if (isDelimiter(t, '(')) paren += 1;
      else if (isDelimiter(t, ')')) paren = Math.max(0, paren - 1);
      else if (isDelimiter(t, '[')) bracket += 1;
      else if (isDelimiter(t, ']')) bracket = Math.max(0, bracket - 1);
      else if (isDelimiter(t, '{')) brace += 1;
      else if (isDelimiter(t, '}')) brace = Math.max(0, brace - 1);

      if (paren === 0 && bracket === 0 && brace === 0 && t.type === 'Operator' && t.value === '=') {
        eqIndex = j;
        break;
      }
    }
    if (eqIndex < 0) return null;
    if (eqIndex <= startIndex || eqIndex + 1 >= semiIndex) return null;

    if (startToken && startToken.type === 'Keyword' && startToken.normalized === 'definir') return null;
    if (startToken && startToken.type === 'Keyword' && startToken.normalized === 'funcao') return null;
    if (
      startToken &&
      (startToken.type === 'Keyword' || startToken.type === 'Identifier') &&
      (startToken.normalized === 'inicio' || startToken.normalized === 'fim' || startToken.normalized === 'senao')
    ) {
      return null;
    }

    const rhsStart = eqIndex + 1;
    const rhsEnd = semiIndex - 1;
    if (rhsEnd < rhsStart) return null;

    for (let j = startIndex; j <= semiIndex; j++) {
      const t = tokens[j]!;
      if (!t || t.type === 'EOF') continue;
      if (isBlockComment(t)) return null;
    }

    type AdditiveTermRange = [number, number];
    type AdditiveTrailingLineComment = {
      range: [number, number];
      operatorValue: '+' | '-';
      originalSpacing: string | null;
    };

    const hasNewlineBetweenOffsets = (fromOffset: number, toOffset: number): boolean => {
      if (fromOffset < 0 || toOffset < 0) return false;
      if (toOffset <= fromOffset) return false;
      const slice = sourceText.slice(fromOffset, toOffset);
      return slice.includes('\n') || slice.includes('\r');
    };

    const nextNonEofIndex = (from: number): number => {
      for (let k = from; k < tokens.length; k++) {
        const t = tokens[k]!;
        if (!t || t.type === 'EOF') continue;
        return k;
      }
      return -1;
    };

    const computeMovedTrailingCommentSpacing = (
      termEndIndex: number,
      commentToken: Token,
      operatorValue: '+' | '-'
    ): string | null => {
      const termEndToken = tokens[termEndIndex]! ?? null;
      if (!termEndToken) return null;
      const commentStart = locateLineCommentStart(commentToken.value);
      if (commentStart < 0) return null;
      const between = sourceText.slice(termEndToken.endOffset, commentStart);
      if (!between) return ' ';
      const operatorIndex = between.lastIndexOf(operatorValue);
      if (operatorIndex < 0) return between.length > 0 ? between : ' ';
      const sanitized = between.slice(0, operatorIndex) + between.slice(operatorIndex + 1);
      return sanitized.length > 0 ? sanitized : ' ';
    };

    let additiveOperatorCount = 0;
    let hasStringLiteral = false;
    let invalidTopLevelOperator = false;
    const terms: AdditiveTermRange[] = [];
    const separatorsByTermIndex: Array<'+' | '-' | null> = [];
    const trailingLineCommentsByTermIndex: Array<AdditiveTrailingLineComment | null> = [];

    paren = 0;
    bracket = 0;
    brace = 0;
    let termStart = rhsStart;

    for (let j = rhsStart; j <= rhsEnd; j++) {
      const t = tokens[j]!;
      if (!t || t.type === 'EOF') continue;
      if (t.type === 'String') hasStringLiteral = true;

      if (isDelimiter(t, '(')) paren += 1;
      else if (isDelimiter(t, ')')) paren = Math.max(0, paren - 1);
      else if (isDelimiter(t, '[')) bracket += 1;
      else if (isDelimiter(t, ']')) bracket = Math.max(0, bracket - 1);
      else if (isDelimiter(t, '{')) brace += 1;
      else if (isDelimiter(t, '}')) brace = Math.max(0, brace - 1);

      if (paren === 0 && bracket === 0 && brace === 0 && t.type === 'Operator') {
        if (t.value !== '+' && t.value !== '-') {
          invalidTopLevelOperator = true;
          continue;
        }

        const operatorValue = t.value as '+' | '-';
        additiveOperatorCount += 1;

        const commentIdx = nextNonEofIndex(j + 1);
        const commentTok = commentIdx >= 0 ? tokens[commentIdx]! ?? null : null;
        if (commentTok && isLineComment(commentTok)) {
          const afterCommentIdx = nextSignificantIndex(commentIdx + 1);
          const afterCommentTok = afterCommentIdx >= 0 ? tokens[afterCommentIdx]! ?? null : null;
          if (afterCommentTok) {
            terms.push([termStart, j - 1]);
            separatorsByTermIndex.push(operatorValue);
            trailingLineCommentsByTermIndex.push({
              range: [commentIdx, commentIdx],
              operatorValue,
              originalSpacing: computeMovedTrailingCommentSpacing(j - 1, commentTok, operatorValue)
            });
            termStart = afterCommentIdx;
            j = afterCommentIdx - 1;
            continue;
          }
        }

        terms.push([termStart, j - 1]);
        separatorsByTermIndex.push(operatorValue);
        trailingLineCommentsByTermIndex.push(null);
        termStart = j + 1;
      }
    }
    terms.push([termStart, rhsEnd]);
    separatorsByTermIndex.push(null);
    trailingLineCommentsByTermIndex.push(null);

    if (hasStringLiteral || terms.length < 2 || additiveOperatorCount < 1 || invalidTopLevelOperator) return null;

    let finalTrailingLineCommentAfterSemicolon: [number, number] | null = null;
    const lastTermIndex = terms.length - 1;
    if (lastTermIndex >= 0) {
      const [lastStart, lastEnd] = terms[lastTermIndex]!;
      const lastTermEndToken = tokens[lastEnd]! ?? null;
      if (lastTermEndToken && isLineComment(lastTermEndToken)) {
        let lastNonCommentIndex = -1;
        for (let scan = lastEnd - 1; scan >= lastStart; scan -= 1) {
          const candidate = tokens[scan]!;
          if (!candidate || candidate.type === 'EOF' || isLineComment(candidate) || isBlockComment(candidate)) continue;
          lastNonCommentIndex = scan;
          break;
        }
        if (lastNonCommentIndex >= lastStart) {
          terms[lastTermIndex] = [lastStart, lastNonCommentIndex];
          finalTrailingLineCommentAfterSemicolon = [lastEnd, lastEnd];
        }
      }
    }

    const segments: AdditiveTermRange[] = [];
    const segmentLeadingOperators: Array<'+' | '-' | null> = [];
    const trailingLineCommentsBySegmentIndex: Array<AdditiveTrailingLineComment | null> = [];
    for (let idx = 0; idx < terms.length;) {
      const [segStart, segEndInitial] = terms[idx]!;
      let segEnd = segEndInitial;
      let nextIdx = idx + 1;
      while (nextIdx < terms.length) {
        const [nextStart, nextEnd] = terms[nextIdx]!;
        const prevTermIdx = nextIdx - 1;
        if (prevTermIdx >= 0 && trailingLineCommentsByTermIndex[prevTermIdx]) break;
        const prevEndOffset = tokens[segEnd]!?.endOffset ?? -1;
        const nextStartOffset = tokens[nextStart]!?.startOffset ?? -1;
        if (hasNewlineBetweenOffsets(prevEndOffset, nextStartOffset)) break;
        segEnd = nextEnd;
        nextIdx += 1;
      }
      segments.push([segStart, segEnd]);
      segmentLeadingOperators.push(idx > 0 ? (separatorsByTermIndex[idx - 1] ?? null) : null);
      const lastTermIdxInSegment = nextIdx - 1;
      trailingLineCommentsBySegmentIndex.push(trailingLineCommentsByTermIndex[lastTermIdxInSegment] ?? null);
      idx = nextIdx;
    }

    emitTokenSpanInline(startIndex, eqIndex - 1);

    pendingSpace = true;
    const equalSignColumn = pendingSpace ? currentColumn + 1 : currentColumn;
    emitText(tokens[eqIndex]!!.value);
    pendingSpace = true;
    emitTokenSpanInline(segments[0]![0], segments[0]![1]);
    const firstTrailing = trailingLineCommentsBySegmentIndex[0];
    if (firstTrailing) {
      if (pendingSpace) pendingSpace = false;
      emitText(firstTrailing.originalSpacing ?? ' ');
      emitTokenSpanInline(firstTrailing.range[0], firstTrailing.range[1]);
    }

    const alignColumn = equalSignColumn;
    assignmentAlignColumn = alignColumn;

    for (let p = 1; p < segments.length; p++) {
      emitLine();
      const indentBase = indentLevel * INDENT_SIZE;
      const pad = Math.max(0, alignColumn - indentBase);
      emitIndentSpaces(pad);
      emitText(segmentLeadingOperators[p] ?? '+');
      pendingSpace = true;
      emitTokenSpanInline(segments[p]![0], segments[p]![1]);
      const trailing = trailingLineCommentsBySegmentIndex[p];
      if (trailing) {
        if (pendingSpace) pendingSpace = false;
        emitText(trailing.originalSpacing ?? ' ');
        emitTokenSpanInline(trailing.range[0], trailing.range[1]);
      }
    }

    emitText(tokens[semiIndex]!!.value);
    if (finalTrailingLineCommentAfterSemicolon) {
      emitText(' ');
      emitTokenSpanInline(finalTrailingLineCommentAfterSemicolon[0], finalTrailingLineCommentAfterSemicolon[1]);
      emitLine();
      closeCompletedSingleStatements(tokens[semiIndex]!!.range.end.line);
      assignmentAlignColumn = null;
      prevPrev = prev;
      prev = tokens[finalTrailingLineCommentAfterSemicolon[1]]!!;
      prevSourceLine = tokens[finalTrailingLineCommentAfterSemicolon[1]]!!.range.end.line;
      return semiIndex;
    }
    const nextNonEof = nextNonEofIndex(semiIndex + 1);
    const nextToken = nextNonEof >= 0 ? tokens[nextNonEof]! ?? null : null;
    const nextSameLine = !!nextToken && nextToken.range.start.line === tokens[semiIndex]!!.range.end.line;
    if (nextSameLine && nextToken && isLineComment(nextToken)) {
      emitText(' ');
      emitTokenSpanInline(nextNonEof, nextNonEof);
      emitLine();
      closeCompletedSingleStatements(tokens[semiIndex]!!.range.end.line);
      assignmentAlignColumn = null;
      prevPrev = prev;
      prev = nextToken;
      prevSourceLine = nextToken.range.end.line;
      return nextNonEof;
    }
    if (nextSameLine) {
      pendingSpace = true;
    } else {
      emitLine();
    }
    closeCompletedSingleStatements(tokens[semiIndex]!!.range.end.line);
    assignmentAlignColumn = null;
    prevPrev = prev;
    prev = tokens[semiIndex]!!;
    prevSourceLine = tokens[semiIndex]!!.range.end.line;
    return semiIndex;
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.type === 'EOF') break;
    if (suppressSingleStatementIndentLine !== null && t.range.start.line > suppressSingleStatementIndentLine) {
      suppressSingleStatementIndentLine = null;
    }

    // If a previous CommentLine ended the original line, force a break before emitting any next token.
    flushPendingLineBreakAfterLineComment();

    // Preserva no máximo 1 blank line quando existir gap real no arquivo.
    ensureBlankLineFromGap(t);

    const prevSigIndexForSourceBreak = previousSignificantIndex(i - 1);
    const suppressSourceLineBreakForTable =
      (tableLayoutMarkers.tableOpenBraceIndices.has(i)
        && prevSigIndexForSourceBreak >= 0
        && tableLayoutMarkers.tableEqualsIndices.has(prevSigIndexForSourceBreak))
      || (isDelimiter(t, ';')
        && prevSigIndexForSourceBreak >= 0
        && tableLayoutMarkers.tableCloseBraceIndices.has(prevSigIndexForSourceBreak));

    // Quebras de linha explícitas do arquivo (mantém arquivos já formatados)
    if (!atLineStart && prev && t.range.start.line > prev.range.end.line && !suppressSourceLineBreakForTable) {
      emitLine();
    }

    // Comentário de linha em linha própria: sempre termina a linha.
    // (Evita colar '@-- ... --@' com o próximo statement.)
    if (isLineComment(t) && atLineStart) {
      emitText(t.value);
      emitLine();
      closeCompletedSingleStatements(t.range.end.line);
      prevPrev = prev;
      prev = t;
      prevSourceLine = t.range.end.line;
      continue;
    }

    if ((t.type === 'Keyword' || t.type === 'Identifier') && t.normalized === 'se' && isElseIfHeadAtIndex(i)) {
      singleStatementRanges.delete(t.range.start.line);
    }
    const followsPrintedSenao =
      ((prev && (prev.type === 'Keyword' || prev.type === 'Identifier') && prev.normalized === 'senao')
      || (prevPrev && (prevPrev.type === 'Keyword' || prevPrev.type === 'Identifier') && prevPrev.normalized === 'senao'));
    const isElseIfHead =
      ((t.type === 'Keyword' || t.type === 'Identifier') && t.normalized === 'se')
      && (isElseIfHeadAtIndex(i) || followsPrintedSenao);
    const startsControlHeader =
      (t.type === 'Keyword' || t.type === 'Identifier')
      && CONTROL_KEYWORDS.has(t.normalized);
    const startsElseBoundary =
      (t.type === 'Keyword' || t.type === 'Identifier')
      && t.normalized === 'senao';
    if (
      atLineStart
      && singleStatementRanges.has(t.range.start.line)
      && !(earliestInlineSeIndexByLine.has(t.range.start.line) && i < earliestInlineSeIndexByLine.get(t.range.start.line)!)
      && !isElseIfHead
      && !startsControlHeader
      && !startsElseBoundary
      && t.range.start.line !== suppressSingleStatementIndentLine
    ) {
      pushIndent();
      singleStmtEndLines.push(singleStatementRanges.get(t.range.start.line)!);
    }

    const additiveStatementEnd = tryPrintAdditiveAssignmentStatement(i);
    if (additiveStatementEnd !== null) {
      i = additiveStatementEnd;
      continue;
    }

    const concatStatementEnd = tryPrintConcatAssignmentStatement(i);
    if (concatStatementEnd !== null) {
      i = concatStatementEnd;
      continue;
    }

    if (isFunctionParamListOpen(i)) {
      const collected = collectFunctionParams(i);
      if (collected && collected.params.length > maxParamsPerLine) {
        emitText(t.value); // "("
        const alignColumn = currentColumn;

        for (let p = 0; p < collected.params.length; p++) {
          if (p > 0) {
            emitText(',');
            if (p % maxParamsPerLine === 0) {
              emitLine();
              emitIndentSpaces(alignColumn - indentLevel * INDENT_SIZE);
            } else {
              pendingSpace = true;
            }
          }

          const [paramStart, paramEnd] = collected.params[p]!;
          emitTokenSpanInline(paramStart, paramEnd);
        }

        const closeToken = tokens[collected.closeIndex]!!;
        emitText(closeToken.value); // ")"
        prev = closeToken;
        prevSourceLine = closeToken.range.end.line;
        i = collected.closeIndex;
        continue;
      }
    }

    if (isCallArgumentListOpen(i)) {
      const collectedArgs = collectCallArguments(i);
      if (collectedArgs && collectedArgs.isMultiline && collectedArgs.args.length > 1) {
        emitText(t.value); // "("
        const alignColumn = currentColumn;
        const [firstStart, firstEnd] = collectedArgs.args[0]!;
        emitTokenSpanInline(firstStart, firstEnd);

        for (let p = 1; p < collectedArgs.args.length; p++) {
          emitText(',');
          if (collectedArgs.breakAfter.has(p - 1)) {
            emitLine();
            emitIndentSpaces(Math.max(0, alignColumn - indentLevel * INDENT_SIZE));
          } else {
            pendingSpace = true;
          }
          const [argStart, argEnd] = collectedArgs.args[p]!;
          emitTokenSpanInline(argStart, argEnd);
        }

        const closeToken = tokens[collectedArgs.closeIndex]!!;
        emitText(closeToken.value); // ")"
        prevPrev = prev;
        prev = closeToken;
        prevSourceLine = closeToken.range.end.line;
        i = collectedArgs.closeIndex;
        continue;
      }
    }

    // Controle de parênteses
    if (isDelimiter(t, '(')) {
      parenDepth++;
      if (controlHeader) controlParenDepth++;
    }
    if (isDelimiter(t, ')')) {
      if (parenDepth > 0) parenDepth--;
      if (controlHeader && controlParenDepth > 0) controlParenDepth--;
    }
// Detecta início de header de controle (Keyword ou Identifier, para robustez)
    if ((t.type === 'Keyword' || t.type === 'Identifier') && CONTROL_KEYWORDS.has(t.normalized)) {
      controlHeader = t.normalized as 'se' | 'enquanto' | 'para';
      controlParenDepth = 0;
      controlContinuationActive = false;
    }

    // Continuação TS-like para condição multilinha: ativa quando quebra linha dentro do header
    if (
      prev &&
      controlHeader &&
      controlParenDepth > 0 &&
      t.range.start.line > prev.range.end.line &&
      !controlContinuationActive
    ) {
      controlContinuationActive = true;
    }

    // Comentário de linha (exceção): pode ficar inline; conteúdo intocado.
    if (isLineComment(t)) {
      const nextRaw = tokens[i + 1]! ?? null;
      // Prefer locating the comment by its raw text inside the original source.
      // Offsets from the tokenizer can be unreliable for CommentLine in some edge cases.
      const locatedIndex = locateLineCommentStart(t.value);

      const commentEnd = locatedIndex >= 0 ? locatedIndex + t.value.length : commentLogicalEndOffset(t);
      const originalSpacingBeforeComment = locatedIndex >= 0
        ? getOriginalInlineSpacingBeforeComment(sourceText, locatedIndex)
        : null;
      const mustPreserveEol = hasOriginalNewlineAfterLineComment(sourceText, commentEnd);

      // Fallback determinístico (não depende de offsets/ranges do tokenizer):
      // quando o comentário aparece após um terminador de statement (';') fora de parênteses,
      // tratamos como "trailing comment" do statement e sempre encerramos a linha após o comentário.
      // Isso evita colar o próximo statement na mesma linha quando o tokenizer não fornece offsets confiáveis.
      const prevSigIndex = previousSignificantIndex(i - 1);
      const prevSig = prevSigIndex >= 0 ? (tokens[prevSigIndex] ?? null) : null;
      const forceLineAfterTrailingComment =
        !controlHeader &&
        parenDepth === 0 &&
        !!prevSig &&
        prevSig.type === 'Delimiter' &&
        prevSig.value === ';';
      // A decisão de "mesma linha" para comentário de linha precisa ser feita apenas com texto original.
      // Em especial, não confie em range.{start,end}.line (pode incluir o EOL) e nem apenas em endOffset.
      // Regra: só consideramos "mesma linha" se houver algum caractere não-whitespace após o comentário
      // antes do próximo '\n' **e** não existir '\n' entre o fim do comentário e o início do próximo token.
      const hasNextOnSameLine =
        !!nextRaw &&
        nextRaw.type !== 'EOF' &&
        // If we could locate the comment in the original text, decide purely from sourceText.
        (locatedIndex >= 0
          ? hasNextNonWsOnSameLineFrom(sourceText, commentEnd)
          : (!hasNewlineBetween(sourceText, commentEnd, nextRaw.startOffset) && hasNextNonWsOnSameLineFrom(sourceText, commentEnd)));
      if (movedConcatPlusAfterComment && hasNextOnSameLine && nextRaw.type === 'String') {
        // Legacy SQL pattern: "..." +@comment@"..."
        // Keep comment trailing on previous segment and move "+" to the next continuation line.
        if (pendingSpace) pendingSpace = false;
        emitText(' ');
        emitText(t.value);
        emitLine();
        const indentBase = indentLevel * INDENT_SIZE;
        const alignColumn = assignmentAlignColumn ?? indentBase;
        emitIndentSpaces(Math.max(0, alignColumn - indentBase));
        emitText('+');
        pendingSpace = true;
        movedConcatPlusAfterComment = false;
        prevPrev = prev;
        prev = t;
        prevSourceLine = t.range.end.line;
        continue;
      }
      if (!atLineStart) {
        if (originalSpacingBeforeComment) {
          emitRawWhitespace(originalSpacingBeforeComment);
        } else if (pendingSpace === false) {
          pendingSpace = true;
        }
      }
      emitText(t.value);
      // Exceção permitida: comentário de linha pode permanecer inline
      // quando já estava inline e há tokens na mesma linha.
      if (!forceLineAfterTrailingComment && !mustPreserveEol && hasNextOnSameLine) {
        pendingSpace = true;
      } else {
        pendingLineBreakAfterLineComment = true;
      }
      movedConcatPlusAfterComment = false;
      prevPrev = prev;
      prev = t;
      prevSourceLine = t.range.end.line;
      continue;
    }

    // Comentário de bloco: mantém como token atômico e encerra linha.
    if (isBlockComment(t)) {
      if (!atLineStart && shouldSpaceBefore(t, prev, prevPrev, atLineStart)) pendingSpace = true;
      emitText(t.value);
      emitLine();
      prevPrev = prev;
      prev = t;
      prevSourceLine = t.range.end.line;
      continue;
    }

    // Fechamentos: dedent antes
    if (isKeyword(t, 'fim') || isDelimiter(t, '}')) {
      if (isKeyword(t, 'fim') && tableLayoutMarkers.tableLegacyFimIndices.has(i)) {
        assignmentAlignColumn = null;
      }
      popIndent();
      // se está no meio da linha, quebra antes
      if (!atLineStart) emitLine();
    }

    // Espaçamento padrão
    if (t.type === 'Operator' && t.value === '+') {
      const nextRaw = tokens[i + 1]! ?? null;
      const nextSig = nextSignificant(i + 2);
      if (nextRaw && isLineComment(nextRaw) && nextSig && nextSig.type === 'String' && nextSig.range.start.line === nextRaw.range.start.line) {
        movedConcatPlusAfterComment = true;
        prevPrev = prev;
        prev = t;
        prevSourceLine = t.range.end.line;
        continue;
      }
      movedConcatPlusAfterComment = false;
    }
    if (shouldSpaceBefore(t, prev, prevPrev, atLineStart)) pendingSpace = true;

    // Continuação multiline em headers de controle: recuo de bloco (+2).
    if (atLineStart && controlContinuationActive) {
      emitIndentSpaces(INDENT_SIZE);
    }

    // Continuação multiline de atribuição com '=':
    // quando a nova linha não começa com '+', ainda assim alinhamos
    // o primeiro token na coluna do '=' para preservar estilo legado.
    if (
      atLineStart &&
      assignmentAlignColumn !== null &&
      !(t.type === 'Operator' && (t.value === '+' || t.value === '-'))
    ) {
      const indentBase = indentLevel * INDENT_SIZE;
      emitIndentSpaces(Math.max(0, assignmentAlignColumn - indentBase));
    }

    // Concatenação multiline: linhas iniciadas por '+' recebem indent canônico (TS-like)
    // (sem tentar preservar colunas manuais).
    if (atLineStart && t.type === 'Operator' && (t.value === '+' || t.value === '-')) {
      if (assignmentAlignColumn !== null) {
        const indentBase = indentLevel * INDENT_SIZE;
        emitIndentSpaces(Math.max(0, assignmentAlignColumn - indentBase));
      } else {
        emitIndentSpaces(5);
      }
    }

    // Tokens especiais: '{' sempre em linha própria (B)
    if (tableLayoutMarkers.tableOpenBraceIndices.has(i)) {
      emitText(t.value);
      emitLine();
      pushIndent();
      assignmentAlignColumn = null;
      prevPrev = prev;
      prev = t;
      prevSourceLine = t.range.end.line;
      continue;
    }

    if (isDelimiter(t, '{')) {
      if (!atLineStart) emitLine();
      emitText(t.value);
      emitLine();
      pushIndent();
      prevPrev = prev;
      prev = t;
      prevSourceLine = t.range.end.line;
      continue;
    }

    // '}' em linha própria (B)
    if (tableLayoutMarkers.tableCloseBraceIndices.has(i)) {
      emitText(t.value);
      prevPrev = prev;
      prev = t;
      prevSourceLine = t.range.end.line;
      continue;
    }

    if (isDelimiter(t, '}')) {
      emitText(t.value);
      emitLine();
      prevPrev = prev;
      prev = t;
      prevSourceLine = t.range.end.line;
      continue;
    }

    // 'Inicio' abre bloco (B)
    if (isKeyword(t, 'inicio')) {
      if (tableLayoutMarkers.tableLegacyInicioIndices.has(i)) {
        assignmentAlignColumn = null;
      }
      if (!atLineStart) emitLine();
      emitText(t.value);
      let emittedToken: Token = t;
      const nextRaw = tokens[i + 1] ?? null;
      const hasInlineLineComment =
        !!nextRaw &&
        isLineComment(nextRaw) &&
        !hasNewlineBetween(sourceText, t.endOffset, nextRaw.startOffset);
      if (hasInlineLineComment) {
        emitText(' ');
        emitText(nextRaw!.value);
        i += 1;
        emittedToken = nextRaw!;
      }
      emitLine();
      pushIndent();
      prevPrev = prev;
      prev = emittedToken;
      prevSourceLine = emittedToken.range.end.line;
      continue;
    }

    // 'Senao' em linha própria e decide single-statement (A)
    if (isKeyword(t, 'senao')) {
      if (!atLineStart) emitLine();
      emitText(t.value);
      let emittedToken: Token = t;
      const nextRaw = tokens[i + 1] ?? null;
      const hasInlineLineComment =
        !!nextRaw &&
        isLineComment(nextRaw) &&
        !hasNewlineBetween(sourceText, t.endOffset, nextRaw.startOffset);
      if (hasInlineLineComment) {
        emitText(' ');
        emitText(nextRaw!.value);
        i += 1;
        emittedToken = nextRaw!;
      }
      emitLine();
      const next = nextSignificant(i + 1);
      if (next && (next.type === 'Keyword' || next.type === 'Identifier') && next.normalized === 'se') {
        suppressSingleStatementIndentLine = next.range.start.line;
        singleStatementRanges.delete(next.range.start.line);
      } else {
        suppressSingleStatementIndentLine = null;
      }

      // O recuo de single-statement é aberto ao iniciar a linha do próximo
      // statement, com base no AST (singleStatementRanges).

      prevPrev = prev;
      prev = emittedToken;
      prevSourceLine = emittedToken.range.end.line;
      continue;
    }

    if (isKeyword(t, 'se') && !atLineStart) {
      emitLine();
    }

    // Emissão padrão
    if (t.type === 'Operator' && t.value === '=' && parenDepth === 0 && !controlHeader) {
      assignmentAlignColumn = tableLayoutMarkers.tableEqualsIndices.has(i)
        ? null
        : (atLineStart ? indentLevel * INDENT_SIZE : currentColumn + (pendingSpace ? 1 : 0));
    }
    emitText(t.value);

    // Terminador de statement
    if (isDelimiter(t, ';')) {
      const next = nextSignificant(i + 1);
      const rawNext = tokens[i + 1]! ?? null;
      const hasInlineLineComment = !!rawNext && isLineComment(rawNext) && rawNext.range.start.line === t.range.end.line;

      // Dentro do header do Para(...), nunca quebra linha nos ';' (sem wrap).
      const inParaHeader = controlHeader === 'para' && controlParenDepth > 0;

      // Se o próximo token significativo está na mesma linha do ';', preserva inline.
      const nextSameLine = !!next && next.range.start.line === t.range.end.line;

      if (inParaHeader || nextSameLine || hasInlineLineComment) {
        pendingSpace = true;
      } else {
        emitLine();
      }
      assignmentAlignColumn = null;
      closeCompletedSingleStatements(t.range.end.line);
    }

    // Fechamento do header de controle: decide single-statement (A)
    if (controlHeader && controlParenDepth === 0 && isDelimiter(t, ')')) {
      const next = nextSignificant(i + 1);
      const shouldBreakAfterInlineControlHeader =
        !!next
        && next.range.start.line === t.range.end.line
        && !isKeyword(next, 'inicio')
        && !isDelimiter(next, '{')
        && !isLineComment(next);

      controlContinuationActive = false;
      controlHeader = null;

      if (shouldBreakAfterInlineControlHeader) {
        emitLine();
      }
    }

    // Parênteses multilinha (listas) fora de headers: ativa continuação
    if (prev && parenDepth > 0 && t.range.start.line > prev.range.end.line && !parenContinuationActive && !controlHeader) {
      pushIndent();
      parenContinuationActive = true;
    }
    if (parenDepth === 0 && parenContinuationActive && !controlHeader) {
      popIndent();
      parenContinuationActive = false;
    }

    prevPrev = prev;
    prev = t;
    prevSourceLine = t.range.end.line;
  }

  while (stack.length > 0) popIndent();
  if (root.length > 0 && root[root.length - 1]?.type !== 'line') root.push(line());
  return group(concat(root));
}
