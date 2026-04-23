import path from 'node:path';
import { fileBelongsToContext, type ValidationContextConfig } from '@lsp/compiler';

export type SingleFileContext = ValidationContextConfig & { files: string[] };

export function isFallbackFile(filePath: string, contexts: ValidationContextConfig[]): boolean {
  return !contexts.some((ctx) => fileBelongsToContext(ctx, filePath));
}

export function buildSingleFileContext(filePath: string, system: ValidationContextConfig['system']): SingleFileContext {
  return {
    name: '__singlefile__',
    rootDir: path.dirname(filePath),
    filePattern: path.basename(filePath),
    includeSubdirectories: false,
    system,
    files: [filePath]
  };
}
