import type { TextEdit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

export type EolKind = 'LF' | 'CRLF';

type LineOp =
  | { kind: 'equal'; aLen: number; bLen: number }
  | { kind: 'delete'; aLen: number }
  | { kind: 'insert'; bLen: number }
  | { kind: 'replace'; aLen: number; bLen: number };

export function computeLineStartOffsetsLF(textLF: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < textLF.length; i++) {
    if (textLF.charCodeAt(i) === 10) offsets.push(i + 1);
  }
  offsets.push(textLF.length);
  return offsets;
}

export function myersDiffLineOps(aLines: string[], bLines: string[]): LineOp[] {
  const N = aLines.length;
  const M = bLines.length;
  const max = N + M;
  const size = 2 * max + 1;
  const offset = max;
  const v = new Int32Array(size);
  v.fill(-1);
  v[offset + 1] = 0;
  const trace: Int32Array[] = [];

  for (let d = 0; d <= max; d++) {
    const vSnapshot = new Int32Array(v);
    trace.push(vSnapshot);
    for (let k = -d; k <= d; k += 2) {
      const kIdx = offset + k;
      let x: number;
      if (k === -d || (k !== d && v[kIdx - 1] < v[kIdx + 1])) {
        x = v[kIdx + 1];
      } else {
        x = v[kIdx - 1] + 1;
      }
      let y = x - k;
      while (x < N && y < M && aLines[x] === bLines[y]) {
        x++;
        y++;
      }
      v[kIdx] = x;
      if (x >= N && y >= M) {
        let curX = N;
        let curY = M;
        const rawOps: LineOp[] = [];
        for (let bd = d; bd > 0; bd--) {
          const vv = trace[bd];
          const k2 = curX - curY;
          const k2Idx = offset + k2;
          let prevK: number;
          if (k2 === -bd || (k2 !== bd && vv[k2Idx - 1] < vv[k2Idx + 1])) {
            prevK = k2 + 1;
          } else {
            prevK = k2 - 1;
          }
          const prevX = vv[offset + prevK];
          const prevY = prevX - prevK;

          const snakeLen = curX - prevX;
          if (snakeLen > 0) rawOps.push({ kind: 'equal', aLen: snakeLen, bLen: snakeLen });

          if (curX === prevX) {
            rawOps.push({ kind: 'insert', bLen: 1 });
          } else {
            rawOps.push({ kind: 'delete', aLen: 1 });
          }
          curX = prevX;
          curY = prevY;
        }
        if (curX > 0) rawOps.push({ kind: 'equal', aLen: curX, bLen: curX });

        rawOps.reverse();

        const ops: LineOp[] = [];
        for (const op of rawOps) {
          const last = ops[ops.length - 1];
          if (!last) {
            ops.push(op);
            continue;
          }
          if (last.kind === op.kind && (op.kind === 'equal' || op.kind === 'delete' || op.kind === 'insert')) {
            if (op.kind === 'equal' && last.kind === 'equal') {
              last.aLen += op.aLen;
              last.bLen += op.bLen;
            }
            if (op.kind === 'delete' && last.kind === 'delete') {
              last.aLen += op.aLen;
            }
            if (op.kind === 'insert' && last.kind === 'insert') {
              last.bLen += op.bLen;
            }
            continue;
          }
          if (last.kind === 'delete' && op.kind === 'insert') {
            ops[ops.length - 1] = { kind: 'replace', aLen: last.aLen, bLen: op.bLen };
            continue;
          }
          ops.push(op);
        }
        return ops;
      }
    }
  }
  return [{ kind: 'replace', aLen: N, bLen: M }];
}

export function detectEolKind(text: string): EolKind {
  return text.indexOf('\r\n') >= 0 ? 'CRLF' : 'LF';
}

export function preserveFinalNewline(originalText: string, nextText: string): string {
  const origHasFinalNl = originalText.endsWith('\n') || originalText.endsWith('\r\n');
  const nextHasFinalNl = nextText.endsWith('\n') || nextText.endsWith('\r\n');
  if (origHasFinalNl === nextHasFinalNl) return nextText;
  if (origHasFinalNl) {
    return nextText + (detectEolKind(originalText) === 'CRLF' ? '\r\n' : '\n');
  }
  if (nextText.endsWith('\r\n')) return nextText.slice(0, -2);
  if (nextText.endsWith('\n')) return nextText.slice(0, -1);
  return nextText;
}

export function normalizeFullDocumentEdit(doc: TextDocument, newText: string): TextEdit {
  const fullEnd = { line: doc.lineCount, character: 0 };
  return { range: { start: { line: 0, character: 0 }, end: fullEnd }, newText };
}

export function computeFormattingHunkEdits(doc: TextDocument, originalText: string, nextText: string): TextEdit[] {
  const originalLF = originalText.replace(/\r\n/g, '\n');
  const nextLF = nextText.replace(/\r\n/g, '\n');

  const aLines = originalLF.split('\n');
  const bLines = nextLF.split('\n');

  const aStarts = computeLineStartOffsetsLF(originalLF);
  const bStarts = computeLineStartOffsetsLF(nextLF);

  const docLF = TextDocument.create(doc.uri, doc.languageId, doc.version, originalLF);

  const ops = myersDiffLineOps(aLines, bLines);

  type Block = { aStartLine: number; aEndLine: number; bStartLine: number; bEndLine: number };
  const blocks: Block[] = [];

  let aLine = 0;
  let bLine = 0;
  const MIN_EQUAL_TO_SPLIT = 4;

  let current: Block | null = null;
  function flushCurrent() {
    if (!current) return;
    blocks.push(current);
    current = null;
  }

  for (const op of ops) {
    if (op.kind === 'equal') {
      if (current) {
        if (op.aLen < MIN_EQUAL_TO_SPLIT) {
          current.aEndLine += op.aLen;
          current.bEndLine += op.bLen;
          aLine += op.aLen;
          bLine += op.bLen;
          continue;
        }
        flushCurrent();
      }
      aLine += op.aLen;
      bLine += op.bLen;
      continue;
    }

    const delLines = op.kind === 'delete' ? op.aLen : op.kind === 'replace' ? op.aLen : 0;
    const insLines = op.kind === 'insert' ? op.bLen : op.kind === 'replace' ? op.bLen : 0;

    if (!current) {
      current = { aStartLine: aLine, aEndLine: aLine + delLines, bStartLine: bLine, bEndLine: bLine + insLines };
    } else {
      current.aEndLine += delLines;
      current.bEndLine += insLines;
    }

    aLine += delLines;
    bLine += insLines;
  }
  flushCurrent();

  const MAX_BLOCKS = 80;
  if (blocks.length > MAX_BLOCKS) {
    const merged: Block[] = [];
    const GAP_LINES = 8;
    for (const b of blocks) {
      const last = merged[merged.length - 1];
      if (last && b.aStartLine - last.aEndLine <= GAP_LINES) {
        last.aEndLine = b.aEndLine;
        last.bEndLine = b.bEndLine;
      } else {
        merged.push({ ...b });
      }
    }
    blocks.length = 0;
    blocks.push(...merged);
  }

  if (blocks.length > 200) return [normalizeFullDocumentEdit(doc, nextText)];

  const edits: TextEdit[] = [];
  for (const b of blocks) {
    const aStartOff = aStarts[b.aStartLine] ?? originalLF.length;
    const aEndOff = aStarts[b.aEndLine] ?? originalLF.length;
    const bStartOff = bStarts[b.bStartLine] ?? nextLF.length;
    const bEndOff = bStarts[b.bEndLine] ?? nextLF.length;

    const newTextLF = nextLF.slice(bStartOff, bEndOff);
    edits.push({
      range: { start: docLF.positionAt(aStartOff), end: docLF.positionAt(aEndOff) },
      newText: newTextLF
    });
  }

  edits.sort((e1, e2) => {
    if (e1.range.start.line !== e2.range.start.line) return e1.range.start.line - e2.range.start.line;
    return e1.range.start.character - e2.range.start.character;
  });

  return edits;
}

export function clampOffset(off: number, len: number): number {
  if (off < 0) return 0;
  if (off > len) return len;
  return off;
}

export function remapCursorOffsetByEdits(doc: TextDocument, edits: TextEdit[], cursorOffset: number): number {
  if (!edits || edits.length === 0) return cursorOffset;

  const baseLen = doc.getText().length;
  const offsetEdits = edits
    .map((e) => {
      const start = clampOffset(doc.offsetAt(e.range.start), baseLen);
      const endRaw = clampOffset(doc.offsetAt(e.range.end), baseLen);
      const end = endRaw < start ? start : endRaw;
      const insertLen = e.newText.length;
      return { start, end, insertLen };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  let cur = clampOffset(cursorOffset, baseLen);
  let delta = 0;

  for (const ed of offsetEdits) {
    const s = ed.start + delta;
    const e = ed.end + delta;
    if (cur < s) continue;

    const replacedLen = e - s;
    const change = ed.insertLen - replacedLen;

    if (cur > e) {
      cur += change;
      delta += change;
      continue;
    }

    cur = s + ed.insertLen;
    delta += change;
  }

  const nextLen = baseLen + delta;
  return clampOffset(cur, nextLen);
}
