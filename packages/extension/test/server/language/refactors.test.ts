import { describe, expect, it } from 'vitest';
import { buildRefactorPlans, getRefactorStrings } from '../../../src/server/language/refactors';
import type { Range } from '../../../src/server/language/quick-fixes';

function range(startLine: number, startCharacter: number, endLine: number, endCharacter: number): Range {
  return {
    start: { line: startLine, character: startCharacter },
    end: { line: endLine, character: endCharacter }
  };
}

describe('refactors', () => {
  it('expande a selecao para linhas completas ao envolver com bloco', () => {
    const text = ['Definir Numero a;', 'x = 1;', 'y = 2;', 'Fim;'].join('\n');
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(1, 2, 2, 3),
      defaultBlockStyle: 'inicioFim'
    });
    const plan = plans.find((entry) => entry.kind === 'wrapBlock');
    expect(plan).toBeTruthy();
    expect(plan?.edits[0]?.range).toEqual(range(1, 0, 2, 6));
    expect(plan?.edits[0]?.text).toBe(['Inicio', '  x = 1;', '  y = 2;', 'Fim;'].join('\n'));
  });

  it('gera envolver com bloco usando braces quando configurado', () => {
    const text = ['x = 1;', 'y = 2;'].join('\n');
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(0, 0, 1, 6),
      defaultBlockStyle: 'braces'
    });
    const plan = plans.find((entry) => entry.kind === 'wrapBlock');
    expect(plan?.edits[0]?.text).toBe(['{', '  x = 1;', '  y = 2;', '}'].join('\n'));
  });

  it('gera envolver com Se mantendo cursor na condicao', () => {
    const text = ['x = 1;', 'y = 2;'].join('\n');
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(0, 0, 1, 6),
      defaultBlockStyle: 'inicioFim'
    });
    const plan = plans.find((entry) => entry.kind === 'wrapIf');
    expect(plan?.edits[0]?.text).toBe(['Se ()', 'Inicio', '  x = 1;', '  y = 2;', 'Fim;'].join('\n'));
    expect(plan?.selection).toEqual(range(0, 4, 0, 4));
  });

  it('gera envolver com Enquanto e Para com bloco padrao', () => {
    const text = ['x = 1;'].join('\n');
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(0, 0, 0, 6),
      defaultBlockStyle: 'inicioFim'
    });
    expect(plans.find((entry) => entry.kind === 'wrapWhile')?.edits[0]?.text).toBe(
      ['Enquanto ()', 'Inicio', '  x = 1;', 'Fim;'].join('\n')
    );
    expect(plans.find((entry) => entry.kind === 'wrapFor')?.edits[0]?.text).toBe(
      ['Para ()', 'Inicio', '  x = 1;', 'Fim;'].join('\n')
    );
  });

  it('nao oferece refactor com selecao dentro de string', () => {
    const text = 'x = "abc";\n';
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(0, 5, 0, 8),
      defaultBlockStyle: 'inicioFim'
    });
    expect(plans).toHaveLength(0);
  });

  it('oferece refactor para converter texto multilinha em concatenacao sob o cursor', () => {
    const text = [
      '  aCOSQL = "Select JSON_ARRAYAGG( \\',
      '                     JSON_OBJECT( \\',
      '                       KEY \'codIte\' IS a.CodOco, \\',
      '                       KEY \'desIte\' IS a.DesOco \\',
      '                     ) \\',
      '                   ORDER BY a.CodOco \\',
      '                   RETURNING CLOB) Texto \\',
      '            From R108TOC a \\',
      '            Where 1 = 1 \\',
      '            ";'
    ].join('\n');
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(1, 25, 1, 25),
      defaultBlockStyle: 'inicioFim'
    });
    const plan = plans.find((entry) => entry.kind === 'convertMultilineStringToConcatenation');
    expect(plan?.edits[0]?.text).toBe([
      '"Select JSON_ARRAYAGG( "',
      '         + "          JSON_OBJECT( "',
      '         + "            KEY \'codIte\' IS a.CodOco, "',
      '         + "            KEY \'desIte\' IS a.DesOco "',
      '         + "          ) "',
      '         + "        ORDER BY a.CodOco "',
      '         + "        RETURNING CLOB) Texto "',
      '         + " From R108TOC a "',
      '         + " Where 1 = 1 "'
    ].join('\n'));
  });

  it('converte cadeia mista com duas strings e variavel intermediaria quando a selecao cobre o statement', () => {
    const text = [
      '  aSQL = "Select USU_KeyLis \\',
      '          From USU_TWKFLis \\',
      '          Where USU_CodWkf = 9999 \\',
      '          And   USU_IdeLis = 97 \\',
      '          And   USU_KeyLis in (" + aLstLis + ") \\',
      '         ";'
    ].join('\n');
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(0, 0, 5, 11),
      defaultBlockStyle: 'inicioFim'
    });
    const plan = plans.find((entry) => entry.kind === 'convertMultilineStringToConcatenation');
    expect(plan?.edits).toHaveLength(2);
    expect(plan?.edits[0]?.text).toBe('") "');
    expect(plan?.edits[1]?.text).toBe([
      '"Select USU_KeyLis "',
      '       + " From USU_TWKFLis "',
      '       + " Where USU_CodWkf = 9999 "',
      '       + " And   USU_IdeLis = 97 "',
      '       + " And   USU_KeyLis in ("'
    ].join('\n'));
  });

  it('oferece conversao quando o cursor esta na parte interpolada da mesma linha', () => {
    const text = [
      '  aSQL = "Select x \\',
      '          From T \\',
      '          Where a in (" + aLista + ") \\',
      '         ";'
    ].join('\n');
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(2, 35, 2, 35),
      defaultBlockStyle: 'inicioFim'
    });
    const plan = plans.find((entry) => entry.kind === 'convertMultilineStringToConcatenation');
    expect(plan).toBeTruthy();
    expect(plan?.edits).toHaveLength(2);
  });

  it('nao oferece conversao para string simples sem continuidade', () => {
    const text = 'a = "texto simples";\n';
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(0, 5, 0, 5),
      defaultBlockStyle: 'inicioFim'
    });
    expect(plans.find((entry) => entry.kind === 'convertMultilineStringToConcatenation')).toBeUndefined();
  });

  it('permite refactor quando a selecao por linhas contem string literal', () => {
    const text = ['x = "abc";', 'y = 1;'].join('\n');
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(0, 0, 1, 6),
      defaultBlockStyle: 'inicioFim'
    });
    const plan = plans.find((entry) => entry.kind === 'wrapBlock');
    expect(plan?.edits[0]?.text).toBe(['Inicio', '  x = "abc";', '  y = 1;', 'Fim;'].join('\n'));
  });

  it('permite refactor quando a selecao contem comentario de linha', () => {
    const text = ['@-- comentario --@', 'x = 1;'].join('\n');
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(0, 0, 1, 6),
      defaultBlockStyle: 'inicioFim'
    });
    const plan = plans.find((entry) => entry.kind === 'wrapBlock');
    expect(plan?.edits[0]?.text).toBe(['Inicio', '  @-- comentario --@', '  x = 1;', 'Fim;'].join('\n'));
  });

  it('alterna bloco Inicio/Fim para braces no bloco sob o cursor', () => {
    const text = ['Se (x = 1)', 'Inicio', '  x = 2;', 'Fim;'].join('\n');
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(2, 2, 2, 2),
      defaultBlockStyle: 'inicioFim'
    });
    const plan = plans.find((entry) => entry.kind === 'toggleBlockStyle');
    expect(plan?.edits[0]?.text).toBe(['{', '  x = 2;', '}'].join('\n'));
  });

  it('alterna bloco braces para Inicio/Fim', () => {
    const text = ['Se (x = 1)', '{', '  x = 2;', '}'].join('\n');
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(2, 1, 2, 1),
      defaultBlockStyle: 'inicioFim'
    });
    const plan = plans.find((entry) => entry.kind === 'toggleBlockStyle');
    expect(plan?.edits[0]?.text).toBe(['Inicio', '  x = 2;', 'Fim;'].join('\n'));
  });

  it('nao oferece toggle quando nao ha bloco reconhecivel', () => {
    const text = ['Se (x = 1) Inicio', '  x = 2;', 'Fim;'].join('\n');
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(1, 1, 1, 1),
      defaultBlockStyle: 'inicioFim'
    });
    expect(plans.find((entry) => entry.kind === 'toggleBlockStyle')).toBeUndefined();
  });

  it('oferece conversao para atribuicao simples com unica string multiline dentro de bloco', () => {
    const text = [
      'Se (nAgrupar = cFalso)',
      'Inicio',
      '  aSQL = "Select 0 NumAGV, \'\' ImaAGV, 0 IanAGV, 0 IseAGV, \\',
      '                    Upper(b.USU_NomAco) NomVis, \'\' DInVis, \'\' DFiVis, b.USU_TipDoc TipDoc, \\',
      '                    Replace(b.USU_NumDoc, \'.\') NumDoc, b.USU_CodNac CodNac \\',
      '          ";',
      'Fim;'
    ].join('\n');
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(3, 30, 3, 30),
      defaultBlockStyle: 'inicioFim'
    });
    const plan = plans.find((entry) => entry.kind === 'convertMultilineStringToConcatenation');
    expect(plan).toBeTruthy();
    expect(plan?.edits).toHaveLength(1);
  });

  it('nao oferece conversao para comandos com string multiline', () => {
    const text = [
      'SQL_DefinirComando(cCFAuxiliar, "Select USU_CodWkf,  \\',
      '                                    Decode(USU_PerSub, \'S\', \'true\', \'false\') PerSub, \\',
      '                             ");'
    ].join('\n');
    const plans = buildRefactorPlans({
      docText: text,
      selection: range(1, 20, 1, 20),
      defaultBlockStyle: 'inicioFim'
    });
    expect(plans.find((entry) => entry.kind === 'convertMultilineStringToConcatenation')).toBeUndefined();
  });

  it('localiza titulos por locale', () => {
    expect(getRefactorStrings('en-us').wrapBlock).toBe('Wrap with block');
    expect(getRefactorStrings('es').toggleBlockStyle).toBe('Alternar bloque: Inicio/Fim ↔ { }');
    expect(getRefactorStrings('pt-BR').wrapIf).toBe('Envolver com Se (...)');
    expect(getRefactorStrings('en-us').convertMultilineStringToConcatenation).toBe('Convert multiline text to concatenation');
  });
});
