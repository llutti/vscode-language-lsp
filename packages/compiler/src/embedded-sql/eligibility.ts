import seniorSignatures from '../internals/data/senior-signatures.json';
import hcmSignatures from '../internals/data/hcm-signatures.json';
import acessoSignatures from '../internals/data/acesso-signatures.json';
import erpSignatures from '../internals/data/erp-signatures.json';
import type {
  CallNode,
  ExpressionNode,
  FileNode,
  IdentifierNode,
  StatementNode,
  StringLiteralNode,
  VarDeclNode
} from '../parser/ast';
import type { Range } from '../source/types';
import { casefold } from '../utils/casefold';
import { extractSqlStringExpression } from './string-literal';
import type {
  EmbeddedSqlAttemptReason,
  EmbeddedSqlDebugReport,
  EmbeddedSqlSourceKind,
  EmbeddedSqlWrapperKind
} from '../formatter/types';

type RawSignature = {
  name?: string;
  params?: Array<{
    name?: string;
    type?: string;
  }>;
};

type AuthorizedCallTarget = {
  name: string;
  parameterIndex: number;
  parameterName: string;
};

type StaticStringResult = {
  rawText: string;
  literalRanges: Range[];
  sourceKind: 'literal' | 'concat_literals';
  prefersContinuationLayout: boolean;
  continuationIndent: string | null;
};

type SqlPragmaKind = 'consulta' | 'fragmento';

type EmbeddedSqlTemplateSlot = {
  marker: string;
  exprRange: Range;
};

type VariableSqlClassification = {
  status: 'not_sql' | 'sql_unknown' | 'sql_direct_literal' | 'sql_concat_literals' | 'sql_mixed_dynamic' | 'sql_fragment';
  sourceKind: EmbeddedSqlSourceKind;
  reason: EmbeddedSqlAttemptReason;
  literalRanges: Range[];
  prefersContinuationLayout: boolean;
  continuationIndent: string | null;
  rawSql?: string;
  replaceExpression?: ExpressionNode;
  templateSlots?: EmbeddedSqlTemplateSlot[];
  eligible: boolean;
  standaloneEligible: boolean;
  eligibleByPragma?: boolean;
  pragmaKind?: SqlPragmaKind;
};

export type EmbeddedSqlRewriteTarget = {
  range: Range;
  rawSql: string;
  wrapperKind: EmbeddedSqlWrapperKind;
  sourceKind: EmbeddedSqlSourceKind;
  successReason: EmbeddedSqlAttemptReason;
  literalRanges: Range[];
  prefersContinuationLayout: boolean;
  continuationIndent: string | null;
  templateSlots?: EmbeddedSqlTemplateSlot[];
};

export type EmbeddedSqlAnalysis = {
  range: Range;
  rawSql?: string;
  wrapperKind: EmbeddedSqlWrapperKind;
  sourceKind: EmbeddedSqlSourceKind;
  eligible: boolean;
  reason: EmbeddedSqlAttemptReason;
  literalRanges: Range[];
  prefersContinuationLayout: boolean;
  continuationIndent: string | null;
  templateSlots?: EmbeddedSqlTemplateSlot[];
};

export type EmbeddedSqlHighlightTarget = {
  range: Range;
  wrapperKind: EmbeddedSqlWrapperKind;
  sourceKind: EmbeddedSqlSourceKind;
  literalRanges: Range[];
};

const AUTHORIZED_CALL_TARGETS: AuthorizedCallTarget[] = [
  { name: 'ExecSQLEx', parameterIndex: 0, parameterName: 'ComandoSQL' },
  { name: 'SQL_DefinirComando', parameterIndex: 1, parameterName: 'aSQL' }
];

const AUTHORIZED_CALL_ARGUMENTS = new Map<string, number>();
const ALLOWED_SQL_ROOT_KEYWORDS = new Set(['select', 'insert', 'update', 'delete']);
const PRAGMA_SQL_CONSULTA = '@lsp-sql-consulta@';
const PRAGMA_SQL_FRAGMENTO = '@lsp-sql-fragmento@';

function registerAuthorizedCallTargets(): void
{
  const signatureSources = [
    seniorSignatures as RawSignature[],
    hcmSignatures as RawSignature[],
    acessoSignatures as RawSignature[],
    erpSignatures as RawSignature[]
  ];

  for (const target of AUTHORIZED_CALL_TARGETS)
  {
    const nameNormalized = casefold(target.name);
    const signatures = signatureSources.flatMap((entries) =>
      entries.filter((entry) => casefold(entry.name ?? '') === nameNormalized)
    );
    const isValid = signatures.some((signature) =>
    {
      const param = signature.params?.[target.parameterIndex];
      if (!param) return false;
      return casefold(param.name ?? '') === casefold(target.parameterName) && casefold(param.type ?? '') === 'alfa';
    });
    if (isValid) AUTHORIZED_CALL_ARGUMENTS.set(nameNormalized, target.parameterIndex);
  }
}

registerAuthorizedCallTargets();

function classifyWrapperKind(ownerName: string): EmbeddedSqlWrapperKind
{
  switch (casefold(ownerName))
  {
    case 'cursor.sql':
      return 'cursor_sql';
    case 'execsql':
      return 'execsql';
    case 'execsqlex':
      return 'execsqlex';
    case 'sql_definircomando':
      return 'sql_definircomando';
    default:
      return 'execsql';
  }
}

function unwrapParen(expr: ExpressionNode | null): ExpressionNode | null
{
  let current = expr;
  while (current?.kind === 'Paren') current = current.expr;
  return current;
}

function reconstructStaticString(expr: ExpressionNode | null): StaticStringResult | null
{
  const extracted = extractSqlStringExpression(expr);
  if (!extracted) return null;
  return {
    rawText: extracted.decodedText,
    literalRanges: extracted.pieces.map((piece) => piece.literal.range),
    sourceKind: extracted.sourceKind,
    prefersContinuationLayout: extracted.prefersContinuationLayout,
    continuationIndent: extracted.continuationIndent
  };
}

function getSourceLines(file: FileNode): string[] | null
{
  if (typeof file.sourceText !== 'string') return null;
  return file.sourceText.replace(/\r\n/g, '\n').split('\n');
}

function collectVarDecls(statements: StatementNode[], out: VarDeclNode[]): void
{
  for (const stmt of statements)
  {
    switch (stmt.kind)
    {
      case 'VarDecl':
        out.push(stmt);
        break;
      case 'Block':
        collectVarDecls(stmt.statements, out);
        break;
      case 'If':
        if (stmt.thenBranch) collectVarDecls([stmt.thenBranch], out);
        if (stmt.elseBranch) collectVarDecls([stmt.elseBranch], out);
        break;
      case 'While':
        if (stmt.body) collectVarDecls([stmt.body], out);
        break;
      case 'For':
        if (stmt.init) collectVarDecls([stmt.init], out);
        if (stmt.body) collectVarDecls([stmt.body], out);
        break;
      case 'FuncImpl':
        if (stmt.body) collectVarDecls(stmt.body.statements, out);
        break;
      default:
        break;
    }
  }
}

function collectSqlPragmas(file: FileNode): Map<string, SqlPragmaKind>
{
  const lines = getSourceLines(file);
  const result = new Map<string, SqlPragmaKind>();
  if (!lines) return result;
  const decls: VarDeclNode[] = [];
  collectVarDecls(file.statements, decls);
  for (const decl of decls)
  {
    const lineIndex = decl.range.start.line;
    if (lineIndex <= 0 || lineIndex > lines.length - 1) continue;
    const previousLine = lines[lineIndex - 1]?.trim() ?? '';
    if (previousLine === PRAGMA_SQL_CONSULTA) result.set(decl.nameNormalized, 'consulta');
    else if (previousLine === PRAGMA_SQL_FRAGMENTO) result.set(decl.nameNormalized, 'fragmento');
  }
  return result;
}


function withOptionalPragma<T extends object>(base: T, pragmaKind?: SqlPragmaKind): T & { pragmaKind?: SqlPragmaKind }
{
  return pragmaKind ? ({ ...base, pragmaKind } as T & { pragmaKind?: SqlPragmaKind }) : (base as T & { pragmaKind?: SqlPragmaKind });
}

type ConcatTerm = {
  kind: 'literal' | 'sql' | 'fragment' | 'dynamic';
  text?: string;
  literalRanges: Range[];
  prefersContinuationLayout: boolean;
  continuationIndent: string | null;
  exprRange?: Range;
};

function makeDynamicTerm(): ConcatTerm
{
  return {
    kind: 'dynamic',
    literalRanges: [],
    prefersContinuationLayout: false,
    continuationIndent: null
  };
}

function flattenConcatTerms(
  expr: ExpressionNode | null,
  stateByIdentifier: Map<string, VariableSqlClassification>
): ConcatTerm[]
{
  const current = unwrapParen(expr);
  if (!current) return [];

  if (current.kind === 'Binary' && current.operator === '+') {
    return [
      ...flattenConcatTerms(current.left, stateByIdentifier),
      ...flattenConcatTerms(current.right, stateByIdentifier)
    ];
  }

  const staticString = reconstructStaticString(current);
  if (staticString) {
    return [{
      kind: 'literal',
      text: staticString.rawText,
      literalRanges: staticString.literalRanges,
      prefersContinuationLayout: staticString.prefersContinuationLayout,
      continuationIndent: staticString.continuationIndent
    }];
  }

  if (current.kind === 'Identifier') {
    const classification = stateByIdentifier.get(current.nameNormalized);
    if (!classification) return [{ ...makeDynamicTerm(), exprRange: current.range }];
    if (classification.status === 'not_sql' && (classification.rawSql ?? '').trim() === '') {
      return [{
        kind: 'literal',
        text: '',
        literalRanges: classification.literalRanges,
        prefersContinuationLayout: classification.prefersContinuationLayout,
        continuationIndent: classification.continuationIndent
      }];
    }
    if (classification.status === 'sql_direct_literal' || classification.status === 'sql_concat_literals') {
      if (!classification.rawSql) return [makeDynamicTerm()];
      return [{
        kind: 'sql',
        text: classification.rawSql,
        literalRanges: classification.literalRanges,
        prefersContinuationLayout: classification.prefersContinuationLayout,
        continuationIndent: classification.continuationIndent
      }];
    }
    if (classification.status === 'sql_fragment') {
      return [{
        kind: 'fragment',
        literalRanges: classification.literalRanges,
        prefersContinuationLayout: classification.prefersContinuationLayout,
        continuationIndent: classification.continuationIndent,
        exprRange: current.range
      }];
    }
    if (classification.status === 'sql_mixed_dynamic' && classification.eligible) {
      if (classification.pragmaKind !== 'fragmento' && !classification.rawSql) return [makeDynamicTerm()];
      return [{
        kind: classification.pragmaKind === 'fragmento' ? 'fragment' : 'sql',
        literalRanges: classification.literalRanges,
        prefersContinuationLayout: classification.prefersContinuationLayout,
        continuationIndent: classification.continuationIndent,
        ...(classification.pragmaKind === 'fragmento' ? {} : { text: classification.rawSql }),
        exprRange: current.range
      }];
    }
    return [{ ...makeDynamicTerm(), exprRange: current.range }];
  }

  return [{ ...makeDynamicTerm(), exprRange: current.range }];
}

function summarizeTerms(terms: ConcatTerm[]): {
  literalRanges: Range[];
  prefersContinuationLayout: boolean;
  continuationIndent: string | null;
  combinedStaticText: string;
  hasDynamic: boolean;
  hasFragment: boolean;
  hasAnySqlLike: boolean;
  dynamicBeforeSql: boolean;
  templateSlots: EmbeddedSqlTemplateSlot[];
}
{
  const literalRanges: Range[] = [];
  let prefersContinuationLayout = false;
  let continuationIndent: string | null = null;
  let combinedStaticText = '';
  let hasDynamic = false;
  let hasFragment = false;
  let hasAnySqlLike = false;
  let dynamicBeforeSql = false;
  const templateSlots: EmbeddedSqlTemplateSlot[] = [];

  for (const term of terms)
  {
    literalRanges.push(...term.literalRanges);
    prefersContinuationLayout ||= term.prefersContinuationLayout;
    continuationIndent ??= term.continuationIndent;
    if (term.kind === 'literal' || term.kind === 'sql') {
      combinedStaticText += term.text ?? '';
      hasAnySqlLike ||= true;
    } else if (term.kind === 'fragment') {
      if (!hasAnySqlLike) dynamicBeforeSql = true;
      const marker = `/*__LSP_SQL_SLOT_${templateSlots.length}__*/`;
      if (term.exprRange) templateSlots.push({ marker, exprRange: term.exprRange });
      combinedStaticText += ` ${marker} `;
      hasFragment = true;
      hasAnySqlLike = true;
    } else {
      if (!hasAnySqlLike) dynamicBeforeSql = true;
      const marker = `/*__LSP_SQL_SLOT_${templateSlots.length}__*/`;
      if (term.exprRange) templateSlots.push({ marker, exprRange: term.exprRange });
      combinedStaticText += ` ${marker} `;
      hasDynamic = true;
    }
  }

  return {
    literalRanges,
    prefersContinuationLayout,
    continuationIndent,
    combinedStaticText,
    hasDynamic,
    hasFragment,
    hasAnySqlLike,
    dynamicBeforeSql,
    templateSlots
  };
}

function buildClassification(input: {
  status: VariableSqlClassification['status'];
  sourceKind: EmbeddedSqlSourceKind;
  reason: EmbeddedSqlAttemptReason;
  literalRanges: Range[];
  prefersContinuationLayout: boolean;
  continuationIndent: string | null;
  rawSql?: string;
  replaceExpression?: ExpressionNode;
  templateSlots?: EmbeddedSqlTemplateSlot[];
  eligible?: boolean;
  standaloneEligible?: boolean;
  eligibleByPragma?: boolean;
  pragmaKind?: SqlPragmaKind;
}): VariableSqlClassification
{
  return {
    status: input.status,
    sourceKind: input.sourceKind,
    reason: input.reason,
    literalRanges: input.literalRanges,
    prefersContinuationLayout: input.prefersContinuationLayout,
    continuationIndent: input.continuationIndent,
    eligible: input.eligible ?? false,
    standaloneEligible: input.standaloneEligible ?? false,
    ...(input.rawSql !== undefined ? { rawSql: input.rawSql } : {}),
    ...(input.replaceExpression !== undefined ? { replaceExpression: input.replaceExpression } : {}),
    ...(input.templateSlots !== undefined ? { templateSlots: input.templateSlots } : {}),
    ...(input.eligibleByPragma !== undefined ? { eligibleByPragma: input.eligibleByPragma } : {}),
    ...(input.pragmaKind !== undefined ? { pragmaKind: input.pragmaKind } : {})
  };
}

function classifyVariableSqlExpression(
  expr: ExpressionNode | null,
  stateByIdentifier: Map<string, VariableSqlClassification>,
  pragmaKind?: SqlPragmaKind
): VariableSqlClassification
{
  const extracted = extractSqlStringExpression(expr);
  const current = unwrapParen(expr);
  if (!current) return withOptionalPragma(buildClassification({
    status: 'sql_unknown',
    sourceKind: 'unsupported_dynamic',
    reason: 'rejected_ambiguous_sequence',
    literalRanges: [],
    prefersContinuationLayout: false,
    continuationIndent: null
  }), pragmaKind);

  if (extracted)
  {
    if (pragmaKind === 'fragmento') {
      return buildClassification({
        status: 'sql_fragment',
        sourceKind: 'variable_pragma_fragmento',
        reason: 'pragma_fragmento',
        literalRanges: extracted.pieces.map((piece) => piece.literal.range),
        prefersContinuationLayout: extracted.prefersContinuationLayout,
        continuationIndent: extracted.continuationIndent,
        rawSql: extracted.decodedText,
        replaceExpression: current,
        eligibleByPragma: true,
        pragmaKind
      });
    }
    if (!isEligibleEmbeddedSqlText(extracted.decodedText)) {
      return withOptionalPragma(buildClassification({
        status: 'not_sql',
        sourceKind: extracted.sourceKind === 'literal' ? 'variable_static' : 'variable_concat_literals',
        reason: 'rejected_not_sql',
        literalRanges: extracted.pieces.map((piece) => piece.literal.range),
        prefersContinuationLayout: extracted.prefersContinuationLayout,
        continuationIndent: extracted.continuationIndent
      }), pragmaKind);
    }
    return withOptionalPragma(buildClassification({
      status: extracted.sourceKind === 'literal' ? 'sql_direct_literal' : 'sql_concat_literals',
      sourceKind: extracted.sourceKind === 'literal' ? 'variable_static' : 'variable_concat_literals',
      reason: extracted.sourceKind === 'literal' ? 'static_single_literal' : 'static_concatenated_literals',
      rawSql: extracted.decodedText,
      replaceExpression: current,
      literalRanges: extracted.pieces.map((piece) => piece.literal.range),
      prefersContinuationLayout: extracted.prefersContinuationLayout,
      continuationIndent: extracted.continuationIndent,
      eligible: true,
      standaloneEligible: true
    }), pragmaKind);
  }

  if (current.kind === 'Identifier')
  {
    const existing = stateByIdentifier.get(current.nameNormalized);
    if (existing) return existing;
    return withOptionalPragma(buildClassification({
      status: 'sql_unknown',
      sourceKind: 'unsupported_dynamic',
      reason: 'rejected_ambiguous_sequence',
      literalRanges: [],
      prefersContinuationLayout: false,
      continuationIndent: null
    }), pragmaKind);
  }

  if (current.kind === 'Binary' && current.operator === '+') {
    const summary = summarizeTerms(flattenConcatTerms(current, stateByIdentifier));
    if (!summary.hasAnySqlLike) {
      return withOptionalPragma(buildClassification({
        status: 'sql_unknown',
        sourceKind: 'unsupported_dynamic',
        reason: 'rejected_ambiguous_sequence',
        literalRanges: summary.literalRanges,
        prefersContinuationLayout: summary.prefersContinuationLayout,
        continuationIndent: summary.continuationIndent
      }), pragmaKind);
    }
    if (pragmaKind === 'consulta' && !summary.dynamicBeforeSql && isEligibleEmbeddedSqlTemplate(summary.combinedStaticText)) {
      return buildClassification({
        status: 'sql_mixed_dynamic',
        sourceKind: 'variable_pragma_consulta',
        reason: 'pragma_consulta',
        literalRanges: summary.literalRanges,
        prefersContinuationLayout: summary.prefersContinuationLayout,
        continuationIndent: summary.continuationIndent,
        rawSql: summary.combinedStaticText,
        replaceExpression: current,
        templateSlots: summary.templateSlots,
        eligible: true,
        standaloneEligible: true,
        eligibleByPragma: true,
        pragmaKind
      });
    }
    if (pragmaKind === 'fragmento') {
      return buildClassification({
        status: 'sql_fragment',
        sourceKind: 'variable_pragma_fragmento',
        reason: 'pragma_fragmento',
        literalRanges: summary.literalRanges,
        prefersContinuationLayout: summary.prefersContinuationLayout,
        continuationIndent: summary.continuationIndent,
        rawSql: summary.combinedStaticText,
        replaceExpression: current,
        templateSlots: summary.templateSlots,
        eligible: true,
        standaloneEligible: false,
        eligibleByPragma: true,
        pragmaKind
      });
    }
    if (!summary.dynamicBeforeSql && isEligibleEmbeddedSqlTemplate(summary.combinedStaticText)) {
      return withOptionalPragma(buildClassification({
        status: 'sql_mixed_dynamic',
        sourceKind: 'variable_prefixed_dynamic_fragment',
        reason: 'controlled_hybrid_concat',
        literalRanges: summary.literalRanges,
        prefersContinuationLayout: summary.prefersContinuationLayout,
        continuationIndent: summary.continuationIndent,
        rawSql: summary.combinedStaticText,
        replaceExpression: current,
        templateSlots: summary.templateSlots,
        eligible: true,
        standaloneEligible: true
      }), pragmaKind);
    }
    if (!summary.dynamicBeforeSql && isEligibleEmbeddedSqlFragmentText(summary.combinedStaticText)) {
      return withOptionalPragma(buildClassification({
        status: 'sql_fragment',
        sourceKind: 'variable_prefixed_dynamic_fragment',
        reason: 'controlled_hybrid_concat',
        literalRanges: summary.literalRanges,
        prefersContinuationLayout: summary.prefersContinuationLayout,
        continuationIndent: summary.continuationIndent,
        rawSql: summary.combinedStaticText,
        replaceExpression: current,
        templateSlots: summary.templateSlots,
        eligible: true,
        standaloneEligible: false
      }), pragmaKind);
    }
  }

  if (current.kind === 'Binary' && current.operator === '+')
  {
    return withOptionalPragma(buildClassification({
      status: 'sql_mixed_dynamic',
      sourceKind: 'variable_mixed_dynamic',
      reason: 'rejected_dynamic_concat',
      literalRanges: [],
      prefersContinuationLayout: false,
      continuationIndent: null
    }), pragmaKind);
  }

  return withOptionalPragma(buildClassification({
    status: 'sql_unknown',
    sourceKind: 'unsupported_dynamic',
    reason: 'rejected_ambiguous_sequence',
    literalRanges: [],
    prefersContinuationLayout: false,
    continuationIndent: null
  }), pragmaKind);
}

function addRewriteTarget(
  targets: Map<string, EmbeddedSqlRewriteTarget>,
  target: EmbeddedSqlRewriteTarget
): void
{
  const key = `${target.range.start.line}:${target.range.start.character}:${target.range.end.line}:${target.range.end.character}`;
  if (!targets.has(key)) targets.set(key, target);
}

function addAnalysis(
  analyses: Map<string, EmbeddedSqlAnalysis>,
  analysis: EmbeddedSqlAnalysis
): void
{
  const key = `${analysis.range.start.line}:${analysis.range.start.character}:${analysis.range.end.line}:${analysis.range.end.character}:${analysis.wrapperKind}:${analysis.sourceKind}:${analysis.reason}`;
  if (!analyses.has(key)) analyses.set(key, analysis);
}

function addHighlightTarget(
  targets: Map<string, EmbeddedSqlHighlightTarget>,
  analysis: EmbeddedSqlAnalysis
): void
{
  if (!analysis.eligible) return;
  for (const range of analysis.literalRanges)
  {
    const key = `${range.start.line}:${range.start.character}:${range.end.line}:${range.end.character}:${analysis.wrapperKind}:${analysis.sourceKind}`;
    if (!targets.has(key)) {
      targets.set(key, {
        range,
        wrapperKind: analysis.wrapperKind,
        sourceKind: analysis.sourceKind,
        literalRanges: [range]
      });
    }
  }
}

function analyzeDirectSqlExpression(expr: ExpressionNode | null, ownerName: string): EmbeddedSqlAnalysis
{
  const current = unwrapParen(expr);
  const wrapperKind = classifyWrapperKind(ownerName);
  if (!current) {
    return {
      range: expr?.range ?? {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 }
      },
      wrapperKind,
      sourceKind: 'unsupported_dynamic',
      eligible: false,
      reason: 'rejected_ambiguous_sequence',
      literalRanges: [],
      prefersContinuationLayout: false,
      continuationIndent: null
    };
  }
  const staticString = reconstructStaticString(current);
  if (!staticString) {
    if (current.kind === 'Binary' && current.operator === '+') {
      const summary = summarizeTerms(flattenConcatTerms(current, new Map<string, VariableSqlClassification>()));
      if (summary.hasAnySqlLike && !summary.dynamicBeforeSql && isEligibleEmbeddedSqlTemplate(summary.combinedStaticText)) {
        return {
          range: current.range,
          rawSql: summary.combinedStaticText,
          wrapperKind,
          sourceKind: 'direct_mixed_dynamic',
          eligible: true,
          reason: 'controlled_hybrid_concat',
          literalRanges: summary.literalRanges,
          prefersContinuationLayout: summary.prefersContinuationLayout,
          continuationIndent: summary.continuationIndent,
          templateSlots: summary.templateSlots
        };
      }
    }
    return {
      range: current.range,
      wrapperKind,
      sourceKind: current.kind === 'Binary' && current.operator === '+' ? 'variable_mixed_dynamic' : 'unsupported_dynamic',
      eligible: false,
      reason: current.kind === 'Binary' && current.operator === '+' ? 'rejected_dynamic_concat' : 'rejected_ambiguous_sequence',
      literalRanges: [],
      prefersContinuationLayout: false,
      continuationIndent: null
    };
  }
  if (!isEligibleEmbeddedSqlText(staticString.rawText)) {
    return {
      range: current.range,
      rawSql: staticString.rawText,
      wrapperKind,
      sourceKind: staticString.sourceKind === 'literal' ? 'direct_literal' : 'direct_concat_literals',
      eligible: false,
      reason: 'rejected_not_sql',
      literalRanges: staticString.literalRanges,
      prefersContinuationLayout: staticString.prefersContinuationLayout,
      continuationIndent: staticString.continuationIndent
    };
  }
  return {
    range: current.range,
    rawSql: staticString.rawText,
    wrapperKind,
    sourceKind: staticString.sourceKind === 'literal' ? 'direct_literal' : 'direct_concat_literals',
    eligible: true,
    reason: staticString.sourceKind === 'literal' ? 'static_single_literal' : 'static_concatenated_literals',
    literalRanges: staticString.literalRanges,
    prefersContinuationLayout: staticString.prefersContinuationLayout,
    continuationIndent: staticString.continuationIndent
  };
}

function analyzeVariableSqlExpression(
  identifier: IdentifierNode,
  ownerName: string,
  stateByIdentifier: Map<string, VariableSqlClassification>
): EmbeddedSqlAnalysis
{
  const wrapperKind = classifyWrapperKind(ownerName);
  const classification = stateByIdentifier.get(identifier.nameNormalized);
  if (!classification) {
    return {
      range: identifier.range,
      wrapperKind,
      sourceKind: 'unsupported_dynamic',
      eligible: false,
      reason: 'rejected_ambiguous_sequence',
      literalRanges: [],
      prefersContinuationLayout: false,
      continuationIndent: null
    };
  }
  if ((classification.status === 'sql_direct_literal' || classification.status === 'sql_concat_literals' || classification.status === 'sql_mixed_dynamic')
    && classification.eligible
    && classification.rawSql
    && classification.replaceExpression) {
    return {
      range: classification.replaceExpression.range,
      rawSql: classification.rawSql,
      wrapperKind,
      sourceKind: classification.sourceKind,
      eligible: true,
      reason: classification.reason,
      literalRanges: classification.literalRanges,
      prefersContinuationLayout: classification.prefersContinuationLayout,
      continuationIndent: classification.continuationIndent,
      ...(classification.templateSlots !== undefined ? { templateSlots: classification.templateSlots } : {})
    };
  }
  if (classification.status === 'sql_fragment') {
    return {
      range: identifier.range,
      wrapperKind,
      sourceKind: classification.sourceKind,
      eligible: false,
      reason: classification.reason,
      literalRanges: classification.literalRanges,
      prefersContinuationLayout: classification.prefersContinuationLayout,
      continuationIndent: classification.continuationIndent
    };
  }
  return {
    range: identifier.range,
    wrapperKind,
    sourceKind: classification.sourceKind ?? 'unsupported_dynamic',
    eligible: false,
    reason: classification.reason ?? 'rejected_ambiguous_sequence',
    literalRanges: classification.literalRanges,
    prefersContinuationLayout: classification.prefersContinuationLayout,
    continuationIndent: classification.continuationIndent
  };
}

function getAuthorizedCallSqlExpression(node: CallNode): { expression: ExpressionNode; ownerName: string } | null
{
  if (node.callee.kind !== 'Identifier') return null;
  const argIndex = AUTHORIZED_CALL_ARGUMENTS.get(node.callee.nameNormalized);
  if (argIndex === undefined) return null;
  const arg = node.args[argIndex];
  if (!arg) return null;
  return {
    expression: arg,
    ownerName: node.callee.name
  };
}

function collectAuthorizedVariableConsumersFromStatement(
  stmt: StatementNode | null,
  target: Map<string, EmbeddedSqlWrapperKind[]>
): void
{
  if (!stmt) return;

  if (
    stmt.kind === 'Assignment'
    && stmt.isCursorSqlShorthand === true
    && stmt.target.kind === 'Member'
    && stmt.target.property.nameNormalized === 'sql'
    && unwrapParen(stmt.value)?.kind === 'Identifier'
  ) {
    const identifier = unwrapParen(stmt.value) as IdentifierNode;
    const list = target.get(identifier.nameNormalized) ?? [];
    list.push('cursor_sql');
    target.set(identifier.nameNormalized, list);
  }

  if (stmt.kind === 'ExprStmt' && stmt.expr.kind === 'Call') {
    const sql = getAuthorizedCallSqlExpression(stmt.expr);
    const current = unwrapParen(sql?.expression ?? null);
    if (sql && current?.kind === 'Identifier') {
      const list = target.get(current.nameNormalized) ?? [];
      list.push(classifyWrapperKind(sql.ownerName));
      target.set(current.nameNormalized, list);
    }
  }

  switch (stmt.kind)
  {
    case 'Block':
      for (const child of stmt.statements) collectAuthorizedVariableConsumersFromStatement(child, target);
      break;
    case 'If':
      collectAuthorizedVariableConsumersFromStatement(stmt.thenBranch, target);
      collectAuthorizedVariableConsumersFromStatement(stmt.elseBranch, target);
      break;
    case 'While':
      collectAuthorizedVariableConsumersFromStatement(stmt.body, target);
      break;
    case 'For':
      collectAuthorizedVariableConsumersFromStatement(stmt.init, target);
      collectAuthorizedVariableConsumersFromStatement(stmt.body, target);
      break;
    case 'FuncImpl':
      if (stmt.body) {
        for (const child of stmt.body.statements) collectAuthorizedVariableConsumersFromStatement(child, target);
      }
      break;
    default:
      break;
  }
}

function collectAuthorizedVariableConsumers(file: FileNode): Map<string, EmbeddedSqlWrapperKind[]>
{
  const result = new Map<string, EmbeddedSqlWrapperKind[]>();
  for (const stmt of file.statements) collectAuthorizedVariableConsumersFromStatement(stmt, result);
  const dependencies = collectVariableDependencies(file);
  const queue: string[] = [...result.keys()];
  const seen = new Set<string>();

  while (queue.length > 0)
  {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    const wrappers = result.get(current);
    if (!wrappers?.length) continue;
    const refs = dependencies.get(current);
    if (!refs?.size) continue;
    for (const ref of refs)
    {
      const existing = result.get(ref) ?? [];
      let changed = false;
      for (const wrapper of wrappers)
      {
        if (!existing.includes(wrapper)) {
          existing.push(wrapper);
          changed = true;
        }
      }
      if (changed) {
        result.set(ref, existing);
        queue.push(ref);
      }
    }
  }

  return result;
}

function collectIdentifiersFromExpression(
  expr: ExpressionNode | null,
  out: Set<string>
): void
{
  const current = unwrapParen(expr);
  if (!current) return;

  switch (current.kind)
  {
    case 'Identifier':
      out.add(current.nameNormalized);
      break;
    case 'Binary':
      collectIdentifiersFromExpression(current.left, out);
      collectIdentifiersFromExpression(current.right, out);
      break;
    case 'Unary':
      collectIdentifiersFromExpression(current.operand, out);
      break;
    case 'Call':
      if (current.callee.kind === 'Identifier') out.add(current.callee.nameNormalized);
      for (const arg of current.args) collectIdentifiersFromExpression(arg, out);
      break;
    case 'Member':
      collectIdentifiersFromExpression(current.object, out);
      break;
    case 'Paren':
      collectIdentifiersFromExpression(current.expr, out);
      break;
    default:
      break;
  }
}

function collectVariableDependenciesFromStatement(
  stmt: StatementNode | null,
  target: Map<string, Set<string>>
): void
{
  if (!stmt) return;

  if (stmt.kind === 'Assignment' && stmt.target.kind === 'Identifier') {
    const refs = new Set<string>();
    collectIdentifiersFromExpression(stmt.value, refs);
    const existing = target.get(stmt.target.nameNormalized);
    if (existing) {
      for (const ref of refs) existing.add(ref);
    } else {
      target.set(stmt.target.nameNormalized, refs);
    }
  } else if (
    stmt.kind === 'ExprStmt'
    && stmt.expr.kind === 'Binary'
    && stmt.expr.operator === '='
    && stmt.expr.left.kind === 'Identifier'
  ) {
    const refs = new Set<string>();
    collectIdentifiersFromExpression(stmt.expr.right, refs);
    const existing = target.get(stmt.expr.left.nameNormalized);
    if (existing) {
      for (const ref of refs) existing.add(ref);
    } else {
      target.set(stmt.expr.left.nameNormalized, refs);
    }
  }

  switch (stmt.kind)
  {
    case 'Block':
      for (const child of stmt.statements) collectVariableDependenciesFromStatement(child, target);
      break;
    case 'If':
      collectVariableDependenciesFromStatement(stmt.thenBranch, target);
      collectVariableDependenciesFromStatement(stmt.elseBranch, target);
      break;
    case 'While':
      collectVariableDependenciesFromStatement(stmt.body, target);
      break;
    case 'For':
      collectVariableDependenciesFromStatement(stmt.init, target);
      collectVariableDependenciesFromStatement(stmt.body, target);
      break;
    case 'FuncImpl':
      if (stmt.body) {
        for (const child of stmt.body.statements) collectVariableDependenciesFromStatement(child, target);
      }
      break;
    default:
      break;
  }
}

function collectVariableDependencies(file: FileNode): Map<string, Set<string>>
{
  const result = new Map<string, Set<string>>();
  for (const stmt of file.statements) collectVariableDependenciesFromStatement(stmt, result);
  return result;
}

function addVariableAssignmentArtifacts(
  classification: VariableSqlClassification,
  ownerName: string,
  targets: Map<string, EmbeddedSqlRewriteTarget>,
  highlightTargets: Map<string, EmbeddedSqlHighlightTarget>
): void
{
  if (!classification.eligible || !classification.rawSql || !classification.replaceExpression) return;
  const wrapperKind = classifyWrapperKind(ownerName);
  if (classification.standaloneEligible) {
    addRewriteTarget(targets, {
      range: classification.replaceExpression.range,
      rawSql: classification.rawSql,
      wrapperKind,
      sourceKind: classification.sourceKind,
      successReason: classification.reason,
      literalRanges: classification.literalRanges,
      prefersContinuationLayout: classification.prefersContinuationLayout,
      continuationIndent: classification.continuationIndent,
      ...(classification.templateSlots ? { templateSlots: classification.templateSlots } : {})
    });
  }
  addHighlightTarget(highlightTargets, {
    range: classification.replaceExpression.range,
    wrapperKind,
    sourceKind: classification.sourceKind,
    eligible: true,
    reason: classification.reason,
    literalRanges: classification.literalRanges,
    prefersContinuationLayout: classification.prefersContinuationLayout,
    continuationIndent: classification.continuationIndent
  });
}

function mergeVariableState(
  target: Map<string, VariableSqlClassification>,
  source: Map<string, VariableSqlClassification>
): void
{
  for (const [name, classification] of source)
  {
    if (classification.eligible || classification.status === 'sql_fragment') {
      target.set(name, classification);
    }
  }
}

function collectRewriteTargetsFromNestedStatement(
  stmt: StatementNode | null,
  targets: Map<string, EmbeddedSqlRewriteTarget>,
  analyses: Map<string, EmbeddedSqlAnalysis>,
  highlightTargets: Map<string, EmbeddedSqlHighlightTarget>,
  pragmaByIdentifier: Map<string, SqlPragmaKind>,
  authorizedVariableConsumers: Map<string, EmbeddedSqlWrapperKind[]>,
  stateByIdentifier: Map<string, VariableSqlClassification>
): void
{
  if (!stmt) return;

  switch (stmt.kind)
  {
    case 'Block':
      collectEmbeddedSqlRewriteTargetsFromStatements(
        stmt.statements,
        targets,
        analyses,
        highlightTargets,
        pragmaByIdentifier,
        authorizedVariableConsumers,
        new Map(stateByIdentifier)
      );
      return;
    case 'If':
      collectRewriteTargetsFromNestedStatement(stmt.thenBranch, targets, analyses, highlightTargets, pragmaByIdentifier, authorizedVariableConsumers, new Map(stateByIdentifier));
      collectRewriteTargetsFromNestedStatement(stmt.elseBranch, targets, analyses, highlightTargets, pragmaByIdentifier, authorizedVariableConsumers, new Map(stateByIdentifier));
      return;
    case 'While':
    {
      const loopState = new Map(stateByIdentifier);
      if (stmt.body?.kind === 'Block') {
        collectEmbeddedSqlRewriteTargetsFromStatements(
          stmt.body.statements,
          targets,
          analyses,
          highlightTargets,
          pragmaByIdentifier,
          authorizedVariableConsumers,
          loopState
        );
      } else {
        collectRewriteTargetsFromNestedStatement(stmt.body, targets, analyses, highlightTargets, pragmaByIdentifier, authorizedVariableConsumers, loopState);
      }
      mergeVariableState(stateByIdentifier, loopState);
      return;
    }
    case 'For':
    {
      const loopState = new Map(stateByIdentifier);
      if (stmt.init) {
        collectEmbeddedSqlRewriteTargetsFromStatements(
          [stmt.init],
          targets,
          analyses,
          highlightTargets,
          pragmaByIdentifier,
          authorizedVariableConsumers,
          loopState
        );
      }
      if (stmt.body?.kind === 'Block') {
        collectEmbeddedSqlRewriteTargetsFromStatements(
          stmt.body.statements,
          targets,
          analyses,
          highlightTargets,
          pragmaByIdentifier,
          authorizedVariableConsumers,
          loopState
        );
      } else {
        collectRewriteTargetsFromNestedStatement(stmt.body, targets, analyses, highlightTargets, pragmaByIdentifier, authorizedVariableConsumers, loopState);
      }
      mergeVariableState(stateByIdentifier, loopState);
      return;
    }
    case 'FuncImpl':
      if (stmt.body) {
        collectEmbeddedSqlRewriteTargetsFromStatements(
          stmt.body.statements,
          targets,
          analyses,
          highlightTargets,
          pragmaByIdentifier,
          authorizedVariableConsumers,
          new Map(stateByIdentifier)
        );
      }
      return;
    default:
      return;
  }
}

function collectEmbeddedSqlRewriteTargetsFromStatements(
  statements: StatementNode[],
  targets: Map<string, EmbeddedSqlRewriteTarget>,
  analyses: Map<string, EmbeddedSqlAnalysis>,
  highlightTargets: Map<string, EmbeddedSqlHighlightTarget>,
  pragmaByIdentifier: Map<string, SqlPragmaKind>,
  authorizedVariableConsumers: Map<string, EmbeddedSqlWrapperKind[]>,
  stateByIdentifier = new Map<string, VariableSqlClassification>()
): void
{
  for (const stmt of statements)
  {
    if (stmt.kind === 'ExecSql' && stmt.sql)
    {
      const analysis = analyzeDirectSqlExpression(stmt.sql, 'ExecSql');
      addAnalysis(analyses, analysis);
      if (analysis.eligible && analysis.rawSql) {
        addRewriteTarget(targets, {
          range: analysis.range,
          rawSql: analysis.rawSql,
          wrapperKind: analysis.wrapperKind,
          sourceKind: analysis.sourceKind,
          successReason: analysis.reason,
          literalRanges: analysis.literalRanges,
          prefersContinuationLayout: analysis.prefersContinuationLayout,
          continuationIndent: analysis.continuationIndent
        });
      }
      addHighlightTarget(highlightTargets, analysis);
    }

    if (
      stmt.kind === 'Assignment'
      && stmt.isCursorSqlShorthand === true
      && stmt.target.kind === 'Member'
      && stmt.target.property.nameNormalized === 'sql'
      && stmt.value
    ) {
      const current = unwrapParen(stmt.value);
      if (current?.kind === 'Identifier') {
        const variableAnalysis = analyzeVariableSqlExpression(current, 'Cursor.SQL', stateByIdentifier);
        addAnalysis(analyses, variableAnalysis);
        if (variableAnalysis.eligible && variableAnalysis.rawSql) {
          const templateSlots = stateByIdentifier.get(current.nameNormalized)?.templateSlots;
          addRewriteTarget(targets, {
            range: variableAnalysis.range,
            rawSql: variableAnalysis.rawSql,
            wrapperKind: variableAnalysis.wrapperKind,
            sourceKind: variableAnalysis.sourceKind,
            successReason: variableAnalysis.reason,
            literalRanges: variableAnalysis.literalRanges,
            prefersContinuationLayout: variableAnalysis.prefersContinuationLayout,
            continuationIndent: variableAnalysis.continuationIndent,
            ...(templateSlots ? { templateSlots } : {})
          });
        }
        addHighlightTarget(highlightTargets, variableAnalysis);
      } else {
        const direct = analyzeDirectSqlExpression(stmt.value, 'Cursor.SQL');
        addAnalysis(analyses, direct);
        if (direct.eligible && direct.rawSql) {
          const templateSlots = current && current.kind === 'Binary' && current.operator === '+'
            ? summarizeTerms(flattenConcatTerms(current, stateByIdentifier)).templateSlots
            : undefined;
          addRewriteTarget(targets, {
            range: direct.range,
            rawSql: direct.rawSql,
            wrapperKind: direct.wrapperKind,
            sourceKind: direct.sourceKind,
            successReason: direct.reason,
            literalRanges: direct.literalRanges,
            prefersContinuationLayout: direct.prefersContinuationLayout,
            continuationIndent: direct.continuationIndent,
            ...(templateSlots ? { templateSlots } : {})
          });
        }
        addHighlightTarget(highlightTargets, direct);
      }
    }

    if (stmt.kind === 'ExprStmt' && stmt.expr.kind === 'Call')
    {
      const callSql = getAuthorizedCallSqlExpression(stmt.expr);
      if (callSql)
      {
        const current = unwrapParen(callSql.expression);
        if (current?.kind === 'Identifier') {
          const variableAnalysis = analyzeVariableSqlExpression(current, callSql.ownerName, stateByIdentifier);
          addAnalysis(analyses, variableAnalysis);
          if (variableAnalysis.eligible && variableAnalysis.rawSql) {
            const templateSlots = stateByIdentifier.get(current.nameNormalized)?.templateSlots;
            addRewriteTarget(targets, {
              range: variableAnalysis.range,
              rawSql: variableAnalysis.rawSql,
              wrapperKind: variableAnalysis.wrapperKind,
              sourceKind: variableAnalysis.sourceKind,
              successReason: variableAnalysis.reason,
              literalRanges: variableAnalysis.literalRanges,
              prefersContinuationLayout: variableAnalysis.prefersContinuationLayout,
              continuationIndent: variableAnalysis.continuationIndent,
              ...(templateSlots ? { templateSlots } : {})
            });
          }
          addHighlightTarget(highlightTargets, variableAnalysis);
        } else {
          const direct = analyzeDirectSqlExpression(callSql.expression, callSql.ownerName);
          addAnalysis(analyses, direct);
          if (direct.eligible && direct.rawSql) {
            const templateSlots = current && current.kind === 'Binary' && current.operator === '+'
              ? summarizeTerms(flattenConcatTerms(current, stateByIdentifier)).templateSlots
              : undefined;
            addRewriteTarget(targets, {
              range: direct.range,
              rawSql: direct.rawSql,
              wrapperKind: direct.wrapperKind,
              sourceKind: direct.sourceKind,
              successReason: direct.reason,
              literalRanges: direct.literalRanges,
              prefersContinuationLayout: direct.prefersContinuationLayout,
              continuationIndent: direct.continuationIndent,
              ...(templateSlots ? { templateSlots } : {})
            });
          }
          addHighlightTarget(highlightTargets, direct);
        }
      }
    }

    if (stmt.kind === 'Assignment' && stmt.target.kind === 'Identifier')
    {
      const classification = classifyVariableSqlExpression(stmt.value, stateByIdentifier, pragmaByIdentifier.get(stmt.target.nameNormalized));
      stateByIdentifier.set(stmt.target.nameNormalized, classification);
      const consumers = authorizedVariableConsumers.get(stmt.target.nameNormalized);
      if (consumers?.[0]) addVariableAssignmentArtifacts(classification, consumers[0], targets, highlightTargets);
    }
    else if (
      stmt.kind === 'ExprStmt'
      && stmt.expr.kind === 'Binary'
      && stmt.expr.operator === '='
      && stmt.expr.left.kind === 'Identifier'
    ) {
      const classification = classifyVariableSqlExpression(stmt.expr.right, stateByIdentifier, pragmaByIdentifier.get(stmt.expr.left.nameNormalized));
      stateByIdentifier.set(stmt.expr.left.nameNormalized, classification);
      const consumers = authorizedVariableConsumers.get(stmt.expr.left.nameNormalized);
      if (consumers?.[0]) addVariableAssignmentArtifacts(classification, consumers[0], targets, highlightTargets);
    }

    collectRewriteTargetsFromNestedStatement(
      stmt,
      targets,
      analyses,
      highlightTargets,
      pragmaByIdentifier,
      authorizedVariableConsumers,
      stateByIdentifier
    );
  }
}

export function collectEmbeddedSqlRewriteTargets(file: FileNode): EmbeddedSqlRewriteTarget[]
{
  const targets = new Map<string, EmbeddedSqlRewriteTarget>();
  const analyses = new Map<string, EmbeddedSqlAnalysis>();
  const highlightTargets = new Map<string, EmbeddedSqlHighlightTarget>();
  const pragmaByIdentifier = collectSqlPragmas(file);
  const authorizedVariableConsumers = collectAuthorizedVariableConsumers(file);
  collectEmbeddedSqlRewriteTargetsFromStatements(file.statements, targets, analyses, highlightTargets, pragmaByIdentifier, authorizedVariableConsumers);
  return [...targets.values()];
}

export function collectEmbeddedSqlAnalyses(file: FileNode): EmbeddedSqlAnalysis[]
{
  const targets = new Map<string, EmbeddedSqlRewriteTarget>();
  const analyses = new Map<string, EmbeddedSqlAnalysis>();
  const highlightTargets = new Map<string, EmbeddedSqlHighlightTarget>();
  const pragmaByIdentifier = collectSqlPragmas(file);
  const authorizedVariableConsumers = collectAuthorizedVariableConsumers(file);
  collectEmbeddedSqlRewriteTargetsFromStatements(file.statements, targets, analyses, highlightTargets, pragmaByIdentifier, authorizedVariableConsumers);
  return [...analyses.values()];
}

export function collectEmbeddedSqlHighlightTargets(file: FileNode): EmbeddedSqlHighlightTarget[]
{
  const targets = new Map<string, EmbeddedSqlRewriteTarget>();
  const analyses = new Map<string, EmbeddedSqlAnalysis>();
  const highlightTargets = new Map<string, EmbeddedSqlHighlightTarget>();
  const pragmaByIdentifier = collectSqlPragmas(file);
  const authorizedVariableConsumers = collectAuthorizedVariableConsumers(file);
  collectEmbeddedSqlRewriteTargetsFromStatements(file.statements, targets, analyses, highlightTargets, pragmaByIdentifier, authorizedVariableConsumers);
  return [...highlightTargets.values()];
}

export function getAuthorizedCallSqlLiteral(node: CallNode): { literal: StringLiteralNode; ownerName: string } | null
{
  const sql = getAuthorizedCallSqlExpression(node);
  if (!sql) return null;
  const current = sql.expression?.kind === 'Paren' ? sql.expression.expr : sql.expression;
  if (!current || current.kind !== 'StringLiteral') return null;
  return {
    literal: current,
    ownerName: sql.ownerName
  };
}

export function isEligibleEmbeddedSqlText(raw: string): boolean
{
  const trimmed = raw.trim();
  if (!trimmed) return false;

  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, '').trim();
  if (!withoutTrailingSemicolon) return false;
  if (withoutTrailingSemicolon.includes(';')) return false;

  const keywordMatch = /^([A-Za-z_]+)/.exec(withoutTrailingSemicolon);
  if (!keywordMatch?.[1]) return false;
  return ALLOWED_SQL_ROOT_KEYWORDS.has(casefold(keywordMatch[1]));
}

function stripTemplateSlots(raw: string): string
{
  return raw.replace(/\/\*__LSP_SQL_SLOT_\d+__\*\//g, ' ');
}

function isEligibleEmbeddedSqlTemplate(raw: string): boolean
{
  return isEligibleEmbeddedSqlText(stripTemplateSlots(raw));
}

function isEligibleEmbeddedSqlFragmentText(raw: string): boolean
{
  const trimmed = stripTemplateSlots(raw).trim();
  if (!trimmed) return false;
  const keywordMatch = /^([A-Za-z_]+)/.exec(trimmed);
  if (!keywordMatch?.[1]) return false;
  const keyword = casefold(keywordMatch[1]);
  return keyword === 'and' || keyword === 'or';
}

export function collectEmbeddedSqlDebugReport(_file: FileNode): EmbeddedSqlDebugReport
{
  return { events: [], eventCount: 0 };
}
