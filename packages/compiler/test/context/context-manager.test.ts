import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { compileContext, createCompilerSession, fileBelongsToContext } from '../../src';
import type { CompilerSession } from '../../src';

describe('context manager', () => {
  it('respects includeSubdirectories flag', () => {
    const config = {
      name: 'ctx',
      rootDir: path.join(process.cwd(), 'context-root'),
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM' as const
    };

    const rootFile = path.join(config.rootDir, 'file.txt');
    const nestedFile = path.join(config.rootDir, 'sub', 'file.txt');

    expect(fileBelongsToContext(config, rootFile)).toBe(true);
    expect(fileBelongsToContext(config, nestedFile)).toBe(false);
  });

  it('supports regex filePattern on basename', () => {
    const config = {
      name: 'ctx',
      rootDir: path.join(process.cwd(), 'context-root'),
      filePattern: 're:^HR.*\\.txt$',
      includeSubdirectories: true,
      system: 'HCM' as const
    };

    const okFile = path.join(config.rootDir, 'HR001.txt');
    const badFile = path.join(config.rootDir, 'AB001.txt');

    expect(fileBelongsToContext(config, okFile)).toBe(true);
    expect(fileBelongsToContext(config, badFile)).toBe(false);
  });

  it('treats invalid regex filePattern as no match', () => {
    const config = {
      name: 'ctx',
      rootDir: path.join(process.cwd(), 'context-root'),
      filePattern: 're:[',
      includeSubdirectories: true,
      system: 'HCM' as const
    };
    const file = path.join(config.rootDir, 'HR001.txt');
    expect(fileBelongsToContext(config, file)).toBe(false);
  });

  it('rejects SENIOR as context system in compileContext', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-ctx-system-'));
    fs.writeFileSync(path.join(dir, 'A.txt'), 'Definir Numero n;\n');
    await expect(
      compileContext({
        name: 'ctx',
        rootDir: dir,
        filePattern: '*.txt',
        includeSubdirectories: false,
        // Runtime guard for JS/any callers.
        system: 'SENIOR' as unknown as 'HCM'
      } as unknown as Parameters<typeof compileContext>[0])
    ).rejects.toThrow('System inválido para ValidationContext');
  });

  it('rejects SENIOR as context system in compiler session', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-ctx-system-session-'));
    fs.writeFileSync(path.join(dir, 'A.txt'), 'Definir Numero n;\n');
    const session = createCompilerSession();
    await expect(
      session.compile({
        name: 'ctx',
        rootDir: dir,
        filePattern: '*.txt',
        includeSubdirectories: false,
        system: 'SENIOR' as unknown as 'HCM'
      } as Parameters<CompilerSession['compile']>[0])
    ).rejects.toThrow('System inválido para ValidationContext');
  });
});
