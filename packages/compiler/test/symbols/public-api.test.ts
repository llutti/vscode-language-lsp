import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPublicCompilerApi } from '../../src';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-public-api-'));
}

describe('public compiler api', () => {
  it('ensureCompiledForFile retorna files (nao vazio) e contextId', async () => {
    const dir = makeTempDir();
    const a = path.join(dir, 'A.txt');
    fs.writeFileSync(a, 'Definir Numero nA;\nnA = 1;\n', 'utf8');

    const api = createPublicCompilerApi();
    const snapshot = await api.ensureCompiledForFile(
      {
        name: 'PUBLIC_API_BASIC',
        rootDir: dir,
        filePattern: '*.txt',
        includeSubdirectories: false,
        system: 'HCM'
      },
      a,
      undefined,
      { reason: 'diagnostics', includeSemantics: false }
    );

    expect(snapshot.contextId).toBe('public_api_basic');
    expect(snapshot.files.length).toBeGreaterThan(0);
  });

  it('getDiagnosticsForFile filtra por arquivo', async () => {
    const dir = makeTempDir();
    const a = path.join(dir, 'A.txt');
    const b = path.join(dir, 'B.txt');
    fs.writeFileSync(a, 'Definir Numero nA;\nnA = "x";\n', 'utf8');
    fs.writeFileSync(b, 'Definir Numero nB;\nnB = "y";\n', 'utf8');

    const api = createPublicCompilerApi();
    const snapshot = await api.ensureCompiledForFile(
      {
        name: 'PUBLIC_API_DIAGS',
        rootDir: dir,
        filePattern: '*.txt',
        includeSubdirectories: false,
        system: 'HCM'
      },
      b,
      undefined,
      { reason: 'diagnostics', includeSemantics: false }
    );

    const diagsA = api.getDiagnosticsForFile(snapshot, a);
    const diagsB = api.getDiagnosticsForFile(snapshot, b);

    expect(diagsA.length).toBeGreaterThan(0);
    expect(diagsB.length).toBeGreaterThan(0);
    expect(diagsA.every((d) => path.resolve(d.sourcePath) === path.resolve(a))).toBe(true);
    expect(diagsB.every((d) => path.resolve(d.sourcePath) === path.resolve(b))).toBe(true);
  });

  it('includeSemantics retorna semanticsByFile apenas quando true', async () => {
    const dir = makeTempDir();
    const a = path.join(dir, 'A.txt');
    fs.writeFileSync(a, 'Definir Numero nA;\nnA = 1;\n', 'utf8');

    const api = createPublicCompilerApi();
    const noSemantics = await api.ensureCompiledForFile(
      {
        name: 'PUBLIC_API_NO_SEM',
        rootDir: dir,
        filePattern: '*.txt',
        includeSubdirectories: false,
        system: 'HCM'
      },
      a,
      undefined,
      { reason: 'diagnostics', includeSemantics: false }
    );
    const withSemantics = await api.ensureCompiledForFile(
      {
        name: 'PUBLIC_API_WITH_SEM',
        rootDir: dir,
        filePattern: '*.txt',
        includeSubdirectories: false,
        system: 'HCM'
      },
      a,
      undefined,
      { reason: 'semantics', includeSemantics: true }
    );

    expect(noSemantics.semanticsByFile).toBeUndefined();
    expect((withSemantics.semanticsByFile?.size ?? 0) > 0).toBe(true);
  });

  it('prefix compile seleciona prefix menor que full context', async () => {
    const dir = makeTempDir();
    const a = path.join(dir, 'A.txt');
    const b = path.join(dir, 'B.txt');
    const c = path.join(dir, 'C.txt');
    fs.writeFileSync(a, 'Definir Numero nA;\n', 'utf8');
    fs.writeFileSync(b, 'Definir Numero nB;\n', 'utf8');
    fs.writeFileSync(c, 'Definir Numero nC;\n', 'utf8');

    const config = {
      name: 'PUBLIC_API_PREFIX',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM' as const
    };

    const api = createPublicCompilerApi();
    const full = await api.ensureCompiledForFile(config, c, undefined, {
      reason: 'diagnostics',
      includeSemantics: false,
      prefixUntilTarget: false
    });
    const prefix = await api.ensureCompiledForFile(config, b, undefined, {
      reason: 'diagnostics',
      includeSemantics: false,
      prefixUntilTarget: true
    });

    expect(full.files.length).toBe(3);
    expect(prefix.files.length).toBeLessThan(full.files.length);
    expect(prefix.files.some((filePath) => path.resolve(filePath) === path.resolve(c))).toBe(false);
    expect(prefix.files.some((filePath) => path.resolve(filePath) === path.resolve(b))).toBe(true);
  });
});
