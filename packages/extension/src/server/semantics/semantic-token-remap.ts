import type { Range } from 'vscode-languageserver/node';

export type SemanticTokenEdit = {
  fromVersion: number;
  toVersion: number;
  range: Range;
  text: string;
};

type SemanticTokensCacheEntryLike = {
  version: number;
  data: number[];
};

type AbsoluteSemanticToken = {
  line: number;
  char: number;
  length: number;
  tokenType: number;
  tokenModifiers: number;
};

function decodeSemanticTokens(data: number[]): AbsoluteSemanticToken[] {
  const out: AbsoluteSemanticToken[] = [];
  let line = 0;
  let char = 0;
  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i] ?? 0;
    const deltaChar = data[i + 1] ?? 0;
    const length = data[i + 2] ?? 0;
    const tokenType = data[i + 3] ?? 0;
    const tokenModifiers = data[i + 4] ?? 0;

    line += deltaLine;
    char = deltaLine === 0 ? char + deltaChar : deltaChar;

    out.push({ line, char, length, tokenType, tokenModifiers });
  }
  return out;
}

function encodeSemanticTokens(tokens: AbsoluteSemanticToken[]): number[] {
  const out: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  for (const t of tokens) {
    const deltaLine = t.line - prevLine;
    const deltaChar = deltaLine === 0 ? t.char - prevChar : t.char;
    out.push(deltaLine, deltaChar, t.length, t.tokenType, t.tokenModifiers);
    prevLine = t.line;
    prevChar = t.char;
  }
  return out;
}

function isTokenInsideRange(token: AbsoluteSemanticToken, range: Range): boolean {
  const start = range.start;
  const end = range.end;
  if (token.line < start.line || token.line > end.line) return false;
  if (token.line === start.line && token.char < start.character) return false;
  if (token.line === end.line && token.char >= end.character) return false;
  if (token.line === start.line && token.line === end.line) {
    return token.char >= start.character && token.char < end.character;
  }
  if (token.line === start.line) return token.char >= start.character;
  if (token.line === end.line) return token.char < end.character;
  return true;
}

function countInsertedLines(text: string): { lines: number; lastLineLength: number } {
  let lines = 0;
  let lastLineLen = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    if (ch === 10) {
      lines += 1;
      lastLineLen = 0;
    } else if (ch !== 13) {
      lastLineLen += 1;
    }
  }
  return { lines, lastLineLength: lastLineLen };
}

export function tryRemapStaleSemanticTokens(
  cached: SemanticTokensCacheEntryLike,
  requestVersion: number,
  edits: SemanticTokenEdit[],
  maxEdits: number
): { data: number[]; editsApplied: number; degraded: boolean; droppedTokens: number } | null {
  if (requestVersion <= cached.version) return null;
  if (edits.length === 0) return null;

  const relevant = edits
    .filter((e) => e.fromVersion >= cached.version && e.toVersion <= requestVersion)
    .slice();

  if (relevant.length === 0) return null;
  if (relevant.length > maxEdits) return null;

  type Step = { fromVersion: number; toVersion: number; edits: SemanticTokenEdit[] };
  const stepMap = new Map<string, Step>();
  for (const e of relevant) {
    const key = `${e.fromVersion}->${e.toVersion}`;
    const existing = stepMap.get(key);
    if (existing) existing.edits.push(e);
    else stepMap.set(key, { fromVersion: e.fromVersion, toVersion: e.toVersion, edits: [e] });
  }
  const steps = Array.from(stepMap.values()).sort((a, b) => a.fromVersion - b.fromVersion);

  let expectedFrom = cached.version;
  for (const s of steps) {
    if (s.fromVersion !== expectedFrom) return null;
    expectedFrom = s.toVersion;
  }
  if (expectedFrom !== requestVersion) return null;

  const tokens = decodeSemanticTokens(cached.data);
  const initialTokenCount = tokens.length;
  let droppedTokens = 0;

  for (const step of steps) {
    step.edits.sort((a, b) =>
      a.range.start.line !== b.range.start.line
        ? b.range.start.line - a.range.start.line
        : b.range.start.character - a.range.start.character
    );

    for (const edit of step.edits) {
      for (let i = tokens.length - 1; i >= 0; i -= 1) {
        const t = tokens[i];
        if (t && isTokenInsideRange(t, edit.range)) {
          tokens.splice(i, 1);
          droppedTokens += 1;
        }
      }

      const start = edit.range.start;
      const end = edit.range.end;
      const removedLines = Math.max(0, end.line - start.line);
      const removedCharsSameLine = removedLines === 0 ? Math.max(0, end.character - start.character) : 0;

      const ins = countInsertedLines(edit.text);
      const lineDelta = ins.lines - removedLines;

      if (lineDelta === 0) {
        const charDelta = ins.lastLineLength - removedCharsSameLine;
        if (charDelta !== 0) {
          for (const t of tokens) {
            if (t.line !== start.line) continue;
            if (t.char >= end.character) {
              t.char = Math.max(0, t.char + charDelta);
            }
          }
        }
        continue;
      }

      for (const t of tokens) {
        if (t.line > end.line) {
          t.line = Math.max(0, t.line + lineDelta);
          continue;
        }
        if (t.line === end.line && t.char >= end.character) {
          t.line = Math.max(0, t.line + lineDelta);
        }
      }
    }
  }

  tokens.sort((a, b) => (a.line !== b.line ? a.line - b.line : a.char - b.char));

  const degradedThreshold = Math.max(50, Math.floor(initialTokenCount * 0.02));
  return { data: encodeSemanticTokens(tokens), editsApplied: relevant.length, degraded: droppedTokens > degradedThreshold, droppedTokens };
}
