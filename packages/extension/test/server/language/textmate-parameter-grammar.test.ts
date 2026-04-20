import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function loadGrammar() {
  const grammarPath = path.resolve(__dirname, '../../../syntaxes/lsp.tmLanguage.json');
  return JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
}

describe('lsp TextMate parameter grammar', () => {
  it('uses a parameter rule anchored to parameter separators', () => {
    const grammar = loadGrammar();
    const patterns = grammar.repository.keywords.patterns as Array<Record<string, unknown>>;
    const parameterRule = patterns.find((pattern) =>
      typeof pattern.match === 'string'
      && pattern.match.includes('([,(])')
      && JSON.stringify(pattern).includes('variable.parameter.lsp')
    ) as { match?: string; captures?: Record<string, { name?: string }> } | undefined;

    expect(parameterRule?.match).toContain('([,(])');
    expect(parameterRule?.captures?.['4']?.name).toBe('variable.parameter.lsp');
  });

  it('does not keep the legacy broad numero-parameter rule', () => {
    const grammar = loadGrammar();
    const patterns = grammar.repository.keywords.patterns as Array<Record<string, unknown>>;
    const legacyRule = patterns.find(
      (pattern) =>
        typeof pattern.match === 'string' &&
        pattern.match.includes('(?i:(numero))') &&
        JSON.stringify(pattern).includes('variable.parameter.lsp')
    );

    expect(legacyRule).toBeUndefined();
  });
});
