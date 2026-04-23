import type { SemanticOccurrence } from '@lsp/compiler';
import { normalizePathKey } from './path-utils';

export type ContextCacheLike = {
  symbols: Array<unknown>;
  semanticsByFile?: Map<string, SemanticOccurrence[]>;
};

export function shouldLoadSystemAfterActiveContext(system: string): boolean {
  return system.toLowerCase() !== 'senior';
}

export function shouldServeCustomFromCommittedCache(cache: ContextCacheLike | undefined): boolean {
  return (cache?.symbols?.length ?? 0) > 0;
}

export function getCommittedSemanticOccurrences(
  cache: ContextCacheLike | undefined,
  filePath: string
): SemanticOccurrence[] | undefined {
  const entries = cache?.semanticsByFile;
  if (!entries) return undefined;
  const exact = entries.get(filePath);
  if (exact) return exact;
  const key = normalizePathKey(filePath);
  for (const [entryPath, list] of entries.entries()) {
    if (normalizePathKey(entryPath) === key) {
      return list;
    }
  }
  return undefined;
}
