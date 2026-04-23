import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileContext, formatText } from '../../src';

function listTopLevelTxtFiles(dir: string, prefix: RegExp, limit: number): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => prefix.test(name) && name.toLowerCase().endsWith('.txt'))
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    .slice(0, limit);
}

function toRegexPatternForBasenames(fileNames: string[]): string {
  const escaped = fileNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return `re:^(${escaped.join('|')})$`;
}

function diagnosticSignature(input: Awaited<ReturnType<typeof compileContext>>): string {
  const rows = input.diagnostics
    .map((diag) => [
      diag.id,
      diag.severity,
      path.basename(diag.sourcePath),
      `${diag.range.start.line}:${diag.range.start.character}`,
      diag.message
    ].join('|'))
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  return rows.join('\n');
}

function semanticCountByFile(input: Awaited<ReturnType<typeof compileContext>>): Map<string, number> {
  const out = new Map<string, number>();
  const entries = input.semanticsByFile;
  if (!entries) return out;
  for (const [filePath, occurrences] of entries.entries()) {
    out.set(path.basename(filePath), occurrences.length);
  }
  return out;
}

function detectEol(text: string): '\n' | '\r\n' {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

describe('TS-like stabilization (real examples)', () => {
  it('keeps diagnostics and semantic counts stable across repeated compile runs (TR)', async () => {
    const trRoot = path.join(process.cwd(), 'exemplos', 'TR');
    const selected = listTopLevelTxtFiles(trRoot, /^TR.*\.txt$/i, 6);
    if (selected.length < 3) return;

    const config = {
      name: 'TR_REAL_STABILITY',
      rootDir: path.join('exemplos', 'TR'),
      filePattern: toRegexPatternForBasenames(selected),
      includeSubdirectories: false,
      system: 'HCM' as const
    };

    const run1 = await compileContext(config, undefined, { includeSemantics: true });
    const run2 = await compileContext(config, undefined, { includeSemantics: true });
    const run3 = await compileContext(config, undefined, { includeSemantics: true });

    expect(run1.files.map((f) => path.basename(f)).sort()).toEqual(selected.slice().sort());
    expect(diagnosticSignature(run2)).toBe(diagnosticSignature(run1));
    expect(diagnosticSignature(run3)).toBe(diagnosticSignature(run1));

    const sem1 = semanticCountByFile(run1);
    const sem2 = semanticCountByFile(run2);
    const sem3 = semanticCountByFile(run3);
    expect([...sem2.entries()].sort()).toEqual([...sem1.entries()].sort());
    expect([...sem3.entries()].sort()).toEqual([...sem1.entries()].sort());
  }, 120000);

  it('keeps formatter idempotent on curated real files (TR + SM)', () => {
    const candidates = [
      ...listTopLevelTxtFiles(path.join(process.cwd(), 'exemplos', 'TR'), /^TR.*\.txt$/i, 3).map((f) =>
        path.join(process.cwd(), 'exemplos', 'TR', f)
      ),
      ...listTopLevelTxtFiles(path.join(process.cwd(), 'exemplos', 'SM'), /^SM.*\.txt$/i, 2).map((f) =>
        path.join(process.cwd(), 'exemplos', 'SM', f)
      )
    ];

    if (candidates.length === 0) return;

    for (const filePath of candidates) {
      const input = fs.readFileSync(filePath, 'utf8');
      const once = formatText({ text: input, options: { indentSize: 2, useTabs: false } }).text;
      const twice = formatText({ text: once, options: { indentSize: 2, useTabs: false } }).text;
      expect(twice).toBe(once);
      expect(detectEol(once)).toBe(detectEol(input));
    }
  }, 60000);
});
