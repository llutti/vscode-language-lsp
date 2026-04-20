import { describe, it, expect } from 'vitest';
import { compileContext } from '../../src';

describe('compiler smoke', () => {
  it('compiles empty context without crashing', async () => {
    const result = await compileContext({
      name: 'SMOKE',
      rootDir: 'exemplos/HR',
      filePattern: 'HR*.txt',
      includeSubdirectories: false,
      system: 'HCM'
    });

    expect(result.diagnostics).toBeDefined();
  });
});
