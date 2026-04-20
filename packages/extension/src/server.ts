import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { getCompletionSnippets } from './snippets/catalog';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
import
  {
    createConnection,
    DiagnosticSeverity,
    DiagnosticRefreshRequest,
    ProposedFeatures,
    TextDocumentSyncKind,
    type Diagnostic,
    type InitializeParams,
  } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import
  {
    createPublicCompilerApi,
    getAllInternalSignatures,
    buildSymbolQueryScopeForContext,
    buildSymbolQueryScopeForSingleFile,
    getContextSymbols,
    getCursorMethodNames,
    listListaMethods,
    listListaProperties,
    prepareRename,
    renameSymbol,
    resolveSymbolAtPosition,
    SEMANTIC_TOKEN_MODIFIERS,
    SEMANTIC_TOKEN_TYPES,
    type ContentOverrides,
    type CompileResult,
    type FormatDocumentReport,
    type FormatOptions,
    type LspSystem,
    type InternalSignatureDoc,
    type SymbolQueryScope,
    type SymbolInfo,
    type ValidationContextConfig
  } from '@lsp/compiler';
import { type BootPhase } from './server/runtime/boot-phase';
import
  {
    createCompileRequestState,
    finishCompileRequest,
    isLatestRequest,
    isRunningRequest,
    startCompileRequest,
    clearCompileRequestsForContext
  } from './server/compile/compile-requests';
import { runWithBoundary } from './server/runtime/exception-boundary';
import { formatDocumentDetailed, type FormatSettings } from './formatting';
import { shouldRunFallbackValidationOnOpen } from './server/fallback/fallback-guard';
import { createFallbackValidationService } from './server/fallback/fallback-validation-service';
import { normalizeFallbackSystem, resolveEffectiveFallbackSystem, type FallbackSystem } from './server/fallback/fallback-utils';
import { applyIgnoreIds } from './server/diagnostics/diagnostics-ignore';
import {
  createCorrelationContext,
  createObservability,
  recordDecisionEvent,
  recordMetric,
  type LogLevel,
  type ObservabilitySettings
} from './observability';
import { createProjectContextService } from './server/context/project-context-service';
import { type ContextInvalidationReason, type ContextInvalidationTarget } from './server/context/context-invalidation';
import { createContextOrchestrator } from './server/context/context-orchestrator';
import { createSnapshotStore } from './server/semantics/snapshot-store';
import { buildBootPreloadSystems, preloadInternals } from './server/observability/internals-preload';
import { createValidationCycleState, isLatestValidationCycle, startValidationCycle, type ValidationCycle } from './server/compile/validation-cycle';
import { runFormatRequest } from './server/compile/format-request';
import {
  createCompileOrchestrator,
  type PendingCompileEntry,
  type ScheduledCompileEntry
} from './server/compile/compile-orchestrator';
import { mergeExpectedDocVersion } from './server/compile/compile-version-gate';
import { createCompileResultApplication } from './server/compile/compile-result-application';
import { isLikelyFormatDrivenChange, isUndoLikeHashTransition, type FormatWindow } from './server/compile/format-change-classifier';
import {
  completionItem,
  listaMethodCompletionItem,
  listaPropertyCompletionItem,
  snippetItem
} from './server/language/completion-items';
import { createHoverCacheService } from './server/language/hover-cache';
import { createOfficialSignatureIndexService, type OfficialSignatureIndex } from './server/language/official-signature-index';
import { getSignatureCallContext } from './server/language/signature-help';
import { getLinePrefix, getWordAtPosition, isInsideStringLiteral } from './server/language/text-position-utils';
import { createSemanticRuntime } from './server/semantics/semantic-runtime';
import { formatCustomSymbolHover, formatInternalSignatureHover, formatParamLabel } from './server/language/hover-render';
import { createPullDiagnosticsFollowupTracker, type PullDiagnosticsGlobalFollowupOutcome } from './server/diagnostics/pull-diagnostics-followup';
import {
  getAuthoritativeStableSnapshotOverride as getAuthoritativeStableSnapshotOverrideFromStickySnapshots,
  getEditBurstSnapshotOverride as getEditBurstSnapshotOverrideFromStickySnapshots,
  pickStickyPullDiagnosticsSnapshot as pickStickyPullDiagnosticsSnapshotFromModule,
  shouldRetainStickySnapshotDuringEditBurst as shouldRetainStickySnapshotDuringEditBurstFromModule
} from './server/diagnostics/pull-diagnostics-sticky-snapshots';
import { createPullDiagnosticsFastPathState } from './server/diagnostics/pull-diagnostics-fast-path-state';
import { buildPullDiagnosticsMetricsPayload } from './server/diagnostics/pull-diagnostics-metrics-payload';
import { emitPullDiagnosticsObservability } from './server/diagnostics/pull-diagnostics-observability-emitter';
import {
  shouldForcePostFormatDiagnosticsRepublish,
} from './server/diagnostics/pull-diagnostics-observability-helpers';
import { ensurePostFormatAuthoritativeFollowup as ensurePostFormatAuthoritativeFollowupAction } from './server/diagnostics/pull-diagnostics-post-format-followup';
import {
  scheduleDidOpenZeroAuthoritativeFollowup as scheduleDidOpenZeroAuthoritativeFollowupAction,
  scheduleStickyDiagnosticsFollowup as scheduleStickyDiagnosticsFollowupAction
} from './server/diagnostics/pull-diagnostics-followup-actions';
import {
  shouldDeferColdDidOpenPull,
  shouldForceDirectCompileForZero,
  shouldRecheckTransientPublicApiZero,
  shouldWaitForAuthoritativeContext
} from './server/diagnostics/pull-diagnostics-context-guards';
import { shouldScheduleNonAuthoritativeFollowup } from './server/diagnostics/pull-diagnostics-followup-guards';
import {
  type PullAuthorityLevel,
  type PullDiagnosticsKind,
  type PullDiagnosticsSource,
  type PullEnsureScheduledReason,
  type PullFollowupReason,
  type PullPublishDecision,
  type PullSourceOfTruth,
  type PullStalenessReason
} from './server/diagnostics/pull-diagnostics-observability';
import { createPullDiagnosticsRuntime } from './server/diagnostics/pull-diagnostics-runtime';
import { createPullDiagnosticsService, type LastNonEmptyPullDiagnosticsSnapshot, type StablePullDiagnosticsSnapshot } from './server/diagnostics/pull-diagnostics-service';
import { createSemanticRefreshScheduler } from './server/semantics/semantic-refresh-scheduler';
import { createDocHashHistoryTracker } from './server/semantics/doc-hash-history';
import { clampOffset, preserveFinalNewline, remapCursorOffsetByEdits } from './server/formatting/text-edit-utils';
import { createSemanticTokenEditHistory } from './server/semantics/semantic-token-edit-history';
import { computeSemanticTokensArrayDelta } from './server/semantics/semantic-tokens-delta';
import { createServerRuntime } from './server/server-runtime-factory';
import {
  buildMetricsPersistSettingsFromDebug,
  buildObservabilitySettingsFromDebug,
  buildIgnoredList,
  loadDebugSettingsFromSettings,
  loadFallbackDefaultSystemFromSettings,
  loadFormatSettingsFromSettings,
  loadSemanticHighlightSettingsFromSettings,
  loadIgnoredDiagnosticsFromSettings,
  normalizeDiagnosticId
} from './server/config/server-settings';
import { appendPersistLog as appendPersistedEventLog, resolvePersistTarget, rotateFileIfNeeded, type PersistRotationMeta } from './server/observability/persist-utils';
import {
  type CompilerDiagnostic,
  type ContextCache,
  type ResolvedContext,
} from './server/server-runtime';
import { hashText, isPathUnderRoot, normalizePathKey, toFileUri, toFsPath } from './server/runtime/path-utils';
import { registerDiagnosticsHandlers } from './server/register-diagnostics-handlers';
import { registerFormatHandlers } from './server/register-format-handlers';
import { registerLanguageHandlers } from './server/register-language-handlers';
import { registerLifecycleHandlers } from './server/register-lifecycle-handlers';
import { registerSemanticHandlers } from './server/register-semantic-handlers';
import {
  clearFullCompileQueued,
  getCompileDelayForReason,
  hasContextCompileSignal,
  isFullCompileQueuedOrRunning,
} from './compile-scheduler-policy';
import
  {
    buildCustomSymbolFingerprint,
    buildOfficialDocVersionFingerprint,
    buildOfficialNameLookupKeys,
    buildOfficialSignatureKey,
    normalizeNameForKey,
    normalizeSystemForKey,
    resolveOfficialSymbolKind
  } from './server/language/hover-optimization';

declare const __LSP_EXTENSION_VERSION__: string | undefined;
declare const __LSP_BUILD_DATE__: string | undefined;

const EXTENSION_VERSION = typeof __LSP_EXTENSION_VERSION__ === 'string' ? __LSP_EXTENSION_VERSION__ : 'unknown';
const EXTENSION_BUILD_DATE = typeof __LSP_BUILD_DATE__ === 'string' ? __LSP_BUILD_DATE__ : 'unknown';

let vscodeClientVersion: string = 'unknown';

let pullDiagnosticsRefreshTimer: NodeJS.Timeout | null = null;
let pullDiagnosticsRefreshInFlight = false;

import
  {
    shouldLoadSystemAfterActiveContext,
    shouldServeCustomFromCommittedCache
  } from './server/runtime/m9-gating';


type HoverPayload = {
  markdown: string;
};

type PullDiagnosticRequestParams = {
  textDocument?: { uri?: string };
  previousResultId?: string;
};

type PullDiagnosticReport =
  | { kind: 'full'; items: Diagnostic[]; resultId?: string }
  | { kind: 'unchanged'; resultId: string };

type CompileResultSizeBreakdown = {
  diagnostics: number;
  files: number;
  symbols: number;
  semanticsByFile: number;
  stats: number;
  total: number;
};

type MetricsEntry = {
  timestamp: string;
  contextKey: string;
  contextName: string;
  phase: 'diagnostics' | 'symbols' | 'pullDiagnostics';
  durationMs: number;
  compileTrigger?: string | null;
  compileIncludeSemantics?: boolean | null;
  compileIsPrefix?: boolean | null;
  diagnosticsCount?: number;
  symbolsCount?: number;
  filesCount?: number;
  openDocsCount?: number;
  filesDiscovered?: number;
  filesRead?: number;
  filesParsed?: number;
  parseMs?: number;
  semanticMs?: number;
  totalMs?: number;
  compilerTotalMs?: number | null;
  overheadMs?: number | null;
  queueWaitMs?: number | null;
  workerPayloadBytes?: number | null;
  workerResultBytes?: number | null;
  workerResultDiagnosticsBytes?: number | null;
  workerResultFilesBytes?: number | null;
  workerResultSymbolsBytes?: number | null;
  workerResultSemanticsBytes?: number | null;
  workerResultStatsBytes?: number | null;
  semanticStartIndex?: number;
  semanticFilesReused?: number;
  semanticFilesAnalyzed?: number;
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
  publishPrepMs?: number | null;
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
  pullKind?: 'full' | 'unchanged' | 'error';
  pullSource?: 'public-api' | 'fallback-compile' | 'boot-empty' | 'context-projected' | 'persisted-cache';
  pullMode?: 'pull';
  pullResultCount?: number;
  pullCacheHit?: boolean;
  pullEnsureScheduled?: boolean;
  pullContextMatched?: boolean;

  pullStableUsed?: boolean | null;
  pullIsPrefix?: boolean | null;
  pullIsAuthoritative?: boolean | null;
  pullDirtyStamp?: number | null;
  pullPublishDecision?: PullPublishDecision | null;
  pullStalenessReason?: PullStalenessReason | null;
  pullAuthorityLevel?: PullAuthorityLevel | null;
  pullFollowupReason?: PullFollowupReason | null;
  pullEnsureScheduledReason?: PullEnsureScheduledReason | null;
  pullSourceOfTruth?: PullSourceOfTruth | null;
  pullResultAgeMs?: number | null;
  pullRequestAgeMs?: number | null;
  pullSnapshotAgeMs?: number | null;
  pullCompileAgeMs?: number | null;
  pullLastCompileCompletedAt?: string | null;
  pullLastEditAt?: string | null;
  pullDocVersionDistance?: number | null;
  pullContextMatchReason?: string | null;
  pullTransientCause?: string | null;
  pullFollowupState?: string | null;
  pullFollowupScheduleReason?: string | null;
  pullFollowupSkippedReason?: string | null;
  pullFollowupScheduledAt?: string | null;
  pullFollowupStartedAt?: string | null;
  pullFollowupExecutedAt?: string | null;
  pullFollowupResolvedAt?: string | null;
  pullFollowupFirstObservedAt?: string | null;
  pullFollowupFirstObservedCount?: number | null;
  pullFollowupFirstObservedSource?: string | null;
  pullFollowupFirstObservedAuthoritative?: boolean | null;
  pullTimeToFirstObservedMs?: number | null;
  pullTimeToAuthoritativeMs?: number | null;
  pullPerceivedState?: string | null;
  pullPostFormatActive?: boolean | null;
  pullPostFormatRequestId?: string | null;
  pullPostFormatEditCount?: number | null;
  pullPostFormatEditLength?: number | null;
  pullPostFormatSinceMs?: number | null;
  pullPostFormatSameResultIdAsBefore?: boolean | null;
  pullPostFormatPreFormatDiagnosticsCount?: number | null;
  pullPostFormatReturnedUnchanged?: boolean | null;
  pullPostFormatPaintRisk?: boolean | null;
  pullCandidateSet?: string | null;
  pullChosenCandidate?: string | null;
  pullRejectedCandidates?: string | null;
  pullCandidateArbitrationReason?: string | null;
  pullVisibleResultIdBefore?: string | null;
  pullVisibleResultIdAfter?: string | null;
  pullVisibleAuthorityBefore?: string | null;
  pullVisibleAuthorityAfter?: string | null;
  pullVisibleDocVersionBefore?: number | null;
  pullVisibleDocVersionAfter?: number | null;
  pullVisibleStateChanged?: boolean | null;
  pullProjectedReuseCount?: number | null;
  pullProjectedFirstServedAt?: string | null;
  pullProjectedLastServedAt?: string | null;
  pullProjectedTtlMs?: number | null;
  pullProjectedExpired?: boolean | null;
  pullProjectedExpiryReason?: string | null;
  pullProjectedBaseResultId?: string | null;
  pullProjectedBaseDocVersion?: number | null;
  pullProjectedCurrentDocVersion?: number | null;
  pullFollowupId?: string | null;
  pullFollowupGeneration?: number | null;
  pullFollowupTargetDocVersion?: number | null;
  pullFollowupTargetDirtyStamp?: number | null;
  pullFollowupPendingCountAtSchedule?: number | null;
  pullFollowupResolvedReason?: string | null;
  pullFollowupSupersededBy?: string | null;

  heapUsedBytes: number;
};

type CompilePerfCounters = {
  compileRequested: number;
  compileStarted: number;
  compileCommitted: number;
  compileStaleDropped: number;
  compileErrored: number;
  compilePendingQueued: number;
  coalescedCount: number;
  cancelledObsoleteCount: number;
  supersededCompileCount: number;
  totalQueueWaitMs: number;
  totalCompileRoundtripMs: number;
  totalWorkerPayloadBytes: number;
};

const KEYWORDS = [
  'Definir',
  'Funcao',
  'Inicio',
  'Fim',
  'Se',
  'Senao',
  'Enquanto',
  'Para',
  'Continue',
  'Pare',
  'Vapara',
  'End'
];

const TYPES = ['Alfa', 'Numero', 'Data', 'Funcao', 'Lista', 'Cursor', 'Tabela'];

const requireModule = createRequire(__filename);
let compilerBuildInfoLogged = false;

const LISTA_METHODS = listListaMethods();
const LISTA_PROPERTIES = listListaProperties();

const CURSOR_METHODS = getCursorMethodNames();
const CURSOR_PROPERTIES = ['SQL'];

const connection = createConnection(ProposedFeatures.all);
const documents = new Map<string, TextDocument>();
const publicCompiler = createPublicCompilerApi();

const contextCache = new Map<string, ContextCache>();
const compileScheduled = new Map<string, ScheduledCompileEntry>();
const compileRunning = new Map<string, boolean>();
const compilePending = new Map<string, PendingCompileEntry>();
const fullCompileQueuedByContext = new Map<string, number>(); // timestamp
const fullCompileInFlightByContext = new Set<string>();
const fullCompileLastCommittedAtByContext = new Map<string, number>();
const contextRuntimeGeneration = new Map<string, number>();
const contextCompileCompletionWaiters = new Map<string, Array<() => void>>();

function notifyContextCompileFinished(contextKey: string): void
{
  const waiters = contextCompileCompletionWaiters.get(contextKey);
  if (!waiters || waiters.length === 0) return;
  contextCompileCompletionWaiters.delete(contextKey);
  for (const resolve of waiters)
  {
    try { resolve(); } catch {}
  }
}

async function waitForNextContextCompile(contextKey: string, timeoutMs: number): Promise<boolean>
{
  // Fast path: nothing queued/running
  if (!isFullCompileQueuedOrRunning(fullCompileQueuedByContext, fullCompileInFlightByContext, contextKey)) return true;
  return await new Promise<boolean>((resolve) =>
  {
    const timer = setTimeout(() =>
    {
      cleanup();
      resolve(false);
    }, Math.max(0, timeoutMs));
    const onDone = () =>
    {
      cleanup();
      resolve(true);
    };
    const cleanup = () =>
    {
      clearTimeout(timer);
      const list = contextCompileCompletionWaiters.get(contextKey);
      if (!list) return;
      const next = list.filter((fn) => fn !== onDone);
      if (next.length === 0) contextCompileCompletionWaiters.delete(contextKey);
      else contextCompileCompletionWaiters.set(contextKey, next);
    };
    const list = contextCompileCompletionWaiters.get(contextKey) ?? [];
    list.push(onDone);
    contextCompileCompletionWaiters.set(contextKey, list);
  });
}


function getContextRuntimeGeneration(contextKey: string): number
{
  return contextRuntimeGeneration.get(contextKey) ?? 0;
}

function bumpContextRuntimeGeneration(contextKey: string): number
{
  const next = getContextRuntimeGeneration(contextKey) + 1;
  contextRuntimeGeneration.set(contextKey, next);
  return next;
}

function shouldBootstrapFullCompileOnDidOpen(context: ResolvedContext): boolean
{
  if (isFullCompileQueuedOrRunning(fullCompileQueuedByContext, fullCompileInFlightByContext, context.key)) return false;
  const lastCommittedAt = fullCompileLastCommittedAtByContext.get(context.key);
  if (lastCommittedAt !== undefined && Date.now() - lastCommittedAt <= DID_OPEN_FULL_COMPILE_RECENCY_MS)
  {
    return false;
  }
  return true;
}

const compileStatusActive = new Set<string>();
const internalCache = new Map<string, InternalSignatureDoc[]>();
const internalIndex = new Map<string, OfficialSignatureIndex>();
const hoverCache = new Map<string, HoverPayload>();
const hoverOfficialEpochBySystem = new Map<string, number>();
const hoverCustomEpochByContext = new Map<string, number>();
const hoverCustomEpochByFallback = new Map<string, number>();
const emptyIgnoredSet = new Set<string>();
const emptyOpenContexts = new Map<string, ResolvedContext>();
const forceRefreshFilesByContext = new Set<string>();
const ensurePrefixTargetByContext = new Map<string, string>();
const compileRequests = createCompileRequestState();
const pendingCompiles = new Map<number, {
  context: ResolvedContext;
  metricsEnabled: boolean;
  startedAt: number;
  queuedAt: number;
  payloadBytes: number;
  cycle: ValidationCycle;
  trigger: string;
  uri?: string;
  includeSemantics?: boolean;
  includeSemanticPayload?: boolean;
  contextGeneration: number;
  // When we compile only a prefix (to ensure a file), we must not clear diagnostics from other files.
  isPrefixCompile: boolean;
}>();
let compilerWorker: Worker | null = null;

const PRIORITY_COMPILE_DELAY_MS = 0;
const SECONDARY_COMPILE_DELAY_MS = 25;
const PERF_SNAPSHOT_MIN_INTERVAL_MS = 2000;
const TYPING_SEMANTIC_FOLLOWUP_DELAY_MS = 1100;
const TYPING_SEMANTIC_DRAIN_DELAY_MS = 2300;
const TYPING_SEMANTIC_BUDGET_FILES = 14;
const DID_OPEN_SEMANTIC_FIRST_WINDOW_MS = 375;
const DID_OPEN_FULL_COMPILE_RECENCY_MS = 5000;
const SEMANTIC_TOKENS_COALESCE_DELAY_MS = 260;
const SEMANTIC_TOKENS_STALE_REUSE_WINDOW_MS = 240;
const SEMANTIC_TOKENS_TYPING_STABLE_WINDOW_MS = 950;
const SEMANTIC_TOKENS_POST_FULL_SUPPRESS_MS = 3000;
const UNDO_LIKE_CHANGE_WINDOW_MS = Number(process.env.LSP_UNDO_LIKE_CHANGE_WINDOW_MS ?? '4500');
const PULL_DIAGNOSTICS_FOLLOWUP_COOLDOWN_MS = Number(process.env.LSP_PULL_DIAGNOSTICS_FOLLOWUP_COOLDOWN_MS ?? '550');
const CONTEXT_QUIESCENCE_LOG_COOLDOWN_MS = Number(process.env.LSP_CONTEXT_QUIESCENCE_LOG_COOLDOWN_MS ?? '1500');
const MAX_METRICS_ENTRIES = 500;
const MAX_WARM_SEMANTIC_CACHE_ENTRIES = 250;

const semanticTokenEditHistory = createSemanticTokenEditHistory();
const PULL_DIAGNOSTICS_BUDGET_MS = Number(process.env.LSP_PULL_DIAGNOSTICS_BUDGET_MS ?? '80');
const PULL_DIAGNOSTICS_CONTEXT_WAIT_MS = Number(process.env.LSP_PULL_DIAGNOSTICS_CONTEXT_WAIT_MS ?? '45');
const PULL_DIAGNOSTICS_CONTEXT_ZERO_RECHECK_MS = Number(process.env.LSP_PULL_DIAGNOSTICS_CONTEXT_ZERO_RECHECK_MS ?? '70');
const PULL_DIAGNOSTICS_DIDOPEN_ZERO_FOLLOWUP_WINDOW_MS = Number(process.env.LSP_PULL_DIAGNOSTICS_DIDOPEN_ZERO_FOLLOWUP_WINDOW_MS ?? '2500');
const PULL_DIAGNOSTICS_CONTEXT_RECENT_COMMIT_MS = Number(process.env.LSP_PULL_DIAGNOSTICS_CONTEXT_RECENT_COMMIT_MS ?? '650');
const PULL_DIAGNOSTICS_NON_AUTHORITATIVE_ZERO_GUARD_MS = Number(process.env.LSP_PULL_DIAGNOSTICS_NON_AUTHORITATIVE_ZERO_GUARD_MS ?? '2500');
const PULL_DIAGNOSTICS_STICKY_EDIT_WINDOW_MS = Number(process.env.LSP_PULL_DIAGNOSTICS_STICKY_EDIT_WINDOW_MS ?? '900');
const PULL_DIAGNOSTICS_URI_ZERO_OVERRIDE_WINDOW_MS = Number(process.env.LSP_PULL_DIAGNOSTICS_URI_ZERO_OVERRIDE_WINDOW_MS ?? '15000');
const HR_DEBUG_LOGS_ENABLED =
  process.env.LSP_HR_DEBUG_LOGS === '1' || process.env.LSP_HR_DEBUG_LOGS?.toLowerCase() === 'true';
const DEFAULT_FORMAT_OPTIONS = {
  indentSize: 2,
  useTabs: false,
  maxParamsPerLine: 4,
  embeddedSqlEnabled: false,
  embeddedSqlDialect: 'sql'
} satisfies FormatOptions & { embeddedSqlEnabled: boolean; embeddedSqlDialect: 'sql' | 'oracle' | 'sqlserver' };
const DEFAULT_FORMAT_SETTINGS: FormatSettings = { enabled: true, ...DEFAULT_FORMAT_OPTIONS };
const DEFAULT_OBSERVABILITY_SETTINGS: ObservabilitySettings = {
  enabled: false,
  level: 'info',
  persistToFile: ''
};

let workspaceFolders: InitializeParams['workspaceFolders'] = [];
let resolvedContexts: ResolvedContext[] = [];
let resolvedContextsByKey = new Map<string, ResolvedContext>();
let ignoredDiagnosticsByWorkspace = new Map<string, Set<string>>();
let activeDocumentUri: string | null = null;
let lastActiveContextKey: string | null = null;
let windowFocused = true;
let openContextKeys = new Set<string>();
let contextDocs = new Map<string, Set<string>>();
let metricsEnabledByWorkspace = new Map<string, boolean>();
let metricsPersistSettingsByWorkspace = new Map<string, { persistToFile: string; persistMaxFileBytes: number; persistMaxFiles: number }>();
let debugLogsByWorkspace = new Map<string, boolean>();
let observabilityByWorkspace = new Map<string, ObservabilitySettings>();
let formatSettingsByWorkspace = new Map<string, FormatSettings>();
let semanticHighlightSettingsByWorkspace = new Map<string, { embeddedSqlHighlightEnabled: boolean }>();
let fallbackDefaultSystemByWorkspace = new Map<string, FallbackSystem>();
let fallbackSystemOverride: FallbackSystem | undefined;
let bootPhase: BootPhase = 'BOOTING';
let suppressOpenCompileUntil = 0;
let refreshInProgress = false;
let lastRefreshAt = 0;
const lastCompileByContext = new Map<string, number>();
const orderedFilesByContext = new Map<string, string[]>();
const metricsLog: MetricsEntry[] = [];
const compilePerfByContext = new Map<string, CompilePerfCounters>();
const didOpenReceivedAtByUri = new Map<string, number>();
const didOpenGenerationByUri = new Map<string, number>();
const didCloseObservedGenerationByUri = new Map<string, number>();
const didOpenFirstSemanticPublishedByUri = new Set<string>();
const pendingDidOpenUris = new Set<string>();
const recentFormatWindowByUri = new Map<string, FormatWindow>();
const lastDidChangeAtByContext = new Map<string, number>();
const lastDidChangeAtByUri = new Map<string, number>();
const pullDiagnosticsFastPathState = createPullDiagnosticsFastPathState();
const { lastVisibleByUri: lastVisiblePullDiagnosticsStateByUri } = pullDiagnosticsFastPathState.state;
const lastPreemptAtByContext = new Map<string, number>();
const contextLastQuiescedAtByKey = new Map<string, number>();
const observabilityPersistQueues = new Map<string, Promise<void>>();
const metricsPersistQueues = new Map<string, Promise<void>>();
const persistOpenedAtByPath = new Map<string, string>();
const persistRotationMetaByPath = new Map<string, PersistRotationMeta>();
const lastPerfSnapshotAtByWorkspace = new Map<string, number>();
const adaptiveTypingDelayByContext = new Map<string, number>();
const dynamicPersistTargets = new Map<string, string>();
const observabilityPersistRotationByPath = new Map<string, { maxBytes: number; maxFiles: number }>();
const validationCycles = createValidationCycleState();
const projectContextService = createProjectContextService();
const snapshotStore = createSnapshotStore();
const observability = createObservability({
  sink: (payload) => connection.sendNotification('lsp/log', payload),
  persistWriter: (payload, filePath) => appendPersistLog(filePath, payload)
});
const pullDiagnosticsFollowupTracker = createPullDiagnosticsFollowupTracker({
  cooldownMs: PULL_DIAGNOSTICS_FOLLOWUP_COOLDOWN_MS,
  enforceSinglePendingPerContext: true,
  onAlreadyScheduled: ({ contextKey, uri, dirtyStamp, reason }) => {
    const filePath = uri.startsWith('file://') ? toFsPath(uri) : null;
    const obs = getObservabilitySettingsForFile(filePath);
    observability.log(obs, 'debug', 'followupAlreadyScheduled', {
      id: uri,
      span: 'pullDiagnostics.authoritativeFollowup',
      data: {
        contextKey,
        reason,
        dirtyStamp
      }
    });
  },
  onCooldownSuppressed: ({ contextKey, uri, dirtyStamp, reason, cooldownMs, elapsedMs }) => {
    const filePath = uri.startsWith('file://') ? toFsPath(uri) : null;
    const obs = getObservabilitySettingsForFile(filePath);
    observability.log(obs, 'debug', 'followupSuppressedByCooldown', {
      id: uri,
      span: 'pullDiagnostics.authoritativeFollowup',
      data: {
        contextKey,
        reason,
        dirtyStamp,
        cooldownMs,
        elapsedMs
      }
    });
  }
});
const semanticRefreshScheduler = createSemanticRefreshScheduler({
  refresh: () => {
    const semanticApi = connection.languages.semanticTokens;
    if (!semanticApi || typeof semanticApi.refresh !== 'function') return;
    semanticApi.refresh?.();
  },
  hasPendingPullFollowup: () => pullDiagnosticsFollowupTracker.pendingCount() > 0,
  logWarn: (reason, error) => {
    sendLog('warn', `semanticTokens.refresh failed reason=${reason} error=${String(error)}`);
  }
});
const docHashHistoryTracker = createDocHashHistoryTracker({
  hashText,
  undoLikeWindowMs: UNDO_LIKE_CHANGE_WINDOW_MS,
  isUndoLikeTransition: isUndoLikeHashTransition
});
const pullDiagnosticsRuntime = createPullDiagnosticsRuntime({
  workspaceFolders: () => workspaceFolders,
  toFsPath,
  normalizePathKey,
  getIgnoredIdsForContext: (context) => getIgnoredForContext(context as ResolvedContext),
  extensionVersion: EXTENSION_VERSION,
  hashText
});
const pullDiagnosticsService = createPullDiagnosticsService({
  documents,
  contextDocs,
  runtime: pullDiagnosticsRuntime,
  toFsPath,
  normalizePathKey,
  getIgnoredForContext,
  applyIgnoreIdsToLspDiagnostics,
  projectCompilerDiagnosticsForFile: projectDiagnosticsForFile,
  getPersistCache: () => pullDiagnosticsRuntime.getPersistCache(),
  resolveWorkspaceKey: (filePath) => pullDiagnosticsRuntime.resolveWorkspaceKey(filePath),
  buildContextSignature: (context) => pullDiagnosticsRuntime.buildContextSignature(context),
  computeDocHash: (doc) => pullDiagnosticsRuntime.computeDocHash(doc),
  getPersistContextRevision: (contextKey) => pullDiagnosticsRuntime.getPersistContextRevision(contextKey),
  getDirtyStamp: (contextKey) => pullDiagnosticsRuntime.pullDiagDirtyStampByContext.get(contextKey) ?? 0,
  prewarmDelayMs: DID_OPEN_SEMANTIC_FIRST_WINDOW_MS,
  shouldSkipDidOpenPrewarm: (contextKey) =>
    refreshInProgress
    || bootPhase === 'BOOTING'
    || compileRunning.get(contextKey)
    || compilePending.has(contextKey),
  prewarmDiagnostics: async (context, doc) =>
  {
    const filePath = toFsPath(doc.uri);
    const snapshot = await publicCompiler.ensureCompiledForFile(
      context,
      filePath,
      buildOverridesForContext(context),
      {
        reason: 'diagnostics',
        changedFilePaths: [filePath],
        prefixUntilTarget: true,
        includeSemantics: false,
        includeSymbols: false,
        forceRefreshFiles: false
      }
    );
    const ignored = getIgnoredForContext(context);
    const filtered = applyIgnoreIds(publicCompiler.getDiagnosticsForFile(snapshot, filePath), ignored);
    return filtered.map((d) => toLspDiagnostic(d));
  },
  sendDebugLog,
  getLastFullCompileCommittedAt: (contextKey) => fullCompileLastCommittedAtByContext.get(contextKey),
  getLastDidChangeAtByUri: (uri) => lastDidChangeAtByUri.get(uri) ?? 0,
  hasRecentEditBurst: (uri) => hasRecentPullDiagnosticsEditBurst(uri),
  recentCommitWindowMs: PULL_DIAGNOSTICS_CONTEXT_RECENT_COMMIT_MS,
  didOpenZeroFollowupWindowMs: PULL_DIAGNOSTICS_DIDOPEN_ZERO_FOLLOWUP_WINDOW_MS,
  getContextCache: (contextKey) => contextCache.get(contextKey),
  hasActiveContextCompileSignal: (contextKey) => hasContextCompileSignal({
    fullCompileQueuedOrRunning: isFullCompileQueuedOrRunning(fullCompileQueuedByContext, fullCompileInFlightByContext, contextKey),
    compileScheduled: compileScheduled.has(contextKey),
    compilePending: compilePending.has(contextKey),
    compileRunning: compileRunning.get(contextKey) === true
  }),
  logContextProjectionSelected: (data) =>
  {
    observability.log(
      getObservabilitySettingsForFile(data.filePath),
      'debug',
      'pullDiagnostics.contextProjectionSelected',
      {
        id: `${data.uri}`,
        span: 'pullDiagnostics.contextProjectionSelected',
        data: {
          targetUri: data.uri,
          targetFilePath: data.filePath,
          contextKey: data.contextKey,
          dirtyStamp: data.dirtyStamp,
          branch: data.branch,
          knownFile: data.knownFile,
          projectedDiagnosticsCount: data.projectedDiagnosticsCount,
          projectedAuthoritative: data.projectedAuthoritative,
          projectedEffectivelyAuthoritative: data.projectedEffectivelyAuthoritative,
          contextCompilerDiagnosticsCount: data.contextCompilerDiagnosticsCount,
          contextCacheLastCompileWasPrefix: data.contextCacheLastCompileWasPrefix,
          contextCacheCommittedAtMs: data.contextCacheCommittedAtMs,
          selectedSource: data.selectedSource,
          selectedDiagnosticsCount: data.selectedDiagnosticsCount,
          selectedAuthoritative: data.selectedAuthoritative,
          recentZeroObservation: data.recentZeroObservation,
          hadPendingOrRecentFollowup: data.hadPendingOrRecentFollowup ?? null
        }
      }
    );
  },
  hasPendingOrRecentFollowupForUri: hasPendingOrRecentPullDiagnosticsGlobalFollowupForUri,
  shouldScheduleFollowup: (contextKey, uri, dirtyStamp, reason) => shouldSchedulePullDiagnosticsGlobalFollowup(contextKey, uri, dirtyStamp, reason),
  scheduleFollowup: (context, uri, filePath, docVersion, delayMs) =>
  {
    scheduleCompile(
      context,
      delayMs,
      'pullDiagnosticsGlobalFollowup',
      uri,
      {
        expectedDocVersion: docVersion,
        changedFilePaths: [filePath],
        includeSemantics: true,
        includeSemanticPayload: false
      }
    );
  },
  computeDiagnosticsDirectlyForPull,
  getIgnoredForWorkspace,
  compileFallbackDocument,
  toLspDiagnostic,
  schedulePullDiagnosticsRefresh,
  zeroObservationWindowMs: PULL_DIAGNOSTICS_URI_ZERO_OVERRIDE_WINDOW_MS
});

const semanticRuntime = createSemanticRuntime({
  documents,
  contextCache,
  maxWarmEntries: MAX_WARM_SEMANTIC_CACHE_ENTRIES,
  semanticTokenEditHistory,
  toFsPath,
  findContextForFile,
  normalizePathKey,
  getWindowFocused: () => windowFocused,
  sendLog,
  semanticRefreshScheduler,
  getObservabilitySettingsForFile,
  observability,
  isEmbeddedSqlHighlightEnabled: (filePath) => isEmbeddedSqlHighlightEnabledForFile(filePath),
  getEmbeddedSqlDialect: (filePath) => getFormatSettingsForFile(filePath).embeddedSqlDialect ?? 'sql',
  didOpenReceivedAtByUri,
  didOpenFirstSemanticPublishedByUri,
  recordSemanticDecision,
  fullCompileQueuedByContext,
  fullCompileInFlightByContext,
  fullCompileLastCommittedAtByContext,
  waitForNextContextCompile,
  getLastDidChangeAt: (contextKey) => lastDidChangeAtByContext.get(contextKey),
  typingDrainDelayMs: TYPING_SEMANTIC_DRAIN_DELAY_MS,
  typingSemanticBudgetFiles: TYPING_SEMANTIC_BUDGET_FILES,
  coalesceDelayMs: SEMANTIC_TOKENS_COALESCE_DELAY_MS,
  typingStableWindowMs: SEMANTIC_TOKENS_TYPING_STABLE_WINDOW_MS,
  staleReuseWindowMs: SEMANTIC_TOKENS_STALE_REUSE_WINDOW_MS,
  postFullSuppressMs: SEMANTIC_TOKENS_POST_FULL_SUPPRESS_MS,
  compileFallbackDocument,
  publicCompiler,
  buildOverridesForContext,
  forceRefreshFilesByContext
});
const {
  semanticTokensCache,
  semanticTokensInFlight,
  semanticLatestRequestedVersionByUri,
  semanticTokensLastSentByUri,
  semanticFollowupTimers,
  semanticDrainTimers
} = semanticRuntime.state;

const buildContextSemanticPayloadByFile = semanticRuntime.buildContextSemanticPayloadByFile;
const hasContextCachedSemanticsForFile = semanticRuntime.hasContextCachedSemanticsForFile;
const refreshSemanticTokensCacheForContext = semanticRuntime.refreshSemanticTokensCacheForContext;
const scheduleSemanticTokensRefresh = semanticRuntime.scheduleRefresh;

const {
  invalidateHoverCacheOfficial,
  invalidateHoverCacheCustomForContext,
  invalidateHoverCacheCustomForFallback,
  invalidateAllHoverCaches,
  buildOfficialHoverCacheKey,
  buildCustomHoverCacheKey,
  getHoverFromCacheOrBuild,
  getInternalOriginPrefix
} = createHoverCacheService({
  hoverCache,
  hoverOfficialEpochBySystem,
  hoverCustomEpochByContext,
  hoverCustomEpochByFallback,
  normalizeSystemForKey,
  normalizePathKey,
  sendLog: (level, message, meta) => sendLog(level, message, meta)
});
const {
  ensureInternalIndex,
  ensureInternalSignatures,
  lookupOfficialHoverSignatures
} = createOfficialSignatureIndexService({
  internalCache,
  internalIndex,
  ensureSignatures: (system) => getAllInternalSignatures(system as LspSystem),
  invalidateHoverCacheOfficial,
  buildOfficialNameLookupKeys,
  buildOfficialSignatureKey,
  normalizeNameForKey,
  resolveOfficialSymbolKind
});

function getCompilePerfCounters(contextKey: string): CompilePerfCounters
{
  const current = compilePerfByContext.get(contextKey);
  if (current) return current;
  const fresh: CompilePerfCounters = {
    compileRequested: 0,
    compileStarted: 0,
    compileCommitted: 0,
    compileStaleDropped: 0,
    compileErrored: 0,
    compilePendingQueued: 0,
    coalescedCount: 0,
    cancelledObsoleteCount: 0,
    supersededCompileCount: 0,
    totalQueueWaitMs: 0,
    totalCompileRoundtripMs: 0,
    totalWorkerPayloadBytes: 0
  };
  compilePerfByContext.set(contextKey, fresh);
  return fresh;
}

function sendLog(
  level: LogLevel,
  message: string,
  meta?: { id?: string; cycleId?: string; span?: string; durationMs?: number },
  filePath?: string | null
): void
{
  const settings = getObservabilitySettingsForFile(filePath ?? null);
  observability.log(settings, level, message, meta);
}

function sendDebugLog(
  filePath: string | null,
  message: string,
  meta?: { id?: string; cycleId?: string; span?: string; durationMs?: number }
): void
{
  if (!isDebugLogsEnabledForFile(filePath)) return;
  sendLog('debug', message, meta, filePath);
}

function recordContextInvalidation(input: {
  reason: ContextInvalidationReason;
  target: ContextInvalidationTarget;
  filePath?: string | null;
  contextKey?: string | null;
  contextName?: string | null;
  workspaceUri?: string | null;
}): void
{
  const filePath = input.filePath ?? null;
  const obs = getObservabilitySettingsForFile(filePath);
  const correlation = createCorrelationContext({
    contextKey: input.contextKey ?? undefined,
    contextName: input.contextName ?? undefined,
    uri: filePath ? toFileUri(filePath) : undefined,
    phase: 'context'
  });
  recordDecisionEvent(observability, obs, 'contextInvalidation', input.target, input.reason, correlation, {
    invalidationReason: input.reason,
    invalidationTarget: input.target,
    filePath,
    workspaceUri: input.workspaceUri ?? null
  });
}

function hasPendingPullDiagnosticsGlobalFollowupForContext(contextKey: string): boolean
{
  return pullDiagnosticsFollowupTracker.hasPendingForContext(contextKey);
}

function maybeLogContextQuiesced(contextKey: string, trigger: string, uri?: string): void
{
  if (compileRunning.get(contextKey)) return;
  if (compilePending.has(contextKey)) return;
  if (compileScheduled.has(contextKey)) return;
  if (fullCompileInFlightByContext.has(contextKey)) return;
  if (semanticFollowupTimers.has(contextKey)) return;
  if (semanticDrainTimers.has(contextKey)) return;
  if (hasPendingPullDiagnosticsGlobalFollowupForContext(contextKey)) return;
  const now = Date.now();
  const last = contextLastQuiescedAtByKey.get(contextKey) ?? 0;
  if (now - last < CONTEXT_QUIESCENCE_LOG_COOLDOWN_MS) return;
  contextLastQuiescedAtByKey.set(contextKey, now);
  const context = resolvedContextsByKey.get(contextKey);
  const filePath = uri && uri.startsWith('file://') ? toFsPath(uri) : context?.rootDir ?? null;
  const obs = getObservabilitySettingsForFile(filePath);
  observability.log(obs, 'debug', 'contextQuiesced', {
    id: uri ?? contextKey,
    span: 'contextQuiesced',
    data: {
      contextKey,
      contextName: context?.name ?? null,
      trigger
    }
  });
}

function cleanupIdleContextWork(contextKey: string, trigger: string, uri?: string): void
{
  if ((contextDocs.get(contextKey)?.size ?? 0) > 0) return;

  const hadRunningCompile = compileRunning.get(contextKey) === true;
  const hadFullCompileInFlight = fullCompileInFlightByContext.has(contextKey);

  const scheduled = compileScheduled.get(contextKey);
  if (scheduled)
  {
    clearTimeout(scheduled.timer);
    compileScheduled.delete(contextKey);
  }

  const hadPendingCompile = compilePending.has(contextKey);
  if (hadPendingCompile)
  {
    compilePending.delete(contextKey);
  }

  const semanticFollowupTimer = semanticFollowupTimers.get(contextKey);
  if (semanticFollowupTimer)
  {
    clearTimeout(semanticFollowupTimer);
    semanticFollowupTimers.delete(contextKey);
  }

  const semanticDrainTimer = semanticDrainTimers.get(contextKey);
  if (semanticDrainTimer)
  {
    clearTimeout(semanticDrainTimer);
    semanticDrainTimers.delete(contextKey);
  }

  bumpContextRuntimeGeneration(contextKey);
  clearPendingPullDiagnosticsGlobalFollowupForContext(contextKey);
  clearCompileRequestsForContext(compileRequests, contextKey);
  compileRunning.delete(contextKey);
  fullCompileInFlightByContext.delete(contextKey);
  clearFullCompileQueued(fullCompileQueuedByContext, contextKey);
  forceRefreshFilesByContext.delete(contextKey);
  ensurePrefixTargetByContext.delete(contextKey);
  notifyContextCompileFinished(contextKey);
  stopCompileProgress(contextKey);

  const context = resolvedContextsByKey.get(contextKey);
  const filePath = uri && uri.startsWith('file://') ? toFsPath(uri) : context?.rootDir ?? null;
  const obs = getObservabilitySettingsForFile(filePath);
  observability.log(obs, 'debug', 'idleCleanup', {
    id: uri ?? contextKey,
    span: 'idleCleanup',
    data: {
      contextKey,
      contextName: context?.name ?? null,
      trigger,
      cancelledScheduledCompile: Boolean(scheduled),
      cancelledPendingCompile: hadPendingCompile,
      cancelledRunningCompile: hadRunningCompile,
      cancelledFullCompileInFlight: hadFullCompileInFlight,
      cancelledSemanticFollowup: Boolean(semanticFollowupTimer),
      cancelledSemanticDrain: Boolean(semanticDrainTimer)
    }
  });
}

function drainQuiescedContextDiagnostics(contextKey: string, trigger: string, uri?: string): void
{
  if ((contextDocs.get(contextKey)?.size ?? 0) > 0) return;

  const scheduled = compileScheduled.get(contextKey);
  if (scheduled?.reason === 'pullDiagnosticsGlobalFollowup')
  {
    clearTimeout(scheduled.timer);
    compileScheduled.delete(contextKey);
    markPullDiagnosticsGlobalFollowupSkipped(contextKey, scheduled.uri, 'context-quiesced');
  }

  const pending = compilePending.get(contextKey);
  if (pending?.reason === 'pullDiagnosticsGlobalFollowup')
  {
    compilePending.delete(contextKey);
    markPullDiagnosticsGlobalFollowupSkipped(contextKey, pending.uri, 'context-quiesced');
  }

  clearPendingPullDiagnosticsGlobalFollowupForContext(contextKey);
  clearCompileRequestsForContext(compileRequests, contextKey);
  compileRunning.delete(contextKey);
  fullCompileInFlightByContext.delete(contextKey);
  clearFullCompileQueued(fullCompileQueuedByContext, contextKey);
  forceRefreshFilesByContext.delete(contextKey);
  ensurePrefixTargetByContext.delete(contextKey);
  notifyContextCompileFinished(contextKey);
  stopCompileProgress(contextKey);

  const affectedUris = pullDiagnosticsService.clearContextSnapshots(contextKey);
  for (const candidateUri of affectedUris)
  {
    clearPullDiagnosticsResidualState(candidateUri, contextKey);
    connection.sendDiagnostics({ uri: candidateUri, diagnostics: [] });
  }

  bumpPullDiagPersistContextRevision(contextKey);
  getPullDiagPersistCache().invalidateContext(contextKey);

  const context = resolvedContextsByKey.get(contextKey);
  const filePath = uri && uri.startsWith('file://') ? toFsPath(uri) : context?.rootDir ?? null;
  const obs = getObservabilitySettingsForFile(filePath);
  observability.log(obs, 'debug', 'contextQuiescedDrain', {
    id: uri ?? contextKey,
    span: 'contextQuiescedDrain',
    data: {
      contextKey,
      contextName: context?.name ?? null,
      trigger,
      drainedUrisCount: affectedUris.size,
      cancelledScheduledFollowup: scheduled?.reason === 'pullDiagnosticsGlobalFollowup',
      cancelledPendingFollowup: pending?.reason === 'pullDiagnosticsGlobalFollowup'
    }
  });
}

const compileOrchestrator = createCompileOrchestrator({
  documents,
  contextCache,
  contextDocs,
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
  priorityCompileDelayMs: PRIORITY_COMPILE_DELAY_MS,
  secondaryCompileDelayMs: SECONDARY_COMPILE_DELAY_MS,
  typingSemanticFollowupDelayMs: TYPING_SEMANTIC_FOLLOWUP_DELAY_MS,
  typingSemanticDrainDelayMs: TYPING_SEMANTIC_DRAIN_DELAY_MS,
  typingSemanticBudgetFiles: TYPING_SEMANTIC_BUDGET_FILES,
  getCompilePerfCounters,
  hasContextCachedSemanticsForFile,
  maybeLogContextQuiesced,
  logObsoleteWorkDropped,
  sendLog: (level, message) => sendLog(level, message),
  sendDebugLog,
  updateContextCache,
  toFsPath,
  markPullDiagnosticsGlobalFollowupSkipped,
  getContextGeneration: getContextRuntimeGeneration
});

const {
  scheduleCompile: rawScheduleCompile,
  scheduleTypingSemanticFollowup: rawScheduleTypingSemanticFollowup
} = compileOrchestrator;

function scheduleCompile(
  context: ResolvedContext,
  delayMs?: number,
  reason?: string,
  uri?: string,
  options?: {
    expectedDocVersion?: number;
    changedFilePaths?: string[];
    includeSemantics?: boolean;
    includeSemanticPayload?: boolean;
    semanticBudgetFiles?: number;
    contextGeneration?: number;
  }
): void
{
  if (!windowFocused && reason === 'pullDiagnosticsGlobalFollowup')
  {
    markPullDiagnosticsGlobalFollowupSkipped(context.key, uri, 'window-unfocused');
    clearPendingPullDiagnosticsGlobalFollowup(context.key, uri);
    maybeLogContextQuiesced(context.key, 'window-unfocused-followup', uri);
    return;
  }
  if (reason === 'pullDiagnosticsGlobalFollowup' && (contextDocs.get(context.key)?.size ?? 0) === 0)
  {
    markPullDiagnosticsGlobalFollowupSkipped(context.key, uri, 'context-quiesced');
    clearPendingPullDiagnosticsGlobalFollowup(context.key, uri);
    drainQuiescedContextDiagnostics(context.key, 'schedule-blocked', uri);
    maybeLogContextQuiesced(context.key, 'context-quiesced-followup', uri);
    return;
  }
  rawScheduleCompile(context, delayMs, reason, uri, {
    ...options,
    contextGeneration: options?.contextGeneration ?? getContextRuntimeGeneration(context.key)
  });
}

function scheduleTypingSemanticFollowup(
  context: ResolvedContext,
  uri: string,
  expectedDocVersion: number,
  changedFilePath: string
): void
{
  if (!windowFocused) return;
  rawScheduleTypingSemanticFollowup(context, uri, expectedDocVersion, changedFilePath);
}

const contextOrchestrator = createContextOrchestrator({
  connection,
  documents,
  contextCache,
  projectContextService,
  getResolvedContextsByKey: () => resolvedContextsByKey,
  getActiveDocumentUri: () => activeDocumentUri,
  getOpenContextKeys: () => openContextKeys,
  getContextDocs: () => contextDocs,
  emptyOpenContexts,
  priorityCompileDelayMs: PRIORITY_COMPILE_DELAY_MS,
  secondaryCompileDelayMs: SECONDARY_COMPILE_DELAY_MS,
  scheduleCompile,
  scheduleFallbackValidation,
  clearPendingPullDiagnosticsGlobalFollowupForContext,
  isFallbackDocument,
  toFsPath,
  toFileUri,
  sendLog: (level, message) => sendLog(level, message),
  isDebugLogsEnabledForFile,
  getEffectiveFallbackSystemForFile
});

function resolveOpenContexts(): Map<string, ResolvedContext> {
  return contextOrchestrator.resolveOpenContexts();
}

function syncOpenContexts(open: Map<string, ResolvedContext>): void {
  openContextKeys = contextOrchestrator.syncOpenContexts(open);
}

function getActiveContextKey(): string | null {
  return contextOrchestrator.getActiveContextKey();
}

function rebuildOpenContextDocs(): void {
  contextDocs = contextOrchestrator.rebuildOpenContextDocs();
}

function addDocToContext(doc: TextDocument): void {
  contextDocs = contextOrchestrator.addDocToContext(doc);
}

function removeDocFromContext(uri: string): void {
  contextDocs = contextOrchestrator.removeDocFromContext(uri);
}

function getCompilerSystemForFile(filePath: string, context: ResolvedContext | null): LspSystem {
  return contextOrchestrator.getCompilerSystemForFile(filePath, context);
}

function findContextForFile(filePath: string): ResolvedContext | null {
  return contextOrchestrator.findContextForFile(filePath);
}

function scheduleOpenContexts(priorityKey: string | null, reason = 'unknown', uri?: string): void {
  contextOrchestrator.scheduleOpenContexts(priorityKey, reason, uri);
}

function processPendingDidOpenDocuments(): void {
  const next = contextOrchestrator.processPendingDidOpenDocuments(pendingDidOpenUris);
  pendingDidOpenUris.clear();
  for (const uri of next) pendingDidOpenUris.add(uri);
}

const fallbackValidationService = createFallbackValidationService({
  documents,
  getResolvedContexts: () => resolvedContexts,
  toFsPath,
  getCompilerSystemForFile,
  getObservabilitySettingsForFile,
  observability,
  sendDebugLog,
  resolveWorkspaceUriForFile,
  schedulePullDiagnosticsRefresh
});

function logObsoleteWorkDropped(contextKey: string, reason: string, uri?: string): void
{
  const context = resolvedContextsByKey.get(contextKey);
  const filePath = uri && uri.startsWith('file://') ? toFsPath(uri) : context?.rootDir ?? null;
  const obs = getObservabilitySettingsForFile(filePath);
  observability.log(obs, 'debug', 'obsoleteWorkDropped', {
    id: uri ?? contextKey,
    span: 'obsoleteWorkDropped',
    data: {
      contextKey,
      contextName: context?.name ?? null,
      reason
    }
  });
}

type WorkerCompileRequest = {
  requestId: number;
  context: ValidationContextConfig;
  overrides: Array<[string, string]>;
  options?: {
    collectStats?: boolean;
    forceRefreshFiles?: boolean;
    prefixUntilFilePath?: string;
    changedFilePaths?: string[];
    semanticFilePaths?: string[];
    includeSemantics?: boolean;
    includeSemanticPayload?: boolean;
    semanticBudgetFiles?: number;
  };
};

type WorkerCompileResponse = {
  requestId: number;
  result?: CompileResult;
  resultBytes?: number;
  resultBytesBreakdown?: CompileResultSizeBreakdown;
  error?: string;
};

function ensureCompilerWorker(): Worker
{
  if (compilerWorker) return compilerWorker;
  const workerPath = path.join(__dirname, 'compiler-worker.js');
  compilerWorker = new Worker(workerPath);
  compilerWorker.on('message', (message: WorkerCompileResponse) =>
  {
    const pending = pendingCompiles.get(message.requestId);
    if (!pending) return;
    pendingCompiles.delete(message.requestId);
    const contextKey = pending.context.key;
    const perfCounters = getCompilePerfCounters(contextKey);
    const finalizeStale = () =>
    {
      compileRunning.set(contextKey, false);
      fullCompileInFlightByContext.delete(contextKey);
      notifyContextCompileFinished(contextKey);
      stopCompileProgress(contextKey);
      const queuedPending = compilePending.get(contextKey);
      if (queuedPending)
      {
        compilePending.delete(contextKey);
        scheduleCompile(
          pending.context,
          getCompileDelayForReason('pending', true, PRIORITY_COMPILE_DELAY_MS, SECONDARY_COMPILE_DELAY_MS),
          queuedPending.reason || 'pending',
          queuedPending.uri,
          {
            expectedDocVersion: queuedPending.expectedDocVersion,
            changedFilePaths: queuedPending.changedFilePaths,
            includeSemantics: queuedPending.includeSemantics,
            includeSemanticPayload: queuedPending.includeSemanticPayload,
            semanticBudgetFiles: queuedPending.semanticBudgetFiles
          }
        );
      }
    };
    if (!isRunningRequest(compileRequests, contextKey, message.requestId))
    {
      perfCounters.compileStaleDropped += 1;
      perfCounters.cancelledObsoleteCount += 1;
      logObsoleteWorkDropped(contextKey, 'not-running-request', pending.uri);
      finalizeStale();
      maybeLogContextQuiesced(contextKey, 'stale-not-running-request', pending.uri);
      return;
    }
    if (!isLatestRequest(compileRequests, contextKey, message.requestId))
    {
      perfCounters.compileStaleDropped += 1;
      perfCounters.cancelledObsoleteCount += 1;
      logObsoleteWorkDropped(contextKey, 'not-latest-request', pending.uri);
      finalizeStale();
      maybeLogContextQuiesced(contextKey, 'stale-not-latest-request', pending.uri);
      return;
    }
    if (pending.contextGeneration !== getContextRuntimeGeneration(contextKey))
    {
      perfCounters.compileStaleDropped += 1;
      perfCounters.cancelledObsoleteCount += 1;
      logObsoleteWorkDropped(contextKey, 'stale-context-generation', pending.uri);
      finalizeStale();
      maybeLogContextQuiesced(contextKey, 'stale-context-generation', pending.uri);
      return;
    }
    if (!isLatestValidationCycle(validationCycles, pending.cycle))
    {
      perfCounters.compileStaleDropped += 1;
      perfCounters.cancelledObsoleteCount += 1;
      logObsoleteWorkDropped(contextKey, 'not-latest-validation-cycle', pending.uri);
      finalizeStale();
      maybeLogContextQuiesced(contextKey, 'stale-not-latest-validation-cycle', pending.uri);
      return;
    }
    finishCompileRequest(compileRequests, contextKey, message.requestId);
    compileRunning.set(contextKey, false);
    fullCompileInFlightByContext.delete(contextKey);
    notifyContextCompileFinished(contextKey);
    stopCompileProgress(contextKey);
    if (message.error)
    {
      perfCounters.compileErrored += 1;
      connection.console.error(`[lsp] erro ao compilar contexto ${pending.context.name}: ${message.error}`);
    } else if (message.result)
    {
      perfCounters.compileCommitted += 1;
      if (!pending.isPrefixCompile)
      {
        fullCompileLastCommittedAtByContext.set(contextKey, Date.now());
      }
      perfCounters.totalCompileRoundtripMs += Math.max(0, performance.now() - pending.startedAt);
      const compileDuration = performance.now() - pending.startedAt;
      const queueWaitMs = Math.max(0, pending.startedAt - pending.queuedAt);
      runWithBoundary({
        cycleId: pending.cycle.cycleId,
        task: () => applyCompileResult(
          pending.context,
          message.result!,
          pending.metricsEnabled,
          compileDuration,
          pending.cycle,
          pending.isPrefixCompile,
          pending.trigger,
          {
            queueWaitMs,
            workerPayloadBytes: pending.payloadBytes,
            workerResultBytes: message.resultBytes,
            workerResultBytesBreakdown: message.resultBytesBreakdown,
            uri: pending.uri,
            includeSemantics: pending.includeSemantics ?? true,
            contextGeneration: pending.contextGeneration
          }
        ),
        onError: (error, cycleId) =>
        {
          sendLog('error', `compile: cycle failed cycle=${cycleId} error=${String(error)}`, { cycleId });
        }
      });
    }
    if (bootPhase === 'CONTEXTS_READY' && !Array.from(compileRunning.values()).some(Boolean))
    {
      bootPhase = 'IDLE';
      serverRuntime.bootPhase = 'IDLE';
    }
    const queuedPending = compilePending.get(contextKey);
    if (queuedPending)
    {
      compilePending.delete(contextKey);
      scheduleCompile(
        pending.context,
        getCompileDelayForReason('pending', true, PRIORITY_COMPILE_DELAY_MS, SECONDARY_COMPILE_DELAY_MS),
        queuedPending.reason || 'pending',
        queuedPending.uri,
          {
            expectedDocVersion: queuedPending.expectedDocVersion,
            changedFilePaths: queuedPending.changedFilePaths,
            includeSemantics: queuedPending.includeSemantics,
            includeSemanticPayload: queuedPending.includeSemanticPayload,
            semanticBudgetFiles: queuedPending.semanticBudgetFiles
          }
        );
    }
    maybeLogContextQuiesced(contextKey, 'compile-worker-message-end', pending.uri);
  });
  compilerWorker.on('error', (error) =>
  {
    connection.console.error(`[lsp] worker error: ${String(error)}`);
  });
  return compilerWorker;
}

function buildRuntimeMeta(kind: 'metrics' | 'observability', filePath?: string): { [key: string]: unknown }
{
  const openedAt = filePath ? (persistOpenedAtByPath.get(filePath) ?? null) : null;
  const rotationMeta = filePath
    ? (persistRotationMetaByPath.get(filePath) ?? { rotationOf: null, rotationIndex: 0, rotatedAt: null })
    : { rotationOf: null, rotationIndex: 0, rotatedAt: null };
  return {
    kind: `${kind}.meta`,
    timestamp: new Date().toISOString(),
    extensionVersion: EXTENSION_VERSION,
    extensionBuildDate: EXTENSION_BUILD_DATE,
    vscodeVersion: vscodeClientVersion,
    openedAt,
    rotationOf: rotationMeta.rotationOf,
    rotationIndex: rotationMeta.rotationIndex,
    rotatedAt: rotationMeta.rotatedAt
  };
}

async function appendPersistLog(filePath: string, payload: { [key: string]: unknown }): Promise<void>
{
  const rotation = observabilityPersistRotationByPath.get(filePath) ?? { maxBytes: 10 * 1024 * 1024, maxFiles: 20 };
  await appendPersistedEventLog({
    filePath,
    payload,
    kind: 'observability',
    rotation,
    queueByPath: observabilityPersistQueues,
    openedAtByPath: persistOpenedAtByPath,
    rotationMetaByPath: persistRotationMetaByPath,
    dynamicPersistTargets,
    buildRuntimeMeta
  });
}

async function appendMetricsLog(
  filePath: string,
  payload: { [key: string]: unknown },
  rotation: { maxBytes: number; maxFiles: number }
): Promise<void>
{
  const line = `${JSON.stringify(payload)}\n`;
  const pending = metricsPersistQueues.get(filePath) ?? Promise.resolve();
  const next = pending
    .then(async () =>
    {
      await rotateFileIfNeeded(filePath, rotation.maxBytes, rotation.maxFiles, persistOpenedAtByPath, persistRotationMetaByPath);
      const stat = await fs.promises.stat(filePath).catch(() => null);
      if (!stat || stat.size === 0)
      {
        if (!persistOpenedAtByPath.has(filePath))
        {
          persistOpenedAtByPath.set(filePath, new Date().toISOString());
        }
        await fs.promises.appendFile(filePath, `${JSON.stringify(buildRuntimeMeta('metrics', filePath))}\n`);
      }
      await fs.promises.appendFile(filePath, line);
    })
    .catch(() => undefined);
  metricsPersistQueues.set(filePath, next);
  await next;
}

function resolveWorkspaceUriForFile(filePath: string): string
{
  if (!workspaceFolders || workspaceFolders.length === 0) return '';
  const target = normalizePathKey(filePath);
  let bestUri = '';
  let bestLength = -1;
  for (const folder of workspaceFolders)
  {
    const folderPath = normalizePathKey(toFsPath(folder.uri));
    if (!target.startsWith(folderPath)) continue;
    if (folderPath.length > bestLength)
    {
      bestUri = folder.uri;
      bestLength = folderPath.length;
    }
  }
  return bestUri || workspaceFolders[0]?.uri || '';
}

function isDebugLogsEnabledForFile(filePath: string | null): boolean
{
  if (!filePath)
  {
    for (const enabled of debugLogsByWorkspace.values())
    {
      if (enabled) return true;
    }
    return debugLogsByWorkspace.get('') ?? false;
  }
  const key = resolveWorkspaceUriForFile(filePath);
  return debugLogsByWorkspace.get(key) ?? debugLogsByWorkspace.get('') ?? false;
}

function getObservabilitySettingsForFile(filePath: string | null): ObservabilitySettings
{
  if (!filePath)
  {
    if (workspaceFolders && workspaceFolders.length === 1)
    {
      return observabilityByWorkspace.get(workspaceFolders[0].uri) ?? DEFAULT_OBSERVABILITY_SETTINGS;
    }
    return observabilityByWorkspace.get('') ?? DEFAULT_OBSERVABILITY_SETTINGS;
  }
  const key = resolveWorkspaceUriForFile(filePath);
  return observabilityByWorkspace.get(key) ?? observabilityByWorkspace.get('') ?? DEFAULT_OBSERVABILITY_SETTINGS;
}

function shouldUseBootPrefixCompile(trigger: string): boolean
{
  if (bootPhase === 'IDLE') return false;
  return (
    trigger === 'refreshContexts' ||
    trigger === 'refreshContextsActiveDocument' ||
    trigger === 'didOpenDeferredAfterRefresh' ||
    trigger === 'didOpenTextDocumentSuppressed' ||
    trigger === 'pending' ||
    trigger === 'ensureFile'
  );
}

function resolveBootPrefixTargetForContext(context: ResolvedContext): string | undefined
{
  const ensured = ensurePrefixTargetByContext.get(context.key);
  if (ensured)
  {
    ensurePrefixTargetByContext.delete(context.key);
    return ensured;
  }

  const ordered = orderedFilesByContext.get(context.key);
  if (!ordered || ordered.length === 0) return undefined;
  const openDocs = contextDocs.get(context.key);
  if (!openDocs || openDocs.size === 0) return undefined;

  const indexByPath = new Map<string, number>();
  for (let i = 0; i < ordered.length; i += 1)
  {
    indexByPath.set(normalizePathKey(ordered[i]), i);
  }

  let maxIndex = -1;
  for (const uri of openDocs)
  {
    const idx = indexByPath.get(normalizePathKey(toFsPath(uri)));
    if (idx === undefined) continue;
    if (idx > maxIndex)
    {
      maxIndex = idx;
    }
  }

  if (maxIndex < 0) return undefined;
  return ordered[maxIndex];
}


function getIgnoredForWorkspace(workspaceUri: string): Set<string>
{
  return ignoredDiagnosticsByWorkspace.get(workspaceUri) ?? ignoredDiagnosticsByWorkspace.get('') ?? emptyIgnoredSet;
}

function getIgnoredForContext(context: ResolvedContext): Set<string>
{
  const workspaceSet = ignoredDiagnosticsByWorkspace.get(context.workspaceUri) ?? emptyIgnoredSet;
  if (!context.diagnosticsIgnoreIds || context.diagnosticsIgnoreIds.length === 0) return workspaceSet;
  return new Set<string>([...workspaceSet, ...context.diagnosticsIgnoreIds]);
}

function schedulePullDiagnosticsRefresh(reason: string, workspaceUri?: string, delayMs: number = 200): void
{
  if (!windowFocused)
  {
    sendLog('debug', `pullDiagnostics.refresh suppressed reason=${reason} windowFocused=0`);
    return;
  }
  if (pullDiagnosticsRefreshTimer) clearTimeout(pullDiagnosticsRefreshTimer);
  pullDiagnosticsRefreshTimer = setTimeout(() =>
  {
    pullDiagnosticsRefreshTimer = null;
    if (pullDiagnosticsRefreshInFlight) return;
    pullDiagnosticsRefreshInFlight = true;
    const obs = getObservabilitySettingsForFile(workspaceUri ?? '');
    const startedAt = performance.now();
    observability.log(obs, 'debug', `pullDiagnostics.refresh request reason=${reason}`, {
      id: workspaceUri ?? 'workspace',
      span: 'pullDiagnostics.refresh'
    });
    void connection
      .sendRequest(DiagnosticRefreshRequest.type, undefined)
      .catch((err) =>
      {
        observability.log(obs, 'warn', `pullDiagnostics.refresh failed error=${String(err)}`, {
          id: workspaceUri ?? 'workspace',
          span: 'pullDiagnostics.refresh'
        });
      })
      .finally(() =>
      {
        pullDiagnosticsRefreshInFlight = false;
        const durationMs = Math.round(performance.now() - startedAt);
        observability.log(obs, 'debug', `pullDiagnostics.refresh done durationMs=${durationMs}`, {
          id: workspaceUri ?? 'workspace',
          span: 'pullDiagnostics.refresh',
          durationMs
        });
      });
  }, delayMs);
}

function updateProjectedPrefixReuseTrace(input: {
  uri?: string;
  resultId?: string;
  docVersion?: number;
  authorityLevel: PullAuthorityLevel;
  stalenessReason: PullStalenessReason | null;
}): {
  reuseCount: number | null;
  firstServedAtMs: number | null;
  lastServedAtMs: number | null;
  ttlMs: number | null;
  expired: boolean;
  expiryReason: string | null;
  baseResultId: string | null;
  baseDocVersion: number | null;
  currentDocVersion: number | null;
} {
  return pullDiagnosticsFastPathState.updateProjectedPrefixReuseTrace({
    ...input,
    hasRecentEditBurst: input.uri ? hasRecentPullDiagnosticsEditBurst(input.uri) : false
  });
}

function recordMetrics(entry: Omit<MetricsEntry, 'timestamp' | 'heapUsedBytes'>, workspaceUri = ''): void
{
  const heapUsedBytes = process.memoryUsage().heapUsed;
  const payload = {
    ...entry,
    timestamp: new Date().toISOString(),
    heapUsedBytes
  };
  metricsLog.push(payload);
  if (metricsLog.length > MAX_METRICS_ENTRIES)
  {
    metricsLog.splice(0, metricsLog.length - MAX_METRICS_ENTRIES);
  }
  const persistSettings =
    metricsPersistSettingsByWorkspace.get(workspaceUri) ??
    metricsPersistSettingsByWorkspace.get('') ??
    { persistToFile: '', persistMaxFileBytes: 10 * 1024 * 1024, persistMaxFiles: 20 };
  if (!persistSettings.persistToFile) return;
  const resolvedTarget = resolvePersistTarget(persistSettings.persistToFile, 'metrics', dynamicPersistTargets);
  void appendMetricsLog(resolvedTarget, payload, {
    maxBytes: persistSettings.persistMaxFileBytes,
    maxFiles: persistSettings.persistMaxFiles
  });
}

function recordPullDiagnosticsMetrics(input: {
  workspaceUri: string;
  contextKey: string;
  contextName: string;
  uri?: string;
  docVersion?: number;
  resultId?: string;
  durationMs: number;
  kind: PullDiagnosticsKind;
  source: PullDiagnosticsSource;
  mode: 'pull';
  resultCount: number;
  cacheHit: boolean;
  ensureScheduled: boolean;
  contextMatched: boolean;
  stableUsed?: boolean;
  isPrefix?: boolean;
  isAuthoritative?: boolean;
  dirtyStamp?: number | null;
  publishDecision?: PullPublishDecision;
  stalenessReason?: PullStalenessReason | null;
  authorityLevel?: PullAuthorityLevel;
  followupReason?: PullFollowupReason | null;
  ensureScheduledReason?: PullEnsureScheduledReason | null;
  sourceOfTruth?: PullSourceOfTruth;
  resultAgeMs?: number | null;
  requestAgeMs?: number | null;
  snapshotAgeMs?: number | null;
  compileAgeMs?: number | null;
  lastCompileCompletedAt?: string | null;
  lastEditAt?: string | null;
  docVersionDistance?: number | null;
}): void
{
  const metricsEnabled = metricsEnabledByWorkspace.get(input.workspaceUri) ?? false;
  const stableSnapshot = input.uri ? pullDiagStableByUri.get(input.uri) : null;
  const nonEmptySnapshot = input.uri ? pullDiagLastNonEmptyByUri.get(input.uri) : null;
  const lastCompileCompletedAtMs = fullCompileLastCommittedAtByContext.get(input.contextKey);
  const lastEditAtMs = lastDidChangeAtByContext.get(input.contextKey);
  const followupOutcome = input.uri ? getPullDiagnosticsGlobalFollowupOutcome(input.contextKey, input.uri, input.dirtyStamp ?? null) : null;
  const visibleBefore = input.uri ? pullDiagnosticsFastPathState.getVisibleState(input.uri) : null;
  const payload = buildPullDiagnosticsMetricsPayload({
    ...input,
    lastCompileCompletedAtMs,
    lastEditAtMs,
    followupOutcome,
    formatMarker: input.uri ? recentFormatWindowByUri.get(input.uri) ?? null : null,
    visibleBefore,
    stableCandidate: stableSnapshot ?? null,
    nonEmptyCandidate: nonEmptySnapshot ?? null,
    projectedReuse: updateProjectedPrefixReuseTrace({
      uri: input.uri,
      resultId: input.resultId,
      docVersion: input.docVersion,
      authorityLevel: input.authorityLevel ?? 'non_authoritative',
      stalenessReason: input.stalenessReason ?? null
    }),
    getResultVersion: pullDiagnosticsFastPathState.getResultVersion
  });
  const fields = payload.fields;
  const resultAgeMs = payload.resultAgeMs;
  const requestAgeMs = payload.requestAgeMs;
  const snapshotAgeMs = payload.snapshotAgeMs;
  const compileAgeMs = payload.compileAgeMs;
  const docVersionDistance = payload.docVersionDistance;
  const followupData = payload.followupData;
  const postFormatData = payload.postFormatData;
  const chosenCandidate = payload.chosenCandidate;
  const candidateSet = payload.candidateSet;
  const rejectedCandidates = payload.rejectedCandidates;
  const visibleResultIdAfter = payload.visibleResultIdAfter;
  const visibleAuthorityAfter = payload.visibleAuthorityAfter;
  const visibleStateChanged = payload.visibleStateChanged;
  const arbitrationReason = payload.arbitrationReason;
  const projectedReuse = payload.projectedReuse;

  const obs = getObservabilitySettingsForFile(input.uri ? toFsPath(input.uri) : null);
  const correlation = createCorrelationContext({
    contextKey: input.contextKey,
    contextName: input.contextName,
    uri: input.uri,
    docVersion: input.docVersion,
    dirtyStamp: input.dirtyStamp ?? null,
    resultId: input.resultId,
    phase: 'pullDiagnostics'
  });
  emitPullDiagnosticsObservability({
    observability,
    settings: obs,
    correlation,
    metricsEnabled,
    workspaceUri: input.workspaceUri,
    recordMetrics: (entry, workspaceUri) => {
      recordMetrics(entry as Omit<MetricsEntry, 'timestamp' | 'heapUsedBytes'>, workspaceUri);
    },
    contextKey: input.contextKey,
    contextName: input.contextName,
    durationMs: input.durationMs,
    kind: input.kind,
    source: input.source,
    mode: input.mode,
    resultCount: input.resultCount,
    cacheHit: input.cacheHit,
    ensureScheduled: input.ensureScheduled,
    contextMatched: input.contextMatched,
    stableUsed: input.stableUsed ?? null,
    isPrefix: input.isPrefix ?? null,
    isAuthoritative: input.isAuthoritative ?? null,
    dirtyStamp: input.dirtyStamp ?? null,
    fields,
    resultAgeMs: resultAgeMs ?? null,
    requestAgeMs: requestAgeMs ?? null,
    snapshotAgeMs: snapshotAgeMs ?? null,
    compileAgeMs: compileAgeMs ?? null,
    lastCompileCompletedAt: input.lastCompileCompletedAt ?? (lastCompileCompletedAtMs === undefined ? null : new Date(lastCompileCompletedAtMs).toISOString()),
    lastEditAt: input.lastEditAt ?? (lastEditAtMs === undefined ? null : new Date(lastEditAtMs).toISOString()),
    docVersionDistance: docVersionDistance ?? null,
    followupData,
    postFormatData,
    candidateSet,
    chosenCandidate,
    rejectedCandidates,
    arbitrationReason,
    visibleResultIdBefore: visibleBefore?.resultId ?? null,
    visibleResultIdAfter,
    visibleAuthorityBefore: visibleBefore ? (visibleBefore.authoritative ? 'authoritative' : 'projected') : null,
    visibleAuthorityAfter,
    visibleDocVersionBefore: visibleBefore?.docVersion ?? null,
    visibleDocVersionAfter: input.docVersion ?? null,
    visibleStateChanged,
    projectedReuse
  });
}

type FormatDecision = 'apply' | 'no_op' | 'cancel' | 'skip' | 'error';
type TokenDecision = 'fresh' | 'delta' | 'reuse_previous' | 'cancel_stale' | 'drop_transient' | 'error';

function recordFormatDecision(input: {
  filePath: string;
  requestId: string;
  uri: string;
  docVersion: number;
  decision: FormatDecision;
  reason: string | null;
  editCount: number;
  editLength: number;
  durationMs?: number;
  semanticPrewarm: 'applied' | 'skip_no_cache' | 'skip_empty' | 'skip_degraded' | 'not_needed';
  diagnosticsRefreshExpected: boolean;
  cursorAware?: boolean;
  cancelledPhase?: 'pre' | 'post';
  formatReport?: FormatDocumentReport;
}): void
{
  const obs = getObservabilitySettingsForFile(input.filePath);
  const correlation = createCorrelationContext({
    requestId: input.requestId,
    uri: input.uri,
    docVersion: input.docVersion,
    phase: 'formatter'
  });
  const embeddedSql = input.formatReport?.embeddedSql;
  const primaryAttempt = embeddedSql?.attempts[0];
  recordDecisionEvent(
    observability,
    obs,
    'formatter',
    input.decision,
    input.reason,
    correlation,
    {
      formatDecision: input.decision,
      formatReason: input.reason,
      editCount: input.editCount,
      editLength: input.editLength,
      semanticPrewarm: input.semanticPrewarm,
      diagnosticsRefreshExpected: input.diagnosticsRefreshExpected,
      cursorAware: input.cursorAware ?? false,
      cancelledPhase: input.cancelledPhase ?? null,
      embeddedSqlEnabled: embeddedSql?.enabled ?? false,
      embeddedSqlAttemptCount: embeddedSql?.attemptedCount ?? 0,
      embeddedSqlEligibleCount: embeddedSql?.eligibleCount ?? 0,
      embeddedSqlAppliedCount: embeddedSql?.appliedCount ?? 0,
      embeddedSqlRejectedCount: embeddedSql?.rejectedCount ?? 0,
      embeddedSqlErrorCount: embeddedSql?.errorCount ?? 0,
      embeddedSqlPrimaryDecision: primaryAttempt?.decision ?? null,
      embeddedSqlPrimaryReason: primaryAttempt?.reason ?? null,
      sqlWrapperKind: primaryAttempt?.wrapperKind ?? null,
      sqlSourceKind: primaryAttempt?.sourceKind ?? null
    }
  );
  for (const attempt of embeddedSql?.attempts ?? [])
  {
    recordDecisionEvent(
      observability,
      obs,
      'embeddedSql',
      attempt.decision,
      attempt.reason,
      correlation,
      {
        formatDecision: input.decision,
        embeddedSqlEnabled: embeddedSql?.enabled ?? false,
        sqlWrapperKind: attempt.wrapperKind,
        sqlSourceKind: attempt.sourceKind,
        embeddedSqlDecision: attempt.decision,
        embeddedSqlReason: attempt.reason
      }
    );
  }
  for (const event of embeddedSql?.debug.events ?? [])
  {
    recordDecisionEvent(
      observability,
      obs,
      'embeddedSqlTrace',
      event.eventKind as string,
      'state_transition',
      correlation,
      {
        formatDecision: input.decision,
        embeddedSqlEnabled: embeddedSql?.enabled ?? false,
        ...event
      }
    );
  }
  if (typeof input.durationMs === 'number' && Number.isFinite(input.durationMs))
  {
    recordMetric(observability, obs, 'formatter.durationMs', input.durationMs, correlation, {
      formatDecision: input.decision
    });
  }
  recordMetric(observability, obs, 'formatter.editLength', input.editLength, correlation, {
    formatDecision: input.decision
  });
  recordMetric(observability, obs, 'formatter.isNoOp', input.decision === 'no_op' ? 1 : 0, correlation, {
    formatDecision: input.decision
  });
  recordMetric(observability, obs, 'formatter.skipRatioSignal', input.decision === 'skip' ? 1 : 0, correlation, {
    formatDecision: input.decision
  });
  recordMetric(observability, obs, 'formatter.cancelRatioSignal', input.decision === 'cancel' ? 1 : 0, correlation, {
    formatDecision: input.decision
  });
  recordMetric(observability, obs, 'formatter.errorRatioSignal', input.decision === 'error' ? 1 : 0, correlation, {
    formatDecision: input.decision
  });
  recordMetric(observability, obs, 'formatter.embeddedSqlAppliedRatioSignal', embeddedSql?.appliedCount ? 1 : 0, correlation, {
    formatDecision: input.decision
  });
  recordMetric(observability, obs, 'formatter.embeddedSqlRejectedRatioSignal', embeddedSql?.rejectedCount ? 1 : 0, correlation, {
    formatDecision: input.decision
  });
  recordMetric(observability, obs, 'formatter.embeddedSqlErrorRatioSignal', embeddedSql?.errorCount ? 1 : 0, correlation, {
    formatDecision: input.decision
  });
}

function recordSemanticDecision(input: {
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
  embeddedSqlDebugEvents?: unknown[];
  embeddedSqlDebugEventCount?: number;
}): void
{
  const obs = getObservabilitySettingsForFile(input.filePath);
  const correlation = createCorrelationContext({
    requestId: input.requestId,
    contextKey: input.contextKey,
    contextName: input.contextName,
    uri: input.uri,
    docVersion: input.docVersion,
    phase: 'semanticTokens'
  });
  recordDecisionEvent(
    observability,
    obs,
    'semanticTokens',
    input.decision,
    input.reason,
    correlation,
    {
      tokenDecision: input.decision,
      tokenReason: input.reason,
      source: input.source,
      kind: input.kind,
      tokenCount: input.tokenCount,
      coalesced: input.coalesced ?? false,
      staleDropped: input.staleDropped ?? false,
      reusedPrevious: input.reusedPrevious ?? false,
      remapApplied: input.remapApplied ?? false,
      remapEditsApplied: input.remapEditsApplied ?? 0,
      embeddedSqlHighlightEnabled: input.embeddedSqlHighlightEnabled ?? false,
      embeddedSqlHighlightCandidateCount: input.embeddedSqlHighlightCandidateCount ?? 0,
      embeddedSqlHighlightPublishedCount: input.embeddedSqlHighlightPublishedCount ?? 0,
      embeddedSqlHighlightSuppressedCount: input.embeddedSqlHighlightSuppressedCount ?? 0,
      embeddedSqlDebugEventCount: input.embeddedSqlDebugEventCount ?? 0,
      sqlWrapperKind: input.embeddedSqlHighlightWrapperKind ?? null,
      sqlSourceKind: input.embeddedSqlHighlightSourceKind ?? null
    }
  );
  if ((input.embeddedSqlHighlightCandidateCount ?? 0) > 0)
  {
    recordDecisionEvent(
      observability,
      obs,
      'embeddedSqlHighlight',
      (input.embeddedSqlHighlightPublishedCount ?? 0) > 0 ? 'published' : 'suppressed',
      (input.embeddedSqlHighlightPublishedCount ?? 0) > 0 ? 'embedded_sql_highlight_applied' : 'embedded_sql_highlight_disabled',
      correlation,
      {
        tokenDecision: input.decision,
        embeddedSqlHighlightEnabled: input.embeddedSqlHighlightEnabled ?? false,
        embeddedSqlHighlightCandidateCount: input.embeddedSqlHighlightCandidateCount ?? 0,
        embeddedSqlHighlightPublishedCount: input.embeddedSqlHighlightPublishedCount ?? 0,
        embeddedSqlHighlightSuppressedCount: input.embeddedSqlHighlightSuppressedCount ?? 0,
        embeddedSqlDebugEventCount: input.embeddedSqlDebugEventCount ?? 0,
        sqlWrapperKind: input.embeddedSqlHighlightWrapperKind ?? null,
        sqlSourceKind: input.embeddedSqlHighlightSourceKind ?? null
      }
    );
  }
  for (const event of input.embeddedSqlDebugEvents ?? [])
  {
    recordDecisionEvent(
      observability,
      obs,
      'embeddedSqlTrace',
      (event as { eventKind?: string }).eventKind ?? 'unknown',
      'state_transition',
      correlation,
      {
        tokenDecision: input.decision,
        embeddedSqlHighlightEnabled: input.embeddedSqlHighlightEnabled ?? false,
        ...(event as Record<string, unknown>)
      }
    );
  }
  if (typeof input.durationMs === 'number' && Number.isFinite(input.durationMs))
  {
    recordMetric(observability, obs, 'semanticTokens.durationMs', input.durationMs, correlation, {
      tokenDecision: input.decision
    });
  }
  recordMetric(observability, obs, 'semanticTokens.tokenCount', input.tokenCount, correlation, {
    tokenDecision: input.decision
  });
  recordMetric(
    observability,
    obs,
    'semanticTokens.cancelRatioSignal',
    input.decision === 'cancel_stale' ? 1 : 0,
    correlation
  );
  recordMetric(
    observability,
    obs,
    'semanticTokens.reuseRatioSignal',
    input.decision === 'reuse_previous' ? 1 : 0,
    correlation
  );
  recordMetric(
    observability,
    obs,
    'semanticTokens.dropRatioSignal',
    input.decision === 'drop_transient' ? 1 : 0,
    correlation
  );
  recordMetric(
    observability,
    obs,
    'semanticTokens.deltaRatioSignal',
    input.kind === 'delta' ? 1 : 0,
    correlation
  );
  recordMetric(
    observability,
    obs,
    'semanticTokens.coalescedRatioSignal',
    input.coalesced ? 1 : 0,
    correlation
  );
  recordMetric(
    observability,
    obs,
    'semanticTokens.remapRatioSignal',
    input.remapApplied ? 1 : 0,
    correlation
  );
  recordMetric(
    observability,
    obs,
    'semanticTokens.embeddedSqlHighlightPublishedRatioSignal',
    (input.embeddedSqlHighlightPublishedCount ?? 0) > 0 ? 1 : 0,
    correlation,
    {
      tokenDecision: input.decision
    }
  );
  recordMetric(
    observability,
    obs,
    'semanticTokens.embeddedSqlHighlightSuppressedRatioSignal',
    (input.embeddedSqlHighlightSuppressedCount ?? 0) > 0 ? 1 : 0,
    correlation,
    {
      tokenDecision: input.decision
    }
  );
}

function buildCompilePerfSnapshotPayload(workspaceUri = '', triggerContextKey?: string): { [key: string]: unknown }
{
  const compile = [...compilePerfByContext.entries()]
    .filter(([contextKey]) =>
    {
      if (!workspaceUri) return true;
      return contextKey.startsWith(`${workspaceUri}::`);
    })
    .map(([contextKey, counters]) => ({
      contextKey,
      ...counters
    }));
  return {
    kind: 'perf.snapshot',
    generatedAt: new Date().toISOString(),
    workspaceUri,
    triggerContextKey: triggerContextKey ?? '',
    compile
  };
}

function maybePersistCompilePerfSnapshot(workspaceUri = '', triggerContextKey?: string): void
{
  const now = Date.now();
  const last = lastPerfSnapshotAtByWorkspace.get(workspaceUri) ?? 0;
  if (now - last < PERF_SNAPSHOT_MIN_INTERVAL_MS) return;
  lastPerfSnapshotAtByWorkspace.set(workspaceUri, now);

  const persistSettings =
    metricsPersistSettingsByWorkspace.get(workspaceUri) ??
    metricsPersistSettingsByWorkspace.get('') ??
    { persistToFile: '', persistMaxFileBytes: 10 * 1024 * 1024, persistMaxFiles: 20 };
  if (!persistSettings.persistToFile) return;
  const resolvedTarget = resolvePersistTarget(persistSettings.persistToFile, 'metrics', dynamicPersistTargets);
  const payload = buildCompilePerfSnapshotPayload(workspaceUri, triggerContextKey);
  void appendMetricsLog(resolvedTarget, payload, {
    maxBytes: persistSettings.persistMaxFileBytes,
    maxFiles: persistSettings.persistMaxFiles
  });
}

function isMetricsEnabledForContext(context: ResolvedContext): boolean
{
  return metricsEnabledByWorkspace.get(context.workspaceUri) ?? false;
}

function getFormatSettingsForFile(filePath: string): FormatSettings
{
  const workspaceUri = resolveWorkspaceUriForFile(filePath);
  return (
    formatSettingsByWorkspace.get(workspaceUri) ??
    formatSettingsByWorkspace.get('') ??
    DEFAULT_FORMAT_SETTINGS
  );
}

function isEmbeddedSqlHighlightEnabledForFile(filePath: string): boolean
{
  const workspaceUri = resolveWorkspaceUriForFile(filePath);
  return (
    semanticHighlightSettingsByWorkspace.get(workspaceUri)?.embeddedSqlHighlightEnabled ??
    semanticHighlightSettingsByWorkspace.get('')?.embeddedSqlHighlightEnabled ??
    false
  );
}

function getEffectiveFallbackSystemForFile(filePath: string): FallbackSystem
{
  const workspaceUri = resolveWorkspaceUriForFile(filePath);
  const settingsDefault = fallbackDefaultSystemByWorkspace.get(workspaceUri) ?? null;
  return resolveEffectiveFallbackSystem({ override: fallbackSystemOverride, settingsDefault });
}

function toLspDiagnostic(diag: CompilerDiagnostic): Diagnostic
{
  const severity =
    diag.severity === 'Error'
      ? DiagnosticSeverity.Error
      : diag.severity === 'Warning'
        ? DiagnosticSeverity.Warning
        : DiagnosticSeverity.Information;
  return {
    range: diag.range,
    severity,
    message: `[${diag.id}] ${diag.message}`,
    source: 'lsp',
    code: diag.id,
    data: diag.conceptualFamily ? { conceptualFamily: diag.conceptualFamily } : undefined
  };
}

function groupDiagnostics(diagnostics: CompilerDiagnostic[]): Map<string, Diagnostic[]>
{
  const map = new Map<string, Diagnostic[]>();
  for (const diag of diagnostics)
  {
    const key = normalizePathKey(diag.sourcePath);
    const list = map.get(key);
    const converted = toLspDiagnostic(diag);
    if (list)
    {
      list.push(converted);
    } else
    {
      map.set(key, [converted]);
    }
  }
  return map;
}

function projectDiagnosticsForFile(diagnostics: CompilerDiagnostic[], filePath: string): Diagnostic[]
{
  const key = normalizePathKey(filePath);
  const projected: Diagnostic[] = [];
  for (const diag of diagnostics)
  {
    if (normalizePathKey(diag.sourcePath) === key)
    {
      projected.push(toLspDiagnostic(diag));
    }
  }
  return projected;
}

function getSnapshotContextId(filePath: string): string
{
  const context = findContextForFile(filePath);
  return context ? context.key : `__singlefile__:${normalizePathKey(filePath)}`;
}

function reindexSnapshotsForContexts(): void
{
  for (const snapshot of snapshotStore.listAll())
  {
    snapshotStore.upsert({
      uri: snapshot.uri,
      filePath: snapshot.filePath,
      contextId: getSnapshotContextId(snapshot.filePath),
      version: snapshot.version,
      text: snapshot.text
    });
  }
}

function buildOverridesForContext(context: ResolvedContext): ContentOverrides
{
  const overrides: ContentOverrides = new Map();
  const snapshots = snapshotStore.listByContext(context.key);
  if (snapshots.length === 0) return overrides;
  for (const snapshot of snapshots)
  {
    overrides.set(normalizePathKey(snapshot.filePath), snapshot.text);
  }
  sendDebugLog(null, `overrides: context=${context.name} files=${overrides.size} snapshots=${snapshots.length}`);
  return overrides;
}

async function preloadInternalsForActiveContext(activeKey: string | null): Promise<void>
{
  if (!activeKey) return;
  const context = resolvedContextsByKey.get(activeKey);
  if (!context) return;
  const system = context.system ?? 'HCM';
  if (!system || !shouldLoadSystemAfterActiveContext(system)) return;
  await ensureInternalSignatures(system);
}

function isFallbackDocument(doc: TextDocument): boolean
{
  return fallbackValidationService.isFallbackDocument(doc);
}

async function compileFallbackDocument(doc: TextDocument, includeSemantics = false): Promise<CompileResult>
{
  return fallbackValidationService.compileFallbackDocument(doc, includeSemantics);
}

function scheduleFallbackValidation(doc: TextDocument, delayMs = 200): void
{
  fallbackValidationService.scheduleFallbackValidation(doc, delayMs);
}

function revalidateOpenFallbackDocs(): void
{
  fallbackValidationService.revalidateOpenFallbackDocs();
}

async function startCompileProgress(context: ResolvedContext): Promise<void>
{
  // Intencionalmente desabilitado: evita "piscar"/mensagens no status bar durante compilação.
  // Mantemos apenas o controle interno para impedir repetição.
  if (!compileStatusActive.has(context.key))
  {
    compileStatusActive.add(context.key);
  }
}

function stopCompileProgress(contextKey: string): void
{
  // Intencionalmente desabilitado: evita "piscar"/mensagens no status bar durante compilação.
  if (compileStatusActive.has(contextKey))
  {
    compileStatusActive.delete(contextKey);
  }
}

const applyCompileResult = createCompileResultApplication({
  getObservabilitySettingsForFile,
  observability,
  getIgnoredForContext,
  sendLog,
  sendDebugLog,
  groupDiagnostics,
  getContextCache: (contextKey) => contextCache.get(contextKey),
  setContextCache: (contextKey, cache) => contextCache.set(contextKey, cache),
  shouldLogCompilerBuildInfo: () =>
  {
    if (compilerBuildInfoLogged) return false;
    compilerBuildInfoLogged = true;
    return true;
  },
  readCompilerBuildInfo: () =>
  {
    const compilerPkg = requireModule('@lsp/compiler/package.json');
    const compilerEntry = requireModule.resolve('@lsp/compiler');
    const stat = fs.statSync(compilerEntry);
    return {
      version: compilerPkg.version,
      buildTime: stat.mtime.toISOString(),
      entry: compilerEntry
    };
  },
  schedulePullDiagnosticsRefresh,
  normalizePathKey,
  getActiveDocumentUri: () => activeDocumentUri,
  toFsPath,
  buildContextSemanticPayloadByFile,
  bumpPullDiagPersistContextRevision,
  getPullDiagPersistCache,
  materializePullDiagnosticsSnapshotsForContext: (context, cache, authoritative) => pullDiagnosticsService.materializeSnapshotsForContext(context, cache, authoritative),
  clearPendingPullDiagnosticsGlobalFollowup,
  invalidateHoverCacheCustomForContext,
  getContextDocCount: (contextKey) => contextDocs.get(contextKey)?.size ?? 0,
  refreshSemanticTokensCacheForContext,
  scheduleSemanticTokensRefresh,
  recordMetrics,
  maybePersistCompilePerfSnapshot,
  getContextGeneration: getContextRuntimeGeneration,
  recordTypingLatency: ({ context, trigger, uri, docVersion, typingLatencyMs, lastEditAtIso }) =>
  {
    sendDebugLog(context.rootDir, `typing.latency: context=${context.name} trigger=${trigger} latencyMs=${typingLatencyMs}`);
    const obs = getObservabilitySettingsForFile(uri ? toFsPath(uri) : context.rootDir);
    recordMetric(
      observability,
      obs,
      'typing.latency',
      typingLatencyMs,
      createCorrelationContext({
        contextKey: context.key,
        contextName: context.name,
        uri,
        docVersion,
        phase: 'diagnostics'
      }),
      {
        trigger,
        lastEditAt: lastEditAtIso
      }
    );
  },
  updateAdaptiveTypingDelay: (contextKey, nextCompileDuration, nextTrigger) =>
  {
    if (nextTrigger === 'didChangeTextDocument' || nextTrigger === 'didChangeTextDocumentAfterFormat' || nextTrigger === 'didUndoLikeChange')
    {
      const previous = adaptiveTypingDelayByContext.get(contextKey) ?? getCompileDelayForReason('didChangeTextDocument', true, PRIORITY_COMPILE_DELAY_MS, SECONDARY_COMPILE_DELAY_MS);
      const next = Math.round((previous * 0.65) + (Math.max(160, Math.min(1800, nextCompileDuration * 0.35))));
      adaptiveTypingDelayByContext.set(contextKey, Math.max(160, Math.min(1800, next)));
      return;
    }
    if (nextTrigger === 'didChangeSemanticFollowup')
    {
      const previous = adaptiveTypingDelayByContext.get(contextKey);
      if (previous !== undefined && nextCompileDuration < 1400)
      {
        adaptiveTypingDelayByContext.set(contextKey, Math.max(140, Math.round(previous * 0.85)));
      }
    }
  },
  logConverteMascaraErrors: (diagnostics) =>
  {
    const converteMascaraErrors = diagnostics.filter((d) => d.id === 'LSP1411');
    if (converteMascaraErrors.length === 0) return;
    const maxLogs = 5;
    void (async () =>
    {
      for (const diag of converteMascaraErrors.slice(0, maxLogs))
      {
        try
        {
          const lineNumber = diag.range.start.line + 1;
          const content = await readFile(diag.sourcePath, 'utf8');
          const lines = content.split(/\r?\n/);
          const lineText = lines[diag.range.start.line] ?? '';
          const nameMatch = /variável\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(diag.message);
          const varName = nameMatch?.[1] ?? '';
          let declInfo = 'n/a';
          if (varName)
          {
            const declRegex = new RegExp(`\\bDefinir\\s+(\\w+)\\s+${varName}\\b`, 'i');
            for (let i = 0; i < lines.length; i += 1)
            {
              const match = declRegex.exec(lines[i]);
              if (match)
              {
                declInfo = `${match[0]} (line ${i + 1})`;
                break;
              }
            }
          }
          sendLog('info', `compile: LSP1411 file=${diag.sourcePath} line=${lineNumber} text=${lineText.trim()} decl=${declInfo}`);
        } catch (err)
        {
          sendLog('warn', `compile: LSP1411 log failed file=${diag.sourcePath} error=${String(err)}`);
        }
      }
      if (converteMascaraErrors.length > maxLogs)
      {
        sendLog('info', `compile: LSP1411 (more=${converteMascaraErrors.length - maxLogs})`);
      }
    })();
  },
  maybeLogContextQuiesced,
  getLastDidChangeAt: (contextKey) => lastDidChangeAtByContext.get(contextKey),
  getDocumentVersion: (uri) => documents.get(uri)?.version,
  hrDebugLogsEnabled: HR_DEBUG_LOGS_ENABLED
});

async function updateContextCache(
  context: ResolvedContext,
  trigger: string,
  queuedAt = performance.now(),
  uri?: string,
  expectedDocVersion?: number,
  changedFilePaths?: string[],
  includeSemantics = true,
  includeSemanticPayload = true,
  semanticBudgetFiles?: number
): Promise<void>
{
  const perfCounters = getCompilePerfCounters(context.key);
  perfCounters.compileStarted += 1;
  perfCounters.totalQueueWaitMs += Math.max(0, performance.now() - queuedAt);
  if (compileRunning.get(context.key))
  {
    const current = compilePending.get(context.key);
    if (current) perfCounters.coalescedCount += 1;
    compilePending.set(context.key, {
      reason: trigger,
      uri: uri ?? current?.uri,
      expectedDocVersion: mergeExpectedDocVersion(current?.expectedDocVersion, expectedDocVersion),
      changedFilePaths: Array.from(new Set([...(current?.changedFilePaths ?? []), ...(changedFilePaths ?? [])])),
      includeSemantics,
      includeSemanticPayload,
      semanticBudgetFiles,
      contextGeneration: getContextRuntimeGeneration(context.key)
    });
    perfCounters.compilePendingQueued += 1;
    return;
  }
  compileRunning.set(context.key, true);
  if (trigger === 'pullDiagnosticsGlobalFollowup')
  {
    markPullDiagnosticsGlobalFollowupStarted(context.key, uri);
  }
  const isFullCompile = !changedFilePaths || changedFilePaths.length === 0;
  if (isFullCompile)
  {
    fullCompileInFlightByContext.add(context.key);
    clearFullCompileQueued(fullCompileQueuedByContext, context.key);
  }
  const cycle = startValidationCycle(validationCycles, { contextId: context.key, trigger });
  await startCompileProgress(context);
  const overrides = buildOverridesForContext(context);
  const metricsEnabled = isMetricsEnabledForContext(context);
  const forceRefreshFiles = forceRefreshFilesByContext.has(context.key);
  if (forceRefreshFiles)
  {
    forceRefreshFilesByContext.delete(context.key);
  }
  const prefixUntilFilePath = shouldUseBootPrefixCompile(trigger) ? resolveBootPrefixTargetForContext(context) : undefined;
  sendLog(
    'info',
    `compile: enqueue context=${context.name} cycle=${cycle.cycleId} trigger=${trigger} overrides=${overrides.size} forceRefresh=${forceRefreshFiles} metrics=${metricsEnabled}${prefixUntilFilePath ? ` prefixUntil=${prefixUntilFilePath}` : ''}`
  );
  const requestId = startCompileRequest(compileRequests, context.key);
  pendingCompiles.set(requestId, {
    context,
    metricsEnabled,
    startedAt: performance.now(),
    queuedAt,
    payloadBytes: 0,
    cycle,
    trigger,
    uri,
    includeSemantics,
    includeSemanticPayload,
    contextGeneration: getContextRuntimeGeneration(context.key),
    isPrefixCompile: Boolean(prefixUntilFilePath)
  });
  const worker = ensureCompilerWorker();
  const semanticFilePaths = resolveSemanticPayloadFilePathsForCompile(context, trigger, changedFilePaths);
  const payload: WorkerCompileRequest = {
    requestId,
    context: {
      name: context.name,
      rootDir: context.rootDir,
      filePattern: context.filePattern,
      includeSubdirectories: context.includeSubdirectories,
      system: context.system
    },
    overrides: Array.from(overrides.entries()),
    options: {
      collectStats: metricsEnabled,
      forceRefreshFiles,
      prefixUntilFilePath,
      changedFilePaths,
      semanticFilePaths,
      includeSemantics,
      includeSemanticPayload,
      semanticBudgetFiles
    }
  };
  const payloadBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  perfCounters.totalWorkerPayloadBytes += payloadBytes;
  const pendingCompile = pendingCompiles.get(requestId);
  if (pendingCompile) pendingCompile.payloadBytes = payloadBytes;
  sendDebugLog(
    null,
    `compile: worker payload context=${context.name} requestId=${requestId} bytes=${payloadBytes}`,
    { cycleId: cycle.cycleId, id: context.key, span: 'compile.workerPayload' }
  );
  worker.postMessage(payload);
}

function resolveSemanticPayloadFilePathsForCompile(
  context: ResolvedContext,
  trigger: string,
  changedFilePaths?: string[]
): string[] | undefined
{
  // Keep full semantic payload on bootstrap so opening adjacent files is warm.
  if (trigger === 'didOpenContextBootstrap') return undefined;

  const openUris = contextDocs.get(context.key);
  const openFiles: string[] = [];
  if (openUris)
  {
    for (const uri of openUris)
    {
      const doc = documents.get(uri);
      if (!doc) continue;
      openFiles.push(toFsPath(uri));
    }
  }

  const merged = Array.from(new Set([...(changedFilePaths ?? []), ...openFiles]));
  return merged.length > 0 ? merged : undefined;
}

async function refreshContexts(): Promise<void>
{
  await ensurePullDiagPersistCacheLoaded();
  const now = Date.now();
  if (refreshInProgress || now - lastRefreshAt < 500)
  {
    sendLog('info', 'refreshContexts: ignorado (debounce)');
    return;
  }
  refreshInProgress = true;
  serverRuntime.refreshInProgress = true;
  recordContextInvalidation({
    reason: 'refresh_contexts',
    target: 'all',
    workspaceUri: workspaceFolders?.[0]?.uri ?? null
  });
  bootPhase = 'BOOTING';
  serverRuntime.bootPhase = 'BOOTING';
  lastRefreshAt = now;
  for (const doc of documents.values())
  {
    connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
  }
  for (const cache of contextCache.values())
  {
    for (const filePath of cache.files)
    {
      connection.sendDiagnostics({ uri: toFileUri(filePath), diagnostics: [] });
    }
  }
  semanticRuntime.reset();
  contextCache.clear();
  for (const scheduled of compileScheduled.values())
  {
    clearTimeout(scheduled.timer);
  }
  compileScheduled.clear();
  compilePending.clear();
  compileRunning.clear();
  semanticRefreshScheduler.dispose();
  pullDiagnosticsFollowupTracker.clearAll();
  pullDiagnosticsService.reset();
  pullDiagPersistRevisionByContext.clear();
  lastVisiblePullDiagnosticsStateByUri.clear();
  adaptiveTypingDelayByContext.clear();
  lastPreemptAtByContext.clear();
  fallbackValidationService.reset();
  internalCache.clear();
  internalIndex.clear();
  invalidateAllHoverCaches();
  ignoredDiagnosticsByWorkspace = await loadIgnoredDiagnosticsFromSettings(connection, workspaceFolders ?? []);
  const debugSettingsByWorkspace = await loadDebugSettingsFromSettings(connection, workspaceFolders ?? []);
  metricsEnabledByWorkspace = new Map<string, boolean>();
  debugLogsByWorkspace = new Map<string, boolean>();
  observabilityByWorkspace = new Map<string, ObservabilitySettings>();
  metricsPersistSettingsByWorkspace = new Map<
    string,
    { persistToFile: string; persistMaxFileBytes: number; persistMaxFiles: number }
  >();
  semanticHighlightSettingsByWorkspace = await loadSemanticHighlightSettingsFromSettings(connection, workspaceFolders ?? []);
  observabilityPersistRotationByPath.clear();

  for (const [workspaceUri, debugSettings] of debugSettingsByWorkspace.entries())
  {
    const enabled = Boolean(debugSettings.enabled);
    const dir = debugSettings.dir;

    metricsEnabledByWorkspace.set(workspaceUri, enabled);
    debugLogsByWorkspace.set(workspaceUri, enabled);

    if (enabled && dir)
    {
      try
      {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e)
      {
        // If we can't create the folder, disable persistence for safety but keep debug logs in output.
        sendLog('warn', `debug.path: falha ao criar pasta '${dir}': ${(e as Error).message}`);
      }
    }

    const obs = buildObservabilitySettingsFromDebug({ enabled, dir }, DEFAULT_OBSERVABILITY_SETTINGS);
    observabilityByWorkspace.set(workspaceUri, obs);

    if (obs.persistToFile)
    {
      observabilityPersistRotationByPath.set(obs.persistToFile, {
        maxBytes: obs.persistMaxFileBytes ?? 10 * 1024 * 1024,
        maxFiles: obs.persistMaxFiles ?? 20
      });
    }

    const metricsPersist = buildMetricsPersistSettingsFromDebug({ enabled, dir });
    metricsPersistSettingsByWorkspace.set(workspaceUri, metricsPersist);
  }

  formatSettingsByWorkspace = await loadFormatSettingsFromSettings(connection, workspaceFolders ?? [], DEFAULT_FORMAT_OPTIONS);
  fallbackDefaultSystemByWorkspace = await loadFallbackDefaultSystemFromSettings(connection, workspaceFolders ?? []);
  const previousContextsByKey = resolvedContextsByKey;
  resolvedContexts = await loadContextsFromSettings();
  serverRuntime.resolvedContexts = resolvedContexts;
  await preloadInternals({
    additionalSystems: buildBootPreloadSystems(),
    loadSignatures: async (system) =>
    {
      await getAllInternalSignatures(system);
    }
  });
  resolvedContextsByKey = new Map(resolvedContexts.map((ctx) => [ctx.key, ctx]));
  serverRuntime.resolvedContextsByKey = resolvedContextsByKey;
  projectContextService.setContexts(resolvedContexts);
  orderedFilesByContext.clear();
  for (const ctx of resolvedContexts)
  {
    const ordered = await projectContextService.getOrderedFiles(ctx.key);
    orderedFilesByContext.set(ctx.key, ordered);
  }
  reindexSnapshotsForContexts();
  forceRefreshFilesByContext.clear();
  for (const ctx of resolvedContexts)
  {
    const previous = previousContextsByKey.get(ctx.key);
    if (shouldForceRefreshContextFiles(previous, ctx))
    {
      forceRefreshFilesByContext.add(ctx.key);
    }
  }
  if (resolvedContexts.length > 0)
  {
    for (const ctx of resolvedContexts)
    {
      sendLog(
        'info',
        `context: loaded name=${ctx.name} rootDir=${ctx.rootDir} pattern=${ctx.filePattern} includeSub=${ctx.includeSubdirectories} system=${ctx.system} key=${ctx.key} orderedFiles=${orderedFilesByContext.get(ctx.key)?.length ?? 0}`
      );
    }
  } else
  {
    sendLog('info', 'context: loaded 0 contexts');
  }
  rebuildOpenContextDocs();
  const activeContext = activeDocumentUri ? findContextForFile(toFsPath(activeDocumentUri)) : null;
  if (activeContext && activeDocumentUri)
  {
    const list = contextDocs.get(activeContext.key) ?? new Set<string>();
    list.add(activeDocumentUri);
    contextDocs.set(activeContext.key, list);
  }
  suppressOpenCompileUntil = Date.now() + 500;
  serverRuntime.suppressOpenCompileUntil = suppressOpenCompileUntil;
  bootPhase = 'CONTEXTS_READY';
  serverRuntime.bootPhase = 'CONTEXTS_READY';
  scheduleOpenContexts(getActiveContextKey(), 'refreshContexts');
  if (activeContext)
  {
    scheduleCompile(activeContext, 0, 'refreshContextsActiveDocument', activeDocumentUri ?? undefined);
  }
  processPendingDidOpenDocuments();
  if (contextDocs.size === 0)
  {
    bootPhase = 'IDLE';
    serverRuntime.bootPhase = 'IDLE';
  }
  revalidateOpenFallbackDocs();
  // If pull diagnostics is enabled, ensure the client refreshes after contexts/config are rebuilt.
  schedulePullDiagnosticsRefresh('refreshContexts', workspaceFolders?.[0]?.uri);
  scheduleSemanticTokensRefresh('refreshContexts');
  refreshInProgress = false;
  serverRuntime.refreshInProgress = false;
}

function handleWindowFocusChanged(focused: boolean): void
{
  if (windowFocused === focused) return;
  windowFocused = focused;
  serverRuntime.windowFocused = focused;

  if (!focused)
  {
    if (pullDiagnosticsRefreshTimer)
    {
      clearTimeout(pullDiagnosticsRefreshTimer);
      pullDiagnosticsRefreshTimer = null;
    }
    semanticRefreshScheduler.dispose();
    semanticRuntime.clearAllContextTimers();
    for (const [contextKey, scheduled] of compileScheduled.entries())
    {
      if (scheduled.reason !== 'pullDiagnosticsGlobalFollowup') continue;
      clearTimeout(scheduled.timer);
      compileScheduled.delete(contextKey);
      markPullDiagnosticsGlobalFollowupSkipped(contextKey, scheduled.uri, 'window-unfocused');
      clearPendingPullDiagnosticsGlobalFollowup(contextKey, scheduled.uri);
      maybeLogContextQuiesced(contextKey, 'window-unfocused-followup', scheduled.uri);
    }
    sendLog('debug', 'windowFocusChanged focused=0');
    return;
  }

  sendLog('debug', 'windowFocusChanged focused=1');
  const activeContextKey = getActiveContextKey();
  const activeContext = activeContextKey ? resolvedContextsByKey.get(activeContextKey) : null;
  if (activeContext)
  {
    scheduleCompile(activeContext, 0, 'windowFocusGained', activeDocumentUri ?? undefined);
  }
  schedulePullDiagnosticsRefresh('windowFocusGained', workspaceFolders?.[0]?.uri, 0);
  scheduleSemanticTokensRefresh('windowFocusGained', 0);
}

async function loadContextsFromSettings(): Promise<ResolvedContext[]>
{
  if (!workspaceFolders || workspaceFolders.length === 0)
  {
    const contexts = (await connection.workspace.getConfiguration('lsp.contexts')) as Array<ValidationContextConfig & {
      diagnostics?: { ignoreIds?: string[] | null };
    }> | null;
    return resolveContexts(contexts ?? [], '', '');
  }

  const requests: Array<{ scopeUri?: string; section: 'lsp.contexts' }> = [{ section: 'lsp.contexts' }];
  for (const folder of workspaceFolders)
  {
    requests.push({
      scopeUri: folder.uri,
      section: 'lsp.contexts'
    });
  }
  const configs = (await connection.workspace.getConfiguration(requests)) as Array<Array<ValidationContextConfig & {
    diagnostics?: { ignoreIds?: string[] | null };
  }> | null>;
  const globalContexts = configs[0] ?? [];
  const resolved: ResolvedContext[] = [];
  for (let i = 0; i < workspaceFolders.length; i += 1)
  {
    const folder = workspaceFolders[i];
    const workspaceContexts = configs[i + 1] ?? [];
    // Workspace contexts take precedence over user/global contexts when patterns overlap.
    // This keeps context-level options (e.g. diagnostics.ignoreIds) deterministic from the workspace.
    const list = [...workspaceContexts, ...globalContexts];
    resolved.push(...resolveContexts(list, folder.uri, folder.name ?? ''));
  }
  return resolved;
}

function resolveContexts(
  configs: Array<ValidationContextConfig & {
    diagnostics?: { ignoreIds?: string[] | null };
  }>,
  workspaceUri: string,
  workspaceName: string
): ResolvedContext[]
{
  const workspacePath = workspaceUri ? toFsPath(workspaceUri) : '';
  return configs.map((cfg) =>
  {
    const rootDir = path.isAbsolute(cfg.rootDir)
      ? cfg.rootDir
      : workspacePath
        ? path.join(workspacePath, cfg.rootDir)
        : cfg.rootDir;
    const key = workspaceUri ? `${workspaceUri}::${cfg.name}` : cfg.name;
    return {
      ...cfg,
      rootDir,
      key,
      workspaceUri: workspaceUri || workspaceName,
      diagnosticsIgnoreIds: buildIgnoredList(cfg.diagnostics?.ignoreIds ?? [])
    };
  });
}

function shouldForceRefreshContextFiles(previous: ResolvedContext | undefined, next: ResolvedContext): boolean
{
  if (!previous) return false;
  return previous.rootDir !== next.rootDir
    || previous.filePattern !== next.filePattern
    || previous.includeSubdirectories !== next.includeSubdirectories;
}

async function getSymbolsForContext(context: ResolvedContext): Promise<SymbolInfo[]>
{
  const cached = contextCache.get(context.key);
  if (cached && !cached.symbolsStale) return cached.symbols;
  const overrides = buildOverridesForContext(context);
  const symbolsStart = performance.now();
  const symbols = await getContextSymbols(context, overrides);
  const symbolsDuration = performance.now() - symbolsStart;
  const symbolsByName = new Map<string, SymbolInfo>();
  for (const symbol of symbols)
  {
    symbolsByName.set(symbol.name.toLowerCase(), symbol);
  }
  contextCache.set(context.key, {
    files: cached?.files ?? new Set(),
    diagnosticsByFile: cached?.diagnosticsByFile ?? new Map(),
    diagHashByFile: cached?.diagHashByFile ?? new Map(),
    symbols,
    symbolsByName,
    symbolsStale: false,
    semanticsByFile: cached?.semanticsByFile ?? new Map(),
    semanticPayloadByFile: cached?.semanticPayloadByFile ?? new Map(),
    compilerDiagnostics: cached?.compilerDiagnostics ?? [],
    lastCompileWasPrefix: false
  });
  invalidateHoverCacheCustomForContext(context.key);

  if (isMetricsEnabledForContext(context))
  {
    recordMetrics({
      contextKey: context.key,
      contextName: context.name,
      phase: 'symbols',
      durationMs: symbolsDuration,
      symbolsCount: symbols.length,
      openDocsCount: contextDocs.get(context.key)?.size ?? 0
    }, context.workspaceUri);
  }

  return symbols;
}

async function getSymbolsForFallbackDocument(doc: TextDocument): Promise<SymbolInfo[]>
{
  const result = await compileFallbackDocument(doc);
  return result.symbols ?? [];
}

async function getSymbolQueryScopeForDocument(doc: TextDocument): Promise<{
  filePath: string;
  context: ResolvedContext | null;
  scope: SymbolQueryScope;
}>
{
  const filePath = toFsPath(doc.uri);
  const context = findContextForFile(filePath);
  if (context)
  {
    const overrides = buildOverridesForContext(context);
    overrides.set(normalizePathKey(filePath), doc.getText());
    const scope = await buildSymbolQueryScopeForContext(context, overrides);
    return { filePath, context, scope };
  }

  const system = getCompilerSystemForFile(filePath, null);
  const scope = await buildSymbolQueryScopeForSingleFile({
    filePath,
    text: doc.getText(),
    system
  });
  return { filePath, context: null, scope };
}

type InternalVariableDoc = Omit<InternalSignatureDoc, 'params'> & {
  /** Tipo canônico da variável interna (obrigatório nos *-internals.json). */
  dataType: string;
  /** Quando true, trata como constante (hover/completion sem '()' e cor distinta via readonly). */
  isConst?: boolean;
  params?: undefined;
};

function isInternalVariableDoc(sig: InternalSignatureDoc): sig is InternalVariableDoc
{
  const rec = sig as unknown as Record<string, unknown>;
  return typeof rec.dataType === 'string' && rec.dataType.length > 0;
}

function isConstInternalDoc(sig: InternalVariableDoc): boolean
{
  const rec = sig as unknown as Record<string, unknown>;
  return rec.isConst === true;
}

async function findCustomSymbolForHover(doc: TextDocument, context: ResolvedContext | null, wordKey: string, requestId: string): Promise<SymbolInfo | null>
{
  let symbols: SymbolInfo[] = [];
  let symbolsByName: Map<string, SymbolInfo> | undefined;
  if (context)
  {
    const cached = contextCache.get(context.key);
    symbols = cached?.symbols ?? [];
    symbolsByName = cached?.symbolsByName;
    if (!shouldServeCustomFromCommittedCache(cached))
    {
      sendLog('info', 'hover: cache custom vazio', { id: requestId });
      return null;
    }
  } else
  {
    symbols = await getSymbolsForFallbackDocument(doc);
    symbolsByName = new Map(symbols.map((symbol) => [normalizeNameForKey(symbol.name), symbol]));
  }
  return symbolsByName?.get(wordKey) ?? symbols.find((symbol) => normalizeNameForKey(symbol.name) === wordKey) ?? null;
}

// textDocument/diagnostic (Pull diagnostics) — behind initializationOptions gate.
// VSCode will only use this capability when we advertise diagnosticProvider.
const pullDiagCache = pullDiagnosticsRuntime.pullDiagCache;
const pullDiagLastItems = pullDiagnosticsRuntime.pullDiagLastItems;
const pullDiagPersistRevisionByContext = pullDiagnosticsRuntime.pullDiagPersistRevisionByContext;
const pullDiagPrewarmByUri = pullDiagnosticsRuntime.pullDiagPrewarmByUri;
const pullDiagPrewarmTimers = pullDiagnosticsRuntime.pullDiagPrewarmTimers;
const pullDiagPrewarmInFlight = pullDiagnosticsRuntime.pullDiagPrewarmInFlight;
const pullDiagDirtyStampByContext = pullDiagnosticsRuntime.pullDiagDirtyStampByContext;
const {
  pullDiagStableByUri,
  pullDiagLastNonEmptyByUri
} = pullDiagnosticsService.state;
const EMPTY_CONTEXT_FILE_PROJECTION = pullDiagnosticsService.EMPTY_CONTEXT_FILE_PROJECTION;
const hashDiagnostics = pullDiagnosticsService.hashDiagnostics;
const findDiagnosticsInContextCache = pullDiagnosticsService.findDiagnosticsInContextCache;
const buildContextFileProjection = pullDiagnosticsService.buildContextFileProjection;
const rememberRecentPullDiagZero = pullDiagnosticsService.rememberRecentZero;
const clearRecentPullDiagZero = pullDiagnosticsService.clearRecentZero;
const scheduleDidOpenPullPrewarm = pullDiagnosticsService.scheduleDidOpenPrewarm;

function resolvePullDiagnosticsWorkspaceKey(filePath: string): string
{
  return pullDiagnosticsRuntime.resolveWorkspaceKey(filePath);
}

function getPullDiagPersistCache()
{
  return pullDiagnosticsRuntime.getPersistCache();
}

async function ensurePullDiagPersistCacheLoaded(): Promise<void>
{
  await pullDiagnosticsRuntime.ensurePersistCacheLoaded();
}

function getPullDiagPersistContextRevision(contextKey: string): number
{
  return pullDiagnosticsRuntime.getPersistContextRevision(contextKey);
}

function bumpPullDiagPersistContextRevision(contextKey: string): number
{
  return pullDiagnosticsRuntime.bumpPersistContextRevision(contextKey);
}

function buildPullDiagContextSignature(context: ResolvedContext): string
{
  return pullDiagnosticsRuntime.buildContextSignature(context);
}

function computePullDiagDocHash(doc: TextDocument): string
{
  return pullDiagnosticsRuntime.computeDocHash(doc);
}

function bumpPullDiagDirtyStamp(contextKey: string): number
{
  return pullDiagnosticsRuntime.bumpDirtyStamp(contextKey);
}

function getPullDiagnosticsGlobalFollowupKey(contextKey: string, uri: string, dirtyStamp: number | null): string
{
  return pullDiagnosticsFollowupTracker.getKey(contextKey, uri, dirtyStamp);
}

function shouldSchedulePullDiagnosticsGlobalFollowup(contextKey: string, uri: string, dirtyStamp: number | null): boolean;
function shouldSchedulePullDiagnosticsGlobalFollowup(contextKey: string, uri: string, dirtyStamp: number | null, reason: string): boolean;
function shouldSchedulePullDiagnosticsGlobalFollowup(contextKey: string, uri: string, dirtyStamp: number | null, reason = 'unspecified'): boolean
{
  return pullDiagnosticsFollowupTracker.shouldSchedule(contextKey, uri, dirtyStamp, reason);
}

function setPullDiagnosticsGlobalFollowupScheduleReason(contextKey: string, uri: string, dirtyStamp: number | null, reason: string): void
{
  pullDiagnosticsFollowupTracker.setScheduleReason(contextKey, uri, dirtyStamp, reason);
}

function notePullDiagnosticsGlobalFollowupTarget(
  contextKey: string,
  uri: string,
  dirtyStamp: number | null,
  targetDocVersion: number | null | undefined,
  targetDirtyStamp?: number | null
): void
{
  pullDiagnosticsFollowupTracker.noteTarget(contextKey, uri, dirtyStamp, targetDocVersion, targetDirtyStamp);
}

function releasePullDiagnosticsGlobalFollowupForRetry(contextKey: string, uri: string, dirtyStamp: number | null): void
{
  pullDiagnosticsFollowupTracker.releaseForRetry(contextKey, uri, dirtyStamp);
}

function markPullDiagnosticsGlobalFollowupStarted(contextKey: string, uri: string | undefined): void
{
  pullDiagnosticsFollowupTracker.markStarted(contextKey, uri);
}

function markPullDiagnosticsGlobalFollowupSkipped(contextKey: string, uri: string | undefined, skippedReason: string): void
{
  pullDiagnosticsFollowupTracker.markSkipped(contextKey, uri, skippedReason);
}

function markPullDiagnosticsGlobalFollowupObserved(
  contextKey: string,
  uri: string | undefined,
  dirtyStamp: number | null,
  diagnosticsCount: number,
  resultSource?: string,
  resultAuthoritative?: boolean
): void
{
  pullDiagnosticsFollowupTracker.markObservedResponse(contextKey, uri, dirtyStamp, diagnosticsCount, resultSource, resultAuthoritative);
}

function markPullDiagnosticsGlobalFollowupExecuted(
  contextKey: string,
  uri: string | undefined,
  dirtyStamp: number | null,
  diagnosticsCount: number,
  resultSource?: string,
  resultAuthoritative?: boolean
): void
{
  pullDiagnosticsFollowupTracker.markExecuted(contextKey, uri, dirtyStamp, diagnosticsCount, resultSource, resultAuthoritative);
}

function getPullDiagnosticsGlobalFollowupOutcome(
  contextKey: string,
  uri: string,
  dirtyStamp: number | null,
  currentDocVersion?: number | null
): PullDiagnosticsGlobalFollowupOutcome | null
{
  const outcome = pullDiagnosticsFollowupTracker.getOutcome(contextKey, uri, dirtyStamp);
  if (!outcome) return null;
  const staleByDirtyStamp = Boolean(
    outcome.resolvedAtMs !== undefined
    && dirtyStamp !== null
    && outcome.targetDirtyStamp !== null
    && outcome.targetDirtyStamp < dirtyStamp
  );
  const staleByDocVersion = Boolean(
    outcome.resolvedAtMs !== undefined
    && currentDocVersion !== undefined
    && currentDocVersion !== null
    && outcome.targetDocVersion !== null
    && outcome.targetDocVersion < currentDocVersion
  );
  if (staleByDirtyStamp || staleByDocVersion) return null;
  return outcome;
}

function hasPendingOrRecentPullDiagnosticsGlobalFollowup(contextKey: string, uri: string, dirtyStamp: number | null): boolean
{
  return pullDiagnosticsFollowupTracker.hasPendingOrRecent(contextKey, uri, dirtyStamp, PULL_DIAGNOSTICS_NON_AUTHORITATIVE_ZERO_GUARD_MS);
}

function hasPendingOrRecentPullDiagnosticsGlobalFollowupForUri(contextKey: string, uri: string): boolean
{
  return pullDiagnosticsFollowupTracker.hasPendingOrRecentForUri(contextKey, uri, PULL_DIAGNOSTICS_NON_AUTHORITATIVE_ZERO_GUARD_MS);
}

function clearPendingPullDiagnosticsGlobalFollowup(contextKey: string, uri: string | undefined): void
{
  pullDiagnosticsFollowupTracker.clearPending(contextKey, uri);
}

function clearPendingPullDiagnosticsGlobalFollowupForContext(contextKey: string): void
{
  pullDiagnosticsFollowupTracker.clearPendingForContext(contextKey);
}

function clearPullDiagnosticsGlobalFollowupUriState(contextKey: string, uri: string | undefined): void
{
  pullDiagnosticsFollowupTracker.clearUriState(contextKey, uri);
}

function hasRecentPullDiagnosticsEditBurst(uri: string): boolean
{
  const lastDidChangeAt = lastDidChangeAtByUri.get(uri) ?? 0;
  return lastDidChangeAt > 0 && (Date.now() - lastDidChangeAt) <= PULL_DIAGNOSTICS_STICKY_EDIT_WINDOW_MS;
}

function clearPullDiagnosticsResidualState(uri: string, contextKey?: string | null): void
{
  pullDiagnosticsFastPathState.clearUriState(uri);
  recentFormatWindowByUri.delete(uri);
  pullDiagStableByUri.delete(uri);
  pullDiagLastNonEmptyByUri.delete(uri);
  if (contextKey) clearPullDiagnosticsGlobalFollowupUriState(contextKey, uri);
}

function flushFallbackDocumentState(uri: string, filePath: string, contextKey?: string | null): void
{
  const prewarmTimer = pullDiagPrewarmTimers.get(uri);
  if (prewarmTimer)
  {
    clearTimeout(prewarmTimer);
    pullDiagPrewarmTimers.delete(uri);
  }
  pullDiagPrewarmInFlight.delete(uri);
  pullDiagPrewarmByUri.delete(uri);
  pullDiagLastItems.delete(uri);
  pullDiagCache.delete(uri);
  clearPullDiagnosticsResidualState(uri, contextKey);
  fallbackValidationService.disposeDocument(uri);
  invalidateHoverCacheCustomForFallback(filePath);
}

function applyIgnoreIdsToLspDiagnostics(diagnostics: Diagnostic[], ignoreIds: Set<string>): Diagnostic[]
{
  if (ignoreIds.size === 0) return diagnostics;
  return diagnostics.filter((diagnostic) =>
  {
    const id = normalizeDiagnosticId(String(diagnostic.code ?? ''));
    return !id || !ignoreIds.has(id);
  });
}

async function waitWithBudget<T>(promise: Promise<T>, budgetMs: number): Promise<{ timedOut: boolean; value?: T }>
{
  if (!Number.isFinite(budgetMs) || budgetMs <= 0)
  {
    return { timedOut: false, value: await promise };
  }
  return await new Promise<{ timedOut: boolean; value?: T }>((resolve, reject) =>
  {
    const timer = setTimeout(() =>
    {
      resolve({ timedOut: true });
    }, budgetMs);
    promise
      .then((value) =>
      {
        clearTimeout(timer);
        resolve({ timedOut: false, value });
      })
      .catch((error) =>
      {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function computeDiagnosticsDirectlyForPull(
  context: ResolvedContext,
  filePath: string,
  doc: TextDocument | undefined,
  forceRefreshFiles: boolean
): Promise<Diagnostic[]>
{
  const ignored = getIgnoredForContext(context);
  const snapshot = await publicCompiler.ensureCompiledForFile(
    context,
    filePath,
    buildOverridesForContext(context),
    {
      reason: 'diagnostics',
      changedFilePaths: doc ? [filePath] : undefined,
      prefixUntilTarget: false,
      includeSemantics: false,
      includeSymbols: false,
      forceRefreshFiles
    }
  );
  const filtered = applyIgnoreIds(publicCompiler.getDiagnosticsForFile(snapshot, filePath), ignored);
  return filtered.map((diag) => toLspDiagnostic(diag));
}

async function handleDocumentDiagnostic(params: PullDiagnosticRequestParams | undefined): Promise<PullDiagnosticReport>
{
  const requestReceivedAtMs = Date.now();
  const uri = params?.textDocument?.uri;
  if (!uri) return { kind: 'full', items: [] };

  const doc = documents.get(uri);
  const filePath = toFsPath(uri);
  const workspaceUri = resolveWorkspaceUriForFile(filePath);
  const obs = getObservabilitySettingsForFile(filePath);
  const startedAt = performance.now();

  try
  {
    await ensurePullDiagPersistCacheLoaded();
    const context = findContextForFile(filePath);
    observability.log(obs, 'debug', 'pullDiagnostics.request', {
      id: `${uri}`,
      span: 'pullDiagnostics.request',
      data: {
        mode: 'pull',
        hasContext: Boolean(context),
        contextKey: context?.key ?? null,
        targetUri: uri,
        targetFilePath: filePath
      }
    });

    let ensureScheduled = false;
    const dedupKey = `${uri}:${doc?.version ?? 0}`;
    const contextKeyForResponse = context?.key ?? '__fallback__';
    const contextNameForResponse = context?.name ?? 'SingleFile/Fallback';
    const stableBeforeCompute = pullDiagStableByUri.get(uri);
    const stickySnapshotBeforeCompute = context
      ? pickStickyPullDiagnosticsSnapshotFromModule({
          contextKey: context.key,
          hasRecentEditBurst: hasRecentPullDiagnosticsEditBurst(uri),
          computedDirtyStamp: context ? (pullDiagDirtyStampByContext.get(context.key) ?? 0) : null,
          candidates: [
            stableBeforeCompute,
            pullDiagLastNonEmptyByUri.get(uri)
          ]
        })
      : null;
    const formatMarkerForStickyFastPath = recentFormatWindowByUri.get(uri);
    const withinFormatOrUndoWindowForStickyFastPath = Boolean(
      formatMarkerForStickyFastPath
      && doc
      && doc.version > formatMarkerForStickyFastPath.baseVersion
      && Date.now() <= formatMarkerForStickyFastPath.requestedAtMs + (formatMarkerForStickyFastPath.windowMs * 2)
    );
    if (
      context
      && doc
      && stickySnapshotBeforeCompute
      && params?.previousResultId === stickySnapshotBeforeCompute.resultId
      && pullDiagnosticsFastPathState.shouldUseStickyFastPath({
        uri,
        resultId: stickySnapshotBeforeCompute.resultId,
        docVersion: doc.version,
        withinFormatOrUndoWindow: withinFormatOrUndoWindowForStickyFastPath
      })
    )
    {
      ensureScheduled = scheduleStickyDiagnosticsFollowupAction({
        context,
        uri,
        filePath,
        docVersion: doc.version,
        dirtyStamp: pullDiagDirtyStampByContext.get(context.key) ?? 0,
        hasPendingOrRecentFollowupForUri: hasPendingOrRecentPullDiagnosticsGlobalFollowupForUri,
        shouldScheduleFollowup: shouldSchedulePullDiagnosticsGlobalFollowup,
        noteFollowupTarget: notePullDiagnosticsGlobalFollowupTarget,
        scheduleCompile
      });
      const durationMs = Math.round(performance.now() - startedAt);
      observability.log(
        obs,
        'debug',
        `pullDiagnostics.response kind=unchanged resultId=${stickySnapshotBeforeCompute.resultId} count=${stickySnapshotBeforeCompute.diagnostics.length}`,
        {
          id: `${uri}`,
          span: 'pullDiagnostics.response',
          durationMs,
          data: {
            kind: 'unchanged',
            source: 'context-projected',
            mode: 'pull',
            diagnosticsCount: stickySnapshotBeforeCompute.diagnostics.length,
            cacheHit: true,
            ensureScheduled,
            contextMatched: true,
            dirtyStamp: pullDiagDirtyStampByContext.get(context.key) ?? 0,
            stableUsed: true,
            isPrefix: true,
            isAuthoritative: false,
            stickyEditBurstFastPathUsed: true
          }
        }
      );
      recordPullDiagnosticsMetrics({
        workspaceUri,
        contextKey: contextKeyForResponse,
        contextName: contextNameForResponse,
        uri,
        docVersion: doc.version,
        resultId: stickySnapshotBeforeCompute.resultId,
        durationMs,
        kind: 'unchanged',
        source: 'context-projected',
        mode: 'pull',
        resultCount: stickySnapshotBeforeCompute.diagnostics.length,
        cacheHit: true,
        ensureScheduled,
        contextMatched: true,
        stableUsed: true,
        isPrefix: true,
        isAuthoritative: false,
        dirtyStamp: pullDiagDirtyStampByContext.get(context.key) ?? 0
      });
      pullDiagnosticsFastPathState.noteStickyFastPathReuse(uri, stickySnapshotBeforeCompute.resultId, doc.version);
      pullDiagnosticsFastPathState.rememberVisibleState({
        uri,
        resultId: stickySnapshotBeforeCompute.resultId,
        hash: stickySnapshotBeforeCompute.hash,
        docVersion: doc.version,
        dirtyStamp: pullDiagDirtyStampByContext.get(context.key) ?? 0,
        contextKey: context.key,
        authoritative: false
      });
      return { kind: 'unchanged', resultId: stickySnapshotBeforeCompute.resultId };
    }
    const visibleFastPath = pullDiagnosticsFastPathState.getFastPathVisibleState({
      uri,
      contextKey: context?.key ?? null,
      docVersion: doc?.version,
      dirtyStamp: context ? (pullDiagDirtyStampByContext.get(context.key) ?? 0) : null,
      previousResultId: params?.previousResultId,
      hasRecentEditBurst: hasRecentPullDiagnosticsEditBurst(uri),
      stickyEditWindowMs: PULL_DIAGNOSTICS_STICKY_EDIT_WINDOW_MS
    });
    if (
      visibleFastPath
      && pullDiagnosticsFastPathState.shouldUseStickyFastPath({
        uri,
        resultId: visibleFastPath.resultId,
        docVersion: doc?.version,
        withinFormatOrUndoWindow: withinFormatOrUndoWindowForStickyFastPath
      })
    )
    {
      const durationMs = Math.round(performance.now() - startedAt);
      observability.log(
        obs,
        'debug',
        `pullDiagnostics.response kind=unchanged resultId=${visibleFastPath.resultId} count=fast-path`,
        {
          id: `${uri}`,
          span: 'pullDiagnostics.response',
          durationMs,
          data: {
            kind: 'unchanged',
            source: 'context-projected',
            mode: 'pull',
            diagnosticsCount: null,
            cacheHit: true,
            ensureScheduled: false,
            contextMatched: Boolean(context),
            dirtyStamp: visibleFastPath.dirtyStamp,
            stableUsed: true,
            isPrefix: !visibleFastPath.authoritative,
            isAuthoritative: visibleFastPath.authoritative,
            unchangedFastPathUsed: true
          }
        }
      );
      recordPullDiagnosticsMetrics({
        workspaceUri,
        contextKey: contextKeyForResponse,
        contextName: contextNameForResponse,
        uri,
        docVersion: doc?.version,
        resultId: visibleFastPath.resultId,
        durationMs,
        kind: 'unchanged',
        source: 'context-projected',
        mode: 'pull',
        resultCount: 0,
        cacheHit: true,
        ensureScheduled: false,
        contextMatched: Boolean(context),
        stableUsed: true,
        isPrefix: !visibleFastPath.authoritative,
        isAuthoritative: visibleFastPath.authoritative,
        dirtyStamp: visibleFastPath.dirtyStamp
      });
      pullDiagnosticsFastPathState.noteStickyFastPathReuse(uri, visibleFastPath.resultId, doc?.version);
      return { kind: 'unchanged', resultId: visibleFastPath.resultId };
    }
    if (context && doc)
    {
      const persistedResolution = await pullDiagnosticsService.resolvePersistedDiagnostics({
        context,
        uri,
        filePath,
        doc,
        previousResultId: params?.previousResultId,
        didOpenReceivedAt: didOpenReceivedAtByUri.get(uri),
        stableBeforeCompute
      });
      if (persistedResolution)
      {
        if (persistedResolution.kind === 'bypass')
        {
          observability.log(obs, 'debug', 'pullDiagnostics.persistedCacheBypassed', {
            id: `${uri}`,
            span: 'pullDiagnostics.persistedCacheBypassed',
            data: {
              targetUri: uri,
              targetFilePath: filePath,
              contextKey: context.key,
              dirtyStamp: persistedResolution.dirtyStamp,
              reason: 'authoritativeCommitAfterDidOpenZero',
              persistedDiagnosticsCount: persistedResolution.persistedDiagnosticsCount,
              committedKnownFile: persistedResolution.committedKnownFile,
              committedAuthoritative: persistedResolution.committedAuthoritative,
              committedDiagnosticsCount: persistedResolution.committedDiagnosticsCount,
              compilerDiagnosticsCount: persistedResolution.compilerDiagnosticsCount,
              selectedSource: persistedResolution.source,
              selectedDiagnosticsCount: persistedResolution.diagnostics.length,
              selectedAuthoritative: persistedResolution.isAuthoritative
            }
          });
          const kind = params.previousResultId === persistedResolution.resultId ? 'unchanged' : 'full';
          const durationMs = Math.round(performance.now() - startedAt);
          observability.log(
            obs,
            'debug',
            `pullDiagnostics.response kind=${kind} resultId=${persistedResolution.resultId} count=${persistedResolution.diagnostics.length}`,
            {
              id: `${uri}`,
              span: 'pullDiagnostics.response',
              durationMs,
              data: {
                kind,
                source: persistedResolution.source,
                mode: 'pull',
                diagnosticsCount: persistedResolution.diagnostics.length,
                cacheHit: persistedResolution.cacheHit,
                ensureScheduled,
                contextMatched: true,
                dirtyStamp: persistedResolution.dirtyStamp,
                stableUsed: false,
                isPrefix: false,
                isAuthoritative: persistedResolution.isAuthoritative,
                persistedZeroBypassedAfterAuthoritativeCommit: true
              }
            }
          );
          recordPullDiagnosticsMetrics({
            workspaceUri,
            contextKey: contextKeyForResponse,
            contextName: contextNameForResponse,
            uri,
            docVersion: doc.version,
            resultId: persistedResolution.resultId,
            durationMs,
            kind,
            source: persistedResolution.source,
            mode: 'pull',
            resultCount: persistedResolution.diagnostics.length,
            cacheHit: persistedResolution.cacheHit,
            ensureScheduled,
            contextMatched: true,
            stableUsed: false,
            isPrefix: false,
            isAuthoritative: persistedResolution.isAuthoritative,
            dirtyStamp: persistedResolution.dirtyStamp
          });
          return kind === 'unchanged'
            ? { kind: 'unchanged', resultId: persistedResolution.resultId }
            : { kind: 'full', resultId: persistedResolution.resultId, items: persistedResolution.diagnostics };
        }

        const prevId = params?.previousResultId;
        const kind = prevId
          && prevId === persistedResolution.resultId
          && !shouldForcePostFormatDiagnosticsRepublish({
            uri,
            docVersion: doc.version,
            resultId: persistedResolution.resultId,
            previousResultId: prevId,
            marker: recentFormatWindowByUri.get(uri)
          }) ? 'unchanged' : 'full';
        const stableForUri = pullDiagStableByUri.get(uri) ?? null;
      const visibleBefore = pullDiagnosticsFastPathState.getVisibleState(uri);
        const shouldRetainAuthoritativeVisible = Boolean(
          visibleBefore
          && visibleBefore.authoritative
          && visibleBefore.contextKey === context.key
          && visibleBefore.resultId === persistedResolution.resultId
          && visibleBefore.docVersion === doc.version
          && stableForUri
          && stableForUri.contextKey === context.key
          && stableForUri.resultId === persistedResolution.resultId
        );
        const persistedSource = shouldRetainAuthoritativeVisible ? 'context-projected' : 'persisted-cache';
        const persistedIsAuthoritative = shouldRetainAuthoritativeVisible;
        const persistedIsPrefix = !shouldRetainAuthoritativeVisible;
        const durationMs = Math.round(performance.now() - startedAt);
        ensureScheduled = persistedResolution.scheduledFollowup || ensurePostFormatAuthoritativeFollowupAction({
          context,
          uri,
          filePath,
          docVersion: doc.version,
          dirtyStamp: persistedResolution.dirtyStamp,
          resultId: persistedResolution.resultId,
          kind,
          source: persistedSource,
          isAuthoritative: persistedIsAuthoritative,
          marker: recentFormatWindowByUri.get(uri),
          hasPendingOrRecentFollowupForUri: hasPendingOrRecentPullDiagnosticsGlobalFollowupForUri,
          shouldScheduleFollowup: shouldSchedulePullDiagnosticsGlobalFollowup,
          noteFollowupTarget: notePullDiagnosticsGlobalFollowupTarget,
          scheduleCompile,
          setMarker: (marker) => recentFormatWindowByUri.set(uri, marker as FormatWindow)
        });

        if (persistedResolution.kind === 'guarded-zero')
        {
          observability.log(
            obs,
            'debug',
            'pullDiagnostics.persistedZeroGuard',
            {
              id: `${uri}`,
              span: 'pullDiagnostics.persistedZeroGuard',
              data: {
                contextKey: context.key,
                targetUri: uri,
                targetFilePath: filePath,
                dirtyStamp: persistedResolution.dirtyStamp,
                didOpenAgeMs: persistedResolution.didOpenAgeMs,
                persistedDiagnosticsCount: persistedResolution.persistedDiagnosticsCount,
                scheduledFollowup: persistedResolution.scheduledFollowup,
                reusedSnapshotNonEmpty: persistedResolution.reusedSnapshotNonEmpty
              }
            }
          );
        }

        observability.log(
          obs,
          'debug',
          `pullDiagnostics.response kind=${kind} resultId=${persistedResolution.resultId} count=${persistedResolution.diagnostics.length}`,
          {
            id: `${uri}`,
            span: 'pullDiagnostics.response',
            durationMs,
            data: {
              kind,
              source: persistedSource,
              mode: 'pull',
              diagnosticsCount: persistedResolution.diagnostics.length,
              cacheHit: true,
              ensureScheduled,
              contextMatched: true,
              dirtyStamp: persistedResolution.dirtyStamp,
              stableUsed: persistedResolution.kind === 'guarded-zero' || persistedIsAuthoritative,
              isPrefix: persistedIsPrefix,
              isAuthoritative: persistedIsAuthoritative,
              persistedZeroGuarded: persistedResolution.kind === 'guarded-zero',
              persistedAuthoritativeRetention: shouldRetainAuthoritativeVisible
            }
          }
        );
        recordPullDiagnosticsMetrics({
          workspaceUri,
          contextKey: contextKeyForResponse,
          contextName: contextNameForResponse,
          uri,
          docVersion: doc.version,
          resultId: persistedResolution.resultId,
          durationMs,
          kind,
          source: persistedSource,
          mode: 'pull',
          resultCount: persistedResolution.diagnostics.length,
          cacheHit: true,
          ensureScheduled,
          contextMatched: true,
          stableUsed: persistedResolution.kind === 'guarded-zero' || persistedIsAuthoritative,
          isPrefix: persistedIsPrefix,
          isAuthoritative: persistedIsAuthoritative,
          dirtyStamp: persistedResolution.dirtyStamp
        });
        return kind === 'unchanged'
          ? { kind: 'unchanged', resultId: persistedResolution.resultId }
          : { kind: 'full', resultId: persistedResolution.resultId, items: persistedResolution.diagnostics };
      }
    }
    const computed = await pullDiagnosticsService.runComputeDeduped(dedupKey, async () =>
    {
      let diagnostics: Diagnostic[] = [];
      let source: 'public-api' | 'context-projected' | 'fallback-compile' | 'boot-empty' | 'persisted-cache' = 'fallback-compile';
      let cacheHit = false;
      let dirtyStamp: number | null = null;
      // "Prefix" means diagnostics are derived from an incomplete/local/prefix computation
      // or other non-authoritative sources (prewarm, boot-empty, budget-timeout stale).
      let isPrefix = false;
      // "Authoritative" means safe to commit as the new stable snapshot (can clear to 0 legitimately).
      let isAuthoritative = false;
      let contextProjectionKnownFile: boolean | null = null;
      let contextProjectionDiagnosticsCount: number | null = null;
      let contextProjectionAuthoritative: boolean | null = null;
      const contextProjectionBranch: string | null = null;
      let contextCompilerDiagnosticsCountForResponse: number | null = null;
      let contextCacheLastCompileWasPrefix: boolean | null = null;
      let contextCacheCommittedAtMs: number | null = null;
      if (!context)
      {
        return await pullDiagnosticsService.resolveNoContextDiagnostics({
          filePath,
          workspaceUri: resolveWorkspaceUriForFile(filePath),
          doc,
          booting: bootPhase === 'BOOTING',
          refreshInProgress
        });
      } else
      {
        const forceRefreshFiles = forceRefreshFilesByContext.has(context.key);
        const contextProjectionResolution = await pullDiagnosticsService.resolveContextProjectionDiagnostics({
          context,
          uri,
          filePath,
          doc,
          forceRefreshFiles,
          contextKeyForResponse,
          contextNameForResponse
        });
        if (contextProjectionResolution.ensureScheduled) ensureScheduled = true;
        if (contextProjectionResolution.result)
        {
          return contextProjectionResolution.result;
        }

        dirtyStamp = pullDiagDirtyStampByContext.get(context.key) ?? 0;
        const dirtyStampAtStart = dirtyStamp;
        const isSameDirtyStamp = () => (pullDiagDirtyStampByContext.get(context.key) ?? 0) === dirtyStampAtStart;
        const hasActiveContextCompileSignalForPull = () => hasContextCompileSignal({
          fullCompileQueuedOrRunning: isFullCompileQueuedOrRunning(fullCompileQueuedByContext, fullCompileInFlightByContext, context.key),
          compileScheduled: compileScheduled.has(context.key),
          compilePending: compilePending.has(context.key),
          compileRunning: compileRunning.get(context.key) === true
        });
        const hasRecentContextCompileSignal = () =>
          hasActiveContextCompileSignalForPull() || (() =>
          {
            const lastCommittedAt = fullCompileLastCommittedAtByContext.get(context.key);
            if (lastCommittedAt === undefined) return false;
            return Date.now() - lastCommittedAt <= PULL_DIAGNOSTICS_CONTEXT_RECENT_COMMIT_MS;
          })();
        const stable = pullDiagStableByUri.get(uri);
        const stableIsFresh = Boolean(stable && stable.contextKey === context.key && stable.dirtyStamp === dirtyStamp);
        let committed = contextCache.get(context.key);
        let projectedFromContext = contextProjectionResolution.continueWithEmptyProjection
          ? EMPTY_CONTEXT_FILE_PROJECTION
          : buildContextFileProjection(forceRefreshFiles ? undefined : committed, filePath);
        let committedForFile = !forceRefreshFiles && committed && !contextProjectionResolution.continueWithEmptyProjection
          ? findDiagnosticsInContextCache(committed, filePath)
          : null;
        let contextCompilerDiagnosticsCount = committed?.compilerDiagnostics.length ?? 0;
        const hasSameDirtyNonEmptySnapshot = Boolean(
          (stable && stable.contextKey === context.key && stable.dirtyStamp === dirtyStamp && stable.diagnostics.length > 0)
          || (pullDiagLastNonEmptyByUri.get(uri)?.contextKey === context.key
            && pullDiagLastNonEmptyByUri.get(uri)?.dirtyStamp === dirtyStamp
            && (pullDiagLastNonEmptyByUri.get(uri)?.diagnostics.length ?? 0) > 0)
        );
        contextProjectionKnownFile = projectedFromContext.knownFile;
        contextProjectionDiagnosticsCount = projectedFromContext.diagnostics.length;
        contextProjectionAuthoritative = projectedFromContext.authoritative;
        contextCompilerDiagnosticsCountForResponse = contextCompilerDiagnosticsCount;
        contextCacheLastCompileWasPrefix = committed?.lastCompileWasPrefix ?? null;
        contextCacheCommittedAtMs = fullCompileLastCommittedAtByContext.get(context.key) ?? null;

        if (projectedFromContext.knownFile)
        {
          const prewarmed = pullDiagPrewarmByUri.get(uri);
          if (prewarmed && doc && prewarmed.version === doc.version)
          {
            diagnostics = prewarmed.diagnostics;
            cacheHit = true;
            source = 'public-api';
            isPrefix = true;
            isAuthoritative = false;
            pullDiagPrewarmByUri.delete(uri);
            return {
              diagnostics,
              source,
              cacheHit,
              contextMatched: Boolean(context),
              contextKey: contextKeyForResponse,
              contextName: contextNameForResponse,
              dirtyStamp,
              isPrefix,
              isAuthoritative
            };
          }

          const didOpenReceivedAt = didOpenReceivedAtByUri.get(uri);
          const staleForDidOpenDefer = (stableBeforeCompute && stableBeforeCompute.contextKey === context.key)
            ? stableBeforeCompute.diagnostics
            : (pullDiagLastItems.get(uri) ?? []);
          const shouldDeferColdDidOpenPullForRequest = shouldDeferColdDidOpenPull({
            hasDocument: Boolean(doc),
            didOpenReceivedAt,
            reusableSnapshotCount: staleForDidOpenDefer.length,
            didOpenWindowMs: DID_OPEN_SEMANTIC_FIRST_WINDOW_MS,
            nowMs: Date.now()
          });
          if (shouldDeferColdDidOpenPullForRequest)
          {
            diagnostics = staleForDidOpenDefer;
            cacheHit = staleForDidOpenDefer.length > 0;
            source = 'public-api';
            isPrefix = true;
            isAuthoritative = false;
            sendLog(
              'debug',
              `pullDiagnostics: defer cold didOpen uri=${uri} windowMs=${DID_OPEN_SEMANTIC_FIRST_WINDOW_MS} reusedSnapshot=${staleForDidOpenDefer.length} reusedSnapshotNonEmpty=${staleForDidOpenDefer.length > 0 ? 1 : 0}`,
              { id: `${uri}`, span: 'pullDiagnostics.didOpenDefer' },
              filePath
            );
            if (!stableIsFresh)
            {
              scheduleCompile(
                context,
                DID_OPEN_SEMANTIC_FIRST_WINDOW_MS,
                'pullDiagnosticsDidOpenDefer',
                uri,
                {
                  expectedDocVersion: doc?.version,
                  changedFilePaths: doc ? [filePath] : undefined,
                  includeSemantics: false
                }
              );
              ensureScheduled = true;
            }
            return {
              diagnostics,
              source,
              cacheHit,
              contextMatched: Boolean(context),
              contextKey: contextKeyForResponse,
              contextName: contextNameForResponse,
              dirtyStamp,
              isPrefix,
              isAuthoritative
            };
          }

          if (shouldWaitForAuthoritativeContext({
            forceRefreshFiles,
            projectedAuthoritative: projectedFromContext.authoritative,
            stableIsFresh,
            hasRecentContextFullSignal: hasRecentContextCompileSignal(),
            sameDirtyStamp: isSameDirtyStamp()
          }))
          {
            const compileCompletedInBudget = await waitForNextContextCompile(context.key, PULL_DIAGNOSTICS_CONTEXT_WAIT_MS);
            if (compileCompletedInBudget)
            {
              committed = contextCache.get(context.key);
              projectedFromContext = buildContextFileProjection(committed, filePath);
              committedForFile = committed
                ? findDiagnosticsInContextCache(committed, filePath)
                : null;
              contextCompilerDiagnosticsCount = committed?.compilerDiagnostics.length ?? 0;
              if (projectedFromContext?.knownFile)
              {
                const ignored = getIgnoredForContext(context);
                diagnostics = applyIgnoreIdsToLspDiagnostics(projectedFromContext.diagnostics, ignored);
                cacheHit = true;
                source = 'context-projected';
                isPrefix = Boolean(committed?.lastCompileWasPrefix);
                isAuthoritative = committed?.lastCompileWasPrefix === false;
                if (committed && committedForFile && committedForFile.diagnostics.length === 0 && diagnostics.length > 0)
                {
                  committed.diagnosticsByFile.set(normalizePathKey(filePath), diagnostics);
                }
                if (isAuthoritative)
                {
                  const hash = hashDiagnostics(diagnostics);
                  const resultId = `${doc?.version ?? 0}:${hash}`;
                  pullDiagStableByUri.set(uri, {
                    contextKey: context.key,
                    dirtyStamp,
                    resultId,
                    hash,
                    diagnostics,
                    reportedAtMs: performance.now()
                  });
                }
                return {
                  diagnostics,
                  source,
                  cacheHit,
                  contextMatched: Boolean(context),
                  contextKey: contextKeyForResponse,
                  contextName: contextNameForResponse,
                  dirtyStamp,
                  isPrefix,
                  isAuthoritative
                };
              }
            }
          }

          // Fast path for cold start: return local/prefix diagnostics immediately.
          const ensurePromise = publicCompiler.ensureCompiledForFile(
            context,
            filePath,
            buildOverridesForContext(context),
            {
              reason: 'diagnostics',
              changedFilePaths: doc ? [filePath] : undefined,
              prefixUntilTarget: true,
              includeSemantics: false,
              includeSymbols: false,
              forceRefreshFiles: forceRefreshFilesByContext.delete(context.key)
            }
          );

          // This path is always prefix/local.
          isPrefix = true;
          isAuthoritative = false;

          const stableSnapshot = pullDiagStableByUri.get(uri);
          const hasStablePullCache = Boolean(stableSnapshot && stableSnapshot.contextKey === context.key);
          const budgeted = hasStablePullCache
            ? await waitWithBudget(ensurePromise, PULL_DIAGNOSTICS_BUDGET_MS)
            : { timedOut: false as const, value: await ensurePromise };
          if (budgeted.timedOut || !budgeted.value)
          {
            const stale = (stableSnapshot && stableSnapshot.contextKey === context.key) ? stableSnapshot.diagnostics : (pullDiagLastItems.get(uri) ?? []);
            diagnostics = stale;
            cacheHit = stale.length > 0;
            source = 'public-api';
            sendLog(
              'debug',
              `pullDiagnostics: budget exceeded uri=${uri} budgetMs=${PULL_DIAGNOSTICS_BUDGET_MS}`,
              { id: `${uri}`, span: 'pullDiagnostics.budgetExceeded' },
              filePath
            );
            if (!stableIsFresh)
            {
              scheduleCompile(
                context,
                0,
                'pullDiagnosticsBudgetTimeout',
                uri,
                {
                  expectedDocVersion: doc?.version,
                  changedFilePaths: doc ? [filePath] : undefined,
                  includeSemantics: false
                }
              );
              ensureScheduled = true;
            }
          } else
          {
            const snapshot = budgeted.value;
            const ignored = getIgnoredForContext(context);
            const filtered = applyIgnoreIds(publicCompiler.getDiagnosticsForFile(snapshot, filePath), ignored);
            diagnostics = filtered.map((d) => toLspDiagnostic(d));
            cacheHit = true;
            source = 'public-api';
          }

          if (shouldRecheckTransientPublicApiZero({
            diagnosticsCount: diagnostics.length,
            source,
            isAuthoritative,
            forceRefreshFiles,
            stableIsFresh,
            projectedAuthoritative: projectedFromContext.authoritative,
            sameDirtyStamp: isSameDirtyStamp(),
            hasRecentContextFullSignal: hasRecentContextCompileSignal()
          }))
          {
            const compileCompletedInSecondLook = await waitForNextContextCompile(context.key, PULL_DIAGNOSTICS_CONTEXT_ZERO_RECHECK_MS);
            if (compileCompletedInSecondLook)
            {
              committed = contextCache.get(context.key);
              projectedFromContext = buildContextFileProjection(committed, filePath);
              committedForFile = committed
                ? findDiagnosticsInContextCache(committed, filePath)
                : null;
              contextCompilerDiagnosticsCount = committed?.compilerDiagnostics.length ?? 0;
              if (projectedFromContext?.knownFile)
              {
                const ignored = getIgnoredForContext(context);
                diagnostics = applyIgnoreIdsToLspDiagnostics(projectedFromContext.diagnostics, ignored);
                cacheHit = true;
                source = 'context-projected';
                isPrefix = Boolean(committed?.lastCompileWasPrefix);
                isAuthoritative = committed?.lastCompileWasPrefix === false;
                if (committed && committedForFile && committedForFile.diagnostics.length === 0 && diagnostics.length > 0)
                {
                  committed.diagnosticsByFile.set(normalizePathKey(filePath), diagnostics);
                }
                if (isAuthoritative)
                {
                  const hash = hashDiagnostics(diagnostics);
                  const resultId = `${doc?.version ?? 0}:${hash}`;
                  pullDiagStableByUri.set(uri, {
                    contextKey: context.key,
                    dirtyStamp,
                    resultId,
                    hash,
                    diagnostics,
                    reportedAtMs: performance.now()
                  });
                }
                sendLog(
                  'debug',
                  `pullDiagnostics: transient public-api zero rechecked uri=${uri} waitedMs=${PULL_DIAGNOSTICS_CONTEXT_ZERO_RECHECK_MS} compileCompleted=${compileCompletedInSecondLook ? 1 : 0} promotedSource=${source} count=${diagnostics.length}`,
                  { id: `${uri}`, span: 'pullDiagnostics.transientZeroRecheck' },
                  filePath
                );
              }
            }
          }

          if (
            diagnostics.length === 0
            && shouldForceDirectCompileForZero({
              compilerDiagnosticsCount: contextCompilerDiagnosticsCount,
              projectedAuthoritative: projectedFromContext.authoritative,
              activeContextCompileSignal: hasActiveContextCompileSignalForPull(),
              hasRecentContextFullSignal: hasRecentContextCompileSignal(),
              hasSameDirtyNonEmptySnapshot
            })
          )
          {
            diagnostics = await computeDiagnosticsDirectlyForPull(context, filePath, doc, forceRefreshFiles);
            cacheHit = diagnostics.length > 0;
            source = 'fallback-compile';
            isPrefix = false;
            isAuthoritative = true;
          }

          // Slow path in background: full-context compile unlocks global diagnostics (e.g., LSP1203).
          if (
            shouldScheduleNonAuthoritativeFollowup({
              stableIsFresh,
              hasPendingOrRecentFollowup: hasPendingOrRecentPullDiagnosticsGlobalFollowupForUri(context.key, uri),
              hasRecentContextFullSignal: hasRecentContextCompileSignal(),
              trackerAllowsSchedule: shouldSchedulePullDiagnosticsGlobalFollowup(context.key, uri, dirtyStamp, 'publicApiSlowPath')
            })
          )
          {
            ensureScheduled = true;
            notePullDiagnosticsGlobalFollowupTarget(context.key, uri, dirtyStamp, doc?.version, dirtyStamp);
            scheduleCompile(
              context,
              140,
              'pullDiagnosticsGlobalFollowup',
              uri,
              {
                expectedDocVersion: doc?.version,
                changedFilePaths: doc ? [filePath] : undefined,
                includeSemantics: true,
                includeSemanticPayload: false
              }
            );
            sendLog('debug', `pullDiagnostics: authoritative followup scheduled uri=${uri} reason=non-authoritative-zero-guard dirtyStamp=${dirtyStamp ?? -1}`, { id: `${uri}`, span: 'pullDiagnostics.authoritativeFollowup' }, filePath);
          }
        }
      }
      return {
        diagnostics,
        source,
        cacheHit,
        contextMatched: Boolean(context),
        contextKey: contextKeyForResponse,
        contextName: contextNameForResponse,
        dirtyStamp,
        isPrefix,
        isAuthoritative,
        contextProjectionKnownFile,
        contextProjectionDiagnosticsCount,
        contextProjectionAuthoritative,
        contextProjectionBranch,
        contextCompilerDiagnosticsCount: contextCompilerDiagnosticsCountForResponse,
        contextCacheLastCompileWasPrefix,
        contextCacheCommittedAtMs
      };
    });
    const diagnostics = computed.diagnostics;
    const source = computed.source;
    const cacheHit = computed.cacheHit;
    const isPrefix = computed.isPrefix;
    const isAuthoritative = computed.isAuthoritative;
    const contextProjectionKnownFile = computed.contextProjectionKnownFile;
    const contextProjectionDiagnosticsCount = computed.contextProjectionDiagnosticsCount;
    const contextProjectionAuthoritative = computed.contextProjectionAuthoritative;
    const contextProjectionBranch = computed.contextProjectionBranch;
    const contextCompilerDiagnosticsCount = computed.contextCompilerDiagnosticsCount;
    const contextCacheLastCompileWasPrefix = computed.contextCacheLastCompileWasPrefix;
    const contextCacheCommittedAtMs = computed.contextCacheCommittedAtMs;
    const currentDocVersion = documents.get(uri)?.version;
    const requestDocVersion = doc?.version;
    const requestObsolete = Boolean(
      requestDocVersion !== undefined
      && currentDocVersion !== undefined
      && currentDocVersion > requestDocVersion
    );
    if (requestObsolete && hasRecentPullDiagnosticsEditBurst(uri))
    {
      const obsoleteStickySnapshot = context
        ? pickStickyPullDiagnosticsSnapshotFromModule({
            contextKey: context.key,
            hasRecentEditBurst: hasRecentPullDiagnosticsEditBurst(uri),
            computedDirtyStamp: computed.dirtyStamp,
            candidates: [
              pullDiagStableByUri.get(uri),
              pullDiagLastNonEmptyByUri.get(uri)
            ]
          })
        : null;
      const obsoleteVisible = pullDiagnosticsFastPathState.getFastPathVisibleState({
        uri,
        contextKey: context?.key ?? null,
        docVersion: requestDocVersion,
        dirtyStamp: computed.dirtyStamp,
        previousResultId: params?.previousResultId,
        hasRecentEditBurst: hasRecentPullDiagnosticsEditBurst(uri),
        stickyEditWindowMs: PULL_DIAGNOSTICS_STICKY_EDIT_WINDOW_MS
      });
      const preferredResultId = obsoleteStickySnapshot?.resultId ?? obsoleteVisible?.resultId ?? params?.previousResultId;
      if (preferredResultId)
      {
        const durationMs = Math.round(performance.now() - startedAt);
        observability.log(
          obs,
          'debug',
          'pullDiagnostics.response obsoleteRequestRetained',
          {
            id: `${uri}`,
            span: 'pullDiagnostics.response',
            durationMs,
            data: {
              kind: 'unchanged',
              source: 'context-projected',
              mode: 'pull',
              diagnosticsCount: obsoleteStickySnapshot?.diagnostics.length ?? null,
              cacheHit: true,
              ensureScheduled,
              contextMatched: Boolean(context),
              dirtyStamp: computed.dirtyStamp,
              stableUsed: true,
              isPrefix: true,
              isAuthoritative: false,
              requestObsolete: true,
              requestDocVersion,
              currentDocVersion
            }
          }
        );
        recordPullDiagnosticsMetrics({
          workspaceUri,
          contextKey: computed.contextKey,
          contextName: computed.contextName,
          uri,
          docVersion: requestDocVersion,
          resultId: preferredResultId,
          durationMs,
          kind: 'unchanged',
          source: 'context-projected',
          mode: 'pull',
          resultCount: obsoleteStickySnapshot?.diagnostics.length ?? 0,
          cacheHit: true,
          ensureScheduled,
          contextMatched: computed.contextMatched,
          stableUsed: true,
          isPrefix: true,
          isAuthoritative: false,
          dirtyStamp: computed.dirtyStamp
        });
        return { kind: 'unchanged', resultId: preferredResultId };
      }
    }
    if (context)
    {
      markPullDiagnosticsGlobalFollowupObserved(context.key, uri, computed.dirtyStamp, diagnostics.length, source, isAuthoritative);
      markPullDiagnosticsGlobalFollowupExecuted(context.key, uri, computed.dirtyStamp, diagnostics.length, source, isAuthoritative);
      const followupOutcome = getPullDiagnosticsGlobalFollowupOutcome(context.key, uri, computed.dirtyStamp, doc?.version);
      const hasFollowupLifecycle = Boolean(
        followupOutcome
        && (
          followupOutcome.startedAtMs !== undefined
          || followupOutcome.executedAtMs !== undefined
          || followupOutcome.finishedAtMs !== undefined
          || followupOutcome.skippedReason !== undefined
        )
      );
      if (followupOutcome && hasFollowupLifecycle)
      {
        const followupData = {
          reason: followupOutcome.scheduleReason,
          dirtyStamp: computed.dirtyStamp,
          startedAtMs: followupOutcome.startedAtMs ?? null,
          executedAtMs: followupOutcome.executedAtMs ?? null,
          finishedAtMs: followupOutcome.finishedAtMs ?? null,
          resolvedAtMs: followupOutcome.resolvedAtMs ?? null,
          firstObservedAtMs: followupOutcome.firstObservedAtMs ?? null,
          firstObservedResultCount: followupOutcome.firstObservedResultCount ?? null,
          firstObservedSource: followupOutcome.firstObservedSource ?? null,
          firstObservedAuthoritative: followupOutcome.firstObservedAuthoritative ?? null,
          lastResultCount: followupOutcome.lastResultCount ?? null,
          lastResultSource: followupOutcome.lastResultSource ?? null,
          lastResultAuthoritative: followupOutcome.lastResultAuthoritative ?? null,
          resolved: followupOutcome.resolvedAtMs !== undefined,
          pullTimeToFirstObservedMs: (followupOutcome.firstObservedAtMs !== undefined && followupOutcome.scheduledAtMs !== undefined) ? Math.max(0, followupOutcome.firstObservedAtMs - followupOutcome.scheduledAtMs) : null,
          pullTimeToAuthoritativeMs: (followupOutcome.resolvedAtMs !== undefined && followupOutcome.scheduledAtMs !== undefined) ? Math.max(0, followupOutcome.resolvedAtMs - followupOutcome.scheduledAtMs) : null,
          skippedReason: followupOutcome.skippedReason ?? null
        };
        observability.log(
          obs,
          'debug',
          'pullDiagnostics.authoritativeFollowup outcome',
          {
            id: `${uri}`,
            span: 'pullDiagnostics.authoritativeFollowup',
            data: followupData
          }
        );
        if (followupOutcome.scheduleReason === 'didOpenZero' || followupOutcome.scheduleReason === 'didOpenZeroRetry' || followupOutcome.scheduleReason === 'persistedZero')
        {
          const didOpenZeroFollowupData = {
            source,
            dirtyStamp: computed.dirtyStamp,
            ensureScheduled,
            followupScheduled: true,
            followupScheduleReason: followupOutcome.scheduleReason,
            followupStarted: followupOutcome.startedAtMs !== undefined,
            followupExecuted: followupOutcome.executedAtMs !== undefined,
            followupFinished: followupOutcome.finishedAtMs !== undefined,
            followupLastResultCount: followupOutcome.lastResultCount ?? null,
            followupLastResultSource: followupOutcome.lastResultSource ?? null,
            followupLastResultAuthoritative: followupOutcome.lastResultAuthoritative ?? null,
            followupResolved: followupOutcome.resolvedAtMs !== undefined,
            followupSkippedReason: followupOutcome.skippedReason ?? null,
            outcomePhase: 'afterFollowup'
          } as const;
          observability.log(
            obs,
            'debug',
            'pullDiagnostics.didOpenZeroOutcome',
            {
              id: `${uri}`,
              span: 'pullDiagnostics.didOpenZeroOutcome',
              data: didOpenZeroFollowupData
            }
          );
          if ((followupOutcome.lastResultCount ?? 0) === 0 && followupOutcome.resolvedAtMs === undefined)
          {
            observability.log(
              obs,
              'debug',
              'pullDiagnostics.didOpenZeroResidual',
              {
                id: `${uri}`,
                span: 'pullDiagnostics.didOpenZeroResidual',
                data: didOpenZeroFollowupData
              }
            );
          }
        }
      }
    }

    if (
      context
      && doc
      && diagnostics.length === 0
      && isAuthoritative
      && (source === 'public-api' || source === 'fallback-compile' || source === 'context-projected')
    )
    {
      const zeroRearmPendingForUri = hasPendingOrRecentPullDiagnosticsGlobalFollowupForUri(context.key, uri);
      const shouldAttemptAuthoritativeZeroRearm = !zeroRearmPendingForUri && !hasRecentPullDiagnosticsEditBurst(uri);
      if (shouldAttemptAuthoritativeZeroRearm) schedulePullDiagnosticsRefresh('authoritativeZeroRearm', context.workspaceUri, 40);
      if (shouldAttemptAuthoritativeZeroRearm && computed.dirtyStamp !== null && shouldSchedulePullDiagnosticsGlobalFollowup(context.key, uri, computed.dirtyStamp, 'authoritativeZeroRearm'))
      {
        setPullDiagnosticsGlobalFollowupScheduleReason(context.key, uri, computed.dirtyStamp, 'authoritativeZeroRearm');
        scheduleCompile(
          context,
          40,
          'pullDiagnosticsGlobalFollowup',
          uri,
          {
            expectedDocVersion: doc.version,
            changedFilePaths: [filePath],
            includeSemantics: true,
            includeSemanticPayload: false
          }
        );
        ensureScheduled = true;
        observability.log(
          obs,
          'debug',
          'pullDiagnostics.authoritativeFollowup scheduled=authoritativeZeroRearm',
          {
            id: `${uri}`,
            span: 'pullDiagnostics.authoritativeFollowup',
            data: {
              reason: 'authoritativeZeroRearm',
              dirtyStamp: computed.dirtyStamp,
              source,
              authoritativeAtResponse: isAuthoritative
            }
          }
        );
      }
    }

    if (
      context
      && doc
      && diagnostics.length === 0
      && (!isAuthoritative || source === 'fallback-compile')
    )
    {
      const forcedDidOpenFollowup = scheduleDidOpenZeroAuthoritativeFollowupAction({
        context,
        uri,
        filePath,
        docVersion: doc.version,
        dirtyStamp: computed.dirtyStamp,
        source,
        isAuthoritative,
        requestReceivedAtMs,
        didOpenReceivedAt: didOpenReceivedAtByUri.get(uri),
        didOpenFollowupWindowMs: PULL_DIAGNOSTICS_DIDOPEN_ZERO_FOLLOWUP_WINDOW_MS,
        hasPendingOrRecentFollowupForUri: hasPendingOrRecentPullDiagnosticsGlobalFollowupForUri,
        shouldScheduleFollowup: shouldSchedulePullDiagnosticsGlobalFollowup,
        noteFollowupTarget: notePullDiagnosticsGlobalFollowupTarget,
        setFollowupScheduleReason: setPullDiagnosticsGlobalFollowupScheduleReason,
        getFollowupOutcome: getPullDiagnosticsGlobalFollowupOutcome,
        scheduleCompile,
        logDebug: (message, data) => {
          observability.log(obs, 'debug', message, {
            id: `${uri}`,
            span: 'pullDiagnostics.authoritativeFollowup',
            data
          });
        }
      });
      if (forcedDidOpenFollowup) ensureScheduled = true;
    }

    if (
      context
      && doc
      && diagnostics.length === 0
      && source === 'fallback-compile'
      && !isAuthoritative
    )
    {
      const retryKey = getPullDiagnosticsGlobalFollowupKey(context.key, uri, computed.dirtyStamp);
      const retryCount = pullDiagnosticsFollowupTracker.getRetryCount(retryKey);
      const retryEligible = retryCount < 1;
      const activeOutcome = getPullDiagnosticsGlobalFollowupOutcome(context.key, uri, computed.dirtyStamp, doc?.version);
      if (retryEligible && activeOutcome?.startedAtMs !== undefined && activeOutcome?.resolvedAtMs === undefined)
      {
        releasePullDiagnosticsGlobalFollowupForRetry(context.key, uri, computed.dirtyStamp);
        if (shouldSchedulePullDiagnosticsGlobalFollowup(context.key, uri, computed.dirtyStamp, 'didOpenZeroRetry'))
        {
          notePullDiagnosticsGlobalFollowupTarget(context.key, uri, computed.dirtyStamp, doc.version, computed.dirtyStamp);
          pullDiagnosticsFollowupTracker.setRetryCount(retryKey, retryCount + 1);
          scheduleCompile(
            context,
            60,
            'pullDiagnosticsGlobalFollowup',
            uri,
            {
              expectedDocVersion: doc.version,
              changedFilePaths: [filePath],
              includeSemantics: true,
              includeSemanticPayload: false
            }
          );
          ensureScheduled = true;
          observability.log(
            obs,
            'debug',
            'pullDiagnostics.authoritativeFollowup retryScheduled',
            {
              id: `${uri}`,
              span: 'pullDiagnostics.authoritativeFollowup',
              data: {
                reason: 'didOpenZeroRetry',
                dirtyStamp: computed.dirtyStamp,
                retryCount: retryCount + 1,
                source,
                authoritativeAtResponse: isAuthoritative
              }
            }
          );
        }
      }
    }

    const followupOutcome = context
      ? getPullDiagnosticsGlobalFollowupOutcome(context.key, uri, computed.dirtyStamp)
      : null;
    if (context && diagnostics.length === 0 && !isAuthoritative)
    {
      const committedContextCache = contextCache.get(context.key);
      const pendingCompile = compilePending.get(context.key);
      const compileRunningNow = compileRunning.get(context.key) === true;
      const fullCompileInFlightNow = fullCompileInFlightByContext.has(context.key);
      const contextProjection = committedContextCache ? buildContextFileProjection(committedContextCache, filePath) : EMPTY_CONTEXT_FILE_PROJECTION;
      const residualFallbackReason = source !== 'fallback-compile'
        ? 'not-fallback-compile'
        : (!committedContextCache
            ? 'no-stable-context-cache'
            : ((compileRunningNow || fullCompileInFlightNow || pendingCompile !== undefined)
                ? 'materialization-not-ready'
                : (committedContextCache.lastCompileWasPrefix
                    ? 'authoritative-blocked'
                    : (!contextProjection.knownFile
                        ? 'public-api-fallback'
                        : 'empty-stable-context'))));
      const didOpenZeroData = {
        source,
        dirtyStamp: computed.dirtyStamp,
        ensureScheduled,
        followupScheduled: Boolean(followupOutcome),
        followupScheduleReason: followupOutcome?.scheduleReason ?? null,
        followupStarted: followupOutcome?.startedAtMs !== undefined,
        followupExecuted: followupOutcome?.executedAtMs !== undefined,
        followupFinished: followupOutcome?.finishedAtMs !== undefined,
        followupLastResultCount: followupOutcome?.lastResultCount ?? null,
        followupLastResultSource: followupOutcome?.lastResultSource ?? null,
        followupLastResultAuthoritative: followupOutcome?.lastResultAuthoritative ?? null,
        followupResolved: followupOutcome?.resolvedAtMs !== undefined,
        followupSkippedReason: followupOutcome?.skippedReason ?? null,
        compileRunning: compileRunningNow,
        pendingCompileReason: pendingCompile?.reason ?? null,
        pendingCompileIncludeSemantics: pendingCompile?.includeSemantics ?? null,
        fullCompileInFlight: fullCompileInFlightNow,
        cacheLastCompileWasPrefix: committedContextCache?.lastCompileWasPrefix ?? null,
        projectedKnownFile: contextProjection.knownFile,
        projectedDiagnosticsCount: contextProjection.diagnostics.length,
        projectedAuthoritative: contextProjection.authoritative,
        residualFallbackReason,
        outcomePhase: 'initial'
      };
      observability.log(
        obs,
        'debug',
        'pullDiagnostics.didOpenZeroOutcome',
        {
          id: `${uri}`,
          span: 'pullDiagnostics.didOpenZeroOutcome',
          data: didOpenZeroData
        }
      );
      observability.log(
        obs,
        'debug',
        'pullDiagnostics.didOpenZeroResidual',
        {
          id: `${uri}`,
          span: 'pullDiagnostics.didOpenZeroResidual',
          data: didOpenZeroData
        }
      );
    }

    const hash = hashDiagnostics(diagnostics);
    const cached = pullDiagCache.get(uri);
    const prevId = params?.previousResultId;
    const formatMarkerForStableOverride = recentFormatWindowByUri.get(uri);
    const withinFormatProtectionForStableOverride = Boolean(
      formatMarkerForStableOverride
      && Date.now() <= formatMarkerForStableOverride.requestedAtMs + formatMarkerForStableOverride.telemetryWindowMs
    );
    const activeEditBurstForStickyReuse = hasRecentPullDiagnosticsEditBurst(uri);
    const editBurstSnapshotOverride = getEditBurstSnapshotOverrideFromStickySnapshots({
      context,
      hasRecentEditBurst: activeEditBurstForStickyReuse,
      withinFormatProtection: withinFormatProtectionForStableOverride,
      currentDiagnosticsCount: diagnostics.length,
      isAuthoritative,
      candidates: [
        stableBeforeCompute,
        pullDiagStableByUri.get(uri),
        pullDiagLastNonEmptyByUri.get(uri)
      ]
    });
    if (editBurstSnapshotOverride)
    {
      ensureScheduled = ensureScheduled || scheduleStickyDiagnosticsFollowupAction({
        context: context ?? undefined,
        uri,
        filePath,
        docVersion: doc?.version,
        dirtyStamp: computed.dirtyStamp,
        hasPendingOrRecentFollowupForUri: hasPendingOrRecentPullDiagnosticsGlobalFollowupForUri,
        shouldScheduleFollowup: shouldSchedulePullDiagnosticsGlobalFollowup,
        noteFollowupTarget: notePullDiagnosticsGlobalFollowupTarget,
        scheduleCompile
      });
      const durationMs = Math.round(performance.now() - startedAt);
      const reuseKind = prevId && editBurstSnapshotOverride.resultId === prevId && !shouldForcePostFormatDiagnosticsRepublish({
        uri,
        docVersion: doc?.version,
        resultId: editBurstSnapshotOverride.resultId,
        previousResultId: prevId,
        marker: recentFormatWindowByUri.get(uri)
      }) ? 'unchanged' : 'full';
      observability.log(
        obs,
        'debug',
        `pullDiagnostics.response kind=${reuseKind} resultId=${editBurstSnapshotOverride.resultId} count=${editBurstSnapshotOverride.diagnostics.length}`,
        {
          id: `${uri}`,
          span: 'pullDiagnostics.response',
          durationMs,
          data: {
            kind: reuseKind,
            source,
            mode: 'pull',
            diagnosticsCount: editBurstSnapshotOverride.diagnostics.length,
            cacheHit: true,
            ensureScheduled,
            contextMatched: Boolean(context),
            dirtyStamp: computed.dirtyStamp,
            stableUsed: true,
            isPrefix: false,
            isAuthoritative: false,
            stickyEditBurstAuthoritativeOverrideUsed: true,
            contextProjectionKnownFile,
            contextProjectionDiagnosticsCount,
            contextProjectionAuthoritative,
            contextProjectionBranch,
            contextCompilerDiagnosticsCount,
            contextCacheLastCompileWasPrefix,
            contextCacheCommittedAtMs
          }
        }
      );
      recordPullDiagnosticsMetrics({
        workspaceUri,
        contextKey: computed.contextKey,
        contextName: computed.contextName,
        uri,
        docVersion: doc?.version,
        resultId: editBurstSnapshotOverride.resultId,
        durationMs,
        kind: reuseKind,
        source,
        mode: 'pull',
        resultCount: editBurstSnapshotOverride.diagnostics.length,
        cacheHit: true,
        ensureScheduled,
        contextMatched: computed.contextMatched,
        stableUsed: true,
        isPrefix: false,
        isAuthoritative: false,
        dirtyStamp: computed.dirtyStamp
      });
      pullDiagnosticsFastPathState.rememberVisibleState({
        uri,
        resultId: editBurstSnapshotOverride.resultId,
        hash: editBurstSnapshotOverride.hash,
        docVersion: doc?.version,
        dirtyStamp: computed.dirtyStamp,
        contextKey: computed.contextKey,
        authoritative: false
      });
      return reuseKind === 'unchanged'
        ? { kind: 'unchanged', resultId: editBurstSnapshotOverride.resultId }
        : { kind: 'full', resultId: editBurstSnapshotOverride.resultId, items: editBurstSnapshotOverride.diagnostics };
    }
    const authoritativeStableOverride = getAuthoritativeStableSnapshotOverrideFromStickySnapshots({
      context,
      uri,
      dirtyStamp: computed.dirtyStamp,
      currentResultId: `${doc?.version ?? 0}:${hash}`,
      diagnosticsCount: diagnostics.length,
      source,
      isAuthoritative,
      stableSnapshot: pullDiagStableByUri.get(uri),
      withinFormatProtection: withinFormatProtectionForStableOverride
    });
    if (authoritativeStableOverride)
    {
      const durationMs = Math.round(performance.now() - startedAt);
      const reuseKind = prevId && authoritativeStableOverride.resultId === prevId && !shouldForcePostFormatDiagnosticsRepublish({
        uri,
        docVersion: doc?.version,
        resultId: authoritativeStableOverride.resultId,
        previousResultId: prevId,
        marker: recentFormatWindowByUri.get(uri)
      }) ? 'unchanged' : 'full';
      pullDiagnosticsFastPathState.rememberVisibleState({
        uri,
        resultId: authoritativeStableOverride.resultId,
        hash: authoritativeStableOverride.hash,
        docVersion: doc?.version,
        dirtyStamp: authoritativeStableOverride.dirtyStamp,
        contextKey: context?.key ?? computed.contextKey,
        authoritative: true
      });
      observability.log(
        obs,
        'debug',
        `pullDiagnostics.response kind=${reuseKind} resultId=${authoritativeStableOverride.resultId} count=${authoritativeStableOverride.diagnostics.length}`,
        {
          id: `${uri}`,
          span: 'pullDiagnostics.response',
          durationMs,
          data: {
            kind: reuseKind,
            source: 'stable-snapshot',
            mode: 'pull',
            diagnosticsCount: authoritativeStableOverride.diagnostics.length,
            cacheHit: true,
            ensureScheduled,
            contextMatched: Boolean(context),
            dirtyStamp: authoritativeStableOverride.dirtyStamp,
            stableUsed: true,
            isPrefix: false,
            isAuthoritative: true,
            authoritativeStableOverrideUsed: true
          }
        }
      );
      recordPullDiagnosticsMetrics({
        workspaceUri,
        contextKey: computed.contextKey,
        contextName: computed.contextName,
        uri,
        docVersion: doc?.version,
        resultId: authoritativeStableOverride.resultId,
        durationMs,
        kind: reuseKind,
        source: 'context-projected',
        mode: 'pull',
        resultCount: authoritativeStableOverride.diagnostics.length,
        cacheHit: true,
        ensureScheduled,
        contextMatched: computed.contextMatched,
        stableUsed: true,
        isPrefix: false,
        isAuthoritative: true,
        dirtyStamp: authoritativeStableOverride.dirtyStamp
      });
      return reuseKind === 'unchanged'
        ? { kind: 'unchanged', resultId: authoritativeStableOverride.resultId }
        : { kind: 'full', resultId: authoritativeStableOverride.resultId, items: authoritativeStableOverride.diagnostics };
    }

    // Anti-flicker: avoid clearing diagnostics in transient recomputation windows.
    // Authoritative clears must pass through immediately; otherwise the last error can linger
    // until the next edit even after a full compile has already removed it.
    const stableForClearGuard = pullDiagStableByUri.get(uri);
    const lastNonEmptyForClearGuard = pullDiagLastNonEmptyByUri.get(uri);
    const sameDirtyCandidates = [
      stableBeforeCompute,
      stableForClearGuard,
      lastNonEmptyForClearGuard
    ].filter((snapshot): snapshot is StablePullDiagnosticsSnapshot | LastNonEmptyPullDiagnosticsSnapshot =>
      Boolean(
        snapshot
        && computed.dirtyStamp !== null
        && snapshot.contextKey === computed.contextKey
        && snapshot.dirtyStamp === computed.dirtyStamp
        && snapshot.diagnostics.length > 0
      )
    );
    const sameDirtyPreviousSnapshot = sameDirtyCandidates.reduce<StablePullDiagnosticsSnapshot | LastNonEmptyPullDiagnosticsSnapshot | null>(
      (best, current) =>
      {
        if (!best) return current;
        return current.diagnostics.length > best.diagnostics.length ? current : best;
      },
      null
    );
    const stickySnapshot = context
      ? pickStickyPullDiagnosticsSnapshotFromModule({
          contextKey: context.key,
          hasRecentEditBurst: hasRecentPullDiagnosticsEditBurst(uri),
          computedDirtyStamp: computed.dirtyStamp,
          candidates: [
            stableBeforeCompute,
            stableForClearGuard,
            lastNonEmptyForClearGuard
          ]
        })
      : null;
    const shouldGuardStickyEditBurst = shouldRetainStickySnapshotDuringEditBurstFromModule({
      stickySnapshot,
      currentHash: hash,
      currentDiagnosticsCount: diagnostics.length,
      isAuthoritative,
      source
    });
    if (shouldGuardStickyEditBurst && stickySnapshot)
    {
      ensureScheduled = ensureScheduled || scheduleStickyDiagnosticsFollowupAction({
        context: context ?? undefined,
        uri,
        filePath,
        docVersion: doc?.version,
        dirtyStamp: computed.dirtyStamp,
        hasPendingOrRecentFollowupForUri: hasPendingOrRecentPullDiagnosticsGlobalFollowupForUri,
        shouldScheduleFollowup: shouldSchedulePullDiagnosticsGlobalFollowup,
        noteFollowupTarget: notePullDiagnosticsGlobalFollowupTarget,
        scheduleCompile
      });
      const durationMs = Math.round(performance.now() - startedAt);
      const reuseKind = prevId && stickySnapshot.resultId === prevId && !shouldForcePostFormatDiagnosticsRepublish({
        uri,
        docVersion: doc?.version,
        resultId: stickySnapshot.resultId,
        previousResultId: prevId,
        marker: recentFormatWindowByUri.get(uri)
      }) ? 'unchanged' : 'full';
      ensureScheduled = ensureScheduled || ensurePostFormatAuthoritativeFollowupAction({
        context: context ?? undefined,
        uri,
        filePath,
        docVersion: doc?.version,
        dirtyStamp: computed.dirtyStamp,
        resultId: stickySnapshot.resultId,
        kind: reuseKind,
        source,
        isAuthoritative,
        marker: recentFormatWindowByUri.get(uri),
        hasPendingOrRecentFollowupForUri: hasPendingOrRecentPullDiagnosticsGlobalFollowupForUri,
        shouldScheduleFollowup: shouldSchedulePullDiagnosticsGlobalFollowup,
        noteFollowupTarget: notePullDiagnosticsGlobalFollowupTarget,
        scheduleCompile,
        setMarker: (marker) => recentFormatWindowByUri.set(uri, marker as FormatWindow)
      });
      observability.log(
        obs,
        'debug',
        `pullDiagnostics.response kind=${reuseKind} resultId=${stickySnapshot.resultId} count=${stickySnapshot.diagnostics.length}`,
        {
          id: `${uri}`,
          span: 'pullDiagnostics.response',
          durationMs,
          data: {
            kind: reuseKind,
            source,
            mode: 'pull',
            diagnosticsCount: stickySnapshot.diagnostics.length,
            cacheHit: true,
            ensureScheduled,
            contextMatched: Boolean(context),
            dirtyStamp: computed.dirtyStamp,
            stableUsed: true,
            isPrefix,
            isAuthoritative,
            stickyEditBurstGuarded: true,
            contextProjectionKnownFile,
            contextProjectionDiagnosticsCount,
            contextProjectionAuthoritative,
            contextProjectionBranch,
            contextCompilerDiagnosticsCount,
            contextCacheLastCompileWasPrefix,
            contextCacheCommittedAtMs
          }
        }
      );
      recordPullDiagnosticsMetrics({
        workspaceUri,
        contextKey: computed.contextKey,
        contextName: computed.contextName,
        uri,
        docVersion: doc?.version,
        resultId: stickySnapshot.resultId,
        durationMs,
        kind: reuseKind,
        source,
        mode: 'pull',
        resultCount: stickySnapshot.diagnostics.length,
        cacheHit: true,
        ensureScheduled,
        contextMatched: computed.contextMatched,
        stableUsed: true,
        isPrefix,
        isAuthoritative,
        dirtyStamp: computed.dirtyStamp
      });
      pullDiagnosticsFastPathState.rememberVisibleState({
        uri,
        resultId: stickySnapshot.resultId,
        hash: stickySnapshot.hash,
        docVersion: doc?.version,
        dirtyStamp: computed.dirtyStamp,
        contextKey: computed.contextKey,
        authoritative: false
      });
      return reuseKind === 'unchanged'
        ? { kind: 'unchanged', resultId: stickySnapshot.resultId }
        : { kind: 'full', resultId: stickySnapshot.resultId, items: stickySnapshot.diagnostics };
    }
    const shouldGuardPartialRegression = Boolean(
      sameDirtyPreviousSnapshot
      && !isAuthoritative
      && !hasRecentPullDiagnosticsEditBurst(uri)
      && diagnostics.length > 0
      && diagnostics.length < sameDirtyPreviousSnapshot.diagnostics.length
    );
    if (shouldGuardPartialRegression && sameDirtyPreviousSnapshot)
    {
      const durationMs = Math.round(performance.now() - startedAt);
      const reuseKind = prevId && sameDirtyPreviousSnapshot.resultId === prevId && !shouldForcePostFormatDiagnosticsRepublish({
        uri,
        docVersion: doc?.version,
        resultId: sameDirtyPreviousSnapshot.resultId,
        previousResultId: prevId,
        marker: recentFormatWindowByUri.get(uri)
      }) ? 'unchanged' : 'full';
      ensureScheduled = ensureScheduled || ensurePostFormatAuthoritativeFollowupAction({
        context: context ?? undefined,
        uri,
        filePath,
        docVersion: doc?.version,
        dirtyStamp: computed.dirtyStamp,
        resultId: sameDirtyPreviousSnapshot.resultId,
        kind: reuseKind,
        source,
        isAuthoritative,
        marker: recentFormatWindowByUri.get(uri),
        hasPendingOrRecentFollowupForUri: hasPendingOrRecentPullDiagnosticsGlobalFollowupForUri,
        shouldScheduleFollowup: shouldSchedulePullDiagnosticsGlobalFollowup,
        noteFollowupTarget: notePullDiagnosticsGlobalFollowupTarget,
        scheduleCompile,
        setMarker: (marker) => recentFormatWindowByUri.set(uri, marker as FormatWindow)
      });
      observability.log(
        obs,
        'debug',
        `pullDiagnostics.response kind=${reuseKind} resultId=${sameDirtyPreviousSnapshot.resultId} count=${sameDirtyPreviousSnapshot.diagnostics.length}`,
        {
          id: `${uri}`,
          span: 'pullDiagnostics.response',
          durationMs,
          data: {
            kind: reuseKind,
            source,
            mode: 'pull',
            diagnosticsCount: sameDirtyPreviousSnapshot.diagnostics.length,
            cacheHit: true,
            ensureScheduled,
            contextMatched: Boolean(context),
            dirtyStamp: computed.dirtyStamp,
            stableUsed: true,
            isPrefix,
            partialRegressionGuarded: true,
            contextProjectionKnownFile,
            contextProjectionDiagnosticsCount,
            contextProjectionAuthoritative,
            contextProjectionBranch,
            contextCompilerDiagnosticsCount,
            contextCacheLastCompileWasPrefix,
            contextCacheCommittedAtMs
          }
        }
      );
      recordPullDiagnosticsMetrics({
        workspaceUri,
        contextKey: computed.contextKey,
        contextName: computed.contextName,
        uri,
        docVersion: doc?.version,
        resultId: sameDirtyPreviousSnapshot.resultId,
        durationMs,
        kind: reuseKind,
        source,
        mode: 'pull',
        resultCount: sameDirtyPreviousSnapshot.diagnostics.length,
        cacheHit: true,
        ensureScheduled,
        contextMatched: computed.contextMatched,
        stableUsed: true,
        isPrefix,
        isAuthoritative,
        dirtyStamp: computed.dirtyStamp
      });
      pullDiagnosticsFastPathState.rememberVisibleState({
        uri,
        resultId: sameDirtyPreviousSnapshot.resultId,
        hash: sameDirtyPreviousSnapshot.hash,
        docVersion: doc?.version,
        dirtyStamp: computed.dirtyStamp,
        contextKey: computed.contextKey,
        authoritative: false
      });
      return reuseKind === 'unchanged'
        ? { kind: 'unchanged', resultId: sameDirtyPreviousSnapshot.resultId }
        : { kind: 'full', resultId: sameDirtyPreviousSnapshot.resultId, items: sameDirtyPreviousSnapshot.diagnostics };
    }
    const shouldGuardNonAuthoritativeZero = Boolean(
      diagnostics.length === 0
      && !isAuthoritative
      && sameDirtyPreviousSnapshot
      && sameDirtyPreviousSnapshot.contextKey === computed.contextKey
      && sameDirtyPreviousSnapshot.dirtyStamp === computed.dirtyStamp
      && sameDirtyPreviousSnapshot.diagnostics.length > 0
      && context
      && hasPendingOrRecentPullDiagnosticsGlobalFollowup(context.key, uri, computed.dirtyStamp)
    );
    const shouldGuardContextProjectedZero = shouldGuardNonAuthoritativeZero;
    const shouldGuardClear = diagnostics.length === 0 && shouldGuardContextProjectedZero;
    if (shouldGuardClear)
    {
      const previousSnapshot = (stableForClearGuard && stableForClearGuard.diagnostics.length > 0)
        ? stableForClearGuard
        : (lastNonEmptyForClearGuard && lastNonEmptyForClearGuard.diagnostics.length > 0 ? lastNonEmptyForClearGuard : null);
      const previousItems = previousSnapshot
        ? previousSnapshot.diagnostics
        : (pullDiagLastItems.get(uri) ?? []);
      const previousCache = previousSnapshot
        ? { resultId: previousSnapshot.resultId, hash: previousSnapshot.hash }
        : cached;
      if (previousItems.length > 0 && previousCache)
      {
        const durationMs = Math.round(performance.now() - startedAt);
        const reuseKind = prevId && previousCache.resultId === prevId && !shouldForcePostFormatDiagnosticsRepublish({
          uri,
          docVersion: doc?.version,
          resultId: previousCache.resultId,
          previousResultId: prevId,
          marker: recentFormatWindowByUri.get(uri)
        }) ? 'unchanged' : 'full';
        ensureScheduled = ensureScheduled || ensurePostFormatAuthoritativeFollowupAction({
          context: context ?? undefined,
          uri,
          filePath,
          docVersion: doc?.version,
          dirtyStamp: computed.dirtyStamp,
          resultId: previousCache.resultId,
          kind: reuseKind,
          source,
          isAuthoritative,
          marker: recentFormatWindowByUri.get(uri),
          hasPendingOrRecentFollowupForUri: hasPendingOrRecentPullDiagnosticsGlobalFollowupForUri,
          shouldScheduleFollowup: shouldSchedulePullDiagnosticsGlobalFollowup,
          noteFollowupTarget: notePullDiagnosticsGlobalFollowupTarget,
          scheduleCompile,
          setMarker: (marker) => recentFormatWindowByUri.set(uri, marker as FormatWindow)
        });
        observability.log(
          obs,
          'debug',
          `pullDiagnostics.response kind=${reuseKind} resultId=${previousCache.resultId} count=${previousItems.length}`,
          {
            id: `${uri}`,
            span: 'pullDiagnostics.response',
            durationMs,
            data: {
              kind: reuseKind,
              source,
              mode: 'pull',
              diagnosticsCount: previousItems.length,
              cacheHit: true,
              ensureScheduled,
              contextMatched: Boolean(context),
              dirtyStamp: computed.dirtyStamp,
              stableUsed: true,
              isPrefix,
              nonAuthoritativeZeroGuarded: true,
              contextProjectionKnownFile,
              contextProjectionDiagnosticsCount,
              contextProjectionAuthoritative,
              contextProjectionBranch,
              contextCompilerDiagnosticsCount,
              contextCacheLastCompileWasPrefix,
              contextCacheCommittedAtMs
            }
          }
        );
        recordPullDiagnosticsMetrics({
          workspaceUri,
          contextKey: computed.contextKey,
          contextName: computed.contextName,
          uri,
          docVersion: doc?.version,
          resultId: previousCache.resultId,
          durationMs,
          kind: reuseKind,
          source,
          mode: 'pull',
          resultCount: previousItems.length,
          cacheHit: true,
          ensureScheduled,
          contextMatched: computed.contextMatched,
          stableUsed: true,
          isPrefix,
          isAuthoritative,
          dirtyStamp: computed.dirtyStamp
        });
        pullDiagnosticsFastPathState.rememberVisibleState({
          uri,
          resultId: previousCache.resultId,
          hash: previousCache.hash,
          docVersion: doc?.version,
          dirtyStamp: computed.dirtyStamp,
          contextKey: computed.contextKey,
          authoritative: false
        });
        return reuseKind === 'unchanged'
          ? { kind: 'unchanged', resultId: previousCache.resultId }
          : { kind: 'full', resultId: previousCache.resultId, items: previousItems };
      }
    }
    const formatMarkerForProjectedPrefixExpiry = recentFormatWindowByUri.get(uri);
    const expireProjectedPrefixReuse = pullDiagnosticsFastPathState.shouldExpireProjectedPrefixReuse({
      uri,
      docVersion: doc?.version,
      resultId: cached?.resultId,
      source,
      isPrefix,
      isAuthoritative,
      hasRecentEditBurst: hasRecentPullDiagnosticsEditBurst(uri),
      withinFormatOrUndoWindow: Boolean(
        formatMarkerForProjectedPrefixExpiry
        && doc?.version !== undefined
        && doc.version > formatMarkerForProjectedPrefixExpiry.baseVersion
        && Date.now() <= formatMarkerForProjectedPrefixExpiry.requestedAtMs + (formatMarkerForProjectedPrefixExpiry.windowMs * 2)
      )
    });
    if (
      cached
      && prevId
      && cached.resultId === prevId
      && cached.hash === hash
      && !expireProjectedPrefixReuse
      && !shouldForcePostFormatDiagnosticsRepublish({
        uri,
        docVersion: doc?.version,
        resultId: cached.resultId,
        previousResultId: prevId,
        marker: recentFormatWindowByUri.get(uri)
      })
    )
    {
      ensureScheduled = ensureScheduled || ensurePostFormatAuthoritativeFollowupAction({
        context: context ?? undefined,
        uri,
        filePath,
        docVersion: doc?.version,
        dirtyStamp: computed.dirtyStamp,
        resultId: cached.resultId,
        kind: 'unchanged',
        source,
        isAuthoritative,
        marker: recentFormatWindowByUri.get(uri),
        hasPendingOrRecentFollowupForUri: hasPendingOrRecentPullDiagnosticsGlobalFollowupForUri,
        shouldScheduleFollowup: shouldSchedulePullDiagnosticsGlobalFollowup,
        noteFollowupTarget: notePullDiagnosticsGlobalFollowupTarget,
        scheduleCompile,
        setMarker: (marker) => recentFormatWindowByUri.set(uri, marker as FormatWindow)
      });
      const durationMs = Math.round(performance.now() - startedAt);
      observability.log(
        obs,
        'debug',
        `pullDiagnostics.response kind=unchanged resultId=${cached.resultId} count=${diagnostics.length}`,
        {
          id: `${uri}`,
          span: 'pullDiagnostics.response',
          durationMs,
          data: {
            kind: 'unchanged',
            source,
            mode: 'pull',
            diagnosticsCount: diagnostics.length,
            cacheHit,
            ensureScheduled,
            contextMatched: Boolean(context),
            dirtyStamp: computed.dirtyStamp,
            contextProjectionKnownFile,
            contextProjectionDiagnosticsCount,
            contextProjectionAuthoritative,
            contextProjectionBranch,
            contextCompilerDiagnosticsCount,
            contextCacheLastCompileWasPrefix,
            contextCacheCommittedAtMs
          }
        }
      );
      recordPullDiagnosticsMetrics({
        workspaceUri,
        contextKey: computed.contextKey,
        contextName: computed.contextName,
        uri,
        docVersion: doc?.version,
        resultId: cached.resultId,
        durationMs,
        kind: 'unchanged',
        source,
        mode: 'pull',
        resultCount: diagnostics.length,
        cacheHit,
        ensureScheduled,
        contextMatched: computed.contextMatched,
        stableUsed: false,
        isPrefix,
        isAuthoritative,
        dirtyStamp: computed.dirtyStamp
      });
      pullDiagnosticsFastPathState.rememberVisibleState({
        uri,
        resultId: cached.resultId,
        hash: cached.hash,
        docVersion: doc?.version,
        dirtyStamp: computed.dirtyStamp,
        contextKey: computed.contextKey,
        authoritative: isAuthoritative
      });
      return { kind: 'unchanged', resultId: cached.resultId };
    }

    const resultId = `${doc?.version ?? 0}:${hash}`;
    if (expireProjectedPrefixReuse)
    {
      ensureScheduled = ensureScheduled || ensurePostFormatAuthoritativeFollowupAction({
        context: context ?? undefined,
        uri,
        filePath,
        docVersion: doc?.version,
        dirtyStamp: computed.dirtyStamp,
        resultId,
        kind: 'full',
        source,
        isAuthoritative,
        marker: recentFormatWindowByUri.get(uri),
        hasPendingOrRecentFollowupForUri: hasPendingOrRecentPullDiagnosticsGlobalFollowupForUri,
        shouldScheduleFollowup: shouldSchedulePullDiagnosticsGlobalFollowup,
        noteFollowupTarget: notePullDiagnosticsGlobalFollowupTarget,
        scheduleCompile,
        setMarker: (marker) => recentFormatWindowByUri.set(uri, marker as FormatWindow)
      });
      if (
        context
        && doc
        && computed.dirtyStamp !== null
        && !hasPendingOrRecentPullDiagnosticsGlobalFollowupForUri(context.key, uri)
        && shouldSchedulePullDiagnosticsGlobalFollowup(context.key, uri, computed.dirtyStamp, 'projectedPrefixExpiry')
      )
      {
        setPullDiagnosticsGlobalFollowupScheduleReason(context.key, uri, computed.dirtyStamp, 'projectedPrefixExpiry');
        notePullDiagnosticsGlobalFollowupTarget(context.key, uri, computed.dirtyStamp, doc.version, computed.dirtyStamp);
        scheduleCompile(
          context,
          25,
          'pullDiagnosticsGlobalFollowup',
          uri,
          {
            expectedDocVersion: doc.version,
            changedFilePaths: [filePath],
            includeSemantics: true,
            includeSemanticPayload: false
          }
        );
        ensureScheduled = true;
      }
    }
    // Only commit authoritative results, or non-empty results.
    if (isAuthoritative || diagnostics.length > 0)
    {
      pullDiagCache.set(uri, { resultId, hash });
      pullDiagLastItems.set(uri, diagnostics);
      if (isAuthoritative && context && doc)
      {
        getPullDiagPersistCache().set({
          uri,
          filePath: normalizePathKey(filePath),
          workspaceKey: resolvePullDiagnosticsWorkspaceKey(filePath),
          contextKey: context.key,
          contextSignature: buildPullDiagContextSignature(context),
          fileHash: computePullDiagDocHash(doc),
          contextRevision: getPullDiagPersistContextRevision(context.key),
          resultId,
          hash,
          diagnostics,
          updatedAtMs: Date.now()
        });
        void getPullDiagPersistCache().flush();
      }
    }
    if (diagnostics.length > 0)
    {
      pullDiagLastNonEmptyByUri.set(uri, {
        contextKey: computed.contextKey,
        dirtyStamp: computed.dirtyStamp,
        resultId,
        hash,
        diagnostics,
        reportedAtMs: performance.now()
      });
    }
    pullDiagnosticsFastPathState.rememberVisibleState({
      uri,
      resultId,
      hash,
      docVersion: doc?.version,
      dirtyStamp: computed.dirtyStamp,
      contextKey: computed.contextKey,
      authoritative: isAuthoritative
    });

    if (context && doc)
    {
      const currentDocHash = computePullDiagDocHash(doc);
      if (diagnostics.length === 0)
      {
        rememberRecentPullDiagZero(uri, context.key, currentDocHash, doc.version, source);
      } else if (isAuthoritative)
      {
        clearRecentPullDiagZero(uri, context.key, currentDocHash);
      }
    }

    const durationMs = Math.round(performance.now() - startedAt);
    observability.log(
      obs,
      'debug',
      `pullDiagnostics.response kind=full resultId=${resultId} count=${diagnostics.length}`,
      {
        id: `${uri}`,
        span: 'pullDiagnostics.response',
        durationMs,
        data: {
          kind: 'full',
          source,
          mode: 'pull',
          diagnosticsCount: diagnostics.length,
          cacheHit,
          ensureScheduled,
          contextMatched: Boolean(context),
          dirtyStamp: computed.dirtyStamp,
          contextProjectionKnownFile,
          contextProjectionDiagnosticsCount,
          contextProjectionAuthoritative,
          contextProjectionBranch,
          contextCompilerDiagnosticsCount,
          contextCacheLastCompileWasPrefix,
          contextCacheCommittedAtMs
        }
      }
    );
    recordPullDiagnosticsMetrics({
      workspaceUri,
      contextKey: computed.contextKey,
      contextName: computed.contextName,
      uri,
      docVersion: doc?.version,
      resultId,
      durationMs,
      kind: 'full',
      source,
      mode: 'pull',
      resultCount: diagnostics.length,
      cacheHit,
      ensureScheduled,
      contextMatched: computed.contextMatched,
      stableUsed: false,
      isPrefix,
      isAuthoritative,
      dirtyStamp: computed.dirtyStamp
    });

    return { kind: 'full', resultId, items: diagnostics };
  } catch (err)
  {
    const durationMs = Math.round(performance.now() - startedAt);
    // On error, never clear diagnostics if we already have a cached snapshot.
    const stable = pullDiagStableByUri.get(uri);
    const cached = stable ? { resultId: stable.resultId, hash: stable.hash } : pullDiagCache.get(uri);
    const previousItems = stable?.diagnostics ?? (pullDiagLastItems.get(uri) ?? []);
    if (cached && previousItems.length > 0)
    {
      observability.log(
        obs,
        'warn',
        `pullDiagnostics.response kind=full resultId=${cached.resultId} count=${previousItems.length} error=${String(err)}`,
        {
          id: `${uri}`,
          span: 'pullDiagnostics.response',
          durationMs,
          data: {
            kind: 'full',
            source: 'stable',
            mode: 'pull',
            diagnosticsCount: previousItems.length,
            cacheHit: true,
            ensureScheduled: false,
            contextMatched: false,
            dirtyStamp: stable?.dirtyStamp ?? null,
            stableUsed: true
          }
        }
      );
      recordPullDiagnosticsMetrics({
        workspaceUri,
        contextKey: '__stable__',
        contextName: 'PullDiagnosticsStableFallback',
        uri,
        docVersion: doc?.version,
        resultId: cached.resultId,
        durationMs,
        kind: 'full',
        source: 'fallback-compile',
        mode: 'pull',
        resultCount: previousItems.length,
        cacheHit: true,
        ensureScheduled: false,
        contextMatched: false,
        stableUsed: true,
        isPrefix: false,
        isAuthoritative: true,
        dirtyStamp: stable?.dirtyStamp ?? null
      });
      return { kind: 'full', resultId: cached.resultId, items: previousItems };
    }
    observability.log(
      obs,
      'warn',
      `pullDiagnostics.response kind=error count=0 error=${String(err)}`,
      {
        id: `${uri}`,
        span: 'pullDiagnostics.response',
        durationMs,
        data: {
          kind: 'error',
          diagnosticsCount: 0,
          dirtyStamp: null
        }
      }
    );
    recordPullDiagnosticsMetrics({
      workspaceUri,
      contextKey: '__error__',
      contextName: 'PullDiagnosticsError',
      uri,
      docVersion: doc?.version,
      durationMs,
      kind: 'error',
      source: 'fallback-compile',
      mode: 'pull',
      resultCount: 0,
      cacheHit: false,
      ensureScheduled: false,
      contextMatched: false,
      stableUsed: false,
      isPrefix: false,
      isAuthoritative: false,
      dirtyStamp: null
    });
    sendLog('warn', `pullDiagnostics failed uri=${uri} error=${String(err)}`);
    return { kind: 'full', items: [] };
  }
}


connection.onRequest('lsp/metrics/get', () =>
{
  return {
    generatedAt: new Date().toISOString(),
    entries: metricsLog
  };
});

connection.onRequest('lsp/perf/get', () =>
{
  return buildCompilePerfSnapshotPayload();
});
const serverRuntime = createServerRuntime({
  documents,
  contextCache,
  semanticTokensCache,
  semanticTokensInFlight,
  semanticLatestRequestedVersionByUri,
  semanticTokensLastSentByUri,
  workspaceFolders,
  resolvedContexts,
  resolvedContextsByKey,
  activeDocumentUri,
  lastActiveContextKey,
  windowFocused,
  bootPhase,
  refreshInProgress,
  suppressOpenCompileUntil,
  fallbackSystemOverride,
  didOpenReceivedAtByUri,
  didOpenGenerationByUri,
  didCloseObservedGenerationByUri,
  didOpenFirstSemanticPublishedByUri,
  pendingDidOpenUris,
  recentFormatWindowByUri,
  semanticFollowupTimers,
  semanticDrainTimers,
  lastDidChangeAtByContext,
  lastDidChangeAtByUri,
  pullDiagnostics: {
    pullDiagCache,
    pullDiagLastItems,
    pullDiagPrewarmByUri,
    pullDiagPrewarmTimers,
    pullDiagPrewarmInFlight
  }
});

registerDiagnosticsHandlers({
  connection,
  handleDocumentDiagnostic
});

registerSemanticHandlers({
  connection,
  documents,
  semanticRuntime,
  toFsPath,
  computeSemanticTokensArrayDelta,
  observabilityLog: (filePath, previousResultId) =>
  {
    observability.log(getObservabilitySettingsForFile(filePath), 'debug', 'semanticTokens.deltaRequest', {
      id: filePath,
      span: 'semanticTokens.deltaRequest',
      data: { previousResultId }
    });
  },
  recordSemanticDecision
});

registerLanguageHandlers({
  connection,
  documents,
  keywords: KEYWORDS,
  types: TYPES,
  snippets: getCompletionSnippets(),
  listaMethods: LISTA_METHODS,
  listaProperties: LISTA_PROPERTIES,
  cursorMethods: CURSOR_METHODS,
  cursorProperties: CURSOR_PROPERTIES,
  toFsPath,
  toFileUri,
  findContextForFile,
  getLinePrefix,
  getWordAtPosition,
  isInsideStringLiteral,
  getSymbolsForContext,
  getSymbolsForFallbackDocument,
  completionItem,
  snippetItem,
  listaMethodCompletionItem,
  listaPropertyCompletionItem,
  getCompilerSystemForFile,
  ensureInternalSignatures,
  isInternalVariableDoc,
  isConstInternalDoc,
  normalizeNameForKey,
  sendLog,
  findCustomSymbolForHover,
  buildCustomHoverCacheKey,
  buildCustomSymbolFingerprint,
  getHoverFromCacheOrBuild,
  formatCustomSymbolHover,
  ensureInternalIndex,
  lookupOfficialHoverSignatures,
  buildOfficialHoverCacheKey,
  buildOfficialDocVersionFingerprint,
  formatInternalSignatureHover,
  getInternalOriginPrefix,
  getSymbolQueryScopeForDocument,
  resolveSymbolAtPosition,
  prepareRename,
  renameSymbol,
  formatParamLabel,
  getSignatureCallContext,
  shouldServeCustomFromCommittedCache,
  getContextCache: (contextKey) => contextCache.get(contextKey)
});

registerFormatHandlers({
  connection,
  documents,
  recentFormatWindowByUri,
  toFsPath,
  sendLog,
  getObservabilitySettingsForFile,
  observability,
  getFormatSettingsForFile,
  formatDocumentDetailed,
  clampOffset,
  preserveFinalNewline,
  recordFormatDecision: (input) => recordFormatDecision({
    ...input,
    cancelledPhase: input.cancelledPhase === 'pre' || input.cancelledPhase === 'post' ? input.cancelledPhase : undefined
  }),
  runFormatRequest,
  remapCursorOffsetByEdits,
  schedulePullDiagnosticsRefresh,
  findContextForFile,
  scheduleSemanticTokensRefresh,
  getCurrentPullDiagnosticState: (uri) => ({
    resultId: pullDiagCache.get(uri)?.resultId ?? pullDiagStableByUri.get(uri)?.resultId ?? null,
    diagnosticsCount: pullDiagLastItems.get(uri)?.length ?? null
  })
});

registerLifecycleHandlers({
  connection,
  runtime: serverRuntime,
  extensionVersion: EXTENSION_VERSION,
  setVscodeClientVersion: (version) => { vscodeClientVersion = version; },
  setWorkspaceFolders: (folders) => { workspaceFolders = folders; serverRuntime.workspaceFolders = folders; },
  setFallbackSystemOverride: (system) => { fallbackSystemOverride = system ?? undefined; serverRuntime.fallbackSystemOverride = fallbackSystemOverride; },
  setActiveDocumentUri: (uri) => { activeDocumentUri = uri; serverRuntime.activeDocumentUri = uri; },
  setLastActiveContextKey: (contextKey) => { lastActiveContextKey = contextKey; serverRuntime.lastActiveContextKey = contextKey; },
  setWindowFocused: (focused) => { windowFocused = focused; serverRuntime.windowFocused = focused; },
  onWindowFocusChanged: handleWindowFocusChanged,
  textDocumentSyncKind: TextDocumentSyncKind,
  semanticTokenTypes: [...SEMANTIC_TOKEN_TYPES],
  semanticTokenModifiers: [...SEMANTIC_TOKEN_MODIFIERS],
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
  resetFallbackValidationState: () => fallbackValidationService.reset(),
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
  disposeFallbackDocument: (uri) => fallbackValidationService.disposeDocument(uri),
  flushFallbackDocumentState,
  snapshotStore,
  getSnapshotContextId,
  docHashHistoryTracker,
  semanticTokenEditHistory,
  isLikelyFormatDrivenChange,
  getObservabilitySettingsForFile,
  observability,
  bumpPullDiagDirtyStamp,
  getCompileDelayForReason,
  priorityCompileDelayMs: PRIORITY_COMPILE_DELAY_MS,
  secondaryCompileDelayMs: SECONDARY_COMPILE_DELAY_MS,
  typingSemanticBudgetFiles: TYPING_SEMANTIC_BUDGET_FILES,
  scheduleTypingSemanticFollowup,
  invalidateHoverCacheCustomForFallback,
  pullDiagPrewarmByUri,
  pullDiagPrewarmTimers,
  pullDiagPrewarmInFlight,
  pullDiagLastItems,
  pullDiagCache,
  clearPullDiagnosticsResidualState,
  clearPendingPullDiagnosticsGlobalFollowup,
  maybeLogContextQuiesced,
  drainQuiescedContextDiagnostics,
  removeDocFromContext,
  syncOpenContexts,
  resolveOpenContexts,
  connectionSendDiagnostics: (uri, diagnostics) => connection.sendDiagnostics({ uri, diagnostics }),
  semanticRuntime,
  semanticRefreshScheduler,
  preloadInternalsForActiveContext,
  cleanupIdleContextWork
});

connection.listen();
