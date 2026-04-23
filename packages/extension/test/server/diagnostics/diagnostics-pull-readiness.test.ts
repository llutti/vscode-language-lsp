import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function loadSource(relativePath: string): string {
  const filePath = path.join(__dirname, '..', '..', '..', 'src', relativePath);
  return fs.readFileSync(filePath, 'utf8');
}

function loadCompileSchedulerPolicySource(): string {
  const filePath = path.join(__dirname, '..', '..', '..', 'src', 'compile-scheduler-policy.ts');
  return fs.readFileSync(filePath, 'utf8');
}

describe('diagnostics pull readiness', () => {
  it('implements pull contract with full/unchanged responses and resultId cache', () => {
    const source = `${loadSource('server.ts')}\n${loadSource(path.join('server', 'register-diagnostics-handlers.ts'))}`;

    expect(source.includes('connection.onRequest(\'textDocument/diagnostic\'')).toBe(true);
    expect(source.includes('const pullDiagCache = pullDiagnosticsRuntime.pullDiagCache;')).toBe(true);
    expect(source.includes('return { kind: \'unchanged\', resultId: cached.resultId };')).toBe(true);
    expect(source.includes('return { kind: \'full\', resultId, items: diagnostics };')).toBe(true);
  });

  it('triggers DiagnosticRefresh after compile commits', () => {
    const source = `${loadSource('server.ts')}\n${loadSource(path.join('server', 'compile', 'compile-result-application.ts'))}`;
    expect(source.includes('schedulePullDiagnosticsRefresh(`compileResult:${trigger}`, context.workspaceUri);')).toBe(true);
    expect(source.includes('DiagnosticRefreshRequest.type')).toBe(true);
  });

  it('triggers pull refresh on didChange', () => {
    const source = loadSource(path.join('server', 'register-lifecycle-handlers.ts'));
    expect(source.includes('schedulePullDiagnosticsRefresh(\'didChange\', context.workspaceUri);')).toBe(true);
  });

  it('cleans diagnostics when last open file of a context closes', () => {
    const source = [
      loadSource('server.ts'),
      loadSource(path.join('server', 'register-lifecycle-handlers.ts')),
      loadSource(path.join('server', 'context', 'context-orchestrator.ts'))
    ].join('\n');
    expect(source.includes('function clearContextDiagnostics(contextKey: string): void')).toBe(true);
    expect(source.includes('connection.sendDiagnostics({ uri: toFileUri(filePath), diagnostics: [] as Diagnostic[] });')).toBe(true);
    expect(source.includes('const open = resolveOpenContexts();')).toBe(true);
    expect(source.includes('syncOpenContexts(open);')).toBe(true);
  });

  it('supports pull fallback path for files outside contexts', () => {
    const source = `${loadSource('server.ts')}\n${loadSource(path.join('server', 'diagnostics', 'pull-diagnostics-service.ts'))}`;
    expect(source.includes('if (!context)')).toBe(true);
    expect(source.includes('const result = await input.compileFallbackDocument(inputData.doc, false);')).toBe(true);
    expect(source.includes('.map((diag) => input.toLspDiagnostic(diag));')).toBe(true);
  });

  it('uses public compiler API to ensure diagnostics for target file', () => {
    const source = `${loadSource('server.ts')}\n${loadSource(path.join('server', 'diagnostics', 'pull-diagnostics-service.ts'))}`;
    expect(source.includes('const publicCompiler = createPublicCompilerApi();')).toBe(true);
    expect(source.includes('const snapshot = await publicCompiler.ensureCompiledForFile(')).toBe(true);
    expect(source.includes('reason: \'diagnostics\'')).toBe(true);
    expect(source.includes('prefixUntilTarget: true')).toBe(true);
  });

  it('schedules global follow-up with semantics to materialize global diagnostics (LSP1203)', () => {
    const source = `${loadSource('server.ts')}\n${loadSource(path.join('server', 'diagnostics', 'pull-diagnostics-service.ts'))}`;
    expect(source.includes('pullDiagnosticsGlobalFollowup')).toBe(true);
    expect(source.includes('includeSemantics: true')).toBe(true);
    expect(source.includes('includeSemanticPayload: false')).toBe(true);
    expect(source.includes('createPullDiagnosticsFollowupTracker({')).toBe(true);
    expect(source.includes('shouldSchedulePullDiagnosticsGlobalFollowup(contextKey: string, uri: string, dirtyStamp: number | null)')).toBe(true);
    expect(source.includes('shouldSchedulePullDiagnosticsGlobalFollowup(context.key, uri, dirtyStamp')).toBe(true);
  });

  it('honors explicit includeSemantics override in schedule resolution', () => {
    const source = loadCompileSchedulerPolicySource();
    expect(source.includes('export function resolveIncludeSemanticsForSchedule(reason: string, requested?: boolean): boolean')).toBe(true);
    expect(source.includes('if (requested !== undefined) return requested;')).toBe(true);
  });

  it('treats compile cycles without semantics as non-authoritative for pull stabilization', () => {
    const source = `${loadSource('server.ts')}\n${loadSource(path.join('server', 'compile', 'compile-result-application.ts'))}`;
    expect(source.includes('const effectivePrefixCompile = isPrefixCompile || perfTelemetry?.includeSemantics === false;')).toBe(true);
    expect(source.includes('lastCompileWasPrefix: effectivePrefixCompile')).toBe(true);
    expect(source.includes('materializePullDiagnosticsSnapshotsForContext(context, nextCache, !effectivePrefixCompile);')).toBe(true);
  });

  it('keeps full semantic bootstrap while scoping semantic payload for other triggers', () => {
    const source = loadSource('server.ts');
    expect(source.includes('function resolveSemanticPayloadFilePathsForCompile(')).toBe(true);
    expect(source.includes('if (trigger === \'didOpenContextBootstrap\') return undefined;')).toBe(true);
    expect(source.includes('semanticFilePaths,')).toBe(true);
  });
});
