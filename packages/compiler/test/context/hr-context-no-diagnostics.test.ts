import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCompilerSession, type ContentOverrides } from '../../src';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-hr-'));
}

function writeFile(dir: string, name: string, content: string) {
  fs.writeFileSync(path.join(dir, name), content, 'utf8');
}

function basenames(files: string[]) {
  return files.map((p) => path.basename(p));
}

describe('HR context scenario - zero diagnostics', () => {
  it('disk-only: no diagnostics at all', async () => {
    const rootDir = makeTempDir();

    // HR850.txt (exigido)
    writeFile(rootDir, 'HR850.txt', 'Definir Alfa aTxtLog;\n');

    // HR858.txt (exigido)
    writeFile(
      rootDir,
      'HR858.txt',
      ['nNumCad = 1234567;', 'IntParaAlfa(nNumCad, aTxtLog);', ''].join('\n')
    );

    // Demais arquivos (ajustado conforme sua decisão)
    // OBS: isso garante leitura+escrita e tende a evitar VariableUnused
    const others = ['HR851.txt', 'HR853.txt', 'HR859.txt', 'HR860.txt'];
    for (const f of others) {
      writeFile(rootDir, f, 'nNumEmp = nNumEmp + 1;\n');
    }

    const session = createCompilerSession();

    const result = await session.compile(
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

    expect(basenames(result.files)).toEqual([
      'HR850.txt',
      'HR851.txt',
      'HR853.txt',
      'HR858.txt',
      'HR859.txt',
      'HR860.txt'
    ]);

    // Validação principal
    expect(result.diagnostics).toHaveLength(0);
  });

  it('with content override: HR858 from memory (override) and still yields zero diagnostics', async () => {
    const rootDir = makeTempDir();

    // HR850.txt (exigido)
    writeFile(rootDir, 'HR850.txt', 'Definir Alfa aTxtLog;\n');

    // HR858.txt existe no disco, mas o conteúdo real virá do override (simulando editor)
    writeFile(rootDir, 'HR858.txt', '// disk content ignored by override\n');

    // Demais arquivos (mesmo cenário)
    const others = ['HR851.txt', 'HR853.txt', 'HR859.txt', 'HR860.txt'];
    for (const f of others) {
      writeFile(rootDir, f, 'nNumEmp = nNumEmp + 1;\n');
    }

    // Override do HR858.txt (conteúdo em memória)
    const hr858Abs = path.join(rootDir, 'HR858.txt');

    // IMPORTANTE: o compiler busca override por casefold(path.resolve(filePath))
    const overrideKey = path.resolve(hr858Abs).toLocaleLowerCase('en-US');

    const hr858OverrideContent = [
      'nNumCad = 1234567;',
      'ConverteMascara(1, nNumCad, aTxtLog, "9[9]");',
      ''
    ].join('\n');

    const overrides: ContentOverrides = new Map([
      [overrideKey, hr858OverrideContent]
    ]);

    const session = createCompilerSession();

    const result = await session.compile(
      {
        name: 'HR',
        rootDir,
        filePattern: 're:^HR.*\\.txt$',
        includeSubdirectories: false,
        system: 'HCM'
      },
      overrides,
      { includeSemantics: true }
    );

    expect(basenames(result.files)).toEqual([
      'HR850.txt',
      'HR851.txt',
      'HR853.txt',
      'HR858.txt',
      'HR859.txt',
      'HR860.txt'
    ]);

    // Validação principal
    expect(result.diagnostics).toHaveLength(0);
  });
});
