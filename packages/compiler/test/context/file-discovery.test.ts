import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverFiles } from '../../src/context/file-discovery';

function makeTempDir(): string {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-'));
  return base;
}

describe('file discovery', () => {
  it('orders files by basename alphabetically', async () => {
    const dir = makeTempDir();
    const a = path.join(dir, 'B.txt');
    const b = path.join(dir, 'a.txt');
    fs.writeFileSync(a, 'b');
    fs.writeFileSync(b, 'a');

    const files = await discoverFiles({
      rootDir: dir,
      filePattern: '*.txt',
      includeSubdirectories: false
    });

    expect(files.length).toBe(2);
    expect(path.basename(files[0]).toLowerCase()).toBe('a.txt');
    expect(path.basename(files[1]).toLowerCase()).toBe('b.txt');
  });

  it('uses basename when includeSubdirectories is false', async () => {
    const dir = makeTempDir();
    const sub = path.join(dir, 'sub');
    fs.mkdirSync(sub);
    const rootFile = path.join(dir, 'HR1.txt');
    const nestedFile = path.join(sub, 'HR2.txt');
    fs.writeFileSync(rootFile, 'root');
    fs.writeFileSync(nestedFile, 'nested');

    const files = await discoverFiles({
      rootDir: dir,
      filePattern: 'sub/HR*.txt',
      includeSubdirectories: false
    });

    expect(files.length).toBe(1);
    expect(path.basename(files[0]).toLowerCase()).toBe('hr1.txt');
  });

  it('supports regex patterns with subdirectories enabled', async () => {
    const dir = makeTempDir();
    const sub = path.join(dir, 'sub');
    fs.mkdirSync(sub);
    const rootFile = path.join(dir, 'HR1.txt');
    const nestedFile = path.join(sub, 'HR2.txt');
    fs.writeFileSync(rootFile, 'root');
    fs.writeFileSync(nestedFile, 'nested');

    const files = await discoverFiles({
      rootDir: dir,
      filePattern: 're:^HR.*\\.txt$',
      includeSubdirectories: true
    });

    expect(files.length).toBe(2);
    expect(path.basename(files[0]).toLowerCase()).toBe('hr1.txt');
    expect(path.basename(files[1]).toLowerCase()).toBe('hr2.txt');
  });

  it('orders subdirectory matches by basename when includeSubdirectories=true', async () => {
    const dir = makeTempDir();
    const aDir = path.join(dir, 'a');
    const bDir = path.join(dir, 'b');
    fs.mkdirSync(aDir);
    fs.mkdirSync(bDir);
    const a1 = path.join(aDir, '1.lspt');
    const b0 = path.join(bDir, '0.lspt');
    const b1 = path.join(bDir, '1.lspt');
    fs.writeFileSync(a1, 'a1');
    fs.writeFileSync(b0, 'b0');
    fs.writeFileSync(b1, 'b1');

    const files = await discoverFiles({
      rootDir: dir,
      filePattern: '*.lspt',
      includeSubdirectories: true
    });

    const rel = (p: string) => path.relative(dir, p).split(path.sep).join('/').toLowerCase();
    expect(files.map(rel)).toEqual(['b/0.lspt', 'a/1.lspt', 'b/1.lspt']);
  });

  it('returns empty list for invalid regex filePattern', async () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'HR1.txt'), 'root');

    const files = await discoverFiles({
      rootDir: dir,
      filePattern: 're:[',
      includeSubdirectories: true
    });

    expect(files).toEqual([]);
  });
});
