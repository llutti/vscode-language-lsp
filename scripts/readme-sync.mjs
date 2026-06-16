import { copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const source = resolve(rootDir, 'packages/extension/README.md');
const target = resolve(rootDir, 'README.md');

await copyFile(source, target);
