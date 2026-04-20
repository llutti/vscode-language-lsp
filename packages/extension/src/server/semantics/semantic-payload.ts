import
  {
    SEMANTIC_TOKEN_MODIFIERS,
    SEMANTIC_TOKEN_TYPES,
    type SemanticOccurrence
  } from '@lsp/compiler';
import type { SemanticTokens } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';

const semanticTokenTypeIndex = new Map<string, number>(SEMANTIC_TOKEN_TYPES.map((type, index) => [type, index]));
const semanticTokenModifierIndex = new Map<string, number>(SEMANTIC_TOKEN_MODIFIERS.map((mod, index) => [mod, index]));

function splitMultilineOccurrence(doc: TextDocument, occ: SemanticOccurrence): SemanticOccurrence[]
{
  if (occ.range.start.line === occ.range.end.line) return [occ];

  const next: SemanticOccurrence[] = [];
  for (let line = occ.range.start.line; line <= occ.range.end.line; line += 1)
  {
    const lineText = doc.getText({
      start: { line, character: 0 },
      end: { line, character: Number.MAX_SAFE_INTEGER }
    });
    const startCharacter = line === occ.range.start.line ? occ.range.start.character : 0;
    const endCharacter = line === occ.range.end.line ? occ.range.end.character : lineText.length;
    if (endCharacter <= startCharacter) continue;
    next.push({
      ...occ,
      range: {
        start: { line, character: startCharacter },
        end: { line, character: endCharacter }
      }
    });
  }
  return next;
}

function isEmbeddedSqlStringOccurrence(occ: SemanticOccurrence): boolean
{
  return occ.tokenType === 'string'
    && occ.tokenModifiers.includes('defaultLibrary')
    && !!occ.embeddedSql;
}

function subtractOverlappingEmbeddedSqlLexicalTokens(occurrences: SemanticOccurrence[]): SemanticOccurrence[]
{
  const lexicalByLine = new Map<number, Array<{ start: number; end: number }>>();
  for (const occ of occurrences)
  {
    if (!occ.embeddedSql || occ.tokenType === 'string') continue;
    if (occ.range.start.line !== occ.range.end.line) continue;
    const line = occ.range.start.line;
    const entry = lexicalByLine.get(line) ?? [];
    entry.push({ start: occ.range.start.character, end: occ.range.end.character });
    lexicalByLine.set(line, entry);
  }

  if (lexicalByLine.size === 0) return occurrences;

  const adjusted: SemanticOccurrence[] = [];
  for (const occ of occurrences)
  {
    if (!isEmbeddedSqlStringOccurrence(occ) || occ.range.start.line !== occ.range.end.line)
    {
      adjusted.push(occ);
      continue;
    }

    const overlaps = (lexicalByLine.get(occ.range.start.line) ?? [])
      .filter((candidate) => candidate.end > occ.range.start.character && candidate.start < occ.range.end.character)
      .sort((a, b) => a.start - b.start || a.end - b.end);

    if (overlaps.length === 0)
    {
      adjusted.push(occ);
      continue;
    }

    let cursor = occ.range.start.character;
    for (const overlap of overlaps)
    {
      const start = Math.max(cursor, occ.range.start.character);
      const end = Math.min(overlap.start, occ.range.end.character);
      if (end > start)
      {
        adjusted.push({
          ...occ,
          range: {
            start: { line: occ.range.start.line, character: start },
            end: { line: occ.range.end.line, character: end }
          }
        });
      }
      cursor = Math.max(cursor, overlap.end);
      if (cursor >= occ.range.end.character) break;
    }

    if (cursor < occ.range.end.character)
    {
      adjusted.push({
        ...occ,
        range: {
          start: { line: occ.range.start.line, character: cursor },
          end: { line: occ.range.end.line, character: occ.range.end.character }
        }
      });
    }
  }

  return adjusted;
}

export function prepareSemanticOccurrences(doc: TextDocument, occurrences: SemanticOccurrence[]): SemanticOccurrence[] {
  const split = occurrences.flatMap((occ) => splitMultilineOccurrence(doc, occ));
  return subtractOverlappingEmbeddedSqlLexicalTokens(split);
}

export function buildSemanticTokens(occurrences: SemanticOccurrence[]): SemanticTokens {
  if (!occurrences || occurrences.length === 0) return { data: [] };
  const seen = new Set<string>();
  const tokens = occurrences
    .map((occ) => {
      const typeIndex = semanticTokenTypeIndex.get(occ.tokenType);
      if (typeIndex === undefined) return null;
      const start = occ.range.start;
      const end = occ.range.end;
      if (start.line !== end.line) return null;
      const length = end.character - start.character;
      if (length <= 0) return null;
      const modifiers = occ.tokenModifiers ?? [];
      let modifierMask = 0;
      for (const mod of modifiers) {
        const modIndex = semanticTokenModifierIndex.get(mod);
        if (modIndex === undefined) continue;
        modifierMask |= 1 << modIndex;
      }
      const key = `${start.line}:${start.character}:${length}:${typeIndex}:${modifierMask}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        line: start.line,
        character: start.character,
        length,
        typeIndex,
        modifierMask
      };
    })
    .filter((token): token is { line: number; character: number; length: number; typeIndex: number; modifierMask: number } => Boolean(token))
    .sort((a, b) =>
      a.line !== b.line
        ? a.line - b.line
        : a.character !== b.character
          ? a.character - b.character
          : a.length !== b.length
            ? a.length - b.length
            : a.typeIndex !== b.typeIndex
              ? a.typeIndex - b.typeIndex
              : a.modifierMask - b.modifierMask
    );

  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  for (const token of tokens) {
    const deltaLine = token.line - prevLine;
    const deltaStart = deltaLine === 0 ? token.character - prevChar : token.character;
    data.push(deltaLine, deltaStart, token.length, token.typeIndex, token.modifierMask);
    prevLine = token.line;
    prevChar = token.character;
  }
  return { data };
}
