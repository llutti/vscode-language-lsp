import { describe, it, expect } from 'vitest';
import { createSourceFile } from '../../src/source/source-file';
import { parseFiles } from '../../src/parser/parser';
import { analyzeProgram } from '../../src/semantic/analyzer';

async function analyze(text: string) {
  const source = createSourceFile('/tmp/test.lsp', text);
  const { program, parseErrors } = parseFiles([source]);
  const result = await analyzeProgram({ contextId: 'test', system: 'HCM', program });
  return { parseErrors, diagnostics: result.diagnostics };
}

describe('recovery', () => {
  it('recovers after syntax error and still analyzes later statements', async () => {
    const { diagnostics } = await analyze(
      'Definir Numero nValor\n' + // missing ';' on purpose
      'Definir Cursor cur;\n' +
      'cur.SQL "UPDATE x";\n'
    );

    // Even with the syntax error, we should still emit Cursor SQL diagnostic.
    const hasCursorError = diagnostics.some((d) => d.id === 'LSP1301');
    expect(hasCursorError).toBe(true);
  });

  it('recovers after invalid Definir and parses next statement', async () => {
    const source = createSourceFile(
      '/tmp/test.lsp',
      'Definir Numero ;\n' +
      'Definir Numero ok;\n'
    );
    const { program } = parseFiles([source]);
    const file = program.files[0];
    const decl = file.statements.find((s) => s.kind === 'VarDecl' && s.name === 'ok');
    expect(decl).toBeTruthy();
  });
});
