export type EmbeddedSqlDialect = 'sql' | 'oracle' | 'sqlserver';

export type EmbeddedSqlWrapperKind = 'cursor_sql' | 'execsql' | 'execsqlex' | 'sql_definircomando';
export type EmbeddedSqlSourceKind =
  | 'direct_literal'
  | 'direct_concat_literals'
  | 'direct_mixed_dynamic'
  | 'variable_static'
  | 'variable_concat_literals'
  | 'variable_mixed_dynamic'
  | 'variable_prefixed_dynamic_fragment'
  | 'variable_pragma_consulta'
  | 'variable_pragma_fragmento'
  | 'unsupported_dynamic';
export type EmbeddedSqlAttemptDecision = 'disabled' | 'applied' | 'no_op_already_canonical' | 'formatter_error' | 'rejected';
export type EmbeddedSqlAttemptReason =
  | 'feature_disabled'
  | 'static_single_literal'
  | 'static_concatenated_literals'
  | 'no_op_already_canonical'
  | 'formatter_error'
  | 'rejected_dynamic_concat'
  | 'rejected_ambiguous_sequence'
  | 'rejected_not_sql'
  | 'controlled_hybrid_concat'
  | 'pragma_consulta'
  | 'pragma_fragmento';


export type EmbeddedSqlDebugEvent = {
  decision: string;
  variableName?: string;
  sourcePath?: string;
  [key: string]: unknown;
};

export type EmbeddedSqlDebugReport = {
  events: EmbeddedSqlDebugEvent[];
  eventCount: number;
};

export type EmbeddedSqlFormatAttempt = {
  wrapperKind: EmbeddedSqlWrapperKind;
  sourceKind: EmbeddedSqlSourceKind;
  decision: EmbeddedSqlAttemptDecision;
  reason: EmbeddedSqlAttemptReason;
};

export type EmbeddedSqlFormatReport = {
  enabled: boolean;
  debug: EmbeddedSqlDebugReport;
  attempts: EmbeddedSqlFormatAttempt[];
  attemptedCount: number;
  eligibleCount: number;
  appliedCount: number;
  noOpCount: number;
  rejectedCount: number;
  errorCount: number;
};

export type FormatDocumentReport = {
  embeddedSql: EmbeddedSqlFormatReport;
};

export type FormatOptions = {
  indentSize: number;
  useTabs: boolean;
  maxParamsPerLine: number;
  embeddedSqlEnabled?: boolean;
  embeddedSqlDialect?: EmbeddedSqlDialect;
};
