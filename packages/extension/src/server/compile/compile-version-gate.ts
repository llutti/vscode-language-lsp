export function shouldSkipScheduledCompile(input: {
  currentDocVersion?: number;
  expectedDocVersion?: number;
}): boolean {
  if (input.expectedDocVersion === undefined) return false;
  if (input.currentDocVersion === undefined) return false;
  return input.currentDocVersion > input.expectedDocVersion;
}

export function mergeExpectedDocVersion(current?: number, incoming?: number): number | undefined {
  if (current === undefined) return incoming;
  if (incoming === undefined) return current;
  return Math.max(current, incoming);
}
