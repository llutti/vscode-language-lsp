export function normalizeDiagnosticCode(code: string): string {
  return code.trim().toUpperCase();
}

export function mergeIgnoredCodes(current: string[], incoming: string): string[] {
  const normalizedCurrent = current.map(normalizeDiagnosticCode).filter((value) => value);
  const normalizedIncoming = normalizeDiagnosticCode(incoming);
  if (!normalizedIncoming) return Array.from(new Set(normalizedCurrent));
  return Array.from(new Set([...normalizedCurrent, normalizedIncoming]));
}

export function removeIgnoredCode(current: string[], code: string): string[] {
  const normalized = normalizeDiagnosticCode(code);
  if (!normalized) return Array.from(new Set(current.map(normalizeDiagnosticCode).filter(Boolean)));
  return Array.from(new Set(current.map(normalizeDiagnosticCode).filter(Boolean))).filter((item) => item !== normalized);
}

export function mergeIgnoreIds(userIds: string[], workspaceIds: string[]): string[] {
  const normalizedUser = userIds.map(normalizeDiagnosticCode).filter(Boolean);
  const normalizedWorkspace = workspaceIds.map(normalizeDiagnosticCode).filter(Boolean);
  return Array.from(new Set([...normalizedUser, ...normalizedWorkspace]));
}

export function applyIgnoreIds<T extends { id?: string }>(diagnostics: T[], ignoreIds: Set<string>): T[] {
  if (ignoreIds.size === 0) return diagnostics;
  return diagnostics.filter((diag) => {
    const id = normalizeDiagnosticCode(String(diag.id ?? ''));
    return !id || !ignoreIds.has(id);
  });
}
