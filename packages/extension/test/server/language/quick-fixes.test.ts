import { describe, it, expect } from 'vitest';
import { buildQuickFixPlans, type Range } from '../../../src/server/language/quick-fixes';

function indexToPosition(text: string, index: number): { line: number; character: number } {
  const lines = text.split(/\r?\n/);
  let offset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineEnd = offset + line.length;
    if (index <= lineEnd) {
      return { line: i, character: index - offset };
    }
    offset = lineEnd + 1;
  }
  return { line: lines.length - 1, character: lines[lines.length - 1].length };
}

function rangeFor(text: string, needle: string, occurrence = 1): Range {
  let idx = -1;
  let start = 0;
  for (let i = 0; i < occurrence; i += 1) {
    idx = text.indexOf(needle, start);
    if (idx === -1) break;
    start = idx + needle.length;
  }
  if (idx === -1) throw new Error(`needle not found: ${needle}`);
  const startPos = indexToPosition(text, idx);
  const endPos = indexToPosition(text, idx + needle.length);
  return { start: startPos, end: endPos };
}

function planFor(code: string, text: string, name: string, occurrence = 1, settings?: { indentSize?: number; useTabs?: boolean }) {
  const range = rangeFor(text, name, occurrence);
  const plans = buildQuickFixPlans({ docText: text, diagCode: code, range, name, settings });
  expect(plans.length).toBe(1);
  return plans[0];
}

function plansFor(code: string, text: string, name: string, occurrence = 1, settings?: { indentSize?: number; useTabs?: boolean }) {
  const range = rangeFor(text, name, occurrence);
  return buildQuickFixPlans({ docText: text, diagCode: code, range, name, settings });
}

describe('quick fixes', () => {
  it('builds LSP1404 plan with Definir Data', () => {
    const text = [
      'Funcao f(Numero p);',
      'Inicio',
      '  x = p;',
      'Fim;'
    ].join('\n');
    const plan = planFor('LSP1404', text, 'p');
    expect(plan.edits.some((e) => e.type === 'insert' && e.text.includes('Definir Data {{NAME}};'))).toBe(true);
    expect(plan.rename?.requiresConfirmation).toBe(true);
    expect(plan.rename?.suggestedName).toBe('dP');
  });

  it('does not build quick fixes for removed LSP1405/LSP1407 diagnostics', () => {
    const text = [
      'Funcao f(Numero pData);',
      'Inicio',
      '  x = pData;',
      'Fim;'
    ].join('\n');
    expect(plansFor('LSP1405', text, 'pData')).toHaveLength(0);
    expect(plansFor('LSP1407', text, 'pData')).toHaveLength(0);
  });

  it('builds LSP1204 plan with local END variable and assignment', () => {
    const text = [
      'Funcao f(Numero End pRet);',
      'Inicio',
      '  Outra(pRet);',
      'Fim;'
    ].join('\n');
    const plan = planFor('LSP1204', text, 'pRet', 1);
    const insertEdits = plan.edits.filter((e) => e.type === 'insert');
    const replace = plan.edits.find((e) => e.type === 'replace');
    expect(insertEdits.some((e) => e.text.includes('Definir Numero {{NAME}};'))).toBe(true);
    expect(insertEdits.some((e) => e.text.includes('pRet = {{NAME}};'))).toBe(true);
    expect(replace && replace.text === '{{NAME}}').toBe(true);
    expect(plan.rename?.requiresConfirmation).toBe(true);
    expect(plan.rename?.suggestedName).toBe('nPRetLocal');
  });

  it('evita colisao simples ao sugerir nome com prefixo', () => {
    const text = [
      'Definir Data dP;',
      'Funcao f(Numero p);',
      'Inicio',
      '  x = p;',
      'Fim;'
    ].join('\n');
    const plan = planFor('LSP1404', text, 'p');
    expect(plan.rename?.suggestedName).toBe('dP2');
  });

  it('insere depois do bloco Definir existente', () => {
    const text = [
      'Funcao f(Numero p);',
      'Inicio',
      '  Definir Data dA;',
      '  Definir Alfa aB;',
      '  x = p;',
      'Fim;'
    ].join('\n');
    const plan = planFor('LSP1404', text, 'p');
    const insert = plan.edits.find((e) => e.type === 'insert');
    expect(insert && insert.line).toBe(4);
  });

  it('insere apos cabecalho/comentarios iniciais quando nao ha Definir', () => {
    const text = [
      'Funcao f(Numero p);',
      'Inicio',
      '  // comentario',
      '  # diretiva',
      '',
      '  x = p;',
      'Fim;'
    ].join('\n');
    const plan = planFor('LSP1404', text, 'p');
    const insert = plan.edits.find((e) => e.type === 'insert');
    expect(insert && insert.line).toBe(5);
  });

  it('deriva indentacao de bloco com indentStep dos settings (spaces)', () => {
    const text = [
      'Funcao f(Numero p);',
      'Inicio',
      'x = p;',
      'Fim;'
    ].join('\n');
    const plan = planFor('LSP1404', text, 'p', 1, { indentSize: 4, useTabs: false });
    const insert = plan.edits.find((e) => e.type === 'insert');
    expect(insert && insert.text.startsWith('    Definir Data {{NAME}};')).toBe(true);
  });

  it('deriva indentacao de bloco com indentStep dos settings (tabs)', () => {
    const text = [
      'Funcao f(Numero p);',
      'Inicio',
      'x = p;',
      'Fim;'
    ].join('\n');
    const plan = planFor('LSP1404', text, 'p', 1, { useTabs: true });
    const insert = plan.edits.find((e) => e.type === 'insert');
    expect(insert && insert.text.startsWith('\tDefinir Data {{NAME}};')).toBe(true);
  });

  it('preserva EOL LF nos inserts', () => {
    const text = [
      'Funcao f(Numero p);',
      'Inicio',
      '  x = p;',
      'Fim;'
    ].join('\n');
    const plan = planFor('LSP1404', text, 'p');
    const insert = plan.edits.find((e) => e.type === 'insert');
    expect(insert && insert.text.includes('\n')).toBe(true);
    expect(insert && insert.text.includes('\r\n')).toBe(false);
  });

  it('preserva EOL CRLF nos inserts', () => {
    const text = [
      'Funcao f(Numero p);',
      'Inicio',
      '  x = p;',
      'Fim;'
    ].join('\r\n');
    const plan = planFor('LSP1404', text, 'p');
    const insert = plan.edits.find((e) => e.type === 'insert');
    expect(insert && insert.text.includes('\r\n')).toBe(true);
    expect(insert && insert.text.includes('\n')).toBe(true);
    expect(insert && insert.text.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });

  it("builds LSP0001 plan to insert ';' when missing semicolon diagnostic", () => {
    const text = 'nNumCad = 10\nDefinir Numero x;\n';
    const idx = text.indexOf('\n');
    const pos = indexToPosition(text, idx);
    const plans = buildQuickFixPlans({
      docText: text,
      diagCode: 'LSP0001',
      diagMessage: "Esperado ';' após atribuição",
      range: { start: pos, end: pos },
      name: ''
    });
    expect(plans.length).toBe(1);
    expect(plans[0].title).toBe("Inserir ';'");
    expect(plans[0].edits).toEqual([{ type: 'replace', range: { start: pos, end: pos }, text: ';' }]);
  });

  it('does not build LSP0001 plan for unrelated syntax diagnostics', () => {
    const text = 'Se (a = 1\n';
    const pos = { line: 0, character: 8 };
    const plans = buildQuickFixPlans({
      docText: text,
      diagCode: 'LSP0001',
      diagMessage: 'Erro sintático (genérico)',
      range: { start: pos, end: pos },
      name: ''
    });
    expect(plans.length).toBe(0);
  });

  it('does not build plan for LSP1406 while unsupported', () => {
    const text = [
      'Funcao f(Numero pData);',
      'Inicio',
      '  x = pData;',
      'Fim;'
    ].join('\n');
    const plans = plansFor('LSP1406', text, 'pData');
    expect(plans).toHaveLength(0);
  });

  it('builds LSP1005 plan inferring Alfa from string assignment', () => {
    const text = [
      'Funcao f();',
      'Inicio',
      '  aNome = "JOAO";',
      'Fim;'
    ].join('\n');
    const plan = planFor('LSP1005', text, 'aNome');
    const insert = plan.edits.find((e) => e.type === 'insert');
    expect(plan.title).toBe('Declarar Alfa aNome');
    expect(insert && insert.text.includes('Definir Alfa aNome;')).toBe(true);
    expect(plan.rename).toBeUndefined();
  });

  it('builds LSP1005 plan inferring Numero from numeric assignment', () => {
    const text = [
      'Funcao f();',
      'Inicio',
      '  nTotal = 10 + 2;',
      'Fim;'
    ].join('\n');
    const plan = planFor('LSP1005', text, 'nTotal');
    const insert = plan.edits.find((e) => e.type === 'insert');
    expect(plan.title).toBe('Declarar Numero nTotal');
    expect(insert && insert.text.includes('Definir Numero nTotal;')).toBe(true);
    expect(plan.rename).toBeUndefined();
  });

  it('builds LSP1005 plan with prefix fallback when context is ambiguous', () => {
    const text = [
      'Funcao f();',
      'Inicio',
      '  dVenc = OutraFuncao(x);',
      'Fim;'
    ].join('\n');
    const plan = planFor('LSP1005', text, 'dVenc');
    const insert = plan.edits.find((e) => e.type === 'insert');
    expect(plan.title).toBe('Declarar Data dVenc');
    expect(insert && insert.text.includes('Definir Data dVenc;')).toBe(true);
    expect(plan.rename).toBeUndefined();
  });
});
