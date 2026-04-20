import { collectEmbeddedSqlAnalyses, collectEmbeddedSqlDebugReport, collectEmbeddedSqlRewriteTargets } from '../embedded-sql/eligibility';
import { parseSingleFile } from '../parser/parser';
import { createSourceFile, positionToOffset } from '../source/source-file';
import type { EmbeddedSqlDebugReport, EmbeddedSqlDialect, EmbeddedSqlFormatAttempt, EmbeddedSqlFormatReport } from './types';
import type { EmbeddedSqlFormatterProvider } from './embedded-sql-provider';

function escapeStringLiteralContent(value: string): string
{
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildContinuationIndent(startCharacter: number): string
{
  return ' '.repeat(Math.max(0, startCharacter + 1));
}

function buildEmbeddedSqlStringLiteral(
  formattedSql: string,
  continuationIndent: string,
  eol: '\r\n' | '\n',
  prefersContinuationLayout: boolean
): string
{
  const lines = formattedSql.replace(/\r\n/g, '\n').split('\n');
  const escapedLines = lines.map((line) => escapeStringLiteralContent(line));
  const content = prefersContinuationLayout && escapedLines.length > 1
    ? escapedLines
      .map((line, index) => (
        index === 0
          ? line
          : `${continuationIndent}${line}`
      ))
      .map((line, index) => (index < escapedLines.length - 1 ? `${line} \\` : line))
      .join(eol)
    : escapedLines
      .map((line, index) => (index === 0 ? line : `${continuationIndent}${line}`))
      .join(eol);
  return `"${content}"`;
}

function buildTemplatedEmbeddedSqlExpression(input: {
  formattedSql: string;
  templateSlots: Array<{ marker: string; exprText: string }>;
  continuationIndent: string;
  operatorIndent: string;
  eol: '\r\n' | '\n';
  prefersContinuationLayout: boolean;
  trimWhitespaceBeforeSlots?: boolean;
}): string
{
  const markerPattern = /\/\*__LSP_SQL_SLOT_(\d+)__\*\//g;
  const parts: string[] = [];
  let lastIndex = 0;

  for (const match of input.formattedSql.matchAll(markerPattern))
  {
    const markerIndex = match.index ?? -1;
    if (markerIndex < 0) continue;
    const rawStaticSegment = input.formattedSql.slice(lastIndex, markerIndex);
    const staticSegment = input.trimWhitespaceBeforeSlots
      ? (() => {
        const trimmed = rawStaticSegment.replace(/[ \t]+$/g, '');
        return /=$/.test(trimmed) ? `${trimmed} ` : trimmed;
      })()
      : rawStaticSegment;
    if (staticSegment.length > 0) {
      parts.push(buildEmbeddedSqlStringLiteral(
        staticSegment,
        input.continuationIndent,
        input.eol,
        input.prefersContinuationLayout || staticSegment.includes('\n')
      ));
    }
    const slotIndex = Number(match[1] ?? -1);
    const slot = Number.isInteger(slotIndex) ? input.templateSlots[slotIndex] : undefined;
    if (slot) parts.push(slot.exprText.trim());
    lastIndex = markerIndex + match[0].length;
  }

  const tail = input.formattedSql.slice(lastIndex);
  if (tail.length > 0) {
    parts.push(buildEmbeddedSqlStringLiteral(
      tail,
      input.continuationIndent,
      input.eol,
      input.prefersContinuationLayout || tail.includes('\n')
    ));
  }

  const normalizedParts = parts.filter((part) => part.length > 0);
  if (normalizedParts.length === 0) return '""';
  if (normalizedParts.length === 1) return normalizedParts[0]!;
  return normalizedParts
    .map((part, index) => (index === 0 ? part : `${input.eol}${input.operatorIndent}+ ${part}`))
    .join('');
}

function buildEmbeddedSqlReport(
  enabled: boolean,
  attempts: EmbeddedSqlFormatAttempt[],
  debug: EmbeddedSqlDebugReport = { events: [], eventCount: 0 }
): EmbeddedSqlFormatReport
{
  return {
    enabled,
    debug,
    attempts,
    attemptedCount: attempts.length,
    eligibleCount: attempts.filter((attempt) => attempt.decision === 'applied' || attempt.decision === 'no_op_already_canonical' || attempt.decision === 'formatter_error').length,
    appliedCount: attempts.filter((attempt) => attempt.decision === 'applied').length,
    noOpCount: attempts.filter((attempt) => attempt.decision === 'no_op_already_canonical').length,
    rejectedCount: attempts.filter((attempt) => attempt.decision === 'rejected' || attempt.decision === 'disabled').length,
    errorCount: attempts.filter((attempt) => attempt.decision === 'formatter_error').length
  };
}

export function formatEmbeddedSqlInDocument(input: {
  sourcePath: string;
  text: string;
  eol: '\r\n' | '\n';
  enabled: boolean;
  dialect: EmbeddedSqlDialect;
  provider: EmbeddedSqlFormatterProvider;
}): { text: string; report: EmbeddedSqlFormatReport }
{
  if (!input.enabled) {
    return {
      text: input.text,
      report: buildEmbeddedSqlReport(false, [], { events: [], eventCount: 0 })
    };
  }

  const source = createSourceFile(input.sourcePath, input.text);
  const parsed = parseSingleFile(source, 0);
  if (parsed.errors.length > 0) {
    return { text: input.text, report: buildEmbeddedSqlReport(true, [], { events: [], eventCount: 0 }) };
  }

  const analyses = collectEmbeddedSqlAnalyses(parsed.file);
  const debug = collectEmbeddedSqlDebugReport(parsed.file);

  const targets = collectEmbeddedSqlRewriteTargets(parsed.file);
  const attempts: EmbeddedSqlFormatAttempt[] = analyses
    .filter((analysis) => !analysis.eligible)
    .map((analysis) => ({
      wrapperKind: analysis.wrapperKind,
      sourceKind: analysis.sourceKind,
      decision: 'rejected',
      reason: analysis.reason
    }));
  if (targets.length === 0) return { text: input.text, report: buildEmbeddedSqlReport(true, attempts, debug) };

  let nextText = input.text;
  let changed = false;
  const replacements = targets
    .map((target) => ({
      target,
      startOffset: positionToOffset(source, target.range.start),
      endOffset: positionToOffset(source, target.range.end),
      templateSlots: (target.templateSlots ?? []).map((slot) => ({
        marker: slot.marker,
        exprText: input.text.slice(positionToOffset(source, slot.exprRange.start), positionToOffset(source, slot.exprRange.end))
      }))
    }))
    .sort((a, b) => b.startOffset - a.startOffset);

  for (const replacement of replacements)
  {
    const result = input.provider.format({
      sql: replacement.target.rawSql.trim().replace(/\r\n/g, '\n'),
      dialect: input.dialect
    });
    if (result.status !== 'formatted') {
      attempts.push({
        wrapperKind: replacement.target.wrapperKind,
        sourceKind: replacement.target.sourceKind,
        decision: 'formatter_error',
        reason: 'formatter_error'
      });
      continue;
    }

    const preferredIndent = buildContinuationIndent(replacement.target.range.start.character);
    const operatorIndent = ' '.repeat(Math.max(0, replacement.target.range.start.character));
    const nextLiteral = replacement.templateSlots.length > 0
      ? buildTemplatedEmbeddedSqlExpression({
        formattedSql: result.text,
        templateSlots: replacement.templateSlots,
        continuationIndent: preferredIndent,
        operatorIndent,
        eol: input.eol,
        prefersContinuationLayout: replacement.target.prefersContinuationLayout || result.text.includes('\n'),
        trimWhitespaceBeforeSlots:
          replacement.target.sourceKind === 'variable_prefixed_dynamic_fragment'
          || replacement.target.sourceKind === 'variable_pragma_consulta'
      })
      : buildEmbeddedSqlStringLiteral(
        result.text,
        preferredIndent,
        input.eol,
        replacement.target.prefersContinuationLayout || result.text.includes('\n')
      );
    const originalExpression = nextText.slice(replacement.startOffset, replacement.endOffset);
    if (nextLiteral === originalExpression) {
      attempts.push({
        wrapperKind: replacement.target.wrapperKind,
        sourceKind: replacement.target.sourceKind,
        decision: 'no_op_already_canonical',
        reason: 'no_op_already_canonical'
      });
      continue;
    }

    nextText = `${nextText.slice(0, replacement.startOffset)}${nextLiteral}${nextText.slice(replacement.endOffset)}`;
    changed = true;
    attempts.push({
      wrapperKind: replacement.target.wrapperKind,
      sourceKind: replacement.target.sourceKind,
      decision: 'applied',
      reason: replacement.target.successReason
    });
  }

  return {
    text: changed ? nextText : input.text,
    report: buildEmbeddedSqlReport(true, attempts)
  };
}
