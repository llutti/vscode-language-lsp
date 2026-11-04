export type PullDiagnosticsCacheEntry = {
  resultId: string;
  hash: string;
};

export function buildPullDiagnosticsResultId(input: {
  docVersion: number | undefined;
  hash: string;
  contextMatched: boolean;
  ignoredIds: Iterable<string>;
}): string {
  const ignoreKey = input.contextMatched
    ? ''
    : [...input.ignoredIds].sort().join(',');
  return `${input.docVersion ?? 0}:${input.hash}${ignoreKey ? `:ignore=${ignoreKey}` : ''}`;
}

export function canReusePullDiagnosticsResult(input: {
  cached: PullDiagnosticsCacheEntry | undefined;
  previousResultId: string | undefined;
  hash: string;
  resultId: string;
}): boolean {
  return Boolean(
    input.cached
    && input.previousResultId
    && input.cached.resultId === input.previousResultId
    && input.cached.resultId === input.resultId
    && input.cached.hash === input.hash
  );
}
