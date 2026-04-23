import { describe, expect, it, vi } from 'vitest';
import { applyQuickFixWithPrompt } from '../../../src/server/language/quickfix-command-flow';

describe('quickfix command flow integration', () => {
  it('confirma nome e aplica edicao', async () => {
    const apply = vi.fn(async () => {});
    const result = await applyQuickFixWithPrompt('Aplicar', 'dNome', {
      askName: async () => 'dNomeFinal',
      apply,
      validateIdentifier: (value) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
    });

    expect(result).toBe(true);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith('dNomeFinal');
  });

  it('cancelamento do input retorna no-op', async () => {
    const apply = vi.fn(async () => {});
    const result = await applyQuickFixWithPrompt('Aplicar', 'dNome', {
      askName: async () => undefined,
      apply,
      validateIdentifier: (value) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
    });

    expect(result).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });
});
