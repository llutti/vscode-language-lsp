import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('pull observability contract', () => {
  it('does not expose formatter debug API in extension formatting layer', () => {
    const formattingPath = path.resolve(__dirname, '../../../src/formatting.ts');
    const source = fs.readFileSync(formattingPath, 'utf8');
    expect(source.includes('formatDocumentWithDebug')).toBe(false);
  });

  it('keeps required structured fields in pullDiagnostics.response', () => {
    const serverPath = path.resolve(__dirname, '../../../src/server.ts');
    const source = fs.readFileSync(serverPath, 'utf8');

    const requiredFields = [
      'kind',
      'source',
      'mode',
      'cacheHit',
      'ensureScheduled',
      'contextMatched',
      'diagnosticsCount',
      'dirtyStamp',
      'stableUsed',
      'isPrefix',
      'isAuthoritative'
    ];

    for (const field of requiredFields) {
      expect(source.includes(`${field}:`)).toBe(true);
    }
  });

  it('keeps required pull diagnostics metrics fields', () => {
    const source = [
      path.resolve(__dirname, '../../../src/server.ts'),
      path.resolve(__dirname, '../../../src/server/diagnostics/pull-diagnostics-observability-emitter.ts'),
      path.resolve(__dirname, '../../../src/server/diagnostics/pull-diagnostics-metrics-payload.ts'),
      path.resolve(__dirname, '../../../src/server/diagnostics/pull-diagnostics-observability-helpers.ts')
    ].map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n');

    const requiredMetricsFields = [
      'pullKind',
      'pullSource',
      'pullMode',
      'pullResultCount',
      'pullCacheHit',
      'pullEnsureScheduled',
      'pullContextMatched',
      'pullStableUsed',
      'pullIsPrefix',
      'pullIsAuthoritative',
      'pullDirtyStamp',
      'pullPublishDecision',
      'pullStalenessReason',
      'pullAuthorityLevel',
      'pullFollowupReason',
      'pullEnsureScheduledReason',
      'pullSourceOfTruth',
      'pullResultAgeMs',
      'pullRequestAgeMs',
      'pullDocVersionDistance',
      'pullContextMatchReason',
      'pullTransientCause',
      'pullFollowupState',
      'pullFollowupScheduleReason',
      'pullFollowupSkippedReason',
      'pullFollowupScheduledAt',
      'pullFollowupStartedAt',
      'pullFollowupExecutedAt',
      'pullFollowupResolvedAt',
      'pullFollowupFirstObservedAt',
      'pullFollowupFirstObservedCount',
      'pullFollowupFirstObservedSource',
      'pullFollowupFirstObservedAuthoritative',
      'pullTimeToFirstObservedMs',
      'pullTimeToAuthoritativeMs',
      'pullPerceivedState',
      'pullPostFormatActive',
      'pullPostFormatRequestId',
      'pullPostFormatEditCount',
      'pullPostFormatEditLength',
      'pullPostFormatSinceMs',
      'pullPostFormatSameResultIdAsBefore',
      'pullPostFormatPreFormatDiagnosticsCount',
      'pullPostFormatReturnedUnchanged',
      'pullPostFormatPaintRisk'
    ];

    for (const field of requiredMetricsFields) {
      expect(source.includes(`${field}:`)).toBe(true);
    }
  });

  it('keeps formatter and semantic token decision taxonomy fields', () => {
    const source = [
      path.resolve(__dirname, '../../../src/server.ts'),
      path.resolve(__dirname, '../../../src/server/diagnostics/pull-diagnostics-observability-emitter.ts'),
      path.resolve(__dirname, '../../../src/server/diagnostics/pull-diagnostics-observability-helpers.ts')
    ].map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n');

    const requiredDecisionFields = [
      'formatDecision',
      'formatReason',
      'embeddedSqlEnabled',
      'embeddedSqlAttemptCount',
      'embeddedSqlEligibleCount',
      'embeddedSqlAppliedCount',
      'embeddedSqlRejectedCount',
      'embeddedSqlErrorCount',
      'embeddedSqlPrimaryDecision',
      'embeddedSqlPrimaryReason',
      'sqlWrapperKind',
      'sqlSourceKind',
      'embeddedSqlDecision',
      'embeddedSqlReason',
      'tokenDecision',
      'tokenReason',
      'semanticTokens.cancelRatioSignal',
      'semanticTokens.reuseRatioSignal',
      'semanticTokens.dropRatioSignal',
      'semanticTokens.deltaRatioSignal',
      'semanticTokens.coalescedRatioSignal',
      'semanticTokens.remapRatioSignal',
      'embeddedSqlHighlightEnabled',
      'embeddedSqlHighlightCandidateCount',
      'embeddedSqlHighlightPublishedCount',
      'embeddedSqlHighlightSuppressedCount',
      'embeddedSqlHighlightPublishedRatioSignal',
      'embeddedSqlHighlightSuppressedRatioSignal',
      'embeddedSqlHighlight',
      'formatter.isNoOp',
      'formatter.skipRatioSignal',
      'formatter.cancelRatioSignal',
      'formatter.errorRatioSignal',
      'formatter.embeddedSqlAppliedRatioSignal',
      'formatter.embeddedSqlRejectedRatioSignal',
      'formatter.embeddedSqlErrorRatioSignal',
      'typing.latency',
      'postFormatDiagnostics',
      'postFormatPaintRisk',
      'postFormatReturnedUnchanged',
      'postFormatSameResultIdAsBefore',
      'shouldForcePostFormatDiagnosticsRepublish'
    ];

    for (const field of requiredDecisionFields) {
      expect(source.includes(field)).toBe(true);
    }
  });

  it('keeps context invalidation taxonomy and compile coalescing counters', () => {
    const source = [
      path.resolve(__dirname, '../../../src/server.ts'),
      path.resolve(__dirname, '../../../src/server/register-lifecycle-handlers.ts'),
      path.resolve(__dirname, '../../../src/server/compile/compile-orchestrator.ts'),
      path.resolve(__dirname, '../../../src/server/context/context-invalidation.ts')
    ].map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n');

    const requiredFields = [
      'contextInvalidation',
      'invalidationReason',
      'refresh_contexts',
      'watched_file_change',
      'coalescedCount',
      'cancelledObsoleteCount',
      'supersededCompileCount',
      'telemetryWindowMs',
      'preFormatResultId',
      'preFormatDiagnosticsCount'
    ];

    for (const field of requiredFields) {
      expect(source.includes(field)).toBe(true);
    }
  });

  it('exposes observability helpers required by stabilization stage 1/2', () => {
    const observabilityPath = path.resolve(__dirname, '../../../src/observability.ts');
    const source = fs.readFileSync(observabilityPath, 'utf8');

    const requiredHelpers = [
      'OBSERVABILITY_SCHEMA_VERSION',
      'createCorrelationContext',
      'recordMetric',
      'recordDecisionEvent'
    ];

    for (const helper of requiredHelpers) {
      expect(source.includes(helper)).toBe(true);
    }
  });
});
