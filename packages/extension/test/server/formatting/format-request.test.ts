import { describe, expect, it } from 'vitest';
import type { CancellationToken } from 'vscode-languageserver/node';
import { runFormatRequest } from '../../../src/server/compile/format-request';

function makeToken(isCancellationRequested: boolean): CancellationToken & { isCancellationRequested: boolean } {
  return {
    isCancellationRequested,
    onCancellationRequested: () => ({ dispose: () => undefined })
  } as unknown as CancellationToken & { isCancellationRequested: boolean };
}

describe('format request', () => {
  it('retorna [] se cancelado antes da execucao', () => {
    const token = makeToken(true);
    const result = runFormatRequest(token, () => [1, 2, 3]);
    expect(result).toEqual({ cancelled: true, phase: 'pre', result: [] });
  });

  it('retorna [] se cancelado apos executar tarefa', () => {
    const token = makeToken(false);
    const result = runFormatRequest(token, () => {
      token.isCancellationRequested = true;
      return [1, 2];
    });
    expect(result).toEqual({ cancelled: true, phase: 'post', result: [] });
  });

  it('retorna resultado quando nao cancelado', () => {
    const token = makeToken(false);
    const result = runFormatRequest(token, () => [1, 2]);
    expect(result).toEqual({ cancelled: false, result: [1, 2] });
  });
});
