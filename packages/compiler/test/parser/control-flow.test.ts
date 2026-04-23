import { describe, it, expect } from 'vitest';
import { createSourceFile } from '../../src/source/source-file';
import { parseFiles } from '../../src/parser/parser';

function parse(text: string) {
  const source = createSourceFile('/tmp/test.lsp', text);
  return parseFiles([source]);
}

describe('control flow', () => {
  it('parses Se/Senao with single statement bodies', () => {
    const { program } = parse('Se (a = 1) b = 2; Senao c = 3;\n');
    const file = program.files[0];
    const stmt = file.statements.find((s) => s.kind === 'If');
    expect(stmt).toBeTruthy();
  });

  it('parses Para with expressions', () => {
    const { program } = parse('Para (i = 0; i < 10; i = i + 1) Inicio Fim;\n');
    const file = program.files[0];
    const stmt = file.statements.find((s) => s.kind === 'For');
    expect(stmt).toBeTruthy();
  });
});
