import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function loadGrammar() {
  const grammarPath = path.resolve(__dirname, '../../../syntaxes/lsp.tmLanguage.json');
  return JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
}

function loadPackageJson() {
  const packageJsonPath = path.resolve(__dirname, '../../../package.json');
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

describe('lsp TextMate embedded SQL grammar', () => {
  it('declares direct embedded SQL rules before generic strings', () => {
    const grammar = loadGrammar();
    const patterns = grammar.patterns as Array<Record<string, unknown>>;

    expect(patterns[0]).toMatchObject({ include: '#embedded-sql' });
    expect(patterns[1]).toMatchObject({ include: '#strings' });
  });

  it('includes dedicated SQL embedding rules for authorized direct wrappers', () => {
    const grammar = loadGrammar();
    const patterns = grammar.repository['embedded-sql'].patterns as Array<Record<string, unknown>>;
    const begins = patterns.map((pattern) => String(pattern.begin ?? ''));

    expect(begins.some((begin) => begin.includes('ExecSql'))).toBe(true);
    expect(begins.some((begin) => begin.includes('ExecSQLEx'))).toBe(true);
    expect(begins.some((begin) => begin.includes('SQL_DefinirComando'))).toBe(true);
    expect(begins.some((begin) => begin.includes('(SQL)'))).toBe(true);
    expect(patterns.every((pattern) => pattern.name === 'meta.embedded.inline.sql.lsp')).toBe(true);
  });

  it('maps embedded SQL TextMate scopes to the sql language id', () => {
    const pkg = loadPackageJson();
    const grammar = (pkg.contributes?.grammars as Array<Record<string, unknown>>)
      .find((entry) => entry.language === 'lsp') as { embeddedLanguages?: Record<string, string> } | undefined;

    expect(grammar?.embeddedLanguages?.['meta.embedded.inline.sql.lsp']).toBe('sql');
    expect(grammar?.embeddedLanguages?.['meta.embedded.block.sql.lsp']).toBe('sql');
    expect(grammar?.embeddedLanguages?.['source.sql.embedded.lsp']).toBe('sql');
  });

  it('declares a generic bind rule for any named parameter inside embedded SQL', () => {
    const grammar = loadGrammar();
    const patterns = grammar.repository['embedded-sql-content'].patterns as Array<Record<string, unknown>>;
    const bindRule = patterns.find((pattern) =>
      pattern.name === 'variable.other.bind.sql.lsp'
    ) as { match?: string } | undefined;

    expect(bindRule?.match).toBe(':[_[:alpha:]][_[:alnum:]]*');
    expect(patterns[0]).toMatchObject({ name: 'variable.other.bind.sql.lsp' });
  });
});
