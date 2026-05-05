import { describe, it, expect } from 'vitest';
import { createSourceFile } from '../../src/source/source-file';
import { parseFiles } from '../../src/parser/parser';
import { analyzeProgram } from '../../src/semantic/analyzer';

async function analyze(text: string) {
  const source = createSourceFile('/tmp/test.lsp', text);
  const { program } = parseFiles([source]);
  return analyzeProgram({ contextId: 'test', system: 'HCM', program });
}

describe('semantic', () => {
  it('creates implicit Numero on first use', async () => {
    const result = await analyze('nValor = 10;\n');
    const errors = result.diagnostics.filter((d) => d.severity === 'Error');
    expect(errors.length).toBe(0);
  });
  it('creates implicit Numero on first use with signed numeric literal', async () => {
    const result = await analyze('pGLNivel = -1;\n');
    const errors = result.diagnostics.filter((d) => d.severity === 'Error');
    expect(errors.length).toBe(0);
  });

  it('keeps subtraction expression distinct from signed numeric literal', async () => {
    const result = await analyze('x = x - 1;\n');
    expect(result.diagnostics.some((d) => d.id === 'LSP1005')).toBe(false);
  });

  it('rejects Cursor.SQL with equals syntax', async () => {
    const result = await analyze('Definir Cursor cur;\ncur.SQL = "SELECT campo1 FROM Tabela";\n');
    const hasSyntaxError = result.diagnostics.some(
      (d) => d.id === 'LSP0001' && d.message.includes('Sintaxe válida para Cursor.SQL')
    );
    expect(hasSyntaxError).toBe(true);
  });

  it('rejects Cursor.SQL call syntax', async () => {
    const result = await analyze('Definir Cursor cur;\ncur.SQL("SELECT campo1 FROM Tabela");\n');
    const hasSyntaxError = result.diagnostics.some(
      (d) => d.id === 'LSP0001' && d.message.includes('Sintaxe válida para Cursor.SQL')
    );
    expect(hasSyntaxError).toBe(true);
  });

  it('rejects Cursor.SQL without SQL literal', async () => {
    const result = await analyze('Definir Cursor cur;\ncur.SQL;\n');
    const hasSyntaxError = result.diagnostics.some(
      (d) => d.id === 'LSP0001' && d.message.includes('Sintaxe válida para Cursor.SQL')
    );
    expect(hasSyntaxError).toBe(true);
  });

  it('validates Cursor.SQL has SELECT in official shorthand syntax', async () => {
    const result = await analyze('Definir Cursor cur;\ncur.SQL "UPDATE x";\n');
    const hasCursorError = result.diagnostics.some((d) => d.id === 'LSP1301');
    expect(hasCursorError).toBe(true);
  });

  it("accepts official Cursor.SQL syntax without '=' when SQL has SELECT", async () => {
    const result = await analyze('Definir Cursor cur;\ncur.SQL "SELECT campo1 FROM Tabela";\n');
    const hasSyntaxError = result.diagnostics.some((d) => d.id === 'LSP0001');
    const hasCursorError = result.diagnostics.some((d) => d.id === 'LSP1301');
    expect(hasSyntaxError).toBe(false);
    expect(hasCursorError).toBe(false);
  });

  it('treats parameters used as Cursor.SQL bind variables as used', async () => {
    const result = await analyze(
      'Funcao f(Numero cNumEmp, Numero cTipCol, Numero cNumCad);\n'
      + '{\n'
      + '  Definir Cursor C_Del;\n'
      + '  Definir Data xHoje;\n'
      + '  C_Del.SQL "SELECT * FROM USU_TR080GPD WHERE USU_EMPSUB=:cnumemp AND USU_TIPSUB=:ctipcol AND USU_CADSUB=:cnumcad AND USU_DATISU<=:xhoje";\n'
      + '}\n'
    );
    const unusedParams = result.diagnostics.filter((d) => d.id === 'LSP1201');
    expect(unusedParams).toHaveLength(0);
  });

  it('treats parameters used as ExecSQL bind variables as used', async () => {
    const result = await analyze(
      'Funcao f(Numero cNumEmp, Numero cTipCol, Numero cNumCad);\n'
      + '{\n'
      + '  ExecSQL "UPDATE USU_TR064CMP SET USU_DATINT=:dDatSis WHERE USU_NUMEMP=:cNumEmp AND USU_TIPCOL=:cTipCol AND USU_NUMCAD=:cNumCad";\n'
      + '}\n'
    );
    const unusedParams = result.diagnostics.filter((d) => d.id === 'LSP1201');
    expect(unusedParams).toHaveLength(0);
  });

  it('treats parameters used as ExecSQLEx bind variables as used', async () => {
    const result = await analyze(
      'Funcao f(Numero cNumEmp, Numero cTipCol, Numero cNumCad);\n'
      + '{\n'
      + '  Definir Numero nRet;\n'
      + '  Definir Alfa aMsg;\n'
      + '  ExecSQLEx("UPDATE USU_TR064CMP SET USU_DATINT=:dDatSis WHERE USU_NUMEMP=:cNumEmp AND USU_TIPCOL=:cTipCol AND USU_NUMCAD=:cNumCad", nRet, aMsg);\n'
      + '}\n'
    );
    const unusedParams = result.diagnostics.filter((d) => d.id === 'LSP1201');
    expect(unusedParams).toHaveLength(0);
  });

  it('errors on writing to readonly cursor fields', async () => {
    const result = await analyze(
      'Definir Cursor cur;\n' +
      'cur.SQL "SELECT campo1 FROM Tabela";\n' +
      'cur.campo1 = 1;\n'
    );
    const hasReadonly = result.diagnostics.some((d) => d.id === 'LSP1302');
    expect(hasReadonly).toBe(true);
  });

  it('warns on invalid cursor method arity', async () => {
    const result = await analyze(
      'Definir Cursor cur;\n' +
      'cur.AbrirCursor(1);\n'
    );
    const hasArity = result.diagnostics.some((d) => d.id === 'LSP1303');
    expect(hasArity).toBe(true);
    const arityDiag = result.diagnostics.find((d) => d.id === 'LSP1303');
    expect(arityDiag?.message).toBe('Quantidade de parâmetros inválida em AbrirCursor: esperado 0, recebido 1');
    expect(arityDiag?.conceptualFamily).toBe('invalid_parameter_count');
  });

  it('keeps the invalid-parameter-count family aligned across semantic contexts', async () => {
    const result = await analyze(
      'Definir Cursor cur;\n'
      + 'Definir Lista lst;\n'
      + 'Definir Funcao Soma(Numero a, Numero b);\n'
      + 'cur.AbrirCursor(1);\n'
      + 'lst.AdicionarCampo();\n'
      + 'Soma(1);\n'
      + 'ConverteMascara(1, 0, "x");\n'
    );

    expect(result.diagnostics.find((d) => d.id === 'LSP1303')).toMatchObject({
      message: 'Quantidade de parâmetros inválida em AbrirCursor: esperado 0, recebido 1',
      conceptualFamily: 'invalid_parameter_count'
    });
    expect(result.diagnostics.find((d) => d.id === 'LSP1417')).toMatchObject({
      message: 'Quantidade de parâmetros inválida em AdicionarCampo: esperado 2-3, recebido 0',
      conceptualFamily: 'invalid_parameter_count'
    });
    expect(result.diagnostics.find((d) => d.id === 'LSP1401')).toMatchObject({
      message: 'Quantidade de parâmetros inválida em Soma: esperado 2, recebido 1',
      conceptualFamily: 'invalid_parameter_count'
    });
    expect(result.diagnostics.find((d) => d.id === 'LSP1410')).toMatchObject({
      message: 'Quantidade de parâmetros inválida em ConverteMascara: esperado 4, recebido 3',
      conceptualFamily: 'invalid_parameter_count'
    });
  });

  it('adds Lista.AdicionarCampo as field', async () => {
    const result = await analyze(
      'Definir Lista lst;\n'
      + 'lst.AdicionarCampo("Campo1", Alfa);\n'
      + 'lst.Campo1 = "ok";\n'
    );
    const errors = result.diagnostics.filter((d) => d.severity === 'Error');
    expect(errors.length).toBe(0);
  });

  it('warns when END param is never assigned', async () => {
    const result = await analyze(
      'Definir Funcao fTeste(Numero End pRet);\n'
      + 'Funcao fTeste(Numero End pRet);\n'
      + 'Inicio\n'
      + '  pRet = 1;\n'
      + 'Fim;\n'
      + 'Definir Funcao fTeste2(Numero End pRet2);\n'
      + 'Funcao fTeste2(Numero End pRet2);\n'
      + 'Inicio\n'
      + '  n = 1;\n'
      + 'Fim;\n'
    );
    const hasWarning = result.diagnostics.some((d) => d.id === 'LSP1202');
    expect(hasWarning).toBe(true);
  });

  it('errors when function has more than 15 params', async () => {
    const params = Array.from({ length: 16 }, (_, i) => `Numero p${i + 1}`).join(', ');
    const result = await analyze(`Definir Funcao fTeste(${params});\n`);
    const hasError = result.diagnostics.some((d) => d.id === 'LSP1104' && d.severity === 'Error');
    expect(hasError).toBe(true);
  });

  it('does not classify Pare/Continue as variables', async () => {
    const result = await analyze(
      'Pare;\n'
      + 'Continue;\n'
    );
    const hasUnknownVariable = result.diagnostics.some((d) => d.id === 'LSP1001');
    const hasUnusedVariable = result.diagnostics.some((d) => d.id === 'LSP1203');
    expect(hasUnknownVariable).toBe(false);
    expect(hasUnusedVariable).toBe(false);
  });

  it('validates ConverteMascara by Tipo_Dado rules', async () => {
    const okNumero = await analyze(
      'Definir Numero n;\n'
      + 'Definir Alfa a;\n'
      + 'ConverteMascara(1, n, a, "999");\n'
      + 'ConverteMascara(2, n, a, "999");\n'
      + 'ConverteMascara(4, n, a, "999");\n'
    );
    expect(okNumero.diagnostics.filter((d) => d.severity === 'Error').length).toBe(0);

    const okData = await analyze(
      'Definir Data d;\n'
      + 'Definir Alfa a;\n'
      + 'ConverteMascara(3, d, a, "DD/MM/YYYY");\n'
    );
    expect(okData.diagnostics.filter((d) => d.severity === 'Error').length).toBe(0);

    const okZero = await analyze(
      'Definir Alfa a;\n'
      + 'ConverteMascara(5, 0, a, "");\n'
    );
    expect(okZero.diagnostics.filter((d) => d.severity === 'Error').length).toBe(0);

    const okTipo3Numero = await analyze(
      'Definir Numero n;\n'
      + 'Definir Alfa a;\n'
      + 'ConverteMascara(3, n, a, "DD/MM/YYYY");\n'
    );
    expect(okTipo3Numero.diagnostics.filter((d) => d.severity === 'Error').length).toBe(0);

    const badZero = await analyze(
      'Definir Alfa a;\n'
      + 'ConverteMascara(5, 1, a, "");\n'
    );
    expect(badZero.diagnostics.some((d) => d.id === 'LSP1416' && d.severity === 'Error')).toBe(true);

    const badEnd = await analyze(
      'Definir Numero n;\n'
      + 'ConverteMascara(1, n, "abc", "999");\n'
    );
    expect(badEnd.diagnostics.some((d) => d.id === 'LSP1413' && d.severity === 'Error')).toBe(true);
  });

  it('requires variable for END parameters in internal and custom calls', async () => {
    const internalBad = await analyze(
      'Definir Alfa aCpoAux;\n'
      + 'ConverteParaMaiusculo(aCpoAux, "aCpoAux");\n'
    );
    expect(internalBad.diagnostics.some((d) => d.id === 'LSP1419' && d.severity === 'Error')).toBe(true);

    const customBad = await analyze(
      'Definir Funcao fTeste(Alfa End pOut);\n'
      + 'Funcao fTeste(Alfa End pOut);\n'
      + 'Inicio\n'
      + 'Fim;\n'
      + 'fTeste("x");\n'
    );
    expect(customBad.diagnostics.some((d) => d.id === 'LSP1419' && d.severity === 'Error')).toBe(true);
  });

  it('validates Mensagem first parameter against Retorna/Erro/Refaz', async () => {
    const valid = await analyze(
      'Mensagem(Retorna, "ok");\n'
      + 'Mensagem(Erro, "falha");\n'
      + 'Mensagem(Refaz, "refazer");\n'
    );
    expect(valid.diagnostics.some((d) => d.id === 'LSP1422')).toBe(false);

    const invalid = await analyze('Mensagem(Aviso, "x");\n');
    expect(invalid.diagnostics.some((d) => d.id === 'LSP1422' && d.severity === 'Error')).toBe(true);
  });

  it('accepts signed numeric literal in ConverteMascara Tipo_Dado and keeps zero validation strict', async () => {
    const ok = await analyze(
      'Definir Alfa a[10];\n'
      + 'ConverteMascara(-1, 0, a, "999");\n'
    );
    expect(ok.diagnostics.some((d) => d.id === 'LSP1414' || d.id === 'LSP1415' || d.id === 'LSP1416')).toBe(false);

    const invalidZero = await analyze(
      'Definir Alfa a[10];\n'
      + 'ConverteMascara(5, -1, a, "");\n'
    );
    expect(invalidZero.diagnostics.some((d) => d.id === 'LSP1416')).toBe(true);
  });

  it('accepts valid structured table declaration', async () => {
    const result = await analyze(
      'Definir Tabela ve_CodHor[100] = {\n'
      + '  Alfa Nome[30];\n'
      + '  Numero Codigo;\n'
      + '  Data DtRef;\n'
      + '};\n'
    );
    const hasTableError = result.diagnostics.some((d) => d.id.startsWith('LSP15'));
    expect(hasTableError).toBe(false);
  });

  it('validates structured table declaration diagnostics', async () => {
    const result = await analyze(
      'Definir Tabela t[0] = {\n'
      + '  Numero Campo[10];\n'
      + '  Alfa ;\n'
      + '  Lista Campo;\n'
      + '  Data DataNasc[8];\n'
      + '  Alfa Nome[0];\n'
      + '  Alfa Nome[20];\n'
      + '};\n'
    );
    expect(result.diagnostics.some((d) => d.id === 'LSP1501')).toBe(true);
    expect(result.diagnostics.some((d) => d.id === 'LSP1502')).toBe(true);
    expect(result.diagnostics.some((d) => d.id === 'LSP1503')).toBe(true);
    expect(result.diagnostics.some((d) => d.id === 'LSP1504')).toBe(true);
    expect(result.diagnostics.some((d) => d.id === 'LSP1505')).toBe(true);
    expect(result.diagnostics.some((d) => d.id === 'LSP1506')).toBe(true);
  });

  it('rejects empty table declaration', async () => {
    const result = await analyze('Definir Tabela vazia[10] = {\n};\n');
    expect(result.diagnostics.some((d) => d.id === 'LSP1507')).toBe(true);
  });

  it('validates typed assignments on table columns', async () => {
    const result = await analyze(
      'Definir Tabela t[10] = {\n'
      + '  Numero Codigo;\n'
      + '  Alfa Nome[30];\n'
      + '};\n'
      + 't[1].Codigo = "abc";\n'
      + 't[1].Nome = 1;\n'
    );
    const mismatches = result.diagnostics.filter((d) => d.id === 'LSP1006');
    expect(mismatches.length).toBeGreaterThanOrEqual(2);
  });

  it('validates typed assignments on table columns when rhs variable is declared later in the same function scope', async () => {
    const result = await analyze(
      'Definir Funcao f();\n'
      + 'Funcao f();\n'
      + 'Inicio\n'
      + '  Definir Tabela t[10] = {\n'
      + '    Alfa Nome[30];\n'
      + '  };\n'
      + '  t[1].Nome = n;\n'
      + '  Definir Numero n;\n'
      + 'Fim;\n'
    );
    expect(result.diagnostics.some((d) => d.id === 'LSP1006')).toBe(true);
  });

  it('emits diagnostics when table column does not exist', async () => {
    const result = await analyze(
      'Definir Numero n;\n'
      + 'Definir Tabela t[10] = {\n'
      + '  Numero Codigo;\n'
      + '};\n'
      + 'n = t[1].NaoExiste;\n'
      + 't[1].Outro = 1;\n'
    );
    expect(result.diagnostics.some((d) => d.id === 'LSP1508')).toBe(true);
  });

  it('requires indexer when accessing table columns', async () => {
    const result = await analyze(
      'Definir Numero n;\n'
      + 'Definir Tabela t[10] = {\n'
      + '  Numero Codigo;\n'
      + '};\n'
      + 'n = t.Codigo;\n'
      + 't.Codigo = 1;\n'
    );
    const indexRequired = result.diagnostics.filter((d) => d.id === 'LSP1509');
    expect(indexRequired.length).toBeGreaterThanOrEqual(2);
  });


  it('requires Numero-typed index when accessing table columns', async () => {
    const result = await analyze(
      'Definir Alfa idx[10];\n'
      + 'Definir Numero n;\n'
      + 'Definir Tabela t[3] = {\n'
      + '  Numero Codigo;\n'
      + '};\n'
      + 'n = t[idx].Codigo;\n'
    );
    expect(result.diagnostics.some((d) => d.id === 'LSP1510')).toBe(true);
  });

  it('validates literal table index range', async () => {
    const result = await analyze(
      'Definir Numero n;\n'
      + 'Definir Tabela t[3] = {\n'
      + '  Numero Codigo;\n'
      + '};\n'
      + 'n = t[0].Codigo;\n'
      + 'n = t[4].Codigo;\n'
      + 'n = t[-1].Codigo;\n'
    );
    const outOfRange = result.diagnostics.filter((d) => d.id === 'LSP1511');
    expect(outOfRange).toHaveLength(3);
  });
});
