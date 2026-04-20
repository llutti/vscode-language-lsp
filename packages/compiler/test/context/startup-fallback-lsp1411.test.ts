import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCompilerSession } from '../../src';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-boot-'));
}

function writeFile(dir: string, name: string, content: string) {
  fs.writeFileSync(path.join(dir, name), content, 'utf8');
}

describe('startup: fallback/single-file compile can emit LSP1411, but full context clears it', () => {
  it('emits LSP1411 when HR858 is compiled without HR850 (aTxtLog not declared yet)', async () => {
    const rootDir = makeTempDir();

    // Global declaration exists, but will NOT be included in the first (incomplete) compile
    writeFile(rootDir, 'HR850.txt', 'Definir Alfa aTxtLog;\n');

    // File opened by VSCode at startup (simulating the user case)
    // We declare dDatIni as Data to avoid other ConverteMascara-related diags.
    writeFile(
      rootDir,
      'HR858.txt',
      [
        'Definir Data dDatIni;',
        // Keep TS-like Alfa strictness: once HR850 is included, aTxtLog is Alfa.
        // So this assignment must be compatible with Alfa to avoid unrelated LSP1006.
        'aTxtLog = "1";',
        'ConverteMascara(3, dDatIni, aTxtLog, "DD/MM/YYYY");',
        ''
      ].join('\n')
    );

    // Other HR files (kept harmless)
    for (const f of ['HR851.txt', 'HR853.txt', 'HR859.txt', 'HR860.txt']) {
      writeFile(rootDir, f, 'nNumEmp = nNumEmp + 1;\n');
    }

    const session = createCompilerSession();

    // 1) Incomplete compile: mimic fallback / "only the opened file"
    const r1 = await session.compile(
      {
        name: 'HR',
        rootDir,
        // IMPORTANT: only HR858 is discovered here, so HR850 won't be loaded yet
        filePattern: 're:^HR858\\.txt$',
        includeSubdirectories: false,
        system: 'HCM'
      },
      undefined,
      { includeSemantics: true }
    );

    // Expect LSP1411 (ConverteMascara: destination must be Alfa)
    expect(r1.diagnostics.some((d) => d.id === 'LSP1411')).toBe(true);

    // 2) Full context compile: mimic "after contexts are ready"
    const r2 = await session.compile(
      {
        name: 'HR',
        rootDir,
        filePattern: 're:^HR.*\\.txt$',
        includeSubdirectories: false,
        system: 'HCM'
      },
      undefined,
      { includeSemantics: true }
    );

    // Once HR850 is included, aTxtLog is Alfa and the diag must disappear
    expect(r2.diagnostics).toHaveLength(0);
  });
});
