import { createCompilerSession, type CompileStats, type Diagnostic, type SymbolInfo } from './index';
import { normalizePathKey, type ValidationContextConfig, type ContentOverrides } from './context/context-manager';
import type { SemanticOccurrence } from './semantic/semantic-tokens';

export type EnsureCompileReason =
  | 'diagnostics'
  | 'hover'
  | 'completions'
  | 'semantics'
  | 'references'
  | 'rename'
  | 'format';

export type EnsureCompileOptions = {
  reason: EnsureCompileReason;
  changedFilePaths?: string[];
  forceRefreshFiles?: boolean;
  prefixUntilTarget?: boolean;
  includeSemantics?: boolean;
  includeSymbols?: boolean;
  semanticBudgetFiles?: number;
  collectStats?: boolean;
  semanticFilePaths?: string[];
};

export type CompilerSnapshot = {
  contextId: string;
  files: string[];
  diagnostics: Diagnostic[];
  semanticsByFile?: Map<string, SemanticOccurrence[]>;
  symbols?: SymbolInfo[];
  stats?: CompileStats;
};

export type PublicCompilerApi = {
  ensureCompiledForFile: (
    config: ValidationContextConfig,
    filePath: string,
    contentOverrides?: ContentOverrides,
    options?: EnsureCompileOptions
  ) => Promise<CompilerSnapshot>;
  resetContext: (config: ValidationContextConfig) => void;
  getDiagnosticsForFile: (snapshot: CompilerSnapshot, filePath: string) => Diagnostic[];
  getSemanticsForFile: (snapshot: CompilerSnapshot, filePath: string) => SemanticOccurrence[] | undefined;
};

export function createPublicCompilerApi(): PublicCompilerApi {
  const session = createCompilerSession();

  async function ensureCompiledForFile(
    config: ValidationContextConfig,
    filePath: string,
    contentOverrides?: ContentOverrides,
    options?: EnsureCompileOptions
  ): Promise<CompilerSnapshot> {
    const compileOptions: Parameters<typeof session.compile>[2] = {};
    if (options?.includeSemantics === true) compileOptions.includeSemantics = true;
    if (options?.collectStats !== undefined) compileOptions.collectStats = options.collectStats;
    if (options?.forceRefreshFiles !== undefined) compileOptions.forceRefreshFiles = options.forceRefreshFiles;
    if (options?.changedFilePaths !== undefined) compileOptions.changedFilePaths = options.changedFilePaths;
    if (options?.semanticBudgetFiles !== undefined) compileOptions.semanticBudgetFiles = options.semanticBudgetFiles;
    if (options?.semanticFilePaths !== undefined) compileOptions.semanticFilePaths = options.semanticFilePaths;
    if (options?.includeSymbols !== undefined) compileOptions.includeSymbols = options.includeSymbols;
    if (options?.prefixUntilTarget !== false) compileOptions.prefixUntilFilePath = filePath;
    const result = await session.compile(config, contentOverrides, compileOptions);

    const snapshot: CompilerSnapshot = {
      contextId: result.contextId,
      files: result.files,
      diagnostics: result.diagnostics
    };
    if (options?.includeSemantics === true && result.semanticsByFile) snapshot.semanticsByFile = result.semanticsByFile;
    if (result.symbols) snapshot.symbols = result.symbols;
    if (result.__stats) snapshot.stats = result.__stats;
    return snapshot;
  }

  function resetContext(config: ValidationContextConfig): void {
    session.resetContext(config);
  }

  function getDiagnosticsForFile(snapshot: CompilerSnapshot, filePath: string): Diagnostic[] {
    const key = normalizePathKey(filePath);
    return snapshot.diagnostics.filter((diag) => normalizePathKey(diag.sourcePath) === key);
  }

  function getSemanticsForFile(snapshot: CompilerSnapshot, filePath: string): SemanticOccurrence[] | undefined {
    const entries = snapshot.semanticsByFile;
    if (!entries) return undefined;
    const direct = entries.get(filePath);
    if (direct) return direct;
    const key = normalizePathKey(filePath);
    for (const [entryPath, occurrences] of entries.entries()) {
      if (normalizePathKey(entryPath) === key) return occurrences;
    }
    return undefined;
  }

  return {
    ensureCompiledForFile,
    resetContext,
    getDiagnosticsForFile,
    getSemanticsForFile
  };
}
