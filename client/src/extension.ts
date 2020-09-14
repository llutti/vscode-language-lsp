import * as path from 'path';
// import { workspace } from 'vscode';

import { LanguageClient, LanguageClientOptions, RevealOutputChannelOn, ServerOptions, TransportKind } from 'vscode-languageclient';

import * as vscode from 'vscode';
import { LSPHoverProvider } from './providers/lsp-hover-provider';
import { LSPCompletionItemProvider } from './providers/lsp-completion-item-provider';

export async function activate(context: vscode.ExtensionContext)
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
			fileEvents: vscode.workspace.createFileSystemWatcher('{**/*.txt,**/*.lspt,**/*.json}', false, false, true)
		},
		// initializationOptions: {
		//   config,
		//   globalSnippetDir
		// },
		revealOutputChannelOn: RevealOutputChannelOn.Never
	};

	// Create the language client and start the client.
	const client: LanguageClient = new LanguageClient(
		'lsp',
		'languageServerLSP',
		serverOptions,
		clientOptions
	);

	// vscode.languages.registerHoverProvider('lsp', new LSPHoverProvider());
	vscode.languages.registerCompletionItemProvider('lsp', new LSPCompletionItemProvider());

	const promise = client
		.onReady()
		.then(
			() =>
			{
				registerCustomClientNotificationHandlers(client);
			})
		.catch(e =>
		{
			console.log('Falhou a inicialização do "Client do LSP"');
		});

	context.subscriptions.push(client.start());

	return vscode.window.withProgress(
		{
			title: 'Inicializando LSP',
			location: vscode.ProgressLocation.Window
		},
		() => promise
	);
}

function registerCustomClientNotificationHandlers(client: LanguageClient)
{
	client.onNotification('$/displayInfo', (msg: string) =>
	{
		vscode.window.showInformationMessage(msg);
	});
	client.onNotification('$/displayWarning', (msg: string) =>
	{
		vscode.window.showWarningMessage(msg);
	});
	client.onNotification('$/displayError', (msg: string) =>
	{
		vscode.window.showErrorMessage(msg);
	});
	// client.onNotification('$/showVirtualFile', (virtualFileSource: string, prettySourceMap: string) => {
	//   setVirtualContents(virtualFileSource, prettySourceMap);
	// });
}
