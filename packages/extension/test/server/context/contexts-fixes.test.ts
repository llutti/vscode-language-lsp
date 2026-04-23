import { describe, expect, it } from 'vitest';
import { buildContextFixActions, disableContextByName } from '../../../src/server/context/contexts-fixes';
import type { ContextConfig, ContextIssue } from '../../../src/server/context/contexts-config';

describe('contexts fixes', () => {
  it('gera acoes de edit e disable a partir dos issues', () => {
    const issues: ContextIssue[] = [
      {
        severity: 'ERROR',
        code: 'CONTEXT_ROOTDIR_MISSING',
        contextName: 'A',
        message: 'root missing'
      },
      {
        severity: 'WARN',
        code: 'CONTEXT_FILE_CONFLICT',
        contextName: 'B',
        message: 'conflict'
      }
    ];
    const actions = buildContextFixActions(issues);
    expect(actions.some((a) => a.kind === 'edit' && a.contextName === 'A')).toBe(true);
    expect(actions.some((a) => a.kind === 'disable' && a.contextName === 'B')).toBe(true);
  });

  it('desabilita contexto removendo do array', () => {
    const contexts: ContextConfig[] = [
      { name: 'A', rootDir: '/a', filePattern: '*.txt', includeSubdirectories: false, system: 'HCM' },
      { name: 'B', rootDir: '/b', filePattern: '*.txt', includeSubdirectories: false, system: 'ERP' }
    ];
    const next = disableContextByName(contexts, 'A');
    expect(next).toHaveLength(1);
    expect(next[0].name).toBe('B');
  });
});
