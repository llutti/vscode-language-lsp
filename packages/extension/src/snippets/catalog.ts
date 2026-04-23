import fs from 'node:fs';
import path from 'node:path';

export type ExtensionSnippet = {
  label: string;
  prefix: string;
  body: string[];
  detail?: string;
};

type RawSnippetEntry = {
  prefix?: unknown;
  body?: unknown;
  description?: unknown;
};

let cachedSnippets: ExtensionSnippet[] | null = null;

export function resolveSnippetsJsonPath(baseDir = __dirname): string
{
  const candidates = [
    path.resolve(baseDir, '..', '..', 'snippets.json'),
    path.resolve(baseDir, '..', 'snippets.json')
  ];
  for (const candidate of candidates)
  {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0]!;
}

function getSnippetsJsonPath(): string
{
  return resolveSnippetsJsonPath(__dirname);
}

function normalizeSnippet(label: string, raw: RawSnippetEntry): ExtensionSnippet | null
{
  if (typeof raw.prefix !== 'string' || raw.prefix.trim().length === 0) return null;
  const body = Array.isArray(raw.body)
    ? raw.body.filter((line): line is string => typeof line === 'string')
    : typeof raw.body === 'string'
      ? [raw.body]
      : [];
  if (body.length === 0) return null;
  return {
    label,
    prefix: raw.prefix,
    body,
    detail: typeof raw.description === 'string' ? raw.description : undefined
  };
}

export function loadExtensionSnippets(): ExtensionSnippet[]
{
  if (cachedSnippets) return cachedSnippets;
  const snippetsPath = getSnippetsJsonPath();
  const raw = fs.readFileSync(snippetsPath, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, RawSnippetEntry>;
  const snippets = Object.entries(parsed)
    .map(([label, entry]) => normalizeSnippet(label, entry))
    .filter((entry): entry is ExtensionSnippet => entry !== null);
  cachedSnippets = snippets;
  return snippets;
}

export function getCompletionSnippets(): Array<{ label: string; snippet: string; detail?: string }>
{
  return loadExtensionSnippets().map((snippet) => ({
    label: snippet.label,
    snippet: snippet.body.join('\n'),
    detail: snippet.detail
  }));
}

export function resetSnippetCacheForTests(): void
{
  cachedSnippets = null;
}
