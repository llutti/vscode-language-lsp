import fs from 'node:fs';
import path from 'node:path';

export function loadFixture(name: string): string {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const fixturePath = path.join(fixturesDir, name);
  return fs.readFileSync(fixturePath, 'utf8');
}
