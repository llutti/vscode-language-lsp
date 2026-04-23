import path from 'node:path';
import { hashText as compilerHashText, normalizePathKey as compilerNormalizePathKey } from '@lsp/compiler';
import { describe, expect, it } from 'vitest';
import { hashText, isPathUnderRoot, normalizePathKey, toFileUri, toFsPath } from '../../../src/server/runtime/path-utils';

describe('runtime path utils', () => {
  it('delegates normalizePathKey to the compiler canonical contract', () => {
    const mixedPath = path.join(process.cwd(), 'Packages', '..', 'packages', 'Extension', 'src', 'server.ts');
    expect(normalizePathKey(mixedPath)).toBe(compilerNormalizePathKey(mixedPath));
  });

  it('delegates hashText to the compiler canonical helper', () => {
    expect(hashText('Abc 123')).toBe(compilerHashText('Abc 123'));
  });

  it('round-trips file URIs through fs path helpers', () => {
    const filePath = path.join(process.cwd(), 'packages', 'extension', 'src', 'server.ts');
    expect(toFsPath(toFileUri(filePath))).toBe(filePath);
  });

  it('detects when a file is inside a root', () => {
    const rootDir = path.join(process.cwd(), 'packages', 'extension');
    const filePath = path.join(rootDir, 'src', 'server.ts');
    const outsideFilePath = path.join(process.cwd(), 'packages', 'compiler', 'src', 'index.ts');

    expect(isPathUnderRoot(filePath, rootDir)).toBe(true);
    expect(isPathUnderRoot(outsideFilePath, rootDir)).toBe(false);
  });
});
