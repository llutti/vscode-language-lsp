import { createConnection, DidChangeConfigurationNotification, InitializeParams, InitializeResult, ProposedFeatures, TextDocuments, TextDocumentSyncKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { LSPContext } from './lsp-context';
import { templatesInternos } from './lsp-internal-templates';
import { LSPParser } from './lsp-parser';

LSPContext.loadInternalTemplates(templatesInternos);

const connection = createConnection(ProposedFeatures.all);  // Criar a conexão com o LSP (Language Server Protocol)

connection.console.info(`LSP server running in node ${process.version}`);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);  // Criar um gerenciador arquivos textos

let workspaceFolder: string | null;
connection.onInitialize(
	(params: InitializeParams) =>
	{
		// const capabilities = params.capabilities;

		connection.console.info(`LSP server start Initialize`);
		if ((params.workspaceFolders)
			&& (params.workspaceFolders?.length >= 1))
		{
			workspaceFolder = params.workspaceFolders[0].uri;
		}

		const result: InitializeResult = {
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Incremental,
				completionProvider: { resolveProvider: true, triggerCharacters: ['.'] },
				signatureHelpProvider: { triggerCharacters: ['(', ','] },
				hoverProvider: true,
				// definitionProvider: true // TODO: Não implementado
			}
		};

		return result;
	});

connection.onInitialized(() =>
{
	connection.console.info(`LSP server Initialized`);

	connection.client.register(DidChangeConfigurationNotification.type, undefined);
});

LSPParser.initialise()
	.then(() =>
	{
		documents.onDidOpen(evt => LSPContext.registerClasses(evt.document.uri, LSPParser.parseFile(evt.document.uri, evt.document.getText())));
		documents.onDidChangeContent(change => LSPContext.registerClasses(change.document.uri, LSPParser.parseFile(change.document.uri, change.document.getText())));
		connection.onCompletion((docPos, token) => LSPContext.getCompletions(docPos, token, documents.get(docPos.textDocument.uri)));
		connection.onSignatureHelp((docPos, token) => LSPContext.getSignatureHelp(docPos, token, documents.get(docPos.textDocument.uri)));
		connection.onHover(docPos => LSPContext.getHoverInfo(docPos, documents.get(docPos.textDocument.uri)));
		// connection.onDefinition(docPos => LSPContext.getDefinition(docPos)); // TODO: Não implementado
	});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
