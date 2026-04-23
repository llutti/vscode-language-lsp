import { collectEmbeddedSqlDebugReport, collectEmbeddedSqlHighlightTargets } from '../embedded-sql/eligibility';
import { parseSingleFile } from '../parser/parser';
import { createSourceFile } from '../source/source-file';
import type { EmbeddedSqlDialect } from '../formatter/types';
import type { SemanticOccurrence } from './semantic-tokens';
import { collectEmbeddedSqlLexicalAnalysis, collectEmbeddedSqlLexicalOccurrences } from './embedded-sql-lexical-highlighting';

export function collectEmbeddedSqlSemanticOccurrences(input: {
  sourcePath: string;
  text: string;
  dialect?: EmbeddedSqlDialect;
}): SemanticOccurrence[]
{
  const source = createSourceFile(input.sourcePath, input.text);
  const parsed = parseSingleFile(source, 0);
  collectEmbeddedSqlDebugReport(parsed.file);
  if (parsed.errors.length > 0) return [];

  const targets = collectEmbeddedSqlHighlightTargets(parsed.file);
  const occurrences: SemanticOccurrence[] = [];
  for (const target of targets)
  {
    occurrences.push({
      sourcePath: input.sourcePath,
      range: target.range,
      tokenType: 'string',
      tokenModifiers: ['defaultLibrary', 'readonly'],
      embeddedSql: {
        wrapperKind: target.wrapperKind,
        sourceKind: target.sourceKind
      }
    });

    occurrences.push(...collectEmbeddedSqlLexicalOccurrences({
      sourcePath: input.sourcePath,
      text: input.text,
      literalRanges: target.literalRanges,
      wrapperKind: target.wrapperKind,
      sourceKind: target.sourceKind,
      dialect: input.dialect ?? 'sql'
    }));
  }
  return occurrences;
}

export function collectEmbeddedSqlSemanticDebugReport(input: {
  sourcePath: string;
  text: string;
  dialect?: EmbeddedSqlDialect;
})
{
  const parseStartedAt = Date.now();
  const source = createSourceFile(input.sourcePath, input.text);
  const parsed = parseSingleFile(source, 0);
  const parseMs = Date.now() - parseStartedAt;
  if (parsed.errors.length > 0) {
    return {
      events: [{ decision: 'semantic_debug_skipped_parse_error', sourcePath: input.sourcePath, parseMs, errorCount: parsed.errors.length }],
      eventCount: 1
    };
  }

  const debug = collectEmbeddedSqlDebugReport(parsed.file);
  const targetStartedAt = Date.now();
  const targets = collectEmbeddedSqlHighlightTargets(parsed.file);
  const highlightTargetCollectionMs = Date.now() - targetStartedAt;
  const dialect = input.dialect ?? 'sql';
  const lexicalStartedAt = Date.now();
  let lexicalOccurrenceCount = 0;
  const countsByTokenType: Record<string, number> = {};
  const countsByDialectCategory: Record<string, number> = {};
  const sampleMatches: unknown[] = [];

  for (const target of targets)
  {
    const lexical = collectEmbeddedSqlLexicalAnalysis({
      sourcePath: input.sourcePath,
      text: input.text,
      literalRanges: target.literalRanges,
      wrapperKind: target.wrapperKind,
      sourceKind: target.sourceKind,
      dialect
    });
    lexicalOccurrenceCount += lexical.occurrences.length;
    for (const [tokenType, count] of Object.entries(lexical.summary.countsByTokenType) as Array<[string, number]>) {
      countsByTokenType[tokenType] = (countsByTokenType[tokenType] ?? 0) + count;
    }
    for (const [category, count] of Object.entries(lexical.summary.countsByDialectCategory) as Array<[string, number]>) {
      countsByDialectCategory[category] = (countsByDialectCategory[category] ?? 0) + count;
    }
    for (const entry of lexical.summary.sampleMatches) {
      if (sampleMatches.length >= 12) break;
      sampleMatches.push(entry);
    }
  }

  const lexicalCollectionMs = Date.now() - lexicalStartedAt;
  const totalMs = parseMs + highlightTargetCollectionMs + lexicalCollectionMs;
  debug.events.push({
    decision: 'semantic_highlight_debug_summary',
    sourcePath: input.sourcePath,
    resolvedDialect: dialect,
    parseMs,
    highlightTargetCollectionMs,
    lexicalCollectionMs,
    totalMs,
    highlightTargetCount: targets.length,
    lexicalOccurrenceCount,
    lexicalCountsByTokenType: countsByTokenType,
    lexicalCountsByDialectCategory: countsByDialectCategory,
    lexicalSampleMatches: sampleMatches
  });
  return { events: debug.events, eventCount: debug.events.length };
}
