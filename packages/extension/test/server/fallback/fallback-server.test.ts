import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { buildSingleFileContext, isFallbackFile } from '../../../src/server/fallback/fallback-server';
import type { ValidationContextConfig } from '@lsp/compiler';

const rootDir = path.join(process.cwd(), 'fallback-root');

const contexts: ValidationContextConfig[] = [
  {
    name: 'ctx',
    rootDir,
    filePattern: '*.lspt',
    includeSubdirectories: false,
    system: 'HCM'
  }
];

describe('fallback server', () => {
  it('detects fallback files', () => {
    const inside = path.join(rootDir, 'file.lspt');
    const outside = path.join(rootDir, 'sub', 'file.lspt');
    expect(isFallbackFile(inside, contexts)).toBe(false);
    expect(isFallbackFile(outside, contexts)).toBe(true);
  });

  it('builds single-file context', () => {
    const filePath = path.join(rootDir, 'single.lspt');
    const ctx = buildSingleFileContext(filePath, 'ERP');
    expect(ctx.rootDir).toBe(path.dirname(filePath));
    expect(ctx.filePattern).toBe(path.basename(filePath));
    expect(ctx.includeSubdirectories).toBe(false);
    expect(ctx.system).toBe('ERP');
    expect(ctx.files).toEqual([filePath]);
  });
});
