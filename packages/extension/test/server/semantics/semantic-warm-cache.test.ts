import { describe, expect, it } from 'vitest';

import { buildWarmSemanticCacheKey, WarmSemanticTokensCache } from '../../../src/server/semantics/semantic-warm-cache';

describe('semantic warm cache', () => {
  it('builds deterministic keys for same input', () => {
    const a = buildWarmSemanticCacheKey('/tmp/a.lsp', 'ctx', 'Mensagem(Erro, "x");');
    const b = buildWarmSemanticCacheKey('/tmp/a.lsp', 'ctx', 'Mensagem(Erro, "x");');
    expect(a).toBe(b);
  });

  it('changes key when content changes', () => {
    const a = buildWarmSemanticCacheKey('/tmp/a.lsp', 'ctx', 'x');
    const b = buildWarmSemanticCacheKey('/tmp/a.lsp', 'ctx', 'y');
    expect(a).not.toBe(b);
  });

  it('evicts oldest item when max size is exceeded', () => {
    const cache = new WarmSemanticTokensCache(2);
    cache.set('k1', [1, 2, 3]);
    cache.set('k2', [4, 5, 6]);
    cache.set('k3', [7, 8, 9]);

    expect(cache.get('k1')).toBeUndefined();
    expect(cache.get('k2')?.data).toEqual([4, 5, 6]);
    expect(cache.get('k3')?.data).toEqual([7, 8, 9]);
  });
});
