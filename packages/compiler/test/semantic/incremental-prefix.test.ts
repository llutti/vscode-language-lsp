import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCompilerSession } from '../../src';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-inc-prefix-'));
}

describe('incremental prefix', () => {
  it('editar arquivo i nao reprocessa 0..i-1', async () => {
    const dir = makeTempDir();
    const files = ['A.txt', 'B.txt', 'C.txt', 'D.txt'];
    for (const [index, name] of files.entries()) {
      fs.writeFileSync(path.join(dir, name), `n${index} = ${index};\n`, 'utf8');
    }

    const session = createCompilerSession();
    const config = {
      name: 'INC_PREFIX',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    const first = await session.compile(config, undefined, { collectStats: true });
    expect(first.__stats?.filesParsed).toBe(4);

    const cPath = path.join(dir, 'C.txt');
    fs.writeFileSync(cPath, 'n2 = 999;\n', 'utf8');
    const bump = new Date(Date.now() + 5000);
    fs.utimesSync(cPath, bump, bump);

    const second = await session.compile(config, undefined, { collectStats: true });

    expect(second.__stats?.filesParsed).toBe(1);
    expect(second.__stats?.semanticStartIndex).toBe(2);
    // Incremental semantic now reanalyzes only the changed file when direct dependents are unaffected.
    expect(second.__stats?.semanticFilesReused).toBe(3);
    expect(second.__stats?.semanticFilesAnalyzed).toBe(1);
  });
});
