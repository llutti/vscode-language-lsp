import { createHash } from 'node:crypto';
import path from 'node:path';

export function buildWarmSemanticCacheKey(
  filePath: string,
  contextKey: string | null,
  text: string
): string {
  const normalizedPath = path.resolve(filePath).toLowerCase();
  const digest = createHash('sha1').update(text).digest('hex');
  return `${normalizedPath}|${contextKey ?? '__fallback__'}|${digest}`;
}

export class WarmSemanticTokensCache {
  private readonly store = new Map<string, { data: number[]; createdAt: number }>();

  constructor(private readonly maxEntries: number) {}

  get(key: string): { data: number[]; createdAt: number } | undefined {
    const found = this.store.get(key);
    if (!found) return undefined;
    return { data: [...found.data], createdAt: found.createdAt };
  }

  set(key: string, data: number[]): void {
    this.store.set(key, { data: [...data], createdAt: Date.now() });
    if (this.store.size <= this.maxEntries) return;
    const oldest = this.store.keys().next().value;
    if (!oldest) return;
    this.store.delete(oldest);
  }

  size(): number {
    return this.store.size;
  }
}
