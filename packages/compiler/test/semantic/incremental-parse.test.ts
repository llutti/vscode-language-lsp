import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCompilerSession } from '../../src';
import * as parser from '../../src/parser/parser';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-parse-'));
}

describe('compiler incremental parse', () => {
  it('reusa parse e reparsa apenas arquivo alterado', async () => {
    const dir = makeTempDir();
    const a = path.join(dir, 'A.txt');
    const b = path.join(dir, 'B.txt');
    fs.writeFileSync(a, 'Definir Alfa x;');
    fs.writeFileSync(b, 'Definir Alfa y;');

    const session = createCompilerSession();
    const config = {
      name: 'PARSE',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    await session.compile(config);

    const parseSpy = vi.spyOn(parser, 'parseSingleFile');
    await session.compile(config);
    expect(parseSpy).toHaveBeenCalledTimes(0);

    fs.writeFileSync(b, 'Definir Alfa y; Definir Alfa z;');
    const bump = new Date(Date.now() + 5000);
    fs.utimesSync(b, bump, bump);

    parseSpy.mockClear();
    await session.compile(config);
    expect(parseSpy).toHaveBeenCalledTimes(1);

    parseSpy.mockRestore();
  });
});
