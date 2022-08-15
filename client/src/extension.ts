import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { CancellationToken, DocumentSemanticTokensProvider, ExtensionContext, languages, ProviderResult, SemanticTokens, SemanticTokensBuilder, SemanticTokensLegend, TextDocument, workspace } from 'vscode';
import * as path from 'path';

let client: LanguageClient;

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

const legend = (function ()
{
  const tokenTypesLegend = [
    'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
    'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
    'method', 'decorator', 'macro', 'variable', 'parameter', 'property', 'label'
  ];
  tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

  const tokenModifiersLegend = [
    'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
    'modification', 'async'
  ];
  tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

  return new SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();

export async function activate(context: ExtensionContext)
{
  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));

  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'lsp' }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('{**/*.txt,**/*.lspt,**/*.json}')
    },
    progressOnInitialization: true,
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'lsp',
    'Linguaguem de Suporte para "Linguaguem Senior de Programação"',
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client
    .start()
    .finally(
      () =>
      {
        context
          .subscriptions
          .push(
            languages.registerDocumentSemanticTokensProvider({ language: 'lsp' },
              new LSPDocumentSemanticTokensProvider(client), legend)
          );
      });
}

export function deactivate(): Thenable<void> | undefined
{
  if (!client)
  {
    return undefined;
  }
  return client.stop();
}

interface UnencodedSemanticToken
{
  text: string;
  line: number;
  startChar: number;
  length: number;
  tokenType: string;
  tokenModifiers: string[];
}

class LSPDocumentSemanticTokensProvider implements DocumentSemanticTokensProvider
{
  private client: LanguageClient;

  public constructor(client: LanguageClient)
  {
    this.client = client;
  }

  async provideDocumentSemanticTokens(textDocument: TextDocument, token: CancellationToken): Promise<SemanticTokens>
  {
    const parsedTokens: UnencodedSemanticToken[] = await this.client.sendRequest(
      'getSemanticTokens',
      {
        // uri is of different type for TextDocument in vscode and on server
        textDocument: { ...textDocument, uri: textDocument.uri.toString() },
      },
    );
    const tokenTypesId = tokenTypes.get('method') ?? 0;
    const builder = new SemanticTokensBuilder();

    for (const token of parsedTokens)
    {
      builder.push(
        token.line,
        token.startChar,
        token.length,
        tokenTypesId, // tokenTypes.get(token.tokenType) || 0,
        0,
      );
    }
    return builder.build();
  }
}
