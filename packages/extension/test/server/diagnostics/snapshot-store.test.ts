import { describe, it, expect } from 'vitest';
import { createSnapshotStore } from '../../../src/server/semantics/snapshot-store';

describe('snapshot store', () => {
  it('stores by context and preserves hash/version', () => {
    const store = createSnapshotStore();
    store.upsert({
      uri: 'file:///A.lspt',
      filePath: '/tmp/A.lspt',
      contextId: 'ctx-A',
      version: 3,
      text: 'n=1;'
    });

    const snapshot = store.get('file:///A.lspt');
    expect(snapshot?.version).toBe(3);
    expect(snapshot?.hash.length).toBeGreaterThan(0);

    const byContext = store.listByContext('ctx-A');
    expect(byContext).toHaveLength(1);
    expect(byContext[0].filePath).toBe('/tmp/A.lspt');
  });
});
