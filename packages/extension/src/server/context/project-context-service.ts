import path from 'node:path';
import fs from 'node:fs/promises';
import { normalizePathKey } from '../runtime/path-utils';
import { type ValidationContextConfig } from '@lsp/compiler';

export type ContextLike = ValidationContextConfig & { key: string };
type CompiledContext = ContextLike & {
  rootAbs: string;
  rootNorm: string;
  matcher: (fileAbs: string, fileBase: string) => boolean;
};

export function createProjectContextService() {
  let contexts: ContextLike[] = [];
  let compiledContexts: CompiledContext[] = [];
  const cache = new Map<string, ContextLike | null>();
  const orderedFilesCache = new Map<string, string[]>();
  const orderedFilesDirty = new Set<string>();
  const relevantContextsCache = new Map<string, string[]>();

  function compileMatcher(filePattern: string): (fileAbs: string, fileBase: string) => boolean {
    if (filePattern.startsWith('re:')) {
      const regex = new RegExp(filePattern.slice(3));
      return (_fileAbs, fileBase) => regex.test(fileBase);
    }
    const escaped = filePattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${escaped}$`, 'i');
    return (_fileAbs, fileBase) => regex.test(fileBase);
  }

  function isUnderRoot(rootAbs: string, fileAbs: string): boolean {
    const rel = path.relative(rootAbs, fileAbs);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  }

  function compileContexts(nextContexts: ContextLike[]): CompiledContext[] {
    return nextContexts.map((context) => {
      const rootAbs = path.resolve(context.rootDir);
      return {
        ...context,
        rootAbs,
        rootNorm: normalizePathKey(rootAbs),
        matcher: compileMatcher(context.filePattern)
      };
    });
  }

  function matchesContext(context: CompiledContext, fileAbs: string, fileNorm: string, fileBase: string): boolean {
    if (!(fileNorm === context.rootNorm || fileNorm.startsWith(`${context.rootNorm}${path.sep}`))) {
      return false;
    }
    if (!isUnderRoot(context.rootAbs, fileAbs)) {
      return false;
    }
    const rel = path.relative(context.rootAbs, fileAbs);
    if (!context.includeSubdirectories && rel.includes(path.sep)) {
      return false;
    }
    return context.matcher(fileAbs, fileBase);
  }

  function setContexts(nextContexts: ContextLike[]): void {
    contexts = [...nextContexts];
    compiledContexts = compileContexts(nextContexts);
    cache.clear();
    relevantContextsCache.clear();
    orderedFilesCache.clear();
    orderedFilesDirty.clear();
  }

  function resolveForFile(filePath: string): ContextLike | null {
    const key = normalizePathKey(filePath);
    if (cache.has(key)) {
      return cache.get(key) ?? null;
    }
    const fileAbs = path.resolve(filePath);
    const fileBase = path.basename(fileAbs);
    for (const context of compiledContexts) {
      if (matchesContext(context, fileAbs, key, fileBase)) {
        cache.set(key, context);
        return context;
      }
    }
    cache.set(key, null);
    return null;
  }

  function getRelevantContextKeysForFile(filePath: string): string[] {
    const key = normalizePathKey(filePath);
    if (relevantContextsCache.has(key)) {
      return relevantContextsCache.get(key) ?? [];
    }
    const fileAbs = path.resolve(filePath);
    const fileBase = path.basename(fileAbs);
    const relevant = compiledContexts
      .filter((context) => matchesContext(context, fileAbs, key, fileBase))
      .map((context) => context.key);
    relevantContextsCache.set(key, relevant);
    return relevant;
  }

  function invalidate(filePath: string): void {
    const key = normalizePathKey(filePath);
    cache.delete(key);
    relevantContextsCache.delete(key);
    for (const context of contexts) {
      if (!isInsideContextRoot(filePath, context.rootDir)) continue;
      orderedFilesDirty.add(context.key);
    }
  }

  function invalidateContext(contextKey: string): void {
    orderedFilesDirty.add(contextKey);
  }

  async function listFilesRecursive(rootDir: string): Promise<string[]> {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        const nested = await listFilesRecursive(fullPath);
        files.push(...nested);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
    return files;
  }

  function sortContextFiles(context: ContextLike, files: string[]): string[] {
    const sorted = [...files];
    sorted.sort((a, b) => compareByBasename(context.rootDir, a, b));
    return sorted;
  }

  async function getOrderedFiles(contextKey: string): Promise<string[]> {
    const context = contexts.find((ctx) => ctx.key === contextKey);
    const compiled = compiledContexts.find((ctx) => ctx.key === contextKey);
    if (!context || !compiled) return [];
    if (orderedFilesCache.has(contextKey) && !orderedFilesDirty.has(contextKey)) {
      return orderedFilesCache.get(contextKey) ?? [];
    }

    let discovered: string[] = [];
    try {
      if (context.includeSubdirectories) {
        discovered = await listFilesRecursive(context.rootDir);
      } else {
        const entries = await fs.readdir(context.rootDir, { withFileTypes: true });
        discovered = entries.filter((entry) => entry.isFile()).map((entry) => path.join(context.rootDir, entry.name));
      }
    } catch {
      discovered = [];
    }

    const filtered = discovered.filter((filePath) => {
      const fileAbs = path.resolve(filePath);
      return matchesContext(compiled, fileAbs, normalizePathKey(fileAbs), path.basename(fileAbs));
    });
    const ordered = sortContextFiles(context, filtered);
    orderedFilesCache.set(contextKey, ordered);
    orderedFilesDirty.delete(contextKey);
    return ordered;
  }

  return {
    setContexts,
    resolveForFile,
    getRelevantContextKeysForFile,
    invalidate,
    invalidateContext,
    getOrderedFiles,
    clear: () => {
      cache.clear();
      relevantContextsCache.clear();
      orderedFilesCache.clear();
      orderedFilesDirty.clear();
    }
  };
}

function normalizeRelative(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).split(path.sep).join('/').toLocaleLowerCase('en-US');
}

function compareByBasename(rootDir: string, a: string, b: string): number {
  const byBase = path.basename(a).localeCompare(path.basename(b), 'en-US', {
    sensitivity: 'base',
    numeric: true
  });
  if (byBase !== 0) return byBase;
  return normalizeRelative(rootDir, a).localeCompare(normalizeRelative(rootDir, b), 'en-US', {
    sensitivity: 'base',
    numeric: true
  });
}

function isInsideContextRoot(filePath: string, rootDir: string): boolean {
  const fileNorm = normalizePathKey(filePath);
  const rootNorm = normalizePathKey(rootDir);
  return fileNorm === rootNorm || fileNorm.startsWith(`${rootNorm}${path.sep}`);
}
