import { describe, expect, it } from 'vitest';
import { buildContextFixActions, disableContextByName } from '../../../src/server/context/contexts-fixes';
import {
  getEffectiveContexts,
  readContextsConfig,
  validateContexts,
  writeContextsConfig,
  type ContextConfigAccessor
} from '../../../src/server/context/contexts-config';

describe('contexts commands integration', () => {
  it('simula persistencia e validacao com fix de desabilitar contexto', async () => {
    const state: { user: unknown[]; workspace: unknown[] } = {
      user: [],
      workspace: [
        { name: 'A', rootDir: '/ok', filePattern: '*.txt', includeSubdirectories: false, system: 'HCM' },
        { name: 'B', rootDir: '/ok', filePattern: '*.txt', includeSubdirectories: false, system: 'ERP' }
      ]
    };
    const accessor: ContextConfigAccessor = {
      inspectContexts: () => ({ globalValue: state.user, workspaceValue: state.workspace }),
      updateContexts: async (scope, newConfig) => {
        if (scope === 'workspace') state.workspace = newConfig;
        if (scope === 'user') state.user = newConfig;
      }
    };

    const before = readContextsConfig(accessor, 'workspace');
    const issues = validateContexts(before, {
      pathExists: () => true,
      matchFiles: (ctx) => (ctx.name === 'A' ? ['/tmp/shared.txt'] : ['/tmp/shared.txt'])
    });
    const actions = buildContextFixActions(issues);
    const disable = actions.find((a) => a.kind === 'disable');
    expect(disable).toBeTruthy();
    const next = disableContextByName(before, disable!.contextName);
    await writeContextsConfig(accessor, 'workspace', next);

    const effective = getEffectiveContexts(accessor);
    expect(effective).toHaveLength(1);
  });
});
