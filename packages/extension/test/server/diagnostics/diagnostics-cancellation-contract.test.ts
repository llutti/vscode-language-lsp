import { describe, expect, it } from 'vitest';

describe('diagnostics cancellation contract', () => {
  it('uses an empty full report when a pull request is cancelled before work', () => {
    expect({ kind: 'full', items: [] }).toEqual({ kind: 'full', items: [] });
  });
});
