import path from 'node:path';
import type { Diagnostic, WorkspaceFolder } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { PullDiagnosticsPersistCache } from './pull-diagnostics-persist-cache';

export type PullDiagnosticsRuntimeContextLike = {
  key: string;
  rootDir: string;
  filePattern: string;
  includeSubdirectories: boolean;
  system: string;
};

export type PullDiagnosticsRuntime = {
  pullDiagCache: Map<string, { resultId: string; hash: string }>;
  pullDiagLastItems: Map<string, Diagnostic[]>;
  pullDiagPersistRevisionByContext: Map<string, number>;
  pullDiagPrewarmByUri: Map<string, { version: number; diagnostics: Diagnostic[] }>;
  pullDiagPrewarmTimers: Map<string, NodeJS.Timeout>;
  pullDiagPrewarmInFlight: Map<string, Promise<void>>;
  pullDiagDirtyStampByContext: Map<string, number>;
  pullDiagStableByUri: Map<string, {
    contextKey: string;
    dirtyStamp: number;
    resultId: string;
    hash: string;
    diagnostics: Diagnostic[];
    reportedAtMs: number;
  }>;
  pullDiagLastNonEmptyByUri: Map<string, {
    contextKey: string;
    dirtyStamp: number | null;
    resultId: string;
    hash: string;
    diagnostics: Diagnostic[];
    reportedAtMs: number;
  }>;
  resolveWorkspaceRoot: () => string;
  resolveWorkspaceKey: (filePath: string) => string;
  resolvePersistPath: () => string;
  getPersistCache: () => PullDiagnosticsPersistCache;
  ensurePersistCacheLoaded: () => Promise<void>;
  getPersistContextRevision: (contextKey: string) => number;
  bumpPersistContextRevision: (contextKey: string) => number;
  buildContextSignature: (context: PullDiagnosticsRuntimeContextLike) => string;
  computeDocHash: (doc: TextDocument) => string;
  bumpDirtyStamp: (contextKey: string) => number;
};

export function createPullDiagnosticsRuntime(input: {
  workspaceFolders: () => WorkspaceFolder[] | null | undefined;
  toFsPath: (uri: string) => string;
  normalizePathKey: (filePath: string) => string;
  getIgnoredIdsForContext: (context: PullDiagnosticsRuntimeContextLike) => Iterable<string>;
  extensionVersion: string;
  hashText: (text: string) => string;
}): PullDiagnosticsRuntime {
  const pullDiagCache = new Map<string, { resultId: string; hash: string }>();
  const pullDiagLastItems = new Map<string, Diagnostic[]>();
  const pullDiagPersistRevisionByContext = new Map<string, number>();
  const pullDiagPrewarmByUri = new Map<string, { version: number; diagnostics: Diagnostic[] }>();
  const pullDiagPrewarmTimers = new Map<string, NodeJS.Timeout>();
  const pullDiagPrewarmInFlight = new Map<string, Promise<void>>();
  const pullDiagDirtyStampByContext = new Map<string, number>();
  const pullDiagStableByUri = new Map<string, {
    contextKey: string;
    dirtyStamp: number;
    resultId: string;
    hash: string;
    diagnostics: Diagnostic[];
    reportedAtMs: number;
  }>();
  const pullDiagLastNonEmptyByUri = new Map<string, {
    contextKey: string;
    dirtyStamp: number | null;
    resultId: string;
    hash: string;
    diagnostics: Diagnostic[];
    reportedAtMs: number;
  }>();

  let pullDiagPersistCacheLoaded = false;
  let pullDiagPersistCache: PullDiagnosticsPersistCache | null = null;

  function resolveWorkspaceRoot(): string {
    const firstWorkspace = input.workspaceFolders()?.[0];
    return firstWorkspace?.uri ? input.toFsPath(firstWorkspace.uri) : process.cwd();
  }

  function resolveWorkspaceKey(filePath: string): string {
    const normalizedFilePath = input.normalizePathKey(filePath);
    for (const folder of input.workspaceFolders() ?? []) {
      if (!folder?.uri) continue;
      const rootPath = input.normalizePathKey(input.toFsPath(folder.uri));
      if (normalizedFilePath === rootPath || normalizedFilePath.startsWith(`${rootPath}/`)) {
        return rootPath;
      }
    }
    return input.normalizePathKey(resolveWorkspaceRoot());
  }

  function resolvePersistPath(): string {
    const globalStorage = process.env.LSP_V2_GLOBAL_STORAGE_PATH;
    if (globalStorage && globalStorage.trim().length > 0) {
      return path.join(globalStorage, 'cache', 'pull-diagnostics-v2.json');
    }
    const workspaceRoot = resolveWorkspaceRoot();
    return path.join(workspaceRoot, '.lsp-cache', 'pull-diagnostics-v2.json');
  }

  function getPersistCache(): PullDiagnosticsPersistCache {
    if (!pullDiagPersistCache) {
      pullDiagPersistCache = new PullDiagnosticsPersistCache(resolvePersistPath());
    }
    return pullDiagPersistCache;
  }

  async function ensurePersistCacheLoaded(): Promise<void> {
    if (pullDiagPersistCacheLoaded) return;
    pullDiagPersistCacheLoaded = true;
    await getPersistCache().load();
  }

  function getPersistContextRevision(contextKey: string): number {
    return pullDiagPersistRevisionByContext.get(contextKey) ?? 0;
  }

  function bumpPersistContextRevision(contextKey: string): number {
    const next = getPersistContextRevision(contextKey) + 1;
    pullDiagPersistRevisionByContext.set(contextKey, next);
    return next;
  }

  function buildContextSignature(context: PullDiagnosticsRuntimeContextLike): string {
    const ignored = [...input.getIgnoredIdsForContext(context)].sort().join(',');
    return [
      input.normalizePathKey(context.rootDir),
      context.filePattern,
      context.includeSubdirectories ? '1' : '0',
      context.system,
      ignored,
      input.extensionVersion
    ].join('::');
  }

  function computeDocHash(doc: TextDocument): string {
    return `v${doc.version}:${input.hashText(doc.getText())}`;
  }

  function bumpDirtyStamp(contextKey: string): number {
    const next = (pullDiagDirtyStampByContext.get(contextKey) ?? 0) + 1;
    pullDiagDirtyStampByContext.set(contextKey, next);
    return next;
  }

  return {
    pullDiagCache,
    pullDiagLastItems,
    pullDiagPersistRevisionByContext,
    pullDiagPrewarmByUri,
    pullDiagPrewarmTimers,
    pullDiagPrewarmInFlight,
    pullDiagDirtyStampByContext,
    pullDiagStableByUri,
    pullDiagLastNonEmptyByUri,
    resolveWorkspaceRoot,
    resolveWorkspaceKey,
    resolvePersistPath,
    getPersistCache,
    ensurePersistCacheLoaded,
    getPersistContextRevision,
    bumpPersistContextRevision,
    buildContextSignature,
    computeDocHash,
    bumpDirtyStamp
  };
}
