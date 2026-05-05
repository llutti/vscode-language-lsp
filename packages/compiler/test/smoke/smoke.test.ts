import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { compileContext } from '../../src';

describe('compiler smoke', () => {
  it('compiles empty context without crashing', async () => {
    const fixturesDir = path.join(__dirname, '..', 'fixtures', 'hr-examples');
    const result = await compileContext({
      name: 'SMOKE',
      rootDir: fixturesDir,
      filePattern: '*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    });

    expect(result.diagnostics).toBeDefined();
  });
});
