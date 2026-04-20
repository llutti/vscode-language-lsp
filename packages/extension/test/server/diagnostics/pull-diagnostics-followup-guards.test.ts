import { describe, expect, it } from 'vitest';
import { shouldScheduleNonAuthoritativeFollowup } from '../../../src/server/diagnostics/pull-diagnostics-followup-guards';

describe('pull diagnostics followup guards', () => {
  it('suppresses non-authoritative follow-up when a full compile signal is already recent', () => {
    expect(shouldScheduleNonAuthoritativeFollowup({
      stableIsFresh: false,
      hasPendingOrRecentFollowup: false,
      hasRecentContextFullSignal: true,
      trackerAllowsSchedule: true
    })).toBe(false);
  });

  it('suppresses non-authoritative follow-up when a fresh stable snapshot or pending follow-up already exists', () => {
    expect(shouldScheduleNonAuthoritativeFollowup({
      stableIsFresh: true,
      hasPendingOrRecentFollowup: false,
      hasRecentContextFullSignal: false,
      trackerAllowsSchedule: true
    })).toBe(false);

    expect(shouldScheduleNonAuthoritativeFollowup({
      stableIsFresh: false,
      hasPendingOrRecentFollowup: true,
      hasRecentContextFullSignal: false,
      trackerAllowsSchedule: true
    })).toBe(false);
  });

  it('allows non-authoritative follow-up only when the tracker still permits scheduling', () => {
    expect(shouldScheduleNonAuthoritativeFollowup({
      stableIsFresh: false,
      hasPendingOrRecentFollowup: false,
      hasRecentContextFullSignal: false,
      trackerAllowsSchedule: false
    })).toBe(false);

    expect(shouldScheduleNonAuthoritativeFollowup({
      stableIsFresh: false,
      hasPendingOrRecentFollowup: false,
      hasRecentContextFullSignal: false,
      trackerAllowsSchedule: true
    })).toBe(true);
  });
});
