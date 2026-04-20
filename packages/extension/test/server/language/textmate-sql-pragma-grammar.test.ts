import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function loadGrammar() {
  const grammarPath = path.resolve(__dirname, '../../../syntaxes/lsp.tmLanguage.json');
  return JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
}

describe('lsp TextMate SQL pragma grammar', () => {
  it('highlights SQL pragmas with a dedicated scope instead of the generic line comment scope', () => {
    const grammar = loadGrammar();
    const patterns = grammar.repository.comments.patterns as Array<Record<string, unknown>>;
    const pragmaRule = patterns.find((pattern) =>
      typeof pattern.match === 'string' && pattern.match.includes('lsp-sql-(')
    ) as { name?: string; match?: string; captures?: Record<string, { name?: string }> } | undefined;

    expect(pragmaRule?.name).toBe('meta.annotation.sql-pragma.lsp');
    expect(pragmaRule?.match).toContain('lsp-sql-');
    expect(pragmaRule?.captures?.['1']?.name).toBe('keyword.control.directive.sql-pragma.lsp');
    expect(pragmaRule?.captures?.['2']?.name).toBe('entity.name.type.sql-pragma.lsp');
  });

  it('keeps the generic line comment rule after the dedicated SQL pragma rule', () => {
    const grammar = loadGrammar();
    const patterns = grammar.repository.comments.patterns as Array<Record<string, unknown>>;

    expect(patterns[0]).toMatchObject({ name: 'meta.annotation.sql-pragma.lsp' });
    expect(patterns[1]).toMatchObject({ name: 'comment.line.lsp' });
  });
});
