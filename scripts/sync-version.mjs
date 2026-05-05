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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const rootPackage = readJson(rootPackagePath);
const version = rootPackage.version;

if (!version) {
  throw new Error(`Root package.json does not define a version: ${rootPackagePath}`);
}

for (const packagePath of packagePaths) {
  const packageJson = readJson(packagePath);
  if (packageJson.version !== version) {
    packageJson.version = version;
    writeJson(packagePath, packageJson);
    console.log(`Updated ${path.relative(repoRoot, packagePath)} to ${version}`);
  }
}

const lockPath = path.join(repoRoot, 'package-lock.json');
if (fs.existsSync(lockPath)) {
  const lock = readJson(lockPath);
  const packageLockEntries = [
    'packages/compiler',
    'packages/extension'
  ];

  let changed = false;
  for (const entry of packageLockEntries) {
    if (lock.packages?.[entry]?.version && lock.packages[entry].version !== version) {
      lock.packages[entry].version = version;
      changed = true;
      console.log(`Updated package-lock.json:${entry} to ${version}`);
    }
  }

  if (changed) {
    writeJson(lockPath, lock);
  }
}

console.log(`Workspace version is ${version}`);
