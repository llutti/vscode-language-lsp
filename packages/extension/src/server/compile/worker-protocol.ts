import type { CompileResult, ContentOverrides, ValidationContextConfig } from '@lsp/compiler';

export const WORKER_PROTOCOL_VERSION = 1 as const;

export type WorkerCompileOptions = {
  collectStats?: boolean;
  forceRefreshFiles?: boolean;
  prefixUntilFilePath?: string;
  changedFilePaths?: string[];
  semanticFilePaths?: string[];
  includeSemantics?: boolean;
  includeSemanticPayload?: boolean;
  semanticBudgetFiles?: number;
};

export type WorkerCompileRequest = {
  kind: 'compile';
  protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  requestId: number;
  workerGeneration?: number;
  context: ValidationContextConfig;
  overrides: Array<[string, string]>;
  options?: WorkerCompileOptions;
};

export type WorkerCancelRequest = {
  kind: 'cancel';
  protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  requestId: number;
};

export type WorkerPingRequest = {
  kind: 'ping';
  protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  nonce: string;
};

export type WorkerRequest = WorkerCompileRequest | WorkerCancelRequest | WorkerPingRequest;

export type CompileResultSizeBreakdown = {
  diagnostics: number;
  files: number;
  symbols: number;
  semanticsByFile: number;
  stats: number;
  total: number;
};

export type WorkerErrorCode =
  | 'INVALID_MESSAGE'
  | 'UNSUPPORTED_PROTOCOL'
  | 'COMPILATION_FAILED'
  | 'CANCELLED'
  | 'SUPERSEDED'
  | 'WORKER_CRASHED';

export type WorkerError = {
  code: WorkerErrorCode;
  message: string;
  name?: string;
  stack?: string;
  retryable: boolean;
};

export type WorkerCompileResponse = {
  kind: 'compileResult';
  protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  requestId: number;
  workerGeneration?: number;
  result?: CompileResult;
  resultBytes?: number;
  resultBytesBreakdown?: CompileResultSizeBreakdown;
  error?: WorkerError;
};

export type WorkerCancelResponse = {
  kind: 'cancelled';
  protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  requestId: number;
};

export type WorkerPongResponse = {
  kind: 'pong';
  protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  nonce: string;
};

export type WorkerResponse = WorkerCompileResponse | WorkerCancelResponse | WorkerPongResponse;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isOptions(value: unknown): value is WorkerCompileOptions {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  const booleans = ['collectStats', 'forceRefreshFiles', 'includeSemantics', 'includeSemanticPayload'];
  if (booleans.some((key) => value[key] !== undefined && typeof value[key] !== 'boolean')) return false;
  const strings = ['prefixUntilFilePath'];
  if (strings.some((key) => value[key] !== undefined && typeof value[key] !== 'string')) return false;
  for (const key of ['changedFilePaths', 'semanticFilePaths']) {
    if (value[key] !== undefined && !isStringArray(value[key])) return false;
  }
  return value.semanticBudgetFiles === undefined
    || (typeof value.semanticBudgetFiles === 'number' && Number.isInteger(value.semanticBudgetFiles) && value.semanticBudgetFiles >= 0);
}

function isContext(value: unknown): value is ValidationContextConfig {
  if (!isRecord(value)) return false;
  return typeof value.name === 'string'
    && typeof value.rootDir === 'string'
    && typeof value.filePattern === 'string'
    && typeof value.includeSubdirectories === 'boolean'
    && typeof value.system === 'string';
}

export function isWorkerRequest(value: unknown): value is WorkerRequest {
  if (!isRecord(value) || value.protocolVersion !== WORKER_PROTOCOL_VERSION || typeof value.kind !== 'string') return false;
  if (value.kind === 'compile') {
    const requestId = value.requestId;
    return Number.isSafeInteger(requestId)
      && (requestId as number) > 0
      && (value.workerGeneration === undefined || (typeof value.workerGeneration === 'number' && Number.isSafeInteger(value.workerGeneration)))
      && isContext(value.context)
      && Array.isArray(value.overrides)
      && value.overrides.every((entry) => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' && typeof entry[1] === 'string')
      && isOptions(value.options);
  }
  if (value.kind === 'cancel') return Number.isSafeInteger(value.requestId) && (value.requestId as number) > 0;
  return value.kind === 'ping' && typeof value.nonce === 'string' && value.nonce.length > 0;
}

export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (!isRecord(value) || value.protocolVersion !== WORKER_PROTOCOL_VERSION || typeof value.kind !== 'string') return false;
  if (value.kind === 'pong') return typeof value.nonce === 'string';
  if (!Number.isSafeInteger(value.requestId) || (value.requestId as number) < 0) return false;
  if (value.kind === 'cancelled') return true;
  if (value.kind !== 'compileResult') return false;
  if (value.error !== undefined) {
    if (!isRecord(value.error) || typeof value.error.code !== 'string' || typeof value.error.message !== 'string' || typeof value.error.retryable !== 'boolean') return false;
  }
  return value.result === undefined || isRecord(value.result);
}

export function serializeWorkerError(error: unknown, code: WorkerErrorCode = 'COMPILATION_FAILED', includeStack = false): WorkerError {
  const isError = error instanceof Error;
  return {
    code,
    message: isError ? error.message : String(error),
    name: isError ? error.name : undefined,
    stack: includeStack && isError ? error.stack : undefined,
    retryable: code === 'WORKER_CRASHED'
  };
}

export function makeCompileRequest(input: Omit<WorkerCompileRequest, 'kind' | 'protocolVersion'>): WorkerCompileRequest {
  return { kind: 'compile', protocolVersion: WORKER_PROTOCOL_VERSION, ...input };
}

export type WorkerCompileInput = {
  context: ValidationContextConfig;
  overrides: ContentOverrides;
  options?: WorkerCompileOptions;
};
