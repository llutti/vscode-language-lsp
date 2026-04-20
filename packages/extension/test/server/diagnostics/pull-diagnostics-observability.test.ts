import { describe, expect, it } from 'vitest';
import { derivePullFollowupState, derivePullObservabilityFields } from '../../../src/server/diagnostics/pull-diagnostics-observability';

describe('pull diagnostics observability', () => {
  it('classifies persisted cache reuse as prefix snapshot with dirty follow-up', () => {
    const fields = derivePullObservabilityFields({
      kind: 'full',
      source: 'persisted-cache',
      resultCount: 3,
      cacheHit: true,
      ensureScheduled: true,
      contextMatched: true,
      stableUsed: false,
      isPrefix: true,
      isAuthoritative: false
    });

    expect(fields.publishDecision).toBe('retain_stable');
    expect(fields.stalenessReason).toBe('stable_snapshot_preferred');
    expect(fields.authorityLevel).toBe('projected');
    expect(fields.followupReason).toBe('awaiting_compile');
    expect(fields.ensureScheduledReason).toBe('dirty_snapshot');
    expect(fields.sourceOfTruth).toBe('prefix_snapshot');
    expect(fields.contextMatchReason).toBe('matched_context');
    expect(fields.transientCause).toBe('stable_snapshot_preferred');
  });

  it('classifies context projection follow-up explicitly', () => {
    const fields = derivePullObservabilityFields({
      kind: 'full',
      source: 'context-projected',
      resultCount: 0,
      cacheHit: true,
      ensureScheduled: true,
      contextMatched: true,
      stableUsed: true,
      isPrefix: true,
      isAuthoritative: false
    });

    expect(fields.publishDecision).toBe('suppress_transient');
    expect(fields.stalenessReason).toBe('prefix_result');
    expect(fields.followupReason).toBe('prefix_only');
    expect(fields.ensureScheduledReason).toBe('context_projection_only');
    expect(fields.sourceOfTruth).toBe('context_projection');
    expect(fields.contextMatchReason).toBe('matched_context');
    expect(fields.transientCause).toBe('prefix_projection');
  });

  it('does not mark authoritative full results as stale', () => {
    const fields = derivePullObservabilityFields({
      kind: 'full',
      source: 'fallback-compile',
      resultCount: 1,
      cacheHit: false,
      ensureScheduled: false,
      contextMatched: true,
      isPrefix: false,
      isAuthoritative: true
    });

    expect(fields.publishDecision).toBe('publish_full');
    expect(fields.stalenessReason).toBeNull();
    expect(fields.authorityLevel).toBe('authoritative');
    expect(fields.followupReason).toBeNull();
    expect(fields.ensureScheduledReason).toBeNull();
    expect(fields.sourceOfTruth).toBe('fresh_compile');
    expect(fields.contextMatchReason).toBe('matched_context');
    expect(fields.transientCause).toBe('none');
  });

  it('derives followup lifecycle states explicitly', () => {
    expect(derivePullFollowupState({ ensureScheduled: false })).toBe('not_scheduled');
    expect(derivePullFollowupState({ ensureScheduled: true })).toBe('scheduled');
    expect(derivePullFollowupState({ ensureScheduled: true, startedAtMs: 1 })).toBe('started');
    expect(derivePullFollowupState({ ensureScheduled: true, executedAtMs: 1 })).toBe('executed');
    expect(derivePullFollowupState({ ensureScheduled: true, finishedAtMs: 1 })).toBe('finished');
    expect(derivePullFollowupState({ ensureScheduled: true, resolvedAtMs: 1 })).toBe('resolved');
    expect(derivePullFollowupState({ ensureScheduled: true, skippedReason: 'cooldown' })).toBe('skipped');
  });
});
