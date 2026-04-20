import type { EmbeddedSqlDialect } from './types';
import type { EmbeddedSqlFormatterProvider } from './embedded-sql-provider';
import { SqlFormatterEmbeddedSqlProvider } from './embedded-sql-provider';

export class EmbeddedSqlFormatterProviderRegistry
{
  private readonly providers = new Map<EmbeddedSqlDialect, EmbeddedSqlFormatterProvider>();

  constructor()
  {
    this.providers.set('sql', new SqlFormatterEmbeddedSqlProvider());
    this.providers.set('oracle', new SqlFormatterEmbeddedSqlProvider());
    this.providers.set('sqlserver', new SqlFormatterEmbeddedSqlProvider());
  }

  get(dialect: EmbeddedSqlDialect): EmbeddedSqlFormatterProvider
  {
    return this.providers.get(dialect) ?? this.providers.get('sql')!;
  }
}

export const defaultEmbeddedSqlFormatterProviderRegistry = new EmbeddedSqlFormatterProviderRegistry();
