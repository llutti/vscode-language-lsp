export type FormatWindow = {
  baseVersion: number;
  requestedAtMs: number;
  windowMs: number;
  telemetryWindowMs: number;
  requestId: string;
  editCount: number;
  editLength: number;
  preFormatResultId: string | null;
  preFormatDiagnosticsCount: number | null;
  authoritativeRearmScheduled?: boolean;
};

export function isLikelyFormatDrivenChange(input: {
  changeVersion: number;
  nowMs: number;
  marker?: FormatWindow;
}): boolean {
  const marker = input.marker;
  if (!marker) return false;
  if (input.changeVersion <= marker.baseVersion) return false;
  return input.nowMs <= marker.requestedAtMs + marker.windowMs;
}

export function isUndoLikeHashTransition(input: {
  nextHash: string;
  previousHash: string | null;
  beforePreviousHash: string | null;
  elapsedMs: number;
  windowMs: number;
}): boolean {
  if (!input.previousHash || !input.beforePreviousHash) return false;
  if (input.nextHash !== input.beforePreviousHash) return false;
  return input.elapsedMs <= input.windowMs;
}
