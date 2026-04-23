import { createHash } from 'node:crypto';

export function buildSemanticPayloadFingerprint(data: readonly number[]): string
{
  const hash = createHash('sha1');
  for (const value of data)
  {
    hash.update(String(value));
    hash.update(',');
  }
  return hash.digest('hex');
}

export function shouldCoalesceSemanticRequest(input: {
  lastDidChangeAt: number | undefined;
  nowMs: number;
  coalesceWindowMs: number;
  hasExactCache: boolean;
  hasWarmCache: boolean;
}): boolean
{
  if (input.hasExactCache || input.hasWarmCache) return false;
  if (input.lastDidChangeAt === undefined) return false;
  return input.nowMs - input.lastDidChangeAt <= input.coalesceWindowMs;
}

export function shouldReusePreviousSemanticPayload(input: {
  cachedVersion: number | undefined;
  requestVersion: number;
  lastDidChangeAt: number | undefined;
  nowMs: number;
  reuseWindowMs: number;
}): boolean
{
  if (input.cachedVersion === undefined) return false;
  if (input.cachedVersion >= input.requestVersion) return false;
  if (input.lastDidChangeAt === undefined) return false;
  return input.nowMs - input.lastDidChangeAt <= input.reuseWindowMs;
}

export function isSemanticResponseStale(input: {
  latestRequestedVersion: number | undefined;
  requestVersion: number;
}): boolean
{
  return (input.latestRequestedVersion ?? input.requestVersion) > input.requestVersion;
}
