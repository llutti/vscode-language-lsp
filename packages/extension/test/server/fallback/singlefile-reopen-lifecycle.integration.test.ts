import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createPullDiagnosticsService } from '../../../src/server/diagnostics/pull-diagnostics-service';
import { createSemanticRuntime } from '../../../src/server/semantics/semantic-runtime';
import { buildWarmSemanticCacheKey } from '../../../src/server/semantics/semantic-warm-cache';
import type { PullDiagnosticsRuntime } from '../../../src/server/diagnostics/pull-diagnostics-runtime';
import type { ContextCache } from '../../../src/server/server-runtime';

function createDocument(uri: string, version: number, text: string): TextDocument {
  return TextDocument.create(uri, 'lsp', version, text);
}

function createPullRuntime(): PullDiagnosticsRuntime {
  const persistCache = {
    getValidated: () => null,
    set: () => {},
    flush: async () => {}
  };
  return {
    pullDiagCache: new Map(),
    pullDiagLastItems: new Map(),
    pullDiagPersistRevisionByContext: new Map(),
    pullDiagPrewarmByUri: new Map(),
    pullDiagPrewarmTimers: new Map(),
    pullDiagPrewarmInFlight: new Map(),
    pullDiagDirtyStampByContext: new Map(),
    pullDiagStableByUri: new Map(),
    pullDiagLastNonEmptyByUri: new Map(),
    resolveWorkspaceRoot: () => '/workspace',
    resolveWorkspaceKey: () => '/workspace',
    resolvePersistPath: () => '/workspace/.lsp-cache/pull-diagnostics-v2.json',
    getPersistCache: () => persistCache as never,
    ensurePersistCacheLoaded: async () => {},
    getPersistContextRevision: () => 0,
    bumpPersistContextRevision: () => 1,
    buildContextSignature: () => 'sig',
    computeDocHash: (doc) => `v${doc.version}:${doc.getText().length}`,
    bumpDirtyStamp: () => 1
  };
}

describe('singlefile/fallback reopen lifecycle integration', () => {
  it('clears pull-diagnostics residual state for a closed URI before the same URI is reopened', () => {
    const uri = 'file:///tmp/lixo.lspt';
    const doc = createDocument(uri, 1, `Definir Numero n;
n = ;
`);
    const runtime = createPullRuntime();
    const service = createPullDiagnosticsService({
      documents: new Map([[uri, doc]]),
      contextDocs: new Map(),
      runtime,
      toFsPath: (value) => value.replace('file://', ''),
      normalizePathKey: (value) => value,
      getIgnoredForContext: () => new Set(),
      applyIgnoreIdsToLspDiagnostics: (diagnostics) => diagnostics,
      projectCompilerDiagnosticsForFile: () => [],
      getPersistCache: () => ({ getValidated: () => null, set: () => {}, flush: async () => {} }),
      resolveWorkspaceKey: () => '/workspace',
      buildContextSignature: () => 'sig',
      computeDocHash: (currentDoc) => `v${currentDoc.version}:${currentDoc.getText().length}`,
      getPersistContextRevision: () => 0,
      getDirtyStamp: () => 1,
      prewarmDelayMs: 25,
      shouldSkipDidOpenPrewarm: () => false,
      prewarmDiagnostics: async () => [],
      sendDebugLog: () => {},
      zeroObservationWindowMs: 250,
      getLastFullCompileCommittedAt: () => undefined,
      getLastDidChangeAtByUri: () => 0,
      hasRecentEditBurst: () => false,
      recentCommitWindowMs: 250,
      didOpenZeroFollowupWindowMs: 250,
      getContextCache: () => undefined,
      hasActiveContextCompileSignal: () => false,
      logContextProjectionSelected: () => {},
      hasPendingOrRecentFollowupForUri: () => false,
      shouldScheduleFollowup: () => false,
      scheduleFollowup: () => {},
      computeDiagnosticsDirectlyForPull: async () => [],
      getIgnoredForWorkspace: () => new Set(),
      compileFallbackDocument: async () => ({ diagnostics: [] }),
      toLspDiagnostic: (diag) => ({ ...diag, range: diag.range, message: diag.message }),
      schedulePullDiagnosticsRefresh: () => {}
    });

    runtime.pullDiagCache.set(uri, { resultId: 'r1', hash: 'h1' });
    runtime.pullDiagLastItems.set(uri, []);
    runtime.pullDiagPrewarmByUri.set(uri, { version: 1, diagnostics: [] });
    runtime.pullDiagStableByUri.set(uri, {
      contextKey: '__singlefile__',
      dirtyStamp: 1,
      resultId: 'stable-1',
      hash: 'stable-hash',
      diagnostics: [],
      reportedAtMs: Date.now()
    });
    runtime.pullDiagLastNonEmptyByUri.set(uri, {
      contextKey: '__singlefile__',
      dirtyStamp: 1,
      resultId: 'non-empty-1',
      hash: 'non-empty-hash',
      diagnostics: [{
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 }
        },
        message: 'erro',
        severity: 1
      }],
      reportedAtMs: Date.now()
    });
    service.rememberRecentZero(uri, {
      contextKey: '__singlefile__',
      docHash: 'doc-hash',
      docVersion: 1,
      observedAtMs: Date.now(),
      source: 'fallback-compile'
    });
    service.state.pullDiagComputeInFlight.set(`${uri}:1`, Promise.resolve({
      diagnostics: [],
      source: 'fallback-compile',
      cacheHit: false,
      contextMatched: false,
      contextKey: '__singlefile__',
      contextName: 'SingleFile',
      dirtyStamp: null,
      isPrefix: false,
      isAuthoritative: true
    }));

    service.disposeDocument(uri);

    expect(runtime.pullDiagCache.has(uri)).toBe(false);
    expect(runtime.pullDiagLastItems.has(uri)).toBe(false);
    expect(runtime.pullDiagPrewarmByUri.has(uri)).toBe(false);
    expect(runtime.pullDiagStableByUri.has(uri)).toBe(false);
    expect(runtime.pullDiagLastNonEmptyByUri.has(uri)).toBe(false);
    expect(service.getRecentZeroObservation(uri)).toBeNull();
    expect(service.state.pullDiagComputeInFlight.size).toBe(0);
  });

  it('preserves warm semantic tokens on close while clearing active semantic state for the reopened URI', () => {
    const uri = 'file:///tmp/lixo.lspt';
    const filePath = '/tmp/lixo.lspt';
    const closedDoc = createDocument(uri, 1, `Definir Numero n;
n = 1;
`);
    const reopenedDoc = createDocument(uri, 2, `Definir Numero n;
n = 2;
`);
    const documents = new Map([[uri, closedDoc]]);
    const contextCache = new Map<string, ContextCache>();
    const semanticRuntime = createSemanticRuntime({
      documents,
      contextCache,
      maxWarmEntries: 5,
      semanticTokenEditHistory: {
        get: () => undefined,
        delete: () => {},
        pruneToVersion: () => {}
      },
      toFsPath: (value) => value.replace('file://', ''),
      findContextForFile: () => null,
      normalizePathKey: (value) => value,
      getWindowFocused: () => true,
      sendLog: () => {},
      semanticRefreshScheduler: { schedule: () => {} },
      getObservabilitySettingsForFile: () => ({}),
      observability: { log: () => {} },
      isEmbeddedSqlHighlightEnabled: () => false,
      getEmbeddedSqlDialect: () => 'sql',
      didOpenReceivedAtByUri: new Map(),
      didOpenFirstSemanticPublishedByUri: new Set(),
      recordSemanticDecision: () => {},
      fullCompileQueuedByContext: new Map(),
      fullCompileInFlightByContext: new Set(),
      fullCompileLastCommittedAtByContext: new Map(),
      waitForNextContextCompile: async () => false,
      getLastDidChangeAt: () => undefined,
      typingDrainDelayMs: 25,
      typingSemanticBudgetFiles: 8,
      coalesceDelayMs: 25,
      typingStableWindowMs: 25,
      staleReuseWindowMs: 25,
      postFullSuppressMs: 25,
      compileFallbackDocument: async () => ({ semanticsByFile: new Map() }),
      publicCompiler: {
        ensureCompiledForFile: async () => ({}),
        getSemanticsForFile: () => undefined
      },
      buildOverridesForContext: () => undefined,
      forceRefreshFilesByContext: new Set()
    });

    semanticRuntime.setCacheEntry(uri, 1, [1, 2, 3, 4]);
    semanticRuntime.state.semanticLatestRequestedVersionByUri.set(uri, 1);
    semanticRuntime.state.semanticTokensLastSentByUri.set(uri, { resultId: '1:abcd', data: [1, 2, 3, 4] });
    semanticRuntime.state.semanticTokensInFlight.set(`${uri}:1`, Promise.resolve({ data: [], resultId: '1:rid' }));

    semanticRuntime.disposeDocument({
      uri,
      doc: closedDoc,
      filePath,
      contextKey: null
    });

    expect(semanticRuntime.state.semanticTokensCache.has(uri)).toBe(false);
    expect(semanticRuntime.state.semanticLatestRequestedVersionByUri.has(uri)).toBe(false);
    expect(semanticRuntime.state.semanticTokensLastSentByUri.has(uri)).toBe(false);
    expect(semanticRuntime.state.semanticTokensInFlight.size).toBe(0);

    const warmKey = buildWarmSemanticCacheKey(filePath, null, closedDoc.getText());
    expect(semanticRuntime.state.warmSemanticTokensCache.get(warmKey)?.data).toEqual([1, 2, 3, 4]);

    documents.set(uri, reopenedDoc);
    const reopenedWarmKey = buildWarmSemanticCacheKey(filePath, null, reopenedDoc.getText());
    expect(semanticRuntime.state.warmSemanticTokensCache.get(reopenedWarmKey)).toBeUndefined();
    expect(semanticRuntime.state.warmSemanticTokensCache.get(warmKey)?.data).toEqual([1, 2, 3, 4]);
  });

  it('keeps the lifecycle contract explicit for didOpen -> didClose -> didOpen of the same fallback URI', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const repoRoot = path.join(__dirname, '..', '..', '..', 'src');
    const lifecycleSource = fs.readFileSync(path.join(repoRoot, 'server', 'register-lifecycle-handlers.ts'), 'utf8');

    expect(lifecycleSource.includes('const nextOpenGeneration = (runtime.didOpenGenerationByUri.get(doc.uri) ?? 0) + 1;')).toBe(true);
    expect(lifecycleSource.includes('runtime.didCloseObservedGenerationByUri.set(params.textDocument.uri, closingOpenGeneration);')).toBe(true);
    expect(lifecycleSource.includes('clearPullDiagnosticsResidualState(params.textDocument.uri, closedContext?.key ?? null);')).toBe(true);
    expect(lifecycleSource.includes('semanticRuntime.disposeDocument({')).toBe(true);
    expect(lifecycleSource.includes('connectionSendDiagnostics(params.textDocument.uri, []);')).toBe(true);
    expect(lifecycleSource.includes('sendDebugLog(filePath, `didOpen: fallback uri=${doc.uri} openGeneration=${runtime.didOpenGenerationByUri.get(doc.uri) ?? 0}`);')).toBe(true);
  });
});
