import type { ResolvedContext } from '../server-runtime';
import type { PullDiagnosticsKind, PullDiagnosticsSource } from './pull-diagnostics-observability';

type FormatMarkerLike = {
  baseVersion: number;
  requestedAtMs: number;
  windowMs: number;
  editCount: number;
  preFormatResultId: string | null;
  authoritativeRearmScheduled?: boolean;
};

export function ensurePostFormatAuthoritativeFollowup(input: {
  context: ResolvedContext | undefined;
  uri: string;
  filePath: string;
  docVersion: number | undefined;
  dirtyStamp: number | null;
  resultId: string | undefined;
  kind: PullDiagnosticsKind;
  source: PullDiagnosticsSource;
  isAuthoritative: boolean;
  marker: FormatMarkerLike | undefined;
  hasPendingOrRecentFollowupForUri: (contextKey: string, uri: string) => boolean;
  shouldScheduleFollowup: (contextKey: string, uri: string, dirtyStamp: number | null, reason: string) => boolean;
  noteFollowupTarget: (contextKey: string, uri: string, dirtyStamp: number | null, docVersion: number | undefined, targetDirtyStamp: number | null) => void;
  scheduleCompile: (context: ResolvedContext, delayMs: number, reason: string, uri: string, input: {
    expectedDocVersion: number | undefined;
    changedFilePaths: string[];
    includeSemantics: boolean;
    includeSemanticPayload: boolean;
  }) => void;
  setMarker: (marker: FormatMarkerLike) => void;
}): boolean {
  const { context } = input;
  if (!context || typeof input.docVersion !== 'number' || input.dirtyStamp === null || typeof input.resultId !== 'string') return false;
  const marker = input.marker;
  if (!marker) return false;
  const nowMs = Date.now();
  if (!(input.docVersion > marker.baseVersion)) return false;
  if (nowMs > marker.requestedAtMs + marker.windowMs) return false;
  if (!(marker.editCount > 0)) return false;
  if (marker.preFormatResultId === null || marker.preFormatResultId !== input.resultId) return false;
  if (input.isAuthoritative) return false;
  if (input.kind !== 'unchanged' && input.source !== 'context-projected' && input.source !== 'fallback-compile') return false;
  if (marker.authoritativeRearmScheduled) return false;
  if (input.hasPendingOrRecentFollowupForUri(context.key, input.uri)) return false;
  if (!input.shouldScheduleFollowup(context.key, input.uri, input.dirtyStamp, 'postFormatRearm')) return false;
  input.noteFollowupTarget(context.key, input.uri, input.dirtyStamp, input.docVersion, input.dirtyStamp);
  marker.authoritativeRearmScheduled = true;
  input.setMarker(marker);
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
