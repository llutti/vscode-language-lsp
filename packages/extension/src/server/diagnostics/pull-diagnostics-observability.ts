export type PullDiagnosticsKind = 'full' | 'unchanged' | 'error';
export type PullDiagnosticsSource = 'public-api' | 'context-projected' | 'fallback-compile' | 'boot-empty' | 'persisted-cache';
export type PullPublishDecision = 'publish_full' | 'publish_unchanged' | 'retain_stable' | 'suppress_transient' | 'publish_error';
export type PullStalenessReason =
  | 'prefix_result'
  | 'compile_inflight'
  | 'context_mismatch'
  | 'dirtyStamp_regression'
  | 'fallback_bootstrap'
  | 'stable_snapshot_preferred';
export type PullAuthorityLevel = 'authoritative' | 'projected' | 'non_authoritative';
export type PullFollowupReason =
  | 'awaiting_compile'
  | 'awaiting_context_match'
  | 'prefix_only'
  | 'bootstrap_state'
  | 'retry_after_stable';
export type PullEnsureScheduledReason =
  | 'missing_context'
  | 'dirty_snapshot'
  | 'non_authoritative_result'
  | 'compile_inflight'
  | 'version_mismatch'
  | 'context_projection_only'
  | 'post_edit_revalidation'
  | 'bootstrap_warmup';
export type PullSourceOfTruth =
  | 'fresh_compile'
  | 'stable_snapshot'
  | 'prefix_snapshot'
  | 'context_projection'
  | 'empty_boot';
export type PullContextMatchReason =
  | 'matched_context'
  | 'file_without_context'
  | 'context_not_ready';
export type PullTransientCause =
  | 'none'
  | 'context_not_ready'
  | 'compile_pending'
  | 'prefix_projection'
  | 'bootstrap_empty'
  | 'stable_snapshot_preferred';
export type PullFollowupState =
  | 'not_scheduled'
  | 'scheduled'
  | 'started'
  | 'executed'
  | 'finished'
  | 'resolved'
  | 'skipped';

export type PullObservabilityInput = {
  kind: PullDiagnosticsKind;
  source: PullDiagnosticsSource;
  resultCount: number;
  cacheHit: boolean;
  ensureScheduled: boolean;
  contextMatched: boolean;
  stableUsed?: boolean;
  isPrefix?: boolean;
  isAuthoritative?: boolean;
  ensureScheduledReason?: PullEnsureScheduledReason | null;
  publishDecision?: PullPublishDecision;
  stalenessReason?: PullStalenessReason | null;
  authorityLevel?: PullAuthorityLevel;
  followupReason?: PullFollowupReason | null;
  sourceOfTruth?: PullSourceOfTruth;
};

export type PullObservabilityFields = {
  publishDecision: PullPublishDecision;
  stalenessReason: PullStalenessReason | null;
  authorityLevel: PullAuthorityLevel;
  followupReason: PullFollowupReason | null;
  ensureScheduledReason: PullEnsureScheduledReason | null;
  sourceOfTruth: PullSourceOfTruth;
  contextMatchReason: PullContextMatchReason;
  transientCause: PullTransientCause;
};

export type PullPerceivedState =
  | 'authoritative'
  | 'resolved'
  | 'awaiting_followup'
  | 'stable_retained'
  | 'transient_hidden'
  | 'projected'
  | 'untracked';

export function derivePullObservabilityFields(input: PullObservabilityInput): PullObservabilityFields {
  const authorityLevel = input.authorityLevel ?? (
    input.isAuthoritative
      ? 'authoritative'
      : (input.isPrefix ? 'projected' : 'non_authoritative')
  );
  const publishDecision = input.publishDecision ?? (
    input.kind === 'error'
      ? 'publish_error'
      : input.kind === 'unchanged'
        ? 'publish_unchanged'
        : authorityLevel === 'authoritative'
          ? 'publish_full'
          : (input.resultCount > 0 ? 'retain_stable' : 'suppress_transient')
  );
  const stalenessReason = input.stalenessReason ?? (
    !input.contextMatched
      ? 'context_mismatch'
      : authorityLevel === 'authoritative'
        ? null
        : input.source === 'context-projected'
          ? 'prefix_result'
          : input.source === 'boot-empty'
            ? 'fallback_bootstrap'
            : input.source === 'persisted-cache'
              ? 'stable_snapshot_preferred'
              : 'compile_inflight'
  );
  const followupReason = input.followupReason ?? (
    input.ensureScheduled
      ? (!input.contextMatched
          ? 'awaiting_context_match'
          : input.source === 'context-projected'
            ? 'prefix_only'
            : input.source === 'boot-empty'
              ? 'bootstrap_state'
              : 'awaiting_compile')
      : null
  );
  const ensureScheduledReason = input.ensureScheduled
    ? (input.ensureScheduledReason ?? deriveEnsureScheduledReason(input))
    : null;
  const sourceOfTruth = input.sourceOfTruth ?? deriveSourceOfTruth(input);
  const contextMatchReason = deriveContextMatchReason(input);
  const transientCause = deriveTransientCause({
    publishDecision,
    stalenessReason,
    contextMatchReason,
    sourceOfTruth,
    ensureScheduled: input.ensureScheduled,
    authorityLevel
  });

  return {
    publishDecision,
    stalenessReason,
    authorityLevel,
    followupReason,
    ensureScheduledReason,
    sourceOfTruth,
    contextMatchReason,
    transientCause
  };
}

export function derivePullFollowupState(input: {
  ensureScheduled: boolean;
  startedAtMs?: number | null;
  executedAtMs?: number | null;
  finishedAtMs?: number | null;
  resolvedAtMs?: number | null;
  skippedReason?: string | null;
}): PullFollowupState {
  if (!input.ensureScheduled) return 'not_scheduled';
  if (input.skippedReason) return 'skipped';
  if (input.resolvedAtMs !== null && input.resolvedAtMs !== undefined) return 'resolved';
  if (input.finishedAtMs !== null && input.finishedAtMs !== undefined) return 'finished';
  if (input.executedAtMs !== null && input.executedAtMs !== undefined) return 'executed';
  if (input.startedAtMs !== null && input.startedAtMs !== undefined) return 'started';
  return 'scheduled';
}

export function derivePullPerceivedState(input: {
  authorityLevel: PullAuthorityLevel;
  publishDecision: PullPublishDecision;
  followupState: PullFollowupState;
  resolvedAtMs?: number | null;
}): PullPerceivedState {
  if (input.authorityLevel === 'authoritative') return 'authoritative';
  if (input.resolvedAtMs !== null && input.resolvedAtMs !== undefined) return 'resolved';
  if (
    input.followupState === 'scheduled'
    || input.followupState === 'started'
    || input.followupState === 'executed'
    || input.followupState === 'finished'
  ) {
    return 'awaiting_followup';
  }
  if (input.publishDecision === 'retain_stable') return 'stable_retained';
  if (input.publishDecision === 'suppress_transient') return 'transient_hidden';
  if (input.authorityLevel === 'projected') return 'projected';
  return 'untracked';
}

function deriveEnsureScheduledReason(input: PullObservabilityInput): PullEnsureScheduledReason {
  if (!input.contextMatched) return 'missing_context';
  if (input.source === 'boot-empty') return 'bootstrap_warmup';
  if (input.source === 'context-projected') return 'context_projection_only';
  if (input.source === 'persisted-cache' && input.cacheHit) return 'dirty_snapshot';
  if (input.isPrefix) return 'non_authoritative_result';
  return 'compile_inflight';
}

function deriveSourceOfTruth(input: PullObservabilityInput): PullSourceOfTruth {
  if (input.source === 'boot-empty') return 'empty_boot';
  if (input.source === 'persisted-cache') {
    return input.stableUsed ? 'stable_snapshot' : 'prefix_snapshot';
  }
  if (input.source === 'context-projected') return input.isAuthoritative ? 'stable_snapshot' : 'context_projection';
  return input.isAuthoritative ? 'fresh_compile' : 'prefix_snapshot';
}

function deriveContextMatchReason(input: PullObservabilityInput): PullContextMatchReason {
  if (input.contextMatched) return 'matched_context';
  return input.source === 'boot-empty' ? 'context_not_ready' : 'file_without_context';
}

function deriveTransientCause(input: {
  publishDecision: PullPublishDecision;
  stalenessReason: PullStalenessReason | null;
  contextMatchReason: PullContextMatchReason;
  sourceOfTruth: PullSourceOfTruth;
  ensureScheduled: boolean;
  authorityLevel: PullAuthorityLevel;
}): PullTransientCause {
  if (input.publishDecision === 'publish_full' || input.publishDecision === 'publish_unchanged' || input.publishDecision === 'publish_error') {
    return 'none';
  }
  if (input.contextMatchReason !== 'matched_context') return 'context_not_ready';
  if (input.stalenessReason === 'fallback_bootstrap' || input.sourceOfTruth === 'empty_boot') return 'bootstrap_empty';
  if (input.stalenessReason === 'stable_snapshot_preferred' || input.sourceOfTruth === 'stable_snapshot') return 'stable_snapshot_preferred';
  if (input.stalenessReason === 'prefix_result' || input.authorityLevel === 'projected') return 'prefix_projection';
  if (input.ensureScheduled || input.stalenessReason === 'compile_inflight') return 'compile_pending';
  return 'none';
}
