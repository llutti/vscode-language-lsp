import { mergeIgnoreIds } from './diagnostics-ignore';

export type IgnoreIdsByScope = {
  workspace: string[];
  user: string[];
};

export function listEffectiveIgnoredCodes(input: IgnoreIdsByScope): string[] {
  return mergeIgnoreIds(input.user, input.workspace);
}

export function clearIgnoredCodes(input: IgnoreIdsByScope, scope: 'workspace' | 'user'): IgnoreIdsByScope {
  if (scope === 'workspace') {
    return { workspace: [], user: [...input.user] };
  }
  return { workspace: [...input.workspace], user: [] };
}
