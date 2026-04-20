import type { ResolvedContext } from '../server-runtime';
import type { PullDiagnosticsSource } from './pull-diagnostics-observability';

export function scheduleStickyDiagnosticsFollowup(input: {
  context: ResolvedContext | undefined;
  uri: string;
  filePath: string;
  docVersion: number | undefined;
  dirtyStamp: number | null;
  hasPendingOrRecentFollowupForUri: (contextKey: string, uri: string) => boolean;
  shouldScheduleFollowup: (contextKey: string, uri: string, dirtyStamp: number | null, reason: string) => boolean;
  noteFollowupTarget: (contextKey: string, uri: string, dirtyStamp: number | null, docVersion: number | undefined, targetDirtyStamp: number | null) => void;
  scheduleCompile: (context: ResolvedContext, delayMs: number, reason: string, uri: string, input: {
    expectedDocVersion: number | undefined;
    changedFilePaths: string[];
    includeSemantics: boolean;
    includeSemanticPayload: boolean;
  }) => void;
}): boolean {
  const { context } = input;
  if (!context || input.dirtyStamp === null) return false;
  if (input.hasPendingOrRecentFollowupForUri(context.key, input.uri)) return false;
  if (!input.shouldScheduleFollowup(context.key, input.uri, input.dirtyStamp, 'stickyEditBurst')) return false;
  input.noteFollowupTarget(context.key, input.uri, input.dirtyStamp, input.docVersion, input.dirtyStamp);
  input.scheduleCompile(
    context,
    0,
    'pullDiagnosticsGlobalFollowup',
    input.uri,
    {
      expectedDocVersion: input.docVersion,
      changedFilePaths: [input.filePath],
      includeSemantics: true,
      includeSemanticPayload: false
    }
  );
  return true;
}

export function scheduleDidOpenZeroAuthoritativeFollowup(input: {
  context: ResolvedContext;
  uri: string;
  filePath: string;
  docVersion: number | undefined;
  dirtyStamp: number | null;
  source: PullDiagnosticsSource;
  isAuthoritative: boolean;
  requestReceivedAtMs: number;
  didOpenReceivedAt?: number;
  didOpenFollowupWindowMs: number;
  hasPendingOrRecentFollowupForUri: (contextKey: string, uri: string) => boolean;
  shouldScheduleFollowup: (contextKey: string, uri: string, dirtyStamp: number | null, reason: string) => boolean;
  noteFollowupTarget: (contextKey: string, uri: string, dirtyStamp: number | null, docVersion: number | undefined, targetDirtyStamp: number | null) => void;
  setFollowupScheduleReason: (contextKey: string, uri: string, dirtyStamp: number | null, reason: string) => void;
  getFollowupOutcome: (contextKey: string, uri: string, dirtyStamp: number | null, docVersion: number | undefined) => {
    scheduleReason?: string;
    lastResultCount?: number | null;
  } | null;
  scheduleCompile: (context: ResolvedContext, delayMs: number, reason: string, uri: string, input: {
    expectedDocVersion: number | undefined;
    changedFilePaths: string[];
    includeSemantics: boolean;
    includeSemanticPayload: boolean;
  }) => void;
  logDebug: (message: string, data: Record<string, unknown>) => void;
}): boolean {
  if (input.didOpenReceivedAt === undefined) {
    input.logDebug('pullDiagnostics.authoritativeFollowup skipped=noDidOpenTimestamp', {
      reason: 'didOpenZero',
      source: input.source,
      dirtyStamp: input.dirtyStamp,
      skipped: 'noDidOpenTimestamp'
    });
    return false;
  }

  const didOpenAgeAtRequestMs = input.requestReceivedAtMs - input.didOpenReceivedAt;
  const didOpenAgeNowMs = Date.now() - input.didOpenReceivedAt;
  if (didOpenAgeAtRequestMs > input.didOpenFollowupWindowMs) {
    input.logDebug('pullDiagnostics.authoritativeFollowup skipped=didOpenWindowExpired', {
      reason: 'didOpenZero',
      source: input.source,
      dirtyStamp: input.dirtyStamp,
      skipped: 'didOpenWindowExpired',
      didOpenAgeAtRequestMs,
      didOpenAgeNowMs
    });
    return false;
  }

  if (input.source === 'persisted-cache' || input.source === 'boot-empty') {
    input.logDebug('pullDiagnostics.authoritativeFollowup skipped=sourceNotEligible', {
      reason: 'didOpenZero',
      source: input.source,
      dirtyStamp: input.dirtyStamp,
      skipped: 'sourceNotEligible',
      didOpenAgeAtRequestMs,
      didOpenAgeNowMs
    });
    return false;
  }

  if (input.hasPendingOrRecentFollowupForUri(input.context.key, input.uri)) {
    const outcome = input.getFollowupOutcome(input.context.key, input.uri, input.dirtyStamp, input.docVersion);
    input.logDebug('pullDiagnostics.authoritativeFollowup skipped=recentUriFollowup', {
      reason: 'didOpenZero',
      source: input.source,
      dirtyStamp: input.dirtyStamp,
      skipped: 'recentUriFollowup',
      didOpenAgeAtRequestMs,
      didOpenAgeNowMs,
      existingScheduleReason: outcome?.scheduleReason ?? null,
      existingLastResultCount: outcome?.lastResultCount ?? null
    });
    return false;
  }

  const shouldSchedule = input.shouldScheduleFollowup(input.context.key, input.uri, input.dirtyStamp, 'didOpenZero');
  if (shouldSchedule) {
    input.noteFollowupTarget(input.context.key, input.uri, input.dirtyStamp, input.docVersion, input.dirtyStamp);
  }
  if (!shouldSchedule) {
    const outcome = input.getFollowupOutcome(input.context.key, input.uri, input.dirtyStamp, input.docVersion);
    input.logDebug('pullDiagnostics.authoritativeFollowup skipped=alreadyPending', {
      reason: 'didOpenZero',
      source: input.source,
      dirtyStamp: input.dirtyStamp,
      skipped: 'alreadyPending',
      didOpenAgeAtRequestMs,
      didOpenAgeNowMs,
      existingScheduleReason: outcome?.scheduleReason ?? null,
      existingLastResultCount: outcome?.lastResultCount ?? null
    });
    return false;
  }

  input.setFollowupScheduleReason(input.context.key, input.uri, input.dirtyStamp, 'didOpenZero');
  input.scheduleCompile(
    input.context,
    0,
    'pullDiagnosticsGlobalFollowup',
    input.uri,
    {
      expectedDocVersion: input.docVersion,
      changedFilePaths: [input.filePath],
      includeSemantics: true,
      includeSemanticPayload: false
    }
  );
  input.logDebug('pullDiagnostics.authoritativeFollowup reason=didOpenZero', {
    reason: 'didOpenZero',
    source: input.source,
    dirtyStamp: input.dirtyStamp,
    delayMs: 0,
    didOpenAgeAtRequestMs,
    didOpenAgeNowMs,
    authoritativeAtResponse: input.isAuthoritative
  });
  return true;
}
