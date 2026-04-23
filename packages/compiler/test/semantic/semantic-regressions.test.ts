import { describe, it, expect } from 'vitest';
import { createSourceFile } from '../../src/source/source-file';
import { parseFiles } from '../../src/parser/parser';
import { analyzeProgram, analyzeProgramWithSemantics } from '../../src/semantic/analyzer';
import { getInternalSignatures, loadInternalRegistry } from '../../src/internals/registry';
import type { Range } from '../../src/source/types';
import type { SemanticOccurrence } from '../../src/semantic/semantic-tokens';

function findRange(text: string, needle: string, occurrenceIndex = 0): Range {
  let startAt = 0;
  let idx = -1;
  for (let i = 0; i <= occurrenceIndex; i += 1) {
    idx = text.indexOf(needle, startAt);
    if (idx < 0) {
      throw new Error(`Substring not found: ${needle}`);
    }
    startAt = idx + needle.length;
  }
  const before = text.slice(0, idx);
  const lines = before.split(/\r?\n/);
  const line = lines.length - 1;
  const character = lines[lines.length - 1]?.length ?? 0;
  return {
    start: { line, character },
    end: { line, character: character + needle.length }
  };
}

function getOccurrencesFor(sourcePath: string, occurrencesByFile: Map<string, SemanticOccurrence[]>): SemanticOccurrence[] {
  return occurrencesByFile.get(sourcePath) ?? [];
}

describe('semantic regressions', () => {
  it('does not raise LSP1005 for internal constant WEB_HTML assignment and marks it as defaultLibrary variable', async () => {
    const text =
      'WEB_HTML = "<html>ok</html>";\n' +
      'n = 1;\n';

    const source = createSourceFile('/tmp/web-html.lsp', text);
    const { program } = parseFiles([source]);

    const basic = await analyzeProgram({ contextId: 'test', system: 'HCM', program });
    expect(basic.diagnostics.some((d) => d.id === 'LSP1005')).toBe(false);

    const sem = await analyzeProgramWithSemantics({ contextId: 'test', system: 'HCM', program });
    const occurrences = getOccurrencesFor(source.path, sem.occurrencesByFile);

    const webHtmlRange = findRange(text, 'WEB_HTML', 0);
    const hasWebHtml = occurrences.some((o) =>
      o.tokenType === 'variable'
      && o.tokenModifiers.includes('defaultLibrary')
      && o.range.start.line === webHtmlRange.start.line
      && o.range.start.character === webHtmlRange.start.character
      && o.range.end.line === webHtmlRange.end.line
      && o.range.end.character === webHtmlRange.end.character
    );
    expect(hasWebHtml).toBe(true);
  });

  it('does not apply LSP1406 to repeated parameter names across different custom functions', async () => {
    const text =
      'Definir Funcao f1(Numero pValor);\n' +
      'Funcao f1(Numero pValor);\n' +
      'Inicio\n' +
      '  pValor = 1;\n' +
      'Fim;\n' +
      'Definir Funcao f2(Numero pValor);\n' +
      'Funcao f2(Numero pValor);\n' +
      'Inicio\n' +
      '  pValor = 2;\n' +
      'Fim;\n';

    const source = createSourceFile('/tmp/params-repeat.lsp', text);
    const { program } = parseFiles([source]);
    const result = await analyzeProgram({ contextId: 'test', system: 'HCM', program });

    expect(result.diagnostics.some((d) => d.id === 'LSP1406')).toBe(false);
  });

  it('anchors LSP1406 range to the variable name declaration (nameRange) when shadowing ancestor with different type', async () => {
    const text =
      'Definir Alfa a;\n' +
      'Inicio\n' +
      '  Definir Numero a;\n' +
      'Fim;\n';

    const source = createSourceFile('/tmp/shadow-range.lsp', text);
    const { program } = parseFiles([source]);
    const result = await analyzeProgram({ contextId: 'test', system: 'HCM', program });

    const diag = result.diagnostics.find((d) => d.id === 'LSP1406');
    expect(diag).toBeTruthy();

    // The inner declaration 'a' should be the diagnostic range (not the whole statement).
    // NOTE: findRange searches substrings, so searching for just "a" is ambiguous (matches "Alfa").
    // Anchor to the inner declaration line and then point specifically at the variable name.
    const lineWithInnerDecl = findRange(text, 'Definir Numero a', 0);
    const expected = {
      start: { line: lineWithInnerDecl.start.line, character: lineWithInnerDecl.start.character + 'Definir Numero '.length },
      end: { line: lineWithInnerDecl.start.line, character: lineWithInnerDecl.start.character + 'Definir Numero '.length + 1 }
    };
    expect(diag!.range.start.line).toBe(expected.start.line);
    expect(diag!.range.start.character).toBe(expected.start.character);
    expect(diag!.range.end.line).toBe(expected.end.line);
    expect(diag!.range.end.character).toBe(expected.end.character);
  });

  it('uses current declaration sourcePath for LSP1406 when ancestor is in another file', async () => {
    const parentText = 'Definir Alfa a;\n';
    const childText = 'Inicio\n  Definir Numero a;\nFim;\n';
    const sourceA = createSourceFile('/tmp/a-parent.lsp', parentText);
    const sourceB = createSourceFile('/tmp/b-child.lsp', childText);
    const { program } = parseFiles([sourceA, sourceB]);
    const result = await analyzeProgram({ contextId: 'test', system: 'HCM', program });
    const diag = result.diagnostics.find((d) => d.id === 'LSP1406');
    expect(diag).toBeTruthy();
    expect(diag!.sourcePath).toBe('/tmp/b-child.lsp');
  });

  it('counts string literal assignments as writes for unused global rule', async () => {
    const text = [
      'Definir Alfa aMsg;',
      'aMsg = "A";',
      'aMsg = "B";'
    ].join('\n');
    const source = createSourceFile('/tmp/assigned-string-global.lsp', text);
    const { program } = parseFiles([source]);
    const result = await analyzeProgram({ contextId: 'test', system: 'HCM', program });
    expect(result.diagnostics.some((d) => d.id === 'LSP1203')).toBe(false);
  });

  it('treats declarations outside function implementation as global for LSP1003', async () => {
    const text = [
      'Inicio',
      '  Definir Alfa aQueryBuscarConfEmailNotificacao;',
      'Fim;',
      'aQueryBuscarConfEmailNotificacao = "select 1";'
    ].join('\n');
    const source = createSourceFile('/tmp/global-outside-function-block.lsp', text);
    const { program } = parseFiles([source]);
    const result = await analyzeProgram({ contextId: 'test', system: 'HCM', program });

    expect(result.diagnostics.some((d) => d.id === 'LSP1003')).toBe(false);
    expect(result.diagnostics.some((d) => d.id === 'LSP1004')).toBe(false);
    expect(result.diagnostics.some((d) => d.id === 'LSP1005')).toBe(false);
  });

  it('does not mutate internal signature order in registry when validating calls', async () => {
    const registry = await loadInternalRegistry('HCM');
    const candidate = Array.from(registry.functions.entries())
      .map(([name, list]) => ({ name, list }))
      .find((entry) => {
        const systems = new Set(entry.list.map((sig) => sig.system));
        return systems.has('SENIOR') && systems.has('HCM');
      });
    if (!candidate) {
      return;
    }
    const before = getInternalSignatures(registry, candidate.name).map((sig) => `${sig.system}:${sig.paramTypes.length}`);
    const source = createSourceFile('/tmp/internal-order-mutation.lsp', `${candidate.name}();\n`);
    const { program } = parseFiles([source]);
    await analyzeProgram({ contextId: 'test', system: 'HCM', program });
    const after = getInternalSignatures(registry, candidate.name).map((sig) => `${sig.system}:${sig.paramTypes.length}`);
    expect(after).toEqual(before);
  });

  it('allows ConverteMascara Tipo_Dado=3 Valor_Origem to be Data or Numero (no LSP1404/LSP1405)', async () => {
    const text =
      'Definir Numero n;\n' +
      'Definir Alfa aOut;\n' +
      'Definir Alfa aMask;\n' +
      'n = 123;\n' +
      // Tipo_Dado=3 now accepts Numero as well.
      'ConverteMascara(3, n, aOut, aMask);\n';

    const source = createSourceFile('/tmp/converte-mascara-3-numero.lsp', text);
    const { program } = parseFiles([source]);
    const result = await analyzeProgram({ contextId: 'test', system: 'HCM', program });

    // Must not suggest conversion just because it's Numero.
    expect(result.diagnostics.some((d) => d.id === 'LSP1404')).toBe(false);
    expect(result.diagnostics.some((d) => d.id === 'LSP1405')).toBe(false);
    // Also must not reject Numero for Tipo_Dado=3.
    expect(result.diagnostics.some((d) => d.id === 'LSP1403')).toBe(false);
  });

  it('allows duplicate global declaration across different files without LSP1420', async () => {
    const sourceA = createSourceFile('/tmp/a-first.lsp', 'Definir Alfa x;\n');
    const sourceB = createSourceFile('/tmp/b-second.lsp', 'Definir Numero x;\nx = 10;\n');
    const { program } = parseFiles([sourceA, sourceB]);
    const result = await analyzeProgram({ contextId: 'test', system: 'HCM', program });

    expect(result.diagnostics.some((d) => d.id === 'LSP1420')).toBe(false);
    expect(result.diagnostics.some((d) => d.id === 'LSP1421')).toBe(false);
    // First declaration is Alfa, so numeric assignment must fail.
    expect(result.diagnostics.some((d) => d.id === 'LSP1006')).toBe(true);
  });

  it('emits LSP1420 on redeclaration in the same global file', async () => {
    const source = createSourceFile('/tmp/same-file-redecl.lsp', 'Definir Numero n;\nDefinir Numero n;\n');
    const { program } = parseFiles([source]);
    const result = await analyzeProgram({ contextId: 'test', system: 'HCM', program });
    expect(result.diagnostics.some((d) => d.id === 'LSP1420' && d.severity === 'Warning')).toBe(true);
    expect(result.diagnostics.some((d) => d.id === 'LSP1421')).toBe(false);
  });

  it('emits LSP1421 as warning on local redeclaration in the same scope', async () => {
    const source = createSourceFile(
      '/tmp/local-scope-redecl.lsp',
      'Definir Funcao f();\nFuncao f();\nInicio\nDefinir Numero n;\nDefinir Numero n;\nFim;\n'
    );
    const { program } = parseFiles([source]);
    const result = await analyzeProgram({ contextId: 'test', system: 'HCM', program });
    expect(result.diagnostics.some((d) => d.id === 'LSP1421' && d.severity === 'Warning')).toBe(true);
  });

  it('does not emit LSP1005 together with LSP1002 for the same assignment target', async () => {
    const text = [
      'Inicio',
      '  Definir Alfa aCpoAux;',
      'Fim;',
      'Definir Alfa aVal;',
      'aCpoAux = aVal;'
    ].join('\n');
    const source = createSourceFile('/tmp/lsp1002-no-1005-duplicate.lsp', text);
    const { program } = parseFiles([source]);
    const result = await analyzeProgram({ contextId: 'test', system: 'HCM', program });

    const targetLine = 4;
    const targetStart = 0;
    const targetEnd = 'aCpoAux'.length;
    const sameTarget = (d: { range: Range }) =>
      d.range.start.line === targetLine
      && d.range.start.character === targetStart
      && d.range.end.line === targetLine
      && d.range.end.character === targetEnd;

    const has1002 = result.diagnostics.some((d) => d.id === 'LSP1002' && sameTarget(d));
    const has1005 = result.diagnostics.some((d) => d.id === 'LSP1005' && sameTarget(d));
    expect(has1002).toBe(true);
    expect(has1005).toBe(false);
  });

  it('does not emit LSP1002 for a visible Alfa variable inside the same block scope', async () => {
    const text = [
      'Se (cVerdadeiro = cVerdadeiro)',
      'Inicio',
      '  Definir Alfa aParticipantes;',
      '  aParticipantes = "";',
      '  Enquanto (cVerdadeiro = cFalso)',
      '  Inicio',
      '    aParticipantes = aParticipantes + ",x";',
      '    DeletarAlfa(aParticipantes, 1, 1);',
      '  Fim;',
      'Fim;'
    ].join('\n');
    const source = createSourceFile('/tmp/lsp1002-visible-block-var.lsp', text);
    const { program } = parseFiles([source]);
    const result = await analyzeProgram({ contextId: 'test', system: 'HCM', program });

    const hasFalsePositive1002 = result.diagnostics.some((d) =>
      d.id === 'LSP1002'
      && d.message.includes('aParticipantes')
    );
    expect(hasFalsePositive1002).toBe(false);
  });

  it('emits LSP1203 for unused variable declared inside global If block', async () => {
    const text = [
      'Se (nTeste = 0)',
      'Inicio',
      '  Definir Alfa aNaoEncontrado;',
      'Fim;'
    ].join('\n');
    const source = createSourceFile('/tmp/global-if-unused-block-var.lsp', text);
    const { program } = parseFiles([source]);
    const result = await analyzeProgram({ contextId: 'test', system: 'HCM', program });

    expect(result.diagnostics.some((d) =>
      d.id === 'LSP1203'
      && d.message.includes('aNaoEncontrado')
    )).toBe(true);
  });
});
