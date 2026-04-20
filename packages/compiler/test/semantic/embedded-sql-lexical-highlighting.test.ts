import { describe, expect, it } from 'vitest';
import { collectEmbeddedSqlLexicalAnalysis } from '../../src/semantic/embedded-sql-lexical-highlighting';

describe('embedded SQL lexical highlighting', () =>
{
  it('classifies SQL binds as parameter tokens and SQL single-quoted literals as string tokens', () =>
  {
    const sqlLiteral = '"Select Decode(:nCodErs, \'ES\', 1, 0) From R034Fun"';
    const analysis = collectEmbeddedSqlLexicalAnalysis({
      sourcePath: 'test.lspt',
      text: `ExecSql ${sqlLiteral};`,
      literalRanges: [{
        start: { line: 0, character: 8 },
        end: { line: 0, character: 8 + sqlLiteral.length }
      }],
      wrapperKind: 'execsql',
      sourceKind: 'direct_literal',
      dialect: 'oracle'
    });

    const bind = analysis.occurrences.find((occ) => occ.range.start.character === 23);
    expect(bind).toMatchObject({
      tokenType: 'parameter',
      tokenModifiers: ['defaultLibrary', 'readonly']
    });

    const sqlString = analysis.occurrences.find((occ) => occ.tokenType === 'string');
    expect(sqlString).toBeDefined();
  });
});
