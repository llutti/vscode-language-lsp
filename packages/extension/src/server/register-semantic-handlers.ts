import { performance } from 'node:perf_hooks';
import type { Connection, SemanticTokens } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';

type SemanticTokensDeltaParams = {
  textDocument?: { uri?: string };
  previousResultId?: string;
};

type SemanticTokensDeltaProvider = {
  onDelta?: (handler: (params: SemanticTokensDeltaParams) => Promise<SemanticTokens | { edits: Array<{ start: number; deleteCount: number; data: number[] }>; resultId: string }>) => void;
};

export function registerSemanticHandlers(input: {
  connection: Connection;
  documents: Map<string, TextDocument>;
  semanticRuntime: {
    state: { semanticTokensLastSentByUri: Map<string, { resultId: string; data: number[] }> };
    getSemanticTokensForDocument(doc: TextDocument): Promise<SemanticTokens>;
  };
  toFsPath(uri: string): string;
  computeSemanticTokensArrayDelta(previousData: number[], currentData: number[]): Array<{ start: number; deleteCount: number; data: number[] }>;
  observabilityLog(filePath: string, previousResultId: string): void;
  recordSemanticDecision(data: {
    filePath: string;
    requestId: string;
    uri: string;
    docVersion: number;
    tokenCount: number;
    durationMs: number;
    decision: 'fresh' | 'delta';
    reason: 'delta_missing_result_id' | 'delta_fallback_full' | 'delta_no_change' | 'delta_edit';
    source: 'delta';
    kind: 'delta';
    contextMatched?: boolean;
  }): void;
}): void
{
  const {
    connection,
    documents,
    semanticRuntime,
    toFsPath,
    computeSemanticTokensArrayDelta,
    observabilityLog,
    recordSemanticDecision
  } = input;

  const semanticTokensLastSentByUri = semanticRuntime.state.semanticTokensLastSentByUri;
  const { getSemanticTokensForDocument } = semanticRuntime;

  connection.languages.semanticTokens.on(async (params) =>
  {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return { data: [], resultId: '0' };
    return await getSemanticTokensForDocument(doc);
  });

  (connection.languages.semanticTokens as unknown as SemanticTokensDeltaProvider).onDelta?.(async (params) =>
  {
    const uri = params.textDocument?.uri ?? '';
    const previousResultId = params.previousResultId ?? '0';
    const doc = uri ? documents.get(uri) : undefined;
    if (!doc) return { edits: [], resultId: previousResultId };
    const filePath = toFsPath(uri);
    const requestId = `${uri}:${doc.version}:delta`;
    const startedAt = performance.now();
    const full = await getSemanticTokensForDocument(doc);
    const currentData = full.data ?? [];
    const currentResultId = full.resultId ?? `${doc.version}:full`;

    if (!full.resultId)
    {
      const rid = `${doc.version}:noid`;
      semanticTokensLastSentByUri.set(doc.uri, { resultId: rid, data: currentData });
      recordSemanticDecision({
        filePath,
        requestId,
        uri: doc.uri,
        docVersion: doc.version,
        tokenCount: currentData.length / 5,
        durationMs: Math.round(performance.now() - startedAt),
        decision: 'fresh',
        reason: 'delta_missing_result_id',
        source: 'delta',
        kind: 'delta'
      });
      return { data: currentData, resultId: rid };
    }

    const previous = semanticTokensLastSentByUri.get(doc.uri);
    if (!previous || previous.resultId !== previousResultId)
    {
      semanticTokensLastSentByUri.set(doc.uri, { resultId: currentResultId, data: currentData });
      recordSemanticDecision({
        filePath,
        requestId,
        uri: doc.uri,
        docVersion: doc.version,
        tokenCount: currentData.length / 5,
        durationMs: Math.round(performance.now() - startedAt),
        decision: 'fresh',
        reason: 'delta_fallback_full',
        source: 'delta',
        kind: 'delta'
      });
      return { data: currentData, resultId: currentResultId };
    }

    const edits = computeSemanticTokensArrayDelta(previous.data, currentData);
    semanticTokensLastSentByUri.set(doc.uri, { resultId: currentResultId, data: currentData });
    recordSemanticDecision({
      filePath,
      requestId,
      uri: doc.uri,
      docVersion: doc.version,
      tokenCount: currentData.length / 5,
      durationMs: Math.round(performance.now() - startedAt),
      decision: 'delta',
      reason: edits.length === 0 ? 'delta_no_change' : 'delta_edit',
      source: 'delta',
      kind: 'delta'
    });
    return { edits, resultId: currentResultId };
  });

  connection.onRequest('textDocument/semanticTokens/full/delta', async (params: unknown) =>
  {
    const req = (params ?? {}) as SemanticTokensDeltaParams;
    const uri = req.textDocument?.uri ?? '';
    const previousResultId = req.previousResultId ?? '0';
    const doc = uri ? documents.get(uri) : undefined;
    if (!doc) return { edits: [], resultId: previousResultId };
    const filePath = toFsPath(uri);
    const requestId = `${uri}:${doc.version}:deltaHard`;
    const startedAt = performance.now();
    observabilityLog(filePath, previousResultId);

    const full = await getSemanticTokensForDocument(doc);
    const currentData = full.data ?? [];
    const currentResultId = full.resultId ?? `${doc.version}:full`;
    const previous = semanticTokensLastSentByUri.get(doc.uri);
    if (!previous || previous.resultId !== previousResultId)
    {
      semanticTokensLastSentByUri.set(doc.uri, { resultId: currentResultId, data: currentData });
      recordSemanticDecision({
        filePath,
        requestId,
        uri: doc.uri,
        docVersion: doc.version,
        tokenCount: currentData.length / 5,
        durationMs: Math.round(performance.now() - startedAt),
        decision: 'fresh',
        reason: 'delta_fallback_full',
        source: 'delta',
        kind: 'delta'
      });
      return { data: currentData, resultId: currentResultId };
    }

    const edits = computeSemanticTokensArrayDelta(previous.data, currentData);
    semanticTokensLastSentByUri.set(doc.uri, { resultId: currentResultId, data: currentData });
    recordSemanticDecision({
      filePath,
      requestId,
      uri: doc.uri,
      docVersion: doc.version,
      tokenCount: currentData.length / 5,
      durationMs: Math.round(performance.now() - startedAt),
      decision: 'delta',
      reason: edits.length === 0 ? 'delta_no_change' : 'delta_edit',
      source: 'delta',
      kind: 'delta'
    });
    return { edits, resultId: currentResultId };
  });
}
