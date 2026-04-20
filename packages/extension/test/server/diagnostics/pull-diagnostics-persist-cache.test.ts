import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Diagnostic } from 'vscode-languageserver/node';
import { describe, expect, it } from 'vitest';
import { PullDiagnosticsPersistCache } from '../../../src/server/diagnostics/pull-diagnostics-persist-cache';

function diag(message: string): Diagnostic {
  return {
    code: 'LSP1002',
    severity: 1,
    message,
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 1 }
    }
  };
}

function tempFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-pull-persist-'));
  return path.join(dir, 'pull-cache.json');
}

describe('pull diagnostics persist cache', () => {
  it('persists entries to disk and reloads valid match', async () => {
    const filePath = tempFile();
    const cache = new PullDiagnosticsPersistCache(filePath);
    cache.set({
      uri: 'file:///a.txt',
      filePath: '/a.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-a',
      contextRevision: 0,
      resultId: '1:abcd',
      hash: 'abcd',
      diagnostics: [diag('x')],
      updatedAtMs: Date.now()
    });
    await cache.flush();

    const loaded = new PullDiagnosticsPersistCache(filePath);
    await loaded.load();
    const entry = loaded.getValidated({
      uri: 'file:///a.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-a',
      contextRevision: 0
    });
    expect(entry?.resultId).toBe('1:abcd');
    expect(entry?.diagnostics).toHaveLength(1);
  });

  it('reports miss reason for strict validation failures', () => {
    const filePath = tempFile();
    const cache = new PullDiagnosticsPersistCache(filePath);
    cache.set({
      uri: 'file:///a.txt',
      filePath: '/a.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-a',
      contextRevision: 2,
      resultId: '1:abcd',
      hash: 'abcd',
      diagnostics: [diag('x')],
      updatedAtMs: Date.now()
    });

    expect(cache.inspect({
      uri: 'file:///a.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-a',
      contextRevision: 2
    }).missReason).toBe('hit');

    expect(cache.inspect({
      uri: 'file:///a.txt',
      workspaceKey: 'ws-b',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-a',
      contextRevision: 2
    }).missReason).toBe('workspace-mismatch');

    expect(cache.inspect({
      uri: 'file:///a.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-b',
      contextSignature: 'sig-a',
      fileHash: 'hash-a',
      contextRevision: 2
    }).missReason).toBe('context-key-mismatch');

    expect(cache.inspect({
      uri: 'file:///a.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-b',
      fileHash: 'hash-a',
      contextRevision: 2
    }).missReason).toBe('context-signature-mismatch');

    expect(cache.inspect({
      uri: 'file:///a.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-b',
      contextRevision: 2
    }).missReason).toBe('file-hash-mismatch');

    expect(cache.inspect({
      uri: 'file:///a.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-a',
      contextRevision: 3
    }).missReason).toBe('context-revision-mismatch');
  });

  it('expires stale entries and enforces cap per workspace/context', () => {
    const now = Date.now();
    const cache = new PullDiagnosticsPersistCache(tempFile(), {
      ttlMs: 50,
      maxEntriesPerContext: 2
    });
    cache.set({
      uri: 'file:///stale.txt',
      filePath: '/stale.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-stale',
      contextRevision: 0,
      resultId: '1:stale',
      hash: 'stale',
      diagnostics: [diag('stale')],
      updatedAtMs: now - 100
    });
    expect(cache.inspect({
      uri: 'file:///stale.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-stale',
      contextRevision: 0
    }).missReason).toBe('expired');

    cache.set({
      uri: 'file:///1.txt',
      filePath: '/1.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-1',
      contextRevision: 0,
      resultId: '1:1',
      hash: '1',
      diagnostics: [diag('1')],
      updatedAtMs: now + 1
    });
    cache.set({
      uri: 'file:///2.txt',
      filePath: '/2.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-2',
      contextRevision: 0,
      resultId: '1:2',
      hash: '2',
      diagnostics: [diag('2')],
      updatedAtMs: now + 2
    });
    const thirdWrite = cache.set({
      uri: 'file:///3.txt',
      filePath: '/3.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-3',
      contextRevision: 0,
      resultId: '1:3',
      hash: '3',
      diagnostics: [diag('3')],
      updatedAtMs: now + 3
    });

    expect(thirdWrite.evicted.map((entry) => entry.uri)).toEqual(['file:///1.txt']);

    expect(cache.inspect({
      uri: 'file:///1.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-1',
      contextRevision: 0
    }).missReason).toBe('no-entry');
    expect(cache.getValidated({
      uri: 'file:///2.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-2',
      contextRevision: 0
    })?.resultId).toBe('1:2');
    expect(cache.getValidated({
      uri: 'file:///3.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-3',
      contextRevision: 0
    })?.resultId).toBe('1:3');
  });


  it('ignores legacy cache file versions', async () => {
    const filePath = tempFile();
    fs.writeFileSync(filePath, JSON.stringify({
      version: 1,
      entries: [{
        uri: 'file:///legacy.txt',
        filePath: '/legacy.txt',
        contextKey: 'ctx-a',
        contextSignature: 'sig-a',
        fileHash: 'hash-a',
        contextRevision: 0,
        resultId: '1:legacy',
        hash: 'legacy',
        diagnostics: [diag('legacy')],
        updatedAtMs: Date.now()
      }]
    }), 'utf8');

    const loaded = new PullDiagnosticsPersistCache(filePath);
    await loaded.load();

    expect(loaded.inspect({
      uri: 'file:///legacy.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-a',
      contextRevision: 0
    }).missReason).toBe('no-entry');
  });

  it('invalidates by context and by file path', () => {
    const cache = new PullDiagnosticsPersistCache(tempFile());
    cache.set({
      uri: 'file:///a.txt',
      filePath: '/a.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-a',
      contextRevision: 0,
      resultId: '1:a',
      hash: 'a',
      diagnostics: [diag('a')],
      updatedAtMs: Date.now()
    });
    cache.set({
      uri: 'file:///b.txt',
      filePath: '/b.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-b',
      contextSignature: 'sig-b',
      fileHash: 'hash-b',
      contextRevision: 0,
      resultId: '1:b',
      hash: 'b',
      diagnostics: [diag('b')],
      updatedAtMs: Date.now()
    });

    cache.invalidateFile('/a.txt');
    expect(cache.getValidated({
      uri: 'file:///a.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-a',
      contextSignature: 'sig-a',
      fileHash: 'hash-a',
      contextRevision: 0
    })).toBeNull();

    cache.invalidateContext('ctx-b');
    expect(cache.getValidated({
      uri: 'file:///b.txt',
      workspaceKey: 'ws-a',
      contextKey: 'ctx-b',
      contextSignature: 'sig-b',
      fileHash: 'hash-b',
      contextRevision: 0
    })).toBeNull();
  });
});
