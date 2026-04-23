import fs from 'node:fs';
import path from 'node:path';
import type { Diagnostic } from 'vscode-languageserver/node';

export type PullDiagnosticsPersistedEntry = {
  uri: string;
  filePath: string;
  workspaceKey: string;
  contextKey: string;
  contextSignature: string;
  fileHash: string;
  contextRevision: number;
  resultId: string;
  hash: string;
  diagnostics: Diagnostic[];
  updatedAtMs: number;
};

type PersistedFileShape = {
  version: 2;
  entries: PullDiagnosticsPersistedEntry[];
};

export type PullDiagnosticsPersistLookup = {
  uri: string;
  workspaceKey: string;
  contextKey: string;
  contextSignature: string;
  fileHash: string;
  contextRevision: number;
};

export type PullDiagnosticsPersistMissReason =
  | 'hit'
  | 'no-entry'
  | 'workspace-mismatch'
  | 'context-key-mismatch'
  | 'context-signature-mismatch'
  | 'file-hash-mismatch'
  | 'context-revision-mismatch'
  | 'expired';

export type PullDiagnosticsPersistValidationResult = {
  entry: PullDiagnosticsPersistedEntry | null;
  missReason: PullDiagnosticsPersistMissReason;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isDiagnostic(value: unknown): value is Diagnostic {
  if (!isObject(value)) return false;
  if (typeof value.message !== 'string') return false;
  if (!isObject(value.range)) return false;
  return true;
}

function isPersistedEntry(value: unknown): value is PullDiagnosticsPersistedEntry {
  if (!isObject(value)) return false;
  if (typeof value.uri !== 'string') return false;
  if (typeof value.filePath !== 'string') return false;
  if (typeof value.workspaceKey !== 'string') return false;
  if (typeof value.contextKey !== 'string') return false;
  if (typeof value.contextSignature !== 'string') return false;
  if (typeof value.fileHash !== 'string') return false;
  if (typeof value.contextRevision !== 'number') return false;
  if (typeof value.resultId !== 'string') return false;
  if (typeof value.hash !== 'string') return false;
  if (typeof value.updatedAtMs !== 'number') return false;
  if (!Array.isArray(value.diagnostics)) return false;
  for (const diagnostic of value.diagnostics) {
    if (!isDiagnostic(diagnostic)) return false;
  }
  return true;
}

export type PullDiagnosticsPersistSetResult = {
  evicted: PullDiagnosticsPersistedEntry[];
  replacedExisting: boolean;
};

export class PullDiagnosticsPersistCache {
  private readonly entries = new Map<string, PullDiagnosticsPersistedEntry>();
  private readonly filePath: string;
  private readonly ttlMs: number;
  private readonly maxEntriesPerContext: number;
  private dirty = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(filePath: string, options?: { ttlMs?: number; maxEntriesPerContext?: number }) {
    this.filePath = filePath;
    this.ttlMs = Math.max(0, options?.ttlMs ?? 7 * 24 * 60 * 60 * 1000);
    this.maxEntriesPerContext = Math.max(1, options?.maxEntriesPerContext ?? 256);
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!isObject(parsed) || parsed.version !== 2 || !Array.isArray(parsed.entries)) return;
      for (const candidate of parsed.entries) {
        if (!isPersistedEntry(candidate)) continue;
        this.entries.set(candidate.uri, candidate);
      }
      this.pruneExpiredEntries(Date.now());
      this.pruneCardinality();
    } catch {
      // Best-effort cache: ignore load failures.
    }
  }

  inspect(input: PullDiagnosticsPersistLookup): PullDiagnosticsPersistValidationResult {
    const now = Date.now();
    const entry = this.entries.get(input.uri);
    if (!entry) return { entry: null, missReason: 'no-entry' };
    if (this.isExpired(entry, now)) {
      this.entries.delete(input.uri);
      this.dirty = true;
      return { entry: null, missReason: 'expired' };
    }
    if (entry.workspaceKey !== input.workspaceKey) return { entry: null, missReason: 'workspace-mismatch' };
    if (entry.contextKey !== input.contextKey) return { entry: null, missReason: 'context-key-mismatch' };
    if (entry.contextSignature !== input.contextSignature) return { entry: null, missReason: 'context-signature-mismatch' };
    if (entry.fileHash !== input.fileHash) return { entry: null, missReason: 'file-hash-mismatch' };
    if (entry.contextRevision !== input.contextRevision) return { entry: null, missReason: 'context-revision-mismatch' };
    return { entry, missReason: 'hit' };
  }

  getValidated(input: PullDiagnosticsPersistLookup): PullDiagnosticsPersistedEntry | null {
    return this.inspect(input).entry;
  }

  set(entry: PullDiagnosticsPersistedEntry): PullDiagnosticsPersistSetResult {
    this.pruneExpiredEntries(Date.now());
    const replacedExisting = this.entries.has(entry.uri);
    this.entries.set(entry.uri, entry);
    const evicted = this.pruneCardinality();
    this.dirty = true;
    return { evicted, replacedExisting };
  }

  deleteUri(uri: string): void {
    if (!this.entries.delete(uri)) return;
    this.dirty = true;
  }

  invalidateContext(contextKey: string): void {
    let changed = false;
    for (const [uri, entry] of this.entries) {
      if (entry.contextKey !== contextKey) continue;
      this.entries.delete(uri);
      changed = true;
    }
    if (changed) this.dirty = true;
  }

  invalidateFile(filePathKey: string): void {
    let changed = false;
    for (const [uri, entry] of this.entries) {
      if (entry.filePath !== filePathKey) continue;
      this.entries.delete(uri);
      changed = true;
    }
    if (changed) this.dirty = true;
  }

  async flush(): Promise<void> {
    this.pruneExpiredEntries(Date.now());
    this.pruneCardinality();
    if (!this.dirty) return;
    this.writeQueue = this.writeQueue.then(async () => {
      this.pruneExpiredEntries(Date.now());
      this.pruneCardinality();
      if (!this.dirty) return;
      const payload: PersistedFileShape = {
        version: 2,
        entries: [...this.entries.values()]
      };
      const targetDir = path.dirname(this.filePath);
      const tempPath = `${this.filePath}.tmp`;
      await fs.promises.mkdir(targetDir, { recursive: true });
      await fs.promises.writeFile(tempPath, JSON.stringify(payload), 'utf8');
      await fs.promises.rename(tempPath, this.filePath);
      this.dirty = false;
    }).catch(() => undefined);
    await this.writeQueue;
  }

  private isExpired(entry: PullDiagnosticsPersistedEntry, now: number): boolean {
    return this.ttlMs > 0 && now - entry.updatedAtMs > this.ttlMs;
  }

  private pruneExpiredEntries(now: number): void {
    if (this.ttlMs <= 0) return;
    let changed = false;
    for (const [uri, entry] of this.entries) {
      if (!this.isExpired(entry, now)) continue;
      this.entries.delete(uri);
      changed = true;
    }
    if (changed) this.dirty = true;
  }

  private pruneCardinality(): PullDiagnosticsPersistedEntry[] {
    if (this.maxEntriesPerContext <= 0) return [];
    const evicted: PullDiagnosticsPersistedEntry[] = [];
    const groups = new Map<string, PullDiagnosticsPersistedEntry[]>();
    for (const entry of this.entries.values()) {
      const key = `${entry.workspaceKey}::${entry.contextKey}`;
      const list = groups.get(key) ?? [];
      list.push(entry);
      groups.set(key, list);
    }
    let changed = false;
    for (const list of groups.values()) {
      if (list.length <= this.maxEntriesPerContext) continue;
      list.sort((a, b) => {
        if (b.updatedAtMs !== a.updatedAtMs) return b.updatedAtMs - a.updatedAtMs;
        return a.uri.localeCompare(b.uri);
      });
      for (const entry of list.slice(this.maxEntriesPerContext)) {
        if (!this.entries.delete(entry.uri)) continue;
        evicted.push(entry);
        changed = true;
      }
    }
    if (changed) this.dirty = true;
    return evicted;
  }
}

