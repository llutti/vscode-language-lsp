import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildRenameEdits,
  buildSymbolQueryScopeForContext,
  buildSymbolQueryScopeForSingleFile,
  getOccurrences,
  prepareRename,
  renameSymbol,
  resolveSymbolAtPosition
} from '../../src';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-v2-symbol-query-'));
}

function indexToPosition(text: string, index: number): { line: number; character: number } {
  const lines = text.split(/\r?\n/);
  let offset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const lineEnd = offset + line.length;
    if (index <= lineEnd) {
      return { line: i, character: index - offset };
    }
    offset = lineEnd + 1;
  }
  const lastLine = lines.length - 1;
  const lastText = lines[lastLine] ?? '';
  return { line: lastLine, character: lastText.length };
}

function positionForOccurrence(text: string, needle: string, occurrence = 1): { line: number; character: number } {
  let start = 0;
  let idx = -1;
  for (let i = 0; i < occurrence; i += 1) {
    idx = text.indexOf(needle, start);
    if (idx < 0) throw new Error(`needle not found: ${needle}`);
    start = idx + needle.length;
  }
  return indexToPosition(text, idx + 1);
}

describe('symbol query core', () => {
  it('resolve definition for custom function call', async () => {
    const dir = makeTempDir();
    const fileA = path.join(dir, 'A.lsp');
    const fileB = path.join(dir, 'B.lsp');
    const textA = [
      'Definir Funcao Soma(Numero a);',
      'Funcao Soma(Numero a);',
      'Inicio',
      '  a = a + 1;',
      'Fim;'
    ].join('\n');
    const textB = [
      'Inicio',
      '  Soma(1);',
      'Fim;'
    ].join('\n');
    fs.writeFileSync(fileA, textA, 'utf8');
    fs.writeFileSync(fileB, textB, 'utf8');

    const scope = await buildSymbolQueryScopeForContext({
      name: 'SYMBOL_QUERY_DEF',
      rootDir: dir,
      filePattern: '*.lsp',
      includeSubdirectories: false,
      system: 'HCM'
    });

    const resolved = resolveSymbolAtPosition({
      scope,
      filePath: fileB,
      position: positionForOccurrence(textB, 'Soma')
    });

    expect(resolved?.kind).toBe('customFunction');
    expect(resolved?.definitionLocations.length).toBe(2);
  });

  it('resolve variable/parameter and occurrences with identifier-only ranges', async () => {
    const filePath = '/virtual/symbol-core.lsp';
    const text = [
      'Funcao F(Numero pX);',
      'Inicio',
      '  Definir Numero nA;',
      '  nA = pX;',
      '  Se (nA > 0) Inicio',
      '    nA = nA + 1;',
      '  Fim;',
      'Fim;'
    ].join('\n');

    const scope = await buildSymbolQueryScopeForSingleFile({
      filePath,
      text,
      system: 'HCM'
    });

    const resolvedVar = resolveSymbolAtPosition({
      scope,
      filePath,
      position: positionForOccurrence(text, 'nA', 2)
    });
    expect(resolvedVar?.kind).toBe('variable');

    const occurrences = resolvedVar ? getOccurrences(resolvedVar, scope) : new Map<string, { start: { line: number; character: number }; end: { line: number; character: number } }[]>();
    const fileOccurrences = occurrences.get(filePath) ?? [];
    expect(fileOccurrences.length).toBeGreaterThanOrEqual(5);
    expect(fileOccurrences.every((range) => range.end.character - range.start.character === 2)).toBe(true);

    const resolvedParam = resolveSymbolAtPosition({
      scope,
      filePath,
      position: positionForOccurrence(text, 'pX')
    });
    expect(resolvedParam?.kind).toBe('variable');
    const paramWidth = (resolvedParam?.nameRange.end.character ?? 0) - (resolvedParam?.nameRange.start.character ?? 0);
    expect(paramWidth).toBe(2);
  });

  it('build rename edits for custom function across files', async () => {
    const dir = makeTempDir();
    const fileA = path.join(dir, 'A.lsp');
    const fileB = path.join(dir, 'B.lsp');
    const textA = [
      'Definir Funcao Soma(Numero a);',
      'Funcao Soma(Numero a);',
      'Inicio',
      '  a = a + 1;',
      'Fim;'
    ].join('\n');
    const textB = [
      'Inicio',
      '  Soma(1);',
      'Fim;'
    ].join('\n');
    fs.writeFileSync(fileA, textA, 'utf8');
    fs.writeFileSync(fileB, textB, 'utf8');

    const scope = await buildSymbolQueryScopeForContext({
      name: 'SYMBOL_QUERY_RENAME',
      rootDir: dir,
      filePattern: '*.lsp',
      includeSubdirectories: false,
      system: 'HCM'
    });

    const resolved = resolveSymbolAtPosition({
      scope,
      filePath: fileB,
      position: positionForOccurrence(textB, 'Soma')
    });

    expect(resolved?.kind).toBe('customFunction');
    if (!resolved) return;

    const edits = buildRenameEdits({
      scope,
      resolved,
      newName: 'Somar'
    });

    expect((edits.get(fileA) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((edits.get(fileB) ?? []).length).toBe(1);
  });

  it('classifies official/internal and ignores comment/string/keyword positions', async () => {
    const filePath = '/virtual/symbol-core-guard.lsp';
    const text = [
      'Inicio',
      '  @ IntParaAlfa @',
      '  x = "IntParaAlfa";',
      '  IntParaAlfa(1, x);',
      '  y = CFalso;',
      'Fim;'
    ].join('\n');

    const scope = await buildSymbolQueryScopeForSingleFile({
      filePath,
      text,
      system: 'HCM'
    });

    const commentHit = resolveSymbolAtPosition({
      scope,
      filePath,
      position: positionForOccurrence(text, 'IntParaAlfa', 1)
    });
    expect(commentHit).toBeNull();

    const stringHit = resolveSymbolAtPosition({
      scope,
      filePath,
      position: positionForOccurrence(text, 'IntParaAlfa', 2)
    });
    expect(stringHit).toBeNull();

    const officialHit = resolveSymbolAtPosition({
      scope,
      filePath,
      position: positionForOccurrence(text, 'IntParaAlfa', 3)
    });
    expect(officialHit?.kind).toBe('officialFunction');

    const internalHit = resolveSymbolAtPosition({
      scope,
      filePath,
      position: positionForOccurrence(text, 'CFalso')
    });
    expect(internalHit?.kind).toBe('internal');
  });

  it('prepareRename blocks keyword/comment/string and internal/official symbols', async () => {
    const filePath = '/virtual/symbol-core-prepare.lsp';
    const text = [
      'Inicio',
      '  @ IntParaAlfa @',
      '  x = \"IntParaAlfa\";',
      '  IntParaAlfa(1, x);',
      '  y = CFalso;',
      'Fim;'
    ].join('\n');
    const scope = await buildSymbolQueryScopeForSingleFile({
      filePath,
      text,
      system: 'HCM'
    });

    const commentPrepare = prepareRename({
      scope,
      filePath,
      position: positionForOccurrence(text, 'IntParaAlfa', 1)
    });
    expect(commentPrepare).toBeNull();

    const stringPrepare = prepareRename({
      scope,
      filePath,
      position: positionForOccurrence(text, 'IntParaAlfa', 2)
    });
    expect(stringPrepare).toBeNull();

    const officialPrepare = prepareRename({
      scope,
      filePath,
      position: positionForOccurrence(text, 'IntParaAlfa', 3)
    });
    expect(officialPrepare).toBeNull();

    const internalPrepare = prepareRename({
      scope,
      filePath,
      position: positionForOccurrence(text, 'CFalso')
    });
    expect(internalPrepare).toBeNull();
  });

  it('renameSymbol validates newName and collisions', async () => {
    const filePath = '/virtual/symbol-core-rename-rules.lsp';
    const text = [
      'Funcao F(Numero pX);',
      'Inicio',
      '  Definir Numero nA;',
      '  Definir Numero nB;',
      '  nA = pX + nB;',
      'Fim;'
    ].join('\n');
    const scope = await buildSymbolQueryScopeForSingleFile({
      filePath,
      text,
      system: 'HCM'
    });

    const invalid = renameSymbol({
      scope,
      filePath,
      position: positionForOccurrence(text, 'nA', 2),
      newName: '1abc'
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.reason).toBe('invalidName');

    const collision = renameSymbol({
      scope,
      filePath,
      position: positionForOccurrence(text, 'nA', 2),
      newName: 'nB'
    });
    expect(collision.ok).toBe(false);
    if (!collision.ok) expect(collision.reason).toBe('collision');

    const ok = renameSymbol({
      scope,
      filePath,
      position: positionForOccurrence(text, 'nA', 2),
      newName: 'nTotal'
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      const edits = ok.edits.get(filePath) ?? [];
      expect(edits.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('allows rename for implicit variable definitions created by assignment', async () => {
    const filePath = '/virtual/symbol-core-rename-implicit.lsp';
    const text = [
      'Inicio',
      '  nImp = 1;',
      '  nImp = nImp + 1;',
      'Fim;'
    ].join('\n');
    const scope = await buildSymbolQueryScopeForSingleFile({
      filePath,
      text,
      system: 'HCM'
    });

    const prepare = prepareRename({
      scope,
      filePath,
      position: positionForOccurrence(text, 'nImp', 1)
    });
    expect(prepare?.kind).toBe('variable');
    expect(prepare?.placeholder).toBe('nImp');

    const renamed = renameSymbol({
      scope,
      filePath,
      position: positionForOccurrence(text, 'nImp', 1),
      newName: 'nTotal'
    });
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;

    const edits = renamed.edits.get(filePath) ?? [];
    expect(edits.length).toBe(3);
    expect(edits.every((edit) => edit.newText === 'nTotal')).toBe(true);
  });
});
