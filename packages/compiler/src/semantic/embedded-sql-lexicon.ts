import type { EmbeddedSqlDialect } from '../formatter/types';

export type EmbeddedSqlDialectLexicon = {
  functions: readonly string[];
  bareFunctions?: readonly string[];
  keywords: readonly string[];
  compoundKeywords?: readonly string[];
  types?: readonly string[];
  operators?: readonly string[];
};

const COMMON_LEXICON: EmbeddedSqlDialectLexicon = {
  functions: [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'UPPER', 'LOWER', 'SUBSTR', 'SUBSTRING', 'TRIM', 'LTRIM', 'RTRIM', 'COALESCE',
    'ROUND', 'ABS'
  ],
  keywords: [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER', 'BY', 'GROUP', 'HAVING', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
    'DELETE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'ON', 'UNION', 'ALL', 'DISTINCT', 'AS', 'WHEN', 'CASE',
    'THEN', 'ELSE', 'END', 'IN', 'IS', 'NULL', 'NOT', 'EXISTS', 'LIKE', 'BETWEEN', 'TOP', 'WITH', 'OVER', 'PARTITION',
    'ROW_NUMBER', 'FETCH', 'NEXT', 'ROWS', 'ONLY', 'OFFSET'
  ],
  compoundKeywords: ['IS NULL'],
  operators: ['<>', '>=', '<=', '!=', '||', '=', '+', '-', '*', '/', ',']
};

const ORACLE_LEXICON: EmbeddedSqlDialectLexicon = {
  functions: [
    'DECODE', 'NVL', 'TO_CHAR', 'TO_DATE', 'TO_NUMBER', 'TRUNC', 'UPPER', 'LOWER', 'INITCAP', 'SUBSTR', 'INSTR', 'NULLIF',
    'COALESCE', 'EXTRACT', 'JSON_OBJECT', 'JSON_ARRAYAGG', 'JSON_OBJECTAGG', 'JSON_ARRAY', 'JSON_QUERY', 'JSON_VALUE', 'LISTAGG',
    'MONTHS_BETWEEN', 'NUMTODSINTERVAL'
  ],
  bareFunctions: ['SYSDATE', 'SYSTIMESTAMP', 'ROWNUM', 'NEXTVAL'],
  keywords: ['DUAL', 'KEY', 'VALUE', 'RETURNING', 'FORMAT', 'JSON', 'ABSENT', 'NULL'],
  compoundKeywords: ['ABSENT ON NULL', 'FORMAT JSON', 'IS NULL', 'WITHIN GROUP'],
  types: ['VARCHAR2', 'BLOB', 'CLOB']
};

const SQLSERVER_LEXICON: EmbeddedSqlDialectLexicon = {
  functions: ['GETDATE', 'ISNULL', 'CONVERT', 'CAST', 'LEN', 'DATEDIFF', 'DATEADD'],
  keywords: ['VARCHAR', 'NVARCHAR']
};

function mergeUnique(...parts: Array<readonly string[] | undefined>): string[]
{
  const result: string[] = [];
  const seen = new Set<string>();
  for (const part of parts)
  {
    for (const entry of part ?? [])
    {
      const key = entry.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(entry);
    }
  }
  return result;
}

export function getEmbeddedSqlDialectLexicon(dialect: EmbeddedSqlDialect): EmbeddedSqlDialectLexicon
{
  switch (dialect)
  {
    case 'oracle':
      return {
        functions: mergeUnique(COMMON_LEXICON.functions, ORACLE_LEXICON.functions),
        bareFunctions: mergeUnique(COMMON_LEXICON.bareFunctions, ORACLE_LEXICON.bareFunctions),
        keywords: mergeUnique(COMMON_LEXICON.keywords, ORACLE_LEXICON.keywords),
        compoundKeywords: mergeUnique(COMMON_LEXICON.compoundKeywords, ORACLE_LEXICON.compoundKeywords),
        types: mergeUnique(COMMON_LEXICON.types, ORACLE_LEXICON.types),
        operators: mergeUnique(COMMON_LEXICON.operators, ORACLE_LEXICON.operators)
      };
    case 'sqlserver':
      return {
        functions: mergeUnique(COMMON_LEXICON.functions, SQLSERVER_LEXICON.functions),
        bareFunctions: mergeUnique(COMMON_LEXICON.bareFunctions, SQLSERVER_LEXICON.bareFunctions),
        keywords: mergeUnique(COMMON_LEXICON.keywords, SQLSERVER_LEXICON.keywords),
        compoundKeywords: mergeUnique(COMMON_LEXICON.compoundKeywords, SQLSERVER_LEXICON.compoundKeywords),
        types: mergeUnique(COMMON_LEXICON.types, SQLSERVER_LEXICON.types),
        operators: mergeUnique(COMMON_LEXICON.operators, SQLSERVER_LEXICON.operators)
      };
    case 'sql':
    default:
      return {
        functions: mergeUnique(COMMON_LEXICON.functions),
        bareFunctions: mergeUnique(COMMON_LEXICON.bareFunctions),
        keywords: mergeUnique(COMMON_LEXICON.keywords),
        compoundKeywords: mergeUnique(COMMON_LEXICON.compoundKeywords),
        types: mergeUnique(COMMON_LEXICON.types),
        operators: mergeUnique(COMMON_LEXICON.operators)
      };
  }
}
