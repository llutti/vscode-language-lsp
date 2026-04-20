import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('diagnostics mode default', () => {
  it('does not expose diagnostics mode setting in package contribution', () => {
    const packageJsonPath = path.join(__dirname, '..', '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      contributes?: {
        configuration?: {
          properties?: {
            'lsp.diagnostics.mode'?: { default?: string };
          };
        };
      };
    };

    const diagnosticsMode = pkg.contributes?.configuration?.properties?.['lsp.diagnostics.mode'];
    expect(diagnosticsMode).toBeUndefined();
  });

  it('does not expose lsp.format.trimTrailingWhitespace setting in package contribution', () => {
    const packageJsonPath = path.join(__dirname, '..', '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      contributes?: {
        configuration?: {
          properties?: {
            'lsp.format.trimTrailingWhitespace'?: { default?: boolean };
          };
        };
      };
    };

    const trimSetting = pkg.contributes?.configuration?.properties?.['lsp.format.trimTrailingWhitespace'];
    expect(trimSetting).toBeUndefined();
  });

  it('client initialization does not send diagnostics mode rollout option', () => {
    const extensionPath = path.join(__dirname, '..', '..', '..', 'src', 'extension.ts');
    const source = fs.readFileSync(extensionPath, 'utf8');
    expect(source.includes('diagnosticsMode')).toBe(false);
    expect(source.includes('vscodeVersion: vscode.version')).toBe(true);
  });
});
