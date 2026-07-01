import type { TypeName } from '../../parser/ast';
import { casefold } from '../../utils/casefold';
import hcmInternals from '../data/hcm-internals.json';
import acessoInternals from '../data/acesso-internals.json';
import erpInternals from '../data/erp-internals.json';
import seniorInternals from '../data/senior-internals.json';

type RawInternalVariable = {
  label: string;
};

const internalVariableNames: string[] = [
  ...(hcmInternals as RawInternalVariable[]),
  ...(acessoInternals as RawInternalVariable[]),
  ...(erpInternals as RawInternalVariable[]),
  ...(seniorInternals as RawInternalVariable[]),
].map(v => v.label);

export type InternalConstant = {
  name: string;
  nameNormalized: string;
  typeName: TypeName;
};

type InternalOverride = {
  name: string;
  typeName: TypeName;
};

const overrides = new Map<string, InternalOverride>([
  ['datpro', { name: 'DatPro', typeName: 'Data' as TypeName }],
  ['datsis', { name: 'DatSis', typeName: 'Data' as TypeName }],
  ['cverdadeiro', { name: 'cVerdadeiro', typeName: 'Numero' as TypeName }],
  ['cfalso', { name: 'cFalso', typeName: 'Numero' as TypeName }],
  ['web_html', { name: 'WEB_HTML', typeName: 'Alfa' as TypeName }]
]);

const constantMap = new Map<string, InternalConstant>();

for (const name of internalVariableNames)
{
  const key = casefold(name);
  const override = overrides.get(key);
  const finalName = override?.name ?? name;
  const typeName = override?.typeName ?? ('Desconhecido' as TypeName);
  const normalized = casefold(finalName);

  if (constantMap.has(normalized))
  {
    continue;
  }

  constantMap.set(normalized, {
    name: finalName,
    nameNormalized: normalized,
    typeName
  });
}

export function getInternalConstant(name: string): InternalConstant | undefined
{
  return constantMap.get(casefold(name));
}
