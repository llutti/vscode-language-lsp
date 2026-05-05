import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createSourceFile } from '../../src/source/source-file';
import { parseFiles } from '../../src/parser/parser';
import { analyzeProgramWithSemantics } from '../../src/semantic/analyzer';

type GoldenFile = {
  filePath: string;
  system: 'HCM' | 'ACESSO' | 'ERP';
};

const HR_FIXTURES_ROOT = path.join(__dirname, '..', 'fixtures', 'hr-examples');

const GOLDEN_SET_QUICK: GoldenFile[] = [
  {
    filePath: path.join(HR_FIXTURES_ROOT, 'golden-trata-comissionado.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(HR_FIXTURES_ROOT, 'golden-liberacao-faixa-horaria.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(HR_FIXTURES_ROOT, 'golden-consistencia-acerto.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(HR_FIXTURES_ROOT, 'golden-estatisticas.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(HR_FIXTURES_ROOT, 'golden-atividade-gremial.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(HR_FIXTURES_ROOT, 'golden-programacao-sobreaviso.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(HR_FIXTURES_ROOT, 'golden-domicilio-marcacao.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(HR_FIXTURES_ROOT, 'golden-pendencias-coletivas.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(HR_FIXTURES_ROOT, 'golden-areas-autorizadas.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(HR_FIXTURES_ROOT, 'golden-consulta-sobreaviso.txt'),
    system: 'HCM'
  }
];

function discoverHrFilesFull(maxFiles: number): GoldenFile[] {
  const files = fs.readdirSync(HR_FIXTURES_ROOT)
    .filter((name) => name.toLowerCase().endsWith('.txt'))
    .map((name) => path.join(HR_FIXTURES_ROOT, name))
    .sort()
    .slice(0, maxFiles);
  return files.map((filePath) => ({ filePath, system: 'HCM' as const }));
}

function resolveGoldenSet(): GoldenFile[] {
  if (process.env.LSP_HIGHLIGHT_GOLDEN_FULL === '1') {
    return discoverHrFilesFull(20);
  }
  return GOLDEN_SET_QUICK;
}

function readTextForRange(text: string, range: { start: { line: number; character: number }; end: { line: number; character: number } }): string {
  if (range.start.line !== range.end.line) return '<multiline>';
  const lines = text.split(/\r?\n/);
  const line = lines[range.start.line] ?? '';
  return line.slice(range.start.character, range.end.character);
}

describe('highlight golden set (HR)', () => {
  it('keeps semantic occurrences stable for the curated HR files', async () => {
    const goldenSet = resolveGoldenSet();
    const snapshots: Record<string, string[]> = {};

    for (const item of goldenSet) {
      const text = fs.readFileSync(item.filePath, 'utf8');
      const source = createSourceFile(item.filePath, text);
      const { program } = parseFiles([source]);
      const result = await analyzeProgramWithSemantics({
        contextId: 'golden',
        system: item.system,
        program
      });
      const occurrences = result.occurrencesByFile.get(source.path) ?? [];
      const normalized = [...occurrences]
        .sort((a, b) =>
          a.range.start.line !== b.range.start.line
            ? a.range.start.line - b.range.start.line
            : a.range.start.character - b.range.start.character
        )
        .slice(0, 160)
        .map((occ) => {
          const mods = occ.tokenModifiers.length > 0 ? `.${occ.tokenModifiers.join('.')}` : '';
          const textAtRange = readTextForRange(text, occ.range).trim();
          return `${occ.range.start.line + 1}:${occ.range.start.character + 1} ${occ.tokenType}${mods} ${textAtRange}`;
        });

      snapshots[path.basename(item.filePath)] = normalized;
    }

    expect(snapshots).toMatchSnapshot();
  });
});
