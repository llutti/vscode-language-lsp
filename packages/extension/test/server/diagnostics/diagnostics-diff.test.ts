import { describe, it, expect } from 'vitest';
import type { Diagnostic } from 'vscode-languageserver/node';
import { computeDiagnosticsDiff, hashDiagnostics } from '../../../src/server/diagnostics/diagnostics-diff';

function diag(message: string, line = 0, character = 0, severity = 1, code = 'LSP0001'): Diagnostic {
  return {
    message,
    severity,
    code,
    range: {
      start: { line, character },
      end: { line, character: character + 1 }
    }
  };
}

describe('diagnostics diff', () => {
  it('nao publica quando o conteudo nao muda', () => {
    const prevFiles = new Set(['/a.lspt']);
    const prevHashByFile = new Map([['/a.lspt', hashDiagnostics([diag('erro')])]]);
    const nextFiles = new Set(['/a.lspt']);
    const nextByFile = new Map([['/a.lspt', [diag('erro')]]]);

    const diff = computeDiagnosticsDiff({ prevFiles, prevHashByFile, nextFiles, nextByFile });
    expect(diff.toPublish.length).toBe(0);
    expect(diff.toClear.length).toBe(0);
  });

  it('publica apenas o arquivo alterado', () => {
    const prevFiles = new Set(['/a.lspt', '/b.lspt']);
    const prevHashByFile = new Map([
      ['/a.lspt', hashDiagnostics([diag('erro-a')])],
      ['/b.lspt', hashDiagnostics([diag('erro-b')])]
    ]);
    const nextFiles = new Set(['/a.lspt', '/b.lspt']);
    const nextByFile = new Map([
      ['/a.lspt', [diag('erro-a', 1, 0)]],
      ['/b.lspt', [diag('erro-b')]]
    ]);

    const diff = computeDiagnosticsDiff({ prevFiles, prevHashByFile, nextFiles, nextByFile });
    expect(diff.toPublish).toEqual([{ filePath: '/a.lspt', diagnostics: [diag('erro-a', 1, 0)] }]);
    expect(diff.toClear.length).toBe(0);
  });

  it('limpa apenas arquivos removidos do contexto', () => {
    const prevFiles = new Set(['/a.lspt', '/b.lspt']);
    const prevHashByFile = new Map([
      ['/a.lspt', hashDiagnostics([diag('erro-a')])],
      ['/b.lspt', hashDiagnostics([])]
    ]);
    const nextFiles = new Set(['/a.lspt']);
    const nextByFile = new Map([['/a.lspt', [diag('erro-a')]]]);

    const diff = computeDiagnosticsDiff({ prevFiles, prevHashByFile, nextFiles, nextByFile });
    expect(diff.toPublish.length).toBe(0);
    expect(diff.toClear).toEqual(['/b.lspt']);
  });

  it('permite simular envio com mock de sendDiagnostics', () => {
    const prevFiles = new Set(['/a.lspt']);
    const prevHashByFile = new Map([['/a.lspt', hashDiagnostics([diag('erro')])]]);
    const nextFiles = new Set(['/a.lspt']);
    const nextByFile = new Map([['/a.lspt', [diag('erro', 2, 0)]]]);

    const diff = computeDiagnosticsDiff({ prevFiles, prevHashByFile, nextFiles, nextByFile });
    const calls: Array<{ filePath: string; count: number }> = [];

    for (const entry of diff.toPublish) {
      calls.push({ filePath: entry.filePath, count: entry.diagnostics.length });
    }
    for (const cleared of diff.toClear) {
      calls.push({ filePath: cleared, count: 0 });
    }

    expect(calls).toEqual([{ filePath: '/a.lspt', count: 1 }]);
  });
});
