import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('server root refactor contract', () => {
  it('keeps phase 1 helpers out of server.ts', () => {
    const serverPath = path.resolve(__dirname, '../../../src/server.ts');
    const source = fs.readFileSync(serverPath, 'utf8');

    const extractedFunctions = [
      'function toFsPath(',
      'function toFileUri(',
      'function normalizePathKey(',
      'function hashText(',
      'function isPathUnderRoot(',
      'function resolvePersistTarget(',
      'function rotateFileIfNeeded(',
      'function pruneRotatedFiles(',
      'function loadIgnoredDiagnosticsFromSettings(',
      'function loadDebugSettingsFromSettings(',
      'function loadFormatSettingsFromSettings(',
      'function loadFallbackDefaultSystemFromSettings(',
      'function completionItem(',
      'function snippetItem(',
      'function listaMethodCompletionItem(',
      'function listaPropertyCompletionItem(',
      'function getLinePrefix(',
      'function getWordAtPosition(',
      'function isInsideStringLiteral(',
      'function ensureInternalSignatures(',
      'function ensureInternalIndex(',
      'function lookupOfficialHoverSignatures(',
      'function invalidateHoverCacheOfficial(',
      'function invalidateHoverCacheCustomForContext(',
      'function invalidateHoverCacheCustomForFallback(',
      'function invalidateAllHoverCaches(',
      'function buildOfficialHoverCacheKey(',
      'function buildCustomHoverCacheKey(',
      'function getHoverFromCacheOrBuild(',
      'function getInternalOriginPrefix('
    ];

    const fallbackInternals = [
      'runtime.fallbackCache',
      'runtime.fallbackTimers',
      'const { fallbackCache, fallbackTimers } = fallbackValidationService.state',
      'const diagnosticsCommit = commitDiagnostics({',
      'const nextCache: ContextCache = {',
      'materializePullDiagnosticsSnapshotsForContext(context, nextCache, !effectivePrefixCompile);',
      'const semanticTokensCache = new Map<string, SemanticTokensCacheEntry>();',
      'const warmSemanticTokensCache = new WarmSemanticTokensCache(MAX_WARM_SEMANTIC_CACHE_ENTRIES);',
      'const semanticFollowupTimers = new Map<string, NodeJS.Timeout>();',
      'const semanticDrainTimers = new Map<string, NodeJS.Timeout>();',
      'function buildContextSemanticPayloadByFile(',
      'function prewarmSemanticTokensOnDidOpen(',
      'function refreshSemanticTokensCacheForContext(',
      'function scheduleSemanticTokensRefresh(',
      'function getContextCachedSemanticOccurrences(',
      'function getContextCachedSemanticPayload(',
      'function buildContextFileProjection(',
      'function getRecentPullDiagZeroObservation(',
      'function rememberRecentPullDiagZero(',
      'function clearRecentPullDiagZero(',
      'function materializePullDiagnosticsSnapshotsForContext(',
      'function scheduleDidOpenPullPrewarm(',
      'function shouldScheduleNonAuthoritativeFollowup(',
      'function shouldDeferColdDidOpenPull(',
      'function shouldWaitForAuthoritativeContext(',
      'function shouldRecheckTransientPublicApiZero(',
      'function shouldForceDirectCompileForZero(',
      'function scheduleStickyDiagnosticsFollowup(',
      'function scheduleDidOpenZeroAuthoritativeFollowup(',
      'function getAuthoritativeStableSnapshotOverride(',
      'function pickStickyPullDiagnosticsSnapshot(',
      'function getFastPathVisiblePullDiagnosticsState(',
      'function getPullDiagnosticsResultVersion(',
      'function shouldExpireProjectedPrefixReuse(',
      'type PullCandidateSnapshotForObservability = {',
      'function buildPullCandidateSnapshot(',
      'function getStickyFastPathTrace(',
      'function noteStickyFastPathReuse(',
      'function clearStickyFastPathReuse(',
      'function shouldUseStickyFastPath(',
      'function rememberVisiblePullDiagnosticsState(',
      'function stringifyObservabilityJson(',
      'const shouldForceDirectCompileForZero = (',
      'const pullDiagComputeInFlight = new Map<string, Promise<{',
      'pullDiagComputeInFlight.get(dedupKey)',
      'pullDiagComputeInFlight.set(dedupKey, computePromise)',
      'pullDiagComputeInFlight.delete(dedupKey)',
      "if (bootPhase === 'BOOTING' || refreshInProgress)",
      'const result = await compileFallbackDocument(doc, false);',
      "contextProjectionBranch = 'stableFresh'",
      "contextProjectionBranch = 'committedAuthoritative'",
      "contextProjectionBranch = 'committedPrefix'",
      'async function getSemanticTokensForDocument(doc: TextDocument): Promise<SemanticTokens>' 
    ];

    for (const fn of extractedFunctions) {
      expect(source.includes(fn)).toBe(false);
    }

    for (const marker of fallbackInternals) {
      expect(source.includes(marker)).toBe(false);
    }
  });
});
