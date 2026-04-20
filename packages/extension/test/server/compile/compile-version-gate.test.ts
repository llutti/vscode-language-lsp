import { describe, it, expect } from 'vitest';
import { mergeExpectedDocVersion, shouldSkipScheduledCompile } from '../../../src/server/compile/compile-version-gate';

describe('compile version gate', () => {
  it('ignora compile quando o documento atual ja esta em versao mais nova', () => {
    expect(shouldSkipScheduledCompile({ currentDocVersion: 7, expectedDocVersion: 6 })).toBe(true);
  });

  it('nao ignora quando versao esperada e igual a atual', () => {
    expect(shouldSkipScheduledCompile({ currentDocVersion: 7, expectedDocVersion: 7 })).toBe(false);
  });

  it('faz merge mantendo sempre a versao mais nova', () => {
    expect(mergeExpectedDocVersion(undefined, 4)).toBe(4);
    expect(mergeExpectedDocVersion(4, undefined)).toBe(4);
    expect(mergeExpectedDocVersion(4, 7)).toBe(7);
    expect(mergeExpectedDocVersion(9, 7)).toBe(9);
  });
});
