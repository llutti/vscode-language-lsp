import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCompilerSession } from '../../src';
import { loadFixture } from '../fixture-loader';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-bugzoo-'));
}

function writeFile(dir: string, name: string, content: string) {
  fs.writeFileSync(path.join(dir, name), content, 'utf8');
}

describe('bug zoo (cenarios conhecidos)', () => {
  it('boot incompleto pode emitir LSP1411; contexto completo limpa', async () => {
    const rootDir = makeTempDir();

    writeFile(rootDir, 'HR850.txt', 'Definir Alfa aTxtLog;\n');
    writeFile(
      rootDir,
      'HR858.txt',
      [
        'Definir Data dDatIni;',
        // Once HR850 is included, aTxtLog is Alfa. Keep this assignment compatible
        // with Alfa to avoid unrelated LSP1006 and keep the focus on LSP1411.
        'aTxtLog = "1";',
        'ConverteMascara(3, dDatIni, aTxtLog, "DD/MM/YYYY");',
        ''
      ].join('\n')
    );

    const session = createCompilerSession();

    const fallback = await session.compile(
      {
        name: 'HR',
        rootDir,
        filePattern: 're:^HR858\\.txt$',
        includeSubdirectories: false,
        system: 'HCM'
      },
      undefined,
      { includeSemantics: true }
    );

    expect(fallback.diagnostics.some((d) => d.id === 'LSP1411')).toBe(true);

    const full = await session.compile(
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

    expect(full.diagnostics).toHaveLength(0);
  });

  it('Numero implicito seguido de declaracao Alfa gera LSP1002', async () => {
    const rootDir = makeTempDir();

    const fixture = loadFixture('implicit-conflict.lsp');
    writeFile(rootDir, 'A.txt', fixture);

    const session = createCompilerSession();
    const result = await session.compile(
      {
        name: 'BUG2',
        rootDir,
        filePattern: '*.txt',
        includeSubdirectories: false,
        system: 'HCM'
      },
      undefined,
      { includeSemantics: true }
    );

    expect(result.diagnostics.some((d) => d.id === 'LSP1002' && d.severity === 'Error')).toBe(true);
  });

  it('comentario de bloco nao fechado gera LSP0003', async () => {
    const rootDir = makeTempDir();

    writeFile(rootDir, 'A.txt', '/* comentario aberto\n');

    const session = createCompilerSession();
    const result = await session.compile(
      {
        name: 'BUG3',
        rootDir,
        filePattern: '*.txt',
        includeSubdirectories: false,
        system: 'HCM'
      },
      undefined,
      { includeSemantics: true }
    );

    expect(result.diagnostics.some((d) => d.id === 'LSP0003' && d.severity === 'Error')).toBe(true);
  });
});
