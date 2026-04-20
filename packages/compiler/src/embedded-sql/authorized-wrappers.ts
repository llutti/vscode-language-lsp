import { casefold } from '../utils/casefold';
import type { EmbeddedSqlWrapperKind } from '../formatter/types';

export type AuthorizedEmbeddedSqlWrapper = {
  name: string;
  wrapperKind: EmbeddedSqlWrapperKind;
  recognizedSyntax: 'statement' | 'cursor_shorthand' | 'call';
  parameterIndex: number | null;
  parameterName: string | null;
  notes: string;
};

export const AUTHORIZED_EMBEDDED_SQL_WRAPPERS: AuthorizedEmbeddedSqlWrapper[] = [
  {
    name: 'ExecSql',
    wrapperKind: 'execsql',
    recognizedSyntax: 'statement',
    parameterIndex: 0,
    parameterName: 'sql',
    notes: 'Comando com sintaxe própria `ExecSql <StringLiteral>;`. A elegibilidade é estrutural no statement, não por assinatura interna.'
  },
  {
    name: 'Cursor.SQL',
    wrapperKind: 'cursor_sql',
    recognizedSyntax: 'cursor_shorthand',
    parameterIndex: 0,
    parameterName: 'sql',
    notes: 'Forma especial `<cursor>.SQL <StringLiteral>;` ou `<cursor>.SQL <expr>;` quando a expressão for reconstruível com segurança.'
  },
  {
    name: 'ExecSQLEx',
    wrapperKind: 'execsqlex',
    recognizedSyntax: 'call',
    parameterIndex: 0,
    parameterName: 'ComandoSQL',
    notes: 'Call autorizado apenas quando a assinatura confirmar o primeiro parâmetro Alfa portador do SQL.'
  },
  {
    name: 'SQL_DefinirComando',
    wrapperKind: 'sql_definircomando',
    recognizedSyntax: 'call',
    parameterIndex: 1,
    parameterName: 'aSQL',
    notes: 'Call autorizado apenas quando a assinatura confirmar o segundo parâmetro Alfa portador do SQL.'
  }
];

export function classifyEmbeddedSqlWrapperKind(ownerName: string): EmbeddedSqlWrapperKind
{
  const normalized = casefold(ownerName);
  const match = AUTHORIZED_EMBEDDED_SQL_WRAPPERS.find((entry) => casefold(entry.name) === normalized);
  return match?.wrapperKind ?? 'execsql';
}
