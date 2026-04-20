import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCompilerSession } from '../../src';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-sem-'));
}

describe('compiler incremental semantic', () => {
  it('recalcula unused quando uso some em arquivo posterior', async () => {
    const dir = makeTempDir();
    const f0 = path.join(dir, 'A.txt');
    const f1 = path.join(dir, 'B.txt');
    const f2 = path.join(dir, 'C.txt');
    fs.writeFileSync(f0, 'Definir Numero X;');
    fs.writeFileSync(f1, '');
    fs.writeFileSync(f2, 'Definir Numero Y;\nY = X;');

    const session = createCompilerSession();
    const config = {
      name: 'SEM',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    const first = await session.compile(config);
    expect(first.diagnostics.some((d) => d.id === 'LSP1203' && d.message.includes('X'))).toBe(false);

    fs.writeFileSync(f2, '');
    const bump = new Date(Date.now() + 5000);
    fs.utimesSync(f2, bump, bump);

    const second = await session.compile(config);
    expect(second.diagnostics.some((d) => d.id === 'LSP1203' && d.message.includes('X'))).toBe(true);
  });

  it('reutiliza declaracoes quando o arquivo muda apenas no corpo', async () => {
    const dir = makeTempDir();
    const f0 = path.join(dir, 'A.txt');
    const params = Array.from({ length: 16 }, (_, i) => `Numero p${i + 1}`).join(', ');
    fs.writeFileSync(
      f0,
      `Definir Funcao fTeste(${params});\nX = 1;\n`,
      'utf8'
    );

    const session = createCompilerSession();
    const config = {
      name: 'SEM_DECL_REUSE',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    const first = await session.compile(config, undefined, { collectStats: true });
    expect(first.diagnostics.some((d) => d.id === 'LSP1104')).toBe(true);

    fs.writeFileSync(
      f0,
      `Definir Funcao fTeste(${params});\nX = 2;\n`,
      'utf8'
    );
    const bump = new Date(Date.now() + 5000);
    fs.utimesSync(f0, bump, bump);

    const second = await session.compile(config, undefined, { collectStats: true, changedFilePaths: [f0] });
    expect(second.__stats?.filesParsed).toBe(1);
    expect(second.__stats?.semanticFilesAnalyzed).toBe(1);
    expect(second.diagnostics.some((d) => d.id === 'LSP1104')).toBe(true);
  });
});
