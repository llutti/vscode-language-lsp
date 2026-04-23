import { performance } from 'node:perf_hooks';
import { applyIgnoreIds } from '../diagnostics/diagnostics-ignore';
import { commitDiagnostics } from '../diagnostics/diagnostics-commit';
import { isTypingCompileReason } from '../../compile-scheduler-policy';
import type {
  CompileResult,
  CompileStats,
  SemanticOccurrence,
  SymbolInfo
} from '@lsp/compiler';
import type { Diagnostic } from 'vscode-languageserver/node';
import type {
  CompilerDiagnostic,
  ContextCache,
  ResolvedContext,
  SemanticPayloadCacheEntry
} from '../server-runtime';
import type { ValidationCycle } from './validation-cycle';

export type CompileResultSizeBreakdown = {
  diagnostics: number;
  files: number;
  symbols: number;
  semanticsByFile: number;
  stats: number;
  total: number;
};

export type CompileResultApplicationPerfTelemetry = {
  queueWaitMs: number;
  workerPayloadBytes: number;
  workerResultBytes?: number;
  workerResultBytesBreakdown?: CompileResultSizeBreakdown;
  uri?: string;
  includeSemantics?: boolean;
  contextGeneration?: number;
};

type CompileStatsPerf = CompileStats & {
  semanticFirstChangedIndex?: number | null;
  semanticFirstChangedReason?: string | null;
  semanticFirstMismatchPath?: string | null;
  semanticFirstMismatchPrevKey?: string | null;
  semanticFirstMismatchCurrKey?: string | null;
  semanticFileOrderOrListChanged?: boolean | null;
  semanticBaseChangedCount?: number | null;
  semanticDirtyCount?: number | null;
  semanticDeclChangedCount?: number | null;
  semanticBodyOnlyChangedCount?: number | null;
  persistedTextCacheLoaded?: boolean | null;
  persistedTextCacheEntries?: number | null;
  persistedTextCacheAddedThisRun?: number | null;
  persistedTextCacheHits?: number | null;
  persistedTextCacheMissNoEntry?: number | null;
  persistedTextCacheMissStatMismatch?: number | null;
  persistedTextCacheFile?: string | null;
  persistedTextCacheFirstKey?: string | null;
  fullFilesCount?: number | null;
  selectedFilesCount?: number | null;
  isFullContextSelected?: boolean | null;
  reusedFiles?: number | null;
  reparsedFiles?: number | null;
  reanalyzedFiles?: number | null;
  reusedSymbols?: number | null;
  contextResolveMs?: number | null;
  textLoadMs?: number | null;
  incrementalReuseMs?: number | null;
  bindMs?: number | null;
  analyzeMs?: number | null;
  indexLookupMs?: number | null;
};

export function createCompileResultApplication(input: {
  getObservabilitySettingsForFile(filePath: string | null): unknown;
  observability: {
    span(settings: unknown, name: string, payload: Record<string, unknown>): () => void;
  };
  getIgnoredForContext(context: ResolvedContext): Set<string>;
  sendLog(level: 'info' | 'warn' | 'debug', message: string, metadata?: Record<string, unknown>, filePath?: string | null): void;
  sendDebugLog(filePath: string | null, message: string, metadata?: Record<string, unknown>): void;
  groupDiagnostics(diagnostics: CompilerDiagnostic[]): Map<string, Diagnostic[]>;
  getContextCache(contextKey: string): ContextCache | undefined;
  setContextCache(contextKey: string, cache: ContextCache): void;
  shouldLogCompilerBuildInfo(): boolean;
  readCompilerBuildInfo(): { version: string; buildTime: string; entry: string };
  schedulePullDiagnosticsRefresh(reason: string, workspaceUri?: string, delayMs?: number): void;
  normalizePathKey(filePath: string): string;
  getActiveDocumentUri(): string | null;
  toFsPath(uri: string): string;
  buildContextSemanticPayloadByFile(
    context: ResolvedContext,
    semanticsByFile: Map<string, SemanticOccurrence[]>,
    previous?: Map<string, SemanticPayloadCacheEntry>
  ): Map<string, SemanticPayloadCacheEntry>;
  bumpPullDiagPersistContextRevision(contextKey: string): number;
  getPullDiagPersistCache(): { invalidateContext(contextKey: string): void };
  materializePullDiagnosticsSnapshotsForContext(context: ResolvedContext, cache: ContextCache, authoritative: boolean): void;
  clearPendingPullDiagnosticsGlobalFollowup(contextKey: string, uri?: string): void;
  invalidateHoverCacheCustomForContext(contextKey: string): void;
  getContextDocCount(contextKey: string): number;
  refreshSemanticTokensCacheForContext(context: ResolvedContext): void;
  scheduleSemanticTokensRefresh(reason: string, delayMs?: number): void;
  recordMetrics(entry: Record<string, unknown>, workspaceUri?: string): void;
  maybePersistCompilePerfSnapshot(workspaceUri?: string, triggerContextKey?: string): void;
  recordTypingLatency(input: {
    context: ResolvedContext;
    trigger: string;
    uri?: string;
    docVersion?: number;
    typingLatencyMs: number;
    lastEditAtIso: string;
  }): void;
  updateAdaptiveTypingDelay(contextKey: string, compileDuration: number, trigger: string): void;
  logConverteMascaraErrors(diagnostics: CompileResult['diagnostics']): void;
  maybeLogContextQuiesced(contextKey: string, trigger: string, uri?: string): void;
  getContextGeneration(contextKey: string): number;
  getLastDidChangeAt(contextKey: string): number | undefined;
  getDocumentVersion(uri: string): number | undefined;
  hrDebugLogsEnabled: boolean;
}): (
  context: ResolvedContext,
  result: CompileResult,
  metricsEnabled: boolean,
  compileDuration: number,
  cycle: ValidationCycle,
  isPrefixCompile: boolean,
  trigger: string,
  perfTelemetry?: CompileResultApplicationPerfTelemetry
) => void {
  return (
    context,
    result,
    metricsEnabled,
    compileDuration,
    cycle,
    isPrefixCompile,
    trigger,
    perfTelemetry
  ): void => {
    const obs = input.getObservabilitySettingsForFile(context.rootDir);
    const ignoreSpanEnd = input.observability.span(obs, 'diagnostics.ignoreIds', { cycleId: cycle.cycleId, id: context.key });
    const ignored = input.getIgnoredForContext(context);
    const filtered = applyIgnoreIds(result.diagnostics, ignored);
    ignoreSpanEnd();
    input.sendLog(
      'debug',
      `diagnostics.ignoreIds: before=${result.diagnostics.length} after=${filtered.length} ignoredSet=${ignored.size}`,
      { cycleId: cycle.cycleId, id: context.key, span: 'diagnostics.ignoreIds' },
      context.rootDir
    );
    const currentGeneration = input.getContextGeneration(context.key);
    if (perfTelemetry?.contextGeneration !== undefined && perfTelemetry.contextGeneration !== currentGeneration) {
      input.sendDebugLog(perfTelemetry.uri ? input.toFsPath(perfTelemetry.uri) : context.rootDir, `compile: drop stale commit context=${context.name} trigger=${trigger} capturedGeneration=${perfTelemetry.contextGeneration} currentGeneration=${currentGeneration}`);
      return;
    }
    const publishPrepStart = performance.now();
    const byFile = input.groupDiagnostics(filtered);

    const previous = input.getContextCache(context.key);
    const prevFiles = previous?.files ?? new Set<string>();
    const prevHashByFile = previous?.diagHashByFile ?? new Map<string, string>();
    const nextFiles = isPrefixCompile ? new Set([...prevFiles, ...result.files]) : new Set(result.files);
    const nextByFile = isPrefixCompile && previous?.diagnosticsByFile
      ? (() => {
        const merged = new Map(previous.diagnosticsByFile);
        for (const [file, diags] of byFile.entries()) {
          merged.set(file, diags);
        }
        return merged;
      })()
      : byFile;

    if (input.shouldLogCompilerBuildInfo()) {
      try {
        const compilerInfo = input.readCompilerBuildInfo();
        input.sendLog(
          'info',
          `compiler: version=@lsp/compiler@${compilerInfo.version} buildTime=${compilerInfo.buildTime} entry=${compilerInfo.entry}`
        );
      } catch (err) {
        input.sendLog('warn', `compiler: version lookup failed error=${String(err)}`);
      }
    }
    const diagnosticsCommit = commitDiagnostics({
      prevFiles,
      prevHashByFile,
      nextFiles,
      nextByFile
    });

    const hasOpenDocsInContextAtCommit = input.getContextDocCount(context.key) > 0;
    if (hasOpenDocsInContextAtCommit) {
      input.schedulePullDiagnosticsRefresh(`compileResult:${trigger}`, context.workspaceUri);
    }

    const symbols = result.symbols ?? [];
    const symbolsByName = new Map<string, SymbolInfo>();
    for (const symbol of symbols) {
      symbolsByName.set(symbol.name.toLowerCase(), symbol);
    }
    input.sendLog(
      'info',
      `compile: done context=${context.name} cycle=${cycle.cycleId} files=${result.files.length} diags=${result.diagnostics.length} symbols=${symbols.length} durationMs=${Math.round(compileDuration)}`
    );
    input.sendLog(
      'info',
      `compile: config context=${context.name} rootDir=${context.rootDir} filePattern=${context.filePattern} includeSub=${context.includeSubdirectories} system=${context.system}`
    );
    if (result.__stats) {
      input.sendDebugLog(
        null,
        `compile: stats context=${context.name} discovered=${result.__stats.filesDiscovered} read=${result.__stats.filesRead} parsed=${result.__stats.filesParsed} parseMs=${Math.round(result.__stats.parseMs)} semanticMs=${Math.round(result.__stats.semanticMs)} totalMs=${Math.round(result.__stats.totalMs)}`
      );
    }
    if (input.hrDebugLogsEnabled) {
      const hasHR850 = result.files.some((f) => input.normalizePathKey(f).includes('hr850'));
      const hasHR858 = result.files.some((f) => input.normalizePathKey(f).includes('hr858'));
      const hasATxtLog = symbols.some((s) => s.name.toLowerCase() === 'atxtlog');
      const hr850Index = result.files.findIndex((f) => input.normalizePathKey(f).includes('hr850'));
      const hr858Index = result.files.findIndex((f) => input.normalizePathKey(f).includes('hr858'));
      const hr850Path = hr850Index >= 0 ? result.files[hr850Index] : 'n/a';
      const hr858Path = hr858Index >= 0 ? result.files[hr858Index] : 'n/a';
      const aTxtLogSymbol = symbolsByName.get('atxtlog');
      const aTxtLogType = aTxtLogSymbol?.typeName ?? 'missing (implicit or undefined)';
      input.sendLog('info', `compile: debug context=${context.name} hasHR850=${hasHR850} hasHR858=${hasHR858} hasATxtLog=${hasATxtLog}`);
      input.sendLog('info', `compile: order context=${context.name} hr850Index=${hr850Index} hr858Index=${hr858Index} hr850Path=${hr850Path} hr858Path=${hr858Path}`);
      input.sendLog('info', `compile: symbol context=${context.name} name=aTxtLog type=${aTxtLogType} declaredIn=${aTxtLogSymbol?.sourcePath ?? 'n/a'}`);
      if (hr850Index >= 0 || hr858Index >= 0) {
        const sampleStart = Math.max(0, Math.min(hr850Index, hr858Index) - 2);
        const sampleEnd = Math.min(result.files.length, Math.max(hr850Index, hr858Index) + 3);
        const orderSample = result.files.slice(sampleStart, sampleEnd).join(' | ');
        input.sendLog('info', `compile: order sample context=${context.name} range=[${sampleStart}..${sampleEnd - 1}] files=[${orderSample}]`);
      }
      if (hr850Index >= 0 && hr858Index >= 0 && hr858Index < hr850Index) {
        input.sendLog('warn', `compile: order violation context=${context.name} hr858Index(${hr858Index}) < hr850Index(${hr850Index})`);
      }
    }
    const activeDocumentUri = input.getActiveDocumentUri();
    if (activeDocumentUri) {
      const activePath = input.toFsPath(activeDocumentUri);
      const hasActive = result.files.some((f) => input.normalizePathKey(f) === input.normalizePathKey(activePath));
      input.sendLog('info', `compile: active file in result=${hasActive} file=${activePath}`);
    }

    const nextSemanticsByFile = result.semanticsByFile ?? previous?.semanticsByFile ?? new Map();
    const nextSemanticPayloadByFile = input.buildContextSemanticPayloadByFile(
      context,
      nextSemanticsByFile,
      previous?.semanticPayloadByFile
    );
    const effectivePrefixCompile = isPrefixCompile || perfTelemetry?.includeSemantics === false;
    const nextCache: ContextCache = {
      files: nextFiles,
      diagnosticsByFile: nextByFile,
      diagHashByFile: diagnosticsCommit.nextHashByFile,
      symbols,
      symbolsByName,
      symbolsStale: false,
      semanticsByFile: nextSemanticsByFile,
      semanticPayloadByFile: nextSemanticPayloadByFile,
      compilerDiagnostics: filtered,
      lastCompileWasPrefix: effectivePrefixCompile
    };
    input.setContextCache(context.key, nextCache);
    if (!effectivePrefixCompile) {
      input.bumpPullDiagPersistContextRevision(context.key);
      input.getPullDiagPersistCache().invalidateContext(context.key);
    }
    input.materializePullDiagnosticsSnapshotsForContext(context, nextCache, !effectivePrefixCompile);
    if (!effectivePrefixCompile) {
      input.clearPendingPullDiagnosticsGlobalFollowup(context.key, perfTelemetry?.uri);
    }
    input.invalidateHoverCacheCustomForContext(context.key);
    const hasOpenDocsInContext = hasOpenDocsInContextAtCommit;
    if (hasOpenDocsInContext && result.semanticsByFile) {
      input.refreshSemanticTokensCacheForContext(context);
      input.scheduleSemanticTokensRefresh('compileResult');
    }
    const compileQueueWaitMs = perfTelemetry?.queueWaitMs ?? null;
    const workerPayloadBytes = perfTelemetry?.workerPayloadBytes ?? null;
    const workerResultBytes = perfTelemetry?.workerResultBytes ?? null;
    const workerResultBytesBreakdown = perfTelemetry?.workerResultBytesBreakdown;
    const publishPrepMs = Math.max(0, performance.now() - publishPrepStart);

    if (metricsEnabled) {
      const stats = result.__stats as CompileStatsPerf | undefined;
      const compilerTotalMs = stats?.totalMs ?? null;
      const overheadMs = compilerTotalMs === null ? null : Math.max(0, compileDuration - compilerTotalMs);
      input.recordMetrics({
        contextKey: context.key,
        contextName: context.name,
        phase: 'diagnostics',
        durationMs: compileDuration,
        compileTrigger: trigger,
        compileIncludeSemantics: perfTelemetry?.includeSemantics ?? null,
        compileIsPrefix: effectivePrefixCompile,
        diagnosticsCount: result.diagnostics.length,
        filesCount: result.files.length,
        openDocsCount: input.getContextDocCount(context.key),
        filesDiscovered: stats?.filesDiscovered,
        filesRead: stats?.filesRead,
        filesParsed: stats?.filesParsed,
        parseMs: stats?.parseMs,
        semanticMs: stats?.semanticMs,
        totalMs: stats?.totalMs,
        compilerTotalMs,
        overheadMs,
        queueWaitMs: compileQueueWaitMs,
        workerPayloadBytes,
        workerResultBytes,
        workerResultDiagnosticsBytes: workerResultBytesBreakdown?.diagnostics ?? null,
        workerResultFilesBytes: workerResultBytesBreakdown?.files ?? null,
        workerResultSymbolsBytes: workerResultBytesBreakdown?.symbols ?? null,
        workerResultSemanticsBytes: workerResultBytesBreakdown?.semanticsByFile ?? null,
        workerResultStatsBytes: workerResultBytesBreakdown?.stats ?? null,
        semanticStartIndex: stats?.semanticStartIndex,
        semanticFilesReused: stats?.semanticFilesReused,
        semanticFilesAnalyzed: stats?.semanticFilesAnalyzed,
        reusedFiles: stats?.reusedFiles ?? null,
        reparsedFiles: stats?.reparsedFiles ?? null,
        reanalyzedFiles: stats?.reanalyzedFiles ?? null,
        reusedSymbols: stats?.reusedSymbols ?? null,
        contextResolveMs: stats?.contextResolveMs ?? null,
        textLoadMs: stats?.textLoadMs ?? null,
        incrementalReuseMs: stats?.incrementalReuseMs ?? null,
        bindMs: stats?.bindMs ?? null,
        analyzeMs: stats?.analyzeMs ?? null,
        indexLookupMs: stats?.indexLookupMs ?? null,
        publishPrepMs,
        semanticFirstChangedIndex: stats?.semanticFirstChangedIndex ?? null,
        semanticFirstChangedReason: stats?.semanticFirstChangedReason ?? null,
        semanticFirstMismatchPath: stats?.semanticFirstMismatchPath ?? null,
        semanticFirstMismatchPrevKey: stats?.semanticFirstMismatchPrevKey ?? null,
        semanticFirstMismatchCurrKey: stats?.semanticFirstMismatchCurrKey ?? null,
        semanticFileOrderOrListChanged: stats?.semanticFileOrderOrListChanged ?? null,
        semanticBaseChangedCount: stats?.semanticBaseChangedCount ?? null,
        semanticDirtyCount: stats?.semanticDirtyCount ?? null,
        semanticDeclChangedCount: stats?.semanticDeclChangedCount ?? null,
        semanticBodyOnlyChangedCount: stats?.semanticBodyOnlyChangedCount ?? null,
        persistedTextCacheLoaded: stats?.persistedTextCacheLoaded ?? null,
        persistedTextCacheEntries: stats?.persistedTextCacheEntries ?? null,
        persistedTextCacheAddedThisRun: stats?.persistedTextCacheAddedThisRun ?? null,
        persistedTextCacheHits: stats?.persistedTextCacheHits ?? null,
        persistedTextCacheMissNoEntry: stats?.persistedTextCacheMissNoEntry ?? null,
        persistedTextCacheMissStatMismatch: stats?.persistedTextCacheMissStatMismatch ?? null,
        persistedTextCacheFile: stats?.persistedTextCacheFile ?? null,
        persistedTextCacheFirstKey: stats?.persistedTextCacheFirstKey ?? null,
        fullFilesCount: stats?.fullFilesCount ?? null,
        selectedFilesCount: stats?.selectedFilesCount ?? null,
        isFullContextSelected: stats?.isFullContextSelected ?? null
      }, context.workspaceUri);
      input.maybePersistCompilePerfSnapshot(context.workspaceUri, context.key);
    }

    if (isTypingCompileReason(trigger)) {
      const lastDidChangeAt = input.getLastDidChangeAt(context.key);
      if (lastDidChangeAt !== undefined) {
        const typingLatencyMs = Date.now() - lastDidChangeAt;
        const activeUri = perfTelemetry?.uri;
        input.recordTypingLatency({
          context,
          trigger,
          uri: activeUri,
          docVersion: activeUri ? input.getDocumentVersion(activeUri) : undefined,
          typingLatencyMs,
          lastEditAtIso: new Date(lastDidChangeAt).toISOString()
        });
      }
    }

    input.updateAdaptiveTypingDelay(context.key, compileDuration, trigger);
    input.logConverteMascaraErrors(result.diagnostics);
    input.maybeLogContextQuiesced(context.key, `compileResult:${trigger}`, perfTelemetry?.uri);
  };
}
