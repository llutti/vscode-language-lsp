import { describe, it, expect } from 'vitest';
import type { Diagnostic } from 'vscode-languageserver/node';
import { commitDiagnostics } from '../../../src/server/diagnostics/diagnostics-commit';

function diag(message: string, code: string): Diagnostic {
  return {
    message,
    code,
    severity: 1,
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 1 }
    }
  };
}

describe('integration: diagnostics publish by file', () => {
  it('reports changed and cleared files for pull diagnostics cache updates', () => {
    const result = commitDiagnostics({
      prevFiles: new Set(['/tmp/A.lspt', '/tmp/B.lspt']),
      prevHashByFile: new Map([
        ['/tmp/A.lspt', 'old-a'],
        ['/tmp/B.lspt', 'old-b']
      ]),
      nextFiles: new Set(['/tmp/A.lspt']),
      nextByFile: new Map([['/tmp/A.lspt', [diag('erro-a', 'LSP1001')]]])
    });

    expect(result.changedFiles).toEqual(['/tmp/A.lspt']);
    expect(result.clearedFiles).toEqual(['/tmp/B.lspt']);
  });
});
