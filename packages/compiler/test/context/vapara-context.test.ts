import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileContext } from '../../src';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-vapara-'));
}

describe('VaPara context/file restrictions', () => {
  it('does not resolve label across different files in the same context', async () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'A.txt'), 'VaPara saida;\n');
    fs.writeFileSync(path.join(dir, 'B.txt'), 'saida:\n');

    const result = await compileContext({
      name: 'vapara',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    });

    expect(result.diagnostics.some((d) => d.id === 'LSP1418')).toBe(true);
  });
});
