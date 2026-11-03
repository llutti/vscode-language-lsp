import { describe, expect, it } from 'vitest';
import { loadIgnoredDiagnosticsFromSettings } from '../../../src/server/config/server-settings';

describe('diagnostics ignoreIds: configuração LSP real', () => {
  it('reproduz resposta de configuração com chave pontuada no objeto lsp', async () => {
    const workspaceUri = 'file:///workspace';
    const connection = {
      workspace: {
        getConfiguration: async (section: unknown) => {
          if (section === 'lsp.diagnostics.ignoreIds') {
            return { 'diagnostics.ignoreIds': ['LSP1408'] };
          }
          return [{ 'diagnostics.ignoreIds': ['LSP1408'] }];
        }
      }
    };

    const result = await loadIgnoredDiagnosticsFromSettings(
      connection,
      [{ uri: workspaceUri, name: 'workspace', index: 0 }]
    );

    // A resposta pontuada representa o valor efetivo que o cliente pode
    // devolver para uma configuração resource-scoped. O fallback precisa
    // receber LSP1408, não um conjunto vazio.
    expect([...result.get(workspaceUri) ?? []]).toEqual(['LSP1408']);
  });
});
