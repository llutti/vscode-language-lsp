import type { CompileResult, LspSystem, SemanticOccurrence, SymbolInfo, ValidationContextConfig } from '@lsp/compiler';
import type { Diagnostic, SemanticTokens, WorkspaceFolder } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { FormatWindow } from './compile/format-change-classifier';
import type { BootPhase } from './runtime/boot-phase';

export type ResolvedContext = ValidationContextConfig & {
  key: string;
  workspaceUri: string;
  diagnosticsIgnoreIds: string[];
};

export type CompilerDiagnostic = CompileResult['diagnostics'][number];

export type SemanticPayloadCacheEntry = {
  version: number;
  data: number[];
};

export type ContextCache = {
  files: Set<string>;
  symbols: SymbolInfo[];
  symbolsByName: Map<string, SymbolInfo>;
  symbolsStale: boolean;
  diagnosticsByFile: Map<string, Diagnostic[]>;
  diagHashByFile: Map<string, string>;
  semanticsByFile: Map<string, SemanticOccurrence[]>;
  semanticPayloadByFile: Map<string, SemanticPayloadCacheEntry>;
  compilerDiagnostics: CompilerDiagnostic[];
  lastCompileWasPrefix: boolean;
};

export type SemanticTokensCacheEntry = {
  version: number;
  data: number[];
  fingerprint: string;
  resultId: string;
  updatedAt: number;
};

export type PullDiagnosticsRuntimeState = {
  pullDiagCache: Map<string, unknown>;
  pullDiagLastItems: Map<string, Diagnostic[]>;
  pullDiagPrewarmByUri: Map<string, unknown>;
  pullDiagPrewarmTimers: Map<string, NodeJS.Timeout>;
  pullDiagPrewarmInFlight: Map<string, Promise<void>>;
};

export type ServerRuntime = {
  documents: Map<string, TextDocument>;
  contextCache: Map<string, ContextCache>;
  semanticTokensCache: Map<string, SemanticTokensCacheEntry>;
  semanticTokensInFlight: Map<string, Promise<SemanticTokens>>;
  semanticLatestRequestedVersionByUri: Map<string, number>;
  semanticTokensLastSentByUri: Map<string, { resultId: string; data: number[] }>;
  workspaceFolders: WorkspaceFolder[];
  resolvedContexts: ResolvedContext[];
  resolvedContextsByKey: Map<string, ResolvedContext>;
  activeDocumentUri: string | null;
  lastActiveContextKey: string | null;
  windowFocused: boolean;
  bootPhase: BootPhase;
  refreshInProgress: boolean;
  suppressOpenCompileUntil: number;
  fallbackSystemOverride: LspSystem | null | undefined;
  didOpenReceivedAtByUri: Map<string, number>;
  didOpenGenerationByUri: Map<string, number>;
  didCloseObservedGenerationByUri: Map<string, number>;
  didOpenFirstSemanticPublishedByUri: Set<string>;
  pendingDidOpenUris: Set<string>;
  recentFormatWindowByUri: Map<string, FormatWindow>;
  semanticFollowupTimers: Map<string, NodeJS.Timeout>;
  semanticDrainTimers: Map<string, NodeJS.Timeout>;
  lastDidChangeAtByContext: Map<string, number>;
  lastDidChangeAtByUri: Map<string, number>;
  pullDiagnostics: PullDiagnosticsRuntimeState;
};
