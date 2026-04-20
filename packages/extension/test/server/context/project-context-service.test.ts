import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createProjectContextService } from '../../../src/server/context/project-context-service';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-context-svc-'));
}

describe('project context service', () => {
  it('resolves and caches context by file', () => {
    const service = createProjectContextService();
    const root = path.join(process.cwd(), 'ctx-root');
    service.setContexts([
      {
        key: 'HR',
        name: 'HR',
        rootDir: root,
        filePattern: 'HR*.lspt',
        includeSubdirectories: false,
        system: 'HCM'
      }
    ]);

    const file = path.join(root, 'HR858.lspt');
    const first = service.resolveForFile(file);
    const second = service.resolveForFile(file);

    expect(first?.key).toBe('HR');
    expect(second?.key).toBe('HR');
  });

  it('discovers ordered files for context and invalidates cache', async () => {
    const service = createProjectContextService();
    const root = makeTempDir();
    fs.mkdirSync(path.join(root, 'sub'));
    fs.writeFileSync(path.join(root, 'HR859.lspt'), '');
    fs.writeFileSync(path.join(root, 'sub', 'HR858.lspt'), '');
    fs.writeFileSync(path.join(root, 'HR850.lspt'), '');

    service.setContexts([
      {
        key: 'HR',
        name: 'HR',
        rootDir: root,
        filePattern: 'HR*.lspt',
        includeSubdirectories: true,
        system: 'HCM'
      }
    ]);

    const first = await service.getOrderedFiles('HR');
    expect(first.map((file) => path.relative(root, file))).toEqual(['HR850.lspt', path.join('sub', 'HR858.lspt'), 'HR859.lspt']);

    fs.writeFileSync(path.join(root, 'HR851.lspt'), '');
    service.invalidate(path.join(root, 'HR851.lspt'));
    const second = await service.getOrderedFiles('HR');
    expect(second.some((file) => file.endsWith('HR851.lspt'))).toBe(true);
  });

  it('uses full relative path as tie-breaker when basenames collide', async () => {
    const service = createProjectContextService();
    const root = makeTempDir();
    fs.mkdirSync(path.join(root, 'b'));
    fs.mkdirSync(path.join(root, 'a'));
    fs.writeFileSync(path.join(root, 'b', 'HR100.lspt'), '');
    fs.writeFileSync(path.join(root, 'a', 'HR100.lspt'), '');

    service.setContexts([
      {
        key: 'HR',
        name: 'HR',
        rootDir: root,
        filePattern: 'HR*.lspt',
        includeSubdirectories: true,
        system: 'HCM'
      }
    ]);

    const files = await service.getOrderedFiles('HR');
    expect(files.map((file) => path.relative(root, file))).toEqual([path.join('a', 'HR100.lspt'), path.join('b', 'HR100.lspt')]);
  });

  it('returns relevant context keys for a file', () => {
    const service = createProjectContextService();
    const root = path.join(process.cwd(), 'ctx-root');
    service.setContexts([
      {
        key: 'HR',
        name: 'HR',
        rootDir: root,
        filePattern: 'HR*.lspt',
        includeSubdirectories: false,
        system: 'HCM'
      },
      {
        key: 'WS',
        name: 'WS',
        rootDir: root,
        filePattern: 'WS*.lspt',
        includeSubdirectories: false,
        system: 'HCM'
      }
    ]);

    const hr = service.getRelevantContextKeysForFile(path.join(root, 'HR858.lspt'));
    const ws = service.getRelevantContextKeysForFile(path.join(root, 'WS001.lspt'));
    const none = service.getRelevantContextKeysForFile(path.join(root, 'XX001.lspt'));

    expect(hr).toEqual(['HR']);
    expect(ws).toEqual(['WS']);
    expect(none).toEqual([]);
  });
});
