import { describe, expect, it } from 'vitest';
import { buildPullDiagnosticsMetricsPayload } from '../../../src/server/diagnostics/pull-diagnostics-metrics-payload';

describe('pull diagnostics metrics payload', () => {
  it('builds coherent payload for projected pull diagnostics', () => {
    const payload = buildPullDiagnosticsMetricsPayload({
      contextKey: 'ctx',
      uri: 'file:///a.txt',
      docVersion: 3,
      resultId: '2:abc',
      durationMs: 20,
      kind: 'full',
      source: 'context-projected',
      resultCount: 1,
      cacheHit: true,
      ensureScheduled: true,
      contextMatched: true,
      stableUsed: true,
      isPrefix: true,
      isAuthoritative: false,
      dirtyStamp: 7,
      followupOutcome: null,
      formatMarker: null,
      visibleBefore: null,
      stableCandidate: null,
      nonEmptyCandidate: null,
      projectedReuse: {
        reuseCount: 1,
        firstServedAtMs: 10,
        lastServedAtMs: 20,
        ttlMs: 10,
        expired: false,
        expiryReason: null,
        baseResultId: '2:abc',
        baseDocVersion: 2,
        currentDocVersion: 3
      },
      getResultVersion: (resultId) => resultId ? 2 : null
    });

    expect(payload.fields.authorityLevel).toBe('projected');
    expect(payload.fields.publishDecision).toBe('retain_stable');
    expect(payload.candidateSet[0]?.resultId).toBe('2:abc');
    expect(payload.visibleStateChanged).toBe(true);
  });
});
