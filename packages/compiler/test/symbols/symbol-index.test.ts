import { describe, it, expect } from 'vitest';
import { getContextSymbols } from '../../src';

describe('symbol index', () => {
  it('extracts cursor fields from Cursor.SQL SELECT', async () => {
    const symbols = await getContextSymbols({
      name: 'cursor',
      rootDir: 'test/fixtures',
      filePattern: 'cursor-select.lsp',
      includeSubdirectories: false,
      system: 'HCM'
    });

    const cursor = symbols.find((s) => s.kind === 'variable' && s.nameNormalized === 'cur');
    expect(cursor).toBeTruthy();
    expect(cursor?.cursorFields).toEqual(expect.arrayContaining(['campo1', 'Alias']));
  });

  it('extracts table schema metadata from structured declaration', async () => {
    const symbols = await getContextSymbols({
      name: 'table',
      rootDir: 'test/fixtures',
      filePattern: 'table-decl.lsp',
      includeSubdirectories: false,
      system: 'HCM'
    });

    const table = symbols.find((s) => s.kind === 'variable' && s.nameNormalized === 've_codhor');
    expect(table).toBeTruthy();
    expect(table?.tableOccurrences).toBe(100);
    expect(table?.tableColumns).toEqual(
      expect.arrayContaining([
        { name: 'Nome', typeName: 'Alfa', size: 30 },
        { name: 'Codigo', typeName: 'Numero', size: undefined }
      ])
    );
  });

  it('extracts table schema metadata from declaration inside function body', async () => {
    const symbols = await getContextSymbols({
      name: 'table-local',
      rootDir: 'test/fixtures',
      filePattern: 'table-decl-local.lsp',
      includeSubdirectories: false,
      system: 'HCM'
    });

    const table = symbols.find((s) => s.kind === 'variable' && s.nameNormalized === 've_codhor');
    expect(table).toBeTruthy();
    expect(table?.typeName).toBe('Tabela');
    expect(table?.tableOccurrences).toBe(100);
    expect(table?.tableColumns?.length).toBe(2);
  });
});
