import { describe, it, expect } from 'vitest';
import {
  getEffectiveContexts,
  readContextsConfig,
  sanitizeContexts,
  validateContexts,
  writeContextsConfig,
  type ContextConfig,
  type ContextConfigAccessor
} from '../../../src/server/context/contexts-config';

describe('contexts config', () => {
  it('sanitizes valid entries and drops invalid ones', () => {
    const values = [
      {
        name: 'HR',
        rootDir: '/tmp/hr',
        filePattern: 'HR*.txt',
        includeSubdirectories: false,
        system: 'HCM',
        diagnostics: {
          ignoreIds: ['LSP1001', '  LSP1002  ', 7]
        }
      },
      { name: 'BAD', rootDir: '/tmp', filePattern: '*.txt', includeSubdirectories: true, system: 'SENIOR' }
    ];

    const result = sanitizeContexts(values);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('HR');
    expect(result[0].diagnostics?.ignoreIds).toEqual(['LSP1001', 'LSP1002']);
  });

  it('validates duplicate names, missing roots, invalid regex and zero matches', () => {
    const contexts: ContextConfig[] = [
      {
        name: 'HR',
        rootDir: '/missing',
        filePattern: 're:[',
        includeSubdirectories: false,
        system: 'HCM'
      },
      {
        name: 'HR',
        rootDir: '/ok',
        filePattern: 'HR*.txt',
        includeSubdirectories: false,
        system: 'ERP'
      }
    ];

    const issues = validateContexts(contexts, {
      pathExists: (p) => p === '/ok',
      matchCount: () => 0
    });

    expect(issues.some((i) => i.code === 'CONTEXT_NAME_DUPLICATE')).toBe(true);
    expect(issues.some((i) => i.code === 'CONTEXT_ROOTDIR_MISSING')).toBe(true);
    expect(issues.some((i) => i.code === 'CONTEXT_PATTERN_INVALID')).toBe(true);
    expect(issues.some((i) => i.code === 'CONTEXT_MATCH_ZERO')).toBe(true);
  });

  it('detects file conflicts between contexts', () => {
    const contexts: ContextConfig[] = [
      {
        name: 'CTX_A',
        rootDir: '/ok',
        filePattern: '*.txt',
        includeSubdirectories: false,
        system: 'HCM'
      },
      {
        name: 'CTX_B',
        rootDir: '/ok',
        filePattern: '*.txt',
        includeSubdirectories: false,
        system: 'ERP'
      }
    ];

    const issues = validateContexts(contexts, {
      pathExists: () => true,
      matchFiles: (ctx) => (ctx.name === 'CTX_A' ? ['/tmp/shared.txt', '/tmp/a.txt'] : ['/tmp/shared.txt', '/tmp/b.txt'])
    });

    expect(issues.filter((i) => i.code === 'CONTEXT_FILE_CONFLICT')).toHaveLength(2);
    expect(issues.some((i) => i.contextName === 'CTX_A')).toBe(true);
    expect(issues.some((i) => i.contextName === 'CTX_B')).toBe(true);
    expect(issues.filter((i) => i.code === 'CONTEXT_FILE_CONFLICT').every((i) => i.severity === 'ERROR')).toBe(true);
  });

  it('reads, writes and merges user/workspace contexts', async () => {
    const state: { user: unknown[]; workspace: unknown[] } = {
      user: [
        {
          name: 'USER_CTX',
          rootDir: '/user',
          filePattern: '*.txt',
          includeSubdirectories: false,
          system: 'HCM'
        }
      ],
      workspace: [
        {
          name: 'WS_CTX',
          rootDir: '/ws',
          filePattern: '*.lspt',
          includeSubdirectories: true,
          system: 'ERP'
        }
      ]
    };

    const accessor: ContextConfigAccessor<string> = {
      inspectContexts: () => ({ globalValue: state.user, workspaceValue: state.workspace }),
      updateContexts: async (scope, newConfig) => {
        if (scope === 'user') state.user = newConfig;
        if (scope === 'workspace') state.workspace = newConfig;
      }
    };

    const userContexts = readContextsConfig(accessor, 'user', 'res');
    expect(userContexts).toHaveLength(1);
    expect(userContexts[0].name).toBe('USER_CTX');

    await writeContextsConfig(accessor, 'workspace', [
      {
        name: 'WS_NEXT',
        rootDir: '/next',
        filePattern: 'A*.txt',
        includeSubdirectories: false,
        system: 'ACESSO'
      }
    ]);

    const merged = getEffectiveContexts(accessor, 'res');
    expect(merged.map((ctx) => ctx.name)).toEqual(['USER_CTX', 'WS_NEXT']);
  });
});
