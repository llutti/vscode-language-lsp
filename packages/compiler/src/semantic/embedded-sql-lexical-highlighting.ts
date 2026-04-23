import { createSourceFile, positionToOffset, rangeFromOffsets } from '../source/source-file';
import type { Range } from '../source/types';
import type { EmbeddedSqlDialect } from '../formatter/types';
import type { SemanticOccurrence } from './semantic-tokens';
import { decodeSqlStringLiteralWithSourceMap } from '../embedded-sql/string-literal';
import { getEmbeddedSqlDialectLexicon } from './embedded-sql-lexicon';

const SQL_BIND_PATTERN = /:[A-Za-z_][A-Za-z0-9_]*/g;
const SQL_IDENTIFIER_PATTERN = /[A-Za-z_][A-Za-z0-9_$#]*/g;
const SQL_STRING_LITERAL_PATTERN = /'(?:''|[^'])*'/g;
const SQL_NUMBER_PATTERN = /\b\d+(?:\.\d+)?\b/g;
const SQL_PAREN_PATTERN = /[()]/g;

type SqlTokenCandidate = {
  start: number;
  end: number;
  tokenType: SemanticOccurrence['tokenType'];
  tokenModifiers: SemanticOccurrence['tokenModifiers'];
  dialectCategory: 'function' | 'bareFunction' | 'keyword' | 'compoundKeyword' | 'type' | 'property' | 'bind' | 'string' | 'number' | 'operator' | 'paren';
  matchedText?: string;
};

export type EmbeddedSqlLexicalDebugSummary = {
  resolvedDialect: EmbeddedSqlDialect;
  candidateCount: number;
  countsByTokenType: Record<string, number>;
  countsByDialectCategory: Record<string, number>;
  sampleMatches: Array<{
    text: string;
    tokenType: SemanticOccurrence['tokenType'];
    dialectCategory: SqlTokenCandidate['dialectCategory'];
    start: number;
    end: number;
  }>;
};

function pushCandidate(list: SqlTokenCandidate[], candidate: SqlTokenCandidate): void
{
  if (candidate.end <= candidate.start) return;
  if (list.some((entry) => !(candidate.end <= entry.start || candidate.start >= entry.end))) return;
  list.push(candidate);
}

function overlapsRange(start: number, end: number, ranges: Array<{ start: number; end: number }>): boolean
{
  return ranges.some((range) => !(end <= range.start || start >= range.end));
}

function pushRegexCandidates(
  list: SqlTokenCandidate[],
  text: string,
  pattern: RegExp,
  createCandidate: (value: string, start: number, end: number) => SqlTokenCandidate,
  skip?: (start: number, end: number) => boolean
): void
{
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern))
  {
    const start = match.index ?? -1;
    if (start < 0) continue;
    const end = start + match[0].length;
    if (skip?.(start, end)) continue;
    pushCandidate(list, createCandidate(match[0], start, end));
  }
}

function escapeRegExp(text: string): string
{
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildCompoundKeywordPattern(entry: string): RegExp
{
  const pieces = entry.trim().split(/\s+/).map(escapeRegExp);
  return new RegExp(`\\b${pieces.join('\\s+')}\\b`, 'gi');
}

function collectCandidates(text: string, dialect: EmbeddedSqlDialect): SqlTokenCandidate[]
{
  const candidates: SqlTokenCandidate[] = [];
  const lexicon = getEmbeddedSqlDialectLexicon(dialect);
  const keywordSet = new Set((lexicon.keywords ?? []).map((entry) => entry.toUpperCase()));
  const functionSet = new Set((lexicon.functions ?? []).map((entry) => entry.toUpperCase()));
  const bareFunctionSet = new Set((lexicon.bareFunctions ?? []).map((entry) => entry.toUpperCase()));
  const typeSet = new Set((lexicon.types ?? []).map((entry) => entry.toUpperCase()));
  const operatorPattern = new RegExp(
    (lexicon.operators ?? ['<>', '>=', '<=', '!=', '\\|\\|', '=', '\\+', '-', '\\*', '/', ','])
      .map((entry) => escapeRegExp(entry))
      .sort((a: string, b: string) => b.length - a.length)
      .join('|'),
    'g'
  );

  const literalRanges: Array<{ start: number; end: number }> = [];

  pushRegexCandidates(candidates, text, SQL_STRING_LITERAL_PATTERN, (value, start, end) => {
    literalRanges.push({ start, end });
    return {
      start,
      end,
      tokenType: 'string',
      tokenModifiers: ['defaultLibrary'],
      dialectCategory: 'string',
      matchedText: value
    };
  });

  const isInsideLiteral = (start: number, end: number) => overlapsRange(start, end, literalRanges);

  pushRegexCandidates(candidates, text, SQL_BIND_PATTERN, (value, start, end) => ({
    start,
    end,
    tokenType: 'parameter',
    tokenModifiers: ['defaultLibrary', 'readonly'],
    dialectCategory: 'bind',
    matchedText: value
  }), isInsideLiteral);

  const compoundKeywords = [...(lexicon.compoundKeywords ?? [])].sort((a: string, b: string) => b.length - a.length);
  for (const entry of compoundKeywords)
  {
    const pattern = buildCompoundKeywordPattern(entry);
    pushRegexCandidates(candidates, text, pattern, (value, start, end) => ({
      start,
      end,
      tokenType: 'keyword',
      tokenModifiers: ['defaultLibrary'],
      dialectCategory: 'compoundKeyword',
      matchedText: value
    }), isInsideLiteral);
  }

  pushRegexCandidates(candidates, text, SQL_IDENTIFIER_PATTERN, (value, start, end) => {
    const upper = value.toUpperCase();
    const suffix = text.slice(end);
    const prev = text.slice(Math.max(0, start - 1), start);

    if (functionSet.has(upper) && /^\s*\(/.test(suffix)) {
      return {
        start,
        end,
        tokenType: 'function',
        tokenModifiers: ['defaultLibrary'],
        dialectCategory: 'function',
        matchedText: value
      };
    }

    if (bareFunctionSet.has(upper)) {
      return {
        start,
        end,
        tokenType: 'function',
        tokenModifiers: ['defaultLibrary'],
        dialectCategory: 'bareFunction',
        matchedText: value
      };
    }

    if (typeSet.has(upper)) {
      return {
        start,
        end,
        tokenType: 'keyword',
        tokenModifiers: ['defaultLibrary'],
        dialectCategory: 'type',
        matchedText: value
      };
    }

    if (keywordSet.has(upper)) {
      return {
        start,
        end,
        tokenType: 'keyword',
        tokenModifiers: ['defaultLibrary'],
        dialectCategory: 'keyword',
        matchedText: value
      };
    }

    if (prev === '.' || /^\s*\./.test(suffix)) {
      return {
        start,
        end,
        tokenType: 'property',
        tokenModifiers: [],
        dialectCategory: 'property',
        matchedText: value
      };
    }

    // Bare SQL identifiers should keep the same visual category used for
    // qualified members so they do not fall back to the wrapper string token.
    return {
      start,
      end,
      tokenType: 'property',
      tokenModifiers: [],
      dialectCategory: 'property',
      matchedText: value
    };
  }, isInsideLiteral);

  // remove sentinel null-equivalent entries
  const filteredCandidates = candidates.filter((candidate) => candidate.start >= 0);

  pushRegexCandidates(filteredCandidates, text, SQL_NUMBER_PATTERN, (value, start, end) => ({
    start,
    end,
    tokenType: 'number',
    tokenModifiers: ['defaultLibrary'],
    dialectCategory: 'number',
    matchedText: value
  }), isInsideLiteral);

  pushRegexCandidates(filteredCandidates, text, operatorPattern, (value, start, end) => ({
    start,
    end,
    tokenType: 'keyword',
    tokenModifiers: ['defaultLibrary'],
    dialectCategory: 'operator',
    matchedText: value
  }), isInsideLiteral);

  pushRegexCandidates(filteredCandidates, text, SQL_PAREN_PATTERN, (value, start, end) => ({
    start,
    end,
    tokenType: 'keyword',
    tokenModifiers: ['defaultLibrary'],
    dialectCategory: 'paren',
    matchedText: value
  }), isInsideLiteral);

  return filteredCandidates.sort((a, b) => a.start - b.start);
}

function summarizeCandidates(candidates: SqlTokenCandidate[], dialect: EmbeddedSqlDialect): EmbeddedSqlLexicalDebugSummary
{
  const countsByTokenType: Record<string, number> = {};
  const countsByDialectCategory: Record<string, number> = {};
  for (const candidate of candidates)
  {
    countsByTokenType[candidate.tokenType] = (countsByTokenType[candidate.tokenType] ?? 0) + 1;
    countsByDialectCategory[candidate.dialectCategory] = (countsByDialectCategory[candidate.dialectCategory] ?? 0) + 1;
  }
  return {
    resolvedDialect: dialect,
    candidateCount: candidates.length,
    countsByTokenType,
    countsByDialectCategory,
    sampleMatches: candidates.slice(0, 12).map((candidate) => ({
      text: candidate.matchedText ?? '',
      tokenType: candidate.tokenType,
      dialectCategory: candidate.dialectCategory,
      start: candidate.start,
      end: candidate.end
    }))
  };
}

export function collectEmbeddedSqlLexicalOccurrences(input: {
  sourcePath: string;
  text: string;
  literalRanges: Range[];
  wrapperKind: NonNullable<SemanticOccurrence['embeddedSql']>['wrapperKind'];
  sourceKind: NonNullable<SemanticOccurrence['embeddedSql']>['sourceKind'];
  dialect?: EmbeddedSqlDialect;
}): SemanticOccurrence[]
{
  return collectEmbeddedSqlLexicalAnalysis(input).occurrences;
}

export function collectEmbeddedSqlLexicalAnalysis(input: {
  sourcePath: string;
  text: string;
  literalRanges: Range[];
  wrapperKind: NonNullable<SemanticOccurrence['embeddedSql']>['wrapperKind'];
  sourceKind: NonNullable<SemanticOccurrence['embeddedSql']>['sourceKind'];
  dialect?: EmbeddedSqlDialect;
}): {
  occurrences: SemanticOccurrence[];
  summary: EmbeddedSqlLexicalDebugSummary;
}
{
  const source = createSourceFile(input.sourcePath, input.text);
  const dialect = input.dialect ?? 'sql';
  const occurrences: SemanticOccurrence[] = [];
  const allCandidates: SqlTokenCandidate[] = [];

  for (const literalRange of input.literalRanges)
  {
    const startOffset = positionToOffset(source, literalRange.start);
    const endOffset = positionToOffset(source, literalRange.end);
    const rawLiteral = input.text.slice(startOffset, endOffset);
    if (rawLiteral.length < 2 || !rawLiteral.startsWith('"') || !rawLiteral.endsWith('"')) continue;
    const decoded = decodeSqlStringLiteralWithSourceMap(rawLiteral);
    const candidates = collectCandidates(decoded.text, dialect);
    allCandidates.push(...candidates);
    for (const candidate of candidates)
    {
      const mappedStart = decoded.sourceOffsets[candidate.start];
      const mappedEnd = decoded.sourceOffsets[candidate.end];
      if (mappedStart === undefined || mappedEnd === undefined) continue;
      const range = rangeFromOffsets(source, startOffset + mappedStart, startOffset + mappedEnd);
      occurrences.push({
        sourcePath: input.sourcePath,
        range,
        tokenType: candidate.tokenType,
        tokenModifiers: candidate.tokenModifiers,
        embeddedSql: {
          wrapperKind: input.wrapperKind,
          sourceKind: input.sourceKind
        }
      });
    }
  }

  return {
    occurrences,
    summary: summarizeCandidates(allCandidates, dialect)
  };
}
