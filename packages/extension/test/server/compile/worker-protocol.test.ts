import { describe, expect, it } from 'vitest';
import { isWorkerRequest, isWorkerResponse, serializeWorkerError, WORKER_PROTOCOL_VERSION } from '../../../src/server/compile/worker-protocol';

describe('worker protocol', () => {
  const context = { name: 'ctx', rootDir: 'C:/workspace', filePattern: '*.lsp', includeSubdirectories: true, system: 'HCM' };

  it('aceita uma requisição de compilação válida', () => {
    expect(isWorkerRequest({ kind: 'compile', protocolVersion: WORKER_PROTOCOL_VERSION, requestId: 1, workerGeneration: 2, context, overrides: [['a', 'b']], options: { collectStats: true } })).toBe(true);
  });

  it('rejeita payloads incompletos ou com tipos inválidos', () => {
    expect(isWorkerRequest({ kind: 'compile', protocolVersion: WORKER_PROTOCOL_VERSION, requestId: 1, context, overrides: [['a']] })).toBe(false);
    expect(isWorkerRequest({ kind: 'compile', protocolVersion: 99, requestId: 1, context, overrides: [] })).toBe(false);
    expect(isWorkerRequest({ kind: 'cancel', protocolVersion: WORKER_PROTOCOL_VERSION, requestId: 0 })).toBe(false);
  });

  it('serializa Error e valores não-Error', () => {
    const error = serializeWorkerError(new Error('boom'));
    expect(error.message).toBe('boom');
    expect(error.stack).toBeUndefined();
    expect(serializeWorkerError(new Error('boom'), 'COMPILATION_FAILED', true).stack).toContain('Error: boom');
    expect(serializeWorkerError('boom', 'INVALID_MESSAGE')).toMatchObject({ code: 'INVALID_MESSAGE', message: 'boom', retryable: false });
  });

  it('valida respostas de compilação e rejeita respostas incompletas', () => {
    expect(isWorkerResponse({ kind: 'compileResult', protocolVersion: WORKER_PROTOCOL_VERSION, requestId: 1, result: {} })).toBe(true);
    expect(isWorkerResponse({ kind: 'compileResult', protocolVersion: WORKER_PROTOCOL_VERSION, requestId: 1, error: { code: 'COMPILATION_FAILED', message: 'x', retryable: false } })).toBe(true);
    expect(isWorkerResponse({ kind: 'compileResult', protocolVersion: WORKER_PROTOCOL_VERSION, requestId: 1, error: 'x' })).toBe(false);
  });
});
