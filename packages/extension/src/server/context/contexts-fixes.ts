import type { ContextConfig, ContextIssue } from './contexts-config';

export type ContextFixAction =
  | { kind: 'edit'; contextName: string; label: string; description: string }
  | { kind: 'disable'; contextName: string; label: string; description: string };

export function buildContextFixActions(issues: ContextIssue[]): ContextFixAction[] {
  const actions: ContextFixAction[] = [];
  const seen = new Set<string>();
  for (const issue of issues) {
    const key = `${issue.code}:${issue.contextName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (
      issue.code === 'CONTEXT_ROOTDIR_MISSING' ||
      issue.code === 'CONTEXT_PATTERN_INVALID' ||
      issue.code === 'CONTEXT_MATCH_ZERO'
    ) {
      actions.push({
        kind: 'edit',
        contextName: issue.contextName,
        label: `Corrigir contexto ${issue.contextName}`,
        description: issue.message
      });
      continue;
    }
    if (issue.code === 'CONTEXT_FILE_CONFLICT' || issue.code === 'CONTEXT_NAME_DUPLICATE') {
      actions.push({
        kind: 'disable',
        contextName: issue.contextName,
        label: `Desabilitar contexto ${issue.contextName}`,
        description: issue.message
      });
    }
  }
  return actions;
}

export function disableContextByName(contexts: ContextConfig[], contextName: string): ContextConfig[] {
  return contexts.filter((ctx) => ctx.name !== contextName);
}
