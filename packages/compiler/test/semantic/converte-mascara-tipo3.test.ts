import { describe, it, expect } from 'vitest';
import { createSourceFile } from '../../src/source/source-file';
import { parseFiles } from '../../src/parser/parser';
import { analyzeProgram } from '../../src/semantic/analyzer';

async function analyze(text: string) {
  const source = createSourceFile('/tmp/test.lsp', text);
  const { program } = parseFiles([source]);
  return analyzeProgram({ contextId: 'test', system: 'HCM', program });
}

describe('ConverteMascara', () => {
  it('Tipo_Dado=3 aceita Valor_Origem Numero sem gerar LSP1404/LSP1405/LSP1415', async () => {
    const text = [
      'Definir Alfa aDest;',
      'Definir Alfa aMask;',
      'Definir Numero nValor;',
      'ConverteMascara(3, nValor, aDest, aMask);',
      ''
    ].join('\n');

    const result = await analyze(text);

    const ids = new Set(result.diagnostics.map((d) => d.id));
    expect(ids.has('LSP1404')).toBe(false);
    expect(ids.has('LSP1405')).toBe(false);
    expect(ids.has('LSP1415')).toBe(false);
  });
});
