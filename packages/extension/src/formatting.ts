import type { TextEdit } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import {
  formatDocumentWithDetails as formatDocumentWithDetailsText,
  type FormatDocumentReport,
  type FormatOptions
} from '@lsp/compiler';

export type FormatSettings = FormatOptions & {
  enabled: boolean;
};

export type FormatDocumentDetailedResult = {
  edits: TextEdit[];
  report: FormatDocumentReport;
};

function detectEol(text: string): '\r\n' | '\n' {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function emptyFormatReport(settings: FormatSettings): FormatDocumentReport {
  return {
    format: {
      decision: 'no_op',
      reason: 'already_canonical',
      parseErrors: [],
      parseErrorCount: 0
    },
    embeddedSql: {
      enabled: Boolean(settings.embeddedSqlEnabled),
      attempts: [],
      attemptedCount: 0,
      eligibleCount: 0,
      appliedCount: 0,
      noOpCount: 0,
      rejectedCount: 0,
      errorCount: 0,
      debug: { events: [], eventCount: 0 }
    }
  } as FormatDocumentReport;
}

/**
 * LSP requirement for this milestone:
 * - return a single TextEdit replacing the entire document.
 */
export function formatDocument(doc: TextDocument, settings: FormatSettings): TextEdit[] {
  return formatDocumentDetailed(doc, settings).edits;
}

export function formatDocumentDetailed(doc: TextDocument, settings: FormatSettings): FormatDocumentDetailedResult {
  if (!settings.enabled) {
    return {
      edits: [],
      report: emptyFormatReport(settings)
    };
  }
  try {
    const { enabled: _enabled, ...options } = settings;
    const originalText = doc.getText();
    const eol = detectEol(originalText);

    const formatted = formatDocumentWithDetailsText({
      sourcePath: doc.uri,
      text: originalText,
      options,
      eol
    });

    if (formatted.text === originalText) return { edits: [], report: formatted.report };
    return {
      edits: [
      {
        range: {
          start: doc.positionAt(0),
          end: doc.positionAt(originalText.length)
        },
        newText: formatted.text
      }
    ],
      report: formatted.report
    };
  } catch {
    return {
      edits: [],
      report: emptyFormatReport(settings)
    };
  }
}
