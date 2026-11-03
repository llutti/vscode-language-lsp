import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileSingleFile } from '@lsp/compiler';
import { filterFallbackDiagnostics } from '../../../src/server/diagnostics/pull-diagnostics-service';
import { mergeIgnoreIds } from '../../../src/server/diagnostics/diagnostics-ignore';

async function compileObservedSingleFile() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-observed-singlefile-'));
  const filePath = path.join(root, 'outside-context.lspt');
  const text = ['Definir Numero n;', 'FuncaoQueNaoExiste(n);'].join('\\n');
  fs.writeFileSync(filePath, text, 'utf8');
  const result = await compileSingleFile({ filePath, text, system: 'HCM', includeSemantics: true });
  return result.diagnostics.map((diag) => ({ code: diag.id, message: diag.message }));
}

describe('SingleFile/Fallback: ignoreIds', () => {
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
