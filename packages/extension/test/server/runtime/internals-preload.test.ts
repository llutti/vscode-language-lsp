import { describe, it, expect } from 'vitest';
import { buildBootPreloadSystems, buildPreloadSystems, preloadInternals } from '../../../src/server/observability/internals-preload';

describe('internals preload', () => {
  it('boot preload carrega apenas SENIOR', () => {
    expect(buildBootPreloadSystems()).toEqual(['SENIOR']);
  });

  it('always starts with SENIOR and dedupes systems', async () => {
    const loaded: string[] = [];
    const systems = await preloadInternals({
      additionalSystems: ['HCM', 'ERP', 'HCM'],
      loadSignatures: async (system) => {
        loaded.push(system);
      }
    });

    expect(systems).toEqual(['SENIOR', 'HCM', 'ERP']);
    expect(loaded).toEqual(['SENIOR', 'HCM', 'ERP']);
  });

  it('filters invalid systems', () => {
    expect(buildPreloadSystems(['SENIOR', 'X', 'ACESSO'])).toEqual(['SENIOR', 'ACESSO']);
  });
});
