export const DiagnosticCodes = {
  SyntaxError: 'LSP0001',
  LexicalInvalidToken: 'LSP0002',
  LexicalUnclosedBlockComment: 'LSP0003',
  LexicalUnclosedString: 'LSP0004',
  SyntaxUnclosedParen: 'LSP0005',
  SyntaxUnclosedBracket: 'LSP0006',
  SyntaxMissingSpaceBeforeInlineComment: 'LSP0007',
  UseBeforeDeclaration: 'LSP1001',
  VariableTypeConflict: 'LSP1002',
  StringLiteralAssignmentUndeclared: 'LSP1003',
  StringLiteralAssignmentTypeMismatch: 'LSP1004',
  VariableUndeclared: 'LSP1005',
  AssignmentTypeMismatch: 'LSP1006',
  FunctionDeclaredNotImplemented: 'LSP1101',
  FunctionImplementedNotDeclared: 'LSP1102',
  FunctionGlobalOnly: 'LSP1103',
  FunctionImplGlobalOnly: 'LSP1105',
  FunctionParamLimitExceeded: 'LSP1104',
  ParamUnused: 'LSP1201',
  ParamEndNeverAssigned: 'LSP1202',
  ParamEndAssignedViaCall: 'LSP1204',
  VariableUnused: 'LSP1203',
  CursorSqlMissingSelect: 'LSP1301',
  CursorMethodArityMismatch: 'LSP1303',
  CursorFieldReadonly: 'LSP1302',
  CallArityMismatch: 'LSP1401',
  CallTypeMismatch: 'LSP1402',
  ListaMethodGlobalOnly: 'LSP1403',
  ImplicitDataSuggestion: 'LSP1404',
  AlfaScopeSuggestion: 'LSP1406',
  FunctionNotFound: 'LSP1408',
  ConverteMascaraArityMismatch: 'LSP1410',
  ConverteMascaraAlfaDestino: 'LSP1411',
  ConverteMascaraMascaraAlfa: 'LSP1412',
  ConverteMascaraDestinoAssignable: 'LSP1413',
  ConverteMascaraTipo124Numero: 'LSP1414',
  ConverteMascaraTipo3Data: 'LSP1415',
  ConverteMascaraTipo5Zero: 'LSP1416',
  ListaMethodArityMismatch: 'LSP1417',
  VaParaLabelNotFoundInFile: 'LSP1418',
  EndParamRequiresVariable: 'LSP1419',
  VariableRedeclaredGlobalAcrossFiles: 'LSP1420',
  VariableRedeclarationNotAllowed: 'LSP1421',
  MensagemTipoInvalido: 'LSP1422',
  LoopControlOutsideLoop: 'LSP1423',
  FunctionDuplicateParamName: 'LSP1424',
  TableOccurrencesInvalid: 'LSP1501',
  TableColumnNameMissing: 'LSP1502',
  TableColumnTypeInvalid: 'LSP1503',
  TableColumnDuplicated: 'LSP1504',
  TableColumnSizeInvalid: 'LSP1505',
  TableColumnSizeNotAllowed: 'LSP1506',
  TableEmpty: 'LSP1507',
  TableColumnNotFound: 'LSP1508',
  TableIndexRequired: 'LSP1509',
  TableIndexTypeMismatch: 'LSP1510',
  TableIndexOutOfRange: 'LSP1511'
} as const;

export const DiagnosticConceptualFamilies = {
  InvalidParameterCount: 'invalid_parameter_count'
} as const;

export type DiagnosticCode = typeof DiagnosticCodes[keyof typeof DiagnosticCodes];
export type DiagnosticConceptualFamily =
  typeof DiagnosticConceptualFamilies[keyof typeof DiagnosticConceptualFamilies];

const DIAGNOSTIC_CONCEPTUAL_FAMILY_BY_CODE: Partial<Record<DiagnosticCode, DiagnosticConceptualFamily>> = {
  [DiagnosticCodes.CursorMethodArityMismatch]: DiagnosticConceptualFamilies.InvalidParameterCount,
  [DiagnosticCodes.CallArityMismatch]: DiagnosticConceptualFamilies.InvalidParameterCount,
  [DiagnosticCodes.ConverteMascaraArityMismatch]: DiagnosticConceptualFamilies.InvalidParameterCount,
  [DiagnosticCodes.ListaMethodArityMismatch]: DiagnosticConceptualFamilies.InvalidParameterCount
};

export function getDiagnosticConceptualFamily(code: string): DiagnosticConceptualFamily | undefined {
  return DIAGNOSTIC_CONCEPTUAL_FAMILY_BY_CODE[code as DiagnosticCode];
}

export function buildInvalidParameterCountMessage(context: string, expected: string, received: number): string {
  return `Quantidade de parâmetros inválida em ${context}: esperado ${expected}, recebido ${received}`;
}
