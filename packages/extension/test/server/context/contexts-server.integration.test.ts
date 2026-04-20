import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function loadServerSource(): string
{
  const serverPath = path.join(__dirname, '..', '..', '..', 'src', 'server.ts');
  return fs.readFileSync(serverPath, 'utf8');
}

describe('server contexts loading', () =>
{
  it('merges global and workspace contexts for each workspace folder', () =>
  {
    const source = loadServerSource();
    expect(source.includes("const requests: Array<{ scopeUri?: string; section: 'lsp.contexts' }> = [{ section: 'lsp.contexts' }];")).toBe(true);
    expect(source.includes('const globalContexts = configs[0] ?? [];')).toBe(true);
    expect(source.includes('const workspaceContexts = configs[i + 1] ?? [];')).toBe(true);
    expect(source.includes('const list = [...workspaceContexts, ...globalContexts];')).toBe(true);
  });
});
