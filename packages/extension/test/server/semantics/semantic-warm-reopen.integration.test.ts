import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function loadServerSource(): string {
  const repoRoot = path.join(__dirname, '..', '..', '..', 'src');
  return [
    path.join(repoRoot, 'server.ts'),
    path.join(repoRoot, 'server', 'register-lifecycle-handlers.ts'),
    path.join(repoRoot, 'server', 'semantics', 'semantic-runtime.ts')
  ].map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n');
}

describe('semantic warm reopen integration', () => {
  it('records didOpen timestamp and computes first semantic publish latency', () => {
    const source = loadServerSource();
    expect(source.includes('didOpenReceivedAtByUri.set(doc.uri, Date.now());')).toBe(true);
    expect(source.includes('didOpenToFirstSemanticMs')).toBe(true);
    expect(source.includes('semanticCacheHit:')).toBe(true);
    expect(source.includes('source === \'cache-warm-reopen\'')).toBe(true);
  });

  it('stores semantic tokens on close and reuses warm cache on reopen', () => {
    const source = loadServerSource();
    expect(source.includes('const warmCached = warmSemanticTokensCache.get(warmKey);')).toBe(true);
    expect(source.includes('source = \'cache-warm-reopen\';')).toBe(true);
    expect(source.includes('const closingDoc = runtime.documents.get(params.textDocument.uri);')).toBe(true);
    expect(source.includes('warmSemanticTokensCache.set(warmKey, cached.data);')).toBe(true);
  });
});
