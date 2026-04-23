import { describe, expect, it } from 'vitest';

import { createSourceFile } from '../../src/source/source-file';
import { collectEmbeddedSqlSemanticOccurrences } from '../../src/semantic/embedded-sql-occurrences';
import { parseFiles } from '../../src/parser/parser';
import { analyzeProgramWithSemantics } from '../../src/semantic/analyzer';
import { loadFixture } from '../fixture-loader';
import type { Range } from '../../src/source/types';
import type {
  SemanticOccurrence,
  SemanticTokenModifier,
  SemanticTokenType
} from '../../src/semantic/semantic-tokens';

function findRange(text: string, needle: string, occurrenceIndex = 0): Range {
  let startAt = 0;
  let idx = -1;

  for (let i = 0; i <= occurrenceIndex; i += 1) {
    idx = text.indexOf(needle, startAt);
    if (idx < 0) {
      throw new Error(`Substring not found: ${needle}`);
    }
    startAt = idx + needle.length;
  }

  const before = text.slice(0, idx);
  const lines = before.split(/\r?\n/);
  const line = lines.length - 1;
  const character = lines[lines.length - 1]?.length ?? 0;

  return {
    start: { line, character },
    end: { line, character: character + needle.length }
  };
}

function hasOccurrence(
  occurrences: SemanticOccurrence[],
  range: Range,
  tokenType: SemanticTokenType,
  modifiers: SemanticTokenModifier[] = []
): boolean {
  return occurrences.some((occ) => {
    if (occ.tokenType !== tokenType) return false;
    if (occ.range.start.line !== range.start.line) return false;
    if (occ.range.start.character !== range.start.character) return false;
    if (occ.range.end.line !== range.end.line) return false;
    if (occ.range.end.character !== range.end.character) return false;
    return modifiers.every((mod) => occ.tokenModifiers.includes(mod));
  });
}

describe('semantic tokens', () => {
  it('collects semantic occurrences for key symbols', async () => {
    const programText = loadFixture('semantic-tokens.lsp');
    const source = createSourceFile('/tmp/semantic-tokens.lsp', programText);

    const { program } = parseFiles([source]);
    const result = await analyzeProgramWithSemantics({
      contextId: 'test',
      system: 'HCM',
      program
    });

    const occurrences = result.occurrencesByFile.get(source.path) ?? [];
    expect(occurrences.length).toBeGreaterThan(0);

    expect(hasOccurrence(occurrences, findRange(programText, 'gValor', 0), 'variable', ['declaration'])).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, 'gValor', 1), 'variable')).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, 'lValor'), 'variable', ['declaration'])).toBe(true);

    expect(hasOccurrence(occurrences, findRange(programText, 'fCustom', 0), 'function', ['declaration'])).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, 'fCustom', 1), 'function', ['definition'])).toBe(true);
    // For syntax highlighting we don't distinguish internal vs custom functions.
    expect(hasOccurrence(occurrences, findRange(programText, 'fCustom', 2), 'function')).toBe(true);

    expect(
      hasOccurrence(occurrences, findRange(programText, 'pRet', 0), 'parameter', ['declaration'])
    ).toBe(true);

    // For syntax highlighting we don't distinguish internal vs custom functions.
    expect(hasOccurrence(occurrences, findRange(programText, 'ConverteMascara'), 'function')).toBe(true);

    expect(hasOccurrence(occurrences, findRange(programText, 'AbrirCursor'), 'method', ['defaultLibrary'])).toBe(true);

    expect(hasOccurrence(occurrences, findRange(programText, 'campo1', 1), 'property', ['readonly'])).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, 'Campo1', 1), 'property')).toBe(true);
  });

  it("marca variáveis internas com modifier 'internal' (e readonly quando const)", async () => {
    const programText = loadFixture('internal-variables.lsp');
    const source = createSourceFile('/tmp/internal-variables.lsp', programText);

    const { program } = parseFiles([source]);
    const result = await analyzeProgramWithSemantics({
      contextId: 'test',
      system: 'HCM',
      program
    });

    const occurrences = result.occurrencesByFile.get(source.path) ?? [];
    expect(occurrences.length).toBeGreaterThan(0);

    // Non-const internal variable
    expect(
      hasOccurrence(occurrences, findRange(programText, 'WEB_HTML', 0), 'variable', ['defaultLibrary', 'internal'])
    ).toBe(true);

    // Const internal variable
    expect(
      hasOccurrence(occurrences, findRange(programText, 'cFalso', 0), 'variable', ['defaultLibrary', 'internal', 'readonly'])
    ).toBe(true);
  });

  it('highlights dynamic Lista fields only for string literal references', async () => {
    const programText = [
      'Definir Lista lst;',
      'Definir Alfa aCampo;',
      'aCampo = "Campo1";',
      'lst.AdicionarCampo("Campo1", Alfa);',
      'lst.Chave("Campo1");',
      'lst.Chave(aCampo);'
    ].join('\n');
    const source = createSourceFile('/tmp/lista-dynamic-field.lsp', programText);

    const { program } = parseFiles([source]);
    const result = await analyzeProgramWithSemantics({
      contextId: 'test',
      system: 'HCM',
      program
    });

    const occurrences = result.occurrencesByFile.get(source.path) ?? [];
    expect(hasOccurrence(occurrences, findRange(programText, '"Campo1"', 2), 'property')).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, 'aCampo', 2), 'property')).toBe(false);
  });

  it('does not emit variable semantic token for type identifiers in Lista.AdicionarCampo', async () => {
    const programText = 'Definir Lista lst;\nlst.AdicionarCampo("Arquivo", Alfa);';
    const source = createSourceFile('/tmp/lista-add-field-type-token.lsp', programText);

    const { program } = parseFiles([source]);
    const result = await analyzeProgramWithSemantics({
      contextId: 'test',
      system: 'HCM',
      program
    });

    const occurrences = result.occurrencesByFile.get(source.path) ?? [];
    expect(hasOccurrence(occurrences, findRange(programText, 'Alfa'), 'variable')).toBe(false);
    expect(hasOccurrence(occurrences, findRange(programText, 'Alfa'), 'parameter')).toBe(false);
    expect(hasOccurrence(occurrences, findRange(programText, 'Alfa'), 'property')).toBe(false);
  });


  it('highlights Cursor.SQL as method defaultLibrary', async () => {
    const programText = 'Definir Cursor cur;\ncur.SQL "SELECT campo1 FROM Tabela";';
    const source = createSourceFile('/tmp/cursor-sql-semantic-tokens.lsp', programText);

    const { program } = parseFiles([source]);
    const result = await analyzeProgramWithSemantics({
      contextId: 'test',
      system: 'HCM',
      program
    });

    const occurrences = result.occurrencesByFile.get(source.path) ?? [];
    expect(hasOccurrence(occurrences, findRange(programText, 'SQL'), 'method', ['defaultLibrary'])).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, 'SQL'), 'property', ['defaultLibrary'])).toBe(false);
  });

  it('highlights only the ExecSql keyword as function and preserves the SQL literal', async () => {
    const programText = 'ExecSql "UPDATE r034fun SET s = 1";';
    const source = createSourceFile('/tmp/execsql-semantic-tokens.lsp', programText);

    const { program } = parseFiles([source]);
    const result = await analyzeProgramWithSemantics({
      contextId: 'test',
      system: 'HCM',
      program
    });

    const occurrences = result.occurrencesByFile.get(source.path) ?? [];
    expect(hasOccurrence(occurrences, findRange(programText, 'ExecSql'), 'function')).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, '"UPDATE r034fun SET s = 1"'), 'function')).toBe(false);
  });

  it('highlights eligible embedded SQL literals as semantic string tokens', async () => {
    const programText = [
      'Definir Cursor cur;',
      'cur.SQL "SELECT campo1 FROM Tabela WHERE campo2=:valor";',
      'ExecSQLEx("UPDATE Tabela SET campo1=1 WHERE campo2=:valor", nOk, aErro);',
      'SQL_DefinirComando(cur, "DELETE FROM Tabela WHERE campo3=:valor");'
    ].join('\n');
    const source = createSourceFile('/tmp/embedded-sql-semantic-tokens.lsp', programText);

    const { program } = parseFiles([source]);
    const result = await analyzeProgramWithSemantics({
      contextId: 'test',
      system: 'HCM',
      program
    });

    const occurrences = result.occurrencesByFile.get(source.path) ?? [];
    expect(
      hasOccurrence(occurrences, findRange(programText, '"SELECT campo1 FROM Tabela WHERE campo2=:valor"'), 'string', ['defaultLibrary', 'readonly'])
    ).toBe(true);
    expect(
      hasOccurrence(occurrences, findRange(programText, '"UPDATE Tabela SET campo1=1 WHERE campo2=:valor"'), 'string', ['defaultLibrary', 'readonly'])
    ).toBe(true);
    expect(
      hasOccurrence(occurrences, findRange(programText, '"DELETE FROM Tabela WHERE campo3=:valor"'), 'string', ['defaultLibrary', 'readonly'])
    ).toBe(true);
  });


  it('collects controlled lexical semantic occurrences inside eligible embedded SQL literals', () => {
    const programText = [
      'ExecSql "SELECT Decode(Tabela.Campo, :pValor, \'ES\', \'OUTRO\') FROM Tabela WHERE Tabela.Id = 1 AND Tabela.Masc = \'YYYY-MM-DD\\"T\\"hh24:mi:ss\'";'
    ].join('');
    const occurrences = collectEmbeddedSqlSemanticOccurrences({
      sourcePath: '/tmp/embedded-sql-lexical-highlight.lsp',
      text: programText,
      dialect: 'oracle'
    });

    expect(hasOccurrence(occurrences, findRange(programText, 'SELECT'), 'keyword', ['defaultLibrary'])).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, 'FROM'), 'keyword', ['defaultLibrary'])).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, 'WHERE'), 'keyword', ['defaultLibrary'])).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, 'Decode'), 'function', ['defaultLibrary'])).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, 'Campo'), 'property')).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, ':pValor'), 'parameter', ['defaultLibrary', 'readonly'])).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, "'ES'"), 'string', ['defaultLibrary'])).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, '='), 'keyword', ['defaultLibrary'])).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, '('), 'keyword', ['defaultLibrary'])).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, '1'), 'number', ['defaultLibrary'])).toBe(true);
    expect(occurrences.some((occ) =>
      occ.tokenType === 'parameter'
      && occ.range.start.line === findRange(programText, ':mi').start.line
      && occ.range.start.character === findRange(programText, ':mi').start.character
    )).toBe(false);
    expect(occurrences.some((occ) =>
      occ.tokenType === 'parameter'
      && occ.range.start.line === findRange(programText, ':ss').start.line
      && occ.range.start.character === findRange(programText, ':ss').start.character
    )).toBe(false);
  });


  it('highlights bare SQL identifiers with the same semantic category used for qualified SQL members', () => {
    const programText = [
      'SQL_DefinirComando(cAuxiliar, "Select Distinct USU_NumSHE, x.USU_DatSol \\',
      '                               From USU_TAEMDSH x \\',
      '                               Where x.USU_NumSHE = :nNumSol");'
    ].join('\n');

    const occurrences = collectEmbeddedSqlSemanticOccurrences({
      sourcePath: '/tmp/embedded-sql-bare-identifiers.lsp',
      text: programText,
      dialect: 'oracle'
    });

    expect(hasOccurrence(occurrences, findRange(programText, 'USU_NumSHE'), 'property')).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, 'USU_DatSol'), 'property')).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, 'USU_TAEMDSH'), 'property')).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, ':nNumSol'), 'parameter', ['defaultLibrary', 'readonly'])).toBe(true);
  });

  it('collects synthetic semantic occurrences for SQL reconstruído em variável estática multiline', () => {
    const programText = [
      'Definir Alfa aSQL;',
      'aSQL = "SELECT  * \\',
      '        FROM  Tabela \\',
      '        WHERE  Campo1 = :aOperacao \\',
      '        AND Campo2 = \'Valor2\'";',
      'SQL_DefinirComando(cPesquisa, aSQL);'
    ].join('\n');
    const occurrences = collectEmbeddedSqlSemanticOccurrences({
      sourcePath: '/tmp/embedded-sql-variable-highlight.lsp',
      text: programText
    });
    expect(
      occurrences.some((occ) =>
        occ.tokenType === 'string'
        && occ.tokenModifiers.includes('defaultLibrary')
        && occ.tokenModifiers.includes('readonly')
        && occ.embeddedSql?.sourceKind === 'variable_static'
      )
    ).toBe(true);
  });

  it('collects synthetic semantic occurrences for SQL com prefixo válido e fragmento dinâmico no sufixo', () => {
    const programText = [
      'Definir Alfa aSQL;',
      'Definir Alfa aFiltro;',
      'aSQL = "SELECT campo1 FROM Tabela WHERE campo2 = :valor" + aFiltro;',
      'SQL_DefinirComando(cPesquisa, aSQL);'
    ].join('\n');
    const occurrences = collectEmbeddedSqlSemanticOccurrences({
      sourcePath: '/tmp/embedded-sql-variable-prefixed-fragment-highlight.lsp',
      text: programText
    });
    expect(
      occurrences.some((occ) =>
        occ.tokenType === 'string'
        && occ.tokenModifiers.includes('defaultLibrary')
        && occ.tokenModifiers.includes('readonly')
        && occ.embeddedSql?.sourceKind === 'variable_prefixed_dynamic_fragment'
      )
    ).toBe(true);
  });

  it('collects semantic occurrences for pragma consulta with incremental SQL rebuild', () => {
    const programText = [
      '@lsp-sql-consulta@',
      'Definir Alfa aSQL;',
      'aSQL = "Select 0 CodErs From USU_TAEMSAM a Where a.USU_NumEmp = :nNumEmp ";',
      'aSQL = aSQL + " And USU_CodWkf in (" + aCodWkf + ") ";',
      'SQL_DefinirComando(cPesquisa, aSQL);'
    ].join('\n');

    const occurrences = collectEmbeddedSqlSemanticOccurrences({
      sourcePath: '/tmp/embedded-sql-pragma-consulta-highlight.lsp',
      text: programText
    });

    expect(
      occurrences.some((occ) =>
        occ.tokenType === 'string'
        && occ.tokenModifiers.includes('defaultLibrary')
        && occ.tokenModifiers.includes('readonly')
        && occ.embeddedSql?.sourceKind === 'variable_pragma_consulta'
        && occ.range.start.line === 2
      )
    ).toBe(true);
    expect(
      occurrences.some((occ) =>
        occ.tokenType === 'string'
        && occ.tokenModifiers.includes('defaultLibrary')
        && occ.tokenModifiers.includes('readonly')
        && occ.embeddedSql?.sourceKind === 'variable_pragma_consulta'
        && occ.range.start.line === 3
      )
    ).toBe(true);
  });

  it('collects semantic occurrences for pragma fragment dependencies used by final SQL variable', () => {
    const programText = [
      '@lsp-sql-fragmento@',
      'Definir Alfa aFiltro;',
      '@lsp-sql-fragmento@',
      'Definir Alfa aCriterioNumCad;',
      'Definir Alfa aSQL;',
      'aFiltro = "";',
      'aCriterioNumCad = "";',
      'aCriterioNumCad = aCriterioNumCad + " and R034Fun.NumCad like \'%\'" + aCriterio + "\'%\'";',
      'aFiltro = aFiltro + " and (" + aCriterioNumCad + ")";',
      'aSQL = "Select NumEmp From R034Fun Where 1 = 1 " + aFiltro;',
      'SQL_DefinirComando(cPesquisa, aSQL);'
    ].join('\n');

    const occurrences = collectEmbeddedSqlSemanticOccurrences({
      sourcePath: '/tmp/embedded-sql-pragma-fragment-dependency-highlight.lsp',
      text: programText
    });

    expect(
      occurrences.some((occ) =>
        occ.tokenType === 'string'
        && occ.tokenModifiers.includes('defaultLibrary')
        && occ.tokenModifiers.includes('readonly')
        && occ.embeddedSql?.sourceKind === 'variable_prefixed_dynamic_fragment'
        && occ.range.start.line === 7
      )
    ).toBe(true);
    expect(
      occurrences.some((occ) =>
        occ.tokenType === 'string'
        && occ.tokenModifiers.includes('defaultLibrary')
        && occ.tokenModifiers.includes('readonly')
        && occ.embeddedSql?.sourceKind === 'variable_prefixed_dynamic_fragment'
        && occ.range.start.line === 8
      )
    ).toBe(true);
  });

  it('collects semantic occurrences for multiple fragment variables propagated through the same host SQL variable', () => {
    const programText = [
      'Definir Alfa aFiltro;',
      'Definir Alfa aCriterioNumCad;',
      'Definir Alfa aCriterioNomFun;',
      'Definir Alfa aCriterioEmaCom;',
      'aFiltro = "";',
      'aCriterioNumCad = "";',
      'aCriterioNomFun = "";',
      'aCriterioEmaCom = "";',
      'aCriterioNumCad = aCriterioNumCad + " and R034Fun.NumCad like \'%\'" + aCriterio + "\'%\'";',
      'aCriterioNomFun = aCriterioNomFun + " and Upper(R034Fun.NomFun) like upper(\'%\'" + aCriterio + "\'%\')";',
      'aCriterioEmaCom = aCriterioEmaCom + " and Upper(Substr(R034Cpl.EmaCom, 0, instr(R034Cpl.EmaCom, \'@\')-1)) like upper(\'%\'" + aCriterio + "\'%\')";',
      'aFiltro = aFiltro + " and (" + aCriterioNumCad + " or " + aCriterioNomFun + " or " + aCriterioEmaCom + ")";',
      'aSQL = "Select NumEmp From R034Fun Where 1 = 1 " + aFiltro;',
      'SQL_DefinirComando(cPesquisa, aSQL);'
    ].join('\n');

    const occurrences = collectEmbeddedSqlSemanticOccurrences({
      sourcePath: '/tmp/embedded-sql-multi-fragment-propagation-highlight.lsp',
      text: programText,
      dialect: 'oracle'
    });

    expect(
      occurrences.some((occ) =>
        occ.tokenType === 'string'
        && occ.tokenModifiers.includes('defaultLibrary')
        && occ.tokenModifiers.includes('readonly')
        && occ.embeddedSql?.sourceKind === 'variable_prefixed_dynamic_fragment'
        && occ.range.start.line === 8
      )
    ).toBe(true);
    expect(
      occurrences.some((occ) =>
        occ.tokenType === 'string'
        && occ.tokenModifiers.includes('defaultLibrary')
        && occ.tokenModifiers.includes('readonly')
        && occ.embeddedSql?.sourceKind === 'variable_prefixed_dynamic_fragment'
        && occ.range.start.line === 9
      )
    ).toBe(true);
    expect(
      occurrences.some((occ) =>
        occ.tokenType === 'string'
        && occ.tokenModifiers.includes('defaultLibrary')
        && occ.tokenModifiers.includes('readonly')
        && occ.embeddedSql?.sourceKind === 'variable_prefixed_dynamic_fragment'
        && occ.range.start.line === 10
      )
    ).toBe(true);
  });

  it('collects semantic occurrences for pragma fragment variables propagated through repeated host assignments', () => {
    const programText = [
      '@lsp-sql-fragmento@',
      'Definir Alfa aCriterioNomFun;',
      '@lsp-sql-fragmento@',
      'Definir Alfa aCriterioUsuRed;',
      'Definir Alfa aFiltro;',
      'Definir Alfa aSQL;',
      'aFiltro = "";',
      'aCriterioNomFun = aCriterioNomFun + " and Upper(R034Fun.NomFun) like upper(\'%\'" + aCriterio + "\'%\')";',
      'aCriterioUsuRed = aCriterioUsuRed + " and Upper(R910Ent.NomEnt) like upper(\'%\'" + aCriterio + "\'%\')";',
      'aFiltro = aFiltro + " and (" + aCriterioNomFun + " or " + aCriterioUsuRed + ")";',
      'aSQL = "Select NumEmp From R034Fun Where 1 = 1 ";',
      'aSQL = aSQL + aFiltro;',
      'SQL_DefinirComando(cPesquisa, aSQL);'
    ].join('\n');

    const occurrences = collectEmbeddedSqlSemanticOccurrences({
      sourcePath: '/tmp/embedded-sql-pragma-fragment-propagation-highlight.lsp',
      text: programText,
      dialect: 'oracle'
    });

    expect(
      occurrences.some((occ) =>
        occ.tokenType === 'string'
        && occ.tokenModifiers.includes('defaultLibrary')
        && occ.tokenModifiers.includes('readonly')
        && occ.embeddedSql?.sourceKind === 'variable_pragma_fragmento'
        && occ.range.start.line === 7
      )
    ).toBe(true);
    expect(
      occurrences.some((occ) =>
        occ.tokenType === 'string'
        && occ.tokenModifiers.includes('defaultLibrary')
        && occ.tokenModifiers.includes('readonly')
        && occ.embeddedSql?.sourceKind === 'variable_pragma_fragmento'
        && occ.range.start.line === 8
      )
    ).toBe(true);
  });


  it('collects synthetic semantic occurrences for variable that is sql or empty and narrowed by guard', () => {
    const programText = [
      'Definir Alfa aSQL;',
      'aSQL = "";',
      'Se (nCont = 1)',
      'Inicio',
      '  aSQL = "SELECT campo1 FROM Tabela WHERE campo2 = :valor";',
      'Fim;',
      'Se (aSQL <> "")',
      'Inicio',
      '  SQL_DefinirComando(cPesquisa, aSQL);',
      'Fim;'
    ].join('\n');
    const occurrences = collectEmbeddedSqlSemanticOccurrences({
      sourcePath: '/tmp/embedded-sql-variable-sql-or-empty-highlight.lsp',
      text: programText
    });
    expect(
      occurrences.some((occ) =>
        occ.tokenType === 'string'
        && occ.tokenModifiers.includes('defaultLibrary')
        && occ.tokenModifiers.includes('readonly')
        && occ.embeddedSql?.sourceKind === 'variable_static'
      )
    ).toBe(true);
  });

  it('does not differentiate custom variables by scope for syntax highlighting', async () => {
    const programText = [
      'Definir Numero gValor;',
      'Funcao Teste()',
      'Inicio',
      '  Definir Numero lValor;',
      '  gValor = 1;',
      '  lValor = 2;',
      'Fim;'
    ].join('\n');
    const source = createSourceFile('/tmp/custom-variable-scope-equality.lsp', programText);

    const { program } = parseFiles([source]);
    const result = await analyzeProgramWithSemantics({
      contextId: 'test',
      system: 'HCM',
      program
    });

    const occurrences = result.occurrencesByFile.get(source.path) ?? [];
    expect(hasOccurrence(occurrences, findRange(programText, 'gValor', 1), 'variable', ['static'])).toBe(false);
    expect(hasOccurrence(occurrences, findRange(programText, 'lValor', 1), 'variable', ['static'])).toBe(false);
    expect(hasOccurrence(occurrences, findRange(programText, 'gValor', 1), 'variable')).toBe(true);
    expect(hasOccurrence(occurrences, findRange(programText, 'lValor', 1), 'variable')).toBe(true);
  });


  it('collects synthetic semantic occurrences for SQL com fragmento estrutural no meio', () => {
    const programText = [
      'Definir Alfa aFiltro;',
      'Definir Alfa aSQL;',
      'aFiltro = "";',
      'Para (nIdx=1; nIdx<3; nIdx++)',
      'Inicio',
      '  aFiltro = aFiltro + " Or (b.Emp = " + aNumEmp + " And b.Tip = " + aTipCol + ")";',
      'Fim;',
      'aSQL = "Select a.Campo1,a.Campo2 " +',
      '       " From Tabela a, Outra b " +',
      '       " Where a.Id = b.Id " +',
      '       " And (1 = 2 " + aFiltro + ") " +',
      '       " Order By a.Campo1";',
      'SQL_DefinirComando(cPesquisa, aSQL);'
    ].join('\n');

    const occurrences = collectEmbeddedSqlSemanticOccurrences({
      sourcePath: '/tmp/embedded-sql-structural-fragment.lsp',
      text: programText
    });

    expect(
      hasOccurrence(occurrences, findRange(programText, '"Select a.Campo1,a.Campo2 "'), 'string', ['defaultLibrary', 'readonly'])
    ).toBe(true);
  });

  it('collects synthetic semantic occurrences for SQL com fragmento estrutural direto no meio (TR705 carga por colaborador)', () => {
    const programText = [
      'Definir Alfa aSQL;',
      'Definir Alfa aCriterioNumCad;',
      'aCriterioNumCad = " Or (NumEmp = " + nNumEmp + " And TipCol = " + nTipCol + " And NumCad = " + nNumCad + ")";',
      'aSQL = " Select NumEmp, TipCol, NumCad " +',
      '       " From R034Fun " +',
      '       " Where (1 = 2 " + aCriterioNumCad + ") " +',
      '       " Order By NumCad";',
      'SQL_DefinirComando(cPesquisa, aSQL);'
    ].join('\n');

    const occurrences = collectEmbeddedSqlSemanticOccurrences({
      sourcePath: '/tmp/embedded-sql-tr705-numcad-middle.lsp',
      text: programText
    });

    expect(
      hasOccurrence(occurrences, findRange(programText, '" Select NumEmp, TipCol, NumCad "'), 'string', ['defaultLibrary', 'readonly'])
    ).toBe(true);
    expect(
      hasOccurrence(occurrences, findRange(programText, '" Order By NumCad"'), 'string', ['defaultLibrary', 'readonly'])
    ).toBe(true);
  });

  it('collects semantic occurrences for direct-consumed structural fragment variable without separate trusted root', () => {
    const programText = [
      'Definir Alfa aFiltro;',
      'Definir Alfa aCriterioISeSol;',
      'Definir Alfa aCriterioNumDoc;',
      'Definir Alfa aCriterioNomVis;',
      'aFiltro = "";',
      'aFiltro = aFiltro + " and (" +',
      '        aCriterioISeSol +',
      '        " or " + aCriterioNumDoc +',
      '        " or " + aCriterioNomVis +',
      '        ")";',
      'SQL_DefinirComando(cPesquisa, aFiltro);'
    ].join('\n');

    const occurrences = collectEmbeddedSqlSemanticOccurrences({
      sourcePath: '/tmp/embedded-sql-direct-fragment-variable-highlight.lsp',
      text: programText
    });

    expect(
      hasOccurrence(occurrences, findRange(programText, '" and ("'), 'string', ['defaultLibrary', 'readonly'])
    ).toBe(true);
  });

  it('collects semantic occurrences for direct-consumed fragment variable with order by continuation after trusted root', () => {
    const programText = [
      'Definir Alfa aFiltro;',
      'aFiltro = " Where 1 = 1 ";',
      'aFiltro = aFiltro + " Order By NumCad";',
      'SQL_DefinirComando(cPesquisa, aFiltro);'
    ].join('\n');

    const occurrences = collectEmbeddedSqlSemanticOccurrences({
      sourcePath: '/tmp/embedded-sql-fragment-order-by-highlight.lsp',
      text: programText
    });

    expect(
      hasOccurrence(occurrences, findRange(programText, '" Where 1 = 1 "'), 'string', ['defaultLibrary', 'readonly'])
    ).toBe(true);
    expect(
      hasOccurrence(occurrences, findRange(programText, '" Order By NumCad"'), 'string', ['defaultLibrary', 'readonly'])
    ).toBe(true);
  });

  it('does not collect semantic occurrences for direct-consumed common text variable', () => {
    const programText = [
      'Definir Alfa aFiltro;',
      'aFiltro = "texto comum";',
      'SQL_DefinirComando(cPesquisa, aFiltro);'
    ].join('\n');

    const occurrences = collectEmbeddedSqlSemanticOccurrences({
      sourcePath: '/tmp/embedded-sql-direct-common-text-highlight.lsp',
      text: programText
    });

    expect(
      hasOccurrence(occurrences, findRange(programText, '"texto comum"'), 'string', ['defaultLibrary', 'readonly'])
    ).toBe(false);
  });

});
