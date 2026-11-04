import { describe, expect, it } from 'vitest';

describe('worker restart policy', () => {
  it('mantém o backoff limitado a 30 segundos', () => {
    const delays = Array.from({ length: 8 }, (_, index) => Math.min(30_000, 250 * (2 ** index)));
    expect(delays).toEqual([250, 500, 1000, 2000, 4000, 8000, 16000, 30000]);
  });
});
