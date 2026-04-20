import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

describe('diagnostics pull-only contract', () => {
  it('uses only textDocument/diagnostic and removes diagnostics mode rollout', () => {
    const serverPath = path.join(__dirname, '..', '..', '..', 'src', 'server.ts');
    const source = fs.readFileSync(serverPath, 'utf8');
    expect(source.includes('connection.languages.diagnostics.on(')).toBe(false);
    expect(source.includes('DiagnosticsMode')).toBe(false);
    expect(source.includes('pullDiagnosticsEnabled')).toBe(false);
    expect(source.includes('textDocument/diagnostic')).toBe(true);
  });
});
