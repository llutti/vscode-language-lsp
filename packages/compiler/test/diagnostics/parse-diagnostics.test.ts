import { describe, it, expect } from 'vitest';
import { compileSingleFile } from '../../src';

describe('parse diagnostics', () => {
  it("emits syntax diagnostic when ';' is missing at end of command", async () => {
    const result = await compileSingleFile({
      filePath: '/tmp/test.lsp',
      text: 'nValor = 10\n',
      system: 'HCM'
    });

    const hasMissingSemicolonDiagnostic = result.diagnostics.some(
      (d) => d.id === 'LSP0001' && d.message.includes("Esperado ';'")
    );
    expect(hasMissingSemicolonDiagnostic).toBe(true);
  });

  it("anchors missing ';' diagnostic at end of previous command, not next command", async () => {
    const result = await compileSingleFile({
      filePath: '/tmp/test.lsp',
      text: 'nNumCad = 10\nDefinir Numero x;\n',
      system: 'HCM'
    });

    const missingSemicolon = result.diagnostics.find(
      (d) => d.id === 'LSP0001' && d.message.includes("Esperado ';'")
    );
    expect(missingSemicolon).toBeTruthy();
    expect(missingSemicolon?.range.start.line).toBe(0);
    expect(missingSemicolon?.range.start.character).toBe(12);
    expect(missingSemicolon?.range.end.line).toBe(0);
    expect(missingSemicolon?.range.end.character).toBe(12);
  });

  it("emits missing ';' for Definir and anchors at end of declaration", async () => {
    const result = await compileSingleFile({
      filePath: '/tmp/test.lsp',
      text: 'Definir Numero nNumCad\nDefinir Numero x;\n',
      system: 'HCM'
    });

    const missingSemicolon = result.diagnostics.find(
      (d) => d.id === 'LSP0001' && d.message.includes("Esperado ';' ao final de definição")
    );
    expect(missingSemicolon).toBeTruthy();
    expect(missingSemicolon?.range.start.line).toBe(0);
    expect(missingSemicolon?.range.start.character).toBe(22);
    expect(missingSemicolon?.range.end.line).toBe(0);
    expect(missingSemicolon?.range.end.character).toBe(22);
  });

  it("emits missing ';' when Definir has extra tokens before assignment on the same line", async () => {
    const result = await compileSingleFile({
      filePath: '/tmp/test.lsp',
      text: 'Definir Data dData dData = 0;\n',
      system: 'HCM'
    });

    const missingSemicolon = result.diagnostics.find(
      (d) => d.id === 'LSP0001' && d.message.includes("Esperado ';' ao final de definição")
    );
    expect(missingSemicolon).toBeTruthy();
    expect(missingSemicolon?.range.start.line).toBe(0);
    expect(missingSemicolon?.range.start.character).toBe(18);
    expect(missingSemicolon?.range.end.line).toBe(0);
    expect(missingSemicolon?.range.end.character).toBe(18);
  });

  it("emits missing ';' when another Definir starts on the same line", async () => {
    const result = await compileSingleFile({
      filePath: '/tmp/test.lsp',
      text: 'Definir Alfa aData definir numero nvalor;\n',
      system: 'HCM'
    });

    const missingSemicolon = result.diagnostics.find(
      (d) => d.id === 'LSP0001' && d.message.includes("Esperado ';' ao final de definição")
    );
    expect(missingSemicolon).toBeTruthy();
    expect(missingSemicolon?.range.start.line).toBe(0);
    expect(missingSemicolon?.range.start.character).toBe(18);
    expect(missingSemicolon?.range.end.line).toBe(0);
    expect(missingSemicolon?.range.end.character).toBe(18);
  });

  it('emits LSP0007 when inline comment is glued to previous identifier', async () => {
    const result = await compileSingleFile({
      filePath: '/tmp/test.lsp',
      text: 'aNumSol@-- Comentario 1 --@\n',
      system: 'HCM'
    });

    const missingSpace = result.diagnostics.find(
      (d) => d.id === 'LSP0007' && d.message === 'Esperado 1 espaço antes de comentário inline'
    );
    expect(missingSpace).toBeTruthy();
    expect(missingSpace?.range.start.line).toBe(0);
    expect(missingSpace?.range.start.character).toBe(7);
    expect(missingSpace?.range.end.line).toBe(0);
    expect(missingSpace?.range.end.character).toBe(7);
  });

  it('does not emit LSP0001 for postfix increment statement', async () => {
    const result = await compileSingleFile({
      filePath: '/tmp/test.lsp',
      text: 'Definir Numero nAno;\nnAno++;\n',
      system: 'HCM'
    });

    const hasSyntaxError = result.diagnostics.some((d) => d.id === 'LSP0001');
    expect(hasSyntaxError).toBe(false);
  });

  it("does not emit LSP0001 for 'VaPara saida;'", async () => {
    const result = await compileSingleFile({
      filePath: '/tmp/test.lsp',
      text: 'VaPara saida;\n',
      system: 'HCM'
    });

    const hasSyntaxError = result.diagnostics.some((d) => d.id === 'LSP0001');
    expect(hasSyntaxError).toBe(false);
  });

  it('does not emit LSP0001 for label declaration', async () => {
    const result = await compileSingleFile({
      filePath: '/tmp/test.lsp',
      text: 'saida:\nVaPara saida;\n',
      system: 'HCM'
    });

    const hasSyntaxError = result.diagnostics.some((d) => d.id === 'LSP0001');
    expect(hasSyntaxError).toBe(false);
  });

  it("does not emit LSP0001 for label declaration with optional ';'", async () => {
    const result = await compileSingleFile({
      filePath: '/tmp/test.lsp',
      text: 'saida:;\nVaPara saida;\n',
      system: 'HCM'
    });

    const hasSyntaxError = result.diagnostics.some((d) => d.id === 'LSP0001');
    expect(hasSyntaxError).toBe(false);
  });

  it('does not emit LSP0001 for lista method call with keyword-like member name', async () => {
    const result = await compileSingleFile({
      filePath: '/tmp/test.lsp',
      text: 'Definir Lista lst_TotMar;\nlst_TotMar.Limpar();\n',
      system: 'HCM'
    });

    const hasSyntaxError = result.diagnostics.some((d) => d.id === 'LSP0001');
    expect(hasSyntaxError).toBe(false);
  });

  it("does not emit LSP0001 for official cursor SQL syntax without '='", async () => {
    const result = await compileSingleFile({
      filePath: '/tmp/test.lsp',
      text: 'Definir Cursor cur;\ncur.SQL "SELECT campo FROM Tabela";\n',
      system: 'HCM'
    });

    const hasSyntaxError = result.diagnostics.some((d) => d.id === 'LSP0001');
    expect(hasSyntaxError).toBe(false);
  });


  it("emits LSP0001 when Cursor.SQL uses '=' syntax", async () => {
    const result = await compileSingleFile({
      filePath: '/tmp/test.lsp',
      text: 'Definir Cursor cur;\ncur.SQL = "SELECT campo FROM Tabela";\n',
      system: 'HCM'
    });

    const syntaxError = result.diagnostics.find(
      (d) => d.id === 'LSP0001' && d.message.includes('Sintaxe válida para Cursor.SQL')
    );
    expect(syntaxError).toBeTruthy();
  });

  it("emits LSP0001 when SQL shorthand without '=' is used on non-Cursor", async () => {
    const result = await compileSingleFile({
      filePath: '/tmp/test.lsp',
      text: 'Definir Lista lst;\nlst.SQL "SELECT campo FROM Tabela";\n',
      system: 'HCM'
    });

    const shorthandError = result.diagnostics.find(
      (d) => d.id === 'LSP0001' && d.message.includes('permitida apenas para variáveis do tipo Cursor')
    );
    expect(shorthandError).toBeTruthy();
  });
});
