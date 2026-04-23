import { describe, it, expect } from 'vitest';
import { shouldRunFallbackValidationOnOpen } from '../../../src/server/fallback/fallback-guard';

describe('integration: no fallback during boot under load', () => {
  it('blocks fallback while BOOTING and allows after contexts ready', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(
        shouldRunFallbackValidationOnOpen({
          bootPhase: 'BOOTING',
          refreshInProgress: true,
          hasContexts: false
        })
      ).toBe(false);
    }

    expect(
      shouldRunFallbackValidationOnOpen({
        bootPhase: 'CONTEXTS_READY',
        refreshInProgress: false,
        hasContexts: true
      })
    ).toBe(true);
  });
});
