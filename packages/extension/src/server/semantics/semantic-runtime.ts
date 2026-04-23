import { performance } from 'node:perf_hooks';
import { collectEmbeddedSqlSemanticDebugReport, collectEmbeddedSqlSemanticOccurrences, type EmbeddedSqlDebugEvent, type EnsureCompileOptions, type SemanticOccurrence } from '@lsp/compiler';
import { LSPErrorCodes, ResponseError, type SemanticTokens } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { isFullCompileQueuedOrRunning } from '../../compile-scheduler-policy';
import type {
  ContextCache,
  ResolvedContext,
  SemanticPayloadCacheEntry,
  SemanticTokensCacheEntry
} from '../server-runtime';
import { shouldSuppressSemanticTokenForTextmate } from './highlight-suppression';
import {
  buildSemanticPayloadFingerprint,
  isSemanticResponseStale,
  shouldCoalesceSemanticRequest,
  shouldReusePreviousSemanticPayload
} from './semantic-flicker-control';
import { buildSemanticTokens, prepareSemanticOccurrences } from './semantic-payload';
import { tryRemapStaleSemanticTokens, type SemanticTokenEdit } from './semantic-token-remap';
import { buildWarmSemanticCacheKey, WarmSemanticTokensCache } from './semantic-warm-cache';

type TokenDecision = 'fresh' | 'delta' | 'reuse_previous' | 'cancel_stale' | 'drop_transient' | 'error';

type SemanticDecisionInput = {
  filePath: string;
  requestId: string;
  contextKey?: string;
  contextName?: string;
  uri: string;
  docVersion: number;
  tokenCount: number;
  durationMs?: number;
  decision: TokenDecision;
  reason: string | null;
  source: string;
  kind: 'full' | 'delta' | 'error';
  coalesced?: boolean;
  staleDropped?: boolean;
  reusedPrevious?: boolean;
  remapApplied?: boolean;
  remapEditsApplied?: number;
  embeddedSqlHighlightEnabled?: boolean;
  embeddedSqlHighlightCandidateCount?: number;
  embeddedSqlHighlightPublishedCount?: number;
  embeddedSqlHighlightSuppressedCount?: number;
  embeddedSqlHighlightWrapperKind?: string | null;
  embeddedSqlHighlightSourceKind?: string | null;
  embeddedSqlDebugEvents?: EmbeddedSqlDebugEvent[];
  embeddedSqlDebugEventCount?: number;
};

type SemanticResponseSource =
  | 'cache-hit'
  | 'cache-warm-reopen'
  | 'context-cache'
  | 'fallback-compile'
  | 'public-api'
  | 'stale-reuse'
  | 'stale-remap'
  | 'stale-cancel'
  | 'unchanged-reuse';

export function createSemanticRuntime(input: {
  documents: Map<string, TextDocument>;
  contextCache: Map<string, ContextCache>;
  maxWarmEntries: number;
  semanticTokenEditHistory: {
    get(uri: string): { edits: SemanticTokenEdit[] } | undefined;
    delete(uri: string): void;
    pruneToVersion(uri: string, version: number): void;
  };
  toFsPath(uri: string): string;
  findContextForFile(filePath: string): ResolvedContext | null;
  normalizePathKey(filePath: string): string;
  getWindowFocused(): boolean;
  sendLog(level: 'info' | 'warn' | 'debug', message: string): void;
  semanticRefreshScheduler: { schedule(reason: string, delayMs?: number): void };
  getObservabilitySettingsForFile(filePath: string | null): unknown;
  observability: {
    log(
      settings: unknown,
      level: 'debug' | 'info' | 'warn' | 'error',
      message: string,
      payload: { id: string; span: string; durationMs?: number; data: Record<string, unknown> }
    ): void;
  };
  isEmbeddedSqlHighlightEnabled(filePath: string): boolean;
  getEmbeddedSqlDialect(filePath: string): 'sql' | 'oracle' | 'sqlserver';
  didOpenReceivedAtByUri: Map<string, number>;
  didOpenFirstSemanticPublishedByUri: Set<string>;
  recordSemanticDecision(input: SemanticDecisionInput): void;
  fullCompileQueuedByContext: Map<string, number>;
  fullCompileInFlightByContext: Set<string>;
  fullCompileLastCommittedAtByContext: Map<string, number>;
  waitForNextContextCompile(contextKey: string, timeoutMs: number): Promise<boolean>;
  getLastDidChangeAt(contextKey: string): number | undefined;
  typingDrainDelayMs: number;
  typingSemanticBudgetFiles: number;
  coalesceDelayMs: number;
  typingStableWindowMs: number;
  staleReuseWindowMs: number;
  postFullSuppressMs: number;
  compileFallbackDocument(doc: TextDocument, includeSemantics: boolean): Promise<{ semanticsByFile?: Map<string, SemanticOccurrence[]> }>;
  publicCompiler: {
    ensureCompiledForFile(
      context: ResolvedContext,
      filePath: string,
      overrides: unknown,
      options: EnsureCompileOptions
    ): Promise<unknown>;
    getSemanticsForFile(snapshot: unknown, filePath: string): SemanticOccurrence[] | undefined;
  };
  buildOverridesForContext(context: ResolvedContext): unknown;
  forceRefreshFilesByContext: Set<string>;
}) {
  const semanticTokensCache = new Map<string, SemanticTokensCacheEntry>();
  const semanticTokensInFlight = new Map<string, Promise<SemanticTokens>>();
  const semanticLatestRequestedVersionByUri = new Map<string, number>();
  const semanticTokensLastSentByUri = new Map<string, { resultId: string; data: number[] }>();
  const warmSemanticTokensCache = new WarmSemanticTokensCache(input.maxWarmEntries);
  const semanticFollowupTimers = new Map<string, NodeJS.Timeout>();
  const semanticDrainTimers = new Map<string, NodeJS.Timeout>();

  function invalidateDocument(uri: string): void {
    semanticTokensCache.delete(uri);
    input.semanticTokenEditHistory.delete(uri);
  }

  function setCacheEntry(uri: string, version: number, data: number[]): SemanticTokensCacheEntry {
    const fingerprint = buildSemanticPayloadFingerprint(data);
    const entry: SemanticTokensCacheEntry = {
      version,
      data: [...data],
      fingerprint,
      resultId: `${version}:${fingerprint}`,
      updatedAt: Date.now()
    };
    semanticTokensCache.set(uri, entry);
    input.semanticTokenEditHistory.pruneToVersion(uri, version);
    return entry;
  }

  function buildTokensFromOccurrences(doc: TextDocument, occurrences: SemanticOccurrence[]): {
    tokens: SemanticTokens;
    filteredOccurrences: SemanticOccurrence[];
    embeddedSqlHighlightCandidateCount: number;
    embeddedSqlHighlightPublishedCount: number;
    embeddedSqlHighlightSuppressedCount: number;
    embeddedSqlHighlightWrapperKind: string | null;
    embeddedSqlHighlightSourceKind: string | null;
    embeddedSqlDebugEvents: EmbeddedSqlDebugEvent[];
    embeddedSqlDebugEventCount: number;
  } {
    const filePath = input.toFsPath(doc.uri);
    const highlightEnabled = input.isEmbeddedSqlHighlightEnabled(filePath);
    const syntheticEmbeddedSqlOccurrences = highlightEnabled
      ? collectEmbeddedSqlSemanticOccurrences({
        sourcePath: filePath,
        text: doc.getText(),
        dialect: input.getEmbeddedSqlDialect(filePath)
      })
      : [];
    const embeddedSqlDebug = highlightEnabled
      ? collectEmbeddedSqlSemanticDebugReport({
        sourcePath: filePath,
        text: doc.getText(),
        dialect: input.getEmbeddedSqlDialect(filePath)
      })
      : { events: [], eventCount: 0 };
    const preparedOccurrences = prepareSemanticOccurrences(doc, [...occurrences, ...syntheticEmbeddedSqlOccurrences]);
    const embeddedSqlCandidates = preparedOccurrences.filter(
      (occ) => occ.tokenType === 'string' && (occ.tokenModifiers ?? []).includes('defaultLibrary') && occ.embeddedSql
    );
    const filteredOccurrences = preparedOccurrences.filter((occ) =>
      !shouldSuppressSemanticTokenForTextmate(doc, occ)
      && (
        highlightEnabled
        || !(occ.tokenType === 'string' && (occ.tokenModifiers ?? []).includes('defaultLibrary') && occ.embeddedSql)
      )
    );
    const publishedEmbeddedSql = filteredOccurrences.filter(
      (occ) => occ.tokenType === 'string' && (occ.tokenModifiers ?? []).includes('defaultLibrary') && occ.embeddedSql
    );
    const tokens = buildSemanticTokens(filteredOccurrences);
    const primaryEmbeddedSql = embeddedSqlCandidates[0]?.embeddedSql;
    return {
      tokens,
      filteredOccurrences,
      embeddedSqlHighlightCandidateCount: embeddedSqlCandidates.length,
      embeddedSqlHighlightPublishedCount: publishedEmbeddedSql.length,
      embeddedSqlHighlightSuppressedCount: embeddedSqlCandidates.length - publishedEmbeddedSql.length,
      embeddedSqlHighlightWrapperKind: primaryEmbeddedSql?.wrapperKind ?? null,
      embeddedSqlHighlightSourceKind: primaryEmbeddedSql?.sourceKind ?? null,
      embeddedSqlDebugEvents: [...embeddedSqlDebug.events],
      embeddedSqlDebugEventCount: embeddedSqlDebug.eventCount
    };
  }

  function getOccurrencesFromMap(
    semanticsByFile: Map<string, SemanticOccurrence[]>,
    filePath: string
  ): SemanticOccurrence[] | undefined {
    let occurrences = semanticsByFile.get(filePath);
    if (occurrences) return occurrences;

    const key = input.normalizePathKey(filePath);
    for (const [entryPath, list] of semanticsByFile.entries()) {
      if (input.normalizePathKey(entryPath) === key) {
        occurrences = list;
        break;
      }
    }
    return occurrences;
  }

  function getContextCachedSemanticPayload(
    context: ResolvedContext,
    filePath: string,
    version: number
  ): SemanticPayloadCacheEntry | undefined {
    const cached = input.contextCache.get(context.key);
    if (!cached) return undefined;
    let payload = cached.semanticPayloadByFile.get(filePath);
    if (payload && payload.version === version) return payload;

    const key = input.normalizePathKey(filePath);
    for (const [entryPath, entry] of cached.semanticPayloadByFile.entries()) {
      if (input.normalizePathKey(entryPath) === key && entry.version === version) {
        payload = entry;
        break;
      }
    }
    return payload;
  }

  function getContextCachedSemanticOccurrences(
    context: ResolvedContext,
    filePath: string
  ): SemanticOccurrence[] | undefined {
    const cached = input.contextCache.get(context.key);
    if (!cached) return undefined;
    return getOccurrencesFromMap(cached.semanticsByFile, filePath);
  }

  function buildContextSemanticPayloadByFile(
    context: ResolvedContext,
    semanticsByFile: Map<string, SemanticOccurrence[]>,
    previous?: Map<string, SemanticPayloadCacheEntry>
  ): Map<string, SemanticPayloadCacheEntry> {
    const next = new Map(previous ?? []);
    for (const [uri, doc] of input.documents.entries()) {
      const docContext = input.findContextForFile(input.toFsPath(uri));
      if (docContext?.key !== context.key) continue;
      const filePath = input.toFsPath(uri);
      const occurrences = getOccurrencesFromMap(semanticsByFile, filePath);
      if (!occurrences || occurrences.length === 0) {
        next.delete(filePath);
        continue;
      }
      const prepared = buildTokensFromOccurrences(doc, occurrences);
      next.set(filePath, { version: doc.version, data: prepared.tokens.data });
    }
    return next;
  }

  function prewarmOnDidOpen(doc: TextDocument, context: ResolvedContext | null): boolean {
    const filePath = input.toFsPath(doc.uri);
    const warmKey = buildWarmSemanticCacheKey(filePath, context?.key ?? null, doc.getText());
    const warmCached = warmSemanticTokensCache.get(warmKey);
    if (warmCached) {
      setCacheEntry(doc.uri, doc.version, warmCached.data);
      return true;
    }

    if (!context) return false;
    const cachedPayload = getContextCachedSemanticPayload(context, filePath, doc.version);
    if (cachedPayload) {
      setCacheEntry(doc.uri, doc.version, cachedPayload.data);
      warmSemanticTokensCache.set(warmKey, cachedPayload.data);
      return true;
    }

    const cachedOccurrences = getContextCachedSemanticOccurrences(context, filePath);
    if (!cachedOccurrences || cachedOccurrences.length === 0) return false;

    const prepared = buildTokensFromOccurrences(doc, cachedOccurrences);
    setCacheEntry(doc.uri, doc.version, prepared.tokens.data);
    warmSemanticTokensCache.set(warmKey, prepared.tokens.data);
    return true;
  }

  function hasContextCachedSemanticsForFile(context: ResolvedContext, filePath: string): boolean {
    const occurrences = getContextCachedSemanticOccurrences(context, filePath);
    return Boolean(occurrences && occurrences.length > 0);
  }

  function refreshSemanticTokensCacheForContext(context: ResolvedContext): void {
    for (const [uri, doc] of input.documents.entries()) {
      const docContext = input.findContextForFile(input.toFsPath(doc.uri));
      if (docContext?.key !== context.key) continue;

      const filePath = input.toFsPath(doc.uri);
      const occurrences = getContextCachedSemanticOccurrences(context, filePath);
      if (!occurrences) {
        semanticTokensCache.delete(uri);
        continue;
      }

      const cachedPayload = getContextCachedSemanticPayload(context, filePath, doc.version);
      const next = setCacheEntry(
        uri,
        doc.version,
        cachedPayload?.data ?? buildTokensFromOccurrences(doc, occurrences).tokens.data
      );
      const warmKey = buildWarmSemanticCacheKey(filePath, context.key, doc.getText());
      warmSemanticTokensCache.set(warmKey, next.data);
    }
  }

  function scheduleRefresh(reason: string, delayMs: number = 75): void {
    if (!input.getWindowFocused()) {
      input.sendLog('debug', `semanticTokens.refresh suppressed reason=${reason} windowFocused=0`);
      return;
    }
    input.semanticRefreshScheduler.schedule(reason, delayMs);
  }

  function clearContextTimers(contextKey: string): void {
    const followup = semanticFollowupTimers.get(contextKey);
    if (followup) {
      clearTimeout(followup);
      semanticFollowupTimers.delete(contextKey);
    }

    const drain = semanticDrainTimers.get(contextKey);
    if (drain) {
      clearTimeout(drain);
      semanticDrainTimers.delete(contextKey);
    }
  }

  function clearAllContextTimers(): void {
    for (const timer of semanticFollowupTimers.values()) clearTimeout(timer);
    semanticFollowupTimers.clear();
    for (const timer of semanticDrainTimers.values()) clearTimeout(timer);
    semanticDrainTimers.clear();
  }

  function disposeDocument(entry: {
    uri: string;
    doc?: TextDocument;
    filePath: string;
    contextKey: string | null;
  }): void {
    if (entry.doc) {
      const warmKey = buildWarmSemanticCacheKey(entry.filePath, entry.contextKey, entry.doc.getText());
      const cached = semanticTokensCache.get(entry.uri);
      if (cached) warmSemanticTokensCache.set(warmKey, cached.data);
    }

    semanticLatestRequestedVersionByUri.delete(entry.uri);
    semanticTokensLastSentByUri.delete(entry.uri);
    invalidateDocument(entry.uri);
    for (const requestId of [...semanticTokensInFlight.keys()]) {
      if (requestId.startsWith(`${entry.uri}:`)) semanticTokensInFlight.delete(requestId);
    }
    if (entry.contextKey) clearContextTimers(entry.contextKey);
  }

  async function getSemanticTokensForDocument(doc: TextDocument): Promise<SemanticTokens> {
    const filePath = input.toFsPath(doc.uri);
    const context = input.findContextForFile(filePath);
    const obs = input.getObservabilitySettingsForFile(filePath);
    const startedAt = performance.now();
    const requestId = `${doc.uri}:${doc.version}`;

    const previousRequestedVersion = semanticLatestRequestedVersionByUri.get(doc.uri) ?? 0;
    if (doc.version > previousRequestedVersion) {
      semanticLatestRequestedVersionByUri.set(doc.uri, doc.version);
    }
    input.observability.log(obs, 'debug', 'semanticTokens.request', {
      id: requestId,
      span: 'semanticTokens.request',
      data: {
        hasContext: Boolean(context),
        contextKey: context?.key ?? null
      }
    });
    let source: SemanticResponseSource = 'public-api';
    let coalesced = false;
    let staleDropped = false;
    let reusedPrevious = false;
    let unchangedSkip = false;
    let remapApplied = false;
    let remapEditsApplied = 0;

    function logSemanticTokensResponse(
      kind: 'full' | 'error',
      tokenCount: number,
      extra?: {
        occurrencesCount?: number;
        semanticBudgetFiles?: number | undefined;
        embeddedSqlHighlightEnabled?: boolean;
        embeddedSqlHighlightCandidateCount?: number;
        embeddedSqlHighlightPublishedCount?: number;
        embeddedSqlHighlightSuppressedCount?: number;
        embeddedSqlHighlightWrapperKind?: string | null;
        embeddedSqlHighlightSourceKind?: string | null;
        embeddedSqlDebugEvents?: EmbeddedSqlDebugEvent[];
        embeddedSqlDebugEventCount?: number;
      }
    ): void {
      let didOpenToFirstSemanticMs: number | undefined;
      if (kind === 'full' && !input.didOpenFirstSemanticPublishedByUri.has(doc.uri)) {
        const openedAt = input.didOpenReceivedAtByUri.get(doc.uri);
        if (openedAt !== undefined) {
          didOpenToFirstSemanticMs = Math.max(0, Date.now() - openedAt);
          input.didOpenFirstSemanticPublishedByUri.add(doc.uri);
        }
      }
      const durationMs = Math.round(performance.now() - startedAt);
      let tokenDecision: TokenDecision = 'fresh';
      let tokenReason: string | null = source;
      if (kind === 'error') {
        tokenDecision = source === 'stale-cancel' ? 'cancel_stale' : 'error';
        tokenReason = source === 'stale-cancel' ? 'stale_payload' : 'provider_error';
      } else if (source === 'stale-cancel') {
        tokenDecision = 'cancel_stale';
        tokenReason = 'stale_payload';
      } else if (staleDropped) {
        tokenDecision = 'drop_transient';
        tokenReason = 'stale_response';
      } else if (
        source === 'cache-hit'
        || source === 'cache-warm-reopen'
        || source === 'context-cache'
        || source === 'stale-reuse'
        || source === 'stale-remap'
        || source === 'unchanged-reuse'
      ) {
        tokenDecision = 'reuse_previous';
        tokenReason = source;
      } else {
        tokenDecision = 'fresh';
        tokenReason = source;
      }
      input.observability.log(
        obs,
        kind === 'full' ? 'debug' : 'warn',
        kind === 'full'
          ? `semanticTokens.response kind=full source=${source} count=${tokenCount}`
          : `semanticTokens.response kind=error source=${source} count=${tokenCount}`,
        {
          id: requestId,
          span: 'semanticTokens.response',
          durationMs,
          data: {
            kind,
            source,
            semanticCacheHit:
              source === 'cache-hit'
              || source === 'cache-warm-reopen'
              || source === 'context-cache'
              || source === 'stale-reuse'
              || source === 'stale-remap'
              || source === 'stale-cancel'
              || source === 'unchanged-reuse',
            tokenCount,
            occurrencesCount: extra?.occurrencesCount ?? 0,
            semanticBudgetFiles: extra?.semanticBudgetFiles,
            contextMatched: Boolean(context),
            didOpenToFirstSemanticMs,
            coalesced,
            staleDropped,
            reusedPrevious,
            unchangedSkip,
            remapApplied,
            remapEditsApplied,
            embeddedSqlHighlightEnabled: extra?.embeddedSqlHighlightEnabled ?? input.isEmbeddedSqlHighlightEnabled(filePath),
            embeddedSqlHighlightCandidateCount: extra?.embeddedSqlHighlightCandidateCount ?? 0,
            embeddedSqlHighlightPublishedCount: extra?.embeddedSqlHighlightPublishedCount ?? 0,
            embeddedSqlHighlightSuppressedCount: extra?.embeddedSqlHighlightSuppressedCount ?? 0,
            embeddedSqlHighlightWrapperKind: extra?.embeddedSqlHighlightWrapperKind ?? null,
            embeddedSqlHighlightSourceKind: extra?.embeddedSqlHighlightSourceKind ?? null,
            embeddedSqlDebugEvents: extra?.embeddedSqlDebugEvents ?? [],
            embeddedSqlDebugEventCount: extra?.embeddedSqlDebugEventCount ?? 0
          }
        }
      );
      input.recordSemanticDecision({
        filePath,
        requestId,
        contextKey: context?.key ?? undefined,
        contextName: context?.name ?? undefined,
        uri: doc.uri,
        docVersion: doc.version,
        tokenCount,
        durationMs,
        decision: tokenDecision,
        reason: tokenReason,
        source,
        kind,
        coalesced,
        staleDropped,
        reusedPrevious,
        remapApplied,
        remapEditsApplied,
        embeddedSqlHighlightEnabled: extra?.embeddedSqlHighlightEnabled ?? input.isEmbeddedSqlHighlightEnabled(filePath),
        embeddedSqlHighlightCandidateCount: extra?.embeddedSqlHighlightCandidateCount ?? 0,
        embeddedSqlHighlightPublishedCount: extra?.embeddedSqlHighlightPublishedCount ?? 0,
        embeddedSqlHighlightSuppressedCount: extra?.embeddedSqlHighlightSuppressedCount ?? 0,
        embeddedSqlHighlightWrapperKind: extra?.embeddedSqlHighlightWrapperKind ?? null,
        embeddedSqlHighlightSourceKind: extra?.embeddedSqlHighlightSourceKind ?? null,
            embeddedSqlDebugEvents: extra?.embeddedSqlDebugEvents ?? [],
            embeddedSqlDebugEventCount: extra?.embeddedSqlDebugEventCount ?? 0
      });
    }

    const inFlight = semanticTokensInFlight.get(requestId);
    if (inFlight) {
      input.observability.log(obs, 'debug', 'semanticTokens.inflightJoin', {
        id: requestId,
        span: 'semanticTokens.inflightJoin',
        data: {
          contextKey: context?.key ?? null
        }
      });
      return inFlight;
    }

    const promise = (async (): Promise<SemanticTokens> => {
      const cached = semanticTokensCache.get(doc.uri);
      if (cached && cached.version === doc.version) {
        source = 'cache-hit';
        logSemanticTokensResponse('full', cached.data.length / 5);
        return { data: cached.data, resultId: cached.resultId ?? `${doc.version}:cache` };
      }
      const warmKey = buildWarmSemanticCacheKey(filePath, context?.key ?? null, doc.getText());
      const warmCached = warmSemanticTokensCache.get(warmKey);
      if (warmCached) {
        source = 'cache-warm-reopen';
        setCacheEntry(doc.uri, doc.version, warmCached.data);
        logSemanticTokensResponse('full', warmCached.data.length / 5);
        return { data: warmCached.data, resultId: `${doc.version}:warm` };
      }

      const exactContextPayload = context ? getContextCachedSemanticPayload(context, filePath, doc.version) : undefined;
      if (exactContextPayload) {
        source = 'context-cache';
        const next = setCacheEntry(doc.uri, doc.version, exactContextPayload.data);
        warmSemanticTokensCache.set(warmKey, next.data);
        logSemanticTokensResponse('full', next.data.length / 5);
        semanticTokensLastSentByUri.set(doc.uri, { resultId: next.resultId, data: next.data });
        return { data: next.data, resultId: next.resultId };
      }

      if (context && doc.version === 1) {
        const cachedOccurrences = getContextCachedSemanticOccurrences(context, filePath);
        if (cachedOccurrences && cachedOccurrences.length > 0) {
          source = 'context-cache';
          const payload = getContextCachedSemanticPayload(context, filePath, doc.version);
          const prepared = payload ? undefined : buildTokensFromOccurrences(doc, cachedOccurrences);
          const next = setCacheEntry(doc.uri, doc.version, payload?.data ?? prepared!.tokens.data);
          warmSemanticTokensCache.set(warmKey, next.data);
          logSemanticTokensResponse('full', next.data.length / 5, {
            occurrencesCount: prepared?.filteredOccurrences.length ?? cachedOccurrences.length,
            embeddedSqlHighlightEnabled: input.isEmbeddedSqlHighlightEnabled(filePath),
            embeddedSqlHighlightCandidateCount: prepared?.embeddedSqlHighlightCandidateCount ?? 0,
            embeddedSqlHighlightPublishedCount: prepared?.embeddedSqlHighlightPublishedCount ?? 0,
            embeddedSqlHighlightSuppressedCount: prepared?.embeddedSqlHighlightSuppressedCount ?? 0,
            embeddedSqlHighlightWrapperKind: prepared?.embeddedSqlHighlightWrapperKind ?? null,
            embeddedSqlHighlightSourceKind: prepared?.embeddedSqlHighlightSourceKind ?? null,
            embeddedSqlDebugEvents: prepared?.embeddedSqlDebugEvents ?? [],
            embeddedSqlDebugEventCount: prepared?.embeddedSqlDebugEventCount ?? 0
          });
          semanticTokensLastSentByUri.set(doc.uri, { resultId: next.resultId, data: next.data });
          return { data: next.data, resultId: next.resultId };
        }
      }

      if (context && isFullCompileQueuedOrRunning(input.fullCompileQueuedByContext, input.fullCompileInFlightByContext, context.key)) {
        coalesced = true;
        const waited = await input.waitForNextContextCompile(context.key, 2000);
        if (waited) {
          const cachedOccurrencesAfter = getContextCachedSemanticOccurrences(context, filePath);
          if (cachedOccurrencesAfter && cachedOccurrencesAfter.length > 0) {
            source = 'context-cache';
            const payload = getContextCachedSemanticPayload(context, filePath, doc.version);
            const prepared = payload ? undefined : buildTokensFromOccurrences(doc, cachedOccurrencesAfter);
            const next = setCacheEntry(doc.uri, doc.version, payload?.data ?? prepared!.tokens.data);
            warmSemanticTokensCache.set(warmKey, next.data);
              logSemanticTokensResponse('full', next.data.length / 5, {
                occurrencesCount: prepared?.filteredOccurrences.length ?? cachedOccurrencesAfter.length,
                embeddedSqlHighlightEnabled: input.isEmbeddedSqlHighlightEnabled(filePath),
                embeddedSqlHighlightCandidateCount: prepared?.embeddedSqlHighlightCandidateCount ?? 0,
                embeddedSqlHighlightPublishedCount: prepared?.embeddedSqlHighlightPublishedCount ?? 0,
                embeddedSqlHighlightSuppressedCount: prepared?.embeddedSqlHighlightSuppressedCount ?? 0,
                embeddedSqlHighlightWrapperKind: prepared?.embeddedSqlHighlightWrapperKind ?? null,
                embeddedSqlHighlightSourceKind: prepared?.embeddedSqlHighlightSourceKind ?? null,
            embeddedSqlDebugEvents: prepared?.embeddedSqlDebugEvents ?? [],
            embeddedSqlDebugEventCount: prepared?.embeddedSqlDebugEventCount ?? 0
              });
            semanticTokensLastSentByUri.set(doc.uri, { resultId: next.resultId, data: next.data });
            return { data: next.data, resultId: next.resultId };
          }
        }
      }

      if (context && doc.version === 1) {
        const lastFullCommitAt = input.fullCompileLastCommittedAtByContext.get(context.key);
        if (lastFullCommitAt !== undefined && Date.now() - lastFullCommitAt <= input.postFullSuppressMs) {
          coalesced = true;

          for (let attempt = 0; attempt < 3; attempt += 1) {
            const cachedOccurrences = getContextCachedSemanticOccurrences(context, filePath);
            if (cachedOccurrences && cachedOccurrences.length > 0) {
              source = 'context-cache';
              const payload = getContextCachedSemanticPayload(context, filePath, doc.version);
              const prepared = payload ? undefined : buildTokensFromOccurrences(doc, cachedOccurrences);
              const next = setCacheEntry(doc.uri, doc.version, payload?.data ?? prepared!.tokens.data);
              warmSemanticTokensCache.set(warmKey, next.data);
              logSemanticTokensResponse('full', next.data.length / 5, {
                occurrencesCount: prepared?.filteredOccurrences.length ?? cachedOccurrences.length,
                embeddedSqlHighlightEnabled: input.isEmbeddedSqlHighlightEnabled(filePath),
                embeddedSqlHighlightCandidateCount: prepared?.embeddedSqlHighlightCandidateCount ?? 0,
                embeddedSqlHighlightPublishedCount: prepared?.embeddedSqlHighlightPublishedCount ?? 0,
                embeddedSqlHighlightSuppressedCount: prepared?.embeddedSqlHighlightSuppressedCount ?? 0,
                embeddedSqlHighlightWrapperKind: prepared?.embeddedSqlHighlightWrapperKind ?? null,
                embeddedSqlHighlightSourceKind: prepared?.embeddedSqlHighlightSourceKind ?? null,
            embeddedSqlDebugEvents: prepared?.embeddedSqlDebugEvents ?? [],
            embeddedSqlDebugEventCount: prepared?.embeddedSqlDebugEventCount ?? 0
              });
              semanticTokensLastSentByUri.set(doc.uri, { resultId: next.resultId, data: next.data });
              return { data: next.data, resultId: next.resultId };
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 120));
          }

          source = 'context-cache';
          logSemanticTokensResponse('full', 0, { occurrencesCount: 0 });
          return { data: [], resultId: `${doc.version}:rid` };
        }
      }

      const lastDidChangeAt = context ? input.getLastDidChangeAt(context.key) : undefined;
      const isTypingDrainActive = lastDidChangeAt !== undefined
        && Date.now() - lastDidChangeAt <= input.typingDrainDelayMs;
      const reuseWindowMs = isTypingDrainActive
        ? input.typingStableWindowMs
        : input.staleReuseWindowMs;
      if (shouldReusePreviousSemanticPayload({
        cachedVersion: cached?.version,
        requestVersion: doc.version,
        lastDidChangeAt,
        nowMs: Date.now(),
        reuseWindowMs
      })) {
        const editBuf = input.semanticTokenEditHistory.get(doc.uri);
        const remapped = cached && editBuf
          ? tryRemapStaleSemanticTokens(cached, doc.version, editBuf.edits, 12)
          : null;
        if (remapped && !remapped.degraded) {
          source = 'stale-remap';
          reusedPrevious = true;
          remapApplied = true;
          remapEditsApplied = remapped.editsApplied;
          input.observability.log(obs, 'debug', 'semanticTokens.staleRemap', {
            id: requestId,
            span: 'semanticTokens.staleRemap',
            data: {
              cachedVersion: cached?.version ?? null,
              requestVersion: doc.version,
              editsApplied: remapped.editsApplied,
              immediate: true
            }
          });
          logSemanticTokensResponse('full', remapped.data.length / 5);
          return { data: remapped.data, resultId: `${doc.version}:remap` };
        }

        if (cached && doc.version > cached.version) {
          source = 'stale-cancel';
          reusedPrevious = true;
          staleDropped = true;
          input.observability.log(obs, 'debug', 'semanticTokens.cancelStale', {
            id: requestId,
            span: 'semanticTokens.cancelStale',
            data: {
              cachedVersion: cached?.version ?? null,
              requestVersion: doc.version,
              immediate: true
            }
          });
          throw new ResponseError(LSPErrorCodes.RequestCancelled, 'stale semantic tokens cancelled');
        }

        source = 'stale-reuse';
        reusedPrevious = true;
        input.observability.log(obs, 'debug', 'semanticTokens.reusePrevious', {
          id: requestId,
          span: 'semanticTokens.reusePrevious',
          data: {
            cachedVersion: cached?.version ?? null,
            requestVersion: doc.version,
            immediate: true
          }
        });
        logSemanticTokensResponse('full', (cached?.data.length ?? 0) / 5);
        return { data: cached?.data ?? [], resultId: cached?.resultId ?? `${doc.version}:reuse` };
      }

      if (shouldCoalesceSemanticRequest({
        lastDidChangeAt,
        nowMs: Date.now(),
        coalesceWindowMs: input.coalesceDelayMs,
        hasExactCache: false,
        hasWarmCache: false
      })) {
        coalesced = true;
        input.observability.log(obs, 'debug', 'semanticTokens.coalesced', {
          id: requestId,
          span: 'semanticTokens.coalesced',
          data: {
            contextKey: context?.key ?? null,
            delayMs: input.coalesceDelayMs
          }
        });
        await new Promise<void>((resolve) => setTimeout(resolve, input.coalesceDelayMs));
      }

      const cachedAfterDelay = semanticTokensCache.get(doc.uri);
      if (shouldReusePreviousSemanticPayload({
        cachedVersion: cachedAfterDelay?.version,
        requestVersion: doc.version,
        lastDidChangeAt,
        nowMs: Date.now(),
        reuseWindowMs
      })) {
        const editBuf = input.semanticTokenEditHistory.get(doc.uri);
        const remapped = cachedAfterDelay && editBuf
          ? tryRemapStaleSemanticTokens(cachedAfterDelay, doc.version, editBuf.edits, 12)
          : null;
        if (remapped && !remapped.degraded) {
          source = 'stale-remap';
          reusedPrevious = true;
          remapApplied = true;
          remapEditsApplied = remapped.editsApplied;
          input.observability.log(obs, 'debug', 'semanticTokens.staleRemap', {
            id: requestId,
            span: 'semanticTokens.staleRemap',
            data: {
              cachedVersion: cachedAfterDelay?.version ?? null,
              requestVersion: doc.version,
              editsApplied: remapped.editsApplied
            }
          });
          logSemanticTokensResponse('full', remapped.data.length / 5);
          return { data: remapped.data, resultId: `${doc.version}:remap` };
        }

        if (cachedAfterDelay && doc.version > cachedAfterDelay.version) {
          source = 'stale-cancel';
          reusedPrevious = true;
          staleDropped = true;
          input.observability.log(obs, 'debug', 'semanticTokens.cancelStale', {
            id: requestId,
            span: 'semanticTokens.cancelStale',
            data: {
              cachedVersion: cachedAfterDelay?.version ?? null,
              requestVersion: doc.version
            }
          });
          throw new ResponseError(LSPErrorCodes.RequestCancelled, 'stale semantic tokens cancelled');
        }

        source = 'stale-reuse';
        reusedPrevious = true;
        input.observability.log(obs, 'debug', 'semanticTokens.reusePrevious', {
          id: requestId,
          span: 'semanticTokens.reusePrevious',
          data: {
            cachedVersion: cachedAfterDelay?.version ?? null,
            requestVersion: doc.version
          }
        });
        logSemanticTokensResponse('full', (cachedAfterDelay?.data.length ?? 0) / 5);
        return { data: cachedAfterDelay?.data ?? [], resultId: `${doc.version}:rid` };
      }

      function finalizeBuiltTokens(
        builtData: number[],
        finalizeInput: {
          occurrencesCount: number;
          semanticBudgetFiles?: number | undefined;
          embeddedSqlHighlightEnabled?: boolean;
          embeddedSqlHighlightCandidateCount?: number;
          embeddedSqlHighlightPublishedCount?: number;
          embeddedSqlHighlightSuppressedCount?: number;
          embeddedSqlHighlightWrapperKind?: string | null;
          embeddedSqlHighlightSourceKind?: string | null;
          embeddedSqlDebugEvents?: EmbeddedSqlDebugEvent[];
          embeddedSqlDebugEventCount?: number;
        }
      ): SemanticTokens {
        const latestRequestedVersion = semanticLatestRequestedVersionByUri.get(doc.uri);
        if (isSemanticResponseStale({ latestRequestedVersion, requestVersion: doc.version })) {
          const fallback = semanticTokensCache.get(doc.uri);
          if (fallback) {
            source = 'stale-reuse';
            staleDropped = true;
            reusedPrevious = true;
            input.observability.log(obs, 'debug', 'semanticTokens.staleDrop', {
              id: requestId,
              span: 'semanticTokens.staleDrop',
              data: {
                requestVersion: doc.version,
                latestRequestedVersion
              }
            });
            logSemanticTokensResponse('full', fallback.data.length / 5, {
              occurrencesCount: 0,
              semanticBudgetFiles: finalizeInput.semanticBudgetFiles,
              embeddedSqlHighlightEnabled: finalizeInput.embeddedSqlHighlightEnabled,
              embeddedSqlHighlightCandidateCount: finalizeInput.embeddedSqlHighlightCandidateCount,
              embeddedSqlHighlightPublishedCount: finalizeInput.embeddedSqlHighlightPublishedCount,
              embeddedSqlHighlightSuppressedCount: finalizeInput.embeddedSqlHighlightSuppressedCount,
              embeddedSqlHighlightWrapperKind: finalizeInput.embeddedSqlHighlightWrapperKind,
              embeddedSqlHighlightSourceKind: finalizeInput.embeddedSqlHighlightSourceKind,
              embeddedSqlDebugEvents: finalizeInput.embeddedSqlDebugEvents,
              embeddedSqlDebugEventCount: finalizeInput.embeddedSqlDebugEventCount
            });
            semanticTokensLastSentByUri.set(doc.uri, { resultId: fallback.resultId, data: fallback.data });
            return { data: fallback.data, resultId: fallback.resultId ?? `${doc.version}:fallback` };
          }
        }

        const nextFingerprint = buildSemanticPayloadFingerprint(builtData);
        const previous = semanticTokensCache.get(doc.uri);
        if (previous && previous.fingerprint === nextFingerprint) {
          source = 'unchanged-reuse';
          unchangedSkip = true;
          input.observability.log(obs, 'debug', 'semanticTokens.unchangedSkip', {
            id: requestId,
            span: 'semanticTokens.unchangedSkip',
            data: {
              requestVersion: doc.version,
              previousVersion: previous.version
            }
          });
          const reused = setCacheEntry(doc.uri, doc.version, previous.data);
          warmSemanticTokensCache.set(warmKey, reused.data);
          logSemanticTokensResponse('full', reused.data.length / 5, {
            occurrencesCount: finalizeInput.occurrencesCount,
            semanticBudgetFiles: finalizeInput.semanticBudgetFiles,
            embeddedSqlHighlightEnabled: finalizeInput.embeddedSqlHighlightEnabled,
            embeddedSqlHighlightCandidateCount: finalizeInput.embeddedSqlHighlightCandidateCount,
            embeddedSqlHighlightPublishedCount: finalizeInput.embeddedSqlHighlightPublishedCount,
            embeddedSqlHighlightSuppressedCount: finalizeInput.embeddedSqlHighlightSuppressedCount,
            embeddedSqlHighlightWrapperKind: finalizeInput.embeddedSqlHighlightWrapperKind,
            embeddedSqlHighlightSourceKind: finalizeInput.embeddedSqlHighlightSourceKind,
              embeddedSqlDebugEvents: finalizeInput.embeddedSqlDebugEvents,
              embeddedSqlDebugEventCount: finalizeInput.embeddedSqlDebugEventCount
          });
          semanticTokensLastSentByUri.set(doc.uri, { resultId: reused.resultId, data: reused.data });
          return { data: reused.data, resultId: reused.resultId ?? `${doc.version}:reused` };
        }

        const next = setCacheEntry(doc.uri, doc.version, builtData);
        warmSemanticTokensCache.set(warmKey, next.data);
        logSemanticTokensResponse('full', next.data.length / 5, {
          occurrencesCount: finalizeInput.occurrencesCount,
          semanticBudgetFiles: finalizeInput.semanticBudgetFiles,
          embeddedSqlHighlightEnabled: finalizeInput.embeddedSqlHighlightEnabled,
          embeddedSqlHighlightCandidateCount: finalizeInput.embeddedSqlHighlightCandidateCount,
          embeddedSqlHighlightPublishedCount: finalizeInput.embeddedSqlHighlightPublishedCount,
          embeddedSqlHighlightSuppressedCount: finalizeInput.embeddedSqlHighlightSuppressedCount,
          embeddedSqlHighlightWrapperKind: finalizeInput.embeddedSqlHighlightWrapperKind,
          embeddedSqlHighlightSourceKind: finalizeInput.embeddedSqlHighlightSourceKind,
              embeddedSqlDebugEvents: finalizeInput.embeddedSqlDebugEvents,
              embeddedSqlDebugEventCount: finalizeInput.embeddedSqlDebugEventCount
        });
        semanticTokensLastSentByUri.set(doc.uri, { resultId: next.resultId, data: next.data });
        return { data: next.data, resultId: next.resultId };
      }

      try {
        if (!context) {
          source = 'fallback-compile';
          const result = await input.compileFallbackDocument(doc, true);
          const entries = result.semanticsByFile;
          if (!entries) {
            logSemanticTokensResponse('full', 0);
            return { data: [], resultId: `${doc.version}:rid` };
          }
          const prepared = buildTokensFromOccurrences(doc, getOccurrencesFromMap(entries, filePath) ?? []);
          return finalizeBuiltTokens(prepared.tokens.data, {
            occurrencesCount: prepared.filteredOccurrences.length,
            embeddedSqlHighlightEnabled: input.isEmbeddedSqlHighlightEnabled(filePath),
            embeddedSqlHighlightCandidateCount: prepared.embeddedSqlHighlightCandidateCount,
            embeddedSqlHighlightPublishedCount: prepared.embeddedSqlHighlightPublishedCount,
            embeddedSqlHighlightSuppressedCount: prepared.embeddedSqlHighlightSuppressedCount,
            embeddedSqlHighlightWrapperKind: prepared.embeddedSqlHighlightWrapperKind,
            embeddedSqlHighlightSourceKind: prepared.embeddedSqlHighlightSourceKind,
            embeddedSqlDebugEvents: prepared.embeddedSqlDebugEvents,
            embeddedSqlDebugEventCount: prepared.embeddedSqlDebugEventCount
          });
        }

        const forceRefreshFiles = input.forceRefreshFilesByContext.delete(context.key);
        const options: EnsureCompileOptions = {
          reason: 'semantics',
          changedFilePaths: [filePath],
          prefixUntilTarget: true,
          includeSemantics: true,
          includeSymbols: false,
          forceRefreshFiles
        };
        if (lastDidChangeAt !== undefined && Date.now() - lastDidChangeAt <= input.typingDrainDelayMs) {
          options.semanticBudgetFiles = input.typingSemanticBudgetFiles;
        }
        const snapshot = await input.publicCompiler.ensureCompiledForFile(
          context,
          filePath,
          input.buildOverridesForContext(context),
          options
        );
        const occurrences = input.publicCompiler.getSemanticsForFile(snapshot, filePath);
        if (!occurrences) {
          logSemanticTokensResponse('full', 0, { semanticBudgetFiles: options.semanticBudgetFiles });
          return { data: [], resultId: `${doc.version}:rid` };
        }
        const prepared = buildTokensFromOccurrences(doc, occurrences);
        return finalizeBuiltTokens(prepared.tokens.data, {
          occurrencesCount: prepared.filteredOccurrences.length,
          semanticBudgetFiles: options.semanticBudgetFiles,
          embeddedSqlHighlightEnabled: input.isEmbeddedSqlHighlightEnabled(filePath),
          embeddedSqlHighlightCandidateCount: prepared.embeddedSqlHighlightCandidateCount,
          embeddedSqlHighlightPublishedCount: prepared.embeddedSqlHighlightPublishedCount,
          embeddedSqlHighlightSuppressedCount: prepared.embeddedSqlHighlightSuppressedCount,
          embeddedSqlHighlightWrapperKind: prepared.embeddedSqlHighlightWrapperKind,
          embeddedSqlHighlightSourceKind: prepared.embeddedSqlHighlightSourceKind,
            embeddedSqlDebugEvents: prepared.embeddedSqlDebugEvents,
            embeddedSqlDebugEventCount: prepared.embeddedSqlDebugEventCount
        });
      } catch (error) {
        logSemanticTokensResponse('error', 0);
        throw error;
      }
    })();

    semanticTokensInFlight.set(requestId, promise);
    try {
      return await promise;
    } finally {
      semanticTokensInFlight.delete(requestId);
    }
  }

  function reset(): void {
    semanticTokensCache.clear();
    semanticTokensInFlight.clear();
    semanticLatestRequestedVersionByUri.clear();
    semanticTokensLastSentByUri.clear();
    clearAllContextTimers();
  }

  return {
    state: {
      semanticTokensCache,
      semanticTokensInFlight,
      semanticLatestRequestedVersionByUri,
      semanticTokensLastSentByUri,
      warmSemanticTokensCache,
      semanticFollowupTimers,
      semanticDrainTimers
    },
    invalidateDocument,
    setCacheEntry,
    buildTokensFromOccurrences,
    getOccurrencesFromMap,
    getContextCachedSemanticPayload,
    getContextCachedSemanticOccurrences,
    buildContextSemanticPayloadByFile,
    prewarmOnDidOpen,
    hasContextCachedSemanticsForFile,
    refreshSemanticTokensCacheForContext,
    scheduleRefresh,
    clearContextTimers,
    clearAllContextTimers,
    disposeDocument,
    getSemanticTokensForDocument,
    reset
  };
}
