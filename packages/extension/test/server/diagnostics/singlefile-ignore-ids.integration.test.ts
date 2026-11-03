import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileSingleFile } from '@lsp/compiler';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { createPullDiagnosticsService } from '../../../src/server/diagnostics/pull-diagnostics-service';
import { filterFallbackDiagnostics } from '../../../src/server/diagnostics/pull-diagnostics-service';
import { applyIgnoreIds, mergeIgnoreIds } from '../../../src/server/diagnostics/diagnostics-ignore';

describe('diagnostics ignoreIds: SingleFile/Fallback', () => {
  it('remove IDs ignorados independentemente de maiúsculas/minúsculas', () => {
    const diagnostics = [
      { code: 'LSP1101', message: 'declaração não implementada' },
      { code: 'lsp1408', message: 'diagnóstico ignorado em minúsculas' },
      { code: 'LSP1411', message: 'deve permanecer' }
    ];

    expect(filterFallbackDiagnostics(diagnostics, new Set(['LSP1101', 'LSP1408']))).toEqual([
      { code: 'LSP1411', message: 'deve permanecer' }
    ]);
  });

  it('não remove diagnóstico sem código', () => {
    const diagnostics = [
      { message: 'sem código' },
      { code: 'LSP1101', message: 'ignorado' }
    ];

    expect(filterFallbackDiagnostics(diagnostics, new Set(['LSP1101']))).toEqual([
      { message: 'sem código' }
    ]);
  });

  it('mantém o mesmo resultado do filtro usado no caminho com contexto', () => {
    const diagnostics = [
      { id: 'LSP1101', message: 'a' },
      { id: 'LSP1408', message: 'b' },
      { id: 'LSP1411', message: 'c' }
    ];
    const ignored = new Set(mergeIgnoreIds(['lsp1101'], [' LSP1408 ']));

    expect(applyIgnoreIds(diagnostics, ignored)).toEqual([
      { id: 'LSP1411', message: 'c' }
    ]);
  });

  it('reproduz o fluxo real: cria SingleFile com LSP1408 e remove após ignore Workspace/User', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-singlefile-ignore-'));
    const filePath = path.join(root, 'singlefile.lspt');
    const text = [
      'Definir Numero n;',
      'FuncaoQueNaoExiste(n);'
    ].join('\n');
    fs.writeFileSync(filePath, text, 'utf8');

    const compiled = await compileSingleFile({
      filePath,
      text,
      system: 'HCM',
      includeSemantics: true
    });
    const diagnostics = compiled.diagnostics.map((diag) => ({
      code: diag.id,
      message: diag.message
    }));

    expect(diagnostics.some((diag) => diag.code === 'LSP1408')).toBe(true);

    const withoutIgnore = filterFallbackDiagnostics(diagnostics, new Set());
    expect(withoutIgnore.some((diag) => diag.code === 'LSP1408')).toBe(true);

    const workspaceIgnore = new Set(mergeIgnoreIds([], ['LSP1408']));
    expect(filterFallbackDiagnostics(diagnostics, workspaceIgnore)
      .some((diag) => diag.code === 'LSP1408')).toBe(false);

    const userIgnore = new Set(mergeIgnoreIds(['lsp1408'], []));
    expect(filterFallbackDiagnostics(diagnostics, userIgnore)
      .some((diag) => diag.code === 'LSP1408')).toBe(false);
  });

  it('reproduz o fluxo do serviço Pull Diagnostics sem contexto antes/depois do ignore Workspace', async () => {
    const uri = 'file:///tmp/singlefile-lsp1408.lspt';
    const doc = TextDocument.create(uri, 'lsp', 1, 'FuncaoQueNaoExiste();');
    const ignoredState = new Set<string>();
    const runtime = {
      pullDiagCache: new Map(), pullDiagLastItems: new Map(),
      pullDiagPrewarmByUri: new Map(), pullDiagPrewarmTimers: new Map(),
      pullDiagPrewarmInFlight: new Map(), pullDiagDirtyStampByContext: new Map(),
      pullDiagStableByUri: new Map(), pullDiagLastNonEmptyByUri: new Map()
    } as never;
    const service = createPullDiagnosticsService({
      documents: new Map([[uri, doc]]), contextDocs: new Map(), runtime,
      toFsPath: (value) => value.replace('file://', ''),
      normalizePathKey: (value) => value,
      getIgnoredForContext: () => new Set(),
      applyIgnoreIdsToLspDiagnostics: (diagnostics) => diagnostics,
      projectCompilerDiagnosticsForFile: () => [],
      getPersistCache: () => ({ getValidated: () => null, set: () => {}, flush: async () => {} }),
      resolveWorkspaceKey: () => '/workspace', buildContextSignature: () => 'sig',
      computeDocHash: () => 'hash', getPersistContextRevision: () => 0,
      getDirtyStamp: () => 0, prewarmDelayMs: 0, shouldSkipDidOpenPrewarm: () => true,
      prewarmDiagnostics: async () => [], sendDebugLog: () => {}, zeroObservationWindowMs: 0,
      getLastFullCompileCommittedAt: () => undefined, getLastDidChangeAtByUri: () => 0,
      hasRecentEditBurst: () => false, recentCommitWindowMs: 0, didOpenZeroFollowupWindowMs: 0,
      getContextCache: () => undefined, hasActiveContextCompileSignal: () => false,
      logContextProjectionSelected: () => {}, hasPendingOrRecentFollowupForUri: () => false,
      shouldScheduleFollowup: () => false, scheduleFollowup: () => {},
      computeDiagnosticsDirectlyForPull: async () => [],
      getIgnoredForWorkspace: () => ignoredState,
      compileFallbackDocument: async () => ({ diagnostics: [{
        code: 'LSP1408', message: 'função não criada', severity: 'Warning',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 20 } }
      }] }),
      toLspDiagnostic: (diag) => ({ ...diag, severity: DiagnosticSeverity.Warning, source: 'lsp' }),
      schedulePullDiagnosticsRefresh: () => {}
    });

    const before = await service.resolveNoContextDiagnostics({
      filePath: '/tmp/singlefile-lsp1408.lspt', workspaceUri: '/workspace', doc,
      booting: false, refreshInProgress: false
    });
    expect(before.diagnostics.some((diag) => diag.code === 'LSP1408')).toBe(true);

    ignoredState.add('LSP1408');
    const after = await service.resolveNoContextDiagnostics({
      filePath: '/tmp/singlefile-lsp1408.lspt', workspaceUri: '/workspace', doc,
      booting: false, refreshInProgress: false
    });
    expect(after.diagnostics).toHaveLength(0);
  });
});
