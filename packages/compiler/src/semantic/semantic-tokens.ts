import type { Range } from '../source/types';
import type { EmbeddedSqlSourceKind, EmbeddedSqlWrapperKind } from '../formatter/types';

export const SEMANTIC_TOKEN_TYPES = ['function', 'method', 'variable', 'parameter', 'property', 'string', 'keyword', 'number'] as const;
export type SemanticTokenType = (typeof SEMANTIC_TOKEN_TYPES)[number];

export const SEMANTIC_TOKEN_MODIFIERS = [
  'declaration',
  'definition',
  'readonly',
  'defaultLibrary',
  'internal',
  'static',
  'userDefined'
] as const;
export type SemanticTokenModifier = (typeof SEMANTIC_TOKEN_MODIFIERS)[number];

export type SemanticOccurrence = {
  sourcePath: string;
  range: Range;
  tokenType: SemanticTokenType;
  tokenModifiers: SemanticTokenModifier[];
  embeddedSql?: {
    wrapperKind: EmbeddedSqlWrapperKind;
    sourceKind: EmbeddedSqlSourceKind;
  };
};
