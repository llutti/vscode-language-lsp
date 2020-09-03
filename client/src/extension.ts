import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';

import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

import * as vscode from 'vscode';
import { LSPHoverProvider } from './providers/hover-provider-lsp';

let client: LanguageClient;

export function activate(context: ExtensionContext)
{
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'lsp' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'languageServerLSP',
		serverOptions,
		clientOptions
	);

	// let disposable = vscode.commands.registerCommand('extension.mamar', () =>
	// {
	// 	vscode.window.showInformationMessage("The Star Rod... is powerful beyond belief. It can grant any wish. For as long as we can remember, Bowser has been making wishes like, for instance... 'I'd like to trounce Mario' or 'I want Princess Peach to like me.' Of course, Stars ignore such selfish wishes. As a result, his wishes were never granted.");
	// });

	// context.subscriptions.push(disposable);

	vscode.languages.registerHoverProvider('lsp', new LSPHoverProvider());
		// {
		// 	provideHover(document, position)
		// 	{
		// 		const range = document.getWordRangeAtPosition(position);
		// 		const word = document.getText(range);

		// 		if (word !== '')
		// 		{
		// 			return new vscode.Hover({
		// 				language: `language ${word}`,
		// 				value: word
		// 			});
		// 		}
		// 	}
		// });

	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable<void> | undefined
{
	if (!client)
	{
		return undefined;
	}
	return client.stop();
}
