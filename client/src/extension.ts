import { LanguageClient, LanguageClientOptions, RevealOutputChannelOn, ServerOptions, TransportKind } from 'vscode-languageclient';

import * as vscode from 'vscode';

import * as path from 'path';


let client: LanguageClient;

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
	client = new LanguageClient(
		'lsp',
		'Linguaguem de Suporte para "Linguaguem Senior de Programação"',
		serverOptions,
		clientOptions
	);

	client.start();
}

export function deactivate(): Thenable<void> {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
