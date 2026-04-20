import type { CancellationToken } from 'vscode-languageserver/node';

export type FormatRequestOutcome<T> =
  | { cancelled: false; result: T }
  | { cancelled: true; phase: 'pre' | 'post'; result: [] };

export function runFormatRequest<T>(token: CancellationToken, task: () => T): FormatRequestOutcome<T> {
  if (token.isCancellationRequested) return { cancelled: true, phase: 'pre', result: [] };
  const result = task();
  if (token.isCancellationRequested) return { cancelled: true, phase: 'post', result: [] };
  return { cancelled: false, result };
}
