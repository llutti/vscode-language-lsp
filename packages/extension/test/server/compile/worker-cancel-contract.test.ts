import { describe, expect, it } from 'vitest';
import { isWorkerRequest, WORKER_PROTOCOL_VERSION } from '../../../src/server/compile/worker-protocol';

describe('worker cancellation contract', () => {
  it('representa cancelamento como uma mensagem serializável', () => {
    expect(isWorkerRequest({ kind: 'cancel', protocolVersion: WORKER_PROTOCOL_VERSION, requestId: 42 })).toBe(true);
  });
});
