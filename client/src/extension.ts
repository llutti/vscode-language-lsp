import { LanguageClient, LanguageClientOptions, RevealOutputChannelOn, ServerOptions, TransportKind } from 'vscode-languageclient/node';

import { ExtensionContext, workspace } from 'vscode';

import * as path from 'path';

let client: LanguageClient;

export async function activate(context: ExtensionContext)
{
	let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	};

	let clientOptions: LanguageClientOptions = {
		documentSelector: ['lsp'],
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher('{**/*.txt,**/*.lspt,**/*.json}')
		},
		// initializationOptions: {
		//   config,
		//   globalSnippetDir
		// },
		revealOutputChannelOn: RevealOutputChannelOn.Never
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'lsp',
		'Linguaguem de Suporte para "Linguaguem Senior de Programação"',
		serverOptions,
		clientOptions
	);

	// const collection = languages.createDiagnosticCollection('lsp');
	// if (window.activeTextEditor)
	// {
	// 	updateDiagnostics(window.activeTextEditor.document, collection);
	// }
	// context.subscriptions.push(window.onDidChangeActiveTextEditor(editor =>
	// {
	// 	if (editor)
	// 	{
	// 		updateDiagnostics(editor.document, collection);
	// 	}
	// }));

	client.start();
}

// function updateDiagnostics(document: TextDocument, collection: DiagnosticCollection): void
// {
// 	if (document)
// 	{
// 		// console.log('updateDiagnostics document.uri', document.uri);

// 		// collection.set(document.uri, [{
// 		// 	code: '',
// 		// 	message: 'cannot assign twice to immutable variable `x`',
// 		// 	range: new vscode.Range(new vscode.Position(3, 4), new vscode.Position(3, 10)),
// 		// 	severity: vscode.DiagnosticSeverity.Error,
// 		// 	source: '',
// 		// 	relatedInformation: [
// 		// 		new vscode.DiagnosticRelatedInformation(new vscode.Location(document.uri, new vscode.Range(new vscode.Position(1, 8), new vscode.Position(1, 9))), 'first assignment to `x`')
// 		// 	]
// 		// }]);
// 	}
// 	else
// 	{
// 		collection.clear();
// 	}
// }

export function deactivate(): Thenable<void> | undefined
{
	if (!client)
	{
		return undefined;
	}
	return client.stop();
}
