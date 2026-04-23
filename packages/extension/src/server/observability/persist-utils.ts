import fs from 'node:fs';
import path from 'node:path';

export type PersistKind = 'metrics' | 'observability';

export type PersistRotationMeta = {
  rotationOf: string | null;
  rotationIndex: number;
  rotatedAt: string | null;
};

type AppendPersistLogInput = {
  filePath: string;
  payload: { [key: string]: unknown };
  kind: PersistKind;
  rotation: { maxBytes: number; maxFiles: number };
  queueByPath: Map<string, Promise<void>>;
  openedAtByPath: Map<string, string>;
  rotationMetaByPath: Map<string, PersistRotationMeta>;
  dynamicPersistTargets: Map<string, string>;
  buildRuntimeMeta: (kind: PersistKind, filePath: string) => { [key: string]: unknown };
};

export function buildTimestampedFileName(prefix: string, extension: string): string
{
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${stamp}.${extension}`;
}

export function resolvePersistTarget(
  configuredPath: string,
  kind: PersistKind,
  dynamicPersistTargets: Map<string, string>
): string
{
  const value = configuredPath.trim();
  if (!value) return '';
  const key = `${kind}:${value}`;
  const cached = dynamicPersistTargets.get(key);
  if (cached) return cached;

  let target = value;
  try
  {
    const exists = fs.existsSync(value);
    if (exists && fs.statSync(value).isDirectory())
    {
      target = path.join(value, buildTimestampedFileName(kind === 'metrics' ? 'lsp-metrics' : 'lsp-observability', 'jsonl'));
    } else if (!exists && path.extname(value) === '')
    {
      fs.mkdirSync(value, { recursive: true });
      target = path.join(value, buildTimestampedFileName(kind === 'metrics' ? 'lsp-metrics' : 'lsp-observability', 'jsonl'));
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
  } catch
  {
    target = value;
  }

  dynamicPersistTargets.set(key, target);
  return target;
}

function buildRotatedFilePath(filePath: string): string
{
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(dir, `${base}-${stamp}${ext}`);
}

function nextRotationMeta(filePath: string, rotatedPath: string, rotationMetaByPath: Map<string, PersistRotationMeta>): PersistRotationMeta
{
  const current = rotationMetaByPath.get(filePath);
  return {
    rotationOf: path.basename(rotatedPath),
    rotationIndex: (current?.rotationIndex ?? 0) + 1,
    rotatedAt: new Date().toISOString()
  };
}

export async function pruneRotatedFiles(filePath: string, maxFiles: number): Promise<void>
{
  if (maxFiles <= 0) return;
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const prefix = `${base}-`;
  const files = await fs.promises.readdir(dir).catch(() => []);
  const rotated: Array<{ file: string; mtimeMs: number }> = [];
  for (const file of files)
  {
    if (!file.startsWith(prefix) || !file.endsWith(ext)) continue;
    const fullPath = path.join(dir, file);
    const stat = await fs.promises.stat(fullPath).catch(() => null);
    if (!stat) continue;
    rotated.push({ file: fullPath, mtimeMs: stat.mtimeMs });
  }
  rotated.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const toDelete = rotated.slice(maxFiles);
  await Promise.all(toDelete.map((item) => fs.promises.rm(item.file, { force: true }).catch(() => undefined)));
}

export async function rotateFileIfNeeded(
  filePath: string,
  maxBytes: number,
  maxFiles: number,
  openedAtByPath: Map<string, string>,
  rotationMetaByPath: Map<string, PersistRotationMeta>
): Promise<void>
{
  if (!maxBytes || maxBytes <= 0) return;
  const stat = await fs.promises.stat(filePath).catch(() => null);
  if (!stat || stat.size < maxBytes) return;
  const rotatedPath = buildRotatedFilePath(filePath);
  const nextMeta = nextRotationMeta(filePath, rotatedPath, rotationMetaByPath);
  await fs.promises.rename(filePath, rotatedPath).catch(() => undefined);
  rotationMetaByPath.set(filePath, nextMeta);
  openedAtByPath.delete(filePath);
  await pruneRotatedFiles(filePath, maxFiles);
}

export async function appendPersistLog(input: AppendPersistLogInput): Promise<void>
{
  const resolvedPath = resolvePersistTarget(input.filePath, input.kind, input.dynamicPersistTargets);
  if (!resolvedPath) return;
  const line = `${JSON.stringify(input.payload)}\n`;
  const pending = input.queueByPath.get(resolvedPath) ?? Promise.resolve();
  const next = pending
    .then(async () =>
    {
      await rotateFileIfNeeded(
        resolvedPath,
        input.rotation.maxBytes,
        input.rotation.maxFiles,
        input.openedAtByPath,
        input.rotationMetaByPath
      );
      const stat = await fs.promises.stat(resolvedPath).catch(() => null);
      if (!stat || stat.size === 0)
      {
        if (!input.openedAtByPath.has(resolvedPath))
        {
          input.openedAtByPath.set(resolvedPath, new Date().toISOString());
        }
        await fs.promises.appendFile(resolvedPath, `${JSON.stringify(input.buildRuntimeMeta(input.kind, resolvedPath))}\n`);
      }
      await fs.promises.appendFile(resolvedPath, line);
    })
    .catch(() => undefined);
  input.queueByPath.set(resolvedPath, next);
  await next;
}
