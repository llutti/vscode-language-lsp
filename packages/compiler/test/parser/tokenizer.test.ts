import { describe, it, expect } from 'vitest';
import { createSourceFile } from '../../src/source/source-file';
import { tokenize } from '../../src/lexer/tokenizer';

function values(tokens: ReturnType<typeof tokenize>['tokens'], type: string): string[] {
  return tokens.filter((t) => t.type === type).map((t) => t.value);
}

describe('tokenizer', () => {
  it('tokenizes comments and strings', () => {
    const source = createSourceFile('/tmp/test.lsp', '@comment\n/* bloco */\n"texto"');
    const { tokens } = tokenize(source);

    expect(values(tokens, 'CommentLine').length).toBe(1);
    expect(values(tokens, 'CommentBlock').length).toBe(1);
    expect(values(tokens, 'String')[0]).toBe('"texto"');
  });

  it('recognizes types and keywords case-insensitively', () => {
    const source = createSourceFile(
      '/tmp/test.lsp',
      'Definir Numero nValor; se (nValor = 1) Inicio Fim;'
    );
    const { tokens } = tokenize(source);

    const types = values(tokens, 'Type');
    const keywords = values(tokens, 'Keyword');

    expect(types.map((t) => t.toLowerCase())).toContain('numero');
    expect(keywords.map((t) => t.toLowerCase())).toContain('definir');
    expect(keywords.map((t) => t.toLowerCase())).toContain('se');
    expect(keywords.map((t) => t.toLowerCase())).toContain('inicio');
    expect(keywords.map((t) => t.toLowerCase())).toContain('fim');
  });

  it('reports lexical errors for unterminated line comments', () => {
    const source = createSourceFile('/tmp/test.lsp', '@comentario sem fim\n');
    const { lexicalErrors } = tokenize(source);
    expect(lexicalErrors.length).toBe(1);
    expect(lexicalErrors[0].type).toBe('CommentLine');
  });

  it('reports lexical errors for unterminated block comments', () => {
    const source = createSourceFile('/tmp/test.lsp', '/* bloco aberto\n');
    const { lexicalErrors } = tokenize(source);
    expect(lexicalErrors.length).toBe(1);
    expect(lexicalErrors[0].type).toBe('CommentBlock');
  });

  it('supports escaped quotes in strings', () => {
    const source = createSourceFile('/tmp/test.lsp', '"a\\"b"');
    const { tokens, lexicalErrors } = tokenize(source);
    expect(lexicalErrors.length).toBe(0);
    expect(values(tokens, 'String')[0]).toBe('"a\\"b"');
  });


  it('recognizes apostrophe literal with exactly one character', () => {
    const source = createSourceFile('/tmp/test.lsp', "'A'");
    const { tokens, lexicalErrors } = tokenize(source);
    expect(lexicalErrors).toHaveLength(0);
    expect(values(tokens, 'Apostrophe')[0]).toBe("'A'");
  });

  it('reports lexical error for invalid apostrophe literal length', () => {
    const source = createSourceFile('/tmp/test.lsp', "'AB'");
    const { lexicalErrors } = tokenize(source);
    expect(lexicalErrors.length).toBe(1);
    expect(lexicalErrors[0].type).toBe('Apostrophe');
  });

  it('recognizes operators and delimiters', () => {
    const text = '( ) [ ] { } , . ; : = <> > < >= <= + - * / ++ -- e ou';
    const source = createSourceFile('/tmp/test.lsp', text);
    const { tokens } = tokenize(source);

    const operators = values(tokens, 'Operator').map((t) => t.toLowerCase());
    const delimiters = values(tokens, 'Delimiter');

    expect(operators).toEqual(
      expect.arrayContaining(['=', '<>', '>', '<', '>=', '<=', '+', '-', '*', '/', '++', '--', 'e', 'ou'])
    );
    expect(delimiters).toEqual(expect.arrayContaining(['(', ')', '[', ']', '{', '}', ',', '.', ';', ':']));
  });
});
