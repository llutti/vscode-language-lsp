import { Range, type Position } from './types';

export type SourceFilePerf = {
  offsetToPositionCalls: number;
  rangeFromOffsetsCalls: number;
};

export type SourceFile = {
  path: string;
  text: string;
  lineStarts: number[];
  /**
   * Optional performance counters. Only enabled when callers explicitly attach it.
   */
  __perf?: SourceFilePerf;
};

function computeLineStarts(text: string): number[] {
  const starts: number[] = [0];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    // \n
    if (ch === 10) {
      starts.push(i + 1);
      continue;
    }
    // \r (\r\n or standalone \r)
    if (ch === 13) {
      const next = text.charCodeAt(i + 1);
      if (next === 10) {
        starts.push(i + 2);
        i += 1;
      } else {
        starts.push(i + 1);
      }
    }
  }
  return starts;
}

export function createSourceFile(path: string, text: string): SourceFile {
  return {
    path,
    text,
    lineStarts: computeLineStarts(text)
  };
}

function upperBound(sorted: number[], value: number): number {
  // returns first index i where sorted[i] > value
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sorted[mid] ?? Number.POSITIVE_INFINITY) <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function offsetToPosition(source: SourceFile, offset: number): Position {
  source.__perf && (source.__perf.offsetToPositionCalls += 1);

  const clamped = Math.max(0, Math.min(offset, source.text.length));
  // Find greatest lineStart <= clamped (i.e. upperBound-1).
  const ub = upperBound(source.lineStarts, clamped);
  const line = Math.max(0, ub - 1);
  const character = clamped - (source.lineStarts[line] ?? 0);
  return { line, character };
}

export function positionToOffset(source: SourceFile, position: Position): number {
  const line = Math.max(0, Math.min(position.line, source.lineStarts.length - 1));
  const lineStart = source.lineStarts[line] ?? 0;
  return Math.max(lineStart, Math.min(lineStart + position.character, source.text.length));
}

export function rangeFromOffsets(source: SourceFile, start: number, end: number): Range {
  source.__perf && (source.__perf.rangeFromOffsetsCalls += 1);
  return {
    start: offsetToPosition(source, start),
    end: offsetToPosition(source, end)
  };
}
