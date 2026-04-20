import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCompilerSession, type Diagnostic } from '../../src';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-det-'));
}

function writeFile(dir: string, name: string, content: string) {
  fs.writeFileSync(path.join(dir, name), content, 'utf8');
}

function stableDiagnostics(diagnostics: Diagnostic[]): Array<{
  id: string;
  severity: string;
  message: string;
  sourcePath: string;
  range: string;
}> {
  return diagnostics
    .map((diag) => ({
      id: diag.id,
      severity: diag.severity,
      message: diag.message,
      sourcePath: path.basename(diag.sourcePath),
      range: `${diag.range.start.line}:${diag.range.start.character}-${diag.range.end.line}:${diag.range.end.character}`
    }))
    .sort((a, b) => {
      if (a.sourcePath !== b.sourcePath) return a.sourcePath.localeCompare(b.sourcePath);
      if (a.range !== b.range) return a.range.localeCompare(b.range);
      if (a.id !== b.id) return a.id.localeCompare(b.id);
      if (a.severity !== b.severity) return a.severity.localeCompare(b.severity);
      return a.message.localeCompare(b.message);
    });
}

function snapshotResult(result: { files: string[]; diagnostics: Diagnostic[] }) {
  return {
    files: result.files.map((f) => path.basename(f)).sort((a, b) => a.localeCompare(b)),
    diagnostics: stableDiagnostics(result.diagnostics)
  };
}

describe('determinismo do compiler (mesmo input => mesmo output)', () => {
  it('compila o mesmo contexto N vezes e produz resultado identico', async () => {
    const rootDir = makeTempDir();

    writeFile(
      rootDir,
      'A.txt',
      [
        'nNum = 1;',
        ''
      ].join('\n')
    );

    writeFile(
      rootDir,
      'B.txt',
      [
        'Definir Alfa aTxt;',
        ''
      ].join('\n')
    );

    const session = createCompilerSession();
    const config = {
      name: 'DET',
      rootDir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    const first = await session.compile(config, undefined, { includeSemantics: true });
    const baseline = snapshotResult(first);

    const runs = 20;
    for (let i = 1; i < runs; i += 1) {
      const result = await session.compile(config, undefined, { includeSemantics: true });
      expect(snapshotResult(result)).toEqual(baseline);
    }
  });
});
