import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { compileContext, createCompilerSession } from '../../src';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-ctx-'));
}

describe('context isolation', () => {
  it('does not leak diagnostics between contexts', async () => {
    const dirA = makeTempDir();
    const dirB = makeTempDir();

    const fileA = path.join(dirA, 'A.txt');
    const fileB = path.join(dirB, 'B.txt');
    fs.writeFileSync(fileA, 'Definir Numero nA;\n');
    fs.writeFileSync(fileB, 'Definir Numero nB;\n');

    const resultA = await compileContext({
      name: 'A',
      rootDir: dirA,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    });

    const resultB = await compileContext({
      name: 'B',
      rootDir: dirB,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    });

    expect(resultA.diagnostics.length).toBe(1);
    expect(resultB.diagnostics.length).toBe(1);
    expect(resultA.diagnostics[0].sourcePath.startsWith(dirA)).toBe(true);
    expect(resultB.diagnostics[0].sourcePath.startsWith(dirB)).toBe(true);
  });

  it('isolates session cache for contexts with same name but different roots', async () => {
    const dirA = makeTempDir();
    const dirB = makeTempDir();
    const fileName = 'MAIN.txt';
    const fileA = path.join(dirA, fileName);
    const fileB = path.join(dirB, fileName);
    fs.writeFileSync(fileA, 'Definir Numero nA;\n');
    fs.writeFileSync(fileB, 'Definir Numero nB;\n');

    const session = createCompilerSession();
    const configA = {
      name: 'CTX',
      rootDir: dirA,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM' as const
    };
    const configB = {
      name: 'CTX',
      rootDir: dirB,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM' as const
    };

    const coldA = await session.compile(configA, undefined, { collectStats: true });
    const coldB = await session.compile(configB, undefined, { collectStats: true });
    const warmA = await session.compile(configA, undefined, { collectStats: true });
    const warmB = await session.compile(configB, undefined, { collectStats: true });

    expect(coldA.__stats?.filesParsed).toBe(1);
    expect(coldB.__stats?.filesParsed).toBe(1);
    expect(warmA.__stats?.filesParsed).toBe(0);
    expect(warmB.__stats?.filesParsed).toBe(0);

    expect(coldA.symbols.some((s) => s.nameNormalized === 'na')).toBe(true);
    expect(coldA.symbols.some((s) => s.nameNormalized === 'nb')).toBe(false);
    expect(coldB.symbols.some((s) => s.nameNormalized === 'nb')).toBe(true);
    expect(coldB.symbols.some((s) => s.nameNormalized === 'na')).toBe(false);
  });

  it('does not leak incremental changed-file behavior across contexts', async () => {
    const dirA = makeTempDir();
    const dirB = makeTempDir();
    const a1 = path.join(dirA, 'A1.txt');
    const b1 = path.join(dirB, 'B1.txt');
    fs.writeFileSync(a1, 'Definir Numero nA;\nnA = 1;\n');
    fs.writeFileSync(b1, 'Definir Numero nB;\nnB = 1;\n');

    const session = createCompilerSession();
    const configA = {
      name: 'A',
      rootDir: dirA,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM' as const
    };
    const configB = {
      name: 'B',
      rootDir: dirB,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM' as const
    };

    await session.compile(configA);
    await session.compile(configB);

    fs.writeFileSync(a1, 'Definir Numero nA;\nnA = 2;\n');
    const changedA = await session.compile(configA, undefined, { collectStats: true, changedFilePaths: [a1] });
    const warmB = await session.compile(configB, undefined, { collectStats: true });

    expect(changedA.__stats?.filesParsed).toBe(1);
    expect(warmB.__stats?.filesParsed).toBe(0);
    expect(warmB.symbols.some((s) => s.nameNormalized === 'na')).toBe(false);
    expect(warmB.symbols.some((s) => s.nameNormalized === 'nb')).toBe(true);
    expect(warmB.diagnostics.every((d) => d.sourcePath.startsWith(dirB))).toBe(true);
  });

  it('isolates semantics payload when contexts compile simultaneously with includeSemantics', async () => {
    const dirA = makeTempDir();
    const dirB = makeTempDir();
    const a1 = path.join(dirA, 'A1.txt');
    const b1 = path.join(dirB, 'B1.txt');
    fs.writeFileSync(a1, 'Definir Numero nA;\nnA = 1;\n');
    fs.writeFileSync(b1, 'Definir Numero nB;\nnB = 1;\n');

    const session = createCompilerSession();
    const configA = {
      name: 'A',
      rootDir: dirA,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM' as const
    };
    const configB = {
      name: 'B',
      rootDir: dirB,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM' as const
    };

    const [resultA, resultB] = await Promise.all([
      session.compile(configA, undefined, { includeSemantics: true }),
      session.compile(configB, undefined, { includeSemantics: true })
    ]);

    expect((resultA.semanticsByFile?.size ?? 0) > 0).toBe(true);
    expect((resultB.semanticsByFile?.size ?? 0) > 0).toBe(true);
    for (const filePath of resultA.semanticsByFile?.keys() ?? []) {
      expect(filePath.startsWith(dirA)).toBe(true);
    }
    for (const filePath of resultB.semanticsByFile?.keys() ?? []) {
      expect(filePath.startsWith(dirB)).toBe(true);
    }
    expect(resultA.symbols.some((s) => s.nameNormalized === 'na')).toBe(true);
    expect(resultA.symbols.some((s) => s.nameNormalized === 'nb')).toBe(false);
    expect(resultB.symbols.some((s) => s.nameNormalized === 'nb')).toBe(true);
    expect(resultB.symbols.some((s) => s.nameNormalized === 'na')).toBe(false);
  });

  it('isolates semanticBudgetFiles during concurrent typing compiles', async () => {
    const dirA = makeTempDir();
    const dirB = makeTempDir();
    const a1 = path.join(dirA, 'A1.txt');
    const a2 = path.join(dirA, 'A2.txt');
    const b1 = path.join(dirB, 'B1.txt');
    const b2 = path.join(dirB, 'B2.txt');
    fs.writeFileSync(a1, 'Definir Numero nA;\nnA = 1;\n');
    fs.writeFileSync(a2, 'Definir Numero nA2;\nnA2 = 2;\n');
    fs.writeFileSync(b1, 'Definir Numero nB;\nnB = 1;\n');
    fs.writeFileSync(b2, 'Definir Numero nB2;\nnB2 = 2;\n');

    const session = createCompilerSession();
    const configA = {
      name: 'A',
      rootDir: dirA,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM' as const
    };
    const configB = {
      name: 'B',
      rootDir: dirB,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM' as const
    };

    await session.compile(configA, undefined, { includeSemantics: true, collectStats: true });
    await session.compile(configB, undefined, { includeSemantics: true, collectStats: true });

    fs.writeFileSync(a1, 'Definir Numero nA;\nnA = 99;\n');
    fs.writeFileSync(b1, 'Definir Numero nB;\nnB = 88;\n');

    const [resultA, resultB] = await Promise.all([
      session.compile(configA, undefined, {
        includeSemantics: true,
        changedFilePaths: [a1],
        semanticBudgetFiles: 1,
        collectStats: true
      }),
      session.compile(configB, undefined, {
        includeSemantics: true,
        changedFilePaths: [b1],
        semanticBudgetFiles: 1,
        collectStats: true
      })
    ]);

    expect((resultA.__stats?.filesParsed ?? 0) <= 1).toBe(true);
    expect((resultB.__stats?.filesParsed ?? 0) <= 1).toBe(true);
    expect(resultA.symbols.some((s) => s.nameNormalized === 'na')).toBe(true);
    expect(resultA.symbols.some((s) => s.nameNormalized === 'nb')).toBe(false);
    expect(resultB.symbols.some((s) => s.nameNormalized === 'nb')).toBe(true);
    expect(resultB.symbols.some((s) => s.nameNormalized === 'na')).toBe(false);
    expect(resultA.diagnostics.every((d) => d.sourcePath.startsWith(dirA))).toBe(true);
    expect(resultB.diagnostics.every((d) => d.sourcePath.startsWith(dirB))).toBe(true);
  });

  it('isolates cache when contexts share name/root but use different file patterns', async () => {
    const dir = makeTempDir();
    const txtFile = path.join(dir, 'MAIN.txt');
    const lspFile = path.join(dir, 'MAIN.lsp');
    fs.writeFileSync(txtFile, 'Definir Numero nTxt;\n');
    fs.writeFileSync(lspFile, 'Definir Numero nLsp;\n');

    const session = createCompilerSession();
    const configTxt = {
      name: 'CTX',
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM' as const
    };
    const configLsp = {
      name: 'CTX',
      rootDir: dir,
      filePattern: '*.lsp',
      includeSubdirectories: false,
      system: 'HCM' as const
    };

    const coldTxt = await session.compile(configTxt, undefined, { collectStats: true });
    const coldLsp = await session.compile(configLsp, undefined, { collectStats: true });
    const warmTxt = await session.compile(configTxt, undefined, { collectStats: true });

    expect(coldTxt.__stats?.filesParsed).toBe(1);
    expect(coldLsp.__stats?.filesParsed).toBe(1);
    expect(warmTxt.__stats?.filesParsed).toBe(1);
    expect(coldTxt.symbols.some((s) => s.nameNormalized === 'ntxt')).toBe(true);
    expect(coldTxt.symbols.some((s) => s.nameNormalized === 'nlsp')).toBe(false);
    expect(coldLsp.symbols.some((s) => s.nameNormalized === 'nlsp')).toBe(true);
    expect(coldLsp.symbols.some((s) => s.nameNormalized === 'ntxt')).toBe(false);
    expect(warmTxt.symbols.some((s) => s.nameNormalized === 'ntxt')).toBe(true);
    expect(warmTxt.symbols.some((s) => s.nameNormalized === 'nlsp')).toBe(false);
  });

  it('keeps A/B/A/B compile sequence isolated without cross-context leakage', async () => {
    const dirA = makeTempDir();
    const dirB = makeTempDir();
    const a1 = path.join(dirA, 'A1.txt');
    const b1 = path.join(dirB, 'B1.txt');
    fs.writeFileSync(a1, 'Definir Numero nA;\nnA = 1;\n');
    fs.writeFileSync(b1, 'Definir Numero nB;\nnB = 1;\n');

    const session = createCompilerSession();
    const configA = {
      name: 'A',
      rootDir: dirA,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM' as const
    };
    const configB = {
      name: 'B',
      rootDir: dirB,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM' as const
    };

    const r1 = await session.compile(configA, undefined, { collectStats: true });
    const r2 = await session.compile(configB, undefined, { collectStats: true });
    const r3 = await session.compile(configA, undefined, { collectStats: true });
    const r4 = await session.compile(configB, undefined, { collectStats: true });

    expect(r1.__stats?.filesParsed).toBe(1);
    expect(r2.__stats?.filesParsed).toBe(1);
    expect(r3.__stats?.filesParsed).toBe(0);
    expect(r4.__stats?.filesParsed).toBe(0);
    expect(r3.symbols.some((s) => s.nameNormalized === 'na')).toBe(true);
    expect(r3.symbols.some((s) => s.nameNormalized === 'nb')).toBe(false);
    expect(r4.symbols.some((s) => s.nameNormalized === 'nb')).toBe(true);
    expect(r4.symbols.some((s) => s.nameNormalized === 'na')).toBe(false);
    expect(r3.diagnostics.every((d) => d.sourcePath.startsWith(dirA))).toBe(true);
    expect(r4.diagnostics.every((d) => d.sourcePath.startsWith(dirB))).toBe(true);
  });
});
