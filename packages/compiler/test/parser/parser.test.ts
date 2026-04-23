import { describe, it, expect } from 'vitest';
import { createSourceFile } from '../../src/source/source-file';
import { parseFiles } from '../../src/parser/parser';

function parse(text: string) {
  const source = createSourceFile('/tmp/test.lsp', text);
  const { program } = parseFiles([source]);
  return program.files[0];
}

describe('parser', () => {
  it("parses Definir Funcao multiline until ';'", () => {
    const file = parse(
      'Definir Funcao fTeste(Numero a,\n  Numero End b, Numero c);\n'
    );

    const decl = file.statements.find((s) => s.kind === 'FuncDecl');
    expect(decl).toBeTruthy();
    if (decl && decl.kind === 'FuncDecl') {
      expect(decl.name).toBe('fTeste');
      expect(decl.params.length).toBe(3);
      expect(decl.params[1].isEnd).toBe(true);
    }
  });

  it('accepts complex type names in Definir and keeps variable name', () => {
    const file = parse('Definir pacote.modulo.Classe wsCliente;\n');
    const decl = file.statements.find((s) => s.kind === 'VarDecl');
    expect(decl).toBeTruthy();
    if (decl && decl.kind === 'VarDecl') {
      expect(decl.name).toBe('wsCliente');
    }
  });

  it('reports lexical error for unterminated string', () => {
    const source = createSourceFile('/tmp/test.lsp', 'Definir Alfa a; a = "teste;\n');
    const { parseErrors } = parseFiles([source]);
    const hasLex = parseErrors.some((e) => e.message.toLowerCase().includes('erro léxico'));
    expect(hasLex).toBe(true);
  });

  it('parses negative number literal', () => {
    const file = parse('Definir Numero n; n = -10;\n');
    const stmt = file.statements.find((s) => s.kind === 'ExprStmt');
    expect(stmt).toBeTruthy();
  });

  it('parses index access', () => {
    const file = parse('Se (HorSit[620] <> 0)\nInicio\nFim;\n');
    const stmt = file.statements.find((s) => s.kind === 'If');
    expect(stmt).toBeTruthy();
  });

  it('parses unary minus in expression', () => {
    const file = parse('Se (-1 < 0)\nInicio\nFim;\n');
    const stmt = file.statements.find((s) => s.kind === 'If');
    expect(stmt).toBeTruthy();
  });

  it('includes sourcePath and range in nodes', () => {
    const source = createSourceFile('/tmp/test.lsp', 'Definir Numero n;');
    const { program } = parseFiles([source]);
    const file = program.files[0];
    const decl = file.statements.find((s) => s.kind === 'VarDecl');
    expect(decl).toBeTruthy();
    if (decl && decl.kind === 'VarDecl') {
      expect(decl.sourcePath).toBe('/tmp/test.lsp');
      expect(decl.range.start.line).toBe(0);
      expect(decl.range.end.line).toBe(0);
    }
  });

  it('accepts list property named as type keyword in assignment', () => {
    const source = createSourceFile('/tmp/test.lsp', 'Definir Lista lst_Datas;\nlst_Datas.Data = dDatSol;');
    const { program, parseErrors } = parseFiles([source]);
    expect(parseErrors).toHaveLength(0);
    const file = program.files[0];
    const exprStmt = file.statements.find((s) => s.kind === 'ExprStmt');
    expect(exprStmt).toBeTruthy();
  });

  it('accepts type keyword token as call argument expression', () => {
    const source = createSourceFile('/tmp/test.lsp', 'Definir Lista lst_Datas;\nlst_Datas.AdicionarCampo("Data", Data);');
    const { parseErrors } = parseFiles([source]);
    expect(parseErrors).toHaveLength(0);
  });

  it('accepts Pare and Continue as standalone statements', () => {
    const source = createSourceFile('/tmp/test.lsp', 'Pare;\nContinue;\n');
    const { parseErrors } = parseFiles([source]);
    expect(parseErrors).toHaveLength(0);
  });


  it('parses apostrophe literal expression', () => {
    const file = parse("Definir Numero n; n = 'A';\n");
    const stmt = file.statements.find((s) => s.kind === 'ExprStmt');
    expect(stmt).toBeTruthy();
    if (stmt && stmt.kind === 'ExprStmt' && stmt.expr.kind === 'Binary') {
      expect(stmt.expr.right.kind).toBe('ApostropheLiteral');
    }
  });

  it('parses ExecSql as statement requiring semicolon', () => {
    const file = parse('ExecSql "select 1";\n');
    expect(file.statements[0].kind).toBe('ExecSql');
  });

  it('parses structured table declaration with schema metadata', () => {
    const file = parse(
      'Definir Tabela ve_CodHor[100] = {\n'
      + '  Alfa Nome[30];\n'
      + '  Numero Codigo;\n'
      + '};\n'
    );
    const decl = file.statements.find((s) => s.kind === 'VarDecl');
    expect(decl).toBeTruthy();
    if (decl && decl.kind === 'VarDecl') {
      expect(decl.typeName).toBe('Tabela');
      expect(decl.tableDecl?.occurrencesLiteral).toBe('100');
      expect(decl.tableDecl?.columns.length).toBe(2);
      expect(decl.tableDecl?.columns[0]?.name).toBe('Nome');
      expect(decl.tableDecl?.columns[0]?.sizeLiteral).toBe('30');
    }
  });


  it('parses legacy table declaration with Inicio/Fim schema metadata', () => {
    const file = parse(
      'Definir Tabela ve_CodHor[100] = Inicio\n'
      + '  Alfa Nome[30];\n'
      + '  Numero Codigo;\n'
      + 'Fim;\n'
    );
    const decl = file.statements.find((s) => s.kind === 'VarDecl');
    expect(decl).toBeTruthy();
    if (decl && decl.kind === 'VarDecl') {
      expect(decl.typeName).toBe('Tabela');
      expect(decl.tableDecl?.occurrencesLiteral).toBe('100');
      expect(decl.tableDecl?.columns.length).toBe(2);
      expect(decl.tableDecl?.bodyDelimiter).toBe('InicioFim');
    }
  });

  it('emits parser diagnostics for legacy table declaration without Fim', () => {
    const source = createSourceFile('/tmp/test.lsp', 'Definir Tabela SemFim[10] = Inicio\n  Alfa Nome[30];\n');
    const { parseErrors } = parseFiles([source]);
    expect(parseErrors.some((error) => error.message.includes("Esperado 'Fim'"))).toBe(true);
    expect(parseErrors.some((error) => error.message.includes("Esperado ';' ao final de declaração de Tabela"))).toBe(true);
  });

  it('emits parser diagnostics for malformed table declaration', () => {
    const source = createSourceFile('/tmp/test.lsp', 'Definir Tabela SemFim[10] = {\n  Alfa Nome[30];\n');
    const { parseErrors } = parseFiles([source]);
    expect(parseErrors.some((error) => error.message.includes("Esperado '}'"))).toBe(true);
    expect(parseErrors.some((error) => error.message.includes("Esperado ';' ao final de declaração de Tabela"))).toBe(true);
  });

  it('emits parser diagnostics for table without occurrences', () => {
    const source = createSourceFile('/tmp/test.lsp', 'Definir Tabela SemOc = {\n  Alfa Nome;\n};\n');
    const { parseErrors } = parseFiles([source]);
    expect(parseErrors.some((error) => error.message.includes("Esperado '[<ocorrencias>]"))).toBe(true);
  });

  it("emits parser diagnostics for table without '='", () => {
    const source = createSourceFile('/tmp/test.lsp', 'Definir Tabela SemIgual[10] {\n  Alfa Nome;\n};\n');
    const { parseErrors } = parseFiles([source]);
    expect(parseErrors.some((error) => error.message.includes("Esperado '=' na declaração de Tabela"))).toBe(true);
  });

  it("emits parser diagnostics for table without final ';'", () => {
    const source = createSourceFile('/tmp/test.lsp', 'Definir Tabela SemPonto[10] = {\n  Alfa Nome;\n}\n');
    const { parseErrors } = parseFiles([source]);
    expect(parseErrors.some((error) => error.message.includes("Esperado ';' ao final de declaração de Tabela"))).toBe(true);
  });

});
