import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCompilerSession } from '../../src';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-poison-'));
}

describe('poison cache', () => {
  it('invalidates caches after failure and recompiles cleanly on next cycle', async () => {
    const dir = makeTempDir();
    const a = path.join(dir, 'A.txt');
    const b = path.join(dir, 'B.txt');
    fs.writeFileSync(a, 'nA = 1;\n', 'utf8');
    fs.writeFileSync(b, 'nB = 2;\n', 'utf8');

    const session = createCompilerSession();
    const config = {
      name: 'POISON',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    await session.compile(config, undefined, { includeSemantics: true });

    fs.writeFileSync(b, 'nB = 200;\n', 'utf8');
    const bump = new Date(Date.now() + 5000);
    fs.utimesSync(b, bump, bump);

    // Force a real IO failure for one compile cycle (stale file list still contains B.txt).
    fs.rmSync(b);
    await expect(session.compile(config, undefined, { includeSemantics: true })).rejects.toThrow();
    fs.writeFileSync(b, 'nB = 200;\n', 'utf8');

    const recovered = await session.compile(config, undefined, { includeSemantics: true, collectStats: true });

    expect(recovered.__stats?.filesParsed).toBe(recovered.__stats?.filesDiscovered);
    expect(recovered.__stats?.filesRead).toBeGreaterThanOrEqual(1);
  });
});
