import { describe, expect, it } from 'vitest';
import type { InternalSignatureDoc, SymbolInfo } from '@lsp/compiler';

import { formatCustomSymbolHover, formatInternalSignatureHover, formatParamLabel } from '../../../src/server/language/hover-render';

describe('hover render', () => {
  it('formats params with End marker', () => {
    expect(formatParamLabel({ type: 'Numero', name: 'pRet', isReturnValue: true })).toBe('Numero End pRet');
  });

  it('renders internal signature markdown with docs and link', () => {
    const sig: InternalSignatureDoc = {
      name: 'Mensagem',
      originSystem: 'SENIOR',
      dataType: 'Alfa',
      isReturnValue: true,
      params: [{ name: 'Tipo', type: 'Alfa', isReturnValue: false }, { name: 'Texto', type: 'Alfa', isReturnValue: true }],
      documentation: 'Linha 1\nLinha 2',
      docUrl: 'https://example.invalid/mensagem',
      docVersion: '6.10.4'
    };
    const markdown = formatInternalSignatureHover(sig, () => '[Senior] ');
    expect(markdown).toContain('```lsp');
    expect(markdown).toContain('[Senior] Mensagem(Alfa Tipo, Alfa End Texto): Alfa');
    expect(markdown).toContain('Linha 1');
    expect(markdown).toContain('[Documentação oficial (6.10.4)](https://example.invalid/mensagem)');
  });

  it('renders custom function and variable hover markdown', () => {
    const fn: SymbolInfo = {
      kind: 'function',
      name: 'MinhaFuncao',
      nameNormalized: 'minhafuncao',
      typeName: 'Funcao',
      sourcePath: '/tmp/test.lspt',
      params: [
        {
          name: 'p1',
          nameNormalized: 'p1',
          typeName: 'Alfa',
          isEnd: false,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 2 } }
        }
      ]
    };
    const variable: SymbolInfo = {
      kind: 'variable',
      name: 'aNome',
      nameNormalized: 'anome',
      typeName: 'Alfa',
      sourcePath: '/tmp/test.lspt'
    };

    expect(formatCustomSymbolHover(fn)).toContain('[CUSTOMIZADO] MinhaFuncao(Alfa p1)');
    expect(formatCustomSymbolHover(variable)).toContain('[CUSTOMIZADO] Definir Alfa aNome;');
  });

  it('renders table hover with occurrences and columns summary', () => {
    const table: SymbolInfo = {
      kind: 'variable',
      name: 've_CodHor',
      nameNormalized: 've_codhor',
      typeName: 'Tabela',
      sourcePath: '/tmp/test.lspt',
      tableOccurrences: 100,
      tableColumns: [
        { name: 'Nome', typeName: 'Alfa', size: 30 },
        { name: 'Codigo', typeName: 'Numero' }
      ]
    };
    const markdown = formatCustomSymbolHover(table);
    expect(markdown).toContain('[CUSTOMIZADO] Definir Tabela ve_CodHor[100] = {');
    expect(markdown).toContain('Alfa Nome[30];');
    expect(markdown).toContain('Numero Codigo;');
  });

  it('renders internal variable hover markdown', () => {
    const sig: InternalSignatureDoc = {
      name: 'WEB_HTML',
      originSystem: 'HCM',
      symbolKind: 'internal',
      dataType: 'Alfa',
      isReturnValue: undefined,
      documentation: 'Conteúdo HTML de saída.'
    };
    const markdown = formatInternalSignatureHover(sig, () => '[HCM] ');
    expect(markdown).toContain('```lsp');
    expect(markdown).toContain('[HCM] Definir Alfa WEB_HTML;');
    expect(markdown).toContain('Conteúdo HTML de saída.');
  });

  it('keeps markdown contract stable (snapshot)', () => {
    const internalFn: InternalSignatureDoc = {
      name: 'Mensagem',
      originSystem: 'SENIOR',
      dataType: 'Alfa',
      isReturnValue: true,
      params: [{ name: 'Tipo', type: 'Alfa', isReturnValue: false }, { name: 'Texto', type: 'Alfa', isReturnValue: true }],
      documentation: 'Linha 1\nLinha 2',
      docUrl: 'https://example.invalid/mensagem',
      docVersion: '6.10.4'
    };
    const internalVar: InternalSignatureDoc = {
      name: 'WEB_HTML',
      originSystem: 'HCM',
      symbolKind: 'internal',
      dataType: 'Alfa',
      isReturnValue: undefined,
      documentation: 'Conteúdo HTML de saída.'
    };
    const customFn: SymbolInfo = {
      kind: 'function',
      name: 'MinhaFuncao',
      nameNormalized: 'minhafuncao',
      typeName: 'Funcao',
      sourcePath: '/tmp/test.lspt',
      params: [
        {
          name: 'p1',
          nameNormalized: 'p1',
          typeName: 'Alfa',
          isEnd: false,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 2 } }
        }
      ]
    };
    const customVar: SymbolInfo = {
      kind: 'variable',
      name: 'aNome',
      nameNormalized: 'anome',
      typeName: 'Alfa',
      sourcePath: '/tmp/test.lspt'
    };

    const snapshotPayload = {
      internalFn: formatInternalSignatureHover(internalFn, () => '[Senior] '),
      internalVar: formatInternalSignatureHover(internalVar, () => '[HCM] '),
      customFn: formatCustomSymbolHover(customFn),
      customVar: formatCustomSymbolHover(customVar)
    };
    expect(snapshotPayload).toMatchSnapshot();
  });
});
