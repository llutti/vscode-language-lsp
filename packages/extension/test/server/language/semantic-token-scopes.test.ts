import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type ExtensionPackage = {
  contributes?: {
    semanticTokenScopes?: Array<{
      language?: string;
      scopes?: Record<string, string[]>;
    }>;
  };
};

function loadSemanticScopes(): Record<string, string[]>
{
  const packageJsonPath = path.resolve(__dirname, '../../../package.json');
  const raw = fs.readFileSync(packageJsonPath, 'utf8');
  const pkg = JSON.parse(raw) as ExtensionPackage;
  return pkg.contributes?.semanticTokenScopes?.find((entry) => entry.language === 'lsp')?.scopes ?? {};
}

describe('semantic token scopes', () =>
{
  it('maps global variables to a dedicated semantic scope chain', () =>
  {
    const scopes = loadSemanticScopes();
    expect(scopes['variable.static']).toEqual([
      'support.variable.global.lsp',
      'support.variable.lsp',
      'entity.name.type.lsp',
      'entity.name.type'
    ]);
    expect(scopes['variable.declaration.static']).toEqual([
      'support.variable.global.lsp',
      'support.variable.lsp',
      'entity.name.type.lsp',
      'entity.name.type'
    ]);
  });

  it('maps END parameters to a dedicated semantic scope chain', () =>
  {
    const scopes = loadSemanticScopes();
    expect(scopes['parameter.defaultLibrary']).toEqual([
      'variable.parameter.sql',
      'variable.parameter',
      'support.variable.parameter.lsp',
      'support.variable.lsp',
      'variable.parameter.lsp'
    ]);
    expect(scopes['parameter.defaultLibrary.declaration']).toEqual([
      'variable.parameter.sql',
      'variable.parameter',
      'support.variable.parameter.lsp',
      'support.variable.lsp',
      'variable.parameter.lsp'
    ]);
    expect(scopes['parameter.readonly.defaultLibrary']).toEqual([
      'variable.parameter.sql',
      'variable.parameter',
      'support.variable.parameter.lsp',
      'support.variable.lsp',
      'variable.parameter.lsp'
    ]);
  });

  it('maps embedded SQL string tokens to a dedicated scope chain', () =>
  {
    const scopes = loadSemanticScopes();
    expect(scopes['string.defaultLibrary']).toEqual([
      'string.quoted.single.sql',
      'string.quoted.sql',
      'string',
      'source.sql.embedded.lsp',
      'meta.embedded.inline.sql.lsp',
      'string.quoted.double.sql.lsp',
      'string.quoted.double.lsp'
    ]);
    expect(scopes['string.defaultLibrary.readonly']).toEqual([
      'string.quoted.single.sql',
      'string.quoted.sql',
      'string',
      'meta.embedded.block.sql.lsp',
      'source.sql.embedded.lsp',
      'meta.embedded.inline.sql.lsp',
      'markup.raw.sql.lsp',
      'string.quoted.double.sql.lsp',
      'string.quoted.double.lsp'
    ]);
    expect(scopes['string.readonly.defaultLibrary']).toEqual(scopes['string.defaultLibrary.readonly']);
  });

  it('maps embedded SQL keyword, function and bind tokens to dedicated scope chains', () =>
  {
    const scopes = loadSemanticScopes();
    expect(scopes['keyword.defaultLibrary']).toEqual([
      'keyword.other.sql',
      'keyword.control.sql.lsp',
      'keyword.other.sql.lsp',
      'keyword.control.lsp'
    ]);
    expect(scopes['function.defaultLibrary']).toEqual([
      'support.function.sql.lsp',
      'entity.name.function.sql.lsp',
      'support.function.lsp',
      'entity.name.function.lsp'
    ]);
    expect(scopes['parameter.readonly.defaultLibrary']).toEqual([
      'variable.parameter.sql',
      'variable.parameter',
      'support.variable.parameter.lsp',
      'support.variable.lsp',
      'variable.parameter.lsp'
    ]);
  });

  it('declares embedded SQL highlight and dialect settings explicitly', () =>
  {
    const packageJsonPath = path.resolve(__dirname, '../../../package.json');
    const raw = fs.readFileSync(packageJsonPath, 'utf8');
    const pkg = JSON.parse(raw) as {
      contributes?: { configuration?: { properties?: Record<string, { default?: unknown; enum?: string[] }> } };
    };
    expect(pkg.contributes?.configuration?.properties?.['lsp.semantic.embeddedSqlHighlight.enabled']?.default).toBe(false);
    expect(pkg.contributes?.configuration?.properties?.['lsp.format.embeddedSql.dialect']?.enum).toEqual([
      'sql',
      'oracle',
      'sqlserver'
    ]);
  });
});
