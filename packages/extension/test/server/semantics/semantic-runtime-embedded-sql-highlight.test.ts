import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('semantic runtime embedded SQL highlight gate', () =>
{
  it('uses an independent embedded SQL highlight toggle in semantic runtime', () =>
  {
    const runtimePath = path.resolve(__dirname, '../../../src/server/semantics/semantic-runtime.ts');
    const source = fs.readFileSync(runtimePath, 'utf8');

    expect(source.includes('isEmbeddedSqlHighlightEnabled(filePath)')).toBe(true);
    expect(source.includes("occ.tokenType === 'string'")).toBe(true);
    expect(source.includes("occ.tokenModifiers ?? []).includes('defaultLibrary')")).toBe(true);
  });
});
