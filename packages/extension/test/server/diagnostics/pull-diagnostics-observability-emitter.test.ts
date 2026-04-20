import { describe, expect, it, vi } from 'vitest';
import { emitPullDiagnosticsObservability } from '../../../src/server/diagnostics/pull-diagnostics-observability-emitter';

describe('emitPullDiagnosticsObservability', () => {
  it('emits metrics payload, decisions and duration metric for pull diagnostics', () => {
    const log = vi.fn();
    const observability = { log };
    const recordMetrics = vi.fn();

    emitPullDiagnosticsObservability({
      observability,
      settings: { enabled: true, level: 'debug' },
      correlation: { contextKey: 'ctx', contextName: 'Ctx', uri: 'file:///tmp/a.txt', docVersion: 12, phase: 'pullDiagnostics' },
      metricsEnabled: true,
      workspaceUri: 'file:///workspace',
      recordMetrics,
      contextKey: 'ctx',
      contextName: 'Ctx',
      durationMs: 42,
      kind: 'fresh',
      source: 'context',
      mode: 'pull',
      resultCount: 3,
      cacheHit: false,
      ensureScheduled: true,
      contextMatched: true,
      stableUsed: false,
      isPrefix: false,
      isAuthoritative: true,
      dirtyStamp: 9,
      fields: {
        publishDecision: 'publish_full',
        stalenessReason: null,
        authorityLevel: 'authoritative',
        followupReason: 'sticky_edit_burst',
        ensureScheduledReason: 'followup_needed',
        sourceOfTruth: 'fresh_compile',
        contextMatchReason: 'context_hit',
        transientCause: null
      },
      resultAgeMs: 10,
      requestAgeMs: 42,
      snapshotAgeMs: 4,
      compileAgeMs: 8,
      lastCompileCompletedAt: '2026-04-01T00:00:00.000Z',
      lastEditAt: '2026-04-01T00:00:01.000Z',
      docVersionDistance: 0,
      followupData: {
        pullFollowupState: 'scheduled',
        pullFollowupScheduleReason: 'sticky_edit_burst',
        pullFollowupSkippedReason: null,
        pullFollowupScheduledAt: '2026-04-01T00:00:02.000Z',
        pullFollowupStartedAt: null,
        pullFollowupExecutedAt: null,
        pullFollowupResolvedAt: null,
        pullFollowupFirstObservedAt: null,
        pullFollowupFirstObservedCount: null,
        pullFollowupFirstObservedSource: null,
        pullFollowupFirstObservedAuthoritative: null,
        pullTimeToFirstObservedMs: null,
        pullTimeToAuthoritativeMs: null,
        pullPerceivedState: 'authoritative_pending_followup',
        pullFollowupId: 'f1',
        pullFollowupGeneration: 1,
        pullFollowupTargetDocVersion: 12,
        pullFollowupTargetDirtyStamp: 9,
        pullFollowupPendingCountAtSchedule: 1,
        pullFollowupResolvedReason: null,
        pullFollowupSupersededBy: null
      },
      postFormatData: {
        active: true,
        requestId: 'fmt-1',
        editCount: 2,
        editLength: 10,
        sinceMs: 20,
        sameResultIdAsBefore: true,
        preFormatDiagnosticsCount: 4,
        returnedUnchanged: false,
        paintRisk: true
      },
      candidateSet: [{ source: 'current' }, { source: 'stable' }],
      chosenCandidate: { source: 'current' },
      rejectedCandidates: [{ source: 'stable' }],
      arbitrationReason: 'authoritative_candidate_promoted',
      visibleResultIdBefore: '11:hash',
      visibleResultIdAfter: '12:hash',
      visibleAuthorityBefore: 'projected',
      visibleAuthorityAfter: 'authoritative',
      visibleDocVersionBefore: 11,
      visibleDocVersionAfter: 12,
      visibleStateChanged: true,
      projectedReuse: {
        reuseCount: 2,
        firstServedAtMs: Date.UTC(2026, 3, 1, 0, 0, 0),
        lastServedAtMs: Date.UTC(2026, 3, 1, 0, 0, 5),
        ttlMs: 150,
        expired: false,
        expiryReason: null,
        baseResultId: '11:hash',
        baseDocVersion: 11,
        currentDocVersion: 12
      }
    });

    expect(recordMetrics).toHaveBeenCalledTimes(1);
    expect(recordMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'pullDiagnostics',
        pullCandidateSet: JSON.stringify([{ source: 'current' }, { source: 'stable' }]),
        pullVisibleAuthorityBefore: 'projected',
        pullVisibleAuthorityAfter: 'authoritative'
      }),
      'file:///workspace'
    );

    expect(log).toHaveBeenCalledTimes(3);
    expect(log).toHaveBeenNthCalledWith(
      1,
      { enabled: true, level: 'debug' },
      'debug',
      'decision.pullDiagnostics.publish',
      expect.objectContaining({
        span: 'pullDiagnostics',
        data: expect.objectContaining({
          event: 'pullDiagnostics.publish',
          decision: 'publish_full',
          chosenCandidate: { source: 'current' }
        })
      })
    );
    expect(log).toHaveBeenNthCalledWith(
      2,
      { enabled: true, level: 'debug' },
      'debug',
      'decision.postFormatDiagnostics',
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'postFormatDiagnostics',
          decision: 'paint_risk',
          reason: 'publish_full'
        })
      })
    );
    expect(log).toHaveBeenNthCalledWith(
      3,
      { enabled: true, level: 'debug' },
      'debug',
      'metric.pullDiagnostics.durationMs',
      expect.objectContaining({
        data: expect.objectContaining({
          metric: 'pullDiagnostics.durationMs',
          value: 42,
          authorityLevel: 'authoritative'
        })
      })
    );
  });
});
