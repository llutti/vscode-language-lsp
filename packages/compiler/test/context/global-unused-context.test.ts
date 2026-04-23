import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCompilerSession } from '../../src';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-global-unused-'));
}

describe('LSP1203 (global) only after full context validated', () => {
  it('does not emit LSP1203 for globals when compiling only a prefix of the context', async () => {
    const dir = makeTempDir();
    const hr850 = path.join(dir, 'HR850.txt');
    const hr899 = path.join(dir, 'HR899.txt');

    fs.writeFileSync(hr850, 'Definir Alfa aNomUsu;\n', 'utf8');
    fs.writeFileSync(hr899, 'Definir Alfa aOut;\naOut = aNomUsu + "x";\naNomUsu = aOut;\n', 'utf8');

    const session = createCompilerSession();
    const config = {
      name: 'HR',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    const prefix = await session.compile(config, undefined, { prefixUntilFilePath: hr850 });
    expect(prefix.diagnostics.some((d) => d.id === 'LSP1203')).toBe(false);

    const full = await session.compile(config);
    expect(full.diagnostics.some((d) => d.id === 'LSP1203')).toBe(false);
  });

  it('emits LSP1203 for unused global only on full context validation', async () => {
    const dir = makeTempDir();
    const a = path.join(dir, 'HR850.txt');
    const b = path.join(dir, 'HR899.txt');

    fs.writeFileSync(a, 'Definir Alfa aNuncaUsada;\n', 'utf8');
    fs.writeFileSync(b, 'Definir Alfa aOut;\naOut = "ok";\n', 'utf8');

    const session = createCompilerSession();
    const config = {
      name: 'HR',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    const prefix = await session.compile(config, undefined, { prefixUntilFilePath: a });
    expect(prefix.diagnostics.some((d) => d.id === 'LSP1203')).toBe(false);

    const full = await session.compile(config);
    expect(full.diagnostics.some((d) => d.id === 'LSP1203')).toBe(true);
  });

  it('does not emit LSP1203 for global variable when it is written at least twice (global write-only)', async () => {
    const dir = makeTempDir();
    const a = path.join(dir, 'HR850.txt');

    // Write-only global, assigned multiple times.
    fs.writeFileSync(a, 'Definir Alfa aErroConversao;\n' +
      'aErroConversao = "";\n' +
      'aErroConversao = "Falha";\n', 'utf8');

    const session = createCompilerSession();
    const config = {
      name: 'HR',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    const full = await session.compile(config);
    expect(full.diagnostics.some((d) => d.id === 'LSP1203' && d.message.includes('aErroConversao'))).toBe(false);
  });

  it('emits LSP1203 for explicit global variable when it is only written once', async () => {
    const dir = makeTempDir();
    const a = path.join(dir, 'HR850.txt');

    fs.writeFileSync(a, 'Definir Alfa aErroConversao;\naErroConversao = "Falha";\n', 'utf8');

    const session = createCompilerSession();
    const config = {
      name: 'HR',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    const full = await session.compile(config);
    expect(full.diagnostics.some((d) => d.id === 'LSP1203' && d.message.includes('aErroConversao'))).toBe(true);
  });

  it('emits LSP1203 for implicit Numero variable when it is only written once', async () => {
    const dir = makeTempDir();
    const a = path.join(dir, 'HR850.txt');

    // Implicit Numero: first write creates the variable; no reads; only 1 write => should be unused (LSP1203).
    fs.writeFileSync(a, 'x = 1;\n', 'utf8');

    const session = createCompilerSession();
    const config = {
      name: 'HR',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    const full = await session.compile(config);
    expect(full.diagnostics.some((d) => d.id === 'LSP1203' && d.message.includes('x'))).toBe(true);
  });

  it('does not emit LSP1203 for implicit Numero variable when it is written at least twice', async () => {
    const dir = makeTempDir();
    const a = path.join(dir, 'HR850.txt');

    fs.writeFileSync(a, 'x = 1;\nx = 2;\n', 'utf8');

    const session = createCompilerSession();
    const config = {
      name: 'HR',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    } as const;

    const full = await session.compile(config);
    expect(full.diagnostics.some((d) => d.id === 'LSP1203' && d.message.includes('x'))).toBe(false);
  });
});
