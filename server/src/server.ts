import
{
  CompletionItem,
  DidChangeConfigurationNotification,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  TextDocuments,
  createConnection
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { LSPContext } from './lsp-context';
import { LSPSeniorSystems } from './lsp-elements';
import { templatesInternosERP, templatesInternosHCM, templatesInternosSENIOR } from './lsp-internal-templates';
import { LSPParser } from './lsp-parser';
import { checkSintaxe, parserContent } from './lsp-parser-utils';

interface ILSPSettings
{
  maxNumberOfProblems: number;
  seniorSystem: Exclude<LSPSeniorSystems, typeof LSPSeniorSystems.CUSTOMIZADO>;
}

const connection = createConnection(ProposedFeatures.all);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

const defaultSettings: ILSPSettings = {
  maxNumberOfProblems: 1000,
  seniorSystem: LSPSeniorSystems.SENIOR,
};

const documentSettings: Map<string, Thenable<ILSPSettings>> = new Map();

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
// let hasDiagnosticRelatedInformationCapability = false;

let globalSettings: ILSPSettings = defaultSettings;

connection.onInitialize((params: InitializeParams) =>
{
  const capabilities = params.capabilities;

  LSPContext.loadInternalTemplates(templatesInternosSENIOR);
  LSPContext.loadInternalTemplates(templatesInternosHCM);
  // LSPContext.loadInternalTemplates(templatesInternosACESSO);
  LSPContext.loadInternalTemplates(templatesInternosERP);

  hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
  hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
  // hasDiagnosticRelatedInformationCapability = !!(
  //   capabilities.textDocument &&
  //   capabilities.textDocument.publishDiagnostics &&
  //   capabilities.textDocument.publishDiagnostics.relatedInformation
  // );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      definitionProvider: true,
      completionProvider: { resolveProvider: true, triggerCharacters: ['.'] },
      signatureHelpProvider: { triggerCharacters: ['(', ','] },
      hoverProvider: {}
    }
  };

  if (hasWorkspaceFolderCapability)
  {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }

  return result;
});

connection.onInitialized(() =>
{
  if (hasConfigurationCapability)
  {
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }

  if (hasWorkspaceFolderCapability)
  {
    connection.workspace.onDidChangeWorkspaceFolders(() =>
    {
      connection.console.log('Workspace folder change event received.');
    });
  }

  LSPParser.initialise().then();
});

interface UnencodedSemanticToken
{
  text: string;
  line: number;
  startChar: number;
  length: number;
  tokenType: string;
  tokenModifiers: string[];
}

async function handleSemanticTokens(params: { textDocument: TextDocument }): Promise<UnencodedSemanticToken[]>
{
  const { textDocument } = params;
  // const settings = await getDocumentSettings(textDocument.uri);
  const text = documents.get(textDocument.uri)?.getText() ?? '';
  const tokens = parserContent(text);
  const result: UnencodedSemanticToken[] = [];

  tokens
    .filter(token => token.type === 'Identificador')
    .filter(token => LSPContext.isCustomFunction(token?.value) === true)
    .forEach(
      token =>
      {
        result
          .push(
            {
              text: token.value,
              line: token.range.start.line,
              startChar: token.range.start.character,
              length: token.value.length,
              tokenType: token.type,
              tokenModifiers: [],
            });
      });

  return result;
}

connection.onRequest('getSemanticTokens', handleSemanticTokens);

connection.onDidChangeConfiguration(change =>
{
  if (hasConfigurationCapability)
  {
    // Reset all cached document settings
    documentSettings.clear();
  }
  else
  {
    globalSettings = <ILSPSettings>((change.settings.languageServerExample || defaultSettings));
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ILSPSettings>
{
  if (!hasConfigurationCapability)
  {
    return Promise.resolve(globalSettings);
  }

  let result = documentSettings.get(resource);
  if (!result)
  {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'lsp'
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose(async e =>
{
  documentSettings.delete(e.document.uri);

  // Limpar os diagnósticos existentes
  connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });

  return;
});

documents.onDidOpen(evt =>
{
  LSPContext.registerClasses(evt.document.uri, LSPParser.parseFile(evt.document.uri, evt.document.getText()));
  validateTextDocument(evt.document);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change =>
{
  LSPContext.registerClasses(change.document.uri, LSPParser.parseFile(change.document.uri, change.document.getText()));
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void>
{
  const settings = await getDocumentSettings(textDocument.uri);

  const text = textDocument.getText();
  const tokens = parserContent(text);
  const diagnostics = checkSintaxe(settings.maxNumberOfProblems, tokens);

  // Validar e enviar os erros ao VSCode
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [...diagnostics] });
}

// connection.onDidChangeWatchedFiles(_change =>
// {
//   // Monitored files have change in VSCode
//   connection.console.log('We received an file change event');
// });

connection.onHover(
  async ({ textDocument: { uri }, position }) =>
  {
    const settings = await getDocumentSettings(uri);
    return await LSPContext.getHoverInfo(position, documents.get(uri), settings.seniorSystem);
  }
);

// This handler provides the initial list of the completion items.
connection.onCompletion(
  async (docPos: TextDocumentPositionParams, token): Promise<CompletionItem[]> =>
  {
    const settings = await getDocumentSettings(docPos.textDocument.uri);
    return await LSPContext.getCompletions(docPos, token, documents.get(docPos.textDocument.uri), settings.seniorSystem);
  }
);

connection.onCompletionResolve(
  (item) =>
  {
    return item;
  }
);

connection.onSignatureHelp(
  async (docPos, token) =>
  {
    const settings = await getDocumentSettings(docPos.textDocument.uri);
    return await LSPContext.getSignatureHelp(docPos, token, documents.get(docPos.textDocument.uri), settings.seniorSystem);
  }
);

connection.onDefinition(
  async (params) =>
  {
    return await LSPContext.getDefinitionPosition(params, documents.get(params.textDocument.uri));
  }
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
