import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { collectEmbeddedSqlSemanticOccurrences } from '@lsp/compiler';
import { prepareSemanticOccurrences } from '../../../src/server/semantics/semantic-payload';

function getLineSegments(text: string, line: number) {
  const doc = TextDocument.create('file:///test.lspt', 'lsp', 1, text);
  const occurrences = collectEmbeddedSqlSemanticOccurrences({
    sourcePath: '/tmp/test.lspt',
    text,
    dialect: 'oracle'
  });
  return prepareSemanticOccurrences(doc, occurrences)
    .filter((occ) => occ.range.start.line === line && occ.range.end.line === line)
    .map((occ) => ({
      tokenType: occ.tokenType,
      start: occ.range.start.character,
      end: occ.range.end.character
    }));
}

describe('embedded SQL semantic payload preparation', () => {
  it('splits the base SQL string token around controlled lexical SQL tokens', () => {
    const text = 'ExecSql "SELECT NVL(Tabela.Campo, :pValor) FROM Tabela WHERE Tabela.Id = :pId";';
    const segments = getLineSegments(text, 0);

    const stringSegments = segments.filter((segment) => segment.tokenType === 'string');
    const lexicalSegments = segments.filter((segment) => segment.tokenType !== 'string');

    expect(lexicalSegments.some((segment) => segment.tokenType === 'keyword')).toBe(true);
    expect(lexicalSegments.some((segment) => segment.tokenType === 'function')).toBe(true);
    expect(lexicalSegments.some((segment) => segment.tokenType === 'property')).toBe(true);
    expect(lexicalSegments.some((segment) => segment.tokenType === 'parameter')).toBe(true);

    for (const stringSegment of stringSegments)
    {
      expect(
        lexicalSegments.some((segment) => !(segment.end <= stringSegment.start || segment.start >= stringSegment.end))
      ).toBe(false);
    }
  });
});
