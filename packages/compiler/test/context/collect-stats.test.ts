import { describe, it, expect } from 'vitest';
import { compileContext } from '../../src';

describe('compiler stats', () => {
  it('retorna estatisticas quando collectStats=true', async () => {
    const result = await compileContext(
      {
        name: 'STATS',
        rootDir: 'exemplos/HR',
        filePattern: 'HR*.txt',
        includeSubdirectories: false,
        system: 'HCM'
      },
      undefined,
      { collectStats: true }
    );

    expect(result.__stats).toBeDefined();
    const stats = result.__stats!;
    expect(stats.filesDiscovered).toBeGreaterThanOrEqual(0);
    expect(stats.filesRead).toBeGreaterThanOrEqual(0);
    expect(stats.filesParsed).toBeGreaterThanOrEqual(0);
    expect(stats.reusedFiles).toBeGreaterThanOrEqual(0);
    expect(stats.reparsedFiles).toBeGreaterThanOrEqual(0);
    expect(stats.reanalyzedFiles).toBeGreaterThanOrEqual(0);
    expect(stats.reusedSymbols).toBeGreaterThanOrEqual(0);
    expect(stats.semanticStartIndex).toBeGreaterThanOrEqual(0);
    expect(stats.semanticFilesReused).toBeGreaterThanOrEqual(0);
    expect(stats.semanticFilesAnalyzed).toBeGreaterThanOrEqual(0);
    expect(stats.contextResolveMs).toBeGreaterThanOrEqual(0);
    expect(stats.textLoadMs).toBeGreaterThanOrEqual(0);
    expect(stats.incrementalReuseMs).toBeGreaterThanOrEqual(0);
    expect(stats.parseMs).toBeGreaterThanOrEqual(0);
    expect(stats.bindMs).toBeGreaterThanOrEqual(0);
    expect(stats.analyzeMs).toBeGreaterThanOrEqual(0);
    expect(stats.indexLookupMs).toBeGreaterThanOrEqual(0);
    expect(stats.semanticMs).toBeGreaterThanOrEqual(0);
    expect(stats.totalMs).toBeGreaterThanOrEqual(0);
    expect(stats.filesParsed).toBe(stats.filesDiscovered);
  });
});
