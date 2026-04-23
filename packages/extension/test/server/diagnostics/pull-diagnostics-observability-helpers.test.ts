import { describe, expect, it } from 'vitest';
import {
  buildPostFormatPullObservabilityData,
  buildPullFollowupObservabilityData,
  shouldForcePostFormatDiagnosticsRepublish
} from '../../../src/server/diagnostics/pull-diagnostics-observability-helpers';

describe('pull diagnostics observability helpers', () => {
  it('builds followup observability timings', () => {
    const data = buildPullFollowupObservabilityData({
      followupId: 'f1',
      generation: 2,
      scheduledAtMs: 100,
      firstObservedAtMs: 130,
      resolvedAtMs: 160,
      scheduleReason: 'didOpenZero'
    }, 'projected', 'retain_stable');

    expect(data.pullTimeToFirstObservedMs).toBe(30);
    expect(data.pullTimeToAuthoritativeMs).toBe(60);
    expect(data.pullFollowupScheduleReason).toBe('didOpenZero');
  });

  it('detects active post-format paint risk', () => {
    const now = Date.now();
    const data = buildPostFormatPullObservabilityData({
      uri: 'file:///a.txt',
      docVersion: 3,
      resultId: '3:abc',
      kind: 'unchanged',
      source: 'context-projected',
      publishDecision: 'retain_stable',
      marker: {
        requestId: 'r1',
        baseVersion: 2,
        requestedAtMs: now - 10,
        telemetryWindowMs: 1000,
        windowMs: 500,
        editCount: 1,
        editLength: 5,
        preFormatResultId: '3:abc',
        preFormatDiagnosticsCount: 2
      }
    });

    expect(data.active).toBe(true);
    expect(data.paintRisk).toBe(true);
  });

  it('forces republish only when post-format reused the same result id', () => {
    const now = Date.now();
    expect(shouldForcePostFormatDiagnosticsRepublish({
      uri: 'file:///a.txt',
      docVersion: 3,
      resultId: '3:abc',
      previousResultId: '3:abc',
      marker: {
        requestId: 'r1',
        baseVersion: 2,
        requestedAtMs: now - 10,
        telemetryWindowMs: 1000,
        windowMs: 500,
        editCount: 1,
        editLength: 5,
        preFormatResultId: '3:abc',
        preFormatDiagnosticsCount: 2
      }
    })).toBe(true);
  });
});
