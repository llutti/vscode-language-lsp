import { describe, expect, it } from 'vitest';

import
  {
    buildSemanticPayloadFingerprint,
    isSemanticResponseStale,
    shouldCoalesceSemanticRequest,
    shouldReusePreviousSemanticPayload
  } from '../../../src/server/semantics/semantic-flicker-control';

describe('semantic flicker control', () =>
{
  it('builds stable fingerprints for identical payloads', () =>
  {
    const a = buildSemanticPayloadFingerprint([0, 1, 2, 3, 4]);
    const b = buildSemanticPayloadFingerprint([0, 1, 2, 3, 4]);
    const c = buildSemanticPayloadFingerprint([0, 1, 2, 3, 5]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('coalesces only when typing is recent and there is no hot cache', () =>
  {
    expect(shouldCoalesceSemanticRequest({
      lastDidChangeAt: 1000,
      nowMs: 1120,
      coalesceWindowMs: 150,
      hasExactCache: false,
      hasWarmCache: false
    })).toBe(true);

    expect(shouldCoalesceSemanticRequest({
      lastDidChangeAt: 1000,
      nowMs: 1120,
      coalesceWindowMs: 150,
      hasExactCache: true,
      hasWarmCache: false
    })).toBe(false);
  });

  it('reuses previous payload only for older cached versions in the recent typing window', () =>
  {
    expect(shouldReusePreviousSemanticPayload({
      cachedVersion: 4,
      requestVersion: 5,
      lastDidChangeAt: 1000,
      nowMs: 1120,
      reuseWindowMs: 200
    })).toBe(true);

    expect(shouldReusePreviousSemanticPayload({
      cachedVersion: 5,
      requestVersion: 5,
      lastDidChangeAt: 1000,
      nowMs: 1120,
      reuseWindowMs: 200
    })).toBe(false);
  });

  it('detects stale responses when a newer version was requested', () =>
  {
    expect(isSemanticResponseStale({ latestRequestedVersion: 7, requestVersion: 6 })).toBe(true);
    expect(isSemanticResponseStale({ latestRequestedVersion: 6, requestVersion: 6 })).toBe(false);
    expect(isSemanticResponseStale({ latestRequestedVersion: undefined, requestVersion: 6 })).toBe(false);
  });
});
