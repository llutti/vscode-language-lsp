import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { compileContext, compileSingleFile } from '@lsp/compiler';
import { buildSingleFileContext } from '../../../src/server/fallback/fallback-server';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-singlefile-'));
}

describe('integration: singlefile as context', () => {
  it('uses equivalent pipeline shape with orderedFiles=[file]', async () => {
    const rootDir = makeTempDir();
    const filePath = path.join(rootDir, 'HR858.lspt');
    const text = ['Definir Numero nNum;', 'nNum = 1;', ''].join('\n');
    fs.writeFileSync(filePath, text, 'utf8');

    const singleContext = buildSingleFileContext(filePath, 'HCM');
    expect(singleContext.files).toEqual([filePath]);

    const fallbackResult = await compileSingleFile({
      filePath,
      text,
      system: 'HCM',
      includeSemantics: true
    });

    const contextResult = await compileContext(
      {
        name: 'SINGLE',
        rootDir,
        filePattern: 'HR858.lspt',
        includeSubdirectories: false,
        system: 'HCM'
      },
      undefined,
      { includeSemantics: true }
    );

    expect(fallbackResult.contextId).toBe('__singlefile__');
    expect(fallbackResult.files).toEqual([filePath]);
    expect(contextResult.files).toEqual([filePath]);
    expect(fallbackResult.diagnostics.map((d) => d.id)).toEqual(contextResult.diagnostics.map((d) => d.id));
  });

  it('keeps fallback and single-file context aligned for a real _Webservices example', async () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');
    const filePath = path.join(
      repoRoot,
      'packages',
      'compiler',
      'test',
      'fixtures',
      'hr-examples',
      'webservices',
      'servico-terceiros.txt'
    );
    const text = fs.readFileSync(filePath, 'utf8');
    const rootDir = path.dirname(filePath);
    const fileName = path.basename(filePath);

    const singleContext = buildSingleFileContext(filePath, 'HCM');
    expect(singleContext.files).toEqual([filePath]);

    const fallbackResult = await compileSingleFile({
      filePath,
      text,
      system: 'HCM',
      includeSemantics: true
    });

    const contextResult = await compileContext(
      {
        name: 'WS_REAL',
        rootDir,
        filePattern: fileName,
        includeSubdirectories: false,
        system: 'HCM'
      },
      undefined,
      { includeSemantics: true }
    );

    expect(fallbackResult.contextId).toBe('__singlefile__');
    expect(fallbackResult.files).toEqual([filePath]);
    expect(contextResult.files).toEqual([filePath]);
    expect(fallbackResult.diagnostics.map((d) => d.id)).toEqual(contextResult.diagnostics.map((d) => d.id));
  });
});
