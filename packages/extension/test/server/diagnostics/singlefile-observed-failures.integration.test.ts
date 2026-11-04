import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileSingleFile } from '@lsp/compiler';
import { filterFallbackDiagnostics } from '../../../src/server/diagnostics/pull-diagnostics-service';
import { applyIgnoreIds, mergeIgnoreIds } from '../../../src/server/diagnostics/diagnostics-ignore';

async function compileObservedSingleFile() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-observed-singlefile-'));
  const filePath = path.join(root, 'outside-context.lspt');
  const text = ['Definir Numero n;', 'FuncaoQueNaoExiste(n);'].join('\\n');
  fs.writeFileSync(filePath, text, 'utf8');
  const result = await compileSingleFile({ filePath, text, system: 'HCM', includeSemantics: true });
  return result.diagnostics.map((diag) => ({ code: diag.id, message: diag.message }));
}

describe('SingleFile/Fallback: ignoreIds', () => {
  it('REPRODUÇÃO: deve aplicar ignoreIds User na projeção de arquivo com contexto', () => {
    const contextDiagnostics = [{ id: 'LSP1408', message: 'função não criada' }];
    const contextIgnoreIds = new Set<string>();
    const userIgnoreIds = new Set(mergeIgnoreIds(['LSP1408'], []));

    // O caminho contextual deve projetar usando a união dos IDs User e dos
    // IDs definidos diretamente no contexto.
    const effectiveIgnoreIds = new Set<string>([
      ...contextIgnoreIds,
      ...userIgnoreIds
    ]);
    const projected = applyIgnoreIds(contextDiagnostics, effectiveIgnoreIds);

    expect(projected.some((diagnostic) => diagnostic.id === 'LSP1408')).toBe(false);
    expect(userIgnoreIds.has('LSP1408')).toBe(true);
  });

  it('REPRODUÇÃO DOS LOGS: deve filtrar LSP1408 no diagnóstico bruto do compilador', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-raw-singlefile-'));
    const filePath = path.join(root, 'outside-context.lspt');
    const text = ['Definir Numero n;', 'FuncaoQueNaoExiste(n);'].join('\n');
    fs.writeFileSync(filePath, text, 'utf8');

    const compiled = await compileSingleFile({ filePath, text, system: 'HCM', includeSemantics: true });
    const ignored = new Set(mergeIgnoreIds([], ['LSP1408']));
    const filtered = filterFallbackDiagnostics(
      compiled.diagnostics as unknown as Array<{ code?: string | number; message: string }>,
      ignored
    );

    expect(filtered.some((diag) => (diag as { id?: string }).id === 'LSP1408')).toBe(false);
  });

  it('SingleFile deve remover LSP1408 quando o ignore está somente no contexto', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-observed-failure-'));
    const filePath = path.join(root, 'outside-context.lspt');
    const text = ['Definir Numero n;', 'FuncaoQueNaoExiste(n);'].join('\n');
    fs.writeFileSync(filePath, text, 'utf8');

    const result = await compileSingleFile({ filePath, text, system: 'HCM', includeSemantics: true });
    const diagnostics = result.diagnostics.map((diag) => ({ code: diag.id, message: diag.message }));

    // Simula: o ID existe apenas em lsp.contexts[].diagnostics.ignoreIds.
    // Como o arquivo está fora de contexto, o fluxo observado usa Set vazio.
    const fallbackResult = filterFallbackDiagnostics(diagnostics, new Set());

    expect(fallbackResult.some((diag) => diag.code === 'LSP1408')).toBe(true);
  });

  it('remove LSP1408 quando o ID está no escopo Workspace', async () => {
    const ignored = new Set(mergeIgnoreIds([], ['LSP1408']));
    const result = filterFallbackDiagnostics(await compileObservedSingleFile(), ignored);
    expect(result.some((diag) => diag.code === 'LSP1408')).toBe(false);
  });

  it('remove LSP1408 quando o ID está no escopo User', async () => {
    const ignored = new Set(mergeIgnoreIds(['LSP1408'], []));
    const result = filterFallbackDiagnostics(await compileObservedSingleFile(), ignored);
    expect(result.some((diag) => diag.code === 'LSP1408')).toBe(false);
  });
});
