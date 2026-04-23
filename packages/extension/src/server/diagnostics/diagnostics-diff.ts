import type { Diagnostic } from 'vscode-languageserver/node';

export type DiagnosticsDiff = {
  toPublish: Array<{ filePath: string; diagnostics: Diagnostic[] }>;
  toClear: string[];
  nextHashByFile: Map<string, string>;
};

type DiffInput = {
  prevFiles: Set<string>;
  prevHashByFile: Map<string, string>;
  nextFiles: Set<string>;
  nextByFile: Map<string, Diagnostic[]>;
};

function normalizeCode(code: Diagnostic['code']): string {
  if (code === null || code === undefined) return '';
  if (typeof code === 'string' || typeof code === 'number') return String(code);
  const value = (code as { value?: string | number }).value;
  return value === null || value === undefined ? '' : String(value);
}

function diagnosticKey(diag: Diagnostic): string {
  const range = diag.range;
  const start = range?.start ? `${range.start.line}:${range.start.character}` : '0:0';
  const end = range?.end ? `${range.end.line}:${range.end.character}` : '0:0';
  const severity = diag.severity ?? 0;
  const code = normalizeCode(diag.code);
  const message = diag.message ?? '';
  return `${start}-${end}|${severity}|${code}|${message}`;
}

export function hashDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) return '';
  const parts = diagnostics.map(diagnosticKey).sort();
  return parts.join('|');
}

export function computeDiagnosticsDiff(input: DiffInput): DiagnosticsDiff {
  const toPublish: Array<{ filePath: string; diagnostics: Diagnostic[] }> = [];
  const toClear: string[] = [];
  const nextHashByFile = new Map<string, string>();

  for (const filePath of input.nextFiles) {
    const diagnostics = input.nextByFile.get(filePath) ?? [];
    const nextHash = hashDiagnostics(diagnostics);
    nextHashByFile.set(filePath, nextHash);
    const prevHash = input.prevHashByFile.get(filePath);
    if (prevHash !== nextHash) {
      toPublish.push({ filePath, diagnostics });
    }
  }

  for (const oldPath of input.prevFiles) {
    if (!input.nextFiles.has(oldPath)) {
      toClear.push(oldPath);
    }
  }

  return { toPublish, toClear, nextHashByFile };
}
