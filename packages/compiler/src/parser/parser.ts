import { positionToOffset, rangeFromOffsets, type SourceFile } from '../source/source-file';
import type { Range } from '../source/types';
import { casefold } from '../utils/casefold';
import { tokenize, withoutTrivia, type Token, type TokenizePerf } from '../lexer/tokenizer';
import type {
  AssignmentNode,
  BinaryNode,
  BlockNode,
  BlockDelimiter,
  CallNode,
  EmptyNode,
  ExecSqlNode,
  ErrorNode,
  ExprStmtNode,
  ExpressionNode,
  FileNode,
  ForNode,
  FuncDeclNode,
  FuncImplNode,
  IdentifierNode,
  IfNode,
  IndexNode,
  MemberNode,
  NumberLiteralNode,
  ParamNode,
  ParenNode,
  ProgramNode,
  LabelNode,
  StatementNode,
  StringLiteralNode,
  ApostropheLiteralNode,
  TableColumnNode,
  TableDeclNode,
  TypeName,
  VaParaNode,
  UnknownExprNode,
  VarDeclNode,
  WhileNode
} from './ast';

export type ParseError = {
  code: ParseErrorCode;
  message: string;
  range: Range;
  sourcePath: string;
};

export type ParseErrorCode =
  | 'LEX_INVALID_TOKEN'
  | 'LEX_UNCLOSED_BLOCK_COMMENT'
  | 'LEX_UNCLOSED_STRING'
  | 'SYN_UNCLOSED_PAREN'
  | 'SYN_UNCLOSED_BRACKET'
  | 'SYN_MISSING_SPACE_BEFORE_INLINE_COMMENT'
  | 'SYN_UNCLOSED_BLOCK'
  | 'SYN_EXPECTED_SEMICOLON'
  | 'SYN_GENERIC';

const NORM_LITERAL_CACHE = new Map<string, string>();
const NORM_LITERAL_CACHE_MAX = 1024;
function cacheSetWithLimit<K, V>(cache: Map<K, V>, key: K, value: V, maxSize: number): void {
  if (cache.size >= maxSize && !cache.has(key)) {
    const oldestKey = cache.keys().next().value as K | undefined;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, value);
}

function normLiteral(value: string): string {
  const hit = NORM_LITERAL_CACHE.get(value);
  if (hit) return hit;
  const norm = casefold(value);
  cacheSetWithLimit(NORM_LITERAL_CACHE, value, norm, NORM_LITERAL_CACHE_MAX);
  return norm;
}

function mapTypeName(token: Token | null): TypeName {
  if (!token) return 'Desconhecido';
  switch (token.normalized) {
    case 'alfa':
      return 'Alfa';
    case 'numero':
      return 'Numero';
    case 'data':
      return 'Data';
    case 'funcao':
      return 'Funcao';
    case 'lista':
      return 'Lista';
    case 'cursor':
      return 'Cursor';
    case 'tabela':
      return 'Tabela';
    default:
      return 'Desconhecido';
  }
}

class Parser {
  private readonly source: SourceFile;
  private readonly fileIndex: number;
  private readonly tokens: Token[];
  private readonly tokenStartOffsets: number[];
  private readonly tokenEndOffsets: number[];
  private readonly lexicalErrors: Token[];
  public readonly tokenizePerf: TokenizePerf | undefined;
  private pos = 0;
  public readonly errors: ParseError[] = [];

  constructor(source: SourceFile, fileIndex: number, options?: { collectPerf?: boolean }) {
    this.source = source;
    this.fileIndex = fileIndex;
    const { tokens: rawTokens, lexicalErrors, perf } = options?.collectPerf
      ? tokenize(source, { collectPerf: true })
      : tokenize(source);
    this.tokenizePerf = perf;
    this.tokens = withoutTrivia(rawTokens);
    this.tokenStartOffsets = this.tokens.map((t) => t.startOffset);
    this.tokenEndOffsets = this.tokens.map((t) => t.endOffset);
    this.lexicalErrors = lexicalErrors;

    for (const err of this.lexicalErrors) {
      let detail = `Token inválido: ${err.value}`;
      let code: ParseErrorCode = 'LEX_INVALID_TOKEN';
      if (err.type === 'CommentBlock' && !err.value.endsWith('*/')) {
        detail = 'Comentário de bloco não fechado';
        code = 'LEX_UNCLOSED_BLOCK_COMMENT';
      } else if (err.type === 'String' && !err.value.endsWith('"')) {
        detail = 'String literal não fechada';
        code = 'LEX_UNCLOSED_STRING';
      }
      this.errors.push({
        code,
        message: `Erro léxico: ${detail}`,
        range: err.range,
        sourcePath: err.sourcePath
      });
    }

    this.checkMissingSpaceBeforeInlineComment(rawTokens);
    this.checkUnclosedDelimiters();
  }

  private current(): Token {
    return this.tokens[Math.min(this.pos, this.tokens.length - 1)] ?? this.tokens[0]!;
  }

  private previous(): Token {
    return this.tokens[Math.max(0, this.pos - 1)] ?? this.tokens[0]!;
  }

  private atEnd(): boolean {
    return this.current().type === 'EOF';
  }

  private advance(): Token {
    if (!this.atEnd()) this.pos += 1;
    return this.previous();
  }

  private checkValue(value: string): boolean {
    return this.current().normalized === normLiteral(value);
  }

  private matchValue(...values: string[]): boolean {
    for (const v of values) {
      if (this.checkValue(v)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private matchType(type: Token['type']): Token | null {
    if (this.current().type === type) {
      return this.advance();
    }
    return null;
  }

  private matchMemberNameToken(): Token | null {
    const current = this.current();
    if (current.type === 'Identifier' || current.type === 'Keyword' || current.type === 'Type') {
      return this.advance();
    }
    return null;
  }

  private expectValue(value: string, message: string, errorAnchor?: Token): Token | null {
    if (this.checkValue(value)) {
      return this.advance();
    }
    const code: ParseErrorCode = value === ';' ? 'SYN_EXPECTED_SEMICOLON' : 'SYN_GENERIC';
    if (errorAnchor) {
      this.reportAtOffset(message, errorAnchor.endOffset, code);
    } else {
      this.report(message, this.current(), code);
    }
    return null;
  }

  private report(message: string, token: Token, code: ParseErrorCode = 'SYN_GENERIC'): void {
    this.errors.push({
      code,
      message,
      range: token.range,
      sourcePath: token.sourcePath
    });
  }

  private reportAtOffset(message: string, offset: number, code: ParseErrorCode = 'SYN_GENERIC'): void {
    this.errors.push({
      code,
      message,
      range: this.makeRange(offset, offset),
      sourcePath: this.source.path
    });
  }

  private makeRange(startOffset: number, endOffset: number): Range {
    return rangeFromOffsets(this.source, startOffset, endOffset);
  }

  private nodeBase(kind: string, start: Token, end: Token): { kind: string; range: Range; sourcePath: string; orderKey: { fileIndex: number; startOffset: number } } {
    return {
      kind,
      range: this.makeRange(start.startOffset, end.endOffset),
      sourcePath: this.source.path,
      orderKey: { fileIndex: this.fileIndex, startOffset: start.startOffset }
    };
  }

  private synchronize(): void {
    const syncValues = new Set([';', '}', 'fim', 'definir', 'funcao', 'se', 'senao', 'enquanto', 'para', 'inicio']);
    while (!this.atEnd()) {
      if (this.previous().value === ';') return;
      if (syncValues.has(this.current().normalized)) return;
      this.advance();
    }
  }

  public parseFile(): FileNode {
    const start = this.current();
    const statements: StatementNode[] = [];
    while (!this.atEnd()) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }
    const lastStmt = statements[statements.length - 1];
    const endToken = lastStmt ? this.lastTokenOf(lastStmt) : this.previous();
    const base = this.nodeBase('File', start, endToken);
    return {
      ...base,
      kind: 'File',
      path: this.source.path,
      sourceText: this.source.text,
      statements
    } satisfies FileNode;
  }

  private parseStatement(): StatementNode {
    const token = this.current();

    if (token.type === 'EOF') {
      return this.parseEmpty();
    }

    if (this.matchValue(';')) {
      return this.parseEmpty(token);
    }

    if (token.type === 'Identifier' && this.peek().value === ':') {
      return this.parseLabel();
    }

    if (this.checkValue('definir')) {
      return this.parseDefinir();
    }

    if (this.checkValue('funcao')) {
      return this.parseFuncImpl();
    }

    if (this.checkValue('inicio') || this.checkValue('{')) {
      return this.parseBlock();
    }

    if (this.checkValue('se')) {
      return this.parseIf();
    }

    if (this.checkValue('enquanto')) {
      return this.parseWhile();
    }

    if (this.checkValue('para')) {
      return this.parseFor();
    }

    if (this.checkValue('vapara')) {
      return this.parseVaPara();
    }

    if (this.checkValue('execsql')) {
      return this.parseExecSql();
    }

    if (this.checkValue('pare') || this.checkValue('continue')) {
      return this.parseControlKeywordStatement();
    }

    return this.parseExprLikeStatement();
  }

  private parseControlKeywordStatement(): ExprStmtNode {
    const keyword = this.advance();
    const semicolon = this.expectValue(';', "Esperado ';' após comando", keyword);
    const end = semicolon ?? keyword;
    const expr: IdentifierNode = {
      ...this.nodeBase('Identifier', keyword, keyword),
      kind: 'Identifier',
      name: keyword.value,
      nameNormalized: keyword.normalized
    };
    const base = this.nodeBase('ExprStmt', keyword, end);
    return {
      ...base,
      kind: 'ExprStmt',
      expr
    } satisfies ExprStmtNode;
  }

  private parseVaPara(): StatementNode {
    const start = this.advance(); // vapara
    const targetToken = this.matchType('Identifier');
    if (!targetToken) {
      this.report("Esperado identificador de rótulo após 'VaPara'", this.current());
      this.expectValue(';', "Esperado ';' após comando VaPara", start);
      this.synchronize();
      return this.parseError(start, 'Rótulo ausente em comando VaPara');
    }
    const semicolon = this.expectValue(';', "Esperado ';' após comando VaPara", targetToken);
    const end = semicolon ?? targetToken;
    const stmtBase = this.nodeBase('VaPara', start, end);
    return {
      ...stmtBase,
      kind: 'VaPara',
      targetLabel: targetToken.value,
      targetLabelNormalized: targetToken.normalized,
      targetRange: targetToken.range
    } satisfies VaParaNode;
  }

  private parseExecSql(): ExecSqlNode {
    const start = this.advance(); // ExecSql
    const sqlToken = this.matchType('String');
    if (!sqlToken) {
      this.report("Esperado StringLiteral após 'ExecSql'", this.current());
    }
    const semicolonToken = this.expectValue(';', "Esperado ';' após ExecSql \"...\";", sqlToken ?? start);
    const end = semicolonToken ?? sqlToken ?? start;
    const base = this.nodeBase('ExecSql', start, end);
    const sqlNode: StringLiteralNode | null = sqlToken
      ? ({
          ...this.nodeBase('StringLiteral', sqlToken, sqlToken),
          kind: 'StringLiteral',
          value: sqlToken.value
        } satisfies StringLiteralNode)
      : null;
    return {
      ...base,
      kind: 'ExecSql',
      keywordRange: start.range,
      sql: sqlNode,
      terminatedBySemicolon: Boolean(semicolonToken)
    } satisfies ExecSqlNode;
  }

  private parseLabel(): StatementNode {
    const labelToken = this.advance();
    const colon = this.expectValue(':', "Esperado ':' após rótulo", labelToken);
    const semicolon = this.matchValue(';') ? this.previous() : null;
    const end = semicolon ?? colon ?? labelToken;
    const base = this.nodeBase('Label', labelToken, end);
    return {
      ...base,
      kind: 'Label',
      name: labelToken.value,
      nameNormalized: labelToken.normalized,
      nameRange: labelToken.range
    } satisfies LabelNode;
  }

  private parseEmpty(token: Token = this.previous()): EmptyNode {
    const base = this.nodeBase('Empty', token, token);
    return { ...base, kind: 'Empty' } satisfies EmptyNode;
  }

  private parseError(start: Token, message: string): ErrorNode {
    const end = this.current();
    const base = this.nodeBase('Error', start, end);
    return { ...base, kind: 'Error', message } satisfies ErrorNode;
  }

  private parseDefinir(): StatementNode {
    const start = this.advance(); // definir

    if (this.matchValue('funcao')) {
      return this.parseFuncDecl(start);
    }

    if (this.checkValue('tabela')) {
      return this.parseTableDefinir(start);
    }

    const collected: Token[] = [];
    const startLine = start.range.start.line;
    const statementStarters = new Set(['definir', 'funcao', 'se', 'senao', 'enquanto', 'para', 'inicio', 'fim']);
    while (!this.atEnd() && !this.checkValue(';')) {
      const current = this.current();
      const isStarter =
        current.type === 'Keyword'
        && statementStarters.has(current.normalized)
        && current.range.start.line > startLine;

      if (isStarter && collected.length > 0) {
        break;
      }

      collected.push(this.advance());
    }

    const typeIndex = collected.findIndex((t) => t.type === 'Type');
    const identifierIndexes = collected
      .map((token, index) => (index > typeIndex && token.type === 'Identifier' ? index : -1))
      .filter((index) => index >= 0);
    const firstNameIndex = identifierIndexes[0] ?? -1;
    const lastNameIndex = identifierIndexes[identifierIndexes.length - 1] ?? -1;
    const firstNameToken = firstNameIndex >= 0 ? collected[firstNameIndex] ?? null : null;
    const lastNameToken = lastNameIndex >= 0 ? collected[lastNameIndex] ?? null : null;
    const assignmentIndex = collected.findIndex((t) => t.value === '=');
    const hasEmbeddedAssignment = assignmentIndex >= 0 && firstNameIndex >= 0 && assignmentIndex > firstNameIndex;
    const hasEmbeddedStatementStarter =
      firstNameIndex >= 0 &&
      collected.slice(firstNameIndex + 1).some(
        (token) => token.type === 'Keyword' && statementStarters.has(token.normalized)
      );
    const hasEmbeddedNextStatement = hasEmbeddedAssignment || hasEmbeddedStatementStarter;
    const nameToken = hasEmbeddedNextStatement ? firstNameToken : lastNameToken;
    if (!nameToken) {
      this.report('Esperado identificador na definição', this.current());
      this.synchronize();
      return this.parseError(start, 'Identificador ausente em definição');
    }

    if (hasEmbeddedNextStatement) {
      this.reportAtOffset("Esperado ';' ao final de definição", nameToken.endOffset, 'SYN_EXPECTED_SEMICOLON');
    }

    const declEndToken = collected[collected.length - 1] ?? nameToken;
    const semicolon = this.expectValue(';', "Esperado ';' ao final de definição", declEndToken);
    const end = semicolon ?? nameToken;
    const typeToken = collected.find((t) => t.type === 'Type') ?? collected[0] ?? start;
    const base = this.nodeBase('VarDecl', start, end);
    return {
      ...base,
      kind: 'VarDecl',
      typeName: typeToken.type === 'Type' ? mapTypeName(typeToken) : 'Desconhecido',
      name: nameToken.value,
      nameNormalized: nameToken.normalized,
      nameRange: nameToken.range
    } satisfies VarDeclNode;
  }

  private parseTableDefinir(definirToken: Token): VarDeclNode | ErrorNode {
    const tabelaToken = this.advance(); // Tabela
    const nameToken = this.matchType('Identifier');
    if (!nameToken) {
      this.report("Esperado identificador após 'Definir Tabela'", this.current());
      this.synchronize();
      return this.parseError(definirToken, 'Nome ausente em declaração de Tabela');
    }

    let occurrencesLiteral: string | null = null;
    let occurrencesRange: Range | undefined;
    if (this.matchValue('[')) {
      const openBracket = this.previous();
      const valueToken = this.matchType('Number');
      if (valueToken) {
        occurrencesLiteral = valueToken.value;
        occurrencesRange = valueToken.range;
      } else if (!this.checkValue(']')) {
        const fallback = this.current();
        this.report("Esperado número de ocorrências em '[n]'", fallback);
        if (fallback.type !== 'EOF') {
          occurrencesLiteral = fallback.value;
          occurrencesRange = fallback.range;
          this.advance();
        }
      }
      this.expectValue(']', "Esperado ']' após ocorrências da tabela", occurrencesRange ? this.previous() : openBracket);
    } else {
      this.report("Esperado '[<ocorrencias>]' em 'Definir Tabela'", this.current());
    }

    this.expectValue('=', "Esperado '=' na declaração de Tabela", nameToken);

    const columns: TableColumnNode[] = [];
    let bodyDelimiter: 'Brace' | 'InicioFim' | undefined;
    if (this.matchValue('{')) {
      bodyDelimiter = 'Brace';
      while (!this.atEnd() && !this.checkValue('}')) {
        const maybeColumn = this.parseTableColumn();
        if (maybeColumn) {
          columns.push(maybeColumn);
          continue;
        }
        if (this.current().type !== 'EOF') this.advance();
      }
      this.expectValue('}', "Esperado '}' ao final do schema da Tabela");
    } else if (this.matchValue('inicio')) {
      bodyDelimiter = 'InicioFim';
      while (!this.atEnd() && !this.checkValue('fim')) {
        const maybeColumn = this.parseTableColumn();
        if (maybeColumn) {
          columns.push(maybeColumn);
          continue;
        }
        if (this.current().type !== 'EOF') this.advance();
      }
      this.expectValue('fim', "Esperado 'Fim' ao final do schema da Tabela");
    } else {
      this.report("Esperado '{' ou 'Inicio' para iniciar schema da Tabela", this.current());
    }

    const semicolon = this.expectValue(';', "Esperado ';' ao final de declaração de Tabela", this.previous());
    const end = semicolon ?? this.previous();
    const base = this.nodeBase('VarDecl', definirToken, end);
    const tableRangeStart = tabelaToken.startOffset;
    const tableRangeEnd = end.endOffset;
    const tableDecl: TableDeclNode = {
      occurrencesLiteral,
      columns,
      range: this.makeRange(tableRangeStart, tableRangeEnd),
      ...(occurrencesRange ? { occurrencesRange } : {}),
      ...(bodyDelimiter ? { bodyDelimiter } : {})
    };
    return {
      ...base,
      kind: 'VarDecl',
      typeName: 'Tabela',
      name: nameToken.value,
      nameNormalized: nameToken.normalized,
      nameRange: nameToken.range,
      tableDecl
    } satisfies VarDeclNode;
  }

  private parseTableColumn(): TableColumnNode | null {
    const typeToken = this.matchType('Type');
    if (!typeToken) {
      this.report('Esperado tipo de coluna (Alfa/Numero/Data)', this.current());
      this.synchronizeTo([';', '}']);
      if (this.checkValue(';')) this.advance();
      return null;
    }

    const nameToken = this.matchType('Identifier');
    if (!nameToken) {
      this.report('Esperado nome da coluna da tabela', this.current());
      this.synchronizeTo([';', '}']);
      if (this.checkValue(';')) this.advance();
      const end = this.previous();
      return {
        typeName: mapTypeName(typeToken),
        name: '',
        nameNormalized: '',
        declRange: this.makeRange(typeToken.startOffset, end.endOffset)
      };
    }

    let sizeLiteral: string | undefined;
    let sizeRange: Range | undefined;
    if (this.matchValue('[')) {
      const openBracket = this.previous();
      const sizeToken = this.current();
      if (sizeToken.type === 'Number' || sizeToken.type === 'Identifier') {
        sizeLiteral = sizeToken.value;
        sizeRange = sizeToken.range;
        this.advance();
      } else if (!this.checkValue(']')) {
        this.report("Esperado tamanho de coluna entre '[' e ']'", sizeToken);
        if (sizeToken.type !== 'EOF') {
          sizeLiteral = sizeToken.value;
          sizeRange = sizeToken.range;
          this.advance();
        }
      }
      this.expectValue(']', "Esperado ']' após tamanho de coluna", sizeRange ? this.previous() : openBracket);
    }

    const semicolon = this.expectValue(';', "Esperado ';' ao final da definição de coluna", nameToken);
    const end = semicolon ?? this.previous();
    return {
      typeName: mapTypeName(typeToken),
      name: nameToken.value,
      nameNormalized: nameToken.normalized,
      nameRange: nameToken.range,
      ...(sizeLiteral !== undefined ? { sizeLiteral } : {}),
      ...(sizeRange ? { sizeRange } : {}),
      declRange: this.makeRange(typeToken.startOffset, end.endOffset)
    };
  }

  private parseFuncDecl(definirToken: Token): FuncDeclNode | ErrorNode {
    const nameToken = this.matchType('Identifier');
    if (!nameToken) {
      this.report("Esperado nome da função após 'Definir Funcao'", this.current());
      this.synchronize();
      return this.parseError(definirToken, 'Nome ausente em declaração de função');
    }

    const params = this.parseParams();

    // A declaração termina obrigatoriamente com ';' e pode ser multilinha.
    const semicolon = this.expectValue(';', "Esperado ';' ao final de 'Definir Funcao'", this.previous());
    const end = semicolon ?? this.previous();
    const base = this.nodeBase('FuncDecl', definirToken, end);

    return {
      ...base,
      kind: 'FuncDecl',
      name: nameToken.value,
      nameNormalized: nameToken.normalized,
      params,
      terminatedBySemicolon: !!semicolon,
      nameRange: nameToken.range
    } satisfies FuncDeclNode;
  }

  private parseFuncImpl(): FuncImplNode | ErrorNode {
    const start = this.advance(); // funcao
    const nameToken = this.matchType('Identifier');
    if (!nameToken) {
      this.report("Esperado nome após 'Funcao'", this.current());
      this.synchronize();
      return this.parseError(start, 'Nome ausente em implementação de função');
    }

    const params = this.parseParams();

    // Algumas bases usam ';' após o cabeçalho.
    this.matchValue(';');

    let body: BlockNode | null = null;
    if (this.checkValue('inicio') || this.checkValue('{')) {
      body = this.parseBlock();
    }

    const endToken = body ? this.previous() : this.previous();
    const base = this.nodeBase('FuncImpl', start, endToken);
    return {
      ...base,
      kind: 'FuncImpl',
      name: nameToken.value,
      nameNormalized: nameToken.normalized,
      params,
      body,
      nameRange: nameToken.range
    } satisfies FuncImplNode;
  }

  private parseParams(): ParamNode[] {
    const params: ParamNode[] = [];
    const open = this.expectValue('(', "Esperado '(' após nome");
    if (!open) return params;

    while (!this.atEnd() && !this.checkValue(')')) {
      const typeToken = this.matchType('Type');
      if (!typeToken) {
        this.report('Esperado tipo de parâmetro', this.current());
        this.synchronizeTo([',', ')']);
        if (this.checkValue(',')) this.advance();
        continue;
      }

      const isEnd = this.matchValue('end');
      const nameToken = this.matchType('Identifier');
      if (!nameToken) {
        this.report('Esperado nome de parâmetro', this.current());
        this.synchronizeTo([',', ')']);
        if (this.checkValue(',')) this.advance();
        continue;
      }

      const range = this.makeRange(typeToken.startOffset, nameToken.endOffset);
      params.push({
        typeName: mapTypeName(typeToken),
        name: nameToken.value,
        nameNormalized: nameToken.normalized,
        nameRange: nameToken.range,
        isEnd,
        range
      });

      if (this.checkValue(',')) {
        this.advance();
        continue;
      }

      if (!this.checkValue(')')) {
        this.report("Esperado ',' ou ')' após parâmetro", this.current());
        this.synchronizeTo([',', ')']);
        if (this.checkValue(',')) this.advance();
      }
    }

    this.expectValue(')', "Esperado ')' ao final da lista de parâmetros");
    return params;
  }

  private synchronizeTo(values: string[]): void {
    const set = new Set(values.map(normLiteral));
    while (!this.atEnd() && !set.has(this.current().normalized)) {
      this.advance();
    }
  }

  private parseBlock(): BlockNode {
    const start = this.advance();
    const delimiter: BlockDelimiter = start.normalized === 'inicio' ? 'InicioFim' : 'Brace';
    const statements: StatementNode[] = [];

    const isEndToken = (): boolean =>
      delimiter === 'InicioFim' ? this.checkValue('fim') : this.checkValue('}');

    while (!this.atEnd() && !isEndToken()) {
      statements.push(this.parseStatement());
    }

    if (this.atEnd()) {
      this.report(
        delimiter === 'InicioFim' ? "Bloco 'Inicio' sem 'Fim'" : "Bloco '{' sem '}'",
        this.previous(),
        'SYN_UNCLOSED_BLOCK'
      );
      const base = this.nodeBase('Block', start, this.previous());
      return {
        ...base,
        kind: 'Block',
        delimiter,
        statements
      } satisfies BlockNode;
    }

    const endToken = this.advance(); // fim or }
    if (delimiter === 'InicioFim') {
      // Fim normalmente é seguido por ';'
      this.matchValue(';');
    }

    const base = this.nodeBase('Block', start, endToken);
    return {
      ...base,
      kind: 'Block',
      delimiter,
      statements
    } satisfies BlockNode;
  }

  private parseIf(): IfNode {
    const start = this.advance(); // se
    const condition = this.parseParenExpression();
    if (!condition) {
      this.synchronizeTo(['senao', ';', 'fim', '}']);
    }
    const thenBranch = this.parseStatement();
    let elseBranch: StatementNode | null = null;
    if (this.matchValue('senao')) {
      elseBranch = this.parseStatement();
    }

    const end = elseBranch ?? thenBranch ?? start;
    const base = this.nodeBase('If', start, this.lastTokenOf(end));
    return {
      ...base,
      kind: 'If',
      condition,
      thenBranch,
      elseBranch
    } satisfies IfNode;
  }

  private parseWhile(): WhileNode {
    const start = this.advance(); // enquanto
    const condition = this.parseParenExpression();
    if (!condition) {
      this.synchronizeTo([';', 'fim', '}']);
    }
    const body = this.parseStatement();
    const end = body ?? start;
    const base = this.nodeBase('While', start, this.lastTokenOf(end));
    return {
      ...base,
      kind: 'While',
      condition,
      body
    } satisfies WhileNode;
  }

  private parseFor(): ForNode {
    const start = this.advance(); // para
    const open = this.expectValue('(', "Esperado '(' após 'Para'");
    if (!open) {
      this.synchronize();
      const base = this.nodeBase('For', start, start);
      return {
        ...base,
        kind: 'For',
        init: null,
        condition: null,
        update: null,
        body: null
      } satisfies ForNode;
    }
    let init: StatementNode | null = null;
    let condition: ExpressionNode | null = null;
    let update: ExpressionNode | null = null;

    if (open) {
      if (!this.checkValue(';')) {
        init = this.parseExprLikeStatement(true);
      }
      this.expectValue(';', "Esperado ';' na cláusula init do Para", init ? this.lastTokenOf(init) : open);

      if (!this.checkValue(';')) {
        condition = this.parseExpression();
      }
      this.expectValue(';', "Esperado ';' na cláusula condição do Para", condition ? this.lastTokenOf(condition) : this.previous());

      if (!this.checkValue(')')) {
        update = this.parseExpression();
      }
      const close = this.expectValue(')', "Esperado ')' ao final do Para");
      if (!close) {
        this.synchronizeTo([')', 'inicio', 'fim', '{', '}', ';']);
        if (this.checkValue(')')) this.advance();
      }
    }

    const body = this.parseStatement();
    const end = body ?? start;
    const base = this.nodeBase('For', start, this.lastTokenOf(end));
    return {
      ...base,
      kind: 'For',
      init,
      condition,
      update,
      body
    } satisfies ForNode;
  }

  private parseParenExpression(): ExpressionNode | null {
    if (!this.matchValue('(')) {
      this.report("Esperado '('", this.current());
      return null;
    }
    const expr = this.parseExpression();
    this.expectValue(')', "Esperado ')' após expressão");
    return expr;
  }

  private parseExprLikeStatement(inForHeader = false): StatementNode {
    const start = this.current();
    const expr = this.parseExpression();

    // Official LSP syntax for cursor SQL accepts:
    //   <cursor>.SQL "<comando_SQL>";
    // (without '='). We normalize it to Assignment in AST.
    if (
      expr
      && expr.kind === 'Member'
      && expr.property.nameNormalized === 'sql'
      && this.current().type === 'String'
    ) {
      const value = this.parseExpression();
      const assignmentEndToken = value ? this.lastTokenOf(value) : this.previous();
      if (!inForHeader) {
        this.expectValue(';', "Esperado ';' após atribuição", assignmentEndToken);
      }
      const base = this.nodeBase('Assignment', start, assignmentEndToken);
      return {
        ...base,
        kind: 'Assignment',
        target: expr,
        value,
        isCursorSqlShorthand: true
      } satisfies AssignmentNode;
    }

    if (expr && this.matchValue('=')) {
      const value = this.parseExpression();
      const assignmentEndToken = value ? this.lastTokenOf(value) : this.previous();
      if (!inForHeader) {
        this.expectValue(';', "Esperado ';' após atribuição", assignmentEndToken);
      }
      const base = this.nodeBase('Assignment', start, assignmentEndToken);
      return {
        ...base,
        kind: 'Assignment',
        target: expr,
        value
      } satisfies AssignmentNode;
    }

    if (!inForHeader) {
      this.expectValue(';', "Esperado ';' após comando", expr ? this.lastTokenOf(expr) : this.previous());
    }

    if (!expr) {
      this.synchronize();
      return this.parseError(start, 'Expressão inválida');
    }

    const base = this.nodeBase('ExprStmt', start, this.lastTokenOf(expr));
    return {
      ...base,
      kind: 'ExprStmt',
      expr
    } satisfies ExprStmtNode;
  }

  private parseExpression(): ExpressionNode {
    return this.parseLogical();
  }

  private parseUnary(): ExpressionNode {
    if (this.current().type === 'Operator' && this.current().value === '-') {
      const op = this.advance();
      const operand = this.parseUnary();
      const base = this.nodeBase('Unary', op, this.lastTokenOf(operand));
      return {
        ...base,
        kind: 'Unary',
        operator: op.value,
        operand
      };
    }
    return this.parsePostfix();
  }

  private parseLogical(): ExpressionNode {
    let expr = this.parseComparison();
    while (this.current().type === 'Operator' && ['e', 'ou'].includes(this.current().normalized)) {
      const op = this.advance();
      const right = this.parseComparison();
      expr = this.makeBinary(expr, op, right);
    }
    return expr;
  }

  private parseComparison(): ExpressionNode {
    let expr = this.parseAdditive();
    while (this.current().type === 'Operator' && ['=', '<>', '>', '<', '>=', '<='] .includes(this.current().normalized)) {
      const op = this.advance();
      const right = this.parseAdditive();
      expr = this.makeBinary(expr, op, right);
    }
    return expr;
  }

  private parseAdditive(): ExpressionNode {
    let expr = this.parseMultiplicative();
    while (this.current().type === 'Operator' && ['+', '-'] .includes(this.current().normalized)) {
      const op = this.advance();
      const right = this.parseMultiplicative();
      expr = this.makeBinary(expr, op, right);
    }
    return expr;
  }

  private parseMultiplicative(): ExpressionNode {
    let expr = this.parseUnary();
    while (this.current().type === 'Operator' && ['*', '/'].includes(this.current().normalized)) {
      const op = this.advance();
      const right = this.parseUnary();
      expr = this.makeBinary(expr, op, right);
    }
    return expr;
  }

  private parsePostfix(): ExpressionNode {
    let expr = this.parsePrimary();

    while (!this.atEnd()) {
      if (this.matchValue('.')) {
        const propToken = this.matchMemberNameToken();
        if (!propToken) {
          this.report("Esperado identificador após '.'", this.current());
          return expr;
        }
        const property: IdentifierNode = {
          ...this.nodeBase('Identifier', propToken, propToken),
          kind: 'Identifier',
          name: propToken.value,
          nameNormalized: propToken.normalized
        };
        const endToken = propToken;
        const base = this.nodeBase('Member', this.firstTokenOf(expr), endToken);
        expr = {
          ...base,
          kind: 'Member',
          object: expr,
          property
        } satisfies MemberNode;
        continue;
      }

      if (this.current().type === 'Operator' && ['++', '--'].includes(this.current().normalized)) {
        const op = this.advance();
        const base = this.nodeBase('Unary', this.firstTokenOf(expr), op);
        expr = {
          ...base,
          kind: 'Unary',
          operator: op.value,
          operand: expr
        };
        continue;
      }

      if (this.matchValue('[')) {
        const indexExpr = this.parseExpression();
        this.expectValue(']', "Esperado ']' após índice");
        const base = this.nodeBase('Index', this.firstTokenOf(expr), this.lastTokenOf(indexExpr));
        expr = {
          ...base,
          kind: 'Index',
          object: expr,
          index: indexExpr
        } satisfies IndexNode;
        continue;
      }

      if (this.checkValue('(')) {
        const callStart = this.firstTokenOf(expr);
        this.advance();
        const args: ExpressionNode[] = [];
        while (!this.atEnd() && !this.checkValue(')')) {
          args.push(this.parseExpression());
          if (this.checkValue(',')) {
            this.advance();
            continue;
          }
          if (!this.checkValue(')')) {
            this.report("Esperado ',' ou ')' nos argumentos", this.current());
            this.synchronizeTo([')']);
          }
        }
        const close = this.expectValue(')', "Esperado ')' após chamada");
        const endToken = close ?? this.previous();
        const base = this.nodeBase('Call', callStart, endToken);
        expr = {
          ...base,
          kind: 'Call',
          callee: expr,
          args
        } satisfies CallNode;
        continue;
      }

      break;
    }

    return expr;
  }

  private parsePrimary(): ExpressionNode {
    const token = this.current();

    if (this.matchType('Identifier') || this.matchType('Type')) {
      const base = this.nodeBase('Identifier', token, token);
      return {
        ...base,
        kind: 'Identifier',
        name: token.value,
        nameNormalized: token.normalized
      } satisfies IdentifierNode;
    }

    if (this.matchType('Number')) {
      const base = this.nodeBase('NumberLiteral', token, token);
      return {
        ...base,
        kind: 'NumberLiteral',
        value: token.value
      } satisfies NumberLiteralNode;
    }

    if (this.matchType('String')) {
      const base = this.nodeBase('StringLiteral', token, token);
      return {
        ...base,
        kind: 'StringLiteral',
        value: token.value
      } satisfies StringLiteralNode;
    }

    if (this.matchType('Apostrophe')) {
      const base = this.nodeBase('ApostropheLiteral', token, token);
      return {
        ...base,
        kind: 'ApostropheLiteral',
        value: token.value
      } satisfies ApostropheLiteralNode;
    }

    if (this.matchValue('(')) {
      const start = this.previous();
      const expr = this.parseExpression();
      const close = this.expectValue(')', "Esperado ')' após expressão");
      const end = close ?? this.previous();
      const base = this.nodeBase('Paren', start, end);
      return {
        ...base,
        kind: 'Paren',
        expr
      } satisfies ParenNode;
    }

    this.report('Expressão inesperada', token);
    this.advance();
    const base = this.nodeBase('UnknownExpr', token, token);
    return {
      ...base,
      kind: 'UnknownExpr',
      value: token.value
    } satisfies UnknownExprNode;
  }

  private peek(): Token {
    return this.tokens[Math.min(this.pos + 1, this.tokens.length - 1)] ?? this.tokens[0]!;
  }

  private makeBinary(left: ExpressionNode, op: Token, right: ExpressionNode): BinaryNode {
    const base = this.nodeBase('Binary', this.firstTokenOf(left), this.lastTokenOf(right));
    return {
      ...base,
      kind: 'Binary',
      operator: op.value,
      left,
      right
    } satisfies BinaryNode;
  }

  private checkUnclosedDelimiters(): void {
    const parenStack: Token[] = [];
    const bracketStack: Token[] = [];

    for (const token of this.tokens) {
      if (token.type !== 'Delimiter') continue;
      if (token.value === '(') parenStack.push(token);
      if (token.value === ')') {
        if (parenStack.length > 0) parenStack.pop();
      }
      if (token.value === '[') bracketStack.push(token);
      if (token.value === ']') {
        if (bracketStack.length > 0) bracketStack.pop();
      }
    }

    for (const open of parenStack) {
      this.errors.push({
        code: 'SYN_UNCLOSED_PAREN',
        message: "Parêntese '(' sem ')'",
        range: open.range,
        sourcePath: open.sourcePath
      });
    }
    for (const open of bracketStack) {
      this.errors.push({
        code: 'SYN_UNCLOSED_BRACKET',
        message: "Colchete '[' sem ']'",
        range: open.range,
        sourcePath: open.sourcePath
      });
    }
  }

  private checkMissingSpaceBeforeInlineComment(tokens: Token[]): void {
    for (let i = 1; i < tokens.length; i += 1) {
      const prev = tokens[i - 1];
      const curr = tokens[i];
      if (!prev || !curr) continue;
      if (prev.type !== 'Identifier' || curr.type !== 'CommentLine') continue;
      if (prev.endOffset !== curr.startOffset) continue;
      if (prev.range.end.line !== curr.range.start.line) continue;
      this.errors.push({
        code: 'SYN_MISSING_SPACE_BEFORE_INLINE_COMMENT',
        message: 'Esperado 1 espaço antes de comentário inline',
        range: this.makeRange(prev.endOffset, prev.endOffset),
        sourcePath: this.source.path
      });
    }
  }

  private firstTokenOf(node: StatementNode | ExpressionNode): Token {
    const offset = positionToOffset(this.source, node.range.start);
    let lo = 0;
    let hi = this.tokenStartOffsets.length - 1;
    let best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if ((this.tokenStartOffsets[mid] ?? Number.POSITIVE_INFINITY) >= offset) {
        best = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    return best >= 0 ? (this.tokens[best] ?? this.tokens[0]!) : this.tokens[0]!;
  }

  private lastTokenOf(node: StatementNode | ExpressionNode): Token {
    const endOffset = positionToOffset(this.source, node.range.end);
    let lo = 0;
    let hi = this.tokenEndOffsets.length - 1;
    let best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if ((this.tokenEndOffsets[mid] ?? Number.NEGATIVE_INFINITY) <= endOffset) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best >= 0 ? (this.tokens[best] ?? this.previous()) : this.previous();
  }
}

export type ParsedFilePerf = {
  tokensTotal: number;
  tokensNoTrivia: number;
  lexicalErrors: number;
  rangeFromOffsetsCalls: number;
  offsetToPositionCalls: number;
};

export type ParsedFile = {
  file: FileNode;
  errors: ParseError[];
  perf?: ParsedFilePerf;
};

export function parseSingleFile(source: SourceFile, fileIndex: number, options?: { collectPerf?: boolean }): ParsedFile {
  const parser = new Parser(source, fileIndex, options);
  const file = parser.parseFile();
  let perf: ParsedFilePerf | undefined;
  if (options?.collectPerf) {
    const t = parser.tokenizePerf;
    const s = source.__perf;
    perf = {
      tokensTotal: t?.tokensTotal ?? 0,
      tokensNoTrivia: t?.tokensNoTrivia ?? 0,
      lexicalErrors: t?.lexicalErrors ?? 0,
      rangeFromOffsetsCalls: s?.rangeFromOffsetsCalls ?? 0,
      offsetToPositionCalls: s?.offsetToPositionCalls ?? 0
    };
  }
  return perf ? { file, errors: parser.errors, perf } : { file, errors: parser.errors };
}

export function parseFiles(sources: SourceFile[]): { program: ProgramNode; parseErrors: ParseError[]; files: ParsedFile[] } {
  const files: ParsedFile[] = [];
  const parseErrors: ParseError[] = [];

  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i];
    if (!source) continue;
    const parsed = parseSingleFile(source, i);
    files.push(parsed);
    parseErrors.push(...parsed.errors);
  }

  const startFile = files[0]?.file ?? null;

  const program: ProgramNode = {
    kind: 'Program',
    range: startFile ? startFile.range : { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    sourcePath: startFile?.sourcePath ?? '<empty>',
    orderKey: { fileIndex: 0, startOffset: 0 },
    files: files.map((f) => f.file)
  };

  return { program, parseErrors, files };
}
