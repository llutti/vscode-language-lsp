import { performance } from 'node:perf_hooks';
import type { VisiblePullDiagnosticsState } from './pull-diagnostics-fast-path-state';
import type { LastNonEmptyPullDiagnosticsSnapshot, StablePullDiagnosticsSnapshot } from './pull-diagnostics-service';

export type PullCandidateSnapshotForObservability = {
  kind: string;
  source: string;
  resultId: string | null;
  docVersionBase: number | null;
  docVersionDistance: number | null;
  dirtyStamp: number | null;
  count: number | null;
  ageMs: number | null;
  isAuthoritative: boolean | null;
};

export function buildPullCandidateSnapshot(input: {
  kind: string;
  source: string;
  resultId: string | null | undefined;
  docVersion: number | null | undefined;
  dirtyStamp: number | null | undefined;
  count: number | null | undefined;
  ageMs: number | null | undefined;
  isAuthoritative: boolean | null | undefined;
  getResultVersion: (resultId: string | undefined) => number | null;
}): PullCandidateSnapshotForObservability {
  const resultId = input.resultId ?? null;
  const docVersionBase = input.getResultVersion(resultId ?? undefined);
  const docVersionDistance = (docVersionBase !== null && input.docVersion !== null && input.docVersion !== undefined)
    ? Math.max(0, input.docVersion - docVersionBase)
    : null;
  return {
    kind: input.kind,
    source: input.source,
    resultId,
    docVersionBase,
    docVersionDistance,
    dirtyStamp: input.dirtyStamp ?? null,
    count: input.count ?? null,
    ageMs: input.ageMs ?? null,
    isAuthoritative: input.isAuthoritative ?? null
  };
}

export function buildPullCandidateSet(input: {
  kind: string;
  source: string;
  resultId: string | undefined;
  docVersion: number | undefined;
  dirtyStamp: number | null | undefined;
  resultCount: number;
  resultAgeMs: number | null;
  isAuthoritative: boolean;
  visibleBefore: VisiblePullDiagnosticsState | null;
  stableCandidate: StablePullDiagnosticsSnapshot | null;
  nonEmptyCandidate: LastNonEmptyPullDiagnosticsSnapshot | null;
  getResultVersion: (resultId: string | undefined) => number | null;
  visibleAuthorityAfter: 'authoritative' | 'projected' | 'non_authoritative';
}): {
  chosenCandidate: PullCandidateSnapshotForObservability;
  candidateSet: PullCandidateSnapshotForObservability[];
  rejectedCandidates: PullCandidateSnapshotForObservability[];
  visibleStateChanged: boolean;
  visibleResultIdAfter: string | null;
} {
  const chosenCandidate = buildPullCandidateSnapshot({
    kind: input.kind,
    source: input.source,
    resultId: input.resultId,
    docVersion: input.docVersion,
    dirtyStamp: input.dirtyStamp,
    count: input.resultCount,
    ageMs: input.resultAgeMs,
    isAuthoritative: input.isAuthoritative,
    getResultVersion: input.getResultVersion
  });
  const candidateSet = [
    chosenCandidate,
    input.visibleBefore ? buildPullCandidateSnapshot({
      kind: 'visible_before',
      source: input.visibleBefore.authoritative ? 'visible-authoritative' : 'visible-retained',
      resultId: input.visibleBefore.resultId,
      docVersion: input.docVersion,
      dirtyStamp: input.visibleBefore.dirtyStamp,
      count: null,
      ageMs: Math.max(0, Math.round(performance.now() - input.visibleBefore.reportedAtMs)),
      isAuthoritative: input.visibleBefore.authoritative,
      getResultVersion: input.getResultVersion
    }) : null,
    input.stableCandidate ? buildPullCandidateSnapshot({
      kind: 'stable_snapshot',
      source: 'stable-snapshot',
      resultId: input.stableCandidate.resultId,
      docVersion: input.docVersion,
      dirtyStamp: input.stableCandidate.dirtyStamp,
      count: input.stableCandidate.diagnostics.length,
      ageMs: Math.max(0, Math.round(performance.now() - input.stableCandidate.reportedAtMs)),
      isAuthoritative: true,
      getResultVersion: input.getResultVersion
    }) : null,
    input.nonEmptyCandidate ? buildPullCandidateSnapshot({
      kind: 'last_non_empty_snapshot',
      source: 'non-empty-snapshot',
      resultId: input.nonEmptyCandidate.resultId,
      docVersion: input.docVersion,
      dirtyStamp: input.nonEmptyCandidate.dirtyStamp,
      count: input.nonEmptyCandidate.diagnostics.length,
      ageMs: Math.max(0, Math.round(performance.now() - input.nonEmptyCandidate.reportedAtMs)),
      isAuthoritative: false,
      getResultVersion: input.getResultVersion
    }) : null
  ].filter((candidate): candidate is PullCandidateSnapshotForObservability => Boolean(candidate));
  const rejectedCandidates = candidateSet.filter((candidate, index) => index > 0 && candidate.resultId !== chosenCandidate.resultId);
  const visibleResultIdAfter = typeof input.resultId === 'string' ? input.resultId : null;
  const visibleStateChanged = Boolean(
    input.visibleBefore
      ? input.visibleBefore.resultId !== visibleResultIdAfter
        || input.visibleBefore.authoritative !== (input.visibleAuthorityAfter === 'authoritative')
        || input.visibleBefore.docVersion !== (input.docVersion ?? null)
      : visibleResultIdAfter !== null
  );

  return {
    chosenCandidate,
    candidateSet,
    rejectedCandidates,
    visibleStateChanged,
    visibleResultIdAfter
  };
}
