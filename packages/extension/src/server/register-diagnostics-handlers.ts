import type { Connection, Diagnostic } from 'vscode-languageserver/node';

type PullDiagnosticRequestParams = {
  textDocument?: { uri?: string };
  previousResultId?: string;
};

type PullDiagnosticReport =
  | { kind: 'full'; items: Diagnostic[]; resultId?: string }
  | { kind: 'unchanged'; resultId: string };

export function registerDiagnosticsHandlers(input: {
  connection: Connection;
  handleDocumentDiagnostic(params: PullDiagnosticRequestParams | undefined): Promise<PullDiagnosticReport>;
}): void
{
  input.connection.onRequest('textDocument/diagnostic', async (params: PullDiagnosticRequestParams | undefined) =>
  {
    return await input.handleDocumentDiagnostic(params);
  });
}
