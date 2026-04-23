import type { Diagnostic } from 'vscode-languageserver/node';
import { computeDiagnosticsDiff } from './diagnostics-diff';

export type CommitDiagnosticsInput = {
  prevFiles: Set<string>;
  prevHashByFile: Map<string, string>;
  nextFiles: Set<string>;
  nextByFile: Map<string, Diagnostic[]>;
};

export type CommitDiagnosticsResult = {
  nextHashByFile: Map<string, string>;
  changedFiles: string[];
  clearedFiles: string[];
};

export function commitDiagnostics(input: CommitDiagnosticsInput): CommitDiagnosticsResult {
  const diff = computeDiagnosticsDiff({
    prevFiles: input.prevFiles,
    prevHashByFile: input.prevHashByFile,
    nextFiles: input.nextFiles,
    nextByFile: input.nextByFile
  });

  return {
    nextHashByFile: diff.nextHashByFile,
    changedFiles: diff.toPublish.map((entry) => entry.filePath),
    clearedFiles: diff.toClear
  };
}
