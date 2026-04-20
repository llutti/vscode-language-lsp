import fg from 'fast-glob';
import path from 'node:path';
import { casefold } from '../utils/casefold';

const fileNameCollator = new Intl.Collator('en-US', { numeric: true, sensitivity: 'base' });

function sortByBasenameCaseInsensitive(files: string[]): string[] {
  return files.sort((a, b) => {
    const baseA = casefold(path.basename(a));
    const baseB = casefold(path.basename(b));
    const byBase = fileNameCollator.compare(baseA, baseB);
    if (byBase !== 0) return byBase;

    // Tie-breaker for determinism when basenames collide (e.g., subdirectories).
    const fullA = casefold(a);
    const fullB = casefold(b);
    return fileNameCollator.compare(fullA, fullB);
  });
}

export async function discoverFiles(params: {
  rootDir: string;
  filePattern: string; // glob ou "re:<regex>"
  includeSubdirectories: boolean;
}): Promise<string[]> {
  const { rootDir, filePattern, includeSubdirectories } = params;

  // Normalize to an absolute, deterministic path.
  // This reduces churn on Windows where cwd-joins and mixed separators can create
  // non-equal strings for the same directory.
  const absoluteRoot = path.resolve(rootDir);
  const isRegex = filePattern.startsWith('re:');
  let regex: RegExp | null = null;
  if (isRegex) {
    try {
      regex = new RegExp(filePattern.slice(3));
    } catch {
      return [];
    }
  }

  if (!isRegex) {
    const basePattern = includeSubdirectories ? filePattern : path.basename(filePattern);
    const pattern = includeSubdirectories ? '**/' + basePattern : basePattern;
    const matches = await fg(pattern, { cwd: absoluteRoot, onlyFiles: true, dot: false });
    const resolved = matches.map((p: string) => path.resolve(absoluteRoot, p));
    return sortByBasenameCaseInsensitive(resolved);
  }

  const basePattern = includeSubdirectories ? '**/*' : '*';
  const matches = await fg(basePattern, { cwd: absoluteRoot, onlyFiles: true, dot: false });
  const filtered = matches.filter((p: string) => regex!.test(path.basename(p)));
  const resolved = filtered.map((p: string) => path.resolve(absoluteRoot, p));
  return sortByBasenameCaseInsensitive(resolved);
}
