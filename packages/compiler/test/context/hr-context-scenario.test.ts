import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCompilerSession, type Diagnostic } from '../../src';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-hr-'));
}

function writeFile(dir: string, name: string, content: string) {
  fs.writeFileSync(path.join(dir, name), content, 'utf8');
}

function errors(diags: Diagnostic[]) {
  return diags.filter((d) => d.severity === 'Error');
}

describe('HR context scenario (multi-file, only HR858 open)', () => {
  it('resolves aTxtLog from HR850 and validates IntParaAlfa call in HR858', async () => {
    const rootDir = makeTempDir();

    // HR850.txt
    writeFile(
      rootDir,
      'HR850.txt',
      [
        'Definir Alfa aTxtLog;',
        ''
      ].join('\n')
    );

    // HR858.txt (arquivo aberto na IDE no cenário)
    writeFile(
      rootDir,
      'HR858.txt',
      [
        'nNumCad = 1234567;',
        'IntParaAlfa(nNumCad, aTxtLog);',
        ''
      ].join('\n')
    );

    // Demais arquivos do contexto
    const others = ['HR851.txt', 'HR853.txt', 'HR859.txt', 'HR860.txt'];
    for (const f of others) {
      writeFile(
        rootDir,
        f,
        [
          'nNumEmp = 10;',
          ''
        ].join('\n')
      );
    }

    const session = createCompilerSession();

    const result = await session.compile(
      {
        name: 'HR',
        rootDir,
        filePattern: 're:^HR.*\\.txt$',
        includeSubdirectories: false,
        system: 'HCM'
      },
      // Opcional: se quiser simular “HR858 aberto” com conteúdo em memória diferente do disco,
      // você pode usar contentOverrides aqui. Para o cenário pedido, não é necessário.
      undefined,
      { includeSemantics: true }
    );

    // Garante que os arquivos do contexto foram descobertos e ordenados
    expect(result.files.map((p) => path.basename(p))).toEqual([
      'HR850.txt',
      'HR851.txt',
      'HR853.txt',
      'HR858.txt',
      'HR859.txt',
      'HR860.txt'
    ]);

    // Esperado: zero ERROS (podem existir warnings como variável não usada em nNumEmp)
    const errs = errors(result.diagnostics);
    expect(errs).toHaveLength(0);

    // Garantia específica do cenário:
    // não pode acusar “use before declaration” relacionado ao aTxtLog em HR858.
    // (Como estamos exigindo zero erros, isso já está coberto; aqui fica explícito.)
    expect(result.diagnostics.some((d) => d.id === 'LSP1001' && d.severity === 'Error')).toBe(false);
  });
});
