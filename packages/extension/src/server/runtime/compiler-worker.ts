import { parentPort } from 'node:worker_threads';
import { createCompilerSession, type ContentOverrides, type CompileResult } from '@lsp/compiler';
import { CompilerExecutionQueue } from '../compile/compiler-execution-queue';
import { isWorkerRequest, serializeWorkerError, type CompileResultSizeBreakdown, type WorkerCompileRequest, type WorkerResponse } from '../compile/worker-protocol';

type CompilerSession = ReturnType<typeof createCompilerSession>;
const serialSession = createCompilerSession();
const serialQueue = new CompilerExecutionQueue<void>();
const parallelSessions = new Map<string, CompilerSession>();
const parallelQueues = new Map<string, CompilerExecutionQueue<void>>();
const requestQueues = new Map<number, CompilerExecutionQueue<void>>();
const parallelEnabled = process.env.LSP_CONTEXT_PARALLELISM === '1';
const MAX_PARALLEL_CONTEXTS = 4;
const cancelledRequestIds = new Set<number>();

function contextKey(message: WorkerCompileRequest): string {
  return `${message.context.rootDir}\u0000${message.context.name}\u0000${message.context.system}`;
}

function getExecutionLane(message: WorkerCompileRequest): { session: CompilerSession; queue: CompilerExecutionQueue<void> } {
  if (!parallelEnabled) return { session: serialSession, queue: serialQueue };
  const key = contextKey(message);
  let session = parallelSessions.get(key);
  let queue = parallelQueues.get(key);
  if (!session && parallelSessions.size >= MAX_PARALLEL_CONTEXTS) return { session: serialSession, queue: serialQueue };
  if (!session) {
    session = createCompilerSession();
    queue = new CompilerExecutionQueue<void>();
    parallelSessions.set(key, session);
    parallelQueues.set(key, queue);
  }
  return { session, queue: queue! };
}

function safeByteLength(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value, (_key, current) => {
      if (current instanceof Map) return { __type: 'Map', entries: Array.from(current.entries()) };
      if (current instanceof Set) return { __type: 'Set', values: Array.from(current.values()) };
      return current;
    }), 'utf8');
  } catch { return 0; }
}

function buildResultSizeBreakdown(result: CompileResult): CompileResultSizeBreakdown {
  const diagnostics = safeByteLength(result.diagnostics);
  const files = safeByteLength(result.files);
  const symbols = safeByteLength(result.symbols ?? []);
  const semanticsByFile = safeByteLength(result.semanticsByFile ?? []);
  const stats = safeByteLength(result.__stats ?? null);
  return { diagnostics, files, symbols, semanticsByFile, stats, total: diagnostics + files + symbols + semanticsByFile + stats };
}

async function handleCompile(message: WorkerCompileRequest, session: CompilerSession): Promise<void> {
  if (cancelledRequestIds.delete(message.requestId)) {
    parentPort?.postMessage({ kind: 'cancelled', protocolVersion: 1, requestId: message.requestId, status: 'cancelled' } satisfies WorkerResponse);
    requestQueues.delete(message.requestId);
    return;
  }
  const overrides: ContentOverrides = new Map(message.overrides);
  try {
    const rawResult = await session.compile(message.context, overrides, message.options);
    if (cancelledRequestIds.delete(message.requestId)) {
      parentPort?.postMessage({ kind: 'cancelled', protocolVersion: 1, requestId: message.requestId, status: 'cancelled' } satisfies WorkerResponse);
      requestQueues.delete(message.requestId);
      return;
    }
    const result = message.options?.includeSemanticPayload === false ? { ...rawResult, semanticsByFile: undefined } : rawResult;
    const response: WorkerResponse = {
      kind: 'compileResult', protocolVersion: 1, requestId: message.requestId,
      workerGeneration: message.workerGeneration,
      contextGeneration: message.contextGeneration,
      documentVersion: message.documentVersion,
      status: 'ok', result
    };
    if (message.options?.collectStats && response.kind === 'compileResult') {
      const breakdown = buildResultSizeBreakdown(result);
      response.resultBytes = breakdown.total;
      response.resultBytesBreakdown = breakdown;
    }
    parentPort?.postMessage(response);
    requestQueues.delete(message.requestId);
  } catch (error) {
    parentPort?.postMessage({
      kind: 'compileResult',
      protocolVersion: 1,
      requestId: message.requestId,
      workerGeneration: message.workerGeneration,
      contextGeneration: message.contextGeneration,
      documentVersion: message.documentVersion,
      status: 'failed',
      error: serializeWorkerError(error, 'COMPILATION_FAILED', process.env.LSP_DEBUG === '1')
    } satisfies WorkerResponse);
    requestQueues.delete(message.requestId);
  }
}

parentPort?.on('message', (message: unknown) => {
  if (!isWorkerRequest(message)) {
    parentPort?.postMessage({ kind: 'compileResult', protocolVersion: 1, requestId: 0, status: 'rejected', error: serializeWorkerError('Mensagem de Worker inválida', 'INVALID_MESSAGE') } satisfies WorkerResponse);
    return;
  }
  if (message.kind === 'ping') {
    parentPort?.postMessage({ kind: 'pong', protocolVersion: 1, nonce: message.nonce } satisfies WorkerResponse);
    return;
  }
  if (message.kind === 'cancel') {
    cancelledRequestIds.add(message.requestId);
    const queue = requestQueues.get(message.requestId);
    if (queue?.cancel(message.requestId)) {
      cancelledRequestIds.delete(message.requestId);
      parentPort?.postMessage({ kind: 'cancelled', protocolVersion: 1, requestId: message.requestId, status: 'cancelled' } satisfies WorkerResponse);
    }
    // Active requests finish at the next safe compiler boundary.
    return;
  }
  const lane = getExecutionLane(message);
  requestQueues.set(message.requestId, lane.queue);
  lane.queue.enqueue({ id: message.requestId, run: () => handleCompile(message, lane.session) });
});
