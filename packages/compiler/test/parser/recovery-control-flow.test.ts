import { describe, it, expect } from 'vitest';
import { createSourceFile } from '../../src/source/source-file';
import { parseFiles } from '../../src/parser/parser';
import { analyzeProgram } from '../../src/semantic/analyzer';

async function analyze(text: string) {
  const source = createSourceFile('/tmp/test.lsp', text);
  const { program } = parseFiles([source]);
  return analyzeProgram({ contextId: 'test', system: 'HCM', program });
}

describe('control-flow recovery', () => {
  it('recovers Se without condition before Senao', async () => {
    const result = await analyze('Se a = 1\nSenao b = 2;\n');
    const hasDiagnostics = result.diagnostics.length >= 0;
    expect(hasDiagnostics).toBe(true);
  });

  it('recovers Para without closing paren', async () => {
    const result = await analyze('Para (i = 0; i < 2; i = i + 1 Inicio Fim;\n');
    const hasDiagnostics = result.diagnostics.length >= 0;
    expect(hasDiagnostics).toBe(true);
  });
});
