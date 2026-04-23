import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCompilerSession } from '../../src';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-inc-dependents-'));
}

describe('incremental semantic direct dependents', () => {
  it('reanalisa dependente direto mesmo quando aparece antes do arquivo alterado', async () => {
    const dir = makeTempDir();
    const a = path.join(dir, 'A.txt');
    const b = path.join(dir, 'B.txt');
    fs.writeFileSync(a, 'X = 1;\n', 'utf8');
    fs.writeFileSync(b, 'Definir Numero X;\n', 'utf8');

    const session = createCompilerSession();
    const config = {
      name: 'INC_DEP',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    await session.compile(config, undefined, { collectStats: true });

    fs.writeFileSync(b, 'Definir Alfa X;\n', 'utf8');
    const bump = new Date(Date.now() + 5000);
    fs.utimesSync(b, bump, bump);

    const second = await session.compile(config, undefined, { collectStats: true, changedFilePaths: [b] });

    expect(second.__stats?.filesParsed).toBe(1);
    expect(second.__stats?.semanticFilesAnalyzed).toBe(2);
  });
});
