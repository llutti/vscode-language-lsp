import type { InternalSignatureDoc } from '@lsp/compiler';

export type OfficialSignatureIndex = {
  byKey: Map<string, InternalSignatureDoc>;
  byName: Map<string, InternalSignatureDoc[]>;
};

type CreateOfficialSignatureIndexServiceInput<TSymbolKind> = {
  internalCache: Map<string, InternalSignatureDoc[]>;
  internalIndex: Map<string, OfficialSignatureIndex>;
  ensureSignatures: (system: string) => Promise<InternalSignatureDoc[]>;
  invalidateHoverCacheOfficial: (system: string) => void;
  buildOfficialNameLookupKeys: (system: string, name: string) => string[];
  buildOfficialSignatureKey: (input: { system: string; kind: TSymbolKind; name: string }) => string;
  normalizeNameForKey: (name: string) => string;
  resolveOfficialSymbolKind: (signature: InternalSignatureDoc) => TSymbolKind;
};

export function createOfficialSignatureIndexService<TSymbolKind>(input: CreateOfficialSignatureIndexServiceInput<TSymbolKind>)
{
  async function ensureInternalSignatures(system: string): Promise<InternalSignatureDoc[]>
  {
    const cached = input.internalCache.get(system);
    if (cached) return cached;
    const loaded = await input.ensureSignatures(system);
    input.internalCache.set(system, loaded);
    input.invalidateHoverCacheOfficial(system);
    return loaded;
  }

  function lookupOfficialHoverSignatures(index: OfficialSignatureIndex, system: string, name: string): InternalSignatureDoc[]
  {
    const found: InternalSignatureDoc[] = [];
    const keys = input.buildOfficialNameLookupKeys(system, name);
    for (const key of keys)
    {
      const signature = index.byKey.get(key);
      if (signature) found.push(signature);
    }
    if (found.length > 0) return found;
    return index.byName.get(input.normalizeNameForKey(name)) ?? [];
  }

  async function ensureInternalIndex(system: string): Promise<OfficialSignatureIndex>
  {
    const cached = input.internalIndex.get(system);
    if (cached) return cached;
    const signatures = await ensureInternalSignatures(system);
    const byKey = new Map<string, InternalSignatureDoc>();
    const byName = new Map<string, InternalSignatureDoc[]>();
    for (const signature of signatures)
    {
      const kind = input.resolveOfficialSymbolKind(signature);
      const key = input.buildOfficialSignatureKey({ system, kind, name: signature.name });
      byKey.set(key, signature);

      const nameKey = input.normalizeNameForKey(signature.name);
      const list = byName.get(nameKey) ?? [];
      list.push(signature);
      byName.set(nameKey, list);
    }
    const index: OfficialSignatureIndex = { byKey, byName };
    input.internalIndex.set(system, index);
    return index;
  }

  return {
    ensureInternalSignatures,
    ensureInternalIndex,
    lookupOfficialHoverSignatures
  };
}
