import path from 'node:path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type {
  Connection,
  DidChangeTextDocumentParams,
  DidChangeWatchedFilesParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  Diagnostic,
  InitializeParams,
  TextDocumentSyncKind,
  WorkspaceFolder
} from 'vscode-languageserver/node';
import type { ResolvedContext, ServerRuntime } from './server-runtime';
import type { ContextInvalidationReason, ContextInvalidationTarget } from './context/context-invalidation';

type FallbackSystem = 'HCM' | 'ERP' | 'ACESSO' | null | undefined;

export function registerLifecycleHandlers(input: {
  connection: Connection;
  runtime: ServerRuntime;
  extensionVersion: string;
  setVscodeClientVersion(version: string): void;
  setWorkspaceFolders(folders: WorkspaceFolder[]): void;
  setFallbackSystemOverride(system: FallbackSystem): void;
  setActiveDocumentUri(uri: string | null): void;
  setLastActiveContextKey(contextKey: string | null): void;
  setWindowFocused(focused: boolean): void;
  onWindowFocusChanged(focused: boolean): void;
  textDocumentSyncKind: typeof TextDocumentSyncKind;
  semanticTokenTypes: string[];
  semanticTokenModifiers: string[];
  toFsPath(uri: string): string;
  normalizePathKey(filePath: string): string;
  isPathUnderRoot(filePath: string, rootDir: string): boolean;
  getPullDiagPersistCache(): { invalidateFile(filePath: string): void; invalidateContext(contextKey: string): void; flush(): Promise<void> | void };
  projectContextService: {
    invalidate(filePath: string): void;
    invalidateContext(contextKey: string): void;
    getRelevantContextKeysForFile(filePath: string): string[];
  };
  forceRefreshFilesByContext: Set<string>;
  bumpPullDiagPersistContextRevision(contextKey: string): number;
  internalCache: Map<string, unknown>;
  internalIndex: Map<string, unknown>;
  invalidateAllHoverCaches(): void;
  scheduleOpenContexts(priorityKey: string | null, reason?: string, uri?: string): void;
  normalizeFallbackSystem(system: FallbackSystem): FallbackSystem;
  resetFallbackValidationState(): void;
  revalidateOpenFallbackDocs(): void;
  findContextForFile(filePath: string): ResolvedContext | null;
  refreshContexts(): Promise<void>;
  addDocToContext(doc: TextDocument): void;
  sendDebugLog(filePath: string | null, message: string): void;
  recordContextInvalidation(input: {
    reason: ContextInvalidationReason;
    target: ContextInvalidationTarget;
    filePath?: string | null;
    contextKey?: string | null;
    contextName?: string | null;
    workspaceUri?: string | null;
  }): void;
  schedulePullDiagnosticsRefresh(reason: string, workspaceUri?: string, delayMs?: number): void;
  scheduleDidOpenPullPrewarm(doc: TextDocument, context: ResolvedContext): void;
  scheduleCompile(context: ResolvedContext, delayMs: number, reason: string, uri?: string, options?: {
    expectedDocVersion?: number;
    changedFilePaths?: string[];
    includeSemantics?: boolean;
    semanticBudgetFiles?: number;
  }): void;
  getActiveContextKey(): string | null;
  shouldBootstrapFullCompileOnDidOpen(context: ResolvedContext): boolean;
  isFallbackDocument(doc: TextDocument): boolean;
  shouldRunFallbackValidationOnOpen(input: { bootPhase: ServerRuntime['bootPhase']; refreshInProgress: boolean; hasContexts: boolean }): boolean;
  scheduleFallbackValidation(doc: TextDocument, delayMs?: number): void;
  disposeFallbackDocument(uri: string): void;
  snapshotStore: {
    upsert(entry: { uri: string; filePath: string; contextId: string; version: number; text: string }): void;
    remove(uri: string): void;
  };
  getSnapshotContextId(filePath: string): string;
  docHashHistoryTracker: {
    update(uri: string, text: string): { hash: string; undoLike: boolean };
    delete(uri: string): void;
  };
  semanticTokenEditHistory: {
    reset(uri: string): void;
    record(uri: string, previousVersion: number, nextVersion: number, contentChanges: DidChangeTextDocumentParams['contentChanges']): void;
  };
  isLikelyFormatDrivenChange(input: { changeVersion: number; nowMs: number; marker: ServerRuntime['recentFormatWindowByUri'] extends Map<string, infer T> ? T | undefined : never }): boolean;
  getObservabilitySettingsForFile(filePath: string | null): unknown;
  observability: {
    log(settings: unknown, level: 'debug' | 'info' | 'warn' | 'error', message: string, payload: { id: string; span: string; data: Record<string, unknown> }): void;
  };
  bumpPullDiagDirtyStamp(contextKey: string): number;
  getCompileDelayForReason(reason: string, immediate: boolean, priorityMs: number, secondaryMs: number): number;
  priorityCompileDelayMs: number;
  secondaryCompileDelayMs: number;
  typingSemanticBudgetFiles: number;
  scheduleTypingSemanticFollowup(context: ResolvedContext, uri: string, version: number, filePath: string): void;
  invalidateHoverCacheCustomForFallback(filePath: string): void;
  pullDiagPrewarmByUri: Map<string, unknown>;
  pullDiagPrewarmTimers: Map<string, NodeJS.Timeout>;
  pullDiagPrewarmInFlight: Map<string, Promise<void>>;
  pullDiagLastItems: Map<string, Diagnostic[]>;
  pullDiagCache: Map<string, unknown>;
  clearPullDiagnosticsResidualState(uri: string, contextKey?: string | null): void;
  clearPendingPullDiagnosticsGlobalFollowup(contextKey: string, uri?: string): void;
  cleanupIdleContextWork(contextKey: string, trigger: string, uri?: string): void;
  maybeLogContextQuiesced(contextKey: string, trigger: string, uri?: string): void;
  drainQuiescedContextDiagnostics(contextKey: string, trigger: string, uri?: string): void;
  removeDocFromContext(uri: string): void;
  syncOpenContexts(open: Map<string, ResolvedContext>): void;
  resolveOpenContexts(): Map<string, ResolvedContext>;
  connectionSendDiagnostics(uri: string, diagnostics: Diagnostic[]): void;
  semanticRuntime: {
    invalidateDocument(uri: string): void;
    prewarmOnDidOpen(doc: TextDocument, context: ResolvedContext | null): boolean;
    hasContextCachedSemanticsForFile(context: ResolvedContext, filePath: string): boolean;
    disposeDocument(input: { uri: string; doc?: TextDocument; filePath: string; contextKey: string | null }): void;
  };
  flushFallbackDocumentState(uri: string, filePath: string, contextKey?: string | null): void;
  semanticRefreshScheduler: { dispose(): void };
  preloadInternalsForActiveContext(activeKey: string | null): Promise<void>;
}): void
{
  const {
    connection,
    runtime,
    extensionVersion,
    setVscodeClientVersion,
    setWorkspaceFolders,
    setFallbackSystemOverride,
    setActiveDocumentUri,
    setLastActiveContextKey,
    setWindowFocused,
    onWindowFocusChanged,
    textDocumentSyncKind,
    semanticTokenTypes,
    semanticTokenModifiers,
    toFsPath,
    normalizePathKey,
    isPathUnderRoot,
    getPullDiagPersistCache,
    projectContextService,
    forceRefreshFilesByContext,
    bumpPullDiagPersistContextRevision,
    internalCache,
    internalIndex,
    invalidateAllHoverCaches,
    scheduleOpenContexts,
    normalizeFallbackSystem,
    resetFallbackValidationState,
    revalidateOpenFallbackDocs,
    findContextForFile,
    refreshContexts,
    addDocToContext,
    sendDebugLog,
    recordContextInvalidation,
    schedulePullDiagnosticsRefresh,
    scheduleDidOpenPullPrewarm,
    scheduleCompile,
    getActiveContextKey,
    shouldBootstrapFullCompileOnDidOpen,
    isFallbackDocument,
    shouldRunFallbackValidationOnOpen,
    scheduleFallbackValidation,
    disposeFallbackDocument,
    snapshotStore,
    getSnapshotContextId,
    docHashHistoryTracker,
    semanticTokenEditHistory,
    isLikelyFormatDrivenChange,
    getObservabilitySettingsForFile,
    observability,
    bumpPullDiagDirtyStamp,
    getCompileDelayForReason,
    priorityCompileDelayMs,
    secondaryCompileDelayMs,
    typingSemanticBudgetFiles,
    scheduleTypingSemanticFollowup,
    invalidateHoverCacheCustomForFallback,
    pullDiagPrewarmByUri,
    pullDiagPrewarmTimers,
    pullDiagPrewarmInFlight,
    pullDiagLastItems,
    pullDiagCache,
    clearPullDiagnosticsResidualState,
    clearPendingPullDiagnosticsGlobalFollowup,
    cleanupIdleContextWork,
    maybeLogContextQuiesced,
    drainQuiescedContextDiagnostics,
    removeDocFromContext,
    syncOpenContexts,
    resolveOpenContexts,
    connectionSendDiagnostics,
    semanticRuntime,
    flushFallbackDocumentState,
    semanticRefreshScheduler,
    preloadInternalsForActiveContext
  } = input;

  connection.onInitialize((params: InitializeParams) =>
  {
    const initOptions = params.initializationOptions as { vscodeVersion?: string; globalStoragePath?: string } | undefined;
    const nextVscodeClientVersion = typeof initOptions?.vscodeVersion === 'string' && initOptions.vscodeVersion.trim() ? initOptions.vscodeVersion.trim() : 'unknown';
    setVscodeClientVersion(nextVscodeClientVersion);

    const globalStoragePath = typeof initOptions?.globalStoragePath === 'string' && initOptions.globalStoragePath.trim()
      ? initOptions.globalStoragePath.trim()
      : '';
    if (globalStoragePath) process.env.LSP_V2_GLOBAL_STORAGE_PATH = globalStoragePath;

    runtime.workspaceFolders = params.workspaceFolders ?? [];
    if (runtime.workspaceFolders.length === 0 && params.rootUri)
    {
      const rootPath = toFsPath(params.rootUri);
      runtime.workspaceFolders = [{ uri: params.rootUri, name: path.basename(rootPath) }] as WorkspaceFolder[];
    }
    setWorkspaceFolders(runtime.workspaceFolders);
    return {
      capabilities: {
        workDoneProgress: true,
        textDocumentSync: textDocumentSyncKind.Incremental,
        completionProvider: { triggerCharacters: ['_', '.'] },
        hoverProvider: true,
        signatureHelpProvider: { triggerCharacters: ['(', ','] },
        definitionProvider: true,
        implementationProvider: true,
        renameProvider: { prepareProvider: true },
        documentFormattingProvider: true,
        documentRangeFormattingProvider: false,
        diagnosticProvider: { interFileDependencies: true, workspaceDiagnostics: false },
        semanticTokensProvider: {
          legend: {
            tokenTypes: [...semanticTokenTypes],
            tokenModifiers: [...semanticTokenModifiers]
          },
          full: { delta: true },
          range: false
        }
      },
      serverInfo: {
        name: 'lsp',
        version: extensionVersion
      }
    };
  });

  connection.onInitialized(() =>
  {
    void refreshContexts();
  });

  connection.onNotification('lsp/windowFocusChanged', (params: { focused?: boolean } | undefined) =>
  {
    const focused = params?.focused !== false;
    setWindowFocused(focused);
    onWindowFocusChanged(focused);
  });

  connection.onDidChangeConfiguration(() =>
  {
    void refreshContexts();
  });

  connection.onDidChangeWatchedFiles((params: DidChangeWatchedFilesParams) =>
  {
    let shouldReschedule = false;
    let shouldReloadInternalSignatures = false;
    for (const change of params.changes)
    {
      const filePath = toFsPath(change.uri);
      getPullDiagPersistCache().invalidateFile(normalizePathKey(filePath));
      const fileName = path.basename(filePath).toLowerCase();
      if (fileName.endsWith('-signatures.json') || fileName.endsWith('-internals.json'))
      {
        shouldReloadInternalSignatures = true;
      }
      projectContextService.invalidate(filePath);
      recordContextInvalidation({
        reason: 'watched_file_change',
        target: 'file',
        filePath
      });
      const relevantContextKeys = projectContextService.getRelevantContextKeysForFile(filePath);
      for (const ctx of runtime.resolvedContexts)
      {
        if (relevantContextKeys.length > 0 && !relevantContextKeys.includes(ctx.key)) continue;
        if (relevantContextKeys.length === 0 && !isPathUnderRoot(filePath, ctx.rootDir)) continue;
        projectContextService.invalidateContext(ctx.key);
        recordContextInvalidation({
          reason: 'watched_file_change',
          target: 'context',
          filePath,
          contextKey: ctx.key,
          contextName: ctx.name,
          workspaceUri: ctx.workspaceUri
        });
        forceRefreshFilesByContext.add(ctx.key);
        bumpPullDiagPersistContextRevision(ctx.key);
        getPullDiagPersistCache().invalidateContext(ctx.key);
        shouldReschedule = true;
      }
    }
    void getPullDiagPersistCache().flush();
    if (shouldReloadInternalSignatures)
    {
      internalCache.clear();
      internalIndex.clear();
      invalidateAllHoverCaches();
    }
    if (shouldReschedule)
    {
      scheduleOpenContexts(getActiveContextKey(), 'didChangeWatchedFiles');
    }
  });

  connection.onNotification('lsp/fallbackSystemChanged', (params: { system: FallbackSystem }) =>
  {
    runtime.fallbackSystemOverride = normalizeFallbackSystem(params?.system);
    setFallbackSystemOverride(runtime.fallbackSystemOverride);
    resetFallbackValidationState();
    invalidateAllHoverCaches();
    revalidateOpenFallbackDocs();
  });

  connection.onRequest('lsp/contextForFile', (params: { uri: string }) =>
  {
    const uri = params?.uri ?? '';
    if (!uri) return { inContext: false, contextKey: null, contextName: null };
    const context = findContextForFile(toFsPath(uri));
    return {
      inContext: Boolean(context),
      contextKey: context?.key ?? null,
      contextName: context?.name ?? null
    };
  });

  connection.onNotification('lsp/activeDocumentChanged', (params: { uri: string | null }) =>
  {
    runtime.activeDocumentUri = params?.uri ?? null;
    setActiveDocumentUri(runtime.activeDocumentUri);
    const activeKey = getActiveContextKey();
    void preloadInternalsForActiveContext(activeKey);
    if (activeKey === runtime.lastActiveContextKey) return;
    runtime.lastActiveContextKey = activeKey;
    setLastActiveContextKey(activeKey);
    const open = resolveOpenContexts();
    syncOpenContexts(open);
    if (open.size <= 1) return;
    scheduleOpenContexts(activeKey, 'activeDocumentChanged', params?.uri ?? undefined);
  });

  connection.onDidOpenTextDocument((params: DidOpenTextDocumentParams) =>
  {
    const filePath = toFsPath(params.textDocument.uri);
    const previousOpenDoc = runtime.documents.get(params.textDocument.uri);
    if (previousOpenDoc)
    {
      const previousFilePath = toFsPath(previousOpenDoc.uri);
      const previousContext = findContextForFile(previousFilePath);
      sendDebugLog(filePath, `didOpen: replacing residual open document uri=${params.textDocument.uri} previousVersion=${previousOpenDoc.version} previousContext=${previousContext ? previousContext.name : 'none'}`);
      flushFallbackDocumentState(params.textDocument.uri, previousFilePath, previousContext?.key ?? null);
      semanticRuntime.disposeDocument({
        uri: params.textDocument.uri,
        filePath: previousFilePath,
        contextKey: previousContext?.key ?? null
      });
      runtime.documents.delete(params.textDocument.uri);
      removeDocFromContext(params.textDocument.uri);
      snapshotStore.remove(params.textDocument.uri);
      docHashHistoryTracker.delete(params.textDocument.uri);
      semanticTokenEditHistory.reset(params.textDocument.uri);
    }
    const doc = TextDocument.create(params.textDocument.uri, params.textDocument.languageId, params.textDocument.version, params.textDocument.text);
    runtime.documents.set(doc.uri, doc);
    docHashHistoryTracker.update(doc.uri, doc.getText());
    semanticTokenEditHistory.reset(doc.uri);
    runtime.didOpenReceivedAtByUri.set(doc.uri, Date.now());
    const nextOpenGeneration = (runtime.didOpenGenerationByUri.get(doc.uri) ?? 0) + 1;
    runtime.didOpenGenerationByUri.set(doc.uri, nextOpenGeneration);
    runtime.didOpenFirstSemanticPublishedByUri.delete(doc.uri);
    const didCloseObservedGeneration = runtime.didCloseObservedGenerationByUri.get(doc.uri) ?? 0;
    snapshotStore.upsert({ uri: doc.uri, filePath, contextId: getSnapshotContextId(filePath), version: doc.version, text: doc.getText() });
    addDocToContext(doc);
    const context = findContextForFile(filePath);
    sendDebugLog(filePath, `didOpen: file=${filePath} context=${context ? context.name : 'none'} language=${params.textDocument.languageId} openGeneration=${nextOpenGeneration} didCloseObservedGeneration=${didCloseObservedGeneration}`);
    if (runtime.refreshInProgress || runtime.bootPhase === 'BOOTING')
    {
      runtime.pendingDidOpenUris.add(doc.uri);
      sendDebugLog(filePath, 'didOpen: queued until refresh/boot completes');
      return;
    }
    if (context)
    {
      semanticRuntime.prewarmOnDidOpen(doc, context);
      schedulePullDiagnosticsRefresh('didOpen', context.workspaceUri, 375);
      scheduleDidOpenPullPrewarm(doc, context);
      const cached = runtime.contextCache.get(context.key);
      if (cached?.files.has(filePath) && cached.symbols.length > 0 && semanticRuntime.hasContextCachedSemanticsForFile(context, filePath))
      {
        sendDebugLog(filePath, 'didOpen: skip compile (already present in context cache)');
        return;
      }
      if (Date.now() < runtime.suppressOpenCompileUntil)
      {
        const deferMs = Math.max(0, runtime.suppressOpenCompileUntil - Date.now()) + 25;
        scheduleCompile(context, deferMs, 'didOpenTextDocumentSuppressed', doc.uri);
        return;
      }
      if (shouldBootstrapFullCompileOnDidOpen(context))
      {
        scheduleCompile(context, 0, 'didOpenContextBootstrap', doc.uri, {
          expectedDocVersion: doc.version,
          includeSemantics: true
        });
        return;
      }
      scheduleOpenContexts(getActiveContextKey(), 'didOpenTextDocument', doc.uri);
      return;
    }
    if (isFallbackDocument(doc))
    {
      sendDebugLog(filePath, `didOpen: fallback uri=${doc.uri} openGeneration=${runtime.didOpenGenerationByUri.get(doc.uri) ?? 0}`);
      semanticRuntime.prewarmOnDidOpen(doc, null);
      invalidateHoverCacheCustomForFallback(filePath);
      if (!shouldRunFallbackValidationOnOpen({
        bootPhase: runtime.bootPhase,
        refreshInProgress: runtime.refreshInProgress,
        hasContexts: runtime.resolvedContexts.length > 0
      }))
      {
        runtime.pendingDidOpenUris.add(doc.uri);
        sendDebugLog(filePath, 'didOpen: skip fallback validation (contexts not ready yet)');
        return;
      }
      scheduleFallbackValidation(doc, 0);
    }
  });

  connection.onDidChangeTextDocument((params: DidChangeTextDocumentParams) =>
  {
    const existing = runtime.documents.get(params.textDocument.uri);
    if (!existing) return;
    const updated = TextDocument.update(existing, params.contentChanges, params.textDocument.version);
    runtime.documents.set(updated.uri, updated);
    semanticTokenEditHistory.record(updated.uri, existing.version, updated.version, params.contentChanges);
    const filePath = toFsPath(updated.uri);
    pullDiagPrewarmByUri.delete(updated.uri);
    snapshotStore.upsert({ uri: updated.uri, filePath, contextId: getSnapshotContextId(filePath), version: updated.version, text: updated.getText() });
    const context = findContextForFile(filePath);
    const previousDidChangeAt = context ? (runtime.lastDidChangeAtByContext.get(context.key) ?? 0) : 0;
    const formatMarker = runtime.recentFormatWindowByUri.get(updated.uri);
    const nowMs = Date.now();
    const { hash: updatedHash, undoLike } = docHashHistoryTracker.update(updated.uri, updated.getText());
    const formatDriven = isLikelyFormatDrivenChange({ changeVersion: updated.version, nowMs, marker: formatMarker });
    const formatUndoCoalesced = Boolean(undoLike && formatMarker && nowMs <= (formatMarker.requestedAtMs + (formatMarker.windowMs * 2)));
    const changeReason = undoLike ? 'didUndoLikeChange' : (formatDriven ? 'didChangeTextDocumentAfterFormat' : 'didChangeTextDocument');
    if (changeReason === 'didChangeTextDocumentAfterFormat' || changeReason === 'didUndoLikeChange')
    {
      semanticTokenEditHistory.reset(updated.uri);
      input.semanticRuntime.invalidateDocument(updated.uri);
    }
    if (formatMarker && nowMs > formatMarker.requestedAtMs + formatMarker.telemetryWindowMs)
    {
      runtime.recentFormatWindowByUri.delete(updated.uri);
    }
    sendDebugLog(filePath, `didChange: file=${filePath} context=${context ? context.name : 'none'} version=${params.textDocument.version}`);
    if (runtime.refreshInProgress || runtime.bootPhase === 'BOOTING')
    {
      runtime.pendingDidOpenUris.add(updated.uri);
      sendDebugLog(filePath, 'didChange: queued until refresh/boot completes');
      return;
    }
    if (context)
    {
      const obs = getObservabilitySettingsForFile(filePath);
      if (changeReason === 'didChangeTextDocumentAfterFormat')
      {
        observability.log(obs, 'debug', 'didChangeTextDocumentAfterFormat', {
          id: updated.uri,
          span: 'didChangeTextDocumentAfterFormat',
          data: {
            contextKey: context.key,
            docVersion: updated.version,
            hash: updatedHash,
            formatRequestId: formatMarker?.requestId ?? null,
            formatEditCount: formatMarker?.editCount ?? null,
            formatEditLength: formatMarker?.editLength ?? null,
            preFormatResultId: formatMarker?.preFormatResultId ?? null,
            preFormatDiagnosticsCount: formatMarker?.preFormatDiagnosticsCount ?? null,
            telemetryWindowMs: formatMarker?.telemetryWindowMs ?? null
          }
        });
      }
      if (changeReason === 'didUndoLikeChange')
      {
        observability.log(obs, 'debug', 'didUndoLikeChange', {
          id: updated.uri,
          span: 'didUndoLikeChange',
          data: { contextKey: context.key, docVersion: updated.version, hash: updatedHash, formatUndoCoalesced }
        });
      }
      runtime.contextCache.get(context.key)?.semanticPayloadByFile.delete(filePath);
      bumpPullDiagDirtyStamp(context.key);
      bumpPullDiagPersistContextRevision(context.key);
      getPullDiagPersistCache().invalidateContext(context.key);
      void getPullDiagPersistCache().flush();
      const now = Date.now();
      runtime.lastDidChangeAtByContext.set(context.key, now);
      runtime.lastDidChangeAtByUri.set(updated.uri, now);
      if (previousDidChangeAt > 0 && now - previousDidChangeAt > 1800)
      {
        getCompileDelayForReason('didChangeTextDocument', true, priorityCompileDelayMs, secondaryCompileDelayMs);
      }
      if (changeReason === 'didChangeTextDocumentAfterFormat' || changeReason === 'didUndoLikeChange')
      {
        scheduleCompile(context, getCompileDelayForReason(changeReason, true, priorityCompileDelayMs, secondaryCompileDelayMs), changeReason, updated.uri, {
          expectedDocVersion: updated.version,
          changedFilePaths: [filePath],
          includeSemantics: false
        });
        scheduleCompile(context, changeReason === 'didUndoLikeChange' ? 40 : 0, 'didChangeSemanticFollowup', updated.uri, {
          expectedDocVersion: updated.version,
          changedFilePaths: [filePath],
          includeSemantics: true
        });
      } else
      {
        scheduleCompile(context, getCompileDelayForReason(changeReason, true, priorityCompileDelayMs, secondaryCompileDelayMs), changeReason, updated.uri, {
          expectedDocVersion: updated.version,
          changedFilePaths: [filePath],
          includeSemantics: false,
          semanticBudgetFiles: typingSemanticBudgetFiles
        });
        scheduleTypingSemanticFollowup(context, updated.uri, updated.version, filePath);
      }
      if (changeReason === 'didChangeTextDocumentAfterFormat' || changeReason === 'didUndoLikeChange')
      {
        schedulePullDiagnosticsRefresh('didChange', context.workspaceUri);
      }
      return;
    }
    if (isFallbackDocument(updated))
    {
      getPullDiagPersistCache().invalidateFile(normalizePathKey(filePath));
      void getPullDiagPersistCache().flush();
      invalidateHoverCacheCustomForFallback(filePath);
      scheduleFallbackValidation(updated, 250);
    }
  });

  connection.onDidCloseTextDocument((params: DidCloseTextDocumentParams) =>
  {
    const filePath = toFsPath(params.textDocument.uri);
    const closingContext = findContextForFile(filePath);
    const closingOpenGeneration = runtime.didOpenGenerationByUri.get(params.textDocument.uri) ?? 0;
    runtime.didCloseObservedGenerationByUri.set(params.textDocument.uri, closingOpenGeneration);
    sendDebugLog(filePath, `didClose: file=${filePath} context=${closingContext ? closingContext.name : 'none'} openGeneration=${closingOpenGeneration}`);
    runtime.didOpenReceivedAtByUri.delete(params.textDocument.uri);
    runtime.didOpenFirstSemanticPublishedByUri.delete(params.textDocument.uri);
    const prewarmTimer = pullDiagPrewarmTimers.get(params.textDocument.uri);
    if (prewarmTimer)
    {
      clearTimeout(prewarmTimer);
      pullDiagPrewarmTimers.delete(params.textDocument.uri);
    }
    pullDiagPrewarmInFlight.delete(params.textDocument.uri);
    pullDiagPrewarmByUri.delete(params.textDocument.uri);
    pullDiagLastItems.delete(params.textDocument.uri);
    pullDiagCache.delete(params.textDocument.uri);
    const closingDoc = runtime.documents.get(params.textDocument.uri);
    runtime.documents.delete(params.textDocument.uri);
    docHashHistoryTracker.delete(params.textDocument.uri);
    snapshotStore.remove(params.textDocument.uri);
    runtime.recentFormatWindowByUri.delete(params.textDocument.uri);
    runtime.lastDidChangeAtByUri.delete(params.textDocument.uri);
    const closedContext = closingContext;
    semanticRuntime.disposeDocument({
      uri: params.textDocument.uri,
      doc: closingDoc,
      filePath,
      contextKey: closedContext?.key ?? null
    });
    if (closedContext)
    {
      clearPendingPullDiagnosticsGlobalFollowup(closedContext.key, params.textDocument.uri);
    }
    clearPullDiagnosticsResidualState(params.textDocument.uri, closedContext?.key ?? null);
    flushFallbackDocumentState(params.textDocument.uri, filePath, closedContext?.key ?? null);
    removeDocFromContext(params.textDocument.uri);
    if (closedContext)
    {
      cleanupIdleContextWork(closedContext.key, 'didCloseTextDocument', params.textDocument.uri);
    }
    const openContexts = resolveOpenContexts();
    syncOpenContexts(openContexts);
    if (closedContext)
    {
      drainQuiescedContextDiagnostics(closedContext.key, 'didCloseTextDocument', params.textDocument.uri);
      maybeLogContextQuiesced(closedContext.key, 'didCloseTextDocument', params.textDocument.uri);
    }
    const context = findContextForFile(filePath);
    if (context && openContexts.size > 0)
    {
      scheduleOpenContexts(getActiveContextKey(), 'didCloseTextDocument', params.textDocument.uri);
    } else
    {
      invalidateHoverCacheCustomForFallback(filePath);
      disposeFallbackDocument(params.textDocument.uri);
    }
    connectionSendDiagnostics(params.textDocument.uri, []);
  });

  connection.onShutdown(async () =>
  {
    semanticRefreshScheduler.dispose();
    await getPullDiagPersistCache().flush();
  });
}
