import { describe, it, expect } from 'vitest';
import { createSourceFile } from '../../src/source/source-file';
import { parseFiles } from '../../src/parser/parser';
import { analyzeProgram } from '../../src/semantic/analyzer';
import { getAllInternalSignatures } from '../../src';
import { loadFixture } from '../fixture-loader';

async function analyze(text: string) {
  const source = createSourceFile('/tmp/test.lsp', text);
  const { program } = parseFiles([source]);
  return analyzeProgram({ contextId: 'test', system: 'HCM', program });
}

async function analyzeFixture(name: string) {
  return analyze(loadFixture(name));
}

function hasDiag(result: { diagnostics: Array<{ id: string }> }, id: string): boolean {
  return result.diagnostics.some((d) => d.id === id);
}

describe('semantic missing rules', () => {
  it('warns on use before declaration', async () => {
    const result = await analyzeFixture('use-before-decl.lsp');
    expect(hasDiag(result, 'LSP1001')).toBe(true);
  });

  it('errors on implicit Numero followed by explicit different type', async () => {
    const result = await analyzeFixture('implicit-conflict.lsp');
    expect(hasDiag(result, 'LSP1002')).toBe(true);
  });

  it('errors when assigning string literal to undeclared variable', async () => {
    const text = ['aTxt = "abc";'].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1003')).toBe(true);
  });

  it('errors when assigning string literal to non-Alfa variable', async () => {
    const text = ['Definir Numero nCod;', 'nCod = "abc";'].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1004')).toBe(true);
  });

  it('errors when assigning Alfa expression to undeclared variable', async () => {
    const text = ['Definir Alfa a1;', 'a2 = a1 + "x";'].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1005')).toBe(true);
  });

  it('errors when reading undeclared variable in Alfa concatenation', async () => {
    const text = ['Definir Alfa aAux;', 'aDatHor = aDatHoj + " " + aAux;'].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1005')).toBe(true);
  });

  it('accepts string literal assignment for Alfa variable', async () => {
    const text = ['Definir Alfa aTxt;', 'aTxt = "abc";'].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1003')).toBe(false);
    expect(hasDiag(result, 'LSP1004')).toBe(false);
  });

  it('warns on unused global variables', async () => {
    const result = await analyzeFixture('unused-global.lsp');
    expect(hasDiag(result, 'LSP1203')).toBe(true);
  });

  it('warns on unused parameters without duplicating variable-unused', async () => {
    const result = await analyzeFixture('unused-param.lsp');
    expect(hasDiag(result, 'LSP1201')).toBe(true);
    expect(hasDiag(result, 'LSP1203')).toBe(false);
  });

  it('warns when function is declared but not implemented and vice-versa', async () => {
    const result = await analyzeFixture('function-decl-impl-mismatch.lsp');
    expect(hasDiag(result, 'LSP1101')).toBe(true);
    expect(hasDiag(result, 'LSP1102')).toBe(true);
  });

  it('errors when function declarations/implementations are not global', async () => {
    const result = await analyzeFixture('function-non-global.lsp');
    expect(hasDiag(result, 'LSP1105')).toBe(true);
    expect(hasDiag(result, 'LSP1103')).toBe(true);
  });

  it('validates custom function arity', async () => {
    const result = await analyzeFixture('custom-arity.lsp');
    expect(hasDiag(result, 'LSP1401')).toBe(true);
  });

  it('warns when a custom function repeats parameter names in the same signature', async () => {
    const result = await analyze([
      'Definir Funcao fDuplicada(Numero pValor, Alfa pValor);',
      'Funcao fDuplicada(Numero pValor, Alfa pValor);',
      'Inicio',
      'Fim;'
    ].join('\n'));
    const duplicateParams = result.diagnostics.filter((d) => d.id === 'LSP1424');
    expect(duplicateParams).toHaveLength(1);
    expect(duplicateParams[0]?.message).toContain('pValor');
  });

  it('does not warn when different custom functions reuse the same parameter name', async () => {
    const result = await analyze([
      'Definir Funcao f1(Numero pValor);',
      'Funcao f1(Numero pValor);',
      'Inicio',
      'Fim;',
      'Definir Funcao f2(Alfa pValor);',
      'Funcao f2(Alfa pValor);',
      'Inicio',
      'Fim;'
    ].join('\n'));
    expect(hasDiag(result, 'LSP1424')).toBe(false);
  });

  it('emits info when END parameter is passed to a call', async () => {
    const result = await analyzeFixture('end-param-call.lsp');
    expect(hasDiag(result, 'LSP1204')).toBe(true);
  });

  it('does not emit info when END parameter is explicitly assigned', async () => {
    const result = await analyzeFixture('end-param-call-assigned.lsp');
    expect(hasDiag(result, 'LSP1204')).toBe(false);
  });

  it('does not emit info for END parameter passed to internal call', async () => {
    const result = await analyzeFixture('end-param-call-internal.lsp');
    expect(hasDiag(result, 'LSP1204')).toBe(false);
  });

  it('validates list methods and arity', async () => {
    const result = await analyzeFixture('lista-methods.lsp');
    expect(hasDiag(result, 'LSP1417')).toBe(true);
    expect(hasDiag(result, 'LSP1403')).toBe(true);
    expect(hasDiag(result, 'LSP1402')).toBe(true);
  });

  it('validates ConverteMascara rules', async () => {
    const result = await analyzeFixture('converte-mascara-rules.lsp');
    expect(hasDiag(result, 'LSP1410')).toBe(true);
    expect(hasDiag(result, 'LSP1414')).toBe(true);
    // Tipo_Dado=3 aceita Numero ou Data (sem sugestão de Data)
    expect(hasDiag(result, 'LSP1415')).toBe(false);
    expect(hasDiag(result, 'LSP1404')).toBe(false);
    expect(hasDiag(result, 'LSP1416')).toBe(true);
    expect(hasDiag(result, 'LSP1411')).toBe(true);
    expect(hasDiag(result, 'LSP1412')).toBe(true);
    expect(hasDiag(result, 'LSP1413')).toBe(true);
    // Tipo_Dado=1 com Data continua gerando mismatch Numero
    expect(hasDiag(result, 'LSP1405')).toBe(false);
  });

  it('errors when ConverteMascara destination alfa variable is not declared', async () => {
    const text = [
      'Definir Data dDatAcc;',
      'ConverteMascara(3, dDatAcc, aDatHoj, "DD/MM/YYYY");'
    ].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1411')).toBe(true);
  });

  it('errors when ConverteMascara tipo 4 source variable is not declared', async () => {
    const text = [
      'Definir Alfa aAux;',
      'ConverteMascara(4, nHorAcc, aAux, "HH:MM");'
    ].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1414')).toBe(true);
  });

  it('does not emit LSP1414 when Numero comes from END arg in custom function call', async () => {
    const text = [
      'Definir Funcao f853QtdRegistrosSituacao(Numero nNumEmp, Numero nTipCol, Data dDatRef, Numero nModo, Numero End nQtdReg);',
      'Funcao f853QtdRegistrosSituacao(Numero nNumEmp, Numero nTipCol, Data dDatRef, Numero nModo, Numero End nQtdReg);',
      'Inicio',
      '  nQtdReg = 0;',
      'Fim;',
      'Definir Numero nNumEmp;',
      'Definir Numero nTipCol;',
      'Definir Data dDatRef;',
      'Definir Alfa aQtdPerGoceMesU;',
      'f853QtdRegistrosSituacao(nNumEmp, nTipCol, dDatRef, 1, nQtdReg);',
      'ConverteMascara(1, nQtdReg, aQtdPerGoceMesU, "z9,z");'
    ].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1414')).toBe(false);
  });

  it('does not emit LSP1414 when Numero comes from END arg in internal function call', async () => {
    const text = [
      'Definir Alfa aAux;',
      'AbrirArquivo("tmp.txt", nHorAcc);',
      'ConverteMascara(4, nHorAcc, aAux, "HH:MM");'
    ].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1414')).toBe(false);
  });

  it('validates internal call arity and type mismatches', async () => {
    const text = [
      'Definir Numero n;',
      'AbrirArquivo();',
      'AbrirArquivo(n, n);'
    ].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1401')).toBe(true);
    expect(hasDiag(result, 'LSP1402')).toBe(true);
  });

  it('does not emit mismatch when internal expects Data but receives Numero', async () => {
    const sigs = await getAllInternalSignatures('HCM');
    const target = sigs.find(
      (sig) =>
        sig.params &&
        sig.params.length > 0 &&
        sig.params.some((p) => p.type === 'Data') &&
        sig.params.every((p) => ['Data', 'Numero', 'Alfa'].includes(p.type))
    );

    if (!target || !target.params) {
      throw new Error('No internal signature with Data params found for HCM');
    }

    const decls = ['Definir Numero nNum;', 'Definir Data dData;', 'Definir Alfa aAlfa;'];
    const args = target.params.map((p) => {
      if (p.type === 'Data') return 'nNum';
      if (p.type === 'Numero') return 'nNum';
      if (p.type === 'Alfa') return 'aAlfa';
      return 'nNum';
    });
    const text = [...decls, `${target.name}(${args.join(', ')});`].join('\n');

    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1407')).toBe(false);
    expect(hasDiag(result, 'LSP1402')).toBe(false);
  });

  it('does not emit mismatch when internal expects Numero but receives Data', async () => {
    const sigs = await getAllInternalSignatures('HCM');
    const target = sigs.find(
      (sig) =>
        sig.params &&
        sig.params.length > 0 &&
        sig.params.some((p) => p.type === 'Numero') &&
        sig.params.every((p) => ['Data', 'Numero', 'Alfa'].includes(p.type))
    );

    if (!target || !target.params) {
      throw new Error('No internal signature with Numero params found for HCM');
    }

    const decls = ['Definir Numero nNum;', 'Definir Data dData;', 'Definir Alfa aAlfa;'];
    const args = target.params.map((p) => {
      if (p.type === 'Data') return 'dData';
      if (p.type === 'Numero') return 'dData';
      if (p.type === 'Alfa') return 'aAlfa';
      return 'dData';
    });
    const text = [...decls, `${target.name}(${args.join(', ')});`].join('\n');

    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1407')).toBe(false);
    expect(hasDiag(result, 'LSP1402')).toBe(false);
  });

  it('emits error when calling a non-existent function', async () => {
    const text = [
      'Definir Numero n;',
      'FuncaoQueNaoExiste(n);'
    ].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1408')).toBe(true);
  });

  it('accepts VaPara when target label exists in the same file', async () => {
    const text = [
      'Definir Numero n;',
      'VaPara saida;',
      'n = 1;',
      'saida:',
      'n = 2;'
    ].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1418')).toBe(false);
  });

  it('errors when VaPara target label does not exist in the same file', async () => {
    const text = [
      'Definir Numero n;',
      'VaPara saida;',
      'n = 1;'
    ].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1418')).toBe(true);
  });

  it('does not allow VaPara in function scope to jump to global label', async () => {
    const text = [
      'saida:',
      'Definir Funcao f();',
      'Funcao f();',
      'Inicio',
      '  VaPara saida;',
      'Fim;'
    ].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1418')).toBe(true);
  });

  it('allows VaPara to function label in the same function scope', async () => {
    const text = [
      'Definir Funcao f();',
      'Funcao f();',
      'Inicio',
      '  VaPara fimf;',
      '  fimf:',
      'Fim;'
    ].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1418')).toBe(false);
  });

  it('does not allow VaPara in global scope to jump to function label', async () => {
    const text = [
      'Definir Funcao f();',
      'Funcao f();',
      'Inicio',
      '  interno:',
      'Fim;',
      'VaPara interno;'
    ].join('\n');
    const result = await analyze(text);
    expect(hasDiag(result, 'LSP1418')).toBe(true);
  });
});
