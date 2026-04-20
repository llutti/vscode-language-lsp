import { describe, it, expect } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { formatDocument } from '../../../src/formatting';

const settings = {
  enabled: true,
  indentSize: 2,
  useTabs: false,
  maxParamsPerLine: 4,
  embeddedSqlEnabled: false,
  embeddedSqlDialect: 'sql' as const
};

describe('formatDocument', () => {
  it('returns empty edits when disabled', () => {
    const doc = TextDocument.create('file:///test.lspt', 'lsp', 1, 'Se(a=1)Inicio\na=1;\nFim;');
    const edits = formatDocument(doc, { ...settings, enabled: false });
    expect(edits).toEqual([]);
  });

  it('returns a single full-document TextEdit', () => {
    const doc = TextDocument.create(
      'file:///test.lspt',
      'lsp',
      1,
      'Definir    Numero    n;\n\nSe(n=1)Inicio\n  n=1;\nFim;\n'
    );
    const edits = formatDocument(doc, settings);

    // Per milestone: formatting must return a single edit replacing the entire document.
    expect(edits).toHaveLength(1);

    const edit = edits[0];
    expect(edit.range.start.line).toBe(0);
    expect(edit.range.start.character).toBe(0);

    const end = doc.positionAt(doc.getText().length);
    expect(edit.range.end.line).toBe(end.line);
    expect(edit.range.end.character).toBe(end.character);

    expect(typeof edit.newText).toBe('string');
  });

  it('preserves CRLF when document uses CRLF', () => {
    const original = 'Definir    Numero    n;\r\nSe(n=1)Inicio\r\nn=1;\r\nFim;\r\n';
    const doc = TextDocument.create('file:///test.lspt', 'lsp', 1, original);

    const edits = formatDocument(doc, settings);
    expect(edits).toHaveLength(1);

    const newText = edits[0].newText;

    // Must contain CRLF
    expect(newText).toContain('\r\n');
    // Must not contain any lone LF (LF not preceded by CR)
    expect(newText).not.toMatch(/(^|[^\r])\n/);
  });

  it('does not emit edits when syntax is invalid', () => {
    const doc = TextDocument.create('file:///test.lspt', 'lsp', 1, 'Funcao X(;\nInicio\nFim;\n');
    const edits = formatDocument(doc, settings);
    expect(edits).toEqual([]);
  });


  it('accepts Oracle and SQL Server embedded SQL dialects', () => {
    const oracleDoc = TextDocument.create(
      'file:///oracle.lspt',
      'lsp',
      1,
      'ExecSql "SELECT NVL(campo1,campo2) FROM Tabela WHERE campo3=:valor";'
    );
    const sqlServerDoc = TextDocument.create(
      'file:///sqlserver.lspt',
      'lsp',
      1,
      'ExecSql "SELECT TOP 10 campo1 FROM Tabela WHERE campo2=:valor ORDER BY campo1";'
    );

    expect(formatDocument(oracleDoc, { ...settings, embeddedSqlEnabled: true, embeddedSqlDialect: 'oracle' })).toHaveLength(1);
    expect(formatDocument(sqlServerDoc, { ...settings, embeddedSqlEnabled: true, embeddedSqlDialect: 'sqlserver' })).toHaveLength(1);
  });

  it('formats embedded SQL only when enabled', () => {
    const original = 'ExecSql "SELECT campo1,campo2 FROM Tabela WHERE campo3=1";\n';
    const doc = TextDocument.create('file:///test.lspt', 'lsp', 1, original);

    expect(formatDocument(doc, settings)).toEqual([]);

    const edits = formatDocument(doc, { ...settings, embeddedSqlEnabled: true });
    expect(edits).toHaveLength(1);
    expect(edits[0]?.newText).toContain('ExecSql "SELECT \\');
    expect(edits[0]?.newText).toContain('campo1, \\');
    expect(edits[0]?.newText).toContain('WHERE \\');
  });
});
