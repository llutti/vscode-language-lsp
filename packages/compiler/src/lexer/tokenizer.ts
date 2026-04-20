import { rangeFromOffsets, type SourceFile, type SourceFilePerf } from '../source/source-file';
import type { Range } from '../source/types';
import { casefold } from '../utils/casefold';

export type TokenType =
  | 'Identifier'
  | 'Keyword'
  | 'Type'
  | 'Number'
  | 'String'
  | 'Apostrophe'
  | 'Operator'
  | 'Delimiter'
  | 'CommentLine'
  | 'CommentBlock'
  | 'EOF'
  | 'Unknown';

export type Token = {
  type: TokenType;
  value: string;
  normalized: string;
  range: Range;
  sourcePath: string;
  startOffset: number;
  endOffset: number;
};

export type TokenizePerf = {
  tokensTotal: number;
  tokensNoTrivia: number;
  lexicalErrors: number;
  sourcePerf?: SourceFilePerf;
};


export function withoutTrivia(tokens: Token[]): Token[] {
  return tokens.filter((t) => t.type !== 'CommentLine' && t.type !== 'CommentBlock');
}

const KEYWORDS = new Set(
  [
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
  ].map(casefold)
);

const TYPES = new Set(['alfa', 'numero', 'data', 'funcao', 'lista', 'cursor', 'tabela'].map(casefold));
const LOGICAL_OPERATORS = new Set(['e', 'ou'].map(casefold));

const TWO_CHAR_OPERATORS = new Set(['>=', '<=', '<>', '++', '--']);
const ONE_CHAR_OPERATORS = new Set(['=', '>', '<', '+', '-', '*', '/']);
const DELIMITERS = new Set(['(', ')', '[', ']', '{', '}', ';', ',', '.', ':']);

function isWhitespaceCode(code: number): boolean {
  // space, tab, \n, \r
  return code === 32 || code === 9 || code === 10 || code === 13;
}

function isIdentifierStartCode(code: number): boolean {
  // A-Z a-z _
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95;
}

function isIdentifierPartCode(code: number): boolean {
  // A-Z a-z 0-9 _
  return isIdentifierStartCode(code) || (code >= 48 && code <= 57);
}

function isDigitCode(code: number): boolean {
  return code >= 48 && code <= 57;
}

function makeToken(source: SourceFile, type: TokenType, value: string, start: number, end: number): Token {
  return {
    type,
    value,
    normalized: casefold(value),
    range: rangeFromOffsets(source, start, end),
    sourcePath: source.path,
    startOffset: start,
    endOffset: end
  };
}

export function tokenize(source: SourceFile, options?: { collectPerf?: boolean }): { tokens: Token[]; lexicalErrors: Token[]; perf?: TokenizePerf } {
  const tokens: Token[] = [];
  const lexicalErrors: Token[] = [];
  const text = source.text;
  const length = text.length;

  const perf: TokenizePerf | undefined = options?.collectPerf
    ? {
        tokensTotal: 0,
        tokensNoTrivia: 0,
        lexicalErrors: 0,
        sourcePerf: (source.__perf = { offsetToPositionCalls: 0, rangeFromOffsetsCalls: 0 })
      }
    : undefined;

  let i = 0;

  const pushToken = (token: Token) => {
    tokens.push(token);
    if (perf) {
      perf.tokensTotal += 1;
      if (token.type !== 'CommentLine' && token.type !== 'CommentBlock') perf.tokensNoTrivia += 1;
    }
  };

  while (i < length) {
    const code = text.charCodeAt(i);

    if (isWhitespaceCode(code)) {
      i += 1;
      continue;
    }

    const ch = text[i]!;
    const next = i + 1 < length ? text[i + 1]! : '';

    // Line comment: @ ... @ (or error if not closed before newline)
    if (ch === '@') {
      let j = i + 1;
      let closed = false;
      while (j < length) {
        const c = text.charCodeAt(j);
        if (c === 10 || c === 13) break; // newline
        if (text[j] === '@') {
          closed = true;
          j += 1;
          break;
        }
        j += 1;
      }
      const end = j;
      const token = makeToken(source, 'CommentLine', text.slice(i, end), i, end);
      pushToken(token);
      if (!closed) {
        lexicalErrors.push(token);
        perf && (perf.lexicalErrors += 1);
      }
      i = end;
      continue;
    }

    // Block comment: /* ... */
    if (ch === '/' && next === '*') {
      let j = i + 2;
      let closed = false;
      while (j < length - 1) {
        if (text[j] === '*' && text[j + 1] === '/') {
          closed = true;
          j += 2;
          break;
        }
        j += 1;
      }
      const end = closed ? j : length;
      const token = makeToken(source, 'CommentBlock', text.slice(i, end), i, end);
      pushToken(token);
      if (!closed) {
        lexicalErrors.push(token);
        perf && (perf.lexicalErrors += 1);
      }
      i = end;
      continue;
    }

    // String: " ... "
    if (ch === '"') {
      let j = i + 1;
      let closed = false;
      while (j < length) {
        const cj = text[j]!;
        if (cj === '\\' && j + 1 < length) {
          // skip escaped char (supports \\" and \\\\)
          j += 2;
          continue;
        }
        if (cj === '"') {
          closed = true;
          j += 1;
          break;
        }
        j += 1;
      }
      const end = j;
      const token = makeToken(source, 'String', text.slice(i, end), i, end);
      pushToken(token);
      if (!closed) {
        lexicalErrors.push(token);
        perf && (perf.lexicalErrors += 1);
      }
      i = end;
      continue;
    }

    // Apostrophe literal: 'A' (exactly one character between apostrophes)
    if (ch === "'") {
      let end = Math.min(i + 1, length);
      let valid = false;
      if (i + 2 < length && text[i + 2] === "'") {
        end = i + 3;
        valid = true;
      } else {
        let j = i + 1;
        while (j < length) {
          const cj = text[j]!;
          if (cj === '\n' || cj === '\r') break;
          if (cj === "'") {
            j += 1;
            break;
          }
          j += 1;
        }
        end = j;
      }
      const token = makeToken(source, 'Apostrophe', text.slice(i, end), i, end);
      pushToken(token);
      if (!valid) {
        lexicalErrors.push(token);
        perf && (perf.lexicalErrors += 1);
      }
      i = end;
      continue;
    }

    // Number: [0-9]+(\.[0-9]+)?
    if (isDigitCode(code)) {
      let j = i;
      while (j < length && isDigitCode(text.charCodeAt(j))) j += 1;
      if (j < length && text[j] === '.') {
        const afterDot = j + 1 < length ? text.charCodeAt(j + 1) : -1;
        if (afterDot >= 48 && afterDot <= 57) {
          j += 1;
          while (j < length && isDigitCode(text.charCodeAt(j))) j += 1;
        }
      }
      pushToken(makeToken(source, 'Number', text.slice(i, j), i, j));
      i = j;
      continue;
    }

    // Identifier / keyword / type / logical operator
    if (isIdentifierStartCode(code)) {
      let j = i + 1;
      while (j < length && isIdentifierPartCode(text.charCodeAt(j))) j += 1;
      const value = text.slice(i, j);
      const norm = casefold(value);
      if (KEYWORDS.has(norm)) {
        pushToken(makeToken(source, 'Keyword', value, i, j));
      } else if (TYPES.has(norm)) {
        pushToken(makeToken(source, 'Type', value, i, j));
      } else if (LOGICAL_OPERATORS.has(norm)) {
        pushToken(makeToken(source, 'Operator', value, i, j));
      } else {
        pushToken(makeToken(source, 'Identifier', value, i, j));
      }
      i = j;
      continue;
    }

    // Two-char operators
    const two = ch + next;
    if (TWO_CHAR_OPERATORS.has(two)) {
      pushToken(makeToken(source, 'Operator', two, i, i + 2));
      i += 2;
      continue;
    }

    // One-char operators
    if (ONE_CHAR_OPERATORS.has(ch)) {
      pushToken(makeToken(source, 'Operator', ch, i, i + 1));
      i += 1;
      continue;
    }

    // Delimiters
    if (DELIMITERS.has(ch)) {
      pushToken(makeToken(source, 'Delimiter', ch, i, i + 1));
      i += 1;
      continue;
    }

    // Unknown / invalid
    const unknown = makeToken(source, 'Unknown', ch, i, i + 1);
    pushToken(unknown);
    lexicalErrors.push(unknown);
    perf && (perf.lexicalErrors += 1);
    i += 1;
  }

  pushToken(makeToken(source, 'EOF', '', length, length));
  return perf ? { tokens, lexicalErrors, perf } : { tokens, lexicalErrors };
}
