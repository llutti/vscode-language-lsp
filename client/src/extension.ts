import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { ExtensionContext, workspace } from 'vscode';
import * as path from 'path';

let client: LanguageClient;

export async function activate(context: ExtensionContext)
{
	const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));

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
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'lsp',
		'Linguaguem de Suporte para "Linguaguem Senior de Programação"',
		serverOptions,
		clientOptions
	);

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
