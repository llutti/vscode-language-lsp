import type { Position, Range } from './quick-fixes';

export type RefactorBlockStyle = 'inicioFim' | 'braces';

export type RefactorEdit = {
  type: 'replace';
  range: Range;
  text: string;
};

export type RefactorPlan = {
  kind: 'wrapBlock' | 'wrapIf' | 'wrapWhile' | 'wrapFor' | 'toggleBlockStyle' | 'convertMultilineStringToConcatenation';
  title: string;
  edits: RefactorEdit[];
  selection?: Range;
};

type LocalizedRefactorStrings = {
  wrapBlock: string;
  wrapIf: string;
  wrapWhile: string;
  wrapFor: string;
  toggleBlockStyle: string;
  convertMultilineStringToConcatenation: string;
};

type BlockCandidate = {
  style: RefactorBlockStyle;
  startLine: number;
  endLine: number;
  indent: string;
};

const DEFAULT_STRINGS: LocalizedRefactorStrings = {
  wrapBlock: 'Envolver com bloco',
  wrapIf: 'Envolver com Se (...)',
  wrapWhile: 'Envolver com Enquanto (...)',
  wrapFor: 'Envolver com Para (...)',
  toggleBlockStyle: 'Alternar bloco: Inicio/Fim ↔ { }',
  convertMultilineStringToConcatenation: 'Converter texto multilinha em concatenação'
};

const ES_STRINGS: LocalizedRefactorStrings = {
  wrapBlock: 'Envolver con bloque',
  wrapIf: 'Envolver con Se (...)',
  wrapWhile: 'Envolver con Enquanto (...)',
  wrapFor: 'Envolver con Para (...)',
  toggleBlockStyle: 'Alternar bloque: Inicio/Fim ↔ { }',
  convertMultilineStringToConcatenation: 'Convertir texto multilínea en concatenación'
};

const EN_STRINGS: LocalizedRefactorStrings = {
  wrapBlock: 'Wrap with block',
  wrapIf: 'Wrap with Se (...)',
  wrapWhile: 'Wrap with Enquanto (...)',
  wrapFor: 'Wrap with Para (...)',
  toggleBlockStyle: 'Toggle block: Inicio/Fim ↔ { }',
  convertMultilineStringToConcatenation: 'Convert multiline text to concatenation'
};

export function getRefactorStrings(locale?: string): LocalizedRefactorStrings {
  const normalized = (locale ?? '').toLowerCase();
  if (normalized.startsWith('es')) return ES_STRINGS;
  if (normalized.startsWith('en')) return EN_STRINGS;
  return DEFAULT_STRINGS;
}

function detectEol(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function toLines(text: string): string[] {
  return text.split(/\r?\n/);
}

function lineStartOffsets(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '\n') starts.push(i + 1);
  }
  return starts;
}

function positionToOffset(text: string, position: Position): number {
  const starts = lineStartOffsets(text);
  const lineStart = starts[Math.max(0, Math.min(position.line, starts.length - 1))] ?? 0;
  return lineStart + Math.max(0, position.character);
}

function offsetToPosition(text: string, offset: number): Position {
  const starts = lineStartOffsets(text);
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  while (line + 1 < starts.length && starts[line + 1] <= safeOffset) line += 1;
  return {
    line,
    character: safeOffset - (starts[line] ?? 0)
  };
}

function indentOf(line: string | undefined): string {
  return /^(\s*)/.exec(line ?? '')?.[1] ?? '';
}

function minCommonIndent(lines: string[]): string {
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  if (nonEmpty.length === 0) return '';
  let current = indentOf(nonEmpty[0]);
  for (let i = 1; i < nonEmpty.length; i += 1) {
    const next = indentOf(nonEmpty[i]);
    let size = 0;
    while (size < current.length && size < next.length && current[size] === next[size]) {
      size += 1;
    }
    current = current.slice(0, size);
  }
  return current;
}

function buildIndentStep(input?: { indentSize?: number; useTabs?: boolean }): string {
  if (input?.useTabs) return '\t';
  const indentSize = Number.isFinite(input?.indentSize) ? Math.max(0, Number(input?.indentSize)) : 2;
  return ' '.repeat(indentSize);
}

function normalizeSelectionLines(range: Range): { startLine: number; endLine: number; isEmpty: boolean } {
  const isEmpty =
    range.start.line === range.end.line
    && range.start.character === range.end.character;
  const startLine = range.start.line;
  const endLine =
    !isEmpty && range.end.character === 0 && range.end.line > range.start.line
      ? range.end.line - 1
      : range.end.line;
  return { startLine, endLine, isEmpty };
}

function rangeForLines(lines: string[], startLine: number, endLine: number): Range {
  const safeStart = Math.max(0, Math.min(startLine, lines.length - 1));
  const safeEnd = Math.max(safeStart, Math.min(endLine, lines.length - 1));
  return {
    start: { line: safeStart, character: 0 },
    end: { line: safeEnd, character: lines[safeEnd]?.length ?? 0 }
  };
}

function shiftSelection(base: Position, relativeStart: Position, relativeEnd?: Position): Range {
  const end = relativeEnd ?? relativeStart;
  return {
    start: { line: base.line + relativeStart.line, character: relativeStart.line === 0 ? base.character + relativeStart.character : relativeStart.character },
    end: { line: base.line + end.line, character: end.line === 0 ? base.character + end.character : end.character }
  };
}

function getProtectedStringSpans(text: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = i + 1 < text.length ? text[i + 1] : '';
    if (ch === '/' && next === '*') {
      const start = i;
      i += 2;
      while (i < text.length - 1 && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i = i < text.length - 1 ? i + 2 : text.length;
      spans.push({ start, end: i });
      continue;
    }
    if (ch === '"') {
      const start = i;
      i += 1;
      while (i < text.length) {
        if (text[i] === '\\' && i + 1 < text.length) {
          i += 2;
          continue;
        }
        if (text[i] === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      spans.push({ start, end: i });
      continue;
    }
    i += 1;
  }
  return spans;
}

type StringSpan = { start: number; end: number };
type StatementSpan = { start: number; end: number };

function findUnprotectedCharInRange(
  text: string,
  protectedSpans: Array<{ start: number; end: number }>,
  startOffset: number,
  endOffset: number,
  target: string
): number {
  let protectedIndex = protectedSpans.findIndex((span) => span.end > startOffset);
  if (protectedIndex < 0) protectedIndex = protectedSpans.length;
  let offset = startOffset;

  while (offset < endOffset) {
    const span = protectedSpans[protectedIndex];
    if (span && offset >= span.start) {
      offset = span.end;
      protectedIndex += 1;
      continue;
    }
    if (text[offset] === target) return offset;
    offset += 1;
  }

  return -1;
}

function lineOffsetRange(text: string, lineIndex: number): { start: number; end: number } {
  const starts = lineStartOffsets(text);
  const safeLine = Math.max(0, Math.min(lineIndex, starts.length - 1));
  const start = starts[safeLine] ?? 0;
  let end = safeLine + 1 < starts.length ? (starts[safeLine + 1] ?? text.length) : text.length;
  if (end > start && text[end - 1] === '\n') end -= 1;
  if (end > start && text[end - 1] === '\r') end -= 1;
  return { start, end };
}

function isVariableAssignmentPrefix(value: string): boolean {
  if (value.includes('(')) return false;
  return /^\s*[A-Za-z_][\w]*(?:\s*\[[^\]\r\n]+\])?(?:\s*\.\s*[A-Za-z_][\w]*(?:\s*\[[^\]\r\n]+\])?)*\s*$/i.test(value);
}

function findEligibleAssignmentStatement(text: string, selection: Range): StatementSpan | null {
  const lines = toLines(text);
  const protectedSpans = getProtectedStringSpans(text);
  const emptySelection = selection.start.line === selection.end.line && selection.start.character === selection.end.character;
  const anchorStartLine = emptySelection ? selection.start.line : Math.min(selection.start.line, selection.end.line);
  const anchorEndLine = emptySelection ? selection.start.line : Math.max(selection.start.line, selection.end.line);

  let statementStartLine = -1;
  for (let lineIndex = anchorStartLine; lineIndex >= 0; lineIndex -= 1) {
    const offsets = lineOffsetRange(text, lineIndex);
    const equalOffset = findUnprotectedCharInRange(text, protectedSpans, offsets.start, offsets.end, '=');
    if (equalOffset >= 0) {
      const beforeEqual = text.slice(offsets.start, equalOffset);
      if (isVariableAssignmentPrefix(beforeEqual)) {
        statementStartLine = lineIndex;
        break;
      }
    }
    if (findUnprotectedCharInRange(text, protectedSpans, offsets.start, offsets.end, ';') >= 0) break;
  }

  if (statementStartLine < 0) return null;

  let statementEndLine = -1;
  for (let lineIndex = statementStartLine; lineIndex < lines.length; lineIndex += 1) {
    const offsets = lineOffsetRange(text, lineIndex);
    if (findUnprotectedCharInRange(text, protectedSpans, offsets.start, offsets.end, ';') >= 0) {
      statementEndLine = lineIndex;
      break;
    }
  }

  if (statementEndLine < 0 || anchorEndLine > statementEndLine) {
    if (statementEndLine < anchorEndLine) return null;
  }

  const startOffsets = lineOffsetRange(text, statementStartLine);
  const endOffsets = lineOffsetRange(text, statementEndLine);
  return { start: startOffsets.start, end: endOffsets.end };
}

function getStringSpansForEligibleAssignment(text: string, selection: Range): StringSpan[] {
  const protectedSpans = getProtectedStringSpans(text);
  const statement = findEligibleAssignmentStatement(text, selection);
  if (!statement) return [];
  return protectedSpans.filter((span) => span.start >= statement.start && span.end <= statement.end);
}

function stripPrefix(value: string, prefix: string): string {
  return prefix.length > 0 && value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function buildMultilineStringConcatenation(input: {
  rawLiteral: string;
  literalColumn: number;
  eol: string;
  allowSingleSegment?: boolean;
}): string | null {
  const { rawLiteral, literalColumn, eol, allowSingleSegment = false } = input;
  if (rawLiteral.length < 2 || rawLiteral[0] !== '"' || rawLiteral[rawLiteral.length - 1] !== '"') return null;

  const content = rawLiteral.slice(1, -1);
  if (!content.includes(`\\${eol}`)) return null;

  const segments = content.split(`\\${eol}`);
  if (segments.length < 2) return null;

  const continuationSegments = segments.slice(1);
  const commonIndent = minCommonIndent(continuationSegments);
  const removableIndent = commonIndent.length > 0 ? commonIndent.slice(0, -1) : '';
  const normalizedSegments = [
    segments[0] ?? '',
    ...continuationSegments.map((segment) => stripPrefix(segment, removableIndent))
  ];

  while (normalizedSegments.length > 1 && (normalizedSegments[normalizedSegments.length - 1]?.trim().length ?? 0) === 0) {
    normalizedSegments.pop();
  }

  if (normalizedSegments.length === 1) {
    return allowSingleSegment ? `"${normalizedSegments[0]}"` : null;
  }

  const continuationIndent = ' '.repeat(Math.max(0, literalColumn - 2));
  const rendered = normalizedSegments.map((segment, index) => {
    const prefix = index === 0 ? '' : `${continuationIndent}+ `;
    return `${prefix}"${segment}"`;
  });

  return rendered.join(eol);
}

function isInsideProtectedString(text: string, position: Position): boolean {
  const offset = positionToOffset(text, position);
  return getProtectedStringSpans(text).some((span) => offset > span.start && offset < span.end);
}

function recognizeBlockCandidates(lines: string[]): BlockCandidate[] {
  const candidates: BlockCandidate[] = [];
  const stack: Array<{ style: RefactorBlockStyle; startLine: number; indent: string }> = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? '';
    const trimmed = line.trim();
    if (/^Inicio$/i.test(trimmed)) {
      stack.push({ style: 'inicioFim', startLine: lineIndex, indent: indentOf(line) });
      continue;
    }
    if (/^\{$/.test(trimmed)) {
      stack.push({ style: 'braces', startLine: lineIndex, indent: indentOf(line) });
      continue;
    }
    if (/^Fim;\s*$/i.test(trimmed)) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        const entry = stack[i];
        if (!entry || entry.style !== 'inicioFim') continue;
        stack.splice(i, stack.length - i);
        candidates.push({
          style: 'inicioFim',
          startLine: entry.startLine,
          endLine: lineIndex,
          indent: entry.indent
        });
        break;
      }
      continue;
    }
    if (/^\}$/.test(trimmed)) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        const entry = stack[i];
        if (!entry || entry.style !== 'braces') continue;
        stack.splice(i, stack.length - i);
        candidates.push({
          style: 'braces',
          startLine: entry.startLine,
          endLine: lineIndex,
          indent: entry.indent
        });
        break;
      }
    }
  }

  return candidates;
}

function selectToggleCandidate(candidates: BlockCandidate[], selection: { startLine: number; endLine: number; isEmpty: boolean }): BlockCandidate | null {
  const filtered = candidates.filter((candidate) =>
    candidate.startLine <= selection.startLine && candidate.endLine >= selection.endLine
  );
  if (filtered.length === 0) return null;
  filtered.sort((a, b) => (a.endLine - a.startLine) - (b.endLine - b.startLine));
  return filtered[0] ?? null;
}

function withIndentedBody(lines: string[], indentStep: string): string[] {
  return lines.map((line) => (line.length === 0 ? '' : `${indentStep}${line}`));
}

function wrapLines(input: {
  selectedLines: string[];
  blockStyle: RefactorBlockStyle;
  indent: string;
  indentStep: string;
  controlKeyword?: 'Se' | 'Enquanto' | 'Para';
}): { text: string; relativeSelection: Range } {
  const { selectedLines, blockStyle, indent, indentStep, controlKeyword } = input;
  const eol = '\n';
  const openBlock = blockStyle === 'inicioFim' ? 'Inicio' : '{';
  const closeBlock = blockStyle === 'inicioFim' ? 'Fim;' : '}';
  const body = withIndentedBody(selectedLines, indentStep).join(eol);

  if (!controlKeyword) {
    const replacement = `${indent}${openBlock}${eol}${body}${eol}${indent}${closeBlock}`;
    const cursorCharacter = indent.length + indentStep.length;
    return {
      text: replacement,
      relativeSelection: {
        start: { line: 1, character: cursorCharacter },
        end: { line: 1, character: cursorCharacter }
      }
    };
  }

  const header = `${indent}${controlKeyword} ()`;
  const conditionCharacter = indent.length + controlKeyword.length + 2;
  const replacement = `${header}${eol}${indent}${openBlock}${eol}${body}${eol}${indent}${closeBlock}`;
  return {
    text: replacement,
    relativeSelection: {
      start: { line: 0, character: conditionCharacter },
      end: { line: 0, character: conditionCharacter }
    }
  };
}

function buildWrapPlan(input: {
  kind: RefactorPlan['kind'];
  title: string;
  text: string;
  selection: Range;
  blockStyle: RefactorBlockStyle;
  settings?: { indentSize?: number; useTabs?: boolean };
}): RefactorPlan | null {
  const eol = detectEol(input.text);
  const lines = toLines(input.text);
  const expanded = normalizeSelectionLines(input.selection);
  if (expanded.isEmpty) return null;
  if (expanded.startLine < 0 || expanded.endLine >= lines.length) return null;
  const replaceRange = rangeForLines(lines, expanded.startLine, expanded.endLine);
  if (isInsideProtectedString(input.text, input.selection.start) || isInsideProtectedString(input.text, input.selection.end)) {
    return null;
  }

  const selectedLines = lines.slice(expanded.startLine, expanded.endLine + 1);
  const indent = minCommonIndent(selectedLines);
  const indentStep = buildIndentStep(input.settings);
  const wrapped = wrapLines({
    selectedLines,
    blockStyle: input.blockStyle,
    indent,
    indentStep,
    controlKeyword:
      input.kind === 'wrapIf' ? 'Se'
      : input.kind === 'wrapWhile' ? 'Enquanto'
      : input.kind === 'wrapFor' ? 'Para'
      : undefined
  });
  return {
    kind: input.kind,
    title: input.title,
    edits: [{ type: 'replace', range: replaceRange, text: wrapped.text.replace(/\n/g, eol) }],
    selection: shiftSelection(replaceRange.start, wrapped.relativeSelection.start, wrapped.relativeSelection.end)
  };
}

function buildTogglePlan(input: {
  title: string;
  text: string;
  selection: Range;
}): RefactorPlan | null {
  const eol = detectEol(input.text);
  const lines = toLines(input.text);
  const normalized = normalizeSelectionLines(input.selection);
  const lineRange = normalized.isEmpty
    ? { ...normalized, endLine: normalized.startLine }
    : normalized;
  if (isInsideProtectedString(input.text, input.selection.start) || isInsideProtectedString(input.text, input.selection.end)) {
    return null;
  }

  const candidate = selectToggleCandidate(recognizeBlockCandidates(lines), lineRange);
  if (!candidate) return null;

  const openLine = lines[candidate.startLine] ?? '';
  const closeLine = lines[candidate.endLine] ?? '';
  const nextStyle: RefactorBlockStyle = candidate.style === 'inicioFim' ? 'braces' : 'inicioFim';
  const replacementLines = lines.slice(candidate.startLine, candidate.endLine + 1);
  replacementLines[0] = `${candidate.indent}${nextStyle === 'inicioFim' ? 'Inicio' : '{'}`;
  replacementLines[replacementLines.length - 1] = `${candidate.indent}${nextStyle === 'inicioFim' ? 'Fim;' : '}'}`;

  if ((candidate.style === 'inicioFim' && !/^(\s*)Inicio$/i.test(openLine.trimStart()))
    || (candidate.style === 'braces' && openLine.trim() !== '{')
    || (candidate.style === 'inicioFim' && !/^Fim;\s*$/i.test(closeLine.trim()))
    || (candidate.style === 'braces' && closeLine.trim() !== '}')) {
    return null;
  }

  return {
    kind: 'toggleBlockStyle',
    title: input.title,
    edits: [{
      type: 'replace',
      range: rangeForLines(lines, candidate.startLine, candidate.endLine),
      text: replacementLines.join(eol)
    }]
  };
}

function buildConvertMultilineStringPlan(input: {
  title: string;
  text: string;
  selection: Range;
}): RefactorPlan | null {
  const spans = getStringSpansForEligibleAssignment(input.text, input.selection);
  if (spans.length === 0) return null;

  const eol = detectEol(input.text);
  const edits: RefactorEdit[] = [];
  for (const span of spans) {
    const rawLiteral = input.text.slice(span.start, span.end);
    const startPosition = offsetToPosition(input.text, span.start);
    const replacement = buildMultilineStringConcatenation({
      rawLiteral,
      literalColumn: startPosition.character,
      eol,
      allowSingleSegment: spans.length > 1
    });
    if (!replacement) continue;
    edits.push({
      type: 'replace',
      range: {
        start: startPosition,
        end: offsetToPosition(input.text, span.end)
      },
      text: replacement
    });
  }

  if (edits.length === 0) return null;

  edits.sort((left, right) => {
    if (left.range.start.line !== right.range.start.line) return right.range.start.line - left.range.start.line;
    return right.range.start.character - left.range.start.character;
  });

  return {
    kind: 'convertMultilineStringToConcatenation',
    title: input.title,
    edits
  };
}

export function buildRefactorPlans(input: {
  docText: string;
  selection: Range;
  locale?: string;
  defaultBlockStyle?: RefactorBlockStyle;
  settings?: { indentSize?: number; useTabs?: boolean };
}): RefactorPlan[] {
  const strings = getRefactorStrings(input.locale);
  const blockStyle = input.defaultBlockStyle ?? 'inicioFim';
  const plans: RefactorPlan[] = [];

  const wrapBlock = buildWrapPlan({
    kind: 'wrapBlock',
    title: strings.wrapBlock,
    text: input.docText,
    selection: input.selection,
    blockStyle,
    settings: input.settings
  });
  if (wrapBlock) plans.push(wrapBlock);

  const wrapIf = buildWrapPlan({
    kind: 'wrapIf',
    title: strings.wrapIf,
    text: input.docText,
    selection: input.selection,
    blockStyle,
    settings: input.settings
  });
  if (wrapIf) plans.push(wrapIf);

  const wrapWhile = buildWrapPlan({
    kind: 'wrapWhile',
    title: strings.wrapWhile,
    text: input.docText,
    selection: input.selection,
    blockStyle,
    settings: input.settings
  });
  if (wrapWhile) plans.push(wrapWhile);

  const wrapFor = buildWrapPlan({
    kind: 'wrapFor',
    title: strings.wrapFor,
    text: input.docText,
    selection: input.selection,
    blockStyle,
    settings: input.settings
  });
  if (wrapFor) plans.push(wrapFor);

  const toggle = buildTogglePlan({
    title: strings.toggleBlockStyle,
    text: input.docText,
    selection: input.selection
  });
  if (toggle) plans.push(toggle);

  const convertMultilineString = buildConvertMultilineStringPlan({
    title: strings.convertMultilineStringToConcatenation,
    text: input.docText,
    selection: input.selection
  });
  if (convertMultilineString) plans.push(convertMultilineString);

  return plans;
}
