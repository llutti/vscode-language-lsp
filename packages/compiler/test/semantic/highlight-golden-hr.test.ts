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

const GOLDEN_SET_QUICK: GoldenFile[] = [
  {
    filePath: path.join(__dirname, '..', '..', '..', '..', 'exemplos/HR/HR511 - PY - Trata comisionado sin justificar.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(__dirname, '..', '..', '..', '..', 'exemplos/HR/HR879 - AEM - Liberacao Faixa Horaria Turno.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(__dirname, '..', '..', '..', '..', 'exemplos/HR/HR512 - PY - Apuracao - Consistencia Acerto.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(__dirname, '..', '..', '..', '..', 'exemplos/HR/HR884 - AEM - Estatisticas.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(__dirname, '..', '..', '..', '..', 'exemplos/HR/HR881 - AEM - Pesquisa Utilizacao Ativ Gremial.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(__dirname, '..', '..', '..', '..', 'exemplos/HR/HR874 - ESA - Consulta Programacao Sobreaviso.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(__dirname, '..', '..', '..', '..', 'exemplos/HR/HR864 - AEM - Domicilio Marcacao.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(__dirname, '..', '..', '..', '..', 'exemplos/HR/HR897 - AEM - Criar Executar Pendencias Coletivas.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(__dirname, '..', '..', '..', '..', 'exemplos/HR/HR873 - ESA - Areas Autorizadas.txt'),
    system: 'HCM'
  },
  {
    filePath: path.join(__dirname, '..', '..', '..', '..', 'exemplos/HR/HR866 - ESA - Consulta Sobreaviso Realizado.txt'),
    system: 'HCM'
  }
];

function discoverHrFilesFull(maxFiles: number): GoldenFile[] {
  const hrRoot = path.join(__dirname, '..', '..', '..', '..', 'exemplos/HR');
  const files = fs.readdirSync(hrRoot)
    .filter((name) => name.toLowerCase().endsWith('.txt'))
    .map((name) => path.join(hrRoot, name))
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
