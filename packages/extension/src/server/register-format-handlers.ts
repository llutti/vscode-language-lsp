import { performance } from 'node:perf_hooks';
import type {
  CancellationToken,
  Connection,
  TextEdit
} from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { FormatWindow } from './compile/format-change-classifier';
import type { ResolvedContext } from './server-runtime';
import type { FormatDocumentReport } from '@lsp/compiler';

export function registerFormatHandlers(input: {
  connection: Connection;
  documents: Map<string, TextDocument>;
  recentFormatWindowByUri: Map<string, FormatWindow>;
  toFsPath(uri: string): string;
  sendLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: { id?: string; span?: string }, filePath?: string | null): void;
  getObservabilitySettingsForFile(filePath: string | null): unknown;
  observability: {
    span(settings: unknown, name: string, meta: { id: string }): () => void;
  };
  getFormatSettingsForFile(filePath: string): { enabled: boolean };
  formatDocumentDetailed(doc: TextDocument, settings: unknown): { edits: TextEdit[]; report: FormatDocumentReport };
  clampOffset(offset: number, length: number): number;
  preserveFinalNewline(originalText: string, nextText: string): string;
  recordFormatDecision(data: {
    filePath: string;
    requestId: string;
    uri: string;
    docVersion: number;
    decision: 'apply' | 'skip' | 'no_op' | 'error' | 'cancel';
    reason: string;
    editCount: number;
    editLength: number;
    durationMs: number;
    semanticPrewarm: 'applied' | 'skip_no_cache' | 'skip_empty' | 'skip_degraded' | 'not_needed';
    diagnosticsRefreshExpected: boolean;
    cursorAware: boolean;
    cancelledPhase?: string | null;
    formatReport?: FormatDocumentReport;
  }): void;
  runFormatRequest<T>(token: CancellationToken, run: () => T): { cancelled: false; result: T } | { cancelled: true; phase: string };
  remapCursorOffsetByEdits(doc: TextDocument, edits: TextEdit[], cursorOffset: number): number;
  schedulePullDiagnosticsRefresh(reason: string, workspaceUri?: string, delayMs?: number): void;
  findContextForFile(filePath: string): ResolvedContext | null;
  scheduleSemanticTokensRefresh(reason: string, delayMs?: number): void;
  getCurrentPullDiagnosticState(uri: string): { resultId: string | null; diagnosticsCount: number | null };
}): void
{
  const {
    connection,
    documents,
    recentFormatWindowByUri,
    toFsPath,
    sendLog,
    getObservabilitySettingsForFile,
    observability,
    getFormatSettingsForFile,
    formatDocumentDetailed,
    clampOffset,
    preserveFinalNewline,
    recordFormatDecision,
    runFormatRequest,
    remapCursorOffsetByEdits,
    schedulePullDiagnosticsRefresh,
    findContextForFile,
    scheduleSemanticTokensRefresh,
    getCurrentPullDiagnosticState
  } = input;

  const runFormatting = (
    doc: TextDocument,
    token: CancellationToken,
    cursorOffset?: number
  ): TextEdit[] | { edits: TextEdit[]; cursorOffset: number } =>
  {
    const filePath = toFsPath(doc.uri);
    const requestId = `${doc.uri}:${doc.version}${cursorOffset === undefined ? '' : ':cursor'}`;
    const startedAt = performance.now();
    const semanticPrewarm: 'applied' | 'skip_no_cache' | 'skip_empty' | 'skip_degraded' | 'not_needed' = 'not_needed';
    let formatSkipReason: string | null = null;
    let formatReport: FormatDocumentReport | undefined;

    try
    {
      const outcome = runFormatRequest(token, () =>
      {
        const obs = getObservabilitySettingsForFile(filePath);
        const requestEnd = observability.span(obs, cursorOffset === undefined ? 'format.request' : 'formatWithCursor.request', { id: requestId });
        const parseEnd = observability.span(obs, cursorOffset === undefined ? 'format.parse' : 'formatWithCursor.parse', { id: requestId });
        const settings = getFormatSettingsForFile(filePath);
        if (!settings.enabled) formatSkipReason = 'formatter_disabled';
        parseEnd();
        const printEnd = observability.span(obs, cursorOffset === undefined ? 'format.print' : 'formatWithCursor.print', { id: requestId });
        const originalText = doc.getText();
        const detailed = formatDocumentDetailed(doc, settings);
        formatReport = detailed.report;
        let edits = detailed.edits;

        if (edits.length > 0)
        {
          const len = originalText.length;
          const fullEnd = doc.positionAt(len);
          edits = edits.map((e) =>
          {
            const startOff = clampOffset(doc.offsetAt(e.range.start), len);
            const endOffRaw = clampOffset(doc.offsetAt(e.range.end), len);
            const endOff = endOffRaw < startOff ? startOff : endOffRaw;
            if (startOff === 0 && endOff === len)
            {
              return { range: { start: { line: 0, character: 0 }, end: fullEnd }, newText: e.newText };
            }
            return { range: { start: doc.positionAt(startOff), end: doc.positionAt(endOff) }, newText: e.newText };
          });
        }

        let nextText: string | null = null;
        if (edits.length > 0)
        {
          const applyEdits = (text: string): string =>
          {
            const len = text.length;
            const sorted = edits
              .map((e) => ({ e, start: clampOffset(doc.offsetAt(e.range.start), len), end: clampOffset(doc.offsetAt(e.range.end), len) }))
              .sort((a, b) => b.start - a.start);
            let out = text;
            for (const item of sorted)
            {
              out = out.slice(0, item.start) + item.e.newText + out.slice(item.end);
            }
            return out;
          };
          nextText = preserveFinalNewline(originalText, applyEdits(originalText));
          if (nextText === originalText)
          {
            edits = [];
            nextText = null;
          }
        }
        printEnd();
        observability.span(obs, cursorOffset === undefined ? 'format.diff' : 'formatWithCursor.diff', { id: requestId })();
        sendLog('debug', `format.edits: ${edits.length}`, { id: requestId, span: 'format.edits' }, filePath);

        if (edits.length > 0)
        {
          const pullDiagnosticState = getCurrentPullDiagnosticState(doc.uri);
          recentFormatWindowByUri.set(doc.uri, {
            baseVersion: doc.version,
            requestedAtMs: Date.now(),
            windowMs: 1500,
            telemetryWindowMs: 10000,
            requestId,
            editCount: edits.length,
            editLength: edits.reduce((sum, edit) => sum + edit.newText.length, 0),
            preFormatResultId: pullDiagnosticState.resultId,
            preFormatDiagnosticsCount: pullDiagnosticState.diagnosticsCount,
            authoritativeRearmScheduled: false
          });
          scheduleSemanticTokensRefresh('formatResult', 25);
          const context = findContextForFile(filePath);
          if (context)
          {
            schedulePullDiagnosticsRefresh('format', context.workspaceUri, 120);
          }
        }
        requestEnd();

        if (cursorOffset === undefined) return edits;
        return {
          edits,
          cursorOffset: edits.length > 0 ? remapCursorOffsetByEdits(doc, edits, cursorOffset) : cursorOffset
        };
      });

      if (outcome.cancelled)
      {
        recordFormatDecision({
          filePath,
          requestId,
          uri: doc.uri,
          docVersion: doc.version,
          decision: 'cancel',
          reason: 'request_cancelled',
          editCount: 0,
          editLength: 0,
          durationMs: Math.round(performance.now() - startedAt),
          semanticPrewarm,
          diagnosticsRefreshExpected: false,
        cursorAware: cursorOffset !== undefined,
        cancelledPhase: outcome.phase,
        formatReport
      });
        return cursorOffset === undefined ? [] : { edits: [], cursorOffset };
      }

      const result = outcome.result;
      const edits = Array.isArray(result) ? result : result.edits;
      const editLength = edits.reduce((sum, edit) => sum + edit.newText.length, 0);
      recordFormatDecision({
        filePath,
        requestId,
        uri: doc.uri,
        docVersion: doc.version,
        decision: edits.length > 0 ? 'apply' : (formatSkipReason ? 'skip' : 'no_op'),
        reason: edits.length > 0 ? 'full_document_edit' : (formatSkipReason ?? 'already_canonical'),
        editCount: edits.length,
        editLength,
        durationMs: Math.round(performance.now() - startedAt),
        semanticPrewarm,
        diagnosticsRefreshExpected: edits.length > 0,
        cursorAware: cursorOffset !== undefined,
        formatReport
      });
      return result;
    } catch (error)
    {
      sendLog('warn', `format: failed error=${String(error)}`, { id: requestId }, filePath);
      recordFormatDecision({
        filePath,
        requestId,
        uri: doc.uri,
        docVersion: doc.version,
        decision: 'error',
        reason: 'format_exception',
        editCount: 0,
        editLength: 0,
        durationMs: Math.round(performance.now() - startedAt),
        semanticPrewarm,
        diagnosticsRefreshExpected: false,
        cursorAware: cursorOffset !== undefined,
        formatReport
      });
      return cursorOffset === undefined ? [] : { edits: [], cursorOffset };
    }
  };

  connection.onDocumentFormatting((params, token: CancellationToken) =>
  {
    const doc = documents.get(params.textDocument.uri);
    if (!doc)
    {
      const filePath = toFsPath(params.textDocument.uri);
      const requestId = `${params.textDocument.uri}:missing`;
      recordFormatDecision({
        filePath,
        requestId,
        uri: params.textDocument.uri,
        docVersion: -1,
        decision: 'skip',
        reason: 'document_not_found',
        editCount: 0,
        editLength: 0,
        durationMs: 0,
        semanticPrewarm: 'not_needed',
        diagnosticsRefreshExpected: false,
        cursorAware: false
      });
      return [];
    }
    return runFormatting(doc, token) as TextEdit[];
  });

  connection.onRequest('lsp/formatWithCursor', (params: { textDocument: { uri: string }; cursorOffset: number }, token: CancellationToken) =>
  {
    const doc = documents.get(params.textDocument.uri);
    if (!doc)
    {
      const filePath = toFsPath(params.textDocument.uri);
      const requestId = `${params.textDocument.uri}:cursor:missing`;
      recordFormatDecision({
        filePath,
        requestId,
        uri: params.textDocument.uri,
        docVersion: -1,
        decision: 'skip',
        reason: 'document_not_found',
        editCount: 0,
        editLength: 0,
        durationMs: 0,
        semanticPrewarm: 'not_needed',
        diagnosticsRefreshExpected: false,
        cursorAware: true
      });
      return { edits: [], cursorOffset: params.cursorOffset };
    }
    return runFormatting(doc, token, params.cursorOffset);
  });
}
