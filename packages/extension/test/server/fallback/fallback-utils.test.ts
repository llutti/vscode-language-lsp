import { describe, it, expect } from 'vitest';
import { formatStatusBarText, resolveEffectiveFallbackSystem } from '../../../src/server/fallback/fallback-utils';

describe('fallback utils', () => {
  it('resolves effective fallback system with override precedence', () => {
    expect(resolveEffectiveFallbackSystem({ override: 'ERP', settingsDefault: 'HCM' })).toBe('ERP');
    expect(resolveEffectiveFallbackSystem({ override: null, settingsDefault: 'HCM' })).toBeNull();
    expect(resolveEffectiveFallbackSystem({ override: undefined, settingsDefault: 'ACESSO' })).toBe('ACESSO');
    expect(resolveEffectiveFallbackSystem({ override: undefined, settingsDefault: undefined })).toBeNull();
  });

  it('formats status bar text', () => {
    expect(formatStatusBarText(null)).toBe('LSP: Core');
    expect(formatStatusBarText('ERP')).toBe('LSP: ERP');
  });
});
