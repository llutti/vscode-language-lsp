import { derivePullFollowupState, derivePullPerceivedState, type PullAuthorityLevel, type PullDiagnosticsKind, type PullDiagnosticsSource, type PullPublishDecision } from './pull-diagnostics-observability';

type PullFollowupOutcomeLike = {
  followupId?: string;
  generation?: number;
  scheduledAtMs?: number;
  startedAtMs?: number;
  executedAtMs?: number;
  finishedAtMs?: number;
  resolvedAtMs?: number;
  firstObservedAtMs?: number;
  firstObservedResultCount?: number;
  firstObservedSource?: string;
  firstObservedAuthoritative?: boolean;
  targetDocVersion?: number | null;
  targetDirtyStamp?: number | null;
  pendingCountAtSchedule?: number;
  resolvedReason?: string;
  supersededBy?: string;
  scheduleReason?: string;
  skippedReason?: string;
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
  authoritativeRearmScheduled?: boolean;
};

export function toIsoFromEpochMs(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return new Date(value).toISOString();
}

export function buildPullFollowupObservabilityData(
  outcome: PullFollowupOutcomeLike | null,
  authorityLevel: PullAuthorityLevel,
  publishDecision: PullPublishDecision
): {
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
} {
  const followupState = derivePullFollowupState({
    ensureScheduled: Boolean(outcome),
    startedAtMs: outcome?.startedAtMs ?? null,
    executedAtMs: outcome?.executedAtMs ?? null,
    finishedAtMs: outcome?.finishedAtMs ?? null,
    resolvedAtMs: outcome?.resolvedAtMs ?? null,
    skippedReason: outcome?.skippedReason ?? null
  });
  const pullTimeToFirstObservedMs = (outcome?.scheduledAtMs !== undefined && outcome.firstObservedAtMs !== undefined)
    ? Math.max(0, outcome.firstObservedAtMs - outcome.scheduledAtMs)
    : null;
  const pullTimeToAuthoritativeMs = (outcome?.scheduledAtMs !== undefined && outcome.resolvedAtMs !== undefined)
    ? Math.max(0, outcome.resolvedAtMs - outcome.scheduledAtMs)
    : null;
  return {
    pullFollowupState: followupState,
    pullFollowupScheduleReason: outcome?.scheduleReason ?? null,
    pullFollowupSkippedReason: outcome?.skippedReason ?? null,
    pullFollowupScheduledAt: toIsoFromEpochMs(outcome?.scheduledAtMs ?? null),
    pullFollowupStartedAt: toIsoFromEpochMs(outcome?.startedAtMs ?? null),
    pullFollowupExecutedAt: toIsoFromEpochMs(outcome?.executedAtMs ?? null),
    pullFollowupResolvedAt: toIsoFromEpochMs(outcome?.resolvedAtMs ?? null),
    pullFollowupFirstObservedAt: toIsoFromEpochMs(outcome?.firstObservedAtMs ?? null),
    pullFollowupFirstObservedCount: outcome?.firstObservedResultCount ?? null,
    pullFollowupFirstObservedSource: outcome?.firstObservedSource ?? null,
    pullFollowupFirstObservedAuthoritative: outcome?.firstObservedAuthoritative ?? null,
    pullTimeToFirstObservedMs,
    pullTimeToAuthoritativeMs,
    pullFollowupId: outcome?.followupId ?? null,
    pullFollowupGeneration: outcome?.generation ?? null,
    pullFollowupTargetDocVersion: outcome?.targetDocVersion ?? null,
    pullFollowupTargetDirtyStamp: outcome?.targetDirtyStamp ?? null,
    pullFollowupPendingCountAtSchedule: outcome?.pendingCountAtSchedule ?? null,
    pullFollowupResolvedReason: outcome?.resolvedReason ?? null,
    pullFollowupSupersededBy: outcome?.supersededBy ?? null,
    pullPerceivedState: derivePullPerceivedState({
      authorityLevel,
      publishDecision,
      followupState,
      resolvedAtMs: outcome?.resolvedAtMs ?? null
    })
  };
}

export function buildPostFormatPullObservabilityData(input: {
  uri?: string;
  docVersion?: number;
  resultId?: string;
  kind: PullDiagnosticsKind;
  source: PullDiagnosticsSource;
  publishDecision: PullPublishDecision;
  marker: FormatMarkerLike | null | undefined;
}): {
  active: boolean;
  requestId: string | null;
  editCount: number | null;
  editLength: number | null;
  sinceMs: number | null;
  sameResultIdAsBefore: boolean | null;
  preFormatDiagnosticsCount: number | null;
  returnedUnchanged: boolean;
  paintRisk: boolean;
} {
  if (!input.uri || typeof input.docVersion !== 'number') {
    return {
      active: false,
      requestId: null,
      editCount: null,
      editLength: null,
      sinceMs: null,
      sameResultIdAsBefore: null,
      preFormatDiagnosticsCount: null,
      returnedUnchanged: false,
      paintRisk: false
    };
  }
  const marker = input.marker;
  if (!marker) {
    return {
      active: false,
      requestId: null,
      editCount: null,
      editLength: null,
      sinceMs: null,
      sameResultIdAsBefore: null,
      preFormatDiagnosticsCount: null,
      returnedUnchanged: false,
      paintRisk: false
    };
  }
  const nowMs = Date.now();
  const active = input.docVersion > marker.baseVersion && nowMs <= marker.requestedAtMs + marker.telemetryWindowMs;
  const sameResultIdAsBefore = typeof input.resultId === 'string' && marker.preFormatResultId !== null
    ? input.resultId === marker.preFormatResultId
    : null;
  const returnedUnchanged = input.kind === 'unchanged';
  const paintRisk = active && Boolean(marker.editCount > 0) && (returnedUnchanged || sameResultIdAsBefore === true) && input.publishDecision !== 'publish_full';
  return {
    active,
    requestId: active ? marker.requestId : null,
    editCount: active ? marker.editCount : null,
    editLength: active ? marker.editLength : null,
    sinceMs: active ? Math.max(0, nowMs - marker.requestedAtMs) : null,
    sameResultIdAsBefore: active ? sameResultIdAsBefore : null,
    preFormatDiagnosticsCount: active ? marker.preFormatDiagnosticsCount : null,
    returnedUnchanged,
    paintRisk
  };
}

export function shouldForcePostFormatDiagnosticsRepublish(input: {
  uri?: string;
  docVersion?: number;
  resultId?: string;
  previousResultId?: string;
  marker: FormatMarkerLike | null | undefined;
}): boolean {
  if (!input.uri || typeof input.docVersion !== 'number' || typeof input.resultId !== 'string') {
    return false;
  }
  const marker = input.marker;
  if (!marker) return false;
  if (!(input.docVersion > marker.baseVersion)) return false;
  if (Date.now() > marker.requestedAtMs + marker.windowMs) return false;
  if (!(marker.editCount > 0)) return false;
  if (marker.preFormatResultId === null || marker.preFormatResultId !== input.resultId) return false;
  return input.previousResultId === input.resultId;
}
