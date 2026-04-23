import { describe, it, expect } from 'vitest';
import type { Diagnostic } from 'vscode-languageserver/node';
import { commitDiagnostics } from '../../../src/server/diagnostics/diagnostics-commit';

const diagnosticsByFile = new Map<string, Diagnostic[]>([
  [
    '/tmp/HR858.lspt',
    [
      {
        message: 'erro',
        code: 'LSP1411',
        severity: 1,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 }
        }
      }
    ]
  ]
]);

describe('integration: boot gating for diagnostics', () => {
  it('computes changed files for pull flow', () => {
    const result = commitDiagnostics({
      prevFiles: new Set<string>(),
      prevHashByFile: new Map<string, string>(),
      nextFiles: new Set(['/tmp/HR858.lspt']),
      nextByFile: diagnosticsByFile
    });

    expect(result.changedFiles).toEqual(['/tmp/HR858.lspt']);
    expect(result.clearedFiles).toEqual([]);
  });
});
