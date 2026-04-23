import type { Range } from '../source/types';

export type OrderKey = {
  fileIndex: number;
  startOffset: number;
};

type NodeBase = {
  kind: string;
  range: Range;
  sourcePath: string;
  orderKey: OrderKey;
  scopeId?: string;
};

export type ProgramNode = NodeBase & {
  kind: 'Program';
  files: FileNode[];
};

export type FileNode = NodeBase & {
  kind: 'File';
  path: string;
  sourceText: string;
  statements: StatementNode[];
};

export type StatementNode =
  | LabelNode
  | VaParaNode
  | VarDeclNode
  | FuncDeclNode
  | FuncImplNode
  | BlockNode
  | IfNode
  | WhileNode
  | ForNode
  | AssignmentNode
  | ExecSqlNode
  | ExprStmtNode
  | EmptyNode
  | ErrorNode;

export type EmptyNode = NodeBase & {
  kind: 'Empty';
};

export type ErrorNode = NodeBase & {
  kind: 'Error';
  message: string;
};

export type LabelNode = NodeBase & {
  kind: 'Label';
  name: string;
  nameNormalized: string;
  nameRange?: Range;
};

export type VaParaNode = NodeBase & {
  kind: 'VaPara';
  targetLabel: string;
  targetLabelNormalized: string;
  targetRange?: Range;
};

export type TypeName = 'Alfa' | 'Numero' | 'Data' | 'Funcao' | 'Lista' | 'Cursor' | 'Tabela' | 'Desconhecido';

export type VarDeclNode = NodeBase & {
  kind: 'VarDecl';
  typeName: TypeName;
  name: string;
  nameNormalized: string;
  nameRange?: Range;
  tableDecl?: TableDeclNode;
};

export type TableColumnNode = {
  typeName: TypeName;
  name: string;
  nameNormalized: string;
  nameRange?: Range;
  sizeLiteral?: string;
  sizeRange?: Range;
  declRange: Range;
};

export type TableDeclNode = {
  occurrencesLiteral: string | null;
  occurrencesRange?: Range;
  columns: TableColumnNode[];
  bodyDelimiter?: 'Brace' | 'InicioFim';
  range: Range;
};

export type ParamNode = {
  typeName: TypeName;
  name: string;
  nameNormalized: string;
  nameRange?: Range;
  isEnd: boolean;
  range: Range;
  scopeId?: string;
};

export type FuncDeclNode = NodeBase & {
  kind: 'FuncDecl';
  name: string;
  nameNormalized: string;
  params: ParamNode[];
  terminatedBySemicolon: boolean;
  nameRange?: Range;
};

export type FuncImplNode = NodeBase & {
  kind: 'FuncImpl';
  name: string;
  nameNormalized: string;
  params: ParamNode[];
  body: BlockNode | null;
  nameRange?: Range;
};

export type BlockDelimiter = 'InicioFim' | 'Brace';

export type BlockNode = NodeBase & {
  kind: 'Block';
  delimiter: BlockDelimiter;
  statements: StatementNode[];
};

export type IfNode = NodeBase & {
  kind: 'If';
  condition: ExpressionNode | null;
  thenBranch: StatementNode | null;
  elseBranch: StatementNode | null;
};

export type WhileNode = NodeBase & {
  kind: 'While';
  condition: ExpressionNode | null;
  body: StatementNode | null;
};

export type ForNode = NodeBase & {
  kind: 'For';
  init: StatementNode | null;
  condition: ExpressionNode | null;
  update: ExpressionNode | null;
  body: StatementNode | null;
};

export type ExecSqlNode = NodeBase & {
  kind: 'ExecSql';
  keywordRange: Range;
  sql: StringLiteralNode | null;
  terminatedBySemicolon: boolean;
};

export type AssignmentNode = NodeBase & {
  kind: 'Assignment';
  target: ExpressionNode;
  value: ExpressionNode | null;
  /** True when parsed from `<obj>.SQL "..."` shorthand (without '='). */
  isCursorSqlShorthand?: boolean;
};

export type ExprStmtNode = NodeBase & {
  kind: 'ExprStmt';
  expr: ExpressionNode;
};

export type ExpressionNode =
  | IdentifierNode
  | NumberLiteralNode
  | StringLiteralNode
  | ApostropheLiteralNode
  | UnaryNode
  | BinaryNode
  | CallNode
  | MemberNode
  | IndexNode
  | ParenNode
  | UnknownExprNode;

export type IdentifierNode = NodeBase & {
  kind: 'Identifier';
  name: string;
  nameNormalized: string;
};

export type NumberLiteralNode = NodeBase & {
  kind: 'NumberLiteral';
  value: string;
};

export type StringLiteralNode = NodeBase & {
  kind: 'StringLiteral';
  value: string;
};

export type ApostropheLiteralNode = NodeBase & {
  kind: 'ApostropheLiteral';
  value: string;
};

export type BinaryNode = NodeBase & {
  kind: 'Binary';
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
};

export type UnaryNode = NodeBase & {
  kind: 'Unary';
  operator: string;
  operand: ExpressionNode;
};

export type CallNode = NodeBase & {
  kind: 'Call';
  callee: ExpressionNode;
  args: ExpressionNode[];
};

export type MemberNode = NodeBase & {
  kind: 'Member';
  object: ExpressionNode;
  property: IdentifierNode;
};

export type IndexNode = NodeBase & {
  kind: 'Index';
  object: ExpressionNode;
  index: ExpressionNode;
};

export type ParenNode = NodeBase & {
  kind: 'Paren';
  expr: ExpressionNode | null;
};

export type UnknownExprNode = NodeBase & {
  kind: 'UnknownExpr';
  value: string;
};
