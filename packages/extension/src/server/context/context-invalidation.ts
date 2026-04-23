export const CONTEXT_INVALIDATION_REASONS = [
  'refresh_contexts',
  'watched_file_change'
 ] as const;

export type ContextInvalidationReason = typeof CONTEXT_INVALIDATION_REASONS[number];

export const CONTEXT_INVALIDATION_TARGETS = [
  'all',
  'file',
  'context'
 ] as const;

export type ContextInvalidationTarget = typeof CONTEXT_INVALIDATION_TARGETS[number];
