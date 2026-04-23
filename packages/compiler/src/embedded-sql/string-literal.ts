import type { ExpressionNode, StringLiteralNode } from '../parser/ast';

export type ExtractedSqlStringPiece = {
  literal: StringLiteralNode;
  decodedText: string;
  hadLineContinuation: boolean;
  continuationIndent: string | null;
};

export type ExtractedSqlStringExpression = {
  decodedText: string;
  sourceKind: 'literal' | 'concat_literals';
  pieces: ExtractedSqlStringPiece[];
  prefersContinuationLayout: boolean;
  continuationIndent: string | null;
};

function unwrapParen(expr: ExpressionNode | null): ExpressionNode | null
{
  let current = expr;
  while (current?.kind === 'Paren') current = current.expr;
  return current;
}

function collectStringLiteralNodes(expr: ExpressionNode | null): StringLiteralNode[] | null
{
  const current = unwrapParen(expr);
  if (!current) return null;
  if (current.kind === 'StringLiteral') return [current];
  if (current.kind !== 'Binary' || current.operator !== '+') return null;
  const left = collectStringLiteralNodes(current.left);
  const right = collectStringLiteralNodes(current.right);
  if (!left || !right) return null;
  return [...left, ...right];
}

function decodeSqlStringLiteralContent(content: string): {
  text: string;
  hadLineContinuation: boolean;
  continuationIndent: string | null;
}
{
  let text = '';
  let hadLineContinuation = false;
  let continuationIndent: string | null = null;

  for (let i = 0; i < content.length; i += 1)
  {
    const ch = content[i]!;
    if (ch !== '\\')
    {
      text += ch;
      continue;
    }

    const next = content[i + 1];
    if (!next)
    {
      text += ch;
      continue;
    }

    if (next === '\r' || next === '\n')
    {
      hadLineContinuation = true;
      i += 1;
      if (next === '\r' && content[i + 1] === '\n') i += 1;

      let indent = '';
      while (i + 1 < content.length)
      {
        const candidate = content[i + 1]!;
        if (candidate !== ' ' && candidate !== '\t') break;
        indent += candidate;
        i += 1;
      }
      if (continuationIndent === null && indent.length > 0) continuationIndent = indent;
      text += '\n';
      continue;
    }

    text += next;
    i += 1;
  }

  return { text, hadLineContinuation, continuationIndent };
}


export function decodeSqlStringLiteralWithSourceMap(rawLiteral: string): {
  text: string;
  sourceOffsets: number[];
}
{
  const content = rawLiteral.slice(1, -1);
  let text = '';
  let rawOffset = 1;
  const sourceOffsets = [1];

  for (let i = 0; i < content.length; i += 1)
  {
    const ch = content[i]!;
    if (ch !== '\\')
    {
      text += ch;
      rawOffset += 1;
      sourceOffsets.push(rawOffset);
      continue;
    }

    const next = content[i + 1];
    if (!next)
    {
      text += ch;
      rawOffset += 1;
      sourceOffsets.push(rawOffset);
      continue;
    }

    if (next === '\r' || next === '\n')
    {
      text += '\n';
      rawOffset += 2;
      i += 1;
      if (next === '\r' && content[i + 1] === '\n')
      {
        rawOffset += 1;
        i += 1;
      }
      while (i + 1 < content.length)
      {
        const candidate = content[i + 1]!;
        if (candidate !== ' ' && candidate !== '\t') break;
        rawOffset += 1;
        i += 1;
      }
      sourceOffsets.push(rawOffset);
      continue;
    }

    text += next;
    rawOffset += 2;
    i += 1;
    sourceOffsets.push(rawOffset);
  }

  return { text, sourceOffsets };
}

export function extractSqlStringExpression(expr: ExpressionNode | null): ExtractedSqlStringExpression | null
{
  const literals = collectStringLiteralNodes(expr);
  if (!literals || literals.length === 0) return null;

  const pieces = literals.map((literal) =>
  {
    const decoded = decodeSqlStringLiteralContent(literal.value.slice(1, -1));
    return {
      literal,
      decodedText: decoded.text,
      hadLineContinuation: decoded.hadLineContinuation,
      continuationIndent: decoded.continuationIndent
    };
  });

  return {
    decodedText: pieces.map((piece) => piece.decodedText).join(''),
    sourceKind: literals.length === 1 ? 'literal' : 'concat_literals',
    pieces,
    prefersContinuationLayout: pieces.some((piece) => piece.hadLineContinuation),
    continuationIndent: pieces.find((piece) => piece.continuationIndent)?.continuationIndent ?? null
  };
}
