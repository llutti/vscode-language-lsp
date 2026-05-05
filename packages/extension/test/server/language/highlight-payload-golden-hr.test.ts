import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import
  {
    compileSingleFile,
    SEMANTIC_TOKEN_MODIFIERS,
    SEMANTIC_TOKEN_TYPES
  } from '@lsp/compiler';

import { shouldSuppressSemanticTokenForTextmate } from '../../../src/server/semantics/highlight-suppression';
import { buildSemanticTokens, prepareSemanticOccurrences } from '../../../src/server/semantics/semantic-payload';

type GoldenFile = {
  filePath: string;
  system: 'HCM' | 'ACESSO' | 'ERP';
};

const HR_FIXTURES_ROOT = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'compiler',
  'test',
  'fixtures',
  'hr-examples'
);

const GOLDEN_SET_QUICK: GoldenFile[] = [
  'golden-trata-comissionado.txt',
  'golden-liberacao-faixa-horaria.txt',
  'golden-consistencia-acerto.txt',
  'golden-estatisticas.txt',
  'golden-atividade-gremial.txt',
  'golden-programacao-sobreaviso.txt',
  'golden-domicilio-marcacao.txt',
  'golden-pendencias-coletivas.txt',
  'golden-areas-autorizadas.txt',
  'golden-consulta-sobreaviso.txt'
].map((name) => ({
  filePath: path.join(HR_FIXTURES_ROOT, name),
  system: 'HCM' as const
}));

function decodeSemanticTokens(data: number[]): Array<{ line: number; character: number; length: number; type: string; modifiers: string[] }> {
  const decoded: Array<{ line: number; character: number; length: number; type: string; modifiers: string[] }> = [];
  let line = 0;
  let character = 0;
  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i] ?? 0;
    const deltaChar = data[i + 1] ?? 0;
    const length = data[i + 2] ?? 0;
    const typeIndex = data[i + 3] ?? 0;
    const modifierMask = data[i + 4] ?? 0;

    line += deltaLine;
    character = deltaLine === 0 ? character + deltaChar : deltaChar;

    const type = SEMANTIC_TOKEN_TYPES[typeIndex] ?? 'unknown';
    const modifiers = SEMANTIC_TOKEN_MODIFIERS.filter((_, idx) => (modifierMask & (1 << idx)) !== 0);
    decoded.push({ line, character, length, type, modifiers });
  }
  return decoded;
}

describe('highlight payload golden set (HR)', () => {
  it('keeps final semantic payload stable after semantic preparation + TextMate suppression', async () => {
    const snapshots: Record<string, string[]> = {};

    for (const item of GOLDEN_SET_QUICK) {
      const text = fs.readFileSync(item.filePath, 'utf8');
      const doc = TextDocument.create(`file://${item.filePath}`, 'lsp', 1, text);
      const compiled = await compileSingleFile({
        filePath: item.filePath,
        text,
        system: item.system,
        includeSemantics: true
      });
      const occurrences = compiled.semanticsByFile?.get(item.filePath) ?? [];
      const filtered = prepareSemanticOccurrences(doc, occurrences)
        .filter((occ) => !shouldSuppressSemanticTokenForTextmate(doc, occ));
      const payload = buildSemanticTokens(filtered);
      const decoded = decodeSemanticTokens(payload.data)
        .slice(0, 180)
        .map((token) => {
          const lineText = text.split(/\r?\n/)[token.line] ?? '';
          const tokenText = lineText.slice(token.character, token.character + token.length).trim();
          const modifiers = token.modifiers.length > 0 ? `.${token.modifiers.join('.')}` : '';
          return `${token.line + 1}:${token.character + 1} ${token.type}${modifiers} ${tokenText}`;
        });
      snapshots[path.basename(item.filePath)] = decoded;
    }

    expect(snapshots).toMatchSnapshot();
  });
});
