import type { LspSystem, ValidationContextConfig } from '@lsp/compiler';
import type { Connection, Diagnostic } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { buildCompilationPlan } from '../compile/context-scheduler';
import { getCompileDelayForReason } from '../../compile-scheduler-policy';
import type { ContextCache, ResolvedContext } from '../server-runtime';

export function createContextOrchestrator(input: {
  connection: Connection;
  documents: Map<string, TextDocument>;
  contextCache: Map<string, ContextCache>;
  projectContextService: {
    resolveForFile(filePath: string): unknown | null;
    getRelevantContextKeysForFile(filePath: string): string[];
  };
  getResolvedContextsByKey(): Map<string, ResolvedContext>;
  getActiveDocumentUri(): string | null;
  getOpenContextKeys(): Set<string>;
  getContextDocs(): Map<string, Set<string>>;
  emptyOpenContexts: Map<string, ResolvedContext>;
  priorityCompileDelayMs: number;
  secondaryCompileDelayMs: number;
  scheduleCompile(context: ResolvedContext, delayMs?: number, reason?: string, uri?: string, options?: {
    expectedDocVersion?: number;
    changedFilePaths?: string[];
    includeSemantics?: boolean;
  }): void;
  scheduleFallbackValidation(doc: TextDocument, delayMs?: number): void;
  clearPendingPullDiagnosticsGlobalFollowupForContext(contextKey: string): void;
  isFallbackDocument(doc: TextDocument): boolean;
  toFsPath(uri: string): string;
  toFileUri(filePath: string): string;
  sendLog(level: 'info', message: string): void;
  isDebugLogsEnabledForFile(filePath: string): boolean;
  getEffectiveFallbackSystemForFile(filePath: string): 'HCM' | 'ACESSO' | 'ERP' | null;
}): {
  resolveOpenContexts(): Map<string, ResolvedContext>;
  syncOpenContexts(open: Map<string, ResolvedContext>): Set<string>;
  getActiveContextKey(): string | null;
  rebuildOpenContextDocs(): Map<string, Set<string>>;
  addDocToContext(doc: TextDocument): Map<string, Set<string>>;
  removeDocFromContext(uri: string): Map<string, Set<string>>;
  findContextForFile(filePath: string): ResolvedContext | null;
  getCompilerSystemForFile(filePath: string, context: ResolvedContext | null): LspSystem;
  scheduleOpenContexts(priorityKey: string | null, reason?: string, uri?: string): void;
  processPendingDidOpenDocuments(pendingDidOpenUris: Set<string>): Set<string>;
} {
  const {
    connection,
    documents,
    contextCache,
    projectContextService,
    getResolvedContextsByKey,
    getActiveDocumentUri,
    getOpenContextKeys,
    getContextDocs,
    emptyOpenContexts,
    priorityCompileDelayMs,
    secondaryCompileDelayMs,
    scheduleCompile,
    scheduleFallbackValidation,
    clearPendingPullDiagnosticsGlobalFollowupForContext,
    isFallbackDocument,
    toFsPath,
    toFileUri,
    sendLog,
    isDebugLogsEnabledForFile,
    getEffectiveFallbackSystemForFile
  } = input;

  function getSystemForContext(context: ResolvedContext): ValidationContextConfig['system'] {
    return context.system ?? 'HCM';
  }

  function findContextForFile(filePath: string): ResolvedContext | null {
    if (isDebugLogsEnabledForFile(filePath)) {
      sendLog('info', `context: resolve file=${filePath} contexts=${getResolvedContextsByKey().size}`);
    }
    const resolved = projectContextService.resolveForFile(filePath);
    if (resolved) return resolved as ResolvedContext;
    if (isDebugLogsEnabledForFile(filePath)) {
      sendLog('info', `context: no match for file=${filePath}`);
    }
    return null;
  }

  function getCompilerSystemForFile(filePath: string, context: ResolvedContext | null): LspSystem {
    if (context) return getSystemForContext(context);
    const fallbackSystem = getEffectiveFallbackSystemForFile(filePath);
    return fallbackSystem ?? 'SENIOR';
  }

  function resolveOpenContexts(): Map<string, ResolvedContext> {
    const contextDocs = getContextDocs();
    if (contextDocs.size === 0) return emptyOpenContexts;
    const map = new Map<string, ResolvedContext>();
    for (const key of contextDocs.keys()) {
      const ctx = getResolvedContextsByKey().get(key);
      if (!ctx) continue;
      map.set(key, ctx);
    }
    return map;
  }

  function clearContextDiagnostics(contextKey: string): void {
    const cache = contextCache.get(contextKey);
    if (!cache) return;
    for (const filePath of cache.files) {
      connection.sendDiagnostics({ uri: toFileUri(filePath), diagnostics: [] as Diagnostic[] });
    }
    contextCache.delete(contextKey);
    clearPendingPullDiagnosticsGlobalFollowupForContext(contextKey);
  }

  function syncOpenContexts(open: Map<string, ResolvedContext>): Set<string> {
    const openContextKeys = getOpenContextKeys();
    if (openContextKeys.size > 0) {
      for (const key of openContextKeys) {
        if (!open.has(key)) clearContextDiagnostics(key);
      }
    }
    return new Set(open.keys());
  }

  function getActiveContextKey(): string | null {
    const activeDocumentUri = getActiveDocumentUri();
    if (!activeDocumentUri) return null;
    const ctx = findContextForFile(toFsPath(activeDocumentUri));
    return ctx?.key ?? null;
  }

  function rebuildOpenContextDocs(): Map<string, Set<string>> {
    const next = new Map<string, Set<string>>();
    for (const doc of documents.values()) {
      const filePath = toFsPath(doc.uri);
      const ctx = findContextForFile(filePath);
      if (!ctx) continue;
      const list = next.get(ctx.key) ?? new Set<string>();
      list.add(doc.uri);
      next.set(ctx.key, list);
    }
    return next;
  }

  function addDocToContext(doc: TextDocument): Map<string, Set<string>> {
    const next = new Map(getContextDocs());
    const filePath = toFsPath(doc.uri);
    const ctx = findContextForFile(filePath);
    if (!ctx) return next;
    const list = next.get(ctx.key) ?? new Set<string>();
    list.add(doc.uri);
    next.set(ctx.key, list);
    return next;
  }

  function removeDocFromContext(uri: string): Map<string, Set<string>> {
    const next = new Map(getContextDocs());
    const filePath = toFsPath(uri);
    const ctx = findContextForFile(filePath);
    if (!ctx) return next;
    const list = next.get(ctx.key);
    if (!list) return next;
    list.delete(uri);
    if (list.size === 0) next.delete(ctx.key);
    return next;
  }

  function scheduleOpenContexts(priorityKey: string | null, reason = 'unknown', uri?: string): void {
    const open = resolveOpenContexts();
    syncOpenContexts(open);
    if (open.size === 0) return;

    let openKeys = [...open.keys()];
    let priorityFilePath: string | undefined;
    let priorityDocVersion: number | undefined;
    if (uri && uri.startsWith('file://')) {
      priorityFilePath = toFsPath(uri);
      priorityDocVersion = documents.get(uri)?.version;
      const relevant = projectContextService.getRelevantContextKeysForFile(priorityFilePath);
      if (relevant.length > 0) {
        openKeys = openKeys.filter((key) => relevant.includes(key));
        if (openKeys.length === 0 && priorityKey && open.has(priorityKey)) openKeys = [priorityKey];
      }
    }

    const plan = buildCompilationPlan(openKeys, priorityKey);
    const priorityContext = plan.priorityKey ? open.get(plan.priorityKey) : undefined;
    if (priorityContext) {
      const priorityOptions = reason === 'didOpenTextDocument' && priorityFilePath
        ? {
          expectedDocVersion: priorityDocVersion,
          changedFilePaths: [priorityFilePath],
          includeSemantics: true
        }
        : undefined;
      scheduleCompile(priorityContext, getCompileDelayForReason(reason, true, priorityCompileDelayMs, secondaryCompileDelayMs), reason, uri, priorityOptions);
    }

    for (const key of plan.orderedKeys) {
      if (priorityContext && key === plan.priorityKey) continue;
      const context = open.get(key);
      if (!context) continue;
      scheduleCompile(context, getCompileDelayForReason(reason, false, priorityCompileDelayMs, secondaryCompileDelayMs), reason, uri);
    }
  }

  function processPendingDidOpenDocuments(pendingDidOpenUris: Set<string>): Set<string> {
    if (pendingDidOpenUris.size === 0) return new Set();
    const pending = [...pendingDidOpenUris];
    const next = new Set<string>();
    for (const uri of pending) {
      const doc = documents.get(uri);
      if (!doc) continue;
      const filePath = toFsPath(doc.uri);
      const context = findContextForFile(filePath);
      if (context) {
        scheduleCompile(context, 0, 'didOpenDeferredAfterRefresh', doc.uri);
        continue;
      }
      if (isFallbackDocument(doc)) {
        scheduleFallbackValidation(doc, 0);
        continue;
      }
      next.add(uri);
    }
    return next;
  }

  return {
    resolveOpenContexts,
    syncOpenContexts,
    getActiveContextKey,
    rebuildOpenContextDocs,
    addDocToContext,
    removeDocFromContext,
    findContextForFile,
    getCompilerSystemForFile,
    scheduleOpenContexts,
    processPendingDidOpenDocuments
  };
}
