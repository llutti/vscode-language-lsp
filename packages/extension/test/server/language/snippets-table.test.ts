import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  getCompletionSnippets,
  loadExtensionSnippets,
  resetSnippetCacheForTests,
  resolveSnippetsJsonPath
} from '../../../src/snippets/catalog';

describe('snippets table', () => {
  it('includes Definir Tabela snippet in extension contribution', () => {
    const snippetsPath = path.resolve(__dirname, '../../../snippets.json');
    const raw = fs.readFileSync(snippetsPath, 'utf8');
    const snippets = JSON.parse(raw) as Record<string, { prefix?: string; body?: string[] }>;
    const snippet = snippets['Definir Tabela'];

    expect(snippet).toBeTruthy();
    expect(snippet?.prefix).toBe('dt');
    expect(snippet?.body?.[0]).toContain('Definir Tabela');
  });

  it('derives server completion snippets from snippets.json', () => {
    resetSnippetCacheForTests();
    const snippets = loadExtensionSnippets();
    const tableSnippet = snippets.find((snippet) => snippet.label === 'Definir Tabela');

    expect(tableSnippet).toBeTruthy();
    expect(tableSnippet?.prefix).toBe('dt');
    expect(tableSnippet?.detail).toBe('Definir uma variável do tipo \'Tabela\' com schema inicial');
    expect(tableSnippet?.body.join('\n')).toContain('Definir Tabela ${1:tb_Nome}[${2:10}] = {');
  });

  it('keeps Definir Tabela snippet available in server completion snippets', () => {
    resetSnippetCacheForTests();
    const snippets = getCompletionSnippets();
    const tableSnippet = snippets.find((snippet) => snippet.label === 'Definir Tabela');

    expect(tableSnippet).toBeTruthy();
    expect(tableSnippet?.detail).toBe('Definir uma variável do tipo \'Tabela\' com schema inicial');
    expect(tableSnippet?.snippet).toContain('Definir Tabela ${1:tb_Nome}[${2:10}] = {');
  });

  it('keeps SQL pragma snippets available in server completion snippets', () => {
    resetSnippetCacheForTests();
    const snippets = getCompletionSnippets();
    const consultaSnippet = snippets.find((snippet) => snippet.label === 'LSP SQL Consulta');
    const fragmentoSnippet = snippets.find((snippet) => snippet.label === 'LSP SQL Fragmento');

    expect(consultaSnippet?.snippet).toContain('@lsp-sql-consulta@');
    expect(fragmentoSnippet?.snippet).toContain('@lsp-sql-fragmento@');
  });

  it('resolves snippets.json for both source and bundled dist layouts', () => {
    const sourceDir = path.resolve(__dirname, '../../../src/snippets');
    const distDir = path.resolve(__dirname, '../../../dist');

    expect(resolveSnippetsJsonPath(sourceDir)).toBe(path.resolve(__dirname, '../../../snippets.json'));
    expect(resolveSnippetsJsonPath(distDir)).toBe(path.resolve(__dirname, '../../../snippets.json'));
  });
});
