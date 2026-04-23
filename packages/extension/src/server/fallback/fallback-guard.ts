import type { BootPhase } from '../runtime/boot-phase';

export function shouldRunFallbackValidationOnOpen(input: {
  bootPhase: BootPhase;
  refreshInProgress: boolean;
  hasContexts: boolean;
}): boolean {
  if (input.refreshInProgress) return false;
  if (input.bootPhase === 'BOOTING') return false;
  if (!input.hasContexts) return false;
  return true;
}
