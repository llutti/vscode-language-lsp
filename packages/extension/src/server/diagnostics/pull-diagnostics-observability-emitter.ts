import { recordDecisionEvent, recordMetric, type CorrelationContext, type ObservabilitySettings } from '../../observability';
import type { PullAuthorityLevel } from './pull-diagnostics-observability';

type PullObservabilityApi = Parameters<typeof recordMetric>[0];

type PullFollowupData = {
  pullFollowupState: string;
  pullFollowupScheduleReason: string | null;
  pullFollowupSkippedReason: string | null;
  pullFollowupScheduledAt: string | null;
  pullFollowupStartedAt: string | null;
  pullFollowupExecutedAt: string | null;
  pullFollowupResolvedAt: string | null;
  pullFollowupFirstObservedAt: string | null;
  pullFollowupFirstObservedCount: number | null;
  pullFollowupFirstObservedSource: string | null;
  pullFollowupFirstObservedAuthoritative: boolean | null;
  pullTimeToFirstObservedMs: number | null;
  pullTimeToAuthoritativeMs: number | null;
  pullPerceivedState: string;
  pullFollowupId: string | null;
  pullFollowupGeneration: number | null;
  pullFollowupTargetDocVersion: number | null;
  pullFollowupTargetDirtyStamp: number | null;
  pullFollowupPendingCountAtSchedule: number | null;
  pullFollowupResolvedReason: string | null;
  pullFollowupSupersededBy: string | null;
};

type PullPostFormatData = {
  active: boolean;
  requestId: string | null;
  editCount: number | null;
  editLength: number | null;
  sinceMs: number | null;
  sameResultIdAsBefore: boolean | null;
  preFormatDiagnosticsCount: number | null;
  returnedUnchanged: boolean;
  paintRisk: boolean;
};

type PullProjectedReuseData = {
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

function stringifyObservabilityJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function toIsoFromEpochMs(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return new Date(value).toISOString();
}

export function emitPullDiagnosticsObservability(input: {
  observability: PullObservabilityApi;
  settings: ObservabilitySettings;
  correlation: CorrelationContext;
  metricsEnabled: boolean;
  workspaceUri: string;
  recordMetrics: (data: Record<string, unknown>, workspaceUri: string) => void;
  contextKey: string;
  contextName: string;
  durationMs: number;
  kind: string;
  source: string;
  mode: 'pull';
  resultCount: number;
  cacheHit: boolean;
  ensureScheduled: boolean;
  contextMatched: boolean;
  stableUsed: boolean | null;
  isPrefix: boolean | null;
  isAuthoritative: boolean | null;
  dirtyStamp: number | null;
  fields: {
    publishDecision: string;
    stalenessReason: string | null;
    authorityLevel: PullAuthorityLevel;
    followupReason: string | null;
    ensureScheduledReason: string | null;
    sourceOfTruth: string;
    contextMatchReason: string | null;
    transientCause: string | null;
  };
  resultAgeMs: number | null;
  requestAgeMs: number | null;
  snapshotAgeMs: number | null;
  compileAgeMs: number | null;
  lastCompileCompletedAt: string | null;
  lastEditAt: string | null;
  docVersionDistance: number | null;
  followupData: PullFollowupData;
  postFormatData: PullPostFormatData;
  candidateSet: unknown[];
  chosenCandidate: unknown;
  rejectedCandidates: unknown[];
  arbitrationReason: string;
  visibleResultIdBefore: string | null;
  visibleResultIdAfter: string | null;
  visibleAuthorityBefore: PullAuthorityLevel | null;
  visibleAuthorityAfter: PullAuthorityLevel;
  visibleDocVersionBefore: number | null;
  visibleDocVersionAfter: number | null;
  visibleStateChanged: boolean;
  projectedReuse: PullProjectedReuseData;
}): void {
  if (input.metricsEnabled) {
    input.recordMetrics({
      contextKey: input.contextKey,
      contextName: input.contextName,
      phase: 'pullDiagnostics',
      durationMs: input.durationMs,
      pullKind: input.kind,
      pullSource: input.source,
      pullMode: input.mode,
      pullResultCount: input.resultCount,
      pullCacheHit: input.cacheHit,
      pullEnsureScheduled: input.ensureScheduled,
      pullContextMatched: input.contextMatched,
      pullStableUsed: input.stableUsed,
      pullIsPrefix: input.isPrefix,
      pullIsAuthoritative: input.isAuthoritative,
      pullDirtyStamp: input.dirtyStamp,
      pullPublishDecision: input.fields.publishDecision,
      pullStalenessReason: input.fields.stalenessReason,
      pullAuthorityLevel: input.fields.authorityLevel,
      pullFollowupReason: input.fields.followupReason,
      pullEnsureScheduledReason: input.fields.ensureScheduledReason,
      pullSourceOfTruth: input.fields.sourceOfTruth,
      pullResultAgeMs: input.resultAgeMs,
      pullRequestAgeMs: input.requestAgeMs,
      pullSnapshotAgeMs: input.snapshotAgeMs,
      pullCompileAgeMs: input.compileAgeMs,
      pullLastCompileCompletedAt: input.lastCompileCompletedAt,
      pullLastEditAt: input.lastEditAt,
      pullDocVersionDistance: input.docVersionDistance,
      pullContextMatchReason: input.fields.contextMatchReason,
      pullTransientCause: input.fields.transientCause,
      ...input.followupData,
      pullPostFormatActive: input.postFormatData.active,
      pullPostFormatRequestId: input.postFormatData.requestId,
      pullPostFormatEditCount: input.postFormatData.editCount,
      pullPostFormatEditLength: input.postFormatData.editLength,
      pullPostFormatSinceMs: input.postFormatData.sinceMs,
      pullPostFormatSameResultIdAsBefore: input.postFormatData.sameResultIdAsBefore,
      pullPostFormatPreFormatDiagnosticsCount: input.postFormatData.preFormatDiagnosticsCount,
      pullPostFormatReturnedUnchanged: input.postFormatData.returnedUnchanged,
      pullPostFormatPaintRisk: input.postFormatData.paintRisk,
      pullCandidateSet: stringifyObservabilityJson(input.candidateSet),
      pullChosenCandidate: stringifyObservabilityJson(input.chosenCandidate),
      pullRejectedCandidates: stringifyObservabilityJson(input.rejectedCandidates),
      pullCandidateArbitrationReason: input.arbitrationReason,
      pullVisibleResultIdBefore: input.visibleResultIdBefore,
      pullVisibleResultIdAfter: input.visibleResultIdAfter,
      pullVisibleAuthorityBefore: input.visibleAuthorityBefore,
      pullVisibleAuthorityAfter: input.visibleAuthorityAfter,
      pullVisibleDocVersionBefore: input.visibleDocVersionBefore,
      pullVisibleDocVersionAfter: input.visibleDocVersionAfter,
      pullVisibleStateChanged: input.visibleStateChanged,
      pullProjectedReuseCount: input.projectedReuse.reuseCount,
      pullProjectedFirstServedAt: toIsoFromEpochMs(input.projectedReuse.firstServedAtMs),
      pullProjectedLastServedAt: toIsoFromEpochMs(input.projectedReuse.lastServedAtMs),
      pullProjectedTtlMs: input.projectedReuse.ttlMs,
      pullProjectedExpired: input.projectedReuse.expired,
      pullProjectedExpiryReason: input.projectedReuse.expiryReason,
      pullProjectedBaseResultId: input.projectedReuse.baseResultId,
      pullProjectedBaseDocVersion: input.projectedReuse.baseDocVersion,
      pullProjectedCurrentDocVersion: input.projectedReuse.currentDocVersion
    }, input.workspaceUri);
  }

  recordDecisionEvent(
    input.observability,
    input.settings,
    'pullDiagnostics.publish',
    input.fields.publishDecision,
    input.fields.stalenessReason,
    input.correlation,
    {
      authorityLevel: input.fields.authorityLevel,
      followupReason: input.fields.followupReason,
      ensureScheduledReason: input.fields.ensureScheduledReason,
      sourceOfTruth: input.fields.sourceOfTruth,
      contextMatchReason: input.fields.contextMatchReason,
      transientCause: input.fields.transientCause,
      source: input.source,
      kind: input.kind,
      resultCount: input.resultCount,
      resultAgeMs: input.resultAgeMs,
      requestAgeMs: input.requestAgeMs,
      snapshotAgeMs: input.snapshotAgeMs,
      compileAgeMs: input.compileAgeMs,
      lastCompileCompletedAt: input.lastCompileCompletedAt,
      lastEditAt: input.lastEditAt,
      docVersionDistance: input.docVersionDistance,
      cacheHit: input.cacheHit,
      contextMatched: input.contextMatched,
      postFormatActive: input.postFormatData.active,
      postFormatRequestId: input.postFormatData.requestId,
      postFormatEditCount: input.postFormatData.editCount,
      postFormatEditLength: input.postFormatData.editLength,
      postFormatSinceMs: input.postFormatData.sinceMs,
      postFormatSameResultIdAsBefore: input.postFormatData.sameResultIdAsBefore,
      postFormatPreFormatDiagnosticsCount: input.postFormatData.preFormatDiagnosticsCount,
      postFormatReturnedUnchanged: input.postFormatData.returnedUnchanged,
      postFormatPaintRisk: input.postFormatData.paintRisk,
      candidateSet: input.candidateSet,
      chosenCandidate: input.chosenCandidate,
      rejectedCandidates: input.rejectedCandidates,
      candidateArbitrationReason: input.arbitrationReason,
      visibleResultIdBefore: input.visibleResultIdBefore,
      visibleResultIdAfter: input.visibleResultIdAfter,
      visibleAuthorityBefore: input.visibleAuthorityBefore,
      visibleAuthorityAfter: input.visibleAuthorityAfter,
      visibleDocVersionBefore: input.visibleDocVersionBefore,
      visibleDocVersionAfter: input.visibleDocVersionAfter,
      visibleStateChanged: input.visibleStateChanged,
      projectedReuseCount: input.projectedReuse.reuseCount,
      projectedFirstServedAt: toIsoFromEpochMs(input.projectedReuse.firstServedAtMs),
      projectedLastServedAt: toIsoFromEpochMs(input.projectedReuse.lastServedAtMs),
      projectedTtlMs: input.projectedReuse.ttlMs,
      projectedExpired: input.projectedReuse.expired,
      projectedExpiryReason: input.projectedReuse.expiryReason,
      projectedBaseResultId: input.projectedReuse.baseResultId,
      projectedBaseDocVersion: input.projectedReuse.baseDocVersion,
      projectedCurrentDocVersion: input.projectedReuse.currentDocVersion,
      ...input.followupData
    }
  );

  if (input.postFormatData.active) {
    recordDecisionEvent(
      input.observability,
      input.settings,
      'postFormatDiagnostics',
      input.postFormatData.paintRisk ? 'paint_risk' : 'post_format_pull',
      input.fields.publishDecision,
      input.correlation,
      {
        postFormatActive: true,
        postFormatRequestId: input.postFormatData.requestId,
        postFormatEditCount: input.postFormatData.editCount,
        postFormatEditLength: input.postFormatData.editLength,
        postFormatSinceMs: input.postFormatData.sinceMs,
        postFormatSameResultIdAsBefore: input.postFormatData.sameResultIdAsBefore,
        postFormatPreFormatDiagnosticsCount: input.postFormatData.preFormatDiagnosticsCount,
        postFormatReturnedUnchanged: input.postFormatData.returnedUnchanged,
        postFormatPaintRisk: input.postFormatData.paintRisk,
        publishDecision: input.fields.publishDecision,
        sourceOfTruth: input.fields.sourceOfTruth,
        authorityLevel: input.fields.authorityLevel,
        source: input.source,
        kind: input.kind,
        resultCount: input.resultCount
      }
    );
  }

  recordMetric(
    input.observability,
    input.settings,
    'pullDiagnostics.durationMs',
    input.durationMs,
    input.correlation,
    {
      publishDecision: input.fields.publishDecision,
      authorityLevel: input.fields.authorityLevel
    }
  );
}
