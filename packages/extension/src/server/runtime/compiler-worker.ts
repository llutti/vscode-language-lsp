import { parentPort } from 'node:worker_threads';
import { createCompilerSession, type ContentOverrides, type CompileResult } from '@lsp/compiler';
import { CompilerExecutionQueue } from '../compile/compiler-execution-queue';
import { isWorkerRequest, serializeWorkerError, type CompileResultSizeBreakdown, type WorkerCompileRequest, type WorkerResponse } from '../compile/worker-protocol';

const session = createCompilerSession();
const executionQueue = new CompilerExecutionQueue<void>();
const cancelledRequestIds = new Set<number>();

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

async function handleCompile(message: WorkerCompileRequest): Promise<void> {
  if (cancelledRequestIds.delete(message.requestId)) {
    parentPort?.postMessage({ kind: 'cancelled', protocolVersion: 1, requestId: message.requestId, status: 'cancelled' } satisfies WorkerResponse);
    return;
  }
  const overrides: ContentOverrides = new Map(message.overrides);
  try {
    const rawResult = await session.compile(message.context, overrides, message.options);
    if (cancelledRequestIds.delete(message.requestId)) {
      parentPort?.postMessage({ kind: 'cancelled', protocolVersion: 1, requestId: message.requestId, status: 'cancelled' } satisfies WorkerResponse);
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
    if (executionQueue.cancel(message.requestId)) {
      cancelledRequestIds.delete(message.requestId);
      parentPort?.postMessage({ kind: 'cancelled', protocolVersion: 1, requestId: message.requestId, status: 'cancelled' } satisfies WorkerResponse);
    }
    // Active requests finish at the next safe compiler boundary.
    return;
  }
  executionQueue.enqueue({ id: message.requestId, run: () => handleCompile(message) });
});
