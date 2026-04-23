import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Diagnostic as LspDiagnostic } from 'vscode-languageserver/node';
import { createCompilerSession, type Diagnostic as CompilerDiagnostic } from '@lsp/compiler';
import { computeDiagnosticsDiff, hashDiagnostics } from '../../../src/server/diagnostics/diagnostics-diff';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-diag-stable-'));
}

function writeFile(dir: string, name: string, content: string) {
  fs.writeFileSync(path.join(dir, name), content, 'utf8');
}

function toLspDiagnostic(diag: CompilerDiagnostic): LspDiagnostic {
  const severity = diag.severity === 'Error' ? 1 : diag.severity === 'Warning' ? 2 : 3;
  return {
    code: diag.id,
    message: diag.message,
    severity,
    range: diag.range
  };
}

function groupFromCompiler(diagnostics: CompilerDiagnostic[], files: string[]): Map<string, LspDiagnostic[]> {
  const byFile = new Map<string, LspDiagnostic[]>();
  for (const file of files) {
    byFile.set(file, []);
  }
  for (const diag of diagnostics) {
    const list = byFile.get(diag.sourcePath) ?? [];
    list.push(toLspDiagnostic(diag));
    byFile.set(diag.sourcePath, list);
  }
  return byFile;
}

describe('integration: diagnostics stability across cycles', () => {
  it('produces identical commits across N cycles (no ghosts)', async () => {
    const rootDir = makeTempDir();

    writeFile(rootDir, 'A.txt', '/* comentario aberto\n');
    writeFile(rootDir, 'B.txt', 'nValor = 1;\n');

    const session = createCompilerSession();
    const config = {
      name: 'STABLE',
      rootDir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    let prevFiles = new Set<string>();
    let prevHashByFile = new Map<string, string>();
    const runs = 20;

    let baselineHashes: Map<string, string> | null = null;

    for (let i = 0; i < runs; i += 1) {
      const result = await session.compile(config, undefined, { includeSemantics: true });
      const nextFiles = new Set(result.files);
      const nextByFile = groupFromCompiler(result.diagnostics, result.files);

      const diff = computeDiagnosticsDiff({
        prevFiles,
        prevHashByFile,
        nextFiles,
        nextByFile
      });

      if (i === 0) {
        expect(diff.toPublish.length).toBeGreaterThan(0);
      } else {
        expect(diff.toPublish.length).toBe(0);
        expect(diff.toClear.length).toBe(0);
      }

      const nextHashByFile = new Map<string, string>();
      for (const filePath of nextFiles) {
        const list = nextByFile.get(filePath) ?? [];
        nextHashByFile.set(filePath, hashDiagnostics(list));
      }

      if (!baselineHashes) {
        baselineHashes = nextHashByFile;
      } else {
        expect(nextHashByFile).toEqual(baselineHashes);
      }

      prevFiles = nextFiles;
      prevHashByFile = nextHashByFile;
    }
  });
});
