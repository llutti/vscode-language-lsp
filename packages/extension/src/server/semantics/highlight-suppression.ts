import type { Range } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SemanticOccurrence } from '@lsp/compiler';

const TEXTMATE_PRIORITY_KEYWORDS = new Set(['iniciartransacao', 'desfazertransacao', 'finalizartransacao']);
const MESSAGE_MODE_KEYWORDS = new Set(['retorna', 'erro', 'refaz']);

function readTokenTextAtRange(doc: TextDocument, range: Range): string
{
  if (range.start.line !== range.end.line) return '';
  const line = doc.getText({
    start: { line: range.start.line, character: 0 },
    end: { line: range.start.line, character: Number.MAX_SAFE_INTEGER }
  });
  const start = Math.max(0, Math.min(range.start.character, line.length));
  const end = Math.max(start, Math.min(range.end.character, line.length));
  return line.slice(start, end).trim();
}

function isMensagemFirstArgumentKeyword(doc: TextDocument, range: Range, tokenText: string): boolean
{
  if (!MESSAGE_MODE_KEYWORDS.has(tokenText.toLowerCase())) return false;
  if (range.start.line !== range.end.line) return false;

  const line = doc.getText({
    start: { line: range.start.line, character: 0 },
    end: { line: range.start.line, character: Number.MAX_SAFE_INTEGER }
  });
  const beforeToken = line.slice(0, Math.max(0, range.start.character));

  // Preserve the TextMate contextual scope in `Mensagem(<modo>, ...)`.
  return /mensagem\s*\(\s*$/i.test(beforeToken);
}

export function shouldSuppressSemanticTokenForTextmate(doc: TextDocument, occ: SemanticOccurrence): boolean
{
  if (occ.tokenType === 'method' && (occ.tokenModifiers ?? []).includes('defaultLibrary'))
  {
    // Lista/Cursor methods have a dedicated TextMate scope to keep stable visual identity.
    return true;
  }
  const text = readTokenTextAtRange(doc, occ.range);
  if (isMensagemFirstArgumentKeyword(doc, occ.range, text))
  {
    return true;
  }
  return TEXTMATE_PRIORITY_KEYWORDS.has(text.toLowerCase());
}
