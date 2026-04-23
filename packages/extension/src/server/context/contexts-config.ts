export type ContextSystem = 'HCM' | 'ACESSO' | 'ERP';

export type ContextDiagnosticsConfig = {
  ignoreIds?: string[];
};

export type ContextConfig = {
  name: string;
  rootDir: string;
  filePattern: string;
  includeSubdirectories: boolean;
  system: ContextSystem;
  diagnostics?: ContextDiagnosticsConfig;
};

export type ContextIssue = {
  severity: 'ERROR' | 'WARN';
  code:
    | 'CONTEXT_NAME_DUPLICATE'
    | 'CONTEXT_ROOTDIR_MISSING'
    | 'CONTEXT_PATTERN_INVALID'
    | 'CONTEXT_SYSTEM_INVALID'
    | 'CONTEXT_MATCH_ZERO'
    | 'CONTEXT_FILE_CONFLICT';
  contextName: string;
  message: string;
};

export type ContextConfigAccessor<Resource = unknown> = {
  inspectContexts: (resource?: Resource) => { workspaceValue?: unknown; globalValue?: unknown } | undefined;
  updateContexts: (scope: 'user' | 'workspace', newConfig: ContextConfig[], resource?: Resource) => Promise<void>;
};

const VALID_SYSTEMS = new Set<ContextSystem>(['HCM', 'ACESSO', 'ERP']);

export function isContextSystem(value: unknown): value is ContextSystem {
  return typeof value === 'string' && VALID_SYSTEMS.has(value as ContextSystem);
}

export function sanitizeContext(value: unknown): ContextConfig | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (!isContextSystem(raw.system)) return null;
  if (typeof raw.name !== 'string') return null;
  if (typeof raw.rootDir !== 'string') return null;
  if (typeof raw.filePattern !== 'string') return null;
  if (typeof raw.includeSubdirectories !== 'boolean') return null;
  let diagnostics: ContextDiagnosticsConfig | undefined;
  if (raw.diagnostics && typeof raw.diagnostics === 'object') {
    const rawDiagnostics = raw.diagnostics as Record<string, unknown>;
    if (Array.isArray(rawDiagnostics.ignoreIds)) {
      const ignoreIds = rawDiagnostics.ignoreIds
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (ignoreIds.length > 0) {
        diagnostics = { ignoreIds };
      }
    }
  }
  return {
    name: raw.name.trim(),
    rootDir: raw.rootDir.trim(),
    filePattern: raw.filePattern.trim(),
    includeSubdirectories: raw.includeSubdirectories,
    system: raw.system,
    diagnostics
  };
}

export function sanitizeContexts(values: unknown[]): ContextConfig[] {
  const list: ContextConfig[] = [];
  for (const value of values) {
    const parsed = sanitizeContext(value);
    if (parsed) list.push(parsed);
  }
  return list;
}

export function validateContexts(
  contexts: ContextConfig[],
  input: {
    pathExists: (rootDir: string) => boolean;
    matchCount?: (ctx: ContextConfig) => number;
    matchFiles?: (ctx: ContextConfig) => string[];
  }
): ContextIssue[] {
  const issues: ContextIssue[] = [];
  const byName = new Map<string, number>();
  const filesByContext = new Map<string, string[]>();
  for (const ctx of contexts) {
    const key = ctx.name.toLowerCase();
    byName.set(key, (byName.get(key) ?? 0) + 1);
  }

  for (const ctx of contexts) {
    const key = ctx.name.toLowerCase();
    if ((byName.get(key) ?? 0) > 1) {
      issues.push({
        severity: 'ERROR',
        code: 'CONTEXT_NAME_DUPLICATE',
        contextName: ctx.name,
        message: `Nome de contexto duplicado: ${ctx.name}`
      });
    }

    if (!isContextSystem(ctx.system)) {
      issues.push({
        severity: 'ERROR',
        code: 'CONTEXT_SYSTEM_INVALID',
        contextName: ctx.name,
        message: `System inválido no contexto ${ctx.name}: ${String(ctx.system)}`
      });
    }

    if (!input.pathExists(ctx.rootDir)) {
      issues.push({
        severity: 'ERROR',
        code: 'CONTEXT_ROOTDIR_MISSING',
        contextName: ctx.name,
        message: `Diretório raiz inexistente para ${ctx.name}: ${ctx.rootDir}`
      });
    }

    if (ctx.filePattern.startsWith('re:')) {
      const expr = ctx.filePattern.slice(3);
      try {
        // Validate user provided regex early to avoid runtime failures.
        new RegExp(expr);
      } catch {
        issues.push({
          severity: 'ERROR',
          code: 'CONTEXT_PATTERN_INVALID',
          contextName: ctx.name,
          message: `Regex inválida no contexto ${ctx.name}: ${ctx.filePattern}`
        });
      }
    } else if (!ctx.filePattern) {
      issues.push({
        severity: 'ERROR',
        code: 'CONTEXT_PATTERN_INVALID',
        contextName: ctx.name,
        message: `Padrão de arquivo inválido no contexto ${ctx.name}`
      });
    }

    const matches = input.matchFiles?.(ctx);
    if (matches) {
      filesByContext.set(ctx.name, matches);
    }

    if (input.matchCount || matches) {
      const count = input.matchCount ? input.matchCount(ctx) : matches?.length ?? 0;
      if (count === 0) {
        issues.push({
          severity: 'WARN',
          code: 'CONTEXT_MATCH_ZERO',
          contextName: ctx.name,
          message: `Contexto ${ctx.name} não encontrou arquivos com o padrão atual.`
        });
      }
    }
  }

  if (filesByContext.size > 0) {
    const fileToContexts = new Map<string, Set<string>>();
    for (const [contextName, files] of filesByContext.entries()) {
      for (const file of files) {
        const key = file.trim().toLowerCase();
        if (!key) continue;
        const list = fileToContexts.get(key) ?? new Set<string>();
        list.add(contextName);
        fileToContexts.set(key, list);
      }
    }
    const conflictedContexts = new Map<string, number>();
    for (const owners of fileToContexts.values()) {
      if (owners.size <= 1) continue;
      for (const contextName of owners) {
        conflictedContexts.set(contextName, (conflictedContexts.get(contextName) ?? 0) + 1);
      }
    }
    for (const [contextName, count] of conflictedContexts.entries()) {
      issues.push({
        severity: 'ERROR',
        code: 'CONTEXT_FILE_CONFLICT',
        contextName,
        message: `Contexto ${contextName} possui ${count} arquivo(s) em conflito com outro contexto.`
      });
    }
  }

  return issues;
}

export function readContextsConfig<Resource>(
  accessor: ContextConfigAccessor<Resource>,
  scope: 'user' | 'workspace',
  resource?: Resource
): ContextConfig[] {
  const inspected = accessor.inspectContexts(resource);
  const value = scope === 'workspace' ? inspected?.workspaceValue : inspected?.globalValue;
  return sanitizeContexts(Array.isArray(value) ? value : []);
}

export async function writeContextsConfig<Resource>(
  accessor: ContextConfigAccessor<Resource>,
  scope: 'user' | 'workspace',
  newConfig: ContextConfig[],
  resource?: Resource
): Promise<void> {
  await accessor.updateContexts(scope, newConfig, resource);
}

export function getEffectiveContexts<Resource>(accessor: ContextConfigAccessor<Resource>, resource?: Resource): ContextConfig[] {
  const user = readContextsConfig(accessor, 'user', resource);
  const workspace = readContextsConfig(accessor, 'workspace', resource);
  return [...user, ...workspace];
}
