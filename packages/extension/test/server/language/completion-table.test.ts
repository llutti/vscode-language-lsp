import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function loadServerSource(): string
{
  const serverPath = path.join(__dirname, '..', '..', '..', 'src', 'server', 'register-language-handlers.ts');
  return fs.readFileSync(serverPath, 'utf8');
}

describe('table completion', () =>
{
  it('offers table columns as property completions after dot', () =>
  {
    const source = loadServerSource();
    expect(source.includes("if (ownerSym?.typeName === 'Tabela')")).toBe(true);
    expect(source.includes('ownerSym.tableColumns ?? []')).toBe(true);
    expect(source.includes('CompletionItemKind.Property')).toBe(true);
  });

  it('supports member completion for indexed owners like tabela[idx].Campo', () =>
  {
    const source = loadServerSource();
    expect(source.includes('const memberMatch = /([A-Za-z_][\\w]*)(?:\\[[^\\]]*\\])?\\.([A-Za-z_]*)$/.exec(linePrefix);')).toBe(true);
  });

  it('requires index for Tabela member completion', () =>
  {
    const source = loadServerSource();
    expect(source.includes('const hasIndexedOwner = /[A-Za-z_][\\w]*\\[[^\\]]+\\]\\.[A-Za-z_]*$/.test(linePrefix);')).toBe(true);
    expect(source.includes('if (!hasIndexedOwner) return [];')).toBe(true);
  });
});
