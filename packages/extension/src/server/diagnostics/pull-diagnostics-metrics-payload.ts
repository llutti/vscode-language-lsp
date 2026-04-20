import { performance } from 'node:perf_hooks';
import { derivePullObservabilityFields, type PullAuthorityLevel, type PullDiagnosticsKind, type PullDiagnosticsSource, type PullEnsureScheduledReason, type PullFollowupReason, type PullPublishDecision, type PullSourceOfTruth, type PullStalenessReason } from './pull-diagnostics-observability';
import { buildPullCandidateSet, type PullCandidateSnapshotForObservability } from './pull-diagnostics-candidate-snapshots';
import { buildPostFormatPullObservabilityData, buildPullFollowupObservabilityData } from './pull-diagnostics-observability-helpers';
import type { VisiblePullDiagnosticsState } from './pull-diagnostics-fast-path-state';
import type { LastNonEmptyPullDiagnosticsSnapshot, StablePullDiagnosticsSnapshot } from './pull-diagnostics-service';

type FollowupOutcomeLike = {
  followupId?: string;
  generation?: number;
  scheduledAtMs?: number;
  scheduleReason?: string;
  targetDocVersion?: number | null;
  targetDirtyStamp?: number | null;
  pendingCountAtSchedule?: number;
  startedAtMs?: number;
  finishedAtMs?: number;
  executedAtMs?: number;
  firstObservedAtMs?: number;
  firstObservedResultCount?: number;
  firstObservedSource?: string;
  firstObservedAuthoritative?: boolean;
  resolvedAtMs?: number;
  skippedReason?: string;
  resolvedReason?: string;
  supersededBy?: string;
};

type FormatMarkerLike = {
  requestId: string;
  baseVersion: number;
  requestedAtMs: number;
  telemetryWindowMs: number;
  windowMs: number;
  editCount: number;
  editLength: number;
  preFormatResultId: string | null;
  preFormatDiagnosticsCount: number | null;
};

export function buildPullDiagnosticsMetricsPayload(input: {
  contextKey: string;
  uri?: string;
  docVersion?: number;
  resultId?: string;
  durationMs: number;
  kind: PullDiagnosticsKind;
  source: PullDiagnosticsSource;
  resultCount: number;
  cacheHit: boolean;
  ensureScheduled: boolean;
  contextMatched: boolean;
  stableUsed?: boolean;
  isPrefix?: boolean;
  isAuthoritative?: boolean;
  dirtyStamp?: number | null;
  publishDecision?: PullPublishDecision;
  stalenessReason?: PullStalenessReason | null;
  authorityLevel?: PullAuthorityLevel;
  followupReason?: PullFollowupReason | null;
  ensureScheduledReason?: PullEnsureScheduledReason | null;
  sourceOfTruth?: PullSourceOfTruth;
  resultAgeMs?: number | null;
  requestAgeMs?: number | null;
  snapshotAgeMs?: number | null;
  compileAgeMs?: number | null;
  lastCompileCompletedAtMs?: number;
  lastEditAtMs?: number;
  lastCompileCompletedAt?: string | null;
  lastEditAt?: string | null;
  docVersionDistance?: number | null;
  followupOutcome: FollowupOutcomeLike | null;
  formatMarker: FormatMarkerLike | null;
  visibleBefore: VisiblePullDiagnosticsState | null;
  stableCandidate: StablePullDiagnosticsSnapshot | null;
  nonEmptyCandidate: LastNonEmptyPullDiagnosticsSnapshot | null;
  projectedReuse: {
    reuseCount: number | null;
    firstServedAtMs: number | null;
    lastServedAtMs: number | null;
    ttlMs: number | null;
    expired: boolean;
    expiryReason: string | null;
    baseResultId: string | null;
    baseDocVersion: number | null;
    currentDocVersion: number | null;
  };
  getResultVersion: (resultId: string | undefined) => number | null;
}): {
  fields: ReturnType<typeof derivePullObservabilityFields>;
  resultAgeMs: number | null;
  requestAgeMs: number;
  snapshotAgeMs: number | null;
  compileAgeMs: number | null;
  docVersionDistance: number | null;
  followupData: ReturnType<typeof buildPullFollowupObservabilityData>;
  postFormatData: ReturnType<typeof buildPostFormatPullObservabilityData>;
  chosenCandidate: PullCandidateSnapshotForObservability;
  candidateSet: PullCandidateSnapshotForObservability[];
  rejectedCandidates: PullCandidateSnapshotForObservability[];
  visibleResultIdAfter: string | null;
  visibleAuthorityAfter: PullAuthorityLevel;
  visibleStateChanged: boolean;
  arbitrationReason: string;
  projectedReuse: {
    reuseCount: number | null;
    firstServedAtMs: number | null;
    lastServedAtMs: number | null;
    ttlMs: number | null;
    expired: boolean;
    expiryReason: string | null;
    baseResultId: string | null;
    baseDocVersion: number | null;
    currentDocVersion: number | null;
  };
} {
  const snapshotReportedAtMs = input.stableCandidate?.reportedAtMs ?? input.nonEmptyCandidate?.reportedAtMs ?? null;
  const snapshotAgeMs = input.snapshotAgeMs
    ?? (snapshotReportedAtMs === null ? null : Math.max(0, Math.round(performance.now() - snapshotReportedAtMs)));
  const compileAgeMs = input.compileAgeMs
    ?? (input.lastCompileCompletedAtMs === undefined ? null : Math.max(0, Date.now() - input.lastCompileCompletedAtMs));
  const requestAgeMs = input.requestAgeMs ?? input.durationMs;
  const resultIdVersion = typeof input.resultId === 'string'
    ? Number.parseInt(input.resultId.split(':', 1)[0] ?? '', 10)
    : Number.NaN;
  const docVersionDistance = input.docVersionDistance
    ?? (
      Number.isFinite(resultIdVersion) && typeof input.docVersion === 'number'
        ? Math.max(0, input.docVersion - resultIdVersion)
        : null
    );
  const fields = derivePullObservabilityFields({
    kind: input.kind,
    source: input.source,
    resultCount: input.resultCount,
    cacheHit: input.cacheHit,
    ensureScheduled: input.ensureScheduled,
    contextMatched: input.contextMatched,
    stableUsed: input.stableUsed,
    isPrefix: input.isPrefix,
    isAuthoritative: input.isAuthoritative,
    ensureScheduledReason: input.ensureScheduledReason,
    publishDecision: input.publishDecision,
    stalenessReason: input.stalenessReason,
    authorityLevel: input.authorityLevel,
    followupReason: input.followupReason,
    sourceOfTruth: input.sourceOfTruth
  });
  const resultAgeMs = input.resultAgeMs
    ?? (fields.sourceOfTruth === 'fresh_compile' ? compileAgeMs : snapshotAgeMs);
  const followupData = buildPullFollowupObservabilityData(input.followupOutcome, fields.authorityLevel, fields.publishDecision);
  const postFormatData = buildPostFormatPullObservabilityData({
    uri: input.uri,
    docVersion: input.docVersion,
    resultId: input.resultId,
    kind: input.kind,
    source: input.source,
    publishDecision: fields.publishDecision,
    marker: input.formatMarker
  });
  const visibleAuthorityAfter = fields.authorityLevel;
  const candidateSelection = buildPullCandidateSet({
    kind: input.kind,
    source: input.source,
    resultId: input.resultId,
    docVersion: input.docVersion,
    dirtyStamp: input.dirtyStamp,
    resultCount: input.resultCount,
    resultAgeMs,
    isAuthoritative: input.isAuthoritative ?? fields.authorityLevel === 'authoritative',
    visibleBefore: input.visibleBefore,
    stableCandidate: input.stableCandidate,
    nonEmptyCandidate: input.nonEmptyCandidate,
    getResultVersion: input.getResultVersion,
    visibleAuthorityAfter
  });
  const arbitrationReason = fields.publishDecision === 'publish_unchanged' && fields.authorityLevel === 'projected'
    ? 'projected_candidate_reused'
    : fields.publishDecision === 'retain_stable'
      ? 'stable_snapshot_retained'
      : fields.publishDecision === 'suppress_transient'
        ? 'transient_hidden_pending_followup'
        : fields.publishDecision === 'publish_full' && fields.authorityLevel === 'authoritative'
          ? 'authoritative_candidate_promoted'
          : 'selected_by_current_pipeline';

  return {
    fields,
    resultAgeMs,
    requestAgeMs,
    snapshotAgeMs,
    compileAgeMs,
    docVersionDistance,
    followupData,
    postFormatData,
    chosenCandidate: candidateSelection.chosenCandidate,
    candidateSet: candidateSelection.candidateSet,
    rejectedCandidates: candidateSelection.rejectedCandidates,
    visibleResultIdAfter: candidateSelection.visibleResultIdAfter,
    visibleAuthorityAfter,
    visibleStateChanged: candidateSelection.visibleStateChanged,
    arbitrationReason,
    projectedReuse: input.projectedReuse
  };
}
