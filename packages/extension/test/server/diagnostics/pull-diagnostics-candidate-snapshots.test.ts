import { describe, expect, it } from 'vitest';
import { buildPullCandidateSet, buildPullCandidateSnapshot } from '../../../src/server/diagnostics/pull-diagnostics-candidate-snapshots';

describe('pull diagnostics candidate snapshots', () => {
  const getResultVersion = (resultId: string | undefined) => {
    if (!resultId) return null;
    const [version] = resultId.split(':', 1);
    const parsed = Number(version);
    return Number.isFinite(parsed) ? parsed : null;
  };

  it('builds candidate snapshot with derived version distance', () => {
    const snapshot = buildPullCandidateSnapshot({
      kind: 'full',
      source: 'context-projected',
      resultId: '2:abc',
      docVersion: 4,
      dirtyStamp: 7,
      count: 1,
      ageMs: 10,
      isAuthoritative: false,
      getResultVersion
    });

    expect(snapshot.docVersionBase).toBe(2);
    expect(snapshot.docVersionDistance).toBe(2);
  });

  it('builds candidate set including chosen and visible-before snapshots', () => {
    const selection = buildPullCandidateSet({
      kind: 'full',
      source: 'context-projected',
      resultId: '2:abc',
      docVersion: 2,
      dirtyStamp: 7,
      resultCount: 1,
      resultAgeMs: 10,
      isAuthoritative: false,
      visibleBefore: {
        resultId: '1:old',
        hash: 'old',
        docVersion: 1,
        dirtyStamp: 6,
        contextKey: 'ctx',
        authoritative: false,
        reportedAtMs: 0
      },
      stableCandidate: null,
      nonEmptyCandidate: null,
      getResultVersion,
      visibleAuthorityAfter: 'projected'
    });

    expect(selection.chosenCandidate.resultId).toBe('2:abc');
    expect(selection.candidateSet).toHaveLength(2);
    expect(selection.rejectedCandidates).toHaveLength(1);
    expect(selection.visibleStateChanged).toBe(true);
  });
});
