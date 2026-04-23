import type { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export type WordToken = {
  word: string;
  start: number;
  end: number;
};

export function getLinePrefix(doc: TextDocument, position: Position): string
{
  const lineStart = { line: position.line, character: 0 };
  return doc.getText({ start: lineStart, end: position });
}

export function getWordAtPosition(doc: TextDocument, position: Position): WordToken | null
{
  const lines = doc.getText().split(/\r?\n/);
  const line = lines[position.line] ?? '';
  const col = position.character;
  const re = /[A-Za-z_][\w]*/g;
  while (true)
  {
    const match = re.exec(line);
    if (match === null) break;
    const start = match.index;
    const end = start + match[0].length;
    if (col >= start && col <= end)
    {
      return { word: match[0], start, end };
    }
  }
  return null;
}

export function isInsideStringLiteral(line: string, position: number): boolean
{
  let inString = false;
  let quote = '';
  for (let i = 0; i < position; i += 1)
  {
    const ch = line[i];
    if (inString)
    {
      if (ch === '\\')
      {
        i += 1;
        continue;
      }
      if (ch === quote)
      {
        inString = false;
        quote = '';
      }
    } else if (ch === '\'' || ch === '"')
    {
      inString = true;
      quote = ch;
    }
  }
  return inString;
}
