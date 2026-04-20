import * as fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import
{
  buildContext,
  fileBelongsToContext,
  type BuildContextStats,
  type ContentOverrides,
  type ValidationContext,
  type ValidationContextConfig,
  normalizePathKey
} from './context/context-manager';
import { discoverFiles } from './context/file-discovery';
import { getContextSymbols, getProgramSymbols, type SymbolInfo } from './context/symbol-index';
import { DiagnosticCodes } from './diagnostics/codes';
import { dedupeDiagnostics, sortDiagnostics } from './diagnostics/engine';
import { getCursorMethodNames } from './internals/members/cursor-methods';
import { getAllInternalVariables, getInternalSignatures, getInternalVariable, loadInternalRegistry } from './internals/registry';
import { parseSingleFile, type ParseError, type ParseErrorCode, type ParsedFile } from './parser/parser';
import { analyzeProgram, analyzeProgramIncremental, analyzeProgramWithSemantics, type SemanticCache } from './semantic/analyzer';
import type { SemanticOccurrence } from './semantic/semantic-tokens';
import { createSourceFile, type SourceFile } from './source/source-file';
import {
  formatDocument,
  formatDocumentWithDetails,
  formatLspDocument,
  formatLspText,
  formatText,
  type EmbeddedSqlAttemptDecision,
  type EmbeddedSqlAttemptReason,
  type EmbeddedSqlDialect,
  type EmbeddedSqlFormatAttempt,
  type EmbeddedSqlFormatReport,
  type EmbeddedSqlSourceKind,
  type EmbeddedSqlWrapperKind,
  type FormatDocumentReport,
  type FormatOptions
} from './formatter';
import type { EmbeddedSqlDebugEvent, EmbeddedSqlDebugReport } from './formatter/types';
import { casefold } from './utils/casefold';
import { hashText } from './utils/hash-text';
import type { FileNode, ProgramNode } from './parser/ast';

export type ContextSystem = 'HCM' | 'ACESSO' | 'ERP';
export type LspSystem = 'SENIOR' | ContextSystem;

export type DiagnosticSeverity = 'Error' | 'Warning' | 'Info';

export type Diagnostic = {
  id: string; // ex: LSP1001
  severity: DiagnosticSeverity;
  message: string;
  conceptualFamily?: string;
  sourcePath: string;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  contextId: string;
};

export type CompileResultSizeBreakdown = {
  total?: number | undefined;
  contextId?: number | undefined;
  diagnostics?: number | undefined;
  files?: number | undefined;
  symbols?: number | undefined;
  semanticsByFile?: number | undefined;
  stats?: number | undefined;
};

export type CompileResult = {
  contextId: string;
  diagnostics: Diagnostic[];
  files: string[];
  symbols?: SymbolInfo[] | undefined;
  semanticsByFile?: Map<string, SemanticOccurrence[]> | undefined;
  __stats?: CompileStats | undefined;
};

export type ParsedFilePerfEntry = {
  filePath: string;
  parseMs: number;
  sizeBytes: number;
  lineCount: number;
  tokensTotal: number;
  tokensNoTrivia: number;
  lexicalErrors: number;
  rangeFromOffsetsCalls: number;
  offsetToPositionCalls: number;
};

export type CompileStats = {
  filesDiscovered: number;
  filesRead: number;
  filesParsed: number;
  reusedFiles: number;
  reparsedFiles: number;
  reanalyzedFiles: number;
  reusedSymbols: number;
  semanticStartIndex: number;
  semanticFilesReused: number;
  semanticFilesAnalyzed: number;
  contextResolveMs: number;
  textLoadMs: number;
  incrementalReuseMs: number;
  parseMs: number;
  bindMs: number;
  analyzeMs: number;
  indexLookupMs: number;
  semanticMs: number;
  totalMs: number;
  /** Convenience: the slowest parsed file in this compile (same as parseFilesTop?.[0]) */
  parseTop?: ParsedFilePerfEntry | undefined;
  parseFilesTop?: ParsedFilePerfEntry[] | undefined;

  // Persisted text cache (cold-start IO) instrumentation
  persistedTextCacheLoaded?: boolean | undefined;
  persistedTextCacheEntries?: number | undefined;
  persistedTextCacheAddedThisRun?: number | undefined;
  persistedTextCacheHits?: number | undefined;
  persistedTextCacheMissNoEntry?: number | undefined;
  persistedTextCacheMissStatMismatch?: number | undefined;
  persistedTextCacheFile?: string | undefined;
  persistedTextCacheFirstKey?: string | undefined;

  // Context selection instrumentation
  fullFilesCount?: number | undefined;
  selectedFilesCount?: number | undefined;
  isFullContextSelected?: boolean | undefined;
};

export type CompilerSession = {
  compile: (
    config: ValidationContextConfig,
    contentOverrides?: ContentOverrides,
    options?: {
      collectStats?: boolean;
      forceRefreshFiles?: boolean;
      includeSemantics?: boolean;
      includeSymbols?: boolean;
      prefixUntilFilePath?: string;
      changedFilePaths?: string[];
      semanticBudgetFiles?: number;
      semanticFilePaths?: string[];
    }
  ) => Promise<CompileResult>;
  resetContext: (config: ValidationContextConfig) => void;
};

type FileMeta = { mtimeMs: number; size: number };

type PersistedTextEntry = { mtimeMs: number; size: number; text: string };

type SessionContextState = {
  fileList: string[];
  fileListDirty: boolean;
  fileMeta: Map<string, FileMeta>;
  sourceFileCache: Map<string, SourceFile>;
  versionKeyCache: Map<string, string>;
  lastConfigSignature: string | null;
  parsedFilesCache: ParsedFileCacheEntry[];
  semanticCache: SemanticCache | null;

  // Cold-start IO optimization (best-effort, persisted across sessions)
  persistedTextCacheLoaded: boolean;
  persistedTextCachePath: string | null;
  persistedTextCache: Map<string, PersistedTextEntry>;
  persistedTextCacheDirty: boolean;
  persistedTextCacheLastWriteMs: number;
  persistedTextCacheFirstKey: string | null;
};

type ParsedFileCacheEntry = {
  filePath: string;
  fileIndex: number;
  versionKey: string;
  fileNode: FileNode;
  parseErrors: ParseError[];
};

function assertValidContextSystem(system: string): asserts system is ContextSystem
{
  if (system !== 'HCM' && system !== 'ACESSO' && system !== 'ERP')
  {
    throw new Error(
      `System inválido para ValidationContext: ${system}. Use apenas HCM, ACESSO ou ERP (SENIOR é sempre carregado).`
    );
  }
}

function invalidateContextState(state: SessionContextState): void
{
  state.fileListDirty = true;
  state.fileMeta.clear();
  state.sourceFileCache.clear();
  state.versionKeyCache.clear();
  state.parsedFilesCache = [];
  state.semanticCache = null;
  state.persistedTextCacheLoaded = false;
  state.persistedTextCachePath = null;
  state.persistedTextCache.clear();
  state.persistedTextCacheDirty = false;
  state.persistedTextCacheLastWriteMs = 0;
}

function toAbsoluteRoot(rootDir: string): string
{
  return path.isAbsolute(rootDir) ? rootDir : path.join(process.cwd(), rootDir);
}

function configSignature(config: ValidationContextConfig, rootDirAbs: string): string
{
  return `${casefold(rootDirAbs)}::${config.filePattern}::${config.includeSubdirectories}`;
}

function contextSessionKey(config: ValidationContextConfig, rootDirAbs: string): string
{
  return `${casefold(config.name)}::${casefold(rootDirAbs)}`;
}

function buildProgram(files: FileNode[]): ProgramNode
{
  const startFile = files[0] ?? null;
  return {
    kind: 'Program',
    range: startFile ? startFile.range : { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    sourcePath: startFile?.sourcePath ?? '<empty>',
    orderKey: { fileIndex: 0, startOffset: 0 },
    files
  };
}

function versionKeyForSource(text: string): string
{
  return `override:${text.length}:${hashText(text)}`;
}

function versionKeyForDisk(text: string): string
{
  return `disk:${text.length}:${hashText(text)}`;
}



type PersistedTextCacheFile = {
  version: 1;
  entries: Array<{ keyPath: string; mtimeMs: number; size: number; text: string }>;
};

function persistedTextCacheBaseDir(rootDirAbs: string): string
{
  // Prefer VSCode global storage when provided by the extension (avoids writing into the workspace/context folder).
  const globalStorage = process.env.LSP_V2_GLOBAL_STORAGE_PATH;
  if (globalStorage && globalStorage.trim().length > 0)
  {
    return path.join(globalStorage, 'cache');
  }
  return path.join(rootDirAbs, '.lsp-cache');
}

function persistedTextCacheFilePath(rootDirAbs: string, contextKey: string): string
{
  const cacheDir = persistedTextCacheBaseDir(rootDirAbs);
  const fileName = `v2-textcache-${hashText(contextKey)}.json`;
  return path.join(cacheDir, fileName);
}

async function tryLoadPersistedTextCache(
  rootDirAbs: string,
  contextKey: string
): Promise<{ path: string; map: Map<string, PersistedTextEntry>; firstKey: string | null } | null>
{
  try
  {
    const filePath = persistedTextCacheFilePath(rootDirAbs, contextKey);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as PersistedTextCacheFile;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) return null;
    const map = new Map<string, PersistedTextEntry>();
    let firstKey: string | null = null;
    for (const e of parsed.entries)
    {
      if (!e || typeof e.keyPath !== 'string' || typeof e.text !== 'string') continue;
      const keyPath = normalizePathKey(e.keyPath);
      if (!firstKey) firstKey = keyPath;
      map.set(keyPath, { mtimeMs: Number(e.mtimeMs) || 0, size: Number(e.size) || 0, text: e.text });
    }
    return { path: filePath, map, firstKey };
  } catch
  {
    return null;
  }
}

async function tryWritePersistedTextCache(
  rootDirAbs: string,
  contextKey: string,
  map: Map<string, PersistedTextEntry>
): Promise<void>
{
  try
  {
    const filePath = persistedTextCacheFilePath(rootDirAbs, contextKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const entries: PersistedTextCacheFile['entries'] = [];
    for (const [keyPath, v] of map.entries())
    {
      // Keep file small; store only recent entries (cap at 5000).
      entries.push({ keyPath, mtimeMs: v.mtimeMs, size: v.size, text: v.text });
      if (entries.length >= 5000) break;
    }
    const payload: PersistedTextCacheFile = { version: 1, entries };
    await fs.writeFile(filePath, JSON.stringify(payload), 'utf8');
  } catch
  {
    // best-effort: ignore
  }
}


function pushTopParse(stats: CompileStats | undefined, entry: ParsedFilePerfEntry, limit = 10)
{
  if (!stats) return;
  const list = stats.parseFilesTop ?? (stats.parseFilesTop = []);
  list.push(entry);
  list.sort((a, b) => b.parseMs - a.parseMs);
  if (list.length > limit) list.length = limit;
  stats.parseTop = list[0];
}

function parseErrorToDiagnosticCode(code: ParseErrorCode): (typeof DiagnosticCodes)[keyof typeof DiagnosticCodes]
{
  switch (code)
  {
    case 'LEX_INVALID_TOKEN':
      return DiagnosticCodes.LexicalInvalidToken;
    case 'LEX_UNCLOSED_BLOCK_COMMENT':
      return DiagnosticCodes.LexicalUnclosedBlockComment;
    case 'LEX_UNCLOSED_STRING':
      return DiagnosticCodes.LexicalUnclosedString;
    case 'SYN_UNCLOSED_PAREN':
      return DiagnosticCodes.SyntaxUnclosedParen;
    case 'SYN_UNCLOSED_BRACKET':
      return DiagnosticCodes.SyntaxUnclosedBracket;
    case 'SYN_MISSING_SPACE_BEFORE_INLINE_COMMENT':
      return DiagnosticCodes.SyntaxMissingSpaceBeforeInlineComment;
    case 'SYN_UNCLOSED_BLOCK':
    case 'SYN_EXPECTED_SEMICOLON':
    case 'SYN_GENERIC':
    default:
      return DiagnosticCodes.SyntaxError;
  }
}

function shouldEmitParseDiagnostic(code: ParseErrorCode): boolean
{
  return (
    code === 'LEX_INVALID_TOKEN'
    || code === 'LEX_UNCLOSED_BLOCK_COMMENT'
    || code === 'LEX_UNCLOSED_STRING'
    || code === 'SYN_UNCLOSED_PAREN'
    || code === 'SYN_UNCLOSED_BRACKET'
    || code === 'SYN_MISSING_SPACE_BEFORE_INLINE_COMMENT'
    || code === 'SYN_UNCLOSED_BLOCK'
    || code === 'SYN_EXPECTED_SEMICOLON'
  );
}

async function runWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>
): Promise<R[]>
{
  if (values.length === 0) return [];
  const out = new Array<R>(values.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () =>
  {
    while (true)
    {
      const index = next;
      next += 1;
      if (index >= values.length) return;
      const value = values[index];
      if (value === undefined) continue;
      out[index] = await worker(value, index);
    }
  });
  await Promise.all(workers);
  return out;
}

function parseFilesIncremental(input: {
  sources: SourceFile[];
  versionKeys: string[];
  prevCache: ParsedFileCacheEntry[];
  stats?: CompileStats;
}): { program: ProgramNode; parseErrors: ParseError[]; files: ParsedFile[]; nextCache: ParsedFileCacheEntry[]; filesParsed: number }
{
  const parseErrors: ParseError[] = [];
  const parsedFiles: ParsedFile[] = [];
  const nextCache: ParsedFileCacheEntry[] = [];
  const prevByPath = new Map<string, ParsedFileCacheEntry>();
  for (const entry of input.prevCache)
  {
    prevByPath.set(normalizePathKey(entry.filePath), entry);
  }
  let filesParsed = 0;

  for (let i = 0; i < input.sources.length; i += 1)
  {
    const source = input.sources[i];
    if (!source) continue;
    const filePath = source.path;
    const keyPath = normalizePathKey(filePath);
    const versionKey = input.versionKeys[i] ?? '';
    const prev = prevByPath.get(keyPath);
    if (prev && prev.versionKey === versionKey && prev.fileIndex === i)
    {
      parsedFiles.push({ file: prev.fileNode, errors: prev.parseErrors });
      parseErrors.push(...prev.parseErrors);
      nextCache.push(prev);
      continue;
    }
    const t0 = input.stats ? performance.now() : 0;
    const parsed = parseSingleFile(source, i, input.stats ? { collectPerf: true } : undefined);
    const parseMs = input.stats ? (performance.now() - t0) : 0;
    filesParsed += 1;
    parsedFiles.push(parsed);
    parseErrors.push(...parsed.errors);
    nextCache.push({
      filePath,
      fileIndex: i,
      versionKey,
      fileNode: parsed.file,
      parseErrors: parsed.errors
    });
    if (input.stats)
    {
      const perf = parsed.perf;
      pushTopParse(input.stats, {
        filePath,
        parseMs,
        sizeBytes: Buffer.byteLength(source.text, 'utf8'),
        lineCount: source.lineStarts.length,
        tokensTotal: perf?.tokensTotal ?? 0,
        tokensNoTrivia: perf?.tokensNoTrivia ?? 0,
        lexicalErrors: perf?.lexicalErrors ?? 0,
        rangeFromOffsetsCalls: perf?.rangeFromOffsetsCalls ?? 0,
        offsetToPositionCalls: perf?.offsetToPositionCalls ?? 0
      });
    }
  }

  const program = buildProgram(parsedFiles.map((f) => f.file));
  return { program, parseErrors, files: parsedFiles, nextCache, filesParsed };
}


function filterSemanticsByFile(
  entries: Map<string, SemanticOccurrence[]> | undefined,
  filePaths: string[] | undefined
): Map<string, SemanticOccurrence[]> | undefined
{
  if (!entries) return undefined;
  if (!filePaths || filePaths.length === 0) return entries;
  const allowed = new Set(filePaths.map((filePath) => normalizePathKey(filePath)));
  const filtered = new Map<string, SemanticOccurrence[]>();
  for (const [entryPath, occurrences] of entries.entries())
  {
    if (!allowed.has(normalizePathKey(entryPath))) continue;
    filtered.set(entryPath, occurrences);
  }
  return filtered;
}

async function compileFromParsed(input: {
  contextId: string;
  system: LspSystem;
  program: ProgramNode;
  parseErrors: ParseError[];
  files: SourceFile[];
  stats: CompileStats | undefined;
  totalStart: number;
  semanticDiagnostics?: Diagnostic[] | undefined;
  semanticOccurrencesByFile?: Map<string, SemanticOccurrence[]> | undefined;
  includeSemantics?: boolean | undefined;
  semanticFilePaths?: string[] | undefined;
  includeSymbols?: boolean | undefined;
}): Promise<CompileResult>
{
  const {
    contextId,
    system,
    program,
    parseErrors,
    files,
    stats,
    totalStart,
    semanticDiagnostics,
    semanticOccurrencesByFile,
    includeSemantics,
    semanticFilePaths,
    includeSymbols
  } = input;
  const parseDiagnostics: Diagnostic[] = parseErrors
    .filter((e) => shouldEmitParseDiagnostic(e.code))
    .map((e) =>
    {
      const id = parseErrorToDiagnosticCode(e.code);
      return {
        id,
        severity: 'Error',
        message: e.message,
        sourcePath: e.sourcePath,
        range: e.range,
        contextId
      };
    });

  let semantic: { diagnostics: Diagnostic[]; occurrencesByFile?: Map<string, SemanticOccurrence[]> | undefined } = {
    diagnostics: semanticDiagnostics ?? []
  };
  if (semanticOccurrencesByFile)
  {
    semantic.occurrencesByFile = semanticOccurrencesByFile;
  }
  if (!semanticDiagnostics)
  {
    const semanticStart = stats ? performance.now() : 0;
    if (includeSemantics)
    {
      semantic = await analyzeProgramWithSemantics({
        contextId,
        system,
        program
      });
    } else
    {
      semantic = await analyzeProgram({
        contextId,
        system,
        program
      });
    }
    if (stats)
    {
      stats.semanticMs = performance.now() - semanticStart;
    }
  }

  const diagnostics = sortDiagnostics(dedupeDiagnostics([...parseDiagnostics, ...semantic.diagnostics]));
  const indexLookupStart = stats ? performance.now() : 0;
  const symbols = includeSymbols !== false ? getProgramSymbols(program) : undefined;
  if (stats)
  {
    stats.indexLookupMs = performance.now() - indexLookupStart;
  }

  if (stats)
  {
    stats.totalMs = performance.now() - totalStart;
  }

  const out: CompileResult = {
    contextId,
    diagnostics,
    files: files.map((f) => f.path),
    __stats: stats
  };
  if (symbols) out.symbols = symbols;
  if (includeSemantics)
  {
    out.semanticsByFile = filterSemanticsByFile(semantic.occurrencesByFile ?? semanticOccurrencesByFile, semanticFilePaths);
  }
  return out;
}

async function compileFromContext(
  context: ValidationContext,
  config: ValidationContextConfig,
  stats: CompileStats | undefined,
  totalStart: number,
  includeSemantics?: boolean
): Promise<CompileResult>
{
  const parseStart = stats ? performance.now() : 0;
  const parseErrors: ParseError[] = [];
  const parsedFiles: ParsedFile[] = [];
  for (let i = 0; i < context.files.length; i += 1)
  {
    const source = context.files[i];
    if (!source) continue;
    const t0 = stats ? performance.now() : 0;
    const parsed = parseSingleFile(source, i, stats ? { collectPerf: true } : undefined);
    const parseMs = stats ? (performance.now() - t0) : 0;
    parsedFiles.push(parsed);
    parseErrors.push(...parsed.errors);
    if (stats)
    {
      const perf = parsed.perf;
      pushTopParse(stats, {
        filePath: source.path,
        parseMs,
        sizeBytes: Buffer.byteLength(source.text, 'utf8'),
        lineCount: source.lineStarts.length,
        tokensTotal: perf?.tokensTotal ?? 0,
        tokensNoTrivia: perf?.tokensNoTrivia ?? 0,
        lexicalErrors: perf?.lexicalErrors ?? 0,
        rangeFromOffsetsCalls: perf?.rangeFromOffsetsCalls ?? 0,
        offsetToPositionCalls: perf?.offsetToPositionCalls ?? 0
      });
    }
  }
  const program = buildProgram(parsedFiles.map((f) => f.file));
  if (stats)
  {
    stats.parseMs = performance.now() - parseStart;
    stats.filesParsed = parsedFiles.length;
  }
  const compileInput: Parameters<typeof compileFromParsed>[0] = {
    contextId: context.id,
    system: config.system,
    program,
    parseErrors,
    files: context.files,
    stats,
    totalStart
  };
  if (includeSemantics !== undefined) compileInput.includeSemantics = includeSemantics;
  return compileFromParsed(compileInput);
}

export function createCompilerSession(): CompilerSession
{
  const contexts = new Map<string, SessionContextState>();

  async function loadSources(
    config: ValidationContextConfig,
    contentOverrides?: ContentOverrides,
    options?: { forceRefreshFiles?: boolean; prefixUntilFilePath?: string; changedFilePaths?: string[] },
    stats?: CompileStats
  ): Promise<{
    context: ValidationContext & { versionKeys: string[] };
    state: SessionContextState;
    isFullContextSelected: boolean;
  }>
  {
    const resolveStart = stats ? performance.now() : 0;
    assertValidContextSystem(config.system);
    const rootDirAbs = toAbsoluteRoot(config.rootDir);
    const signature = configSignature(config, rootDirAbs);
    const key = contextSessionKey(config, rootDirAbs);
    const existing = contexts.get(key);
    const state: SessionContextState = existing ?? {
      fileList: [],
      fileListDirty: true,
      fileMeta: new Map(),
      sourceFileCache: new Map(),
      versionKeyCache: new Map(),
      lastConfigSignature: null,
      parsedFilesCache: [],
      semanticCache: null,

      persistedTextCacheLoaded: false,
      persistedTextCachePath: null,
      persistedTextCache: new Map(),
      persistedTextCacheDirty: false,
      persistedTextCacheLastWriteMs: 0,
      persistedTextCacheFirstKey: null
    };
    if (!existing)
    {
      contexts.set(key, state);
    }
    if (state.lastConfigSignature !== signature)
    {
      state.fileListDirty = true;
      state.lastConfigSignature = signature;
    }
    if (options?.forceRefreshFiles)
    {
      state.fileListDirty = true;
    }

    if (state.fileListDirty)
    {
      state.fileList = await discoverFiles({
        rootDir: rootDirAbs,
        filePattern: config.filePattern,
        includeSubdirectories: config.includeSubdirectories
      });
      state.fileListDirty = false;
    }
    if (stats)
    {
      stats.filesDiscovered = state.fileList.length;
      stats.contextResolveMs = performance.now() - resolveStart;
    }

    let selectedFileList = state.fileList;
    if (options?.prefixUntilFilePath)
    {
      const targetKey = normalizePathKey(options.prefixUntilFilePath);
      const targetIndex = state.fileList.findIndex((filePath) => normalizePathKey(filePath) === targetKey);
      if (targetIndex >= 0)
      {
        selectedFileList = state.fileList.slice(0, targetIndex + 1);
      }
    }
    const isFullContextSelected = selectedFileList.length === state.fileList.length;

    // Cold-start persisted text cache (best-effort). Load once per context.
    if (!state.persistedTextCacheLoaded)
    {
      const loaded = await tryLoadPersistedTextCache(rootDirAbs, key);
      if (loaded)
      {
        state.persistedTextCachePath = loaded.path;
        state.persistedTextCacheFirstKey = loaded.firstKey;
        state.persistedTextCache = loaded.map;
      }
      state.persistedTextCacheLoaded = true;
    }




    const changedSet = new Set<string>(
      (options?.forceRefreshFiles ? [] : (options?.changedFilePaths ?? [])).map((p) => normalizePathKey(p))
    );

    // Persisted text cache instrumentation (per compile)
    let persistedHits = 0;
    let persistedMissNoEntry = 0;
    let persistedMissStatMismatch = 0;
    let persistedAddedThisRun = 0;

    const textLoadStart = stats ? performance.now() : 0;
    const loaded = await runWithConcurrency(
      selectedFileList,
      16,
      async (filePath) =>
      {
        const override = contentOverrides?.get(normalizePathKey(filePath));
        if (override !== undefined)
        {
          const source = createSourceFile(filePath, override);
          const versionKey = versionKeyForSource(override);
          state.sourceFileCache.set(normalizePathKey(filePath), source);
          state.versionKeyCache.set(normalizePathKey(filePath), versionKey);
          return { source, versionKey, fileRead: false };
        }

        const keyPath = normalizePathKey(filePath);

        // Fast path (typing): if we were told which files changed, avoid fs.stat for the rest.
        // This dramatically reduces per-keystroke latency in large contexts.
        if (options?.changedFilePaths && !changedSet.has(keyPath))
        {
          const cached = state.sourceFileCache.get(keyPath);
          const cachedKey = state.versionKeyCache.get(keyPath);
          if (cached && cachedKey)
          {
            return { source: cached, versionKey: cachedKey, fileRead: false };
          }
        }

        const stat = await fs.stat(filePath);

        const meta = state.fileMeta.get(keyPath);
        const statMtime = Math.trunc(stat.mtimeMs);
        if (meta && meta.mtimeMs === statMtime && meta.size === stat.size)
        {
          const cached = state.sourceFileCache.get(keyPath);
          if (cached)
          {
            const cachedKey = state.versionKeyCache.get(keyPath) ?? versionKeyForDisk(cached.text);
            state.versionKeyCache.set(keyPath, cachedKey);
            return { source: cached, versionKey: cachedKey, fileRead: false };
          }
        }

        const persisted = state.persistedTextCache.get(keyPath);
        if (persisted)
        {
          if (persisted.mtimeMs === statMtime && persisted.size === stat.size)
          {
            persistedHits += 1;
            const source = createSourceFile(filePath, persisted.text);
            const versionKey = versionKeyForDisk(persisted.text);
            state.fileMeta.set(keyPath, { mtimeMs: statMtime, size: stat.size });
            state.sourceFileCache.set(keyPath, source);
            state.versionKeyCache.set(keyPath, versionKey);
            return { source, versionKey, fileRead: false };
          }
          persistedMissStatMismatch += 1;
        }
        else
        {
          persistedMissNoEntry += 1;
        }

const text = await fs.readFile(filePath, 'utf8');
        const source = createSourceFile(filePath, text);
        const versionKey = versionKeyForDisk(text);
        state.fileMeta.set(keyPath, { mtimeMs: statMtime, size: stat.size });
        state.sourceFileCache.set(keyPath, source);
        state.versionKeyCache.set(keyPath, versionKey);

        const hadPersisted = state.persistedTextCache.has(keyPath);
        state.persistedTextCache.set(keyPath, { mtimeMs: statMtime, size: stat.size, text });
        if (!hadPersisted)
        {
          persistedAddedThisRun += 1;
        }
        state.persistedTextCacheDirty = true;

        return { source, versionKey, fileRead: true };
      }
    );
    if (stats)
    {
      stats.textLoadMs = performance.now() - textLoadStart;
    }

    const files: SourceFile[] = [];
    const versionKeys: string[] = [];
    for (const entry of loaded)
    {
      files.push(entry.source);
      versionKeys.push(entry.versionKey);
      if (stats && entry.fileRead)
      {
        stats.filesRead += 1;
      }
    }

    if (stats)
    {
      stats.persistedTextCacheLoaded = state.persistedTextCacheLoaded;
      stats.persistedTextCacheFile = state.persistedTextCachePath ?? undefined;
      stats.persistedTextCacheFirstKey = state.persistedTextCacheFirstKey ?? undefined;
      stats.persistedTextCacheEntries = state.persistedTextCache.size;
      stats.persistedTextCacheAddedThisRun = persistedAddedThisRun;
      stats.persistedTextCacheHits = persistedHits;
      stats.persistedTextCacheMissNoEntry = persistedMissNoEntry;
      stats.persistedTextCacheMissStatMismatch = persistedMissStatMismatch;
      stats.fullFilesCount = state.fileList.length;
      stats.selectedFilesCount = selectedFileList.length;
      stats.isFullContextSelected = isFullContextSelected;
    }

    const context = {
      id: casefold(config.name),
      config,
      rootDirAbs,
      files,
      versionKeys
    } as ValidationContext & { versionKeys: string[] };
// Persist consolidated text cache occasionally (best-effort).
// - We always allow the *first* write for a context (so cold start can benefit next time),
//   even if we're currently in the typing/incremental path.
// - After that, we throttle writes more aggressively when changedFilePaths is provided.
if (state.persistedTextCacheDirty)
{
  const now = Date.now();
  const isFirstWrite = state.persistedTextCacheLastWriteMs === 0;
  const minIntervalMs = options?.changedFilePaths?.length ? 15000 : 5000;
  const shouldWrite = isFirstWrite || (now - state.persistedTextCacheLastWriteMs) > minIntervalMs;
  if (shouldWrite)
  {
    // Ensure stats can point to the right file even before the write completes.
    if (!state.persistedTextCachePath)
    {
      state.persistedTextCachePath = persistedTextCacheFilePath(rootDirAbs, key);
    }
    await tryWritePersistedTextCache(rootDirAbs, key, state.persistedTextCache);
    state.persistedTextCacheDirty = false;
    state.persistedTextCacheLastWriteMs = now;
  }
}

return { context, state, isFullContextSelected };

  }

  return {
    async compile(config, contentOverrides, options)
    {
      assertValidContextSystem(config.system);
      const stats: CompileStats | undefined = options?.collectStats
        ? {
          filesDiscovered: 0,
          filesRead: 0,
          filesParsed: 0,
          reusedFiles: 0,
          reparsedFiles: 0,
          reanalyzedFiles: 0,
          reusedSymbols: 0,
          semanticStartIndex: 0,
          semanticFilesReused: 0,
          semanticFilesAnalyzed: 0,
          contextResolveMs: 0,
          textLoadMs: 0,
          incrementalReuseMs: 0,
          parseMs: 0,
          bindMs: 0,
          analyzeMs: 0,
          indexLookupMs: 0,
          semanticMs: 0,
          totalMs: 0
        }
        : undefined;
      const totalStart = stats ? performance.now() : 0;
      const rootDirAbs = toAbsoluteRoot(config.rootDir);
      const key = contextSessionKey(config, rootDirAbs);
      let state: SessionContextState | null = contexts.get(key) ?? null;
      try
      {
        const loaded = await loadSources(config, contentOverrides, options, stats);
        const context = loaded.context;
        state = loaded.state;
        const isFullContextValidated = loaded.isFullContextSelected;
        const parseStart = stats ? performance.now() : 0;
        const parsedInput: Parameters<typeof parseFilesIncremental>[0] = {
          sources: context.files,
          versionKeys: context.versionKeys,
          prevCache: state.parsedFilesCache
        };
        if (stats) parsedInput.stats = stats;
        const parsed = parseFilesIncremental(parsedInput);
        // IMPORTANT: do not let prefix compiles (partial file selection) shrink/poison caches.
        // Prefix compiles use a sliced file list, which changes fileIndex values (0..N) and makes
        // the resulting cache incompatible with a later full-context compile.
        if (isFullContextValidated)
        {
          state.parsedFilesCache = parsed.nextCache;
        }
        if (stats)
        {
          stats.parseMs = performance.now() - parseStart;
          stats.filesParsed = parsed.filesParsed;
          stats.reparsedFiles = parsed.filesParsed;
          stats.reusedFiles = Math.max(0, context.files.length - parsed.filesParsed);
        }
        const semanticStart = stats ? performance.now() : 0;
        const shouldRunSemantic = options?.includeSemantics !== false;
        let semanticDiagnostics: Diagnostic[] = [];
        let semanticOccurrencesByFile: Map<string, SemanticOccurrence[]> | undefined;
        if (shouldRunSemantic)
        {
          const semanticInput: Parameters<typeof analyzeProgramIncremental>[0] = {
            contextId: context.id,
            system: config.system,
            program: parsed.program,
            versionKeys: context.versionKeys,
            isFullContextValidated
          };
          if (state.semanticCache) semanticInput.prevCache = state.semanticCache;
          if (options?.changedFilePaths) semanticInput.changedFilePaths = options.changedFilePaths;
          if (options?.includeSemantics !== undefined) semanticInput.includeSemantics = options.includeSemantics;
          if (options?.semanticBudgetFiles !== undefined) semanticInput.semanticBudgetFiles = options.semanticBudgetFiles;
          const semantic = await analyzeProgramIncremental(semanticInput);
          semanticDiagnostics = semantic.diagnostics;
          semanticOccurrencesByFile = semantic.occurrencesByFile;
          if (stats)
          {
            stats.semanticMs = performance.now() - semanticStart;
            stats.semanticStartIndex = semantic.startIndex;
            stats.semanticFilesReused = semantic.reusedFiles;
            stats.semanticFilesAnalyzed = semantic.analyzedFiles;
            stats.reanalyzedFiles = semantic.analyzedFiles;
            stats.reusedSymbols = semantic.reusedFiles;
            stats.incrementalReuseMs = semantic.incrementalReuseMs;
            stats.bindMs = semantic.bindMs;
            stats.analyzeMs = semantic.analyzeMs;
          }
          // Same rule as parse cache: do not let prefix compiles shrink/poison semantic caches.
          if (isFullContextValidated)
          {
            state.semanticCache = semantic.cache;
          }
        } else if (stats)
        {
          stats.semanticMs = 0;
          stats.semanticStartIndex = 0;
          stats.semanticFilesReused = 0;
          stats.semanticFilesAnalyzed = 0;
          stats.reanalyzedFiles = 0;
          stats.reusedSymbols = 0;
          stats.incrementalReuseMs = 0;
          stats.bindMs = 0;
          stats.analyzeMs = 0;
        }
        const compileInput: Parameters<typeof compileFromParsed>[0] = {
          contextId: context.id,
          system: config.system,
          program: parsed.program,
          parseErrors: parsed.parseErrors,
          files: context.files,
          stats,
          totalStart
        };
        compileInput.semanticDiagnostics = semanticDiagnostics;
        if (semanticOccurrencesByFile) compileInput.semanticOccurrencesByFile = semanticOccurrencesByFile;
        if (options?.includeSemantics !== undefined) compileInput.includeSemantics = options.includeSemantics;
        if (options?.semanticFilePaths !== undefined) compileInput.semanticFilePaths = options.semanticFilePaths;
        if (options?.includeSymbols !== undefined) compileInput.includeSymbols = options.includeSymbols;
        return compileFromParsed(compileInput);
      } catch (error)
      {
        if (state)
        {
          invalidateContextState(state);
        }
        throw error;
      }
    },
    resetContext(config)
    {
      const rootDirAbs = toAbsoluteRoot(config.rootDir);
      const key = contextSessionKey(config, rootDirAbs);
      contexts.delete(key);
    }
  };
}

export type InternalParamDoc = {
  name: string;
  type: string;
  isReturnValue: boolean;
  documentation?: string | undefined;
};

export type InternalSignatureDoc = {
  name: string;
  /**
   * Origem/catálogo deste símbolo interno.
   *
   * Importante: em sistemas como HCM/ERP, o registry pode conter assinaturas do catálogo SENIOR + do catálogo do sistema.
   * Este campo permite ao client (hover/signature help) exibir o prefixo correto.
   */
  originSystem: LspSystem;
  /**
   * "function" para funções internas; "internal" para variáveis/constantes internas.
   */
  symbolKind?: 'function' | 'internal';
  documentation?: string | undefined;
  docUrl?: string | undefined;
  docVersion?: string | undefined;
  /**
   * Apenas para symbolKind=function.
   */
  params?: InternalParamDoc[] | undefined;

  isReturnValue: boolean | undefined;
  dataType: string | undefined;
  isConst?: boolean | undefined;
};

export async function compileContext(
  config: ValidationContextConfig,
  contentOverrides?: ContentOverrides,
  options?: { collectStats?: boolean; includeSemantics?: boolean; semanticFilePaths?: string[]; includeSymbols?: boolean }
): Promise<CompileResult>
{
  assertValidContextSystem(config.system);
  const stats: CompileStats | undefined = options?.collectStats
    ? {
      filesDiscovered: 0,
      filesRead: 0,
      filesParsed: 0,
      reusedFiles: 0,
      reparsedFiles: 0,
      reanalyzedFiles: 0,
      reusedSymbols: 0,
      semanticStartIndex: 0,
      semanticFilesReused: 0,
      semanticFilesAnalyzed: 0,
      contextResolveMs: 0,
      textLoadMs: 0,
      incrementalReuseMs: 0,
      parseMs: 0,
      bindMs: 0,
      analyzeMs: 0,
      indexLookupMs: 0,
      semanticMs: 0,
      totalMs: 0
    }
    : undefined;
  const buildStats: BuildContextStats | undefined = stats
    ? { filesDiscovered: 0, filesRead: 0 }
    : undefined;
  const totalStart = stats ? performance.now() : 0;
  const context = contentOverrides || buildStats
    ? await buildContext(config, {
      ...(contentOverrides ? { contentOverrides } : {}),
      ...(buildStats ? { stats: buildStats } : {})
    })
    : await buildContext(config);
  if (stats && buildStats)
  {
    stats.filesDiscovered = buildStats.filesDiscovered;
    stats.filesRead = buildStats.filesRead;
  }
  return compileFromContext(context, config, stats, totalStart, options?.includeSemantics);
}

export async function compileSingleFile(input: {
  filePath: string;
  text: string;
  system: LspSystem;
  includeSemantics?: boolean | undefined;
}): Promise<CompileResult>
{
  const source = createSourceFile(input.filePath, input.text);
  const parsed = parseSingleFile(source, 0);
  const program = buildProgram([parsed.file]);
  const totalStart = performance.now();
  const compileInput: Parameters<typeof compileFromParsed>[0] = {
    contextId: '__singlefile__',
    system: input.system,
    program,
    parseErrors: parsed.errors,
    files: [source],
    stats: undefined,
    totalStart
  };
  if (input.includeSemantics !== undefined) compileInput.includeSemantics = input.includeSemantics;
  return compileFromParsed(compileInput);
}

export { fileBelongsToContext, normalizePathKey, type ValidationContextConfig, type ContentOverrides };
export { getContextSymbols, type SymbolInfo };
export { getCursorMethodNames };
export { hashText } from './utils/hash-text';
export
{
  listListaMethods,
  listListaProperties,
  type ListaMethod,
  type ListaProperty
} from './internals/members/lista-methods';
export { SEMANTIC_TOKEN_TYPES, SEMANTIC_TOKEN_MODIFIERS, type SemanticOccurrence, type SemanticTokenType, type SemanticTokenModifier } from './semantic/semantic-tokens';
export { collectEmbeddedSqlSemanticOccurrences, collectEmbeddedSqlSemanticDebugReport } from './semantic/embedded-sql-occurrences';
export {
  formatDocument,
  formatDocumentWithDetails,
  formatLspText,
  formatLspDocument,
  formatText,
  type EmbeddedSqlAttemptDecision,
  type EmbeddedSqlAttemptReason,
  type EmbeddedSqlDebugEvent,
  type EmbeddedSqlDebugReport,
  type EmbeddedSqlDialect,
  type EmbeddedSqlFormatAttempt,
  type EmbeddedSqlFormatReport,
  type EmbeddedSqlSourceKind,
  type EmbeddedSqlWrapperKind,
  type FormatDocumentReport,
  type FormatOptions
};
export
{
  createPublicCompilerApi,
  type EnsureCompileReason,
  type EnsureCompileOptions,
  type CompilerSnapshot,
  type PublicCompilerApi
} from './public-api';
export
{
  buildSymbolQueryScopeForContext,
  buildSymbolQueryScopeForSingleFile,
  resolveSymbolAtPosition,
  getOccurrences,
  buildRenameEdits,
  prepareRename,
  renameSymbol,
  isValidRenameIdentifier,
  hasRenameCollision,
  isRenameBlockedByToken,
  symbolKindAllowsRename,
  type SymbolQueryScope,
  type SymbolQueryResolvedKind,
  type ResolvedSymbol,
  type SymbolRenameTextEdit,
  type PrepareRenameResult,
  type RenameRejectReason,
  type RenameResult
} from './symbol-query/core';

export async function getInternalSignaturesForSystem(system: LspSystem, name: string): Promise<InternalSignatureDoc[]>
{
  const registry = await loadInternalRegistry(system);

  const docs: InternalSignatureDoc[] = [];

  // Funções internas (para signature help / completion).
  const sigs = getInternalSignatures(registry, name);
  for (const s of sigs)
  {
    docs.push({
      name: s.name,
      originSystem: s.system,
      symbolKind: 'function',
      documentation: s.documentation,
      docUrl: s.docUrl,
      docVersion: s.docVersion,
      dataType: s.dataType,
      isReturnValue: s.isReturnValue,
      params: s.params?.map((p) => ({
        name: p.name,
        type: p.type,
        isReturnValue: p.isReturnValue,
        documentation: p.documentation
      }))
    });
  }

  // Variáveis/constantes internas (para hover/completion).
  const v = getInternalVariable(registry, name);
  if (v)
  {
    docs.push({
      name: v.name,
      originSystem: system,
      symbolKind: 'internal',
      documentation: v.documentation,
      docUrl: v.docUrl,
      docVersion: v.docVersion,
      dataType: v.dataType,
      isReturnValue: undefined,
      isConst: v.isConst
    });
  }

  return docs;
}

export async function getAllInternalSignatures(system: LspSystem): Promise<InternalSignatureDoc[]>
{
  const registry = await loadInternalRegistry(system);
  const seen = new Set<string>();
  const result: InternalSignatureDoc[] = [];

  // Funções internas.
  for (const sigs of registry.functions.values())
  {
    for (const sig of sigs)
    {
      if (seen.has(sig.nameNormalized)) continue;
      seen.add(sig.nameNormalized);
      result.push({
        name: sig.name,
        originSystem: sig.system,
        symbolKind: 'function',
        documentation: sig.documentation,
        docUrl: sig.docUrl,
        docVersion: sig.docVersion,
        dataType: sig.dataType,
        isReturnValue: sig.isReturnValue,
        params: sig.params?.map((p) => ({
          name: p.name,
          type: p.type,
          isReturnValue: p.isReturnValue,
          documentation: p.documentation
        }))
      });
    }
  }

  // Variáveis/constantes internas.
  for (const v of getAllInternalVariables(registry))
  {
    if (seen.has(v.nameNormalized)) continue;
    seen.add(v.nameNormalized);
    result.push({
      name: v.name,
      originSystem: system,
      symbolKind: 'internal',
      documentation: v.documentation,
      docUrl: v.docUrl,
      docVersion: v.docVersion,
      dataType: v.dataType,
      isReturnValue: undefined,
      isConst: v.isConst
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
