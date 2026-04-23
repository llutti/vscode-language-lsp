import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { SemanticOccurrence } from '@lsp/compiler';

import { shouldSuppressSemanticTokenForTextmate } from '../../../src/server/semantics/highlight-suppression';

function occ(tokenType: SemanticOccurrence['tokenType'], line: number, start: number, end: number, tokenModifiers: string[] = []): SemanticOccurrence {
  return {
    sourcePath: '/tmp/test.lspt',
    range: {
      start: { line, character: start },
      end: { line, character: end }
    },
    tokenType,
    tokenModifiers: tokenModifiers as SemanticOccurrence['tokenModifiers']
  };
}

describe('highlight suppression', () => {
  it('suppresses defaultLibrary methods to preserve TextMate method scope', () => {
    const doc = TextDocument.create('file:///test.lspt', 'lsp', 1, 'c.AbrirCursor();');
    const occurrence = occ('method', 0, 2, 13, ['defaultLibrary']);
    expect(shouldSuppressSemanticTokenForTextmate(doc, occurrence)).toBe(true);
  });

  it('suppresses TextMate-priority keywords when emitted semantically', () => {
    const doc = TextDocument.create('file:///test.lspt', 'lsp', 1, 'IniciarTransacao;');
    const occurrence = occ('function', 0, 0, 16);
    expect(shouldSuppressSemanticTokenForTextmate(doc, occurrence)).toBe(true);
  });

  it('does not suppress regular user identifiers', () => {
    const doc = TextDocument.create('file:///test.lspt', 'lsp', 1, 'MinhaFuncao(a);');
    const occurrence = occ('function', 0, 0, 10);
    expect(shouldSuppressSemanticTokenForTextmate(doc, occurrence)).toBe(false);
  });

  it('suppresses Mensagem first-argument mode keywords to preserve TextMate contextual scope', () => {
    const doc = TextDocument.create('file:///test.lspt', 'lsp', 1, 'Mensagem(Erro, "falha");');
    const occurrence = occ('variable', 0, 9, 13);
    expect(shouldSuppressSemanticTokenForTextmate(doc, occurrence)).toBe(true);
  });

  it('does not suppress mode-like identifiers outside Mensagem first argument', () => {
    const doc = TextDocument.create('file:///test.lspt', 'lsp', 1, 'Erro = 1;');
    const occurrence = occ('variable', 0, 0, 4);
    expect(shouldSuppressSemanticTokenForTextmate(doc, occurrence)).toBe(false);
  });
});
