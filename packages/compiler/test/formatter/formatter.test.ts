import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { formatDocumentWithDetails, formatLspText, formatText } from '../../src';
import { tokenize } from '../../src/lexer/tokenizer';
import { createSourceFile } from '../../src/source/source-file';
import { loadFixture } from '../fixture-loader';

const options = {
  indentSize: 2,
  useTabs: false,
  maxParamsPerLine: 4,
  embeddedSqlEnabled: false as const,
  embeddedSqlDialect: 'sql' as const
};

function protectedTokens(text: string): string[]
{
  const source = createSourceFile('<test>', text);
  const { tokens } = tokenize(source);
  return tokens
    .filter((t) => t.type === 'String' || t.type === 'CommentLine' || t.type === 'CommentBlock')
    .map((t) => t.value);
}

function detectEol(text: string): '\r\n' | '\n'
{
  return text.includes('\r\n') ? '\r\n' : '\n';
}

describe('formatter', () =>
{
  const cases = [
    'inicio-fim',
    'se-senao',
    'para-enquanto',
    'comentarios',
    'strings',
    'braces',
    'sql-concat-linecomment'
  ];

  it.each(cases)('formats %s fixture', (name) =>
  {
    const input = loadFixture(`formatter/input/${name}.lspt`);
    const expected = loadFixture(`formatter/expected/${name}.lspt`);
    const result = formatLspText({ text: input, options });
    expect(result.text).toBe(expected);
  });

  it('eh deterministico em 20 execucoes', () =>
  {
    const input = loadFixture('formatter/input/comentarios.lspt');
    const baseline = formatText({ text: input, options }).text;
    for (let i = 0; i < 20; i += 1)
    {
      const current = formatText({ text: input, options }).text;
      expect(current).toBe(baseline);
    }
  });

  it('preserva comentarios', () =>
  {
    const input = '/* bloco */\n@ linha @\nDefinir Numero n;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('/* bloco */');
    expect(result).toContain('@ linha @');
  });

  it('nao cresce linhas em branco apos comentario de bloco', () =>
  {
    const input = '/* bloco */\nDefinir Numero n;\n';
    const once = formatText({ text: input, options }).text;
    const twice = formatText({ text: once, options }).text;
    expect(twice).toBe(once);
    expect(once).not.toContain('\n\nDefinir');
  });

  it('preserva uma linha em branco apos comentario de bloco quando existe no original', () =>
  {
    const input = '/* header */\n\nDefinir Numero n;\n';
    const result = formatText({ text: input, options }).text;
    // deve manter exatamente uma linha em branco (2 quebras) entre o comentario e o codigo
    expect(result).toContain('/* header */\n\nDefinir');
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it('mantem multiplos statements na mesma linha quando o original estava assim', () =>
  {
    const input = 'Definir Numero n; n = 4; @-- ESA --@\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Definir Numero n; n = 4; @-- ESA --@\n');
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it('nao remove quebra de linha apos comentario de linha inline', () =>
{
  const input =
    'DeletarAlfa(aSindicatos, 1, 1);  @-- Apagar a primeira virgula (PATCH_V16) --@' +
    'aRetornoDados = aRetornoDados + ","sindicatos":[" + aSindicatos + "]";';

  const result = formatText({ text: input, options }).text;

  // Deve manter a quebra de linha entre o comentario e o próximo statement.
  expect(result).toContain('@-- Apagar a primeira virgula (PATCH_V16) --@');
  expect(result).toContain('aRetornoDados = aRetornoDados');
  expect(formatText({ text: result, options }).text).toBe(result);
});

  it('indenta single-statement em Se(cond) sem Inicio/Fim', () =>
  {
    const input = 'Definir Numero n;\nSe(n=1)\nn=1;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Se (n = 1)\n');
    expect(result).toContain('\n  n = 1;\n');
  });

  it("forca 'Se' a iniciar em nova linha quando vem apos outro statement", () =>
  {
    const input = 'Definir Numero n; Se(n=1) n=1;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Definir Numero n;\nSe (n = 1)\n  n = 1;\n');
    expect(result).not.toContain('; Se (');
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it('indenta single-statement em Senao quando nao ha Inicio/Fim', () =>
  {
    const input = 'Definir Numero x;\nSe(x=1)\n  x=10;\nSenao\nx=20;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Senao\n  x = 20;\n');
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it('nao adiciona indent extra em Senao seguido de Se (else-if) com Inicio/Fim', () =>
  {
    const input =
      'Se(x=1)\n' +
      'Inicio\n' +
      'a=1;\n' +
      'Fim;\n' +
      'Senao\n' +
      'Se(x=2)\n' +
      'Inicio\n' +
      'a=2;\n' +
      'Fim;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Senao\nSe (x = 2)\nInicio\n  a = 2;\nFim;\n');
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it('nao adiciona indent extra em Senao seguido de Se (else-if) com single-statement', () =>
  {
    const input = 'Se(x=1)\na=1;\nSenao\nSe(x=2)\na=2;\nSenao\na=0;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Senao\nSe (x = 2)\n  a = 2;\nSenao\n  a = 0;\n');
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it('mantem comentario de linha apos keywords Inicio/Senao na mesma linha', () =>
  {
    const input =
      'Definir Numero x;\n' +
      'Se(x=1)\n' +
      'Inicio @-- bloco principal --@\n' +
      'x=1;\n' +
      'Fim;\n' +
      'Senao @-- caminho alternativo --@\n' +
      'Inicio @-- bloco alternativo --@\n' +
      'x=2;\n' +
      'Fim;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Inicio @-- bloco principal --@\n');
    expect(result).toContain('Senao @-- caminho alternativo --@\n');
    expect(result).toContain('Inicio @-- bloco alternativo --@\n');
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it('preserva a quantidade de linhas em branco definida pelo usuario', () =>
  {
    const input =
      'Definir Numero x;\n' +
      'Se(x=1)\n' +
      'Inicio\n' +
      'x=1;\n' +
      '\n' +
      'x=2;\n' +
      '\n' +
      '\n' +
      'x=3;\n' +
      'Fim;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('x = 1;\n\n  x = 2;\n\n\n  x = 3;\n');
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it('formata SQL embutido em ExecSql quando a feature esta habilitada', () =>
  {
    const input = 'ExecSql "SELECT campo1,campo2 FROM Tabela WHERE campo3=1";\n';
    const result = formatText({
      text: input,
      options: { ...options, embeddedSqlEnabled: true }
    }).text;
    expect(result).toContain('ExecSql "SELECT \\');
    expect(result).toMatch(/\n\s*campo1,\s*\\/);
    expect(result).toMatch(/\n\s*FROM\s*\\/);
    expect(formatText({
      text: result,
      options: { ...options, embeddedSqlEnabled: true }
    }).text).toBe(result);
  });

  it('formata SQL embutido em Cursor.SQL e SQL_DefinirComando quando habilitado', () =>
  {
    const input = [
      'Definir Cursor cur;',
      'cur.SQL "SELECT campo1,campo2 FROM Tabela WHERE campo3=:valor";',
      'SQL_DefinirComando(cur, "UPDATE Tabela SET campo1=1 WHERE campo2=:valor");'
    ].join('\n');
    const result = formatText({
      text: input,
      options: { ...options, embeddedSqlEnabled: true }
    }).text;
    expect(result).toContain('cur.SQL "SELECT \\');
    expect(result).toContain('SQL_DefinirComando(cur, "UPDATE Tabela \\');
  });

  it('mantem SQL embutido inalterado quando a feature esta desligada ou o trecho nao e seguro', () =>
  {
    const disabledDetails = formatDocumentWithDetails({
      sourcePath: '/tmp/disabled.lsp',
      text: 'ExecSql "SELECT campo1,campo2 FROM Tabela";\n',
      options: { ...options, embeddedSqlEnabled: false }
    });
    expect(disabledDetails.text).toBe('ExecSql "SELECT campo1,campo2 FROM Tabela";\n');
    expect(disabledDetails.report.embeddedSql).toEqual({
      enabled: false,
      attempts: [],
      attemptedCount: 0,
      eligibleCount: 0,
      appliedCount: 0,
      noOpCount: 0,
      rejectedCount: 0,
      errorCount: 0,
      debug: { events: [], eventCount: 0 }
    });

    const unsafe = formatText({
      text: 'ExecSql "BEGIN SELECT campo1 FROM Tabela; END";\n',
      options: { ...options, embeddedSqlEnabled: true }
    }).text;
    expect(unsafe).toBe('ExecSql "BEGIN SELECT campo1 FROM Tabela; END";\n');
  });

  it('formata concatenação estática direta em wrappers autorizados', () =>
  {
    const input = [
      'Definir Cursor cur;',
      'cur.SQL "SELECT campo1, " + "campo2 FROM Tabela WHERE campo3=:valor";',
      'ExecSQLEx("UPDATE Tabela " + "SET campo1=1 WHERE campo2=:valor", nOk, aErro);'
    ].join('\n');
    const result = formatText({
      text: input,
      options: { ...options, embeddedSqlEnabled: true }
    }).text;
    expect(result).toContain('cur.SQL "SELECT \\');
    expect(result).toContain('ExecSQLEx("UPDATE Tabela \\');
  });

  it('formata SQL_DefinirComando com variável reconstruível no mesmo bloco', () =>
  {
    const input = [
      'Definir Cursor cur;',
      'Definir Alfa aSql;',
      'aSql = "SELECT campo1, " + "campo2 FROM Tabela WHERE campo3=:valor";',
      'SQL_DefinirComando(cur, aSql);'
    ].join('\n');
    const result = formatText({
      text: input,
      options: { ...options, embeddedSqlEnabled: true }
    }).text;
    expect(result).toContain('aSql = "SELECT \\');
    expect(result).toContain('campo3 = :valor";');
    expect(result).toContain('SQL_DefinirComando(cur, aSql);');
  });

  it('preserva continuação multiline ao formatar SQL_DefinirComando com variável estática', () =>
  {
    const input = [
      'Definir Alfa aSQL;',
      '',
      'aSQL = "SELECT  * \\',
      '        FROM  Tabela \\',
      '        WHERE  Campo1 = :aOperacao \\',
      '        AND Campo2 = \'Valor2\'";',
      '',
      'SQL_DefinirComando(cPesquisa, aSQL);'
    ].join('\n');
    const result = formatText({
      text: input,
      options: { ...options, embeddedSqlEnabled: true }
    }).text;
    expect(result).toContain('aSQL = "SELECT');
    expect(result).toMatch(/\n\s+\* \\/);
    expect(result).toMatch(/\n\s+FROM \\/);
    expect(result).toMatch(/\n\s+Tabela \\/);
    expect(result).toMatch(/\n\s+WHERE \\/);
    expect(result).toMatch(/\n\s+Campo1 = :aOperacao \\/);
    expect(result).toContain('AND Campo2 = \'Valor2\'";');
    expect(result).toContain('SQL_DefinirComando(cPesquisa, aSQL);');
    expect(formatText({
      text: result,
      options: { ...options, embeddedSqlEnabled: true }
    }).text).toBe(result);
  });

  it('formata SQL_DefinirComando multiline direto com continuação preservada', () =>
  {
    const input = [
      'SQL_DefinirComando(cPesquisa, "Select USU_DatSol, USU_HorIni, USU_SitDSH, \\',
      '                                          count(*) over (partition by USU_SitDSH) QtdSitDSH, \\',
      '                                          JSON_OBJECT( \\',
      '                                            KEY \'datSol\' is to_char(USU_DatSol,\'YYYY-MM-DD\'), \\',
      '                                            KEY \'horIni\' is USU_HorIni, \\',
      '                                            KEY \'horFim\' is USU_HorFim, \\',
      '                                            KEY \'active\' is Decode(USU_SitDSH, 0, \'true\', \'false\') FORMAT JSON \\',
      '                                           ) Texto \\',
      '                                   From USU_TAEMDSH \\',
      '                                   Where USU_NumSHE = :nNumSol \\',
      '                                   Order By USU_NumSHE, USU_DatSol, USU_HorIni \\',
      '                              ");'
    ].join('\n');
    const result = formatText({
      text: input,
      options: { ...options, embeddedSqlEnabled: true }
    }).text;
    expect(result).toContain('SQL_DefinirComando(cPesquisa, "Select \\');
    expect(result).toMatch(/\n\s+USU_DatSol, \\/);
    expect(result).toMatch(/\n\s+count\(\*\) over \( \\/);
    expect(result).toMatch(/\n\s+JSON_OBJECT \( \\/);
    expect(result).toMatch(/\n\s+Where \\/);
    expect(result).toContain(':nNumSol');
    expect(result).toMatch(/\n\s+Order By \\/);
    expect(result).toContain('\\\n');
    expect(formatText({
      text: result,
      options: { ...options, embeddedSqlEnabled: true }
    }).text).toBe(result);
  });


  it('formata concatenação híbrida controlada direta em wrapper autorizado', () =>
  {
    const input = 'ExecSQLEx("SELECT campo1 FROM Tabela WHERE campo2 = " + nValor + " AND campo3 = 1", nOk, aErro);\n';
    const result = formatText({
      text: input,
      options: { ...options, embeddedSqlEnabled: true }
    }).text;
    expect(result).toContain('ExecSQLEx("SELECT \\');
    expect(result).toMatch(/campo2 = "\s*\n\s*\+ nValor\s*\n\s*\+ "/);
    expect(result).toContain('AND campo3 = 1"');
  });

  it('formata SQL_DefinirComando com variável híbrida controlada no mesmo bloco principal', () =>
  {
    const input = [
      'Definir Cursor cur;',
      'Definir Alfa aSql;',
      'aSql = "SELECT campo1 FROM Tabela WHERE campo2 = " + nValor + " AND campo3 = 1";',
      'SQL_DefinirComando(cur, aSql);'
    ].join('\n');
    const result = formatText({
      text: input,
      options: { ...options, embeddedSqlEnabled: true }
    }).text;
    expect(result).toContain('aSql = "SELECT \\');
    expect(result).toMatch(/campo2 = "\s*\n\s*\+ nValor\s*\n\s*\+ "/);
    expect(result).toContain('AND campo3 = 1";');
    expect(result).toContain('SQL_DefinirComando(cur, aSql);');
  });

  it('permite consumo em bloco interno herdando classificação segura do bloco principal', () =>
  {
    const input = [
      'Definir Cursor cur;',
      'Definir Alfa aSql;',
      'aSql = "SELECT campo1 FROM Tabela WHERE campo2 = :valor";',
      'Se (x = 1)',
      'Inicio',
      '  SQL_DefinirComando(cur, aSql);',
      'Fim;'
    ].join('\n');
    const result = formatText({
      text: input,
      options: { ...options, embeddedSqlEnabled: true }
    }).text;
    expect(result).toContain('aSql = "SELECT \\');
    expect(result).toContain('SQL_DefinirComando(cur, aSql);');
  });


  it('classifica variável SQL após merge seguro de Se/Senao com SQL completo em todos os ramos', () =>
  {
    const input = [
      'Definir Cursor cur;',
      'Definir Alfa aFiltro;',
      'Se (nEmp = 26)',
      'Inicio',
      '  aFiltro = "SELECT campo1 FROM Tabela WHERE campo2 = " + nEmp + " AND campo3 = 1";',
      'Fim;',
      'Senao Se (nEmp = 27)',
      'Inicio',
      '  aFiltro = "SELECT campo1 FROM Tabela WHERE campo2 = " + nEmp + " AND campo3 = 2";',
      'Fim;',
      'Senao',
      'Inicio',
      '  aFiltro = "SELECT campo1 FROM Tabela WHERE campo2 = " + nEmp + " AND campo3 = 3";',
      'Fim;',
      'SQL_DefinirComando(cur, aFiltro);'
    ].join('\n');
    const result = formatText({
      text: input,
      options: { ...options, embeddedSqlEnabled: true }
    }).text;
    expect(result).toContain('aFiltro = "SELECT \\');
    expect(result).toMatch(/campo2 = "\s*\n\s*\+ nEmp\s*\n\s*\+ "/);
    expect(result).toContain('AND campo3 = 1";');
    expect(result).toContain('AND campo3 = 2";');
    expect(result).toContain('AND campo3 = 3";');
    expect(result).toContain('SQL_DefinirComando(cur, aFiltro);');
  });

  it('mantem no-op para variável dinâmica ou concatenação ambígua', () =>
  {
    const input = [
      'Definir Cursor cur;',
      'Definir Alfa aSql;',
      'Definir Alfa aFiltro;',
      'aSql = aFiltro + " SELECT campo1 FROM Tabela";',
      'SQL_DefinirComando(cur, aSql);'
    ].join('\n');
    const result = formatText({
      text: input,
      options: { ...options, embeddedSqlEnabled: true }
    }).text;
    expect(result).toContain('aSql = aFiltro + " SELECT campo1 FROM Tabela";');
  });

  it('emite relatório de instrumentação para SQL_DefinirComando e rejeição dinâmica', () =>
  {
    const direct = formatDocumentWithDetails({
      sourcePath: '/tmp/direct.lsp',
      text: 'SQL_DefinirComando(cur, "SELECT campo1,campo2 FROM Tabela WHERE campo3=:valor");\n',
      options: { ...options, embeddedSqlEnabled: true }
    });
    expect(direct.report.embeddedSql.attempts).toEqual([
      expect.objectContaining({
        wrapperKind: 'sql_definircomando',
        sourceKind: 'direct_literal',
        decision: 'applied',
        reason: 'static_single_literal'
      })
    ]);

    const prefixedDynamic = formatDocumentWithDetails({
      sourcePath: '/tmp/rejected.lsp',
      text: [
        'Definir Alfa aSql;',
        'Definir Alfa aFiltro;',
        'aSql = aFiltro + " SELECT campo1 FROM Tabela";',
        'SQL_DefinirComando(cur, aSql);'
      ].join('\n'),
      options: { ...options, embeddedSqlEnabled: true }
    });
    expect(prefixedDynamic.report.embeddedSql.attempts).toEqual([
      expect.objectContaining({
        wrapperKind: 'sql_definircomando',
        sourceKind: 'variable_mixed_dynamic',
        decision: 'rejected',
        reason: 'rejected_dynamic_concat'
      })
    ]);

    const controlled = formatDocumentWithDetails({
      sourcePath: '/tmp/controlled.lsp',
      text: 'ExecSQLEx("SELECT campo1 FROM Tabela WHERE campo2 = " + nValor + " AND campo3 = 1", nOk, aErro);\n',
      options: { ...options, embeddedSqlEnabled: true }
    });
    expect(controlled.report.embeddedSql.attempts).toEqual([
      expect.objectContaining({
        wrapperKind: 'execsqlex',
        sourceKind: 'direct_mixed_dynamic',
        decision: 'applied',
        reason: 'controlled_hybrid_concat'
      })
    ]);
  });


  it('formata apenas o prefixo SQL quando houver fragmento dinâmico no sufixo', () =>
  {
    const input = [
      'Definir Alfa aSql;',
      'Definir Alfa aFiltro;',
      'aSql = "SELECT  campo1  FROM  Tabela  WHERE  campo2 = :valor" + aFiltro;',
      'SQL_DefinirComando(cur, aSql);'
    ].join('\n');

    const result = formatText({
      text: input,
      options: { ...options, embeddedSqlEnabled: true }
    }).text;

    expect(result).toContain('aSql = "SELECT');
    expect(result).toMatch(/campo2 = :valor"\s*\n\s*\+ aFiltro;/);
  });

  it('nao perde indentacao interna em cadeia Senao -> Se com Inicio/Fim', () =>
  {
    const input =
      'Se (nIMPerCmp = 6) @-- Antecipar o Inicio do expediente --@\n' +
      'Inicio\n' +
      '  SQL_RetornarInteiro(cIMPesquisa, "QtdHor", nIMQtdIni);\n' +
      '\n' +
      '  @-- Geracao do Log --@\n' +
      '  ConverteMascara(4, nIMQtdIni, aTxtLog, "HH:MM");\n' +
      '  aTxtLog = "nIMQtdIni: " + aTxtLog;\n' +
      '  f850GerarLog(1, 18);\n' +
      'Fim;\n' +
      'Senao\n' +
      'Se (nIMPerCmp = 7) @-- Prorrogar o Termino do expediente --@\n' +
      'Inicio\n' +
      '  SQL_RetornarInteiro(cIMPesquisa, "QtdHor", nIMQtdFim);\n' +
      '\n' +
      '  @-- Geracao do Log --@\n' +
      '  ConverteMascara(4, nIMQtdFim, aTxtLog, "HH:MM");\n' +
      '  aTxtLog = "nIMQtdFim: " + aTxtLog;\n' +
      '  f850GerarLog(1, 18);\n' +
      'Fim;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Senao\nSe (nIMPerCmp = 7)');
    expect(result).toContain('Inicio\n  SQL_RetornarInteiro');
    expect(result).toContain('\n\n  @-- Geracao do Log --@\n');
  });


  it('formata declaracao legada de Tabela com Inicio/Fim de forma estavel', () =>
  {
    const input =
      'Definir Tabela tab[2] = Inicio\n'
      + 'Numero Codigo;\n'
      + 'Alfa Nome[10];\n'
      + 'Fim;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Definir Tabela tab[2] =');
    expect(result).toContain('\nInicio\n');
    expect(result).toContain('\n  Numero Codigo;\n');
    expect(result).toContain('\n  Alfa Nome[10];\n');
    expect(result).toContain('\nFim;\n');
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it('coloca chaves em linhas proprias e nao cola com o proximo statement', () =>
  {
    const input = 'Para(i=1; i<=10; i=i+1){\nx=i;\n}\nFuncao X();\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Para (i = 1; i <= 10; i = i + 1)\n{\n');
    expect(result).toContain('}\nFuncao X();\n');
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it('nao colapsa bloco com chave ao reformatar If seguido de outro If e atribuicao multiline', () =>
  {
    const input =
      'Se ((nResto <> 0)) {\n' +
      'nPaginas = nPaginas + 1;\n' +
      '}\n' +
      '\n' +
      'Se ((nTotalNotificacao > 0) e (nPaginas = 0)) {\n' +
      'nPaginas = 1;\n' +
      '}\n' +
      '\n' +
      'aResponse = "{"\n' +
      '+ "\\"itens\\":"\n' +
      '+ itensJson\n' +
      '+ "}";\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Se ((nResto <> 0))\n{\n');
    expect(result).toContain('\n}\n\nSe ((nTotalNotificacao > 0) e (nPaginas = 0))\n{\n');
    expect(result).toContain('\n}\n\naResponse = "{');
    expect(result).not.toContain('} Se (');
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it('sintaxe invalida retorna texto original', () =>
  {
    const input = 'Funcao X(;\nInicio\nFim;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toBe(input);
  });

  it('mantem comentario de linha inline quando ja estava inline', () =>
  {
    const input = 'Definir Numero n;n=4;@-- ESA --@\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Definir Numero n; n = 4; @-- ESA --@\n');
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it('preserva comentario de linha inline no header do Se sem alterar conteudo', () =>
  {
    const input = 'Definir Numero n;\nDefinir Numero m;\nSe((n=1 @-- keep this comment --@) e(m=2))\nInicio\nn=1;\nFim;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('@-- keep this comment --@');
    expect(result).toContain('Se ((n = 1 @-- keep this comment --@ ) e (m = 2))');
    expect(protectedTokens(result)).toEqual(protectedTokens(input));
  });

  it('aplica formato canonico TS-like para Se multiline com e/ou e espaco antes de parenteses', () =>
  {
    const input = 'Se(\na=1\ne(\nb=2\nou(\nc=3\n)\n)\n)\nInicio\nFim;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('e (');
    expect(result).toContain('ou (');
    expect(result).not.toContain('e(');
    expect(result).not.toContain('ou(');
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it('indenta continuacao de condicao multiline com recuo de bloco (+2)', () =>
  {
    const input =
      'Se (((nEhAnalista = cVerdadeiro)\n' +
      'ou (nEhSolicitante = cVerdadeiro))\n' +
      'e (nSitDSH = 0)\n' +
      'e (nTipHEx = 1))\n' +
      'Inicio\n' +
      'Fim;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Se (((nEhAnalista = cVerdadeiro)\n  ou (nEhSolicitante = cVerdadeiro))\n');
    expect(result).toContain('\n  e (nSitDSH = 0)\n');
    expect(result).toContain('\n  e (nTipHEx = 1))\n');
  });

  it('mantem alinhamento de Inicio/Fim no caso real com Senao encadeado', () =>
  {
    const input =
      '      Se (((nEhAnalista = cVerdadeiro)\n' +
      '         ou (nEhSolicitante = cVerdadeiro))\n' +
      '         e (nSitDSH = 0) @-- 0 - Data Ativa --@\n' +
      '         e (nQtdSitDSH > 1) @-- Quantidade de Datas Ativas --@\n' +
      '         e (nSitSol = 52) @-- 52 - Solicitacao Aguardando Aprovacao --@\n' +
      '         e (nTipHEx = 1)) @-- 1 - Programado --@\n' +
      '      Inicio\n' +
      '        Se (dDatTra > dDatHoj)\n' +
      '        Inicio\n' +
      '          nPodeCancelar = cVerdadeiro;\n' +
      '        Fim;\n' +
      '        Senao\n' +
      '          Se (dDatTra = dDatHoj)\n' +
      '          Inicio\n' +
      '            Se (nHorIni >(nHorAgo + nTolTDe))\n' +
      '            Inicio\n' +
      '              nPodeCancelar = cVerdadeiro;\n' +
      '            Fim;\n' +
      '          Fim;\n' +
      '      Fim;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Se (((nEhAnalista = cVerdadeiro)\n  ou (nEhSolicitante = cVerdadeiro))\n');
    expect(result).toContain('\nInicio\n');
    expect(result).toContain('\nFim;\n');
  });

  it('indenta Se encadeado sem Inicio/Fim dentro de Senao', () =>
  {
    const input =
      'Se (((nEhAnalista = cVerdadeiro)\n' +
      'e (nTipHEx = 1))\n' +
      'Inicio\n' +
      '  Se (dDatTra > dDatHoj)\n' +
      '  Inicio\n' +
      '    nPodeCancelar = cVerdadeiro;\n' +
      '  Fim;\n' +
      '  Senao\n' +
      '    Se (dDatTra = dDatHoj)\n' +
      '      Se (nHorIni >(nHorAgo + nTolTDe))\n' +
      '        nPodeCancelar = cVerdadeiro;\n' +
      'Fim;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Senao\n    Se (dDatTra = dDatHoj)\n      Se (nHorIni >(nHorAgo + nTolTDe))\n        nPodeCancelar = cVerdadeiro;\n');
  });

  it("mantem header do Para em uma unica linha sem quebrar nos ';'", () =>
  {
    const input = 'Para(i=1;i<=10;i=i+1)\nInicio\ni=i+1;\nFim;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Para (i = 1; i <= 10; i = i + 1)\n');
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it("normaliza virgulas em params e args para ', '", () =>
  {
    const input = 'Definir Funcao Soma(Numero p1,Numero p2);\nDefinir Numero r;\nr=Soma(1,2);\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('Numero p1, Numero p2');
    expect(result).toContain('Soma(1, 2)');
    expect(result).not.toContain('p1,Numero');
    expect(result).not.toContain('1,2');
  });

  it('preserva concatenacao multiline sem colapsar e sem alterar strings', () =>
  {
    const input = 'Definir Alfa s;\ns="A"\n+"B  C"\n+" D";\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toContain('s = "A"\n');
    expect(result).toContain('+ "B  C"\n');
    expect(result).toContain('+ " D";\n');
    expect(protectedTokens(result)).toEqual(protectedTokens(input));
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it('formata declaracao de Tabela com schema canonico', () =>
  {
    const input =
      '  Definir Tabela v0_TAG [40] =\n' +
      '  {\n' +
      '                             Alfa Name;\n' +
      '    Numero Level;\n' +
      '    Alfa Original;\n' +
      '    Alfa Contents;\n' +
      '    Alfa HTML;\n' +
      '  }\n' +
      '  ;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toBe(
      'Definir Tabela v0_TAG[40] = {\n' +
      '  Alfa Name;\n' +
      '  Numero Level;\n' +
      '  Alfa Original;\n' +
      '  Alfa Contents;\n' +
      '  Alfa HTML;\n' +
      '};\n'
    );
  });

  it('preserva CRLF no output', () =>
  {
    const input = 'Definir Numero n;\r\nSe(n=1)\r\nn=1;\r\n';
    const result = formatText({ text: input, options }).text;
    expect(detectEol(result)).toBe('\r\n');
    expect(result.includes('\r\n')).toBe(true);
    expect(/[^\r]\n/.test(result)).toBe(false);
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it('valida idempotencia e invariantes em exemplos reais HR e _Webservices', () =>
  {
    const hrDir = path.join(process.cwd(), 'exemplos/HR');
    const wsDir = path.join(process.cwd(), 'exemplos/HR/_Webservices');
    if (!fs.existsSync(hrDir) || !fs.existsSync(wsDir)) return;

    const hrFiles = fs
      .readdirSync(hrDir)
      .filter((name) => /^HR.*\.txt$/i.test(name))
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
      .slice(0, 3)
      .map((name) => path.join(hrDir, name));

    const wsFiles = fs
      .readdirSync(wsDir)
      .filter((name) => /\.txt$/i.test(name))
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
      .slice(0, 2)
      .map((name) => path.join(wsDir, name));

    const sampleFiles = [...hrFiles, ...wsFiles];
    expect(sampleFiles.length).toBeGreaterThan(0);

    for (const filePath of sampleFiles)
    {
      const input = fs.readFileSync(filePath, 'utf8');
      const once = formatText({ text: input, options }).text;
      const twice = formatText({ text: once, options }).text;

      expect(twice).toBe(once);
      expect(detectEol(once)).toBe(detectEol(input));
      expect(protectedTokens(once)).toEqual(protectedTokens(input));
    }
  }, 60000);

  it("quebra declaracao de funcao com 5 params em 4/1 alinhado ao '('", () =>
  {
    const input = 'Definir Funcao f500RegistrarDecisao(Numero p1, Numero p2, Numero p3, Numero p4, Numero End p5);\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toBe(
      'Definir Funcao f500RegistrarDecisao(Numero p1, Numero p2, Numero p3, Numero p4,\n' +
      '                                    Numero End p5);\n'
    );
  });

  it("quebra implementacao Funcao com 7 params em 4/3 alinhado ao '('", () =>
  {
    const input =
      'Funcao f700(Numero p1, Numero p2, Numero p3, Numero p4, Numero p5, Numero p6, Numero p7)\nInicio\nFim;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toBe(
      'Funcao f700(Numero p1, Numero p2, Numero p3, Numero p4,\n' +
      '            Numero p5, Numero p6, Numero p7)\n' +
      'Inicio\n' +
      'Fim;\n'
    );
  });

  it('mantem assinatura em linha unica quando params <= 4', () =>
  {
    const input = 'Definir Funcao Soma3(Numero p1,Numero p2,Numero p3);\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toBe('Definir Funcao Soma3(Numero p1, Numero p2, Numero p3);\n');
  });

  it('eh idempotente para assinatura de funcao quebrada por parametros', () =>
  {
    const input = 'Definir Funcao f500RegistrarDecisao(Numero p1, Numero p2, Numero p3, Numero p4, Numero End p5);\n';
    const once = formatText({ text: input, options }).text;
    const twice = formatText({ text: once, options }).text;
    expect(twice).toBe(once);
  });

  it('quebra assinatura Definir Funcao com 10 params em 4/4/2', () =>
  {
    const input =
      'Definir Funcao f1000(Numero p1, Numero p2, Numero p3, Numero p4, Numero p5, Numero p6, Numero p7, Numero p8, Numero p9, Numero p10);\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toBe(
      'Definir Funcao f1000(Numero p1, Numero p2, Numero p3, Numero p4,\n' +
      '                     Numero p5, Numero p6, Numero p7, Numero p8,\n' +
      '                     Numero p9, Numero p10);\n'
    );
  });

  it('quebra assinatura Funcao implementacao com 10 params em 4/4/2', () =>
  {
    const input =
      'Funcao f1000Impl(Numero p1, Numero p2, Numero p3, Numero p4, Numero p5, Numero p6, Numero p7, Numero p8, Numero p9, Numero p10)\nInicio\nFim;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toBe(
      'Funcao f1000Impl(Numero p1, Numero p2, Numero p3, Numero p4,\n' +
      '                 Numero p5, Numero p6, Numero p7, Numero p8,\n' +
      '                 Numero p9, Numero p10)\n' +
      'Inicio\n' +
      'Fim;\n'
    );
  });

  it('respeita maxParamsPerLine configuravel em assinatura de funcao', () =>
  {
    const input =
      'Definir Funcao fCustom(Numero p1, Numero p2, Numero p3, Numero p4, Numero p5, Numero p6, Numero p7);\n';
    const result = formatText({
      text: input,
      options: {
        ...options,
        maxParamsPerLine: 3
      }
    }).text;
    expect(result).toBe(
      'Definir Funcao fCustom(Numero p1, Numero p2, Numero p3,\n' +
      '                       Numero p4, Numero p5, Numero p6,\n' +
      '                       Numero p7);\n'
    );
  });

  it('preserva comentarios inline em assinatura com muitos parametros', () =>
  {
    const input =
      'Definir Funcao fComentario(Numero p1, Numero p2, @-- manter --@ Numero p3, Numero p4, Numero p5);\n';
    const result = formatText({ text: input, options }).text;
    expect(protectedTokens(result)).toEqual(protectedTokens(input));
    expect(formatText({ text: result, options }).text).toBe(result);
  });

  it("preserva chamada multilinha e alinha continuacao na coluna do '('", () =>
  {
    const input =
      'f853CalcularAcumuladoHEMes(nNumSol, nNumEmp, nTipCol, nNumCad, dPerIni, nTotHEM, cFalso,\n' +
      '                           nTRCHEM, nTRPHEM, nTACHEM, nTAPHEM, nTOCHEM, nTOPHEM, nTotHEP);\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toBe(
      'f853CalcularAcumuladoHEMes(nNumSol, nNumEmp, nTipCol, nNumCad, dPerIni, nTotHEM, cFalso,\n' +
      '                           nTRCHEM, nTRPHEM, nTACHEM, nTAPHEM, nTOCHEM, nTOPHEM, nTotHEP);\n'
    );
  });

  it("nao quebra concat por '+' quando o statement ja esta em linha unica", () =>
  {
    const input = 'aTxtLog = "Usuario:"        + aTxtLog        + " - "        + NomUsu;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toBe('aTxtLog = "Usuario:" + aTxtLog + " - " + NomUsu;\n');
  });

  it("alinha '+' com '=' em concat multiline mesmo com comentario inline", () =>
  {
    const input =
      'aRetornoDados = ",\\"solicitacao\\":{"\n' +
      ' + "\\"numSol\\":" + aNumSol @-- Numero Interno da Solicitacao --@\n' +
      ' + ",\\"ideSol\\":\\"" + aIdeSol + "\\"" @-- Identificacao (anual) da Solicitacao --@\n' +
      ' + "}";\n';
    const result = formatText({ text: input, options }).text;
    const lines = result.split('\n');
    const eqCol = lines[0]?.indexOf('=') ?? -1;
    expect(eqCol).toBeGreaterThan(0);
    for (let i = 1; i <= 3; i += 1)
    {
      const plusCol = lines[i]?.indexOf('+') ?? -1;
      expect(plusCol).toBe(eqCol);
    }
  });

  it('preserva concat multiline no estilo por linha (aDatas)', () =>
  {
    const input =
      'aDatas = aDatas\n' +
      '       + ",{"\n' +
      '       + aTexto\n' +
      '       + ",\\"podCan\\":" + aPodeCancelar\n' +
      '       + "}";\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toBe(
      'aDatas = aDatas\n' +
      '       + ",{"\n' +
      '       + aTexto\n' +
      '       + ",\\"podCan\\":" + aPodeCancelar\n' +
      '       + "}";\n'
    );
  });

  it('preserva agrupamento por linha em concat multiline com termos inline (aFiltro)', () =>
  {
    const input =
      'aFiltro = " and USU_NumEmp = " + aNumEmp\n' +
      '        + " and USU_TipCol = " + aTipCol\n' +
      '        + " and USU_NumCad = " + aNumCad;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toBe(
      'aFiltro = " and USU_NumEmp = " + aNumEmp\n' +
      '        + " and USU_TipCol = " + aTipCol\n' +
      '        + " and USU_NumCad = " + aNumCad;\n'
    );
  });

  it("alinha continuacao quando '+' fica no fim da linha (aFiltro trailing plus)", () =>
  {
    const input =
      'aFiltro = " and USU_NumEmp = " + aNumEmp +\n' +
      '          " and USU_TipCol = " + aTipCol +\n' +
      '          " and USU_NumCad = " + aNumCad;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toBe(
      'aFiltro = " and USU_NumEmp = " + aNumEmp\n' +
      '        + " and USU_TipCol = " + aTipCol\n' +
      '        + " and USU_NumCad = " + aNumCad;\n'
    );
  });

  it('preserva pares string+variavel na mesma linha de continuacao (a853Colaborador)', () =>
  {
    const input =
      'a853Colaborador = a853Colaborador\n' +
      '                + ",\\"hraExt\\":{"\n' +
      '                +   " \\"preSHE\\":0"\n' +
      '                +   ",\\"reaPag\\":" + aTRPHEM\n' +
      '                +   ",\\"reaCmp\\":" + aTRCHEM\n' +
      '                +   ",\\"apvPag\\":" + aTAPHEM\n' +
      '                +   ",\\"apvCmp\\":" + aTACHEM\n' +
      '                +   ",\\"outPag\\":" + aTOPHEM\n' +
      '                +   ",\\"outCmp\\":" + aTOCHEM\n' +
      '                +   ",\\"totPrj\\":" + aTotHEP\n' +
      '                + "}";\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toBe(
      'a853Colaborador = a853Colaborador\n' +
      '                + ",\\"hraExt\\":{"\n' +
      '                + " \\"preSHE\\":0"\n' +
      '                + ",\\"reaPag\\":" + aTRPHEM\n' +
      '                + ",\\"reaCmp\\":" + aTRCHEM\n' +
      '                + ",\\"apvPag\\":" + aTAPHEM\n' +
      '                + ",\\"apvCmp\\":" + aTACHEM\n' +
      '                + ",\\"outPag\\":" + aTOPHEM\n' +
      '                + ",\\"outCmp\\":" + aTOCHEM\n' +
      '                + ",\\"totPrj\\":" + aTotHEP\n' +
      '                + "}";\n'
    );
  });

  it('nao aplica concat multiline para expressao numerica sem string', () =>
  {
    const input = 'n = a + b + c + d;\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toBe('n = a + b + c + d;\n');
  });
  it("move '+' para a linha seguinte em soma multiline com comentarios trailing", () =>
  {
    const input =
      'nHorTra = HorSit[501] +\n' +
      '          HorSit[509] + @-- Trabalho Externo --@\n' +
      '          HorSit[514] + @-- Comisionado --@\n' +
      '          HorSit[520] + @-- Compensacao --@\n' +
      '          HorSit[571] + @-- Lactancia --@\n' +
      '          HorSit[620] + @-- Compensacao --@\n' +
      '          HorSit[651];   @-- Atraso justificado --@\n';

    const result = formatText({ text: input, options }).text;
    expect(result).toBe(
      'nHorTra = HorSit[501]\n' +
      '        + HorSit[509]  @-- Trabalho Externo --@\n' +
      '        + HorSit[514]  @-- Comisionado --@\n' +
      '        + HorSit[520]  @-- Compensacao --@\n' +
      '        + HorSit[571]  @-- Lactancia --@\n' +
      '        + HorSit[620]  @-- Compensacao --@\n' +
      '        + HorSit[651]; @-- Atraso justificado --@\n'
    );
  });

  it("move '-' para a linha seguinte em subtracao multiline", () =>
  {
    const input =
      'nSaldo = nBase -\n' +
      '         nDesconto - @-- Falta --@\n' +
      '         nAtraso;\n';

    const result = formatText({ text: input, options }).text;
    expect(result).toBe(
      'nSaldo = nBase\n' +
      '       - nDesconto  @-- Falta --@\n' +
      '       - nAtraso;\n'
    );
  });
  it('eh idempotente para regra de concat multiline', () =>
  {
    const input = 'aSQL = "A" + "B" + "C" + "D";\n';
    const once = formatText({ text: input, options }).text;
    const twice = formatText({ text: once, options }).text;
    expect(twice).toBe(once);
  });

  it('preserva um espaco antes de comentario inline em concat SQL apos multiplas formatacoes', () =>
  {
    const input =
      'aSQL = " Select * "\n' +
      '     + " Where x = :x "@-- comentario 1 --@\n' +
      '     + " Or y = :y "@-- comentario 2 --@\n' +
      '     + " And z = :z ";\n';

    const once = formatText({ text: input, options }).text;
    const twice = formatText({ text: once, options }).text;
    expect(once).toContain('" Where x = :x " @-- comentario 1 --@');
    expect(once).toContain('" Or y = :y " @-- comentario 2 --@');
    expect(twice).toBe(once);
  });

  it('preserva um espaco antes de comentario inline', () =>
  {
    const input =
      'aSQL = aSQL\n' +
      '     + "\\"numSol\\":" + aNumSol@-- Comentario 1 --@\n' +
      '     + ",\\"ideSol\\":\\"" + aIdeSol + "\\""@-- Comentario 2 --@\n' +
      '     + ",\\"horCri\\":" + aHCrSol@-- Comentario 3 --@\n';

    const once = formatText({ text: input, options }).text;
    const twice = formatText({ text: once, options }).text;
    expect(once).toContain('"\\"numSol\\":" + aNumSol @-- Comentario 1 --@');
    expect(once).toContain('",\\"ideSol\\":\\"" + aIdeSol + "\\"" @-- Comentario 2 --@');
    expect(once).toContain('",\\"horCri\\":" + aHCrSol @-- Comentario 3 --@');
    expect(twice).toBe(once);
  });

  it('preserva o alinhamento horizontal original antes de comentarios de linha trailing', () =>
  {
    const input =
      'Definir Alfa aTeste;\n' +
      'aTeste = " ";       @ Teste @\n' +
      'aTeste2 = " ";      @ Teste @\n' +
      'aTeste3 = "Teste";  @ Teste @\n';

    const once = formatText({ text: input, options }).text;
    const twice = formatText({ text: once, options }).text;

    expect(once).toContain('aTeste = " ";       @ Teste @');
    expect(once).toContain('aTeste2 = " ";      @ Teste @');
    expect(once).toContain('aTeste3 = "Teste";  @ Teste @');
    expect(twice).toBe(once);
  });

  it('preserva byte-a-byte strings com escapes em concat multiline', () =>
  {
    const input = 'aJS = "{\\"k\\":\\"" + v + "\\\\path\\\\" + "\\"}";\n';
    const result = formatText({ text: input, options }).text;
    expect(protectedTokens(result)).toEqual(protectedTokens(input));
  });

  it('mantem linha em branco apos concat multiline (exemplo SQL reportado)', () =>
  {
    const input =
      '@-- Teste do SQL --@\n' +
      'aSQL = " SELECT * "\n' +
      '  + " FROM Tabela "\n' +
      '  + " WHERE Campo1 = :aOperacao "\n' +
      "  + \" AND Campo2 = 'Valor2'\";\n" +
      '\n' +
      'SQL_Criar(cPesquisa);\n';
    const result = formatText({ text: input, options }).text;
    expect(result).toBe(
      '@-- Teste do SQL --@\n' +
      'aSQL = " SELECT * "\n' +
      '     + " FROM Tabela "\n' +
      '     + " WHERE Campo1 = :aOperacao "\n' +
      "     + \" AND Campo2 = 'Valor2'\";\n" +
      '\n' +
      'SQL_Criar(cPesquisa);\n'
    );
  });

  it('formata SQL embutido quando a variavel e sql ou vazio e o consumo esta protegido por guarda simples', () =>
  {
    const input = [
      'Definir Alfa aSQL;',
      'aSQL = "";',
      'Se (nCont = 1)',
      'Inicio',
      '  aSQL = "SELECT campo1,campo2 FROM Tabela WHERE campo3=:valor";',
      'Fim;',
      'Se (aSQL <> "")',
      'Inicio',
      '  SQL_DefinirComando(cPesquisa, aSQL);',
      'Fim;'
    ].join('\n');
    const result = formatText({
      text: input,
      options: { ...options, embeddedSqlEnabled: true }
    }).text;
    expect(result).toContain('aSQL = "SELECT \\');
    expect(result).toMatch(/\n\s*campo1,\s*\\/);
    expect(result).toContain('SQL_DefinirComando(cPesquisa, aSQL);');
    expect(formatText({
      text: result,
      options: { ...options, embeddedSqlEnabled: true }
    }).text).toBe(result);
  });

  it('formata SQL com fragmento estrutural no meio e preserva o fragmento dinamico', () =>
  {
    const input = [
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

    const result = formatText({
      text: input,
      options: { ...options, embeddedSqlEnabled: true }
    }).text;

    expect(result).toContain('aSQL = "Select \\');
    expect(result).toMatch(/\+ aFiltro\s*\n\s*\+ "\) \\/);
    expect(result).toContain('Order By \\');
    expect(result).toContain('a.Campo1"');
    expect(formatText({
      text: result,
      options: { ...options, embeddedSqlEnabled: true }
    }).text).toBe(result);
  });

  it('mantém SQL hospedeiro elegível com fragmento estrutural direto no meio (TR705 carga por colaborador)', () =>
  {
    const input = [
      'Definir Alfa aSQL;',
      'Definir Alfa aCriterioNumCad;',
      'aCriterioNumCad = " Or (NumEmp = " + nNumEmp + " And TipCol = " + nTipCol + " And NumCad = " + nNumCad + ")";',
      'aSQL = " Select NumEmp, TipCol, NumCad " +',
      '       " From R034Fun " +',
      '       " Where (1 = 2 " + aCriterioNumCad + ") " +',
      '       " Order By NumCad";',
      'SQL_DefinirComando(cPesquisa, aSQL);'
    ].join('\n');

    const result = formatText({
      text: input,
      options: { ...options, embeddedSqlEnabled: true }
    }).text;

    expect(result).toContain('aSQL = "Select \\');
    expect(result).toMatch(/\+ aCriterioNumCad\s*\n\s*\+ "\) \\/);
    expect(result).toMatch(/Order By \\/i);
    expect(result).toContain('NumCad"');
  });

});
