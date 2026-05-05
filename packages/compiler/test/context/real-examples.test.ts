import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { compileContext } from '../../src';

function pickFile(dir: string, pattern: RegExp): string | null {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir).filter((f) => pattern.test(f));
  if (entries.length === 0) return null;
  entries.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  return entries[0];
}

describe('real examples', () => {
  it('validates one file per context without errors', async () => {
    const ctxs: Array<{ name: string; rootDir: string; filePattern: string; includeSubdirectories: boolean }> = [];

    const hrRoot = path.join(__dirname, '..', 'fixtures', 'hr-examples');
    const hrFile = pickFile(hrRoot, /^context-.*\.txt$/i);
    if (hrFile) {
      ctxs.push({ name: 'Ponto', rootDir: hrRoot, filePattern: hrFile, includeSubdirectories: false });
    }

    const rsFile = pickFile(path.join(process.cwd(), 'exemplos/RS'), /^RS.*\.txt$/i);
    if (rsFile) {
      ctxs.push({ name: 'RS', rootDir: 'exemplos/RS', filePattern: rsFile, includeSubdirectories: false });
    }

    const trFile = pickFile(path.join(process.cwd(), 'exemplos/TR'), /^TR.*\.txt$/i);
    if (trFile) {
      ctxs.push({ name: 'TR', rootDir: 'exemplos/TR', filePattern: trFile, includeSubdirectories: false });
    }

    const smFile = pickFile(path.join(process.cwd(), 'exemplos/SM'), /^SM.*\.txt$/i);
    if (smFile) {
      ctxs.push({ name: 'SM', rootDir: 'exemplos/SM', filePattern: smFile, includeSubdirectories: false });
    }

    const siaDir = path.join(process.cwd(), 'exemplos/SIA');
    if (fs.existsSync(siaDir)) {
      const files = fs.readdirSync(siaDir).filter((f) => /^[0-9].*\.txt$/i.test(f));
      if (files.length > 0) {
        files.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
        ctxs.push({ name: 'SIA', rootDir: 'exemplos/SIA', filePattern: files[0], includeSubdirectories: true });
      }
    }

    for (const ctx of ctxs) {
      const result = await compileContext({
        name: ctx.name,
        rootDir: ctx.rootDir,
        filePattern: ctx.filePattern,
        includeSubdirectories: ctx.includeSubdirectories,
        system: 'HCM'
      });

      const errors = result.diagnostics.filter((d) => d.severity === 'Error');
      expect(errors.length).toBe(0);
    }
  }, 60000);
});
