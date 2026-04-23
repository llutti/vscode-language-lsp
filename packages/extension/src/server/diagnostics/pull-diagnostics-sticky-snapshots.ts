import type { ResolvedContext } from '../server-runtime';
import type { LastNonEmptyPullDiagnosticsSnapshot, StablePullDiagnosticsSnapshot } from './pull-diagnostics-service';
import type { PullDiagnosticsSource } from './pull-diagnostics-observability';

function getResultVersion(resultId: string | null | undefined): number | null {
  if (!resultId) return null;
  const match = /^(\d+):/.exec(resultId);
  if (!match) return null;
  const value = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(value) ? value : null;
}

export function getAuthoritativeStableSnapshotOverride(input: {
  context: ResolvedContext | null | undefined;
  uri: string;
  dirtyStamp: number | null;
  currentResultId: string;
  diagnosticsCount: number;
  source: PullDiagnosticsSource;
  isAuthoritative: boolean;
  stableSnapshot: StablePullDiagnosticsSnapshot | null | undefined;
  withinFormatProtection: boolean;
}): StablePullDiagnosticsSnapshot | null {
  if (!input.context || input.isAuthoritative) return null;
  if (input.source !== 'context-projected' && input.source !== 'fallback-compile' && input.source !== 'public-api') return null;
  const stable = input.stableSnapshot;
  if (!stable) return null;
  if (stable.contextKey !== input.context.key) return null;
  if (stable.resultId === input.currentResultId) return null;
  if (input.dirtyStamp !== null && stable.dirtyStamp < input.dirtyStamp && !input.withinFormatProtection) return null;
  if (stable.diagnostics.length > input.diagnosticsCount && input.diagnosticsCount === 0) return null;
  if (stable.diagnostics.length === 0 && input.diagnosticsCount > 0) return stable;
  return stable;
}

export function getEditBurstSnapshotOverride(input: {
  context: ResolvedContext | null | undefined;
  hasRecentEditBurst: boolean;
  withinFormatProtection: boolean;
  currentDiagnosticsCount: number;
  isAuthoritative: boolean;
  candidates: Array<StablePullDiagnosticsSnapshot | LastNonEmptyPullDiagnosticsSnapshot | null | undefined>;
}): StablePullDiagnosticsSnapshot | LastNonEmptyPullDiagnosticsSnapshot | null {
  if (!input.context || !input.hasRecentEditBurst || input.withinFormatProtection) return null;
  if (!input.isAuthoritative || input.currentDiagnosticsCount <= 0) return null;

  let best: StablePullDiagnosticsSnapshot | LastNonEmptyPullDiagnosticsSnapshot | null = null;
  for (const candidate of input.candidates) {
    if (!candidate) continue;
    if (candidate.contextKey !== input.context.key) continue;
    if (candidate.diagnostics.length > input.currentDiagnosticsCount) continue;
    if (!best || candidate.reportedAtMs > best.reportedAtMs) {
      best = candidate;
      continue;
    }
    if (candidate.reportedAtMs === best.reportedAtMs && candidate.diagnostics.length < best.diagnostics.length) {
      best = candidate;
    }
  }

  if (!best) return null;
  if (best.diagnostics.length === input.currentDiagnosticsCount) return null;
  return best;
}

export function pickStickyPullDiagnosticsSnapshot(input: {
  contextKey: string | null | undefined;
  hasRecentEditBurst: boolean;
  computedDirtyStamp: number | null;
  candidates: Array<StablePullDiagnosticsSnapshot | LastNonEmptyPullDiagnosticsSnapshot | undefined>;
}): StablePullDiagnosticsSnapshot | LastNonEmptyPullDiagnosticsSnapshot | null {
  if (!input.contextKey || !input.hasRecentEditBurst) return null;

  const sameContextCandidates = input.candidates.filter(
    (candidate): candidate is StablePullDiagnosticsSnapshot | LastNonEmptyPullDiagnosticsSnapshot =>
      Boolean(candidate && candidate.contextKey === input.contextKey)
  );
  if (sameContextCandidates.length === 0) return null;

  const newestZeroStableSnapshot = sameContextCandidates.reduce<StablePullDiagnosticsSnapshot | null>((best, candidate) => {
    if (candidate.diagnostics.length !== 0) return best;
    const stableCandidate = candidate as StablePullDiagnosticsSnapshot;
    const candidateVersion = getResultVersion(stableCandidate.resultId);
    if (!best) return stableCandidate;
    const bestVersion = getResultVersion(best.resultId);
    if (candidateVersion !== null && bestVersion !== null && candidateVersion !== bestVersion) {
      return candidateVersion > bestVersion ? stableCandidate : best;
    }
    return stableCandidate.reportedAtMs > best.reportedAtMs ? stableCandidate : best;
  }, null);

  let best: StablePullDiagnosticsSnapshot | LastNonEmptyPullDiagnosticsSnapshot | null = null;
  for (const candidate of sameContextCandidates) {
    if (candidate.diagnostics.length === 0) continue;
    if (input.computedDirtyStamp !== null && candidate.dirtyStamp !== null && candidate.dirtyStamp > input.computedDirtyStamp) continue;

    if (newestZeroStableSnapshot) {
      const candidateVersion = getResultVersion(candidate.resultId);
      const zeroVersion = getResultVersion(newestZeroStableSnapshot.resultId);
      const zeroDominatesByVersion = candidateVersion !== null && zeroVersion !== null
        ? zeroVersion > candidateVersion
        : newestZeroStableSnapshot.reportedAtMs >= candidate.reportedAtMs;
      const zeroDominatesByFreshness = newestZeroStableSnapshot.reportedAtMs >= candidate.reportedAtMs;
      const zeroDominatesByDirtyStamp = input.computedDirtyStamp !== null
        && newestZeroStableSnapshot.dirtyStamp !== null
        && newestZeroStableSnapshot.dirtyStamp <= input.computedDirtyStamp;
      if ((zeroDominatesByVersion || zeroDominatesByFreshness) && zeroDominatesByDirtyStamp) {
        continue;
      }
    }

    if (!best || candidate.reportedAtMs > best.reportedAtMs) {
      best = candidate;
      continue;
    }
    if (candidate.reportedAtMs === best.reportedAtMs && candidate.diagnostics.length > best.diagnostics.length) {
      best = candidate;
    }
  }

  return best;
}

export function shouldRetainStickySnapshotDuringEditBurst(input: {
  stickySnapshot: StablePullDiagnosticsSnapshot | LastNonEmptyPullDiagnosticsSnapshot | null | undefined;
  currentHash: string;
  currentDiagnosticsCount: number;
  isAuthoritative: boolean;
  source: PullDiagnosticsSource;
}): boolean {
  const stickySnapshot = input.stickySnapshot;
  if (!stickySnapshot) return false;
  if (input.isAuthoritative) return false;
  if (input.currentDiagnosticsCount === 0) return false;
  return input.currentHash !== stickySnapshot.hash && input.currentDiagnosticsCount >= stickySnapshot.diagnostics.length;
}
