import fs from 'node:fs/promises';
import path from 'node:path';
import { discoverFiles } from './file-discovery';
import { createSourceFile, type SourceFile } from '../source/source-file';
import { casefold } from '../utils/casefold';

export type ValidationContextConfig = {
  name: string;
  rootDir: string;
  filePattern: string; // glob or re:
  includeSubdirectories: boolean;
  /** System adicional do contexto (SENIOR é sempre carregado automaticamente). */
  system: 'HCM' | 'ACESSO' | 'ERP';
};

export type ValidationContext = {
  id: string;
  config: ValidationContextConfig;
  rootDirAbs: string;
  files: SourceFile[];
};

export type ContentOverrides = Map<string, string>;
export type BuildContextStats = {
  filesDiscovered: number;
  filesRead: number;
};

function toAbsoluteRoot(rootDir: string): string {
  return path.isAbsolute(rootDir) ? rootDir : path.join(process.cwd(), rootDir);
}

function compilePattern(filePattern: string): { isRegex: boolean; regex?: RegExp; glob?: string } {
  if (filePattern.startsWith('re:')) {
    try {
      return { isRegex: true, regex: new RegExp(filePattern.slice(3)) };
    } catch {
      // Invalid regex patterns are treated as non-matching instead of crashing the compile path.
      return { isRegex: true, regex: /^$/ };
    }
  }
  return { isRegex: false, glob: filePattern };
}

const PATTERN_CACHE = new Map<string, { isRegex: boolean; regex?: RegExp; glob?: string }>();
const PATTERN_CACHE_MAX = 256;

function getCompiledPattern(filePattern: string): { isRegex: boolean; regex?: RegExp; glob?: string } {
  const cached = PATTERN_CACHE.get(filePattern);
  if (cached) return cached;
  const compiled = compilePattern(filePattern);
  if (PATTERN_CACHE.size >= PATTERN_CACHE_MAX && !PATTERN_CACHE.has(filePattern)) {
    const oldest = PATTERN_CACHE.keys().next().value as string | undefined;
    if (oldest !== undefined) PATTERN_CACHE.delete(oldest);
  }
  PATTERN_CACHE.set(filePattern, compiled);
  return compiled;
}

function isUnderRoot(rootAbs: string, fileAbs: string): boolean {
  const rel = path.relative(rootAbs, fileAbs);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function normalizePathKey(filePath: string): string {
  return casefold(path.resolve(filePath));
}

export function fileBelongsToContext(config: ValidationContextConfig, filePath: string): boolean {
  const rootAbs = toAbsoluteRoot(config.rootDir);
  const fileAbs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

  if (!isUnderRoot(rootAbs, fileAbs)) {
    return false;
  }

  const rel = path.relative(rootAbs, fileAbs);
  if (!config.includeSubdirectories && rel.includes(path.sep)) {
    return false;
  }

  const { isRegex, regex, glob } = getCompiledPattern(config.filePattern);
  const base = path.basename(fileAbs);

  if (isRegex) {
    return regex!.test(base);
  }

  // Simple glob-like match on basename for our patterns (e.g., HR*.txt).
  // We avoid adding extra deps; fast-glob is used for discovery.
  const escaped = glob!
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  const re = new RegExp(`^${escaped}$`, 'i');
  return re.test(base);
}

async function readSourceFiles(
  paths: string[],
  contentOverrides?: ContentOverrides,
  stats?: BuildContextStats
): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  for (const filePath of paths) {
    const override = contentOverrides?.get(normalizePathKey(filePath));
    const text = override ?? (await fs.readFile(filePath, 'utf8'));
    if (!override && stats) {
      stats.filesRead += 1;
    }
    files.push(createSourceFile(filePath, text));
  }
  return files;
}

export async function buildContext(
  config: ValidationContextConfig,
  options?: { contentOverrides?: ContentOverrides; stats?: BuildContextStats }
): Promise<ValidationContext> {
  const rootDirAbs = toAbsoluteRoot(config.rootDir);
  const discovered = await discoverFiles({
    rootDir: rootDirAbs,
    filePattern: config.filePattern,
    includeSubdirectories: config.includeSubdirectories
  });

  if (options?.stats) {
    options.stats.filesDiscovered = discovered.length;
  }
  const files = await readSourceFiles(discovered, options?.contentOverrides, options?.stats);
  const id = casefold(config.name);

  return {
    id,
    config,
    rootDirAbs,
    files
  };
}
