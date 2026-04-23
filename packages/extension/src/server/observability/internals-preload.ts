import type { LspSystem } from '@lsp/compiler';

const VALID_SYSTEMS: LspSystem[] = ['SENIOR', 'HCM', 'ACESSO', 'ERP'];

export function buildBootPreloadSystems(): LspSystem[] {
  return ['SENIOR'];
}

export function buildPreloadSystems(additionalSystems: string[]): LspSystem[] {
  const ordered: LspSystem[] = ['SENIOR'];
  for (const raw of additionalSystems) {
    if (!VALID_SYSTEMS.includes(raw as LspSystem)) continue;
    const system = raw as LspSystem;
    if (!ordered.includes(system)) {
      ordered.push(system);
    }
  }
  return ordered;
}

export async function preloadInternals(input: {
  additionalSystems: string[];
  loadSignatures: (system: LspSystem) => Promise<unknown>;
}): Promise<LspSystem[]> {
  const systems = buildPreloadSystems(input.additionalSystems);
  for (const system of systems) {
    await input.loadSignatures(system);
  }
  return systems;
}
