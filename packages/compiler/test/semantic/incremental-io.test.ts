import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCompilerSession } from '../../src';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-inc-'));
}

describe('compiler incremental io', () => {
  it('reusa cache e le apenas arquivos alterados', async () => {
    const dir = makeTempDir();
    const a = path.join(dir, 'A.txt');
    const b = path.join(dir, 'B.txt');
    const c = path.join(dir, 'C.txt');
    fs.writeFileSync(a, 'a1');
    fs.writeFileSync(b, 'b1');
    fs.writeFileSync(c, 'c1');

    const session = createCompilerSession();
    const config = {
      name: 'INC',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    await session.compile(config);

    const second = await session.compile(config, undefined, { collectStats: true });
    expect(second.__stats?.filesRead ?? 0).toBe(0);

    fs.writeFileSync(b, 'b2-updated');
    const bump = new Date(Date.now() + 5000);
    fs.utimesSync(b, bump, bump);

    const third = await session.compile(config, undefined, { collectStats: true });
    expect(third.__stats?.filesRead ?? 0).toBe(1);
  });

  it('nao invalida parse e semantica quando apenas mtime muda e o conteudo continua igual', async () => {
    const dir = makeTempDir();
    const a = path.join(dir, 'A.txt');
    fs.writeFileSync(a, 'Definir Numero n;\nn = 1;\n', 'utf8');

    const session = createCompilerSession();
    const config = {
      name: 'INC_MTIME_ONLY',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    await session.compile(config, undefined, { collectStats: true, includeSemantics: true });

    const original = fs.readFileSync(a, 'utf8');
    fs.writeFileSync(a, original, 'utf8');
    const bump = new Date(Date.now() + 5000);
    fs.utimesSync(a, bump, bump);

    const second = await session.compile(config, undefined, { collectStats: true, includeSemantics: true });

    expect(second.__stats?.filesRead ?? 0).toBe(1);
    expect(second.__stats?.reparsedFiles ?? 0).toBe(0);
    expect(second.__stats?.reanalyzedFiles ?? 0).toBe(0);
  });
});
