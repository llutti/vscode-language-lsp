import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { isFallbackFile } from '../../../src/server/fallback/fallback-server';
import { compileSingleFile, createCompilerSession, type ValidationContextConfig } from '@lsp/compiler';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-startup-'));
}

function writeFile(dir: string, name: string, content: string) {
  fs.writeFileSync(path.join(dir, name), content, 'utf8');
}

describe('integration: startup fallback can emit LSP1411; full context clears it', () => {
  it('reproduces the startup behavior (no contexts yet) -> fallback compile -> LSP1411', async () => {
    const rootDir = makeTempDir();

    // Contexto HR que (mais tarde) estará carregado
    const hrContext: ValidationContextConfig = {
      name: 'HR',
      rootDir,
      filePattern: 're:^HR.*\\.txt$',
      includeSubdirectories: false,
      system: 'HCM'
    };

    // Arquivo que contém a declaração real (mas que NÃO entra no fallback compile)
    writeFile(rootDir, 'HR850.txt', 'Definir Alfa aTxtLog;\n');

    // Arquivo “ativo” (aberto na IDE) no boot
    // Aqui aTxtLog NÃO foi declarada ainda (no fallback), então a validação de ConverteMascara
    // entende que o destino não é Alfa e dispara LSP1411.
    writeFile(
      rootDir,
      'HR858.txt',
      [
        'Definir Data dDatIni;',
        'aTxtLog = "1";',
        'ConverteMascara(3, dDatIni, aTxtLog, "DD/MM/YYYY");',
        ''
      ].join('\n')
    );


    // Demais arquivos do contexto (inofensivos)
    for (const f of ['HR851.txt', 'HR853.txt', 'HR859.txt', 'HR860.txt']) {
      writeFile(rootDir, f, 'nNumEmp = nNumEmp + 1;\n');
    }

    const hr858Path = path.join(rootDir, 'HR858.txt');
    const hr858Text = fs.readFileSync(hr858Path, 'utf8');

    // 1) SIMULA O BOOT: contextos ainda NÃO carregados => tudo vira fallback
    const contextsNotReady: ValidationContextConfig[] = [];
    expect(isFallbackFile(hr858Path, contextsNotReady)).toBe(true);

    // 2) Fallback compile (single-file): deve aparecer LSP1411
    const fallbackResult = await compileSingleFile({
      filePath: hr858Path,
      text: hr858Text,
      system: 'HCM',
      includeSemantics: true
    });

    expect(fallbackResult.diagnostics.some((d) => d.id === 'LSP1411')).toBe(true);

    // 3) SIMULA “DEPOIS”: contextos carregados => NÃO é fallback
    expect(isFallbackFile(hr858Path, [hrContext])).toBe(false);

    // 4) Compila contexto completo (inclui HR850) => não deve ter diagnostics
    const session = createCompilerSession();
    const fullResult = await session.compile(
      {
        name: 'HR',
        rootDir,
        filePattern: 're:^HR.*\\.txt$',
        includeSubdirectories: false,
        system: 'HCM'
      },
      undefined,
      { includeSemantics: true }
    );

    expect(fullResult.diagnostics).toHaveLength(0);
  });
});
