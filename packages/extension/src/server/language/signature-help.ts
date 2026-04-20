import type { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export type SignatureCallContext = {
  name: string;
  activeParameter: number;
};

type CallFrame = {
  name: string | null;
  commaCount: number;
};

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_]/.test(char);
}

function parseIdentifierBeforeParen(text: string, parenOffset: number): string | null {
  let end = parenOffset;
  while (end > 0 && /\s/.test(text[end - 1] ?? '')) {
    end -= 1;
  }
  if (end <= 0) return null;

  let start = end - 1;
  while (start >= 0 && isIdentifierPart(text[start] ?? '')) {
    start -= 1;
  }
  start += 1;

  if (start >= end) return null;
  const candidate = text.slice(start, end);
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(candidate) ? candidate : null;
}

export function getSignatureCallContext(doc: TextDocument, position: Position): SignatureCallContext | null {
  const text = doc.getText();
  const offset = doc.offsetAt(position);
  if (offset <= 0) return null;

  const source = text.slice(0, offset);
  const stack: CallFrame[] = [];

  let inString = false;
  let stringQuote = '';
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i] ?? '';
    const next = source[i + 1] ?? '';

    if (inString) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    }

    if (inLineComment) {
      if (ch === '@' || ch === '\n' || ch === '\r') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (ch === '@') {
      inLineComment = true;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (ch === '"' || ch === '\'') {
      inString = true;
      stringQuote = ch;
      continue;
    }

    if (ch === '(') {
      stack.push({
        name: parseIdentifierBeforeParen(source, i),
        commaCount: 0
      });
      continue;
    }

    if (ch === ',') {
      if (stack.length > 0) {
        stack[stack.length - 1]!.commaCount += 1;
      }
      continue;
    }

    if (ch === ')') {
      stack.pop();
    }
  }

  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const frame = stack[i];
    if (!frame?.name) continue;
    return {
      name: frame.name,
      activeParameter: Math.max(0, frame.commaCount)
    };
  }

  return null;
}
