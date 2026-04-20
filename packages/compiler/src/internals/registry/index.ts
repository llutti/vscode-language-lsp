import { casefold } from '../../utils/casefold';
import type { TypeName } from '../../parser/ast';
import hcmSignatures from '../data/hcm-signatures.json';
import seniorSignatures from '../data/senior-signatures.json';
import acessoSignatures from '../data/acesso-signatures.json';
import erpSignatures from '../data/erp-signatures.json';

import hcmInternals from '../data/hcm-internals.json';
import acessoInternals from '../data/acesso-internals.json';
import erpInternals from '../data/erp-internals.json';

export type InternalSignature = {
  name: string;
  nameNormalized: string;
  paramTypes: TypeName[];
  documentation?: string | undefined;
  docUrl?: string | undefined;
  docVersion?: string | undefined;
  dataType: TypeName | undefined;
  isReturnValue: boolean | undefined;
  system: 'SENIOR' | 'HCM' | 'ACESSO' | 'ERP';
  params?: {
    name: string;
    type: TypeName;
    isReturnValue: boolean;
    documentation?: string | undefined;
  }[];
};

export type InternalVariable = {
  name: string;
  nameNormalized: string;
  dataType: TypeName;
  isConst: boolean;
  documentation?: string | undefined;
  docUrl?: string | undefined;
  docVersion?: string | undefined;
};

export type InternalRegistry = {
  system: 'SENIOR' | 'HCM' | 'ACESSO' | 'ERP';
  functions: Map<string, InternalSignature[]>;
  internalVariables: Map<string, InternalVariable>;
};

type RawSignature = {
  name: string;
  documentation?: string;
  docUrl?: string;
  docVersion?: string;
  dataType?: TypeName;
  type?: TypeName;
  isReturnValue?: boolean;
  params?: { name: string; type: TypeName; isReturnValue: boolean; documentation?: string }[];
};

type RawInternalVariable = {
  label: string;
  kind: 'variable';
  dataType: TypeName;
  isConst?: boolean;
  documentation?: string;
  docUrl?: string;
  docVersion?: string;
};

function normalizeText(value: unknown): string | undefined
{
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalUrl(value: unknown): string | undefined
{
  const normalized = normalizeText(value);
  if (!normalized) return undefined;
  try
  {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
    return parsed.toString();
  } catch
  {
    return undefined;
  }
}

function addSignature(map: Map<string, InternalSignature[]>, sig: InternalSignature): void
{
  const key = sig.nameNormalized;
  const list = map.get(key);
  if (list)
  {
    list.push(sig);
    return;
  }
  map.set(key, [sig]);
}

function addInternalVariable(map: Map<string, InternalVariable>, v: InternalVariable): void
{
  // Last writer wins (system-specific overrides should replace base SENIOR entries).
  map.set(v.nameNormalized, v);
}

const cache = new Map<string, InternalRegistry>();

export async function loadInternalRegistry(system: 'SENIOR' | 'HCM' | 'ACESSO' | 'ERP'): Promise<InternalRegistry>
{
  const existing = cache.get(system);
  if (existing) return existing;

  const functions = new Map<string, InternalSignature[]>();
  const internalVariables = new Map<string, InternalVariable>();

  const signatureSources: Array<{ system: 'SENIOR' | 'HCM' | 'ACESSO' | 'ERP'; entries: RawSignature[] }> = [
    { system: 'SENIOR', entries: seniorSignatures as RawSignature[] }
  ];
  if (system === 'HCM') signatureSources.push({ system: 'HCM', entries: hcmSignatures as RawSignature[] });
  if (system === 'ACESSO') signatureSources.push({ system: 'ACESSO', entries: acessoSignatures as RawSignature[] });
  if (system === 'ERP') signatureSources.push({ system: 'ERP', entries: erpSignatures as RawSignature[] });

  for (const source of signatureSources)
  {
    for (const raw of source.entries)
    {
      const name = normalizeText(raw.name);
      if (!name)
      {
        continue;
      }

      const params = raw.params ?? [];
      const docUrl = normalizeOptionalUrl(raw.docUrl);
      const docVersion = docUrl ? normalizeText(raw.docVersion) : undefined;

      const rawSigType = raw?.dataType ?? raw?.type;
      const dataType = rawSigType ? rawSigType : undefined;
      const isReturnValue = Boolean(raw?.isReturnValue) ?? undefined;

      addSignature(functions, {
        name,
        nameNormalized: casefold(name),
        paramTypes: params.map((p) => p.type),
        documentation: normalizeText(raw?.documentation),
        docUrl,
        docVersion,
        system: source.system,
        dataType,
        isReturnValue,
        params: params.map((p) => ({
          ...p,
          documentation: normalizeText(p.documentation)
        }))
      });
    }
  }

  const internalEntries: RawInternalVariable[] = [];
  if (system === 'HCM') internalEntries.push(...(hcmInternals as RawInternalVariable[]));
  if (system === 'ACESSO') internalEntries.push(...(acessoInternals as RawInternalVariable[]));
  if (system === 'ERP') internalEntries.push(...(erpInternals as RawInternalVariable[]));

  for (const raw of internalEntries)
  {
    const label = normalizeText(raw.label);
    if (!label) continue;
    const docUrl = normalizeOptionalUrl(raw.docUrl);
    const docVersion = docUrl ? normalizeText(raw.docVersion) : undefined;

    addInternalVariable(internalVariables, {
      name: label,
      nameNormalized: casefold(label),
      dataType: raw.dataType,
      isConst: Boolean(raw.isConst),
      documentation: normalizeText(raw.documentation),
      docUrl,
      docVersion,
    });
  }

  const registry = { system, functions, internalVariables };
  cache.set(system, registry);
  return registry;
}

export function getInternalSignatures(registry: InternalRegistry, name: string): InternalSignature[]
{
  return registry.functions.get(casefold(name)) ?? [];
}

export function getInternalVariable(registry: InternalRegistry, name: string): InternalVariable | undefined
{
  return registry.internalVariables.get(casefold(name));
}

export function isInternalVariable(registry: InternalRegistry, name: string): boolean
{
  return registry.internalVariables.has(casefold(name));
}

export function getAllInternalVariables(registry: InternalRegistry): InternalVariable[]
{
  return [...registry.internalVariables.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
