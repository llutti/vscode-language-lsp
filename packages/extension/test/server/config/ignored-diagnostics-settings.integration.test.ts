import { describe, expect, it } from 'vitest';
import { loadIgnoredDiagnosticsFromSettings, readIgnoredDiagnosticValues } from '../../../src/server/config/server-settings';
import { applyIgnoreIds } from '../../../src/server/diagnostics/diagnostics-ignore';
/*
  it('mantém o ID após leitura por URI vazia e fallback global aninhado', () => {
    expect(resolveIgnoredDiagnosticValues(
      { 'lsp.diagnostics.ignoreIds': ['LSP1408'] }, null, null
    )).toEqual(['LSP1408']);

    const secondRead = resolveIgnoredDiagnosticValues(
      [],
      { diagnostics: { ignoreIds: [] } },
      { diagnostics: { ignoreIds: ['lsp1408'] } }
    );
    expect(secondRead).toEqual(['LSP1408']);
    expect(buildIgnoredList({ diagnostics: { ignoreIds: secondRead } })).toEqual(['LSP1408']);
  });

  it('REPRODUZ LOGS: não publica diagnóstico contextual já registrado como ignorado', () => {
    // O log real mostra o diagnóstico preservado na projeção contextual
    // (LSP1408), enquanto o ciclo de compilação registra ignoredSet=0.
    const configuredIgnoredIds = new Set(['LSP1408']);
    const contextualProjection = [
      { id: 'LSP1408', message: 'função não criada' }
    ];

    // Simula o estado incorreto observado: a projeção é reutilizada, mas o
    // conjunto efetivo recebido pelo caminho de publicação está vazio.
    const effectiveIgnoredIdsDuringPull = new Set<string>();
    const published = applyIgnoreIds(contextualProjection, effectiveIgnoredIdsDuringPull);

    expect(configuredIgnoredIds.has('LSP1408')).toBe(true);
    expect(published).toEqual([]);
  });
*/

describe('diagnostics ignoreIds: configuração LSP real', () => {
  it('REPRODUÇÃO DOS LOGS: deve carregar ignoreIds do escopo User retornado com chave completa', async () => {
    const connection = {
      workspace: {
        getConfiguration: async (section: unknown) => {
          if (section === 'lsp.diagnostics.ignoreIds') {
            // Simula a resposta observada para a configuração User.
            return { 'lsp.diagnostics.ignoreIds': ['LSP1408'] };
          }
          return [];
        }
      }
    };

    const result = await loadIgnoredDiagnosticsFromSettings(connection, []);

    expect([...result.get('') ?? []]).toContain('LSP1408');
  });
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

  it('reproduz User + contexto para arquivo contextual com LSP1408', async () => {
    const workspaceUri = 'file:///workspace';
    const connection = {
      workspace: {
        getConfiguration: async (section: unknown) => {
          if (section === 'lsp.diagnostics.ignoreIds') {
            return { 'lsp.diagnostics.ignoreIds': ['LSP1408'] };
          }
          if (Array.isArray(section)) {
            return [null];
          }
          return [];
        }
      }
    };

    const ignoredByScope = await loadIgnoredDiagnosticsFromSettings(
      connection,
      [{ uri: workspaceUri, name: 'workspace', index: 0 }]
    );
    const contextDiagnostics = [{ id: 'LSP1408', message: 'função não criada' }];
    const effectiveIgnored = ignoredByScope.get(workspaceUri) ?? new Set<string>();
    const projected = applyIgnoreIds(contextDiagnostics, effectiveIgnored);

    expect(effectiveIgnored.has('LSP1408')).toBe(true);
    expect(projected).toHaveLength(0);
  });

  it('mantém o ignore no SingleFile após leitura resource-scoped vazia', async () => {
    const calls: unknown[] = [];
    const connection = {
      workspace: {
        getConfiguration: async (section: unknown) => {
          calls.push(section);
          if (typeof section === 'object' && section !== null) return [];
          return { lsp: { diagnostics: { ignoreIds: ['LSP1408'] } } };
        }
      }
    };

    const first = await readIgnoredDiagnosticValues(connection, 'file:///workspace/file.lspt');
    const second = await readIgnoredDiagnosticValues(connection, 'file:///workspace/file.lspt');

    expect(first).toEqual(['LSP1408']);
    expect(second).toEqual(['LSP1408']);
    expect(calls).toHaveLength(6);
  });
});
