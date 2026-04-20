import { performance } from 'node:perf_hooks';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { ContextCache, ResolvedContext } from '../server-runtime';
import {
  clearFullCompileQueued,
  getAdaptiveCompileDelay,
  getCompileDelayForReason,
  getScheduledCompileDelay,
  markFullCompileQueued,
  mergeChangedFilePaths,
  mergeSemanticBudgetFiles,
  resolveIncludeSemanticsForSchedule,
  shouldQueueAfterRunningCompile,
  shouldRescheduleCompileEarlier
} from '../../compile-scheduler-policy';
import { mergeExpectedDocVersion, shouldSkipScheduledCompile } from './compile-version-gate';
import { startCompileRequest, type CompileRequestState } from './compile-requests';

export type ScheduledCompileEntry = {
  timer: NodeJS.Timeout;
  executeAt: number;
  queuedAt: number;
  reason: string;
  uri?: string;
  expectedDocVersion?: number;
  changedFilePaths?: string[];
  includeSemantics?: boolean;
  includeSemanticPayload?: boolean;
  semanticBudgetFiles?: number;
  contextGeneration?: number;
};

export type PendingCompileEntry = {
  reason: string;
  uri?: string;
  expectedDocVersion?: number;
  changedFilePaths?: string[];
  includeSemantics?: boolean;
  includeSemanticPayload?: boolean;
  semanticBudgetFiles?: number;
  contextGeneration?: number;
};

type CompilePerfCounters = {
  compileRequested: number;
  compilePendingQueued: number;
  coalescedCount: number;
  cancelledObsoleteCount: number;
  supersededCompileCount: number;
};

type ScheduleCompileOptions = {
  expectedDocVersion?: number;
  changedFilePaths?: string[];
  includeSemantics?: boolean;
  includeSemanticPayload?: boolean;
  semanticBudgetFiles?: number;
  contextGeneration?: number;
};

export function createCompileOrchestrator(input: {
  documents: Map<string, TextDocument>;
  contextCache: Map<string, ContextCache>;
  contextDocs: Map<string, Set<string>>;
  compileScheduled: Map<string, ScheduledCompileEntry>;
  compileRunning: Map<string, boolean>;
  compilePending: Map<string, PendingCompileEntry>;
  fullCompileQueuedByContext: Map<string, number>;
  adaptiveTypingDelayByContext: Map<string, number>;
  semanticFollowupTimers: Map<string, NodeJS.Timeout>;
  semanticDrainTimers: Map<string, NodeJS.Timeout>;
  lastCompileByContext: Map<string, number>;
  lastPreemptAtByContext: Map<string, number>;
  compileRequests: CompileRequestState;
  pendingCompiles: Map<number, { startedAt: number }>;
  priorityCompileDelayMs: number;
  secondaryCompileDelayMs: number;
  typingSemanticFollowupDelayMs: number;
  typingSemanticDrainDelayMs: number;
  typingSemanticBudgetFiles: number;
  getCompilePerfCounters(contextKey: string): CompilePerfCounters;
  hasContextCachedSemanticsForFile(context: ResolvedContext, filePath: string): boolean;
  maybeLogContextQuiesced(contextKey: string, trigger: string, uri?: string): void;
  logObsoleteWorkDropped(contextKey: string, reason: string, uri?: string): void;
  sendLog(level: 'info' | 'debug', message: string): void;
  sendDebugLog(filePath: string | null, message: string): void;
  updateContextCache(
    context: ResolvedContext,
    reason: string,
    queuedAt: number,
    uri: string | undefined,
    expectedDocVersion: number | undefined,
    changedFilePaths: string[] | undefined,
    includeSemantics: boolean,
    includeSemanticPayload: boolean,
    semanticBudgetFiles: number | undefined
  ): Promise<void>;
  toFsPath(uri: string): string;
  markPullDiagnosticsGlobalFollowupSkipped(contextKey: string, uri: string | undefined, reason: string): void;
  getContextGeneration(contextKey: string): number;
}): {
  scheduleCompile(
    context: ResolvedContext,
    delayMs?: number,
    reason?: string,
    uri?: string,
    options?: ScheduleCompileOptions
  ): void;
  scheduleTypingSemanticFollowup(
    context: ResolvedContext,
    uri: string,
    expectedDocVersion: number,
    changedFilePath: string
  ): void;
} {
  const {
    documents,
    contextCache,
    compileScheduled,
    compileRunning,
    compilePending,
    fullCompileQueuedByContext,
    adaptiveTypingDelayByContext,
    semanticFollowupTimers,
    semanticDrainTimers,
    lastCompileByContext,
    lastPreemptAtByContext,
    compileRequests,
    pendingCompiles,
    priorityCompileDelayMs,
    secondaryCompileDelayMs,
    typingSemanticFollowupDelayMs,
    typingSemanticDrainDelayMs,
    typingSemanticBudgetFiles,
    getCompilePerfCounters,
    hasContextCachedSemanticsForFile,
    maybeLogContextQuiesced,
    logObsoleteWorkDropped,
    sendLog,
    sendDebugLog,
    updateContextCache,
    toFsPath,
    markPullDiagnosticsGlobalFollowupSkipped,
    getContextGeneration
  } = input;

  function preemptRunningCompile(
    context: ResolvedContext,
    reason: string,
    uri?: string,
    options?: ScheduleCompileOptions
  ): boolean {
    if (!compileRunning.get(context.key)) return false;
    if (semanticFollowupTimers.has(context.key) || semanticDrainTimers.has(context.key)) return false;
    const runningId = compileRequests.runningByContext.get(context.key);
    const running = runningId ? pendingCompiles.get(runningId) : undefined;
    if (running) {
      const ageMs = performance.now() - running.startedAt;
      if (ageMs < 900) return false;
    }
    const now = Date.now();
    const lastPreempt = lastPreemptAtByContext.get(context.key) ?? 0;
    if (now - lastPreempt < 1200) return false;
    lastPreemptAtByContext.set(context.key, now);
    const perfCounters = getCompilePerfCounters(context.key);
    perfCounters.compilePendingQueued += 1;
    perfCounters.supersededCompileCount += 1;
    const current = compilePending.get(context.key);
    compilePending.set(context.key, {
      reason,
      uri: uri ?? current?.uri,
      expectedDocVersion: mergeExpectedDocVersion(current?.expectedDocVersion, options?.expectedDocVersion),
      changedFilePaths: Array.from(new Set([...(current?.changedFilePaths ?? []), ...(options?.changedFilePaths ?? [])])),
      includeSemantics: options?.includeSemantics ?? current?.includeSemantics,
      includeSemanticPayload: options?.includeSemanticPayload ?? current?.includeSemanticPayload,
      semanticBudgetFiles: options?.semanticBudgetFiles ?? current?.semanticBudgetFiles,
      contextGeneration: options?.contextGeneration ?? current?.contextGeneration ?? getContextGeneration(context.key)
    });
    startCompileRequest(compileRequests, context.key);
    sendDebugLog(uri ? toFsPath(uri) : null, `compile: preempt running context=${context.name} reason=${reason}`);
    return true;
  }

  function enqueueCompilePending(
    context: ResolvedContext,
    reason: string,
    uri?: string,
    options?: ScheduleCompileOptions
  ): void {
    const perfCounters = getCompilePerfCounters(context.key);
    const current = compilePending.get(context.key);
    if (current) perfCounters.coalescedCount += 1;
    const merged = {
      reason,
      uri: uri ?? current?.uri,
      expectedDocVersion: mergeExpectedDocVersion(current?.expectedDocVersion, options?.expectedDocVersion),
      changedFilePaths: mergeChangedFilePaths(current?.changedFilePaths, options?.changedFilePaths),
      includeSemantics: Boolean(current?.includeSemantics) || Boolean(options?.includeSemantics),
      includeSemanticPayload: Boolean(current?.includeSemanticPayload) || Boolean(options?.includeSemanticPayload),
      semanticBudgetFiles: mergeSemanticBudgetFiles(current?.semanticBudgetFiles, options?.semanticBudgetFiles),
      contextGeneration: options?.contextGeneration ?? current?.contextGeneration ?? getContextGeneration(context.key)
    };
    compilePending.set(context.key, merged);
    if (!current) {
      perfCounters.compilePendingQueued += 1;
      startCompileRequest(compileRequests, context.key);
    }
    sendDebugLog(uri ? toFsPath(uri) : null, `compile: queued after running context=${context.name} reason=${reason}`);
  }

  function scheduleCompile(
    context: ResolvedContext,
    delayMs = 250,
    reason = 'unknown',
    uri?: string,
    options?: ScheduleCompileOptions
  ): void {
    if (reason === 'activeDocumentChanged') return;
    if (reason === 'didOpenTextDocument') {
      const cached = contextCache.get(context.key);
      const hasCachedSymbols = (cached?.symbols?.length ?? 0) > 0;
      const hasTargetSemantics = Boolean(
        uri &&
        uri.startsWith('file://') &&
        hasContextCachedSemanticsForFile(context, toFsPath(uri))
      );
      if (hasCachedSymbols && (!uri || hasTargetSemantics)) {
        sendLog('info', `compile: ignorado (cache ok) context=${context.name}`);
        return;
      }
    }

    const resolvedIncludeSemantics = resolveIncludeSemanticsForSchedule(reason, options?.includeSemantics);
    const resolvedIncludeSemanticPayload = options?.includeSemanticPayload ?? (reason !== 'pullDiagnosticsGlobalFollowup');
    if (compileRunning.get(context.key) && shouldQueueAfterRunningCompile(reason, resolvedIncludeSemantics)) {
      enqueueCompilePending(context, reason, uri, {
        ...options,
        includeSemantics: resolvedIncludeSemantics,
        includeSemanticPayload: resolvedIncludeSemanticPayload
      });
      return;
    }
    if ((reason === 'didChangeTextDocument' || reason === 'didChangeTextDocumentAfterFormat' || reason === 'didUndoLikeChange') && compileRunning.get(context.key)) {
      if (preemptRunningCompile(context, reason, uri, {
        ...options,
        includeSemantics: resolvedIncludeSemantics,
        includeSemanticPayload: resolvedIncludeSemanticPayload
      })) {
        return;
      }
    }

    const perfCounters = getCompilePerfCounters(context.key);
    perfCounters.compileRequested += 1;
    const queuedAt = performance.now();
    const isFullCompile = !options?.changedFilePaths || options.changedFilePaths.length === 0;
    if (isFullCompile) {
      markFullCompileQueued(fullCompileQueuedByContext, context.key);
    }

    const effectiveDelayMs = getAdaptiveCompileDelay(context.key, delayMs, reason, adaptiveTypingDelayByContext);
    const executeAt = queuedAt + effectiveDelayMs;
    const existing = compileScheduled.get(context.key);
    if (existing) {
      perfCounters.coalescedCount += 1;
      perfCounters.supersededCompileCount += 1;
      if (existing.reason === 'pullDiagnosticsGlobalFollowup' && reason !== 'pullDiagnosticsGlobalFollowup' && existing.uri && uri === existing.uri) {
        markPullDiagnosticsGlobalFollowupSkipped(context.key, existing.uri, `supersededBy:${reason}`);
      }
      existing.reason = reason;
      existing.uri = uri ?? existing.uri;
      existing.expectedDocVersion = mergeExpectedDocVersion(existing.expectedDocVersion, options?.expectedDocVersion);
      existing.changedFilePaths = mergeChangedFilePaths(existing.changedFilePaths, options?.changedFilePaths);
      existing.includeSemantics = (existing.includeSemantics ?? false) || resolvedIncludeSemantics;
      existing.includeSemanticPayload = (existing.includeSemanticPayload ?? false) || resolvedIncludeSemanticPayload;
      existing.semanticBudgetFiles = mergeSemanticBudgetFiles(existing.semanticBudgetFiles, options?.semanticBudgetFiles);
      existing.contextGeneration = options?.contextGeneration ?? existing.contextGeneration ?? getContextGeneration(context.key);
      if (shouldRescheduleCompileEarlier(existing, executeAt)) {
        clearTimeout(existing.timer);
        existing.executeAt = executeAt;
        existing.timer = setTimeout(() => {
          const scheduled = compileScheduled.get(context.key);
          if (!scheduled) return;
          compileScheduled.delete(context.key);
          const currentDocVersion = scheduled.uri ? documents.get(scheduled.uri)?.version : undefined;
          const scheduledIsFollowup = scheduled.reason === 'pullDiagnosticsGlobalFollowup';
          const currentGeneration = getContextGeneration(context.key);
          if ((scheduled.contextGeneration ?? currentGeneration) !== currentGeneration) {
            perfCounters.cancelledObsoleteCount += 1;
            logObsoleteWorkDropped(context.key, 'scheduled-stale-context-generation', scheduled.uri);
            if (scheduledIsFollowup) markPullDiagnosticsGlobalFollowupSkipped(context.key, scheduled.uri, 'stale-context-generation');
            maybeLogContextQuiesced(context.key, 'scheduled-stale-context-generation', scheduled.uri);
            return;
          }
          if (shouldSkipScheduledCompile({ currentDocVersion, expectedDocVersion: scheduled.expectedDocVersion })) {
            sendDebugLog(
              scheduled.uri ? toFsPath(scheduled.uri) : null,
              `compile: skipped outdated version context=${context.name} expected=${scheduled.expectedDocVersion} current=${currentDocVersion ?? 'n/a'}`
            );
            perfCounters.cancelledObsoleteCount += 1;
            logObsoleteWorkDropped(context.key, 'scheduled-outdated-version', scheduled.uri);
            if (scheduledIsFollowup) markPullDiagnosticsGlobalFollowupSkipped(context.key, scheduled.uri, 'outdated-version');
            maybeLogContextQuiesced(context.key, 'scheduled-outdated-version', scheduled.uri);
            return;
          }
          const now = Date.now();
          const last = lastCompileByContext.get(context.key) ?? 0;
          if (scheduled.reason === 'didOpenTextDocument' && now - last < 2000) {
            sendLog('info', `compile: ignorado (cooldown open) context=${context.name}`);
            if (scheduledIsFollowup) markPullDiagnosticsGlobalFollowupSkipped(context.key, scheduled.uri, 'cooldown-open');
            maybeLogContextQuiesced(context.key, 'scheduled-cooldown-open', scheduled.uri);
            return;
          }
          if (scheduled.reason === 'didChangeTextDocument' && now - last < 500) {
            sendLog('info', `compile: ignorado (cooldown) context=${context.name}`);
            if (scheduledIsFollowup) markPullDiagnosticsGlobalFollowupSkipped(context.key, scheduled.uri, 'cooldown');
            maybeLogContextQuiesced(context.key, 'scheduled-cooldown', scheduled.uri);
            return;
          }
          lastCompileByContext.set(context.key, now);
          clearFullCompileQueued(fullCompileQueuedByContext, context.key);
          sendLog('info', `compile: start reason=${scheduled.reason} context=${context.name}${scheduled.uri ? ` uri=${scheduled.uri}` : ''} includeSemantics=${scheduled.includeSemantics !== false}`);
          void updateContextCache(
            context,
            scheduled.reason,
            scheduled.queuedAt,
            scheduled.uri,
            scheduled.expectedDocVersion,
            scheduled.changedFilePaths,
            scheduled.includeSemantics ?? true,
            scheduled.includeSemanticPayload ?? true,
            scheduled.semanticBudgetFiles
          );
        }, getScheduledCompileDelay(existing));
      }
      return;
    }

    const scheduled: ScheduledCompileEntry = {
      timer: setTimeout(() => {
        const current = compileScheduled.get(context.key);
        if (!current) return;
        compileScheduled.delete(context.key);
        const currentDocVersion = current.uri ? documents.get(current.uri)?.version : undefined;
        const currentIsFollowup = current.reason === 'pullDiagnosticsGlobalFollowup';
        const currentGeneration = getContextGeneration(context.key);
        if ((current.contextGeneration ?? currentGeneration) !== currentGeneration) {
          perfCounters.cancelledObsoleteCount += 1;
          logObsoleteWorkDropped(context.key, 'timer-stale-context-generation', current.uri);
          if (currentIsFollowup) markPullDiagnosticsGlobalFollowupSkipped(context.key, current.uri, 'stale-context-generation');
          maybeLogContextQuiesced(context.key, 'timer-stale-context-generation', current.uri);
          return;
        }
        if (shouldSkipScheduledCompile({ currentDocVersion, expectedDocVersion: current.expectedDocVersion })) {
          sendDebugLog(
            current.uri ? toFsPath(current.uri) : null,
            `compile: skipped outdated version context=${context.name} expected=${current.expectedDocVersion} current=${currentDocVersion ?? 'n/a'}`
          );
          perfCounters.cancelledObsoleteCount += 1;
          logObsoleteWorkDropped(context.key, 'timer-outdated-version', current.uri);
          if (currentIsFollowup) markPullDiagnosticsGlobalFollowupSkipped(context.key, current.uri, 'outdated-version');
          maybeLogContextQuiesced(context.key, 'timer-outdated-version', current.uri);
          return;
        }
        const now = Date.now();
        const last = lastCompileByContext.get(context.key) ?? 0;
        if (current.reason === 'didOpenTextDocument' && now - last < 2000) {
          sendLog('info', `compile: ignorado (cooldown open) context=${context.name}`);
          if (currentIsFollowup) markPullDiagnosticsGlobalFollowupSkipped(context.key, current.uri, 'cooldown-open');
          maybeLogContextQuiesced(context.key, 'timer-cooldown-open', current.uri);
          return;
        }
        if (current.reason === 'didChangeTextDocument' && now - last < 500) {
          sendLog('info', `compile: ignorado (cooldown) context=${context.name}`);
          if (currentIsFollowup) markPullDiagnosticsGlobalFollowupSkipped(context.key, current.uri, 'cooldown');
          maybeLogContextQuiesced(context.key, 'timer-cooldown', current.uri);
          return;
        }
        lastCompileByContext.set(context.key, now);
        clearFullCompileQueued(fullCompileQueuedByContext, context.key);
        sendLog('info', `compile: start reason=${current.reason} context=${context.name}${current.uri ? ` uri=${current.uri}` : ''} includeSemantics=${current.includeSemantics !== false}`);
        void updateContextCache(
          context,
          current.reason,
          current.queuedAt,
          current.uri,
          current.expectedDocVersion,
          current.changedFilePaths,
          current.includeSemantics ?? true,
          current.includeSemanticPayload ?? true,
          current.semanticBudgetFiles
        );
      }, effectiveDelayMs),
      executeAt,
      queuedAt,
      reason,
      uri,
      expectedDocVersion: options?.expectedDocVersion,
      changedFilePaths: options?.changedFilePaths,
      includeSemantics: resolvedIncludeSemantics,
      includeSemanticPayload: resolvedIncludeSemanticPayload,
      semanticBudgetFiles: options?.semanticBudgetFiles,
      contextGeneration: options?.contextGeneration ?? getContextGeneration(context.key)
    };
    compileScheduled.set(context.key, scheduled);
  }

  function scheduleTypingSemanticFollowup(
    context: ResolvedContext,
    uri: string,
    expectedDocVersion: number,
    changedFilePath: string
  ): void {
    const currentFollowup = semanticFollowupTimers.get(context.key);
    if (currentFollowup) clearTimeout(currentFollowup);
    const currentDrain = semanticDrainTimers.get(context.key);
    if (currentDrain) clearTimeout(currentDrain);
    const followupTimer = setTimeout(() => {
      semanticFollowupTimers.delete(context.key);
      scheduleCompile(
        context,
        getCompileDelayForReason('didChangeSemanticFollowup', true, priorityCompileDelayMs, secondaryCompileDelayMs),
        'didChangeSemanticFollowup',
        uri,
        {
          expectedDocVersion,
          changedFilePaths: [changedFilePath],
          includeSemantics: true,
          semanticBudgetFiles: typingSemanticBudgetFiles
        }
      );
    }, typingSemanticFollowupDelayMs);
    semanticFollowupTimers.set(context.key, followupTimer);
    const drainTimer = setTimeout(() => {
      semanticDrainTimers.delete(context.key);
      scheduleCompile(
        context,
        getCompileDelayForReason('didChangeSemanticFollowup', false, priorityCompileDelayMs, secondaryCompileDelayMs),
        'didChangeSemanticFollowup',
        uri,
        {
          expectedDocVersion,
          changedFilePaths: [changedFilePath],
          includeSemantics: true
        }
      );
    }, typingSemanticDrainDelayMs);
    semanticDrainTimers.set(context.key, drainTimer);
  }

  return {
    scheduleCompile,
    scheduleTypingSemanticFollowup
  };
}
