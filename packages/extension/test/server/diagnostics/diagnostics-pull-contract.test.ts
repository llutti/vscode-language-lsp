import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function loadServerSource(): string {
  const repoRoot = path.join(__dirname, '..', '..', '..', 'src');
  return [
    path.join(repoRoot, 'server.ts'),
    path.join(repoRoot, 'server', 'compile', 'compile-result-application.ts'),
    path.join(repoRoot, 'server', 'diagnostics', 'pull-diagnostics-service.ts')
  ].map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n');
}

describe('diagnostics pull contract details', () => {
  it('tracks previousResultId and returns unchanged when hash matches', () => {
    const source = loadServerSource();
    expect(/const prevId = .*params\?\.previousResultId/.test(source)).toBe(true);
    expect(source.includes('cached.resultId === prevId')).toBe(true);
    expect(source.includes('cached.hash === hash')).toBe(true);
    expect(source.includes('!shouldForcePostFormatDiagnosticsRepublish({')).toBe(true);
    expect(source.includes('return { kind: \'unchanged\', resultId: cached.resultId };')).toBe(true);
  });

  it('returns full with a new resultId when diagnostics state changes', () => {
    const source = loadServerSource();
    expect(source.includes('const resultId = `${doc?.version ?? 0}:${hash}`;')).toBe(true);
    expect(source.includes('pullDiagCache.set(uri, { resultId, hash });')).toBe(true);
    expect(source.includes('return { kind: \'full\', resultId, items: diagnostics };')).toBe(true);
  });

  it('resolves diagnostics via public compiler snapshot helpers', () => {
    const source = loadServerSource();
    expect(source.includes('const context = findContextForFile(filePath);')).toBe(true);
    expect(source.includes('const snapshot = await publicCompiler.ensureCompiledForFile(')).toBe(true);
    expect(source.includes('publicCompiler.getDiagnosticsForFile(snapshot, filePath)')).toBe(true);
  });

  it('keeps boot-empty and prewarm flows as non-authoritative/prefix', () => {
    const source = loadServerSource();
    expect(source.includes('source = \'boot-empty\';')).toBe(true);
    expect(source.includes('isPrefix = true;')).toBe(true);
    expect(source.includes('isAuthoritative = false;')).toBe(true);
    expect(source.includes('const prewarmed = pullDiagPrewarmByUri.get(uri);')).toBe(true);
    expect(source.includes('pullDiagPrewarmByUri.delete(uri);')).toBe(true);
  });

  it('only commits pull cache for authoritative or non-empty diagnostics', () => {
    const source = loadServerSource();
    expect(source.includes('// Only commit authoritative results, or non-empty results.')).toBe(true);
    expect(source.includes('if (isAuthoritative || diagnostics.length > 0)')).toBe(true);
    expect(source.includes('pullDiagCache.set(uri, { resultId, hash });')).toBe(true);
  });

  it('invalidates persisted pull cache after authoritative context compile commits', () => {
    const source = loadServerSource();
    expect(source.includes('bumpPullDiagPersistContextRevision(context.key);')).toBe(true);
    expect(source.includes('getPullDiagPersistCache().invalidateContext(context.key);')).toBe(true);
  });
});
