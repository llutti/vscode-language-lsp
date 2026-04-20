import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hashText as compilerHashText, normalizePathKey as compilerNormalizePathKey } from '@lsp/compiler';

export function toFsPath(uri: string): string
{
  if (uri.startsWith('file://')) return fileURLToPath(uri);
  return uri;
}

export function toFileUri(filePath: string): string
{
  return pathToFileURL(filePath).toString();
}

export function normalizePathKey(filePath: string): string
{
  return compilerNormalizePathKey(filePath);
}

export function hashText(text: string): string
{
  return compilerHashText(text);
}

export function isPathUnderRoot(filePath: string, rootDir: string): boolean
{
  const fileNorm = normalizePathKey(filePath);
  const rootNorm = normalizePathKey(rootDir);
  return fileNorm === rootNorm || fileNorm.startsWith(`${rootNorm}${path.sep}`);
}
