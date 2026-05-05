import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const rootPackagePath = path.join(repoRoot, 'package.json');
const packagePaths = [
  rootPackagePath,
  path.join(repoRoot, 'packages', 'compiler', 'package.json'),
  path.join(repoRoot, 'packages', 'extension', 'package.json')
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const rootVersion = readJson(rootPackagePath).version;
const mismatches = [];

for (const packagePath of packagePaths) {
  const version = readJson(packagePath).version;
  if (version !== rootVersion) {
    mismatches.push(`${path.relative(repoRoot, packagePath)} has ${version}, expected ${rootVersion}`);
  }
}

const lockPath = path.join(repoRoot, 'package-lock.json');
if (fs.existsSync(lockPath)) {
  const lock = readJson(lockPath);
  for (const entry of ['packages/compiler', 'packages/extension']) {
    const version = lock.packages?.[entry]?.version;
    if (version && version !== rootVersion) {
      mismatches.push(`package-lock.json:${entry} has ${version}, expected ${rootVersion}`);
    }
  }
}

if (mismatches.length > 0) {
  console.error('Version mismatch found:');
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch}`);
  }
  console.error('\nRun: npm run version:sync');
  process.exit(1);
}

console.log(`All workspace package versions are ${rootVersion}`);
