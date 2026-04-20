import { describe, expect, it, vi } from 'vitest';
import { ensurePostFormatAuthoritativeFollowup } from '../../../src/server/diagnostics/pull-diagnostics-post-format-followup';
import type { ResolvedContext } from '../../../src/server/server-runtime';

const context: ResolvedContext = {
  key: 'ctx',
  name: 'CTX',
  rootDir: '/tmp',
  filePattern: '*.txt',
  includeSubdirectories: false,
  system: 'HCM',
  workspaceUri: 'file:///tmp',
  diagnosticsIgnoreIds: []
};

describe('pull diagnostics post-format followup', () => {
  it('schedules authoritative rearm when post-format reused a non-authoritative result', () => {
    const marker = {
      baseVersion: 2,
      requestedAtMs: Date.now() - 10,
      windowMs: 500,
      editCount: 1,
      preFormatResultId: '3:abc',
      authoritativeRearmScheduled: false
    };
    const scheduled = ensurePostFormatAuthoritativeFollowup({
      context,
      uri: 'file:///a.txt',
      filePath: '/tmp/a.txt',
      docVersion: 3,
      dirtyStamp: 7,
      resultId: '3:abc',
      kind: 'unchanged',
      source: 'context-projected',
      isAuthoritative: false,
      marker,
      hasPendingOrRecentFollowupForUri: () => false,
      shouldScheduleFollowup: () => true,
      noteFollowupTarget: vi.fn(),
      scheduleCompile: vi.fn(),
      setMarker: () => {}
    });

    expect(scheduled).toBe(true);
  });
});
