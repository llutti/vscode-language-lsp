import { format as formatSql } from 'sql-formatter';
import type { EmbeddedSqlDialect } from './types';

export type EmbeddedSqlFormatResult =
  | { status: 'formatted'; text: string }
  | { status: 'no-op'; reason: string };

export type EmbeddedSqlFormatterProvider = {
  format: (input: { sql: string; dialect: EmbeddedSqlDialect }) => EmbeddedSqlFormatResult;
};

function mapDialectToFormatterLanguage(dialect: EmbeddedSqlDialect): 'sql' | 'plsql' | 'transactsql'
{
  switch (dialect)
  {
    case 'oracle':
      return 'plsql';
    case 'sqlserver':
      return 'transactsql';
    default:
      return 'sql';
  }
}

export class SqlFormatterEmbeddedSqlProvider implements EmbeddedSqlFormatterProvider
{
  format(input: { sql: string; dialect: EmbeddedSqlDialect }): EmbeddedSqlFormatResult
  {
    try
    {
      const text = formatSql(input.sql, {
        language: mapDialectToFormatterLanguage(input.dialect),
        paramTypes: {
          custom: [{ regex: ':[A-Za-z_][A-Za-z0-9_]*' }]
        }
      });
      const normalized = text.trim();
      if (!normalized) return { status: 'no-op', reason: 'empty_output' };
      return { status: 'formatted', text: normalized };
    } catch
    {
      return { status: 'no-op', reason: 'provider_error' };
    }
  }
}
