import { performance } from 'node:perf_hooks';
import type { Diagnostic } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { ContextCache, ResolvedContext } from '../server-runtime';
import { shouldForceDirectCompileForZero } from './pull-diagnostics-context-guards';
import { shouldScheduleNonAuthoritativeFollowup } from './pull-diagnostics-followup-guards';
import type { PullDiagnosticsRuntime } from './pull-diagnostics-runtime';

type PullDiagnosticsSnapshotSource =
  | 'public-api'
  | 'context-projected'
  | 'fallback-compile'
  | 'boot-empty'
  | 'persisted-cache';

export type StablePullDiagnosticsSnapshot = {
  contextKey: string;
  dirtyStamp: number;
  resultId: string;
  hash: string;
  diagnostics: Diagnostic[];
  reportedAtMs: number;
};

export type LastNonEmptyPullDiagnosticsSnapshot = {
  contextKey: string;
  dirtyStamp: number | null;
  resultId: string;
  hash: string;
  diagnostics: Diagnostic[];
  reportedAtMs: number;
};

type RecentZeroPullDiagnosticsSnapshot = {
  contextKey: string;
  docHash: string;
  docVersion: number;
  observedAtMs: number;
  source: PullDiagnosticsSnapshotSource;
};

type ContextFileProjection = {
  knownFile: boolean;
  diagnostics: Diagnostic[];
  authoritative: boolean;
};

type PullDiagnosticsComputeResult = {
  diagnostics: Diagnostic[];
  source: PullDiagnosticsSnapshotSource;
  cacheHit: boolean;
  contextMatched: boolean;
  contextKey: string;
  contextName: string;
  dirtyStamp: number | null;
  isPrefix: boolean;
  isAuthoritative: boolean;
  contextProjectionKnownFile?: boolean | null;
  contextProjectionDiagnosticsCount?: number | null;
  contextProjectionAuthoritative?: boolean | null;
  contextProjectionBranch?: string | null;
  contextCompilerDiagnosticsCount?: number | null;
  contextCacheLastCompileWasPrefix?: boolean | null;
  contextCacheCommittedAtMs?: number | null;
};

type PullDiagnosticsPersistedCacheEntry = {
  resultId: string;
  hash: string;
  diagnostics: Diagnostic[];
};

type PullDiagnosticsContextProjectionLogData = {
  uri: string;
  filePath: string;
  contextKey: string;
  dirtyStamp: number;
  branch: string;
  knownFile: boolean | null;
  projectedDiagnosticsCount: number | null;
  projectedAuthoritative: boolean | null;
  projectedEffectivelyAuthoritative: boolean;
  contextCompilerDiagnosticsCount: number | null;
  contextCacheLastCompileWasPrefix: boolean | null;
  contextCacheCommittedAtMs: number | null;
  selectedSource: PullDiagnosticsSnapshotSource;
  selectedDiagnosticsCount: number;
  selectedAuthoritative: boolean;
  recentZeroObservation: boolean;
  hadPendingOrRecentFollowup?: boolean;
};

type PullDiagnosticsContextProjectionResolution = {
  result: PullDiagnosticsComputeResult | null;
  ensureScheduled: boolean;
  continueWithEmptyProjection: boolean;
};

type PullDiagnosticsPersistedResolution =
  | {
    kind: 'bypass';
    resultId: string;
    hash: string;
    diagnostics: Diagnostic[];
    source: 'context-projected' | 'fallback-compile';
    cacheHit: boolean;
    isAuthoritative: boolean;
    dirtyStamp: number;
    persistedDiagnosticsCount: number;
    committedKnownFile: boolean;
    committedAuthoritative: boolean;
    committedDiagnosticsCount: number;
    compilerDiagnosticsCount: number;
  }
  | {
    kind: 'guarded-zero';
    resultId: string;
    hash: string;
    diagnostics: Diagnostic[];
    dirtyStamp: number;
    scheduledFollowup: boolean;
    didOpenAgeMs: number;
    persistedDiagnosticsCount: number;
    reusedSnapshotNonEmpty: number;
  }
  | {
    kind: 'persisted';
    resultId: string;
    hash: string;
    diagnostics: Diagnostic[];
    dirtyStamp: number;
    scheduledFollowup: boolean;
  };

type PullDiagnosticsPersistCacheLike = {
  getValidated(entry: {
    uri: string;
    workspaceKey: string;
    contextKey: string;
    contextSignature: string;
    fileHash: string;
    contextRevision: number;
  }): PullDiagnosticsPersistedCacheEntry | null;
  set(entry: {
    uri: string;
    filePath: string;
    workspaceKey: string;
    contextKey: string;
    contextSignature: string;
    fileHash: string;
    contextRevision: number;
    resultId: string;
    hash: string;
    diagnostics: Diagnostic[];
    updatedAtMs: number;
  }): void;
  flush(): Promise<void> | void;
};

const EMPTY_CONTEXT_FILE_PROJECTION: ContextFileProjection = {
  knownFile: false,
  diagnostics: [],
  authoritative: false
};

export function createPullDiagnosticsService(input: {
  documents: Map<string, TextDocument>;
  contextDocs: Map<string, Set<string>>;
  runtime: PullDiagnosticsRuntime;
  toFsPath(uri: string): string;
  normalizePathKey(filePath: string): string;
  getIgnoredForContext(context: ResolvedContext): Set<string>;
  applyIgnoreIdsToLspDiagnostics(diagnostics: Diagnostic[], ignoreIds: Set<string>): Diagnostic[];
  projectCompilerDiagnosticsForFile(diagnostics: ContextCache['compilerDiagnostics'], filePath: string): Diagnostic[];
  getPersistCache(): PullDiagnosticsPersistCacheLike;
  resolveWorkspaceKey(filePath: string): string;
  buildContextSignature(context: ResolvedContext): string;
  computeDocHash(doc: TextDocument): string;
  getPersistContextRevision(contextKey: string): number;
  getDirtyStamp(contextKey: string): number;
  prewarmDelayMs: number;
  shouldSkipDidOpenPrewarm(contextKey: string): boolean;
  prewarmDiagnostics(context: ResolvedContext, doc: TextDocument): Promise<Diagnostic[]>;
  sendDebugLog(filePath: string | null, message: string): void;
  zeroObservationWindowMs: number;
  getLastFullCompileCommittedAt(contextKey: string): number | undefined;
  getLastDidChangeAtByUri(uri: string): number;
  hasRecentEditBurst(uri: string): boolean;
  recentCommitWindowMs: number;
  didOpenZeroFollowupWindowMs: number;
  getContextCache(contextKey: string): ContextCache | undefined;
  hasActiveContextCompileSignal(contextKey: string): boolean;
  logContextProjectionSelected(data: PullDiagnosticsContextProjectionLogData): void;
  hasPendingOrRecentFollowupForUri(contextKey: string, uri: string): boolean;
  shouldScheduleFollowup(contextKey: string, uri: string, dirtyStamp: number, reason: string): boolean;
  scheduleFollowup(context: ResolvedContext, uri: string, filePath: string, docVersion: number | undefined, delayMs: number): void;
  computeDiagnosticsDirectlyForPull(context: ResolvedContext, filePath: string, doc: TextDocument | undefined, forceRefreshFiles: boolean): Promise<Diagnostic[]>;
  getIgnoredForWorkspace(workspaceUri?: string): Set<string>;
  compileFallbackDocument(doc: TextDocument, includeSemantics: boolean): Promise<{ diagnostics: Array<{ code?: string | number; message: string; severity?: string; range: Diagnostic['range'] }> }>;
  toLspDiagnostic(diag: { code?: string | number; message: string; severity?: string; range: Diagnostic['range'] }): Diagnostic;
  schedulePullDiagnosticsRefresh(reason: string, workspaceUri?: string): void;
}) {
  const pullDiagCache = input.runtime.pullDiagCache;
  const pullDiagLastItems = input.runtime.pullDiagLastItems;
  const pullDiagPrewarmByUri = input.runtime.pullDiagPrewarmByUri;
  const pullDiagPrewarmTimers = input.runtime.pullDiagPrewarmTimers;
  const pullDiagPrewarmInFlight = input.runtime.pullDiagPrewarmInFlight;
  const pullDiagStableByUri = input.runtime.pullDiagStableByUri as Map<string, StablePullDiagnosticsSnapshot>;
  const pullDiagLastNonEmptyByUri = input.runtime.pullDiagLastNonEmptyByUri as Map<string, LastNonEmptyPullDiagnosticsSnapshot>;
  const pullDiagRecentZeroByUri = new Map<string, RecentZeroPullDiagnosticsSnapshot>();
  const pullDiagComputeInFlight = new Map<string, Promise<PullDiagnosticsComputeResult>>();

  function hashDiagnostics(diags: Diagnostic[]): string {
    const parts: string[] = [];
    for (const d of diags) {
      const r = d.range;
      parts.push([
        String(d.code ?? ''),
        String(d.severity ?? ''),
        r.start.line,
        r.start.character,
        r.end.line,
        r.end.character,
        d.message
      ].join('|'));
    }
    let h = 5381;
    const s = parts.join('\n');
    for (let i = 0; i < s.length; i += 1) {
      h = (h * 33) ^ s.charCodeAt(i);
    }
    return (h >>> 0).toString(16);
  }

  function findDiagnosticsInContextCache(cache: ContextCache, filePath: string): { knownFile: boolean; diagnostics: Diagnostic[] } {
    const fileKey = input.normalizePathKey(filePath);
    const direct = cache.diagnosticsByFile.get(fileKey) ?? cache.diagnosticsByFile.get(filePath);
    if (direct) return { knownFile: true, diagnostics: direct };

    if (cache.compilerDiagnostics.length > 0) {
      const projected = input.projectCompilerDiagnosticsForFile(cache.compilerDiagnostics, filePath);
      if (projected.length > 0) return { knownFile: true, diagnostics: projected };
    }

    for (const entryPath of cache.files) {
      if (input.normalizePathKey(entryPath) === fileKey) {
        return { knownFile: true, diagnostics: [] };
      }
    }

    return { knownFile: false, diagnostics: [] };
  }

  function projectCommittedDiagnosticsForFile(cache: ContextCache, filePath: string): { knownFile: boolean; diagnostics: Diagnostic[] } {
    const direct = findDiagnosticsInContextCache(cache, filePath);
    if (direct.knownFile) return direct;

    const fileKey = input.normalizePathKey(filePath);
    for (const entryPath of cache.files) {
      if (input.normalizePathKey(entryPath) === fileKey) {
        return { knownFile: true, diagnostics: [] };
      }
    }
    return { knownFile: false, diagnostics: [] };
  }

  function buildContextFileProjection(cache: ContextCache | undefined, filePath: string): ContextFileProjection {
    if (!cache) return EMPTY_CONTEXT_FILE_PROJECTION;
    const projected = projectCommittedDiagnosticsForFile(cache, filePath);
    return {
      knownFile: projected.knownFile,
      diagnostics: projected.diagnostics,
      authoritative: projected.knownFile && !cache.lastCompileWasPrefix
    };
  }

  function getRecentZeroObservation(
    uri: string,
    contextKey: string,
    docHash: string | null,
    latestContextFullCommitAtMs = 0
  ): RecentZeroPullDiagnosticsSnapshot | null {
    if (!docHash) return null;
    const entry = pullDiagRecentZeroByUri.get(uri) ?? null;
    if (!entry) return null;
    if (entry.contextKey !== contextKey || entry.docHash !== docHash) {
      return null;
    }
    if (latestContextFullCommitAtMs > entry.observedAtMs) {
      pullDiagRecentZeroByUri.delete(uri);
      return null;
    }
    if (Date.now() - entry.observedAtMs > input.zeroObservationWindowMs) {
      pullDiagRecentZeroByUri.delete(uri);
      return null;
    }
    return entry;
  }

  function rememberRecentZero(
    uri: string,
    contextKey: string,
    docHash: string,
    docVersion: number,
    source: PullDiagnosticsSnapshotSource
  ): void {
    pullDiagRecentZeroByUri.set(uri, {
      contextKey,
      docHash,
      docVersion,
      observedAtMs: Date.now(),
      source
    });
  }

  function clearRecentZero(uri: string, contextKey: string, docHash: string | null): void {
    const entry = pullDiagRecentZeroByUri.get(uri);
    if (!entry) return;
    if (entry.contextKey !== contextKey) return;
    if (docHash !== null && entry.docHash !== docHash) return;
    pullDiagRecentZeroByUri.delete(uri);
  }

  function materializeSnapshotsForContext(
    context: ResolvedContext,
    cache: ContextCache,
    authoritative: boolean
  ): void {
    const uris = input.contextDocs.get(context.key);
    if (!uris || uris.size === 0) return;
    const dirtyStamp = input.getDirtyStamp(context.key);
    const snapshotAt = performance.now();
    const ignored = input.getIgnoredForContext(context);
    for (const uri of uris) {
      const doc = input.documents.get(uri);
      if (!doc) continue;
      const filePath = input.toFsPath(uri);
      const match = findDiagnosticsInContextCache(cache, filePath);
      if (!match.knownFile) continue;
      const diagnostics = input.applyIgnoreIdsToLspDiagnostics(match.diagnostics, ignored);
      const hash = hashDiagnostics(diagnostics);
      const resultId = `${doc.version}:${hash}`;
      if (authoritative) {
        pullDiagStableByUri.set(uri, {
          contextKey: context.key,
          dirtyStamp,
          resultId,
          hash,
          diagnostics,
          reportedAtMs: snapshotAt
        });
        input.getPersistCache().set({
          uri,
          filePath: input.normalizePathKey(filePath),
          workspaceKey: input.resolveWorkspaceKey(filePath),
          contextKey: context.key,
          contextSignature: input.buildContextSignature(context),
          fileHash: input.computeDocHash(doc),
          contextRevision: input.getPersistContextRevision(context.key),
          resultId,
          hash,
          diagnostics,
          updatedAtMs: Date.now()
        });
        void input.getPersistCache().flush();
      }
      if (authoritative || diagnostics.length > 0) {
        pullDiagCache.set(uri, { resultId, hash });
        pullDiagLastItems.set(uri, diagnostics);
      }
      if (diagnostics.length > 0) {
        pullDiagLastNonEmptyByUri.set(uri, {
          contextKey: context.key,
          dirtyStamp,
          resultId,
          hash,
          diagnostics,
          reportedAtMs: snapshotAt
        });
      }
    }
  }

  async function resolveNoContextDiagnostics(inputData: {
    filePath: string;
    workspaceUri?: string;
    doc?: TextDocument;
    booting: boolean;
    refreshInProgress: boolean;
  }): Promise<PullDiagnosticsComputeResult> {
    let diagnostics: Diagnostic[] = [];
    let source: PullDiagnosticsSnapshotSource = 'fallback-compile';
    const cacheHit = false;
    let isPrefix = false;
    let isAuthoritative = false;

    if (inputData.booting || inputData.refreshInProgress) {
      input.schedulePullDiagnosticsRefresh('booting-no-context', inputData.workspaceUri);
      diagnostics = [];
      source = 'boot-empty';
      isPrefix = true;
      isAuthoritative = false;
    } else if (inputData.doc) {
      const ignored = input.getIgnoredForWorkspace(inputData.workspaceUri);
      const result = await input.compileFallbackDocument(inputData.doc, false);
      diagnostics = result.diagnostics
        .filter((diag) =>
        {
          const id = String(diag.code ?? '');
          return !id || !ignored.has(id.toLowerCase());
        })
        .map((diag) => input.toLspDiagnostic(diag));
      source = 'fallback-compile';
      isPrefix = false;
      isAuthoritative = true;
    }

    return {
      diagnostics,
      source,
      cacheHit,
      contextMatched: false,
      contextKey: '__fallback__',
      contextName: 'SingleFile/Fallback',
      dirtyStamp: null,
      isPrefix,
      isAuthoritative
    };
  }

  async function resolvePersistedDiagnostics(inputData: {
    context: ResolvedContext;
    uri: string;
    filePath: string;
    doc: TextDocument;
    previousResultId?: string;
    didOpenReceivedAt?: number;
    stableBeforeCompute: StablePullDiagnosticsSnapshot | undefined;
  }): Promise<PullDiagnosticsPersistedResolution | null> {
    const persisted = input.getPersistCache().getValidated({
      uri: inputData.uri,
      workspaceKey: input.resolveWorkspaceKey(inputData.filePath),
      contextKey: inputData.context.key,
      contextSignature: input.buildContextSignature(inputData.context),
      fileHash: input.computeDocHash(inputData.doc),
      contextRevision: input.getPersistContextRevision(inputData.context.key)
    });
    if (!persisted) return null;

    const dirtyStamp = input.getDirtyStamp(inputData.context.key);
    const didOpenAgeMs = inputData.didOpenReceivedAt === undefined ? null : Date.now() - inputData.didOpenReceivedAt;
    const lastNonEmpty = pullDiagLastNonEmptyByUri.get(inputData.uri);
    const committed = input.getContextCache(inputData.context.key);
    const committedProjection = buildContextFileProjection(committed, inputData.filePath);
    const committedIgnored = input.getIgnoredForContext(inputData.context);
    const committedProjectionDiagnostics = committedProjection.knownFile
      ? input.applyIgnoreIdsToLspDiagnostics(committedProjection.diagnostics, committedIgnored)
      : [];
    const fullCommitAt = input.getLastFullCompileCommittedAt(inputData.context.key) ?? 0;
    const recentAuthoritativeCommit = Boolean(
      committed
      && committed.lastCompileWasPrefix === false
      && fullCommitAt > 0
      && Date.now() - fullCommitAt <= input.didOpenZeroFollowupWindowMs
    );
    const reusablePersistedZeroSnapshot = [inputData.stableBeforeCompute, lastNonEmpty].find((snapshot) =>
      Boolean(
        snapshot
        && snapshot.contextKey === inputData.context.key
        && snapshot.dirtyStamp === dirtyStamp
        && snapshot.diagnostics.length > 0
      )
    );
    const shouldGuardPersistedZero = Boolean(
      persisted.diagnostics.length === 0
      && didOpenAgeMs !== null
      && didOpenAgeMs <= input.didOpenZeroFollowupWindowMs
    );
    const shouldBypassPersistedZeroAfterAuthoritativeCommit = Boolean(
      persisted.diagnostics.length === 0
      && persisted.resultId.startsWith(`${inputData.doc.version}:`)
      && recentAuthoritativeCommit
      && !input.hasPendingOrRecentFollowupForUri(inputData.context.key, inputData.uri)
    );

    if (shouldBypassPersistedZeroAfterAuthoritativeCommit) {
      let bypassDiagnostics = committedProjectionDiagnostics;
      let bypassSource: 'context-projected' | 'fallback-compile' = 'context-projected';
      let bypassCacheHit = committedProjection.knownFile;
      let bypassAuthoritative = Boolean(committedProjection.knownFile && committed?.lastCompileWasPrefix === false);

      if (committedProjection.knownFile && bypassDiagnostics.length === 0 && (committed?.compilerDiagnostics.length ?? 0) > 0) {
        bypassDiagnostics = await input.computeDiagnosticsDirectlyForPull(inputData.context, inputData.filePath, inputData.doc, false);
        bypassSource = 'fallback-compile';
        bypassCacheHit = bypassDiagnostics.length > 0;
        bypassAuthoritative = true;
      }

      const bypassHash = hashDiagnostics(bypassDiagnostics);
      const bypassResultId = `${inputData.doc.version}:${bypassHash}`;
      pullDiagCache.set(inputData.uri, { resultId: bypassResultId, hash: bypassHash });
      if (bypassAuthoritative) {
        pullDiagStableByUri.set(inputData.uri, {
          contextKey: inputData.context.key,
          dirtyStamp,
          resultId: bypassResultId,
          hash: bypassHash,
          diagnostics: bypassDiagnostics,
          reportedAtMs: performance.now()
        });
      }
      return {
        kind: 'bypass',
        resultId: bypassResultId,
        hash: bypassHash,
        diagnostics: bypassDiagnostics,
        source: bypassSource,
        cacheHit: bypassCacheHit,
        isAuthoritative: bypassAuthoritative,
        dirtyStamp,
        persistedDiagnosticsCount: persisted.diagnostics.length,
        committedKnownFile: committedProjection.knownFile,
        committedAuthoritative: committedProjection.authoritative,
        committedDiagnosticsCount: committedProjectionDiagnostics.length,
        compilerDiagnosticsCount: committed?.compilerDiagnostics.length ?? 0
      };
    }

    if (shouldGuardPersistedZero) {
      const scheduledPersistedZeroFollowup = input.shouldScheduleFollowup(inputData.context.key, inputData.uri, dirtyStamp, 'persistedZero');
      if (scheduledPersistedZeroFollowup) {
        input.scheduleFollowup(inputData.context, inputData.uri, inputData.filePath, inputData.doc.version, 0);
      }
      if (reusablePersistedZeroSnapshot) {
        pullDiagCache.set(inputData.uri, { resultId: reusablePersistedZeroSnapshot.resultId, hash: reusablePersistedZeroSnapshot.hash });
        pullDiagLastItems.set(inputData.uri, reusablePersistedZeroSnapshot.diagnostics);
        return {
          kind: 'guarded-zero',
          resultId: reusablePersistedZeroSnapshot.resultId,
          hash: reusablePersistedZeroSnapshot.hash,
          diagnostics: reusablePersistedZeroSnapshot.diagnostics,
          dirtyStamp,
          scheduledFollowup: scheduledPersistedZeroFollowup,
          didOpenAgeMs: didOpenAgeMs ?? 0,
          persistedDiagnosticsCount: persisted.diagnostics.length,
          reusedSnapshotNonEmpty: reusablePersistedZeroSnapshot.diagnostics.length
        };
      }
    }

    const scheduledFollowup = !input.hasPendingOrRecentFollowupForUri(inputData.context.key, inputData.uri)
      && input.shouldScheduleFollowup(inputData.context.key, inputData.uri, dirtyStamp, 'prefixCommitted');
    if (scheduledFollowup) {
      input.scheduleFollowup(inputData.context, inputData.uri, inputData.filePath, inputData.doc.version, 0);
    }
    pullDiagCache.set(inputData.uri, { resultId: persisted.resultId, hash: persisted.hash });
    pullDiagLastItems.set(inputData.uri, persisted.diagnostics);
    return {
      kind: 'persisted',
      resultId: persisted.resultId,
      hash: persisted.hash,
      diagnostics: persisted.diagnostics,
      dirtyStamp,
      scheduledFollowup
    };
  }

  async function resolveContextProjectionDiagnostics(inputData: {
    context: ResolvedContext;
    uri: string;
    filePath: string;
    doc?: TextDocument;
    forceRefreshFiles: boolean;
    contextKeyForResponse: string;
    contextNameForResponse: string;
  }): Promise<PullDiagnosticsContextProjectionResolution> {
    const dirtyStamp = input.getDirtyStamp(inputData.context.key);
    const dirtyStampAtStart = dirtyStamp;
    const isSameDirtyStamp = () => input.getDirtyStamp(inputData.context.key) === dirtyStampAtStart;
    const hasRecentContextCompileSignal = () =>
      input.hasActiveContextCompileSignal(inputData.context.key) || (() => {
        const lastCommittedAt = input.getLastFullCompileCommittedAt(inputData.context.key);
        if (lastCommittedAt === undefined) return false;
        return Date.now() - lastCommittedAt <= input.recentCommitWindowMs;
      })();
    const stable = pullDiagStableByUri.get(inputData.uri);
    const stableIsFresh = Boolean(stable && stable.contextKey === inputData.context.key && stable.dirtyStamp === dirtyStamp);
    const stableVersionPrefix = `${inputData.doc?.version ?? 0}:`;
    const stableMatchesCurrentVersion = Boolean(stable && stable.resultId.startsWith(stableVersionPrefix));
    const currentDocHash = inputData.doc ? input.computeDocHash(inputData.doc) : null;
    const lastUriDidChangeAt = input.getLastDidChangeAtByUri(inputData.uri);
    const lastFullCommitAt = input.getLastFullCompileCommittedAt(inputData.context.key) ?? 0;
    const hasRecentUriEditSinceLastFullCommit = lastUriDidChangeAt > 0 && lastUriDidChangeAt > lastFullCommitAt;
    const recentZeroObservation = getRecentZeroObservation(inputData.uri, inputData.context.key, currentDocHash, lastFullCommitAt);
    const committedSnapshotForStableGuard = inputData.forceRefreshFiles ? undefined : input.getContextCache(inputData.context.key);
    const committedProjectionForStableGuard = committedSnapshotForStableGuard
      ? buildContextFileProjection(committedSnapshotForStableGuard, inputData.filePath)
      : EMPTY_CONTEXT_FILE_PROJECTION;
    const stableZeroSupersededByCommittedDiagnostics = Boolean(
      stable
      && stable.diagnostics.length === 0
      && committedProjectionForStableGuard.knownFile
      && committedProjectionForStableGuard.authoritative
      && committedProjectionForStableGuard.diagnostics.length > 0
      && !hasRecentUriEditSinceLastFullCommit
    );
    const lastNonEmpty = pullDiagLastNonEmptyByUri.get(inputData.uri);
    const hasSameDirtyNonEmptySnapshotForContext = Boolean(
      (stable && stable.contextKey === inputData.context.key && stable.dirtyStamp === dirtyStamp && stable.diagnostics.length > 0)
      || (lastNonEmpty && lastNonEmpty.contextKey === inputData.context.key && lastNonEmpty.dirtyStamp === dirtyStamp && lastNonEmpty.diagnostics.length > 0)
    );
    if (!inputData.forceRefreshFiles && stable && stableIsFresh && stableMatchesCurrentVersion && !hasRecentUriEditSinceLastFullCommit && !stableZeroSupersededByCommittedDiagnostics) {
      input.logContextProjectionSelected({
        uri: inputData.uri,
        filePath: inputData.filePath,
        contextKey: inputData.context.key,
        dirtyStamp,
        branch: 'stableFresh',
        knownFile: null,
        projectedDiagnosticsCount: null,
        projectedAuthoritative: null,
        projectedEffectivelyAuthoritative: true,
        contextCompilerDiagnosticsCount: null,
        contextCacheLastCompileWasPrefix: null,
        contextCacheCommittedAtMs: null,
        selectedSource: 'context-projected',
        selectedDiagnosticsCount: stable.diagnostics.length,
        selectedAuthoritative: true,
        recentZeroObservation: Boolean(recentZeroObservation)
      });
      return {
        result: {
          diagnostics: stable.diagnostics,
          source: 'context-projected',
          cacheHit: true,
          contextMatched: true,
          contextKey: inputData.contextKeyForResponse,
          contextName: inputData.contextNameForResponse,
          dirtyStamp,
          isPrefix: false,
          isAuthoritative: true,
          contextProjectionKnownFile: null,
          contextProjectionDiagnosticsCount: null,
          contextProjectionAuthoritative: null,
          contextProjectionBranch: 'stableFresh',
          contextCompilerDiagnosticsCount: null,
          contextCacheLastCompileWasPrefix: null,
          contextCacheCommittedAtMs: null
        },
        ensureScheduled: false,
        continueWithEmptyProjection: false
      };
    }

    const committed = input.getContextCache(inputData.context.key);
    const projectedFromContext = buildContextFileProjection(inputData.forceRefreshFiles ? undefined : committed, inputData.filePath);
    const committedForFile = !inputData.forceRefreshFiles && committed
      ? findDiagnosticsInContextCache(committed, inputData.filePath)
      : null;
    const contextCompilerDiagnosticsCount = committed?.compilerDiagnostics.length ?? 0;
    const contextProjectionKnownFile = projectedFromContext.knownFile;
    const contextProjectionDiagnosticsCount = projectedFromContext.diagnostics.length;
    const contextProjectionAuthoritative = projectedFromContext.authoritative;
    const contextCacheLastCompileWasPrefix = committed?.lastCompileWasPrefix ?? null;
    const contextCacheCommittedAtMs = input.getLastFullCompileCommittedAt(inputData.context.key) ?? null;
    const projectedEffectivelyAuthoritative = projectedFromContext.authoritative && !hasRecentUriEditSinceLastFullCommit;

    if (projectedFromContext.knownFile && projectedEffectivelyAuthoritative) {
      let diagnostics = input.applyIgnoreIdsToLspDiagnostics(projectedFromContext.diagnostics, input.getIgnoredForContext(inputData.context));
      let cacheHit = true;
      let source: PullDiagnosticsSnapshotSource = 'context-projected';
      let isPrefix = Boolean(committed?.lastCompileWasPrefix);
      let isAuthoritative = committed?.lastCompileWasPrefix === false;

      if (committed && committedForFile && committedForFile.diagnostics.length === 0 && diagnostics.length > 0) {
        committed.diagnosticsByFile.set(input.normalizePathKey(inputData.filePath), diagnostics);
      }
      if (isAuthoritative) {
        const hash = hashDiagnostics(diagnostics);
        const resultId = `${inputData.doc?.version ?? 0}:${hash}`;
        pullDiagStableByUri.set(inputData.uri, {
          contextKey: inputData.context.key,
          dirtyStamp,
          resultId,
          hash,
          diagnostics,
          reportedAtMs: performance.now()
        });
      }
      if (
        diagnostics.length === 0
        && shouldForceDirectCompileForZero({
          compilerDiagnosticsCount: contextCompilerDiagnosticsCount,
          projectedAuthoritative: projectedFromContext.authoritative,
          activeContextCompileSignal: input.hasActiveContextCompileSignal(inputData.context.key),
          hasRecentContextFullSignal: hasRecentContextCompileSignal(),
          hasSameDirtyNonEmptySnapshot: hasSameDirtyNonEmptySnapshotForContext
        })
      ) {
        diagnostics = await input.computeDiagnosticsDirectlyForPull(inputData.context, inputData.filePath, inputData.doc, inputData.forceRefreshFiles);
        cacheHit = diagnostics.length > 0;
        source = 'fallback-compile';
        isPrefix = false;
        isAuthoritative = true;
      }
      input.logContextProjectionSelected({
        uri: inputData.uri,
        filePath: inputData.filePath,
        contextKey: inputData.context.key,
        dirtyStamp,
        branch: 'committedAuthoritative',
        knownFile: contextProjectionKnownFile,
        projectedDiagnosticsCount: contextProjectionDiagnosticsCount,
        projectedAuthoritative: contextProjectionAuthoritative,
        projectedEffectivelyAuthoritative,
        contextCompilerDiagnosticsCount,
        contextCacheLastCompileWasPrefix,
        contextCacheCommittedAtMs,
        selectedSource: source,
        selectedDiagnosticsCount: diagnostics.length,
        selectedAuthoritative: isAuthoritative,
        recentZeroObservation: Boolean(recentZeroObservation)
      });
      return {
        result: {
          diagnostics,
          source,
          cacheHit,
          contextMatched: true,
          contextKey: inputData.contextKeyForResponse,
          contextName: inputData.contextNameForResponse,
          dirtyStamp,
          isPrefix,
          isAuthoritative,
          contextProjectionKnownFile,
          contextProjectionDiagnosticsCount,
          contextProjectionAuthoritative,
          contextProjectionBranch: 'committedAuthoritative',
          contextCompilerDiagnosticsCount,
          contextCacheLastCompileWasPrefix,
          contextCacheCommittedAtMs
        },
        ensureScheduled: false,
        continueWithEmptyProjection: false
      };
    }

    if (projectedFromContext.knownFile && !projectedEffectivelyAuthoritative) {
      let diagnostics = input.applyIgnoreIdsToLspDiagnostics(projectedFromContext.diagnostics, input.getIgnoredForContext(inputData.context));
      let cacheHit = true;
      let source: PullDiagnosticsSnapshotSource = 'context-projected';
      let isPrefix = true;
      let isAuthoritative = false;
      let ensureScheduled = false;

      const shouldSchedulePublicApiZeroFollowup = Boolean(
        committed
        && committed.lastCompileWasPrefix
        && shouldScheduleNonAuthoritativeFollowup({
          stableIsFresh,
          hasPendingOrRecentFollowup: input.hasPendingOrRecentFollowupForUri(inputData.context.key, inputData.uri),
          hasRecentContextFullSignal: hasRecentContextCompileSignal(),
          trackerAllowsSchedule: input.shouldScheduleFollowup(inputData.context.key, inputData.uri, dirtyStamp, 'publicApiZero')
        })
      );
      if (shouldSchedulePublicApiZeroFollowup) {
        input.scheduleFollowup(inputData.context, inputData.uri, inputData.filePath, inputData.doc?.version, 140);
        ensureScheduled = true;
        input.sendDebugLog(inputData.filePath, `pullDiagnostics: authoritative followup scheduled uri=${inputData.uri} reason=non-authoritative-zero-guard dirtyStamp=${dirtyStamp ?? -1}`);
      }

      const shouldProbeDirectDiagnosticsDuringEditBurst = Boolean(
        diagnostics.length > 0
        && inputData.doc
        && input.hasRecentEditBurst(inputData.uri)
      );
      if (diagnostics.length > 0 && (recentZeroObservation || shouldProbeDirectDiagnosticsDuringEditBurst)) {
        const directDiagnostics = await input.computeDiagnosticsDirectlyForPull(inputData.context, inputData.filePath, inputData.doc, inputData.forceRefreshFiles);
        if (directDiagnostics.length < diagnostics.length) {
          diagnostics = directDiagnostics;
          cacheHit = true;
          source = 'public-api';
          isPrefix = true;
          isAuthoritative = false;
        }
      }

      if (diagnostics.length > 0) {
        input.logContextProjectionSelected({
          uri: inputData.uri,
          filePath: inputData.filePath,
          contextKey: inputData.context.key,
          dirtyStamp,
          branch: 'committedPrefix',
          knownFile: contextProjectionKnownFile,
          projectedDiagnosticsCount: contextProjectionDiagnosticsCount,
          projectedAuthoritative: contextProjectionAuthoritative,
          projectedEffectivelyAuthoritative,
          contextCompilerDiagnosticsCount,
          contextCacheLastCompileWasPrefix,
          contextCacheCommittedAtMs,
          selectedSource: source,
          selectedDiagnosticsCount: diagnostics.length,
          selectedAuthoritative: isAuthoritative,
          recentZeroObservation: Boolean(recentZeroObservation)
        });
        return {
          result: {
            diagnostics,
            source,
            cacheHit,
            contextMatched: true,
            contextKey: inputData.contextKeyForResponse,
            contextName: inputData.contextNameForResponse,
            dirtyStamp,
            isPrefix,
            isAuthoritative,
            contextProjectionKnownFile,
            contextProjectionDiagnosticsCount,
            contextProjectionAuthoritative,
            contextProjectionBranch: 'committedPrefix',
            contextCompilerDiagnosticsCount,
            contextCacheLastCompileWasPrefix,
            contextCacheCommittedAtMs
          },
          ensureScheduled,
          continueWithEmptyProjection: false
        };
      }

      if (
        diagnostics.length === 0
        && isSameDirtyStamp()
        && !stableIsFresh
        && hasRecentContextCompileSignal()
      ) {
        return {
          result: null,
          ensureScheduled,
          continueWithEmptyProjection: true
        };
      }

      if (
        diagnostics.length === 0
        && shouldForceDirectCompileForZero({
          compilerDiagnosticsCount: contextCompilerDiagnosticsCount,
          projectedAuthoritative: projectedFromContext.authoritative,
          activeContextCompileSignal: input.hasActiveContextCompileSignal(inputData.context.key),
          hasRecentContextFullSignal: hasRecentContextCompileSignal(),
          hasSameDirtyNonEmptySnapshot: hasSameDirtyNonEmptySnapshotForContext
        })
      ) {
        diagnostics = await input.computeDiagnosticsDirectlyForPull(inputData.context, inputData.filePath, inputData.doc, inputData.forceRefreshFiles);
        cacheHit = diagnostics.length > 0;
        source = 'fallback-compile';
        isPrefix = false;
        isAuthoritative = true;
        return {
          result: {
            diagnostics,
            source,
            cacheHit,
            contextMatched: true,
            contextKey: inputData.contextKeyForResponse,
            contextName: inputData.contextNameForResponse,
            dirtyStamp,
            isPrefix,
            isAuthoritative,
            contextProjectionKnownFile,
            contextProjectionDiagnosticsCount,
            contextProjectionAuthoritative,
            contextProjectionBranch: 'committedPrefix',
            contextCompilerDiagnosticsCount,
            contextCacheLastCompileWasPrefix,
            contextCacheCommittedAtMs
          },
          ensureScheduled,
          continueWithEmptyProjection: false
        };
      }

      input.logContextProjectionSelected({
        uri: inputData.uri,
        filePath: inputData.filePath,
        contextKey: inputData.context.key,
        dirtyStamp,
        branch: 'committedPrefix:zeroReturn',
        knownFile: contextProjectionKnownFile,
        projectedDiagnosticsCount: contextProjectionDiagnosticsCount,
        projectedAuthoritative: contextProjectionAuthoritative,
        projectedEffectivelyAuthoritative,
        contextCompilerDiagnosticsCount,
        contextCacheLastCompileWasPrefix,
        contextCacheCommittedAtMs,
        selectedSource: source,
        selectedDiagnosticsCount: diagnostics.length,
        selectedAuthoritative: isAuthoritative,
        recentZeroObservation: Boolean(recentZeroObservation),
        hadPendingOrRecentFollowup: input.hasPendingOrRecentFollowupForUri(inputData.context.key, inputData.uri)
      });
      return {
        result: {
          diagnostics,
          source,
          cacheHit,
          contextMatched: true,
          contextKey: inputData.contextKeyForResponse,
          contextName: inputData.contextNameForResponse,
          dirtyStamp,
          isPrefix,
          isAuthoritative,
          contextProjectionKnownFile,
          contextProjectionDiagnosticsCount,
          contextProjectionAuthoritative,
          contextProjectionBranch: 'committedPrefix',
          contextCompilerDiagnosticsCount,
          contextCacheLastCompileWasPrefix,
          contextCacheCommittedAtMs
        },
        ensureScheduled,
        continueWithEmptyProjection: false
      };
    }

    return {
      result: null,
      ensureScheduled: false,
      continueWithEmptyProjection: false
    };
  }


  function scheduleDidOpenPrewarm(doc: TextDocument, context: ResolvedContext): void {
    const existing = pullDiagPrewarmTimers.get(doc.uri);
    if (existing) clearTimeout(existing);
    const scheduledVersion = doc.version;
    const timer = setTimeout(() => {
      pullDiagPrewarmTimers.delete(doc.uri);
      const current = input.documents.get(doc.uri);
      if (!current || current.version !== scheduledVersion) return;
      if (input.shouldSkipDidOpenPrewarm(context.key)) return;
      if (pullDiagPrewarmInFlight.has(doc.uri)) return;

      const work = input.prewarmDiagnostics(context, current)
        .then((diagnostics) => {
          const filePath = input.toFsPath(current.uri);
          pullDiagPrewarmByUri.set(current.uri, { version: current.version, diagnostics });
          input.sendDebugLog(filePath, `pullDiagnostics.prewarm: prepared version=${current.version} count=${diagnostics.length}`);
        })
        .catch((error) => {
          const filePath = input.toFsPath(doc.uri);
          input.sendDebugLog(filePath, `pullDiagnostics.prewarm: failed error=${String(error)}`);
        })
        .finally(() => {
          if (pullDiagPrewarmInFlight.get(doc.uri) === work) {
            pullDiagPrewarmInFlight.delete(doc.uri);
          }
        });
      pullDiagPrewarmInFlight.set(doc.uri, work);
    }, input.prewarmDelayMs);
    pullDiagPrewarmTimers.set(doc.uri, timer);
  }

  function disposeDocument(uri: string): void {
    const timer = pullDiagPrewarmTimers.get(uri);
    if (timer) {
      clearTimeout(timer);
      pullDiagPrewarmTimers.delete(uri);
    }
    pullDiagPrewarmInFlight.delete(uri);
    pullDiagPrewarmByUri.delete(uri);
    pullDiagLastItems.delete(uri);
    pullDiagCache.delete(uri);
    pullDiagStableByUri.delete(uri);
    pullDiagLastNonEmptyByUri.delete(uri);
    pullDiagRecentZeroByUri.delete(uri);
    for (const requestId of [...pullDiagComputeInFlight.keys()]) {
      if (requestId.startsWith(`${uri}:`)) pullDiagComputeInFlight.delete(requestId);
    }
  }

  function clearContextSnapshots(contextKey: string): Set<string> {
    const affectedUris = new Set<string>();
    for (const [candidateUri, snapshot] of pullDiagStableByUri.entries()) {
      if (snapshot.contextKey !== contextKey) continue;
      affectedUris.add(candidateUri);
    }
    for (const [candidateUri, snapshot] of pullDiagLastNonEmptyByUri.entries()) {
      if (snapshot.contextKey !== contextKey) continue;
      affectedUris.add(candidateUri);
    }
    for (const [candidateUri, snapshot] of pullDiagRecentZeroByUri.entries()) {
      if (snapshot.contextKey !== contextKey) continue;
      affectedUris.add(candidateUri);
    }
    for (const uri of affectedUris) {
      disposeDocument(uri);
    }
    return affectedUris;
  }

  function reset(): void {
    for (const timer of pullDiagPrewarmTimers.values()) clearTimeout(timer);
    pullDiagPrewarmTimers.clear();
    pullDiagPrewarmInFlight.clear();
    pullDiagPrewarmByUri.clear();
    pullDiagCache.clear();
    pullDiagLastItems.clear();
    pullDiagStableByUri.clear();
    pullDiagLastNonEmptyByUri.clear();
    pullDiagRecentZeroByUri.clear();
    pullDiagComputeInFlight.clear();
  }

  return {
    state: {
      pullDiagStableByUri,
      pullDiagLastNonEmptyByUri,
      pullDiagRecentZeroByUri,
      pullDiagComputeInFlight
    },
    EMPTY_CONTEXT_FILE_PROJECTION,
    hashDiagnostics,
    findDiagnosticsInContextCache,
    projectCommittedDiagnosticsForFile,
    buildContextFileProjection,
    getRecentZeroObservation,
    rememberRecentZero,
    clearRecentZero,
    resolveNoContextDiagnostics,
    resolvePersistedDiagnostics,
    resolveContextProjectionDiagnostics,
    runComputeDeduped(
      key: string,
      compute: () => Promise<PullDiagnosticsComputeResult>
    ): Promise<PullDiagnosticsComputeResult>
    {
      const inflight = pullDiagComputeInFlight.get(key);
      const computePromise = inflight ?? compute();
      if (!inflight)
      {
        pullDiagComputeInFlight.set(key, computePromise);
      }
      return computePromise.finally(() =>
      {
        if (pullDiagComputeInFlight.get(key) === computePromise)
        {
          pullDiagComputeInFlight.delete(key);
        }
      });
    },
    materializeSnapshotsForContext,
    scheduleDidOpenPrewarm,
    clearContextSnapshots,
    disposeDocument,
    reset
  };
}
