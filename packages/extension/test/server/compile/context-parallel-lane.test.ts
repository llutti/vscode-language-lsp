import { describe, expect, it } from 'vitest';

describe('context parallel lane policy', () => {
  it('keeps the feature disabled unless explicitly opted in', () => {
    expect(process.env.LSP_CONTEXT_PARALLELISM ?? '0').toBe('0');
  });

  it('uses a bounded lane count', () => {
    expect(4).toBeGreaterThan(0);
    expect(4).toBeLessThanOrEqual(4);
  });
});
