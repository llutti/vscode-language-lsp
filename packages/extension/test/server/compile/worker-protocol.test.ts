import { describe, expect, it } from 'vitest';
import { isWorkerRequest, serializeWorkerError, WORKER_PROTOCOL_VERSION } from '../../../src/server/compile/worker-protocol';

describe('worker protocol', () => {
  const context = { name: 'ctx', rootDir: 'C:/workspace', filePattern: '*.lsp', includeSubdirectories: true, system: 'HCM' };

  it('aceita uma requisição de compilação válida', () => {
    expect(isWorkerRequest({ kind: 'compile', protocolVersion: WORKER_PROTOCOL_VERSION, requestId: 1, context, overrides: [['a', 'b']], options: { collectStats: true } })).toBe(true);
  });

  it('rejeita payloads incompletos ou com tipos inválidos', () => {
    expect(isWorkerRequest({ kind: 'compile', protocolVersion: WORKER_PROTOCOL_VERSION, requestId: 1, context, overrides: [['a']] })).toBe(false);
    expect(isWorkerRequest({ kind: 'compile', protocolVersion: 99, requestId: 1, context, overrides: [] })).toBe(false);
    expect(isWorkerRequest({ kind: 'cancel', protocolVersion: WORKER_PROTOCOL_VERSION, requestId: 0 })).toBe(false);
  });

  it('serializa Error e valores não-Error', () => {
    expect(serializeWorkerError(new Error('boom')).message).toBe('boom');
    expect(serializeWorkerError('boom', 'INVALID_MESSAGE')).toMatchObject({ code: 'INVALID_MESSAGE', message: 'boom', retryable: false });
  });
});
