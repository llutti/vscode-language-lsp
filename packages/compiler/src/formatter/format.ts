import { tokenize } from '../lexer/tokenizer';
import { parseSingleFile } from '../parser/parser';
import { createSourceFile } from '../source/source-file';
import { formatEmbeddedSqlInDocument } from './embedded-sql';
import { defaultEmbeddedSqlFormatterProviderRegistry } from './embedded-sql-provider-registry';
import { printTokensToDoc } from './printer';
import { render } from './render';
import type { FormatDocumentReport, FormatOptions } from './types';

const DEFAULT_OPTIONS: FormatOptions = {
  indentSize: 2,
  useTabs: false,
  maxParamsPerLine: 4,
  embeddedSqlEnabled: false,
  embeddedSqlDialect: 'sql'
};

function normalizeElseIfIndentation(text: string, eol: '\r\n' | '\n'): string {
  const lines = text.split(eol);
  for (let i = 0; i < lines.length - 1; i += 1) {
    const current = lines[i]!;
    const next = lines[i + 1]!;
    const currentMatch = /^([ \t]*)Senao(?:\s+@.*@)?\s*$/i.exec(current);
    const nextMatch = /^([ \t]*)Se(\b.*)$/i.exec(next);
    if (!currentMatch || !nextMatch) continue;
    const elseIndent = currentMatch[1]!;
    const seIndent = nextMatch[1]!;
    if (seIndent.length <= elseIndent.length) continue;
    lines[i + 1] = `${elseIndent}Se${nextMatch[2]}`;
  }
  return lines.join(eol);
}

function isRecoverableFormatterParseErrors(errors: Array<{ message: string; code?: string }>): boolean {
  // Keep formatter strict for invalid syntax in general, but allow known recoverable
  // parser noise that still produces a usable token stream (legacy trailing "Fim;" cases).
  if (errors.every((error) =>
    error?.message === 'Expressão inesperada'
    || error?.code === 'SYN_MISSING_SPACE_BEFORE_INLINE_COMMENT'
  )) {
    return true;
  }

  const hasMissingInlineCommentSpace = errors.some((error) => error?.code === 'SYN_MISSING_SPACE_BEFORE_INLINE_COMMENT');
  return hasMissingInlineCommentSpace
    && errors.every((error) =>
      error?.code === 'SYN_MISSING_SPACE_BEFORE_INLINE_COMMENT'
      || error?.code === 'SYN_EXPECTED_SEMICOLON'
    );
}

function normalizeOptions(options: FormatOptions): FormatOptions {
  const indentSize = Number.isFinite(options.indentSize) && options.indentSize > 0 ? Math.floor(options.indentSize) : 2;
  const maxParamsPerLine = Number.isFinite(options.maxParamsPerLine) && options.maxParamsPerLine > 0
    ? Math.floor(options.maxParamsPerLine)
    : 4;
  const embeddedSqlDialect = options.embeddedSqlDialect === 'oracle'
    ? 'oracle'
    : options.embeddedSqlDialect === 'sqlserver'
      ? 'sqlserver'
      : 'sql';
  return {
    indentSize,
    useTabs: Boolean(options.useTabs),
    maxParamsPerLine,
    embeddedSqlEnabled: Boolean(options.embeddedSqlEnabled),
    embeddedSqlDialect
  };
}

// Nível B (milestone-formatter.md): sem wrap/printWidth por enquanto.

export function formatLspText(input: { text: string; options: FormatOptions }): { text: string; edits?: never } {
  return {
    text: formatDocument({
      sourcePath: '<input>',
      text: input.text,
      options: input.options
    })
  };
}

export function formatLspDocument(input: { sourcePath: string; text: string; options: FormatOptions }): { text: string } {
  return {
    text: formatDocument({
      sourcePath: input.sourcePath,
      text: input.text,
      options: input.options
    })
  };
}

/**
 * API pública (milestone-formatter.md): formatDocument apenas.
 *
 * Patch 2: Nível B (AST/Token stream → Doc IR → Renderer)
 * - preserva EOL original (CRLF/LF)
 * - não implementa formatRange
 * - sem wrap/printWidth
 * - strings/comentários são impressos como átomos (token.value)
 * - `Senao` seguido de `Se` é normalizado como regra canônica de `else-if`,
 *   mantendo `Se` no mesmo nível de indentação de `Senao`
 */
export function formatDocument(input: {
  sourcePath: string;
  text: string;
  options: FormatOptions;
  eol?: '\r\n' | '\n';
}): string {
  return formatDocumentWithDetails(input).text;
}

export function formatDocumentWithDetails(input: {
  sourcePath: string;
  text: string;
  options: FormatOptions;
  eol?: '\r\n' | '\n';
}): { text: string; report: FormatDocumentReport } {
  const eol = input.eol ?? (input.text.includes('\r\n') ? '\r\n' : '\n');
  const normalized = input.text.replace(/\r\n/g, '\n');

  const opts = normalizeOptions({ ...DEFAULT_OPTIONS, ...input.options });
  const source = createSourceFile(input.sourcePath, normalized);
  const parsed = parseSingleFile(source, 0);
  if (parsed.errors.length > 0 && !isRecoverableFormatterParseErrors(parsed.errors)) {
    return {
      text: input.text,
      report: {
        embeddedSql: {
          enabled: opts.embeddedSqlEnabled ?? false,
          attempts: [],
          attemptedCount: 0,
          eligibleCount: 0,
          appliedCount: 0,
          noOpCount: 0,
          rejectedCount: 0,
          errorCount: 0,
          debug: { events: [], eventCount: 0 }
        }
      }
    };
  }

  const { tokens } = tokenize(source);
  // O printer pode usar offsets/ranges para preservar alguns espaçamentos
  // originais em casos específicos (ex.: alinhamento multi-linha dentro de
  // parênteses). Para isso ele recebe o texto normalizado.
  const doc = printTokensToDoc(tokens, normalized, parsed.file, { maxParamsPerLine: opts.maxParamsPerLine });
  const indentUnit = opts.useTabs ? '\t' : ' '.repeat(opts.indentSize);
  const rendered = render(doc, { indentUnit, eol });
  const normalizedElseIf = normalizeElseIfIndentation(rendered, eol);
  if (!(opts.embeddedSqlEnabled ?? false)) {
    return {
      text: normalizedElseIf,
      report: {
        embeddedSql: {
          enabled: false,
          attempts: [],
          attemptedCount: 0,
          eligibleCount: 0,
          appliedCount: 0,
          noOpCount: 0,
          rejectedCount: 0,
          errorCount: 0,
          debug: { events: [], eventCount: 0 }
        }
      }
    };
  }

  const embeddedSqlDialect = opts.embeddedSqlDialect ?? 'sql';
  const embeddedSql = formatEmbeddedSqlInDocument({
    sourcePath: input.sourcePath,
    text: normalizedElseIf,
    eol,
    enabled: true,
    dialect: embeddedSqlDialect,
    provider: defaultEmbeddedSqlFormatterProviderRegistry.get(embeddedSqlDialect)
  });
  return {
    text: embeddedSql.text,
    report: {
      embeddedSql: embeddedSql.report
    }
  };
}

export function formatText(input: { text: string; options: FormatOptions }): { text: string } {


  return {
    text: formatDocument({
      sourcePath: '<input>',
      text: input.text,
      options: input.options
    })
  };
}
