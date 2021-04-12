import { createConnection, ProposedFeatures, TextDocuments, TextDocumentSyncKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { LSPContext } from './lsp-context';
import { templatesInternos } from './lsp-internal-templates';
import { LSPParser } from './lsp-parser';

LSPContext.loadInternalTemplates(templatesInternos);

let connection = createConnection(ProposedFeatures.all);  // Criar a conexão com o LSP (Language Server Protocol)
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);  // Criar um gerenciador arquivos textos

documents.listen(connection); // Make the text document manager listen on the connection for open, change and close text document events

let workspaceFolder: string | null;
connection.onInitialize(
	(params) =>
	{
		if ((params.workspaceFolders)
			&& (params.workspaceFolders?.length >= 1))
		{
			workspaceFolder = params.workspaceFolders[0].uri;
		}

		return {
			capabilities: {
				textDocumentSync: TextDocumentSyncKind.Incremental,
				completionProvider: { resolveProvider: false, triggerCharacters: ['.'] },
				signatureHelpProvider: { triggerCharacters: ['(', ','] },
				hoverProvider: true,
				// definitionProvider: true // TODO: Não implementado
			}
		};
	});

connection.listen();

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
