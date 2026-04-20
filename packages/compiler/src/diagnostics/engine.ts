import type { Diagnostic } from '../index';
import { comparePosition } from '../source/types';

export function makeDiagnostic(input: Diagnostic): Diagnostic {
  return input;
}

export function dedupeDiagnostics(diags: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  const out: Diagnostic[] = [];
  for (const d of diags) {
    const key = `${d.id}|${d.sourcePath}|${d.range.start.line}|${d.range.start.character}|${d.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

export function sortDiagnostics(diags: Diagnostic[]): Diagnostic[] {
  return [...diags].sort((a, b) => {
    if (a.sourcePath !== b.sourcePath) {
      return a.sourcePath.localeCompare(b.sourcePath);
    }
    const cmp = comparePosition(a.range.start, b.range.start);
    if (cmp !== 0) return cmp;
    return comparePosition(a.range.end, b.range.end);
  });
}
