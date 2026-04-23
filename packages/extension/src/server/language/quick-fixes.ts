export type Position = {
  line: number;
  character: number;
};

export type Range = {
  start: Position;
  end: Position;
};

export type QuickFixEdit =
  | { type: 'insert'; line: number; text: string }
  | { type: 'replace'; range: Range; text: string };

export type QuickFixPlan = {
  title: string;
  edits: QuickFixEdit[];
  rename?: {
    suggestedName: string;
    requiresConfirmation: boolean;
  };
};

export type QuickFixSettings = {
  indentSize?: number;
  useTabs?: boolean;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lineIndent(line: string | undefined): string {
  const match = line?.match(/^(\s*)/);
  return match ? match[1] : '';
}

function capitalize(name: string): string {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function buildDeclarationRegex(name: string): RegExp {
  return new RegExp(`^\\s*Definir\\s+\\w+\\s+${escapeRegExp(name)}\\b`, 'i');
}

function detectEol(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function toLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function isCommentOrHeaderLine(line: string | undefined): boolean {
  const trimmed = (line ?? '').trim();
  return (
    trimmed === '' ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('*/') ||
    trimmed.startsWith('#')
  );
}

function isDeclarationLine(line: string | undefined): boolean {
  return /^\s*Definir\b/i.test(line ?? '');
}

function normalizeEol(text: string, eol: string): string {
  return text.replace(/\r?\n/g, eol);
}

function ensureTrailingEol(text: string, eol: string): string {
  const normalized = normalizeEol(text, eol);
  return normalized.endsWith(eol) ? normalized : `${normalized}${eol}`;
}

function findEnclosingFunctionLine(lines: string[], fromLine: number): number {
  for (let i = fromLine; i >= 0; i -= 1) {
    if (/^\s*Funcao\b/i.test(lines[i])) {
      return i;
    }
  }
  return -1;
}

function findFunctionBodyStart(lines: string[], functionLine: number): number {
  for (let j = functionLine + 1; j < lines.length; j += 1) {
    if (/^\s*(Inicio|\{)\b/i.test(lines[j])) {
      return j;
    }
  }
  return -1;
}

function findInsertionLineAfterHeaderAndDeclarations(lines: string[], startLine: number): number {
  let cursor = Math.max(0, Math.min(startLine, lines.length));
  while (cursor < lines.length && isCommentOrHeaderLine(lines[cursor])) {
    cursor += 1;
  }

  let afterDeclarations = cursor;
  while (afterDeclarations < lines.length && isDeclarationLine(lines[afterDeclarations])) {
    afterDeclarations += 1;
  }

  return afterDeclarations;
}

function buildIndentStep(settings?: QuickFixSettings): string {
  if (settings?.useTabs) {
    return '\t';
  }
  const indentSize = Number.isFinite(settings?.indentSize) ? Math.max(0, Number(settings?.indentSize)) : 2;
  return ' '.repeat(indentSize);
}

function findInsertTarget(lines: string[], fromLine: number, settings?: QuickFixSettings): { line: number; indent: string } {
  const indentStep = buildIndentStep(settings);
  const functionLine = findEnclosingFunctionLine(lines, fromLine);
  if (functionLine >= 0) {
    const bodyStart = findFunctionBodyStart(lines, functionLine);
    if (bodyStart >= 0) {
      const declarationStart = findInsertionLineAfterHeaderAndDeclarations(lines, bodyStart + 1);
      const indentFromDeclarations = lineIndent(lines[Math.max(bodyStart + 1, declarationStart - 1)]);
      const indent = indentFromDeclarations || `${lineIndent(lines[bodyStart])}${indentStep}`;
      return { line: declarationStart, indent };
    }
  }

  const line = findInsertionLineAfterHeaderAndDeclarations(lines, 0);
  const indent = lineIndent(lines[Math.max(0, line - 1)]);
  return { line, indent };
}


function findInsertTargetGlobal(lines: string[], _settings?: QuickFixSettings): { line: number; indent: string } {
  const line = findInsertionLineAfterHeaderAndDeclarations(lines, 0);
  const indent = lineIndent(lines[Math.max(0, line - 1)]);
  return { line, indent };
}

function suggestNameForType(typeName: string, originalName: string, lines: string[]): string {
  const prefix =
    typeName.toLowerCase() === 'alfa'
      ? 'a'
      : typeName.toLowerCase() === 'numero'
        ? 'n'
        : typeName.toLowerCase() === 'data'
          ? 'd'
          : typeName.toLowerCase() === 'hora'
            ? 'h'
            : typeName.toLowerCase() === 'cursor'
              ? 'c'
              : '';

  const startsWithPrefix = prefix && originalName.toLowerCase().startsWith(prefix);
  const base = startsWithPrefix || !prefix ? originalName : `${prefix}${capitalize(originalName)}`;
  if (!lines.some((l) => buildDeclarationRegex(base).test(l))) {
    return base;
  }
  for (let i = 2; i <= 9; i += 1) {
    const candidate = `${base}${i}`;
    if (!lines.some((l) => buildDeclarationRegex(candidate).test(l))) {
      return candidate;
    }
  }
  return `${base}${Date.now().toString().slice(-4)}`;
}

function inferTypeFromNamePrefix(name: string): 'Alfa' | 'Numero' | 'Data' | 'Hora' | 'Cursor' | 'Lista' {
  const first = (name.trim().charAt(0) || '').toLowerCase();
  if (first === 'a') return 'Alfa';
  if (first === 'd') return 'Data';
  if (first === 'h') return 'Hora';
  if (first === 'c') return 'Cursor';
  if (first === 'l') return 'Lista';
  return 'Numero';
}

function inferTypeForUndeclaredVariable(lines: string[], range: Range, name: string): 'Alfa' | 'Numero' | 'Data' | 'Hora' | 'Cursor' | 'Lista' {
  const lineText = lines[range.start.line] ?? '';
  const escapedName = escapeRegExp(name);
  const assignPattern = new RegExp(`\\b${escapedName}\\b\\s*=\\s*(.+)$`, 'i');
  const assignMatch = lineText.match(assignPattern);
  const rhs = assignMatch?.[1]?.trim() ?? '';

  if (/^["']/.test(rhs)) return 'Alfa';
  if (/^[-+]?\d+([.,]\d+)?\b/.test(rhs)) return 'Numero';
  if (/^\d+\s*[-+*/]/.test(rhs)) return 'Numero';
  if (/\b(Hoje|DataSistema|DataBase)\b/i.test(rhs)) return 'Data';
  if (/\b(HoraSistema)\b/i.test(rhs)) return 'Hora';
  if (/\bLista\b/i.test(rhs)) return 'Lista';
  if (/\b(Cursor|SQL_Criar|Sql_Criar)\b/i.test(rhs)) return 'Cursor';

  const nameCallPattern = new RegExp(`\\b${escapedName}\\b\\s*\\.\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*(\\(|$)`, 'i');
  const memberMatch = lineText.match(nameCallPattern);
  if (memberMatch) {
    const member = (memberMatch[1] ?? '').toLowerCase();
    if (member === 'sql' || member === 'abrir' || member === 'fechar') return 'Cursor';
    if (member.startsWith('adicionar') || member.startsWith('ordenar') || member.startsWith('limpar')) return 'Lista';
  }

  return inferTypeFromNamePrefix(name);
}

export function buildQuickFixPlans(input: {
  docText: string;
  diagCode: string;
  diagMessage?: string;
  range: Range;
  name: string;
  settings?: QuickFixSettings;
}): QuickFixPlan[] {
  const { docText, diagCode, diagMessage, range, name, settings } = input;
  const eol = detectEol(docText);
  const lines = toLines(docText);

  if (diagCode === 'LSP0001') {
    const normalizedMessage = (diagMessage ?? '').toLowerCase();
    const isMissingSemicolon = normalizedMessage.includes("esperado ';'");
    const isZeroLengthRange =
      range.start.line === range.end.line && range.start.character === range.end.character;
    if (isMissingSemicolon && isZeroLengthRange) {
      return [
        {
          title: "Inserir ';'",
          edits: [{ type: 'replace', range, text: ';' }]
        }
      ];
    }
    return [];
  }

  const alreadyDeclared = new RegExp(`^\\s*Definir\\s+\\w+\\s+${escapeRegExp(name)}\\b`, 'i');
  if (lines.some((l) => alreadyDeclared.test(l))) {
    return [];
  }

  const insertTarget = findInsertTarget(lines, range.start.line, settings);
  const insertLine = insertTarget.line;
  const indent = insertTarget.indent;

  
  if (diagCode === 'LSP1003') {
    // String literal assignment requires an explicit Alfa declaration for the target variable.
    const localTarget = findInsertTarget(lines, range.start.line, settings);
    const globalTarget = findInsertTargetGlobal(lines, settings);

    const localEdits: QuickFixEdit[] = [
      { type: 'insert', line: localTarget.line, text: ensureTrailingEol(`${localTarget.indent}Definir Alfa ${name};`, eol) }
    ];
    const globalEdits: QuickFixEdit[] = [
      { type: 'insert', line: globalTarget.line, text: ensureTrailingEol(`${globalTarget.indent}Definir Alfa ${name};`, eol) }
    ];

    return [
      { title: `Declarar Alfa ${name} (local)`, edits: localEdits },
      { title: `Declarar Alfa ${name} (global)`, edits: globalEdits }
    ];
  }

if (diagCode === 'LSP1204') {
    const funcLine = findEnclosingFunctionLine(lines, range.start.line);

    let paramType = 'Numero';
    if (funcLine >= 0) {
      const paramRegex = new RegExp(`\\b(Numero|Alfa|Data|Hora|Cursor)\\s+End\\s+${escapeRegExp(name)}\\b`, 'i');
      for (let i = funcLine; i < Math.min(lines.length, funcLine + 50); i += 1) {
        const match = lines[i].match(paramRegex);
        if (match) {
          paramType = match[1];
          break;
        }
        if (/[);]/.test(lines[i]) && i > funcLine) break;
      }
    }

    const suggested = `${suggestNameForType(paramType, name, lines)}Local`;

    const edits: QuickFixEdit[] = [];
    edits.push({ type: 'insert', line: insertLine, text: ensureTrailingEol(`${indent}Definir ${paramType} {{NAME}};`, eol) });
    edits.push({ type: 'replace', range, text: '{{NAME}}' });

    let endCallLine = range.end.line;
    for (let i = range.end.line; i < lines.length; i += 1) {
      if (lines[i].includes(';')) {
        endCallLine = i + 1;
        break;
      }
    }
    const callIndent = lineIndent(lines[Math.max(0, endCallLine - 1)]) || indent;
    edits.push({ type: 'insert', line: endCallLine, text: ensureTrailingEol(`${callIndent}${name} = {{NAME}};`, eol) });

    return [
      {
        title: `Usar variavel local para END (${suggested})`,
        edits,
        rename: {
          suggestedName: suggested,
          requiresConfirmation: true
        }
      }
    ];
  }

  if (diagCode === 'LSP1404') {
    const suggested = suggestNameForType('Data', name, lines);
    return [
      {
        title: `Declarar Data ${name}`,
        edits: [{ type: 'insert', line: insertLine, text: ensureTrailingEol(`${indent}Definir Data {{NAME}};`, eol) }],
        rename: {
          suggestedName: suggested,
          requiresConfirmation: true
        }
      }
    ];
  }

  if (diagCode === 'LSP1005') {
    const inferredType = inferTypeForUndeclaredVariable(lines, range, name);
    return [
      {
        title: `Declarar ${inferredType} ${name}`,
        edits: [{ type: 'insert', line: insertLine, text: ensureTrailingEol(`${indent}Definir ${inferredType} ${name};`, eol) }]
      }
    ];
  }

  return [];
}
