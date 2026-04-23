export function shouldScheduleNonAuthoritativeFollowup(input: {
  stableIsFresh: boolean;
  hasPendingOrRecentFollowup: boolean;
  hasRecentContextFullSignal: boolean;
  trackerAllowsSchedule: boolean;
}): boolean {
  if (input.stableIsFresh) return false;
  if (input.hasPendingOrRecentFollowup) return false;
  if (input.hasRecentContextFullSignal) return false;
  return input.trackerAllowsSchedule;
}
