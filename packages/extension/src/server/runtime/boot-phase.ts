export type BootPhase = 'BOOTING' | 'CONTEXTS_READY' | 'IDLE';

export function canPublishDiagnostics(phase: BootPhase): boolean {
  return phase !== 'BOOTING';
}
