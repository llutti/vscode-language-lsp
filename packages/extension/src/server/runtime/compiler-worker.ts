import { parentPort } from 'node:worker_threads';
import { createCompilerSession, type ContentOverrides, type ValidationContextConfig, type CompileResult } from '@lsp/compiler';

type CompileRequest = {
  requestId: number;
  context: ValidationContextConfig;
  overrides: Array<[string, string]>;
  options?: {
    collectStats?: boolean;
    forceRefreshFiles?: boolean;
    prefixUntilFilePath?: string;
    includeSemantics?: boolean;
    includeSemanticPayload?: boolean;
    changedFilePaths?: string[];
    semanticFilePaths?: string[];
    semanticBudgetFiles?: number;
    abortSignal?: AbortSignal;
  };
};

type CompileResultSizeBreakdown = {
  diagnostics: number;
  files: number;
  symbols: number;
  semanticsByFile: number;
  stats: number;
  total: number;
};

type CompileResponse = {
  requestId: number;
  result?: CompileResult;
  /** Approx bytes of result payload (best-effort). Only set when collectStats is enabled. */
  resultBytes?: number;
  resultBytesBreakdown?: CompileResultSizeBreakdown;
  error?: string;
};

const session = createCompilerSession();

function safeByteLength(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value, (_key, current) => {
      if (current instanceof Map) return { __type: 'Map', entries: Array.from(current.entries()) };
      if (current instanceof Set) return { __type: 'Set', values: Array.from(current.values()) };
      return current;
    }), 'utf8');
  } catch {
    return 0;
  }
}

function buildResultSizeBreakdown(result: CompileResult): CompileResultSizeBreakdown {
  const diagnostics = safeByteLength(result.diagnostics);
  const files = safeByteLength(result.files);
  const symbols = safeByteLength(result.symbols ?? []);
  const semanticsByFile = safeByteLength(result.semanticsByFile ?? []);
  const stats = safeByteLength(result.__stats ?? null);
  return {
    diagnostics,
    files,
    symbols,
    semanticsByFile,
    stats,
    total: diagnostics + files + symbols + semanticsByFile + stats
  };
}

async function handleRequest(message: CompileRequest): Promise<void> {
  const overrides: ContentOverrides = new Map(message.overrides ?? []);
  try {
    const rawResult = await session.compile(message.context, overrides, message.options);
    const result = message.options?.includeSemanticPayload === false
      ? { ...rawResult, semanticsByFile: undefined }
      : rawResult;
    const response: CompileResponse = { requestId: message.requestId, result };
    if (message.options?.collectStats) {
      const breakdown = buildResultSizeBreakdown(result);
      response.resultBytes = breakdown.total;
      response.resultBytesBreakdown = breakdown;
    }
    parentPort?.postMessage(response);
  } catch (error) {
    const response: CompileResponse = { requestId: message.requestId, error: String(error) };
    parentPort?.postMessage(response);
  }
}

parentPort?.on('message', (message: CompileRequest) => {
  void handleRequest(message);
});
