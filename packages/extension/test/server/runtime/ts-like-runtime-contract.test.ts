import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function loadSource(relativePath: string): string {
  const filePath = path.join(__dirname, '..', '..', '..', 'src', relativePath);
  return fs.readFileSync(filePath, 'utf8');
}

describe('TS-like runtime contract', () => {
  it('advertises document formatting and disables range formatting', () => {
    const source = loadSource(path.join('server', 'register-lifecycle-handlers.ts'));
    expect(source.includes('documentFormattingProvider: true')).toBe(true);
    expect(source.includes('documentRangeFormattingProvider: false')).toBe(true);
  });

  it('does not register a range formatting handler', () => {
    const source = `${loadSource('server.ts')}\n${loadSource(path.join('server', 'register-format-handlers.ts'))}`;
    expect(source.includes('onDocumentRangeFormatting')).toBe(false);
  });

  it('keeps semantic tokens in full/delta mode only (no range contract)', () => {
    const source = `${loadSource(path.join('server', 'register-lifecycle-handlers.ts'))}\n${loadSource(path.join('server', 'register-semantic-handlers.ts'))}`;
    expect(source.includes('semanticTokensProvider')).toBe(true);
    expect(source.includes('full: { delta: true }')).toBe(true);
    expect(source.includes('range: false')).toBe(true);
  });

  it('keeps diagnostics pull contract active', () => {
    const source = `${loadSource(path.join('server', 'register-lifecycle-handlers.ts'))}\n${loadSource(path.join('server', 'register-diagnostics-handlers.ts'))}`;
    expect(source.includes("onRequest('textDocument/diagnostic'")).toBe(true);
    expect(source.includes('diagnosticProvider: { interFileDependencies: true, workspaceDiagnostics: false }')).toBe(true);
  });

  it('propagates window focus changes so background follow-ups can be suppressed', () => {
    const clientSource = loadSource('extension.ts');
    const serverSource = `${loadSource('server.ts')}\n${loadSource(path.join('server', 'register-lifecycle-handlers.ts'))}`;
    expect(clientSource.includes("sendNotification('lsp/windowFocusChanged'")).toBe(true);
    expect(serverSource.includes("onNotification('lsp/windowFocusChanged'")).toBe(true);
    expect(serverSource.includes('window-unfocused')).toBe(true);
  });
});
