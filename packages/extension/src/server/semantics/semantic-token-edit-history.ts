import type { DidChangeTextDocumentParams, TextDocumentContentChangeEvent } from 'vscode-languageserver/node';
import type { Range } from 'vscode-languageserver/node';
import type { SemanticTokenEdit } from './semantic-token-remap';

export type SemanticTokenEditBuffer = {
  edits: SemanticTokenEdit[];
};

export type SemanticTokenEditHistory = {
  reset: (uri: string) => void;
  record: (uri: string, fromVersion: number, toVersion: number, changes: DidChangeTextDocumentParams['contentChanges']) => void;
  get: (uri: string) => SemanticTokenEditBuffer | undefined;
  delete: (uri: string) => void;
  pruneToVersion: (uri: string, version: number) => void;
};

export function createSemanticTokenEditHistory(): SemanticTokenEditHistory {
  const byUri = new Map<string, SemanticTokenEditBuffer>();

  function isRangeChange(
    c: TextDocumentContentChangeEvent
  ): c is TextDocumentContentChangeEvent & { range: Range } {
    return 'range' in c && c.range !== undefined;
  }

  function reset(uri: string): void {
    byUri.set(uri, { edits: [] });
  }

  function record(
    uri: string,
    fromVersion: number,
    toVersion: number,
    changes: DidChangeTextDocumentParams['contentChanges']
  ): void {
    if (toVersion <= fromVersion) return;
    const buffer = byUri.get(uri) ?? { edits: [] };
    const last = buffer.edits.length > 0 ? buffer.edits[buffer.edits.length - 1] : null;
    if (last && last.toVersion !== fromVersion) {
      buffer.edits = [];
    }

    for (const change of changes) {
      if (!isRangeChange(change)) {
        buffer.edits = [];
        byUri.set(uri, buffer);
        return;
      }
    }

    for (const change of changes) {
      if (!isRangeChange(change)) continue;
      buffer.edits.push({
        fromVersion,
        toVersion,
        range: change.range,
        text: change.text
      });
    }

    if (buffer.edits.length > 50) {
      buffer.edits.splice(0, buffer.edits.length - 50);
    }
    byUri.set(uri, buffer);
  }

  function pruneToVersion(uri: string, version: number): void {
    const buffer = byUri.get(uri);
    if (!buffer) return;
    buffer.edits = buffer.edits.filter((edit) => edit.toVersion > version);
    byUri.set(uri, buffer);
  }

  return {
    reset,
    record,
    get: (uri: string) => byUri.get(uri),
    delete: (uri: string) => {
      byUri.delete(uri);
    },
    pruneToVersion
  };
}
