import type { InternalSignatureDoc, SymbolInfo } from '@lsp/compiler';

export type OfficialSymbolKind = 'function' | 'internal';

function normalizeKeyPart(value: string): string
{
  return value.trim().toLowerCase();
}

export function normalizeSystemForKey(system: string): string
{
  return normalizeKeyPart(system);
}

export function normalizeNameForKey(name: string): string
{
  return normalizeKeyPart(name);
}

export function resolveOfficialSymbolKind(signature: InternalSignatureDoc): OfficialSymbolKind
{
  return signature.symbolKind === 'internal' ? 'internal' : 'function';
}

export function buildOfficialSignatureKey(input: {
  system: string;
  kind: OfficialSymbolKind;
  name: string;
}): string
{
  return `${normalizeSystemForKey(input.system)}|${input.kind}|${normalizeNameForKey(input.name)}`;
}

export function buildOfficialNameLookupKeys(system: string, name: string): string[]
{
  const normalizedName = normalizeNameForKey(name);
  const normalizedSystem = normalizeSystemForKey(system);
  return [
    `${normalizedSystem}|function|${normalizedName}`,
    `${normalizedSystem}|internal|${normalizedName}`
  ];
}

export function buildOfficialDocVersionFingerprint(signatures: readonly InternalSignatureDoc[]): string
{
  if (signatures.length === 0) return '-';

  const parts = signatures
    .map((signature) =>
    {
      const kind = resolveOfficialSymbolKind(signature);
      const docVersion = (signature.docVersion ?? '').trim();
      return `${kind}:${normalizeNameForKey(signature.name)}:${docVersion}`;
    })
    .sort();
  return parts.join('|');
}

export function buildCustomSymbolFingerprint(symbol: SymbolInfo): string
{
  const namePart = normalizeNameForKey(symbol.name);
  if (symbol.kind === 'variable')
  {
    return `variable:${namePart}:${symbol.typeName ?? ''}`;
  }

  const params = (symbol.params ?? []).map((param) =>
  {
    const type = param.typeName.trim();
    const isEnd = param.isEnd === true;
    const end = isEnd ? ':end' : '';
    return `${type}${end}:${param.name}`;
  });
  return `function:${namePart}:${params.join(',')}`;
}
