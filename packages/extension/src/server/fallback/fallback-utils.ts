export type FallbackSystem = 'HCM' | 'ACESSO' | 'ERP' | null;

export function normalizeFallbackSystem(value: unknown): FallbackSystem {
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const normalized = value.toUpperCase();
  if (normalized === 'HCM' || normalized === 'ACESSO' || normalized === 'ERP') {
    return normalized as FallbackSystem;
  }
  return null;
}

export function resolveEffectiveFallbackSystem(input: {
  override?: FallbackSystem | undefined;
  settingsDefault?: FallbackSystem | undefined;
}): FallbackSystem {
  if (input.override !== undefined) return input.override;
  if (input.settingsDefault !== undefined) return input.settingsDefault ?? null;
  return null;
}

export function formatStatusBarText(system: FallbackSystem): string {
  return system ? `LSP: ${system}` : 'LSP: Core';
}
