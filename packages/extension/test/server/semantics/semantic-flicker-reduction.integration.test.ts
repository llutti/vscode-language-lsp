import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function loadServerSources(): string
{
  const repoRoot = path.join(__dirname, '..', '..', '..', 'src');
  return [
    path.join(repoRoot, 'server.ts'),
    path.join(repoRoot, 'server', 'register-lifecycle-handlers.ts'),
    path.join(repoRoot, 'server', 'compile', 'compile-orchestrator.ts'),
    path.join(repoRoot, 'server', 'compile', 'compile-result-application.ts'),
    path.join(repoRoot, 'server', 'semantics', 'semantic-runtime.ts'),
    path.join(repoRoot, 'server', 'context', 'context-orchestrator.ts')
  ].map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n');
}

describe('semantic flicker reduction integration', () =>
{
  it('tracks latest requested versions and emits stale/unchanged telemetry', () =>
  {
    const source = loadServerSources();
    expect(source.includes('semanticLatestRequestedVersionByUri')).toBe(true);
    expect(source.includes('semanticTokens.staleDrop')).toBe(true);
    expect(source.includes('semanticTokens.unchangedSkip')).toBe(true);
    expect(source.includes('semanticTokens.reusePrevious')).toBe(true);
  });

  it('coalesces typing requests and defers didChange pull refresh to compileResult', () =>
  {
    const source = loadServerSources();
    expect(source.includes('semanticTokens.coalesced')).toBe(true);
    expect(source.includes('SEMANTIC_TOKENS_COALESCE_DELAY_MS')).toBe(true);
    expect(source.includes('SEMANTIC_TOKENS_TYPING_STABLE_WINDOW_MS')).toBe(true);
    expect(source.includes('const isTypingDrainActive =')).toBe(true);
    expect(source.includes('immediate: true')).toBe(true);
    expect(source.includes('invalidateSemanticTokens(updated.uri);')).toBe(false);
    expect(source.includes("if (changeReason === 'didChangeTextDocumentAfterFormat')")).toBe(true);
  });

  it('reuses context cached semantics on fresh didOpen before falling back to public-api', () =>
  {
    const source = loadServerSources();
    expect(source.includes('getContextCachedSemanticOccurrences')).toBe(true);
    expect(source.includes('hasContextCachedSemanticsForFile')).toBe(true);
    expect(source.includes('semanticRuntime.prewarmOnDidOpen')).toBe(true);
    expect(source.includes('refreshSemanticTokensCacheForContext')).toBe(true);
    expect(source.includes('DID_OPEN_SEMANTIC_FIRST_WINDOW_MS')).toBe(true);
    expect(source.includes("scheduleSemanticTokensRefresh('didOpenWarmCache', 0)")).toBe(false);
    expect(source.includes("scheduleSemanticTokensRefresh('didOpenContextCache', 0)")).toBe(false);
    expect(source.includes('invalidateSemanticTokensForContext(context.key);')).toBe(false);
    expect(source.includes('refreshSemanticTokensCacheForContext(context);')).toBe(true);
    expect(source.includes("schedulePullDiagnosticsRefresh('didOpen', context.workspaceUri")).toBe(true);
    expect(source.includes('pullDiagnostics.didOpenDefer')).toBe(true);
    expect(source.includes('pullDiagnosticsDidOpenDefer')).toBe(true);
    expect(source.includes("source = 'context-cache';")).toBe(true);
    expect(source.includes('if (context && doc.version === 1)')).toBe(true);
    expect(source.includes('changedFilePaths: [priorityFilePath]')).toBe(true);
    expect(source.includes('if (hasCachedSymbols && (!uri || hasTargetSemantics))')).toBe(true);
  });

  it('allows authoritative diagnostic clears without waiting for a new edit', () =>
  {
    const source = loadServerSources();
    expect(source.includes('const shouldGuardClear = diagnostics.length === 0 && shouldGuardContextProjectedZero;')).toBe(true);
    expect(source.includes('&& !isAuthoritative')).toBe(true);
    expect(source.includes('PULL_DIAGNOSTICS_CONTEXT_ZERO_GUARD_MS')).toBe(false);
    expect(source.includes('const protectStableClear =')).toBe(false);
    expect(source.includes('shouldGuardContextProjectedZero')).toBe(true);
  });
  it('emits context-projected selection telemetry for per-file diagnostic projection', () =>
  {
    const source = loadServerSources();
    expect(source.includes('pullDiagnostics.contextProjectionSelected')).toBe(true);
    expect(source.includes('contextProjectionKnownFile')).toBe(true);
    expect(source.includes('contextProjectionDiagnosticsCount')).toBe(true);
    expect(source.includes('contextProjectionAuthoritative')).toBe(true);
    expect(source.includes('contextProjectionBranch')).toBe(true);
    expect(source.includes('contextCompilerDiagnosticsCount')).toBe(true);
    expect(source.includes('contextCacheLastCompileWasPrefix')).toBe(true);
    expect(source.includes('contextCacheCommittedAtMs')).toBe(true);
  });

});
