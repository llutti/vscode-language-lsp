import { createConnection, TextDocuments, Diagnostic, DiagnosticSeverity, ProposedFeatures, InitializeParams, DidChangeConfigurationNotification, CompletionItem, TextDocumentPositionParams, TextDocumentSyncKind, InitializeResult, CancellationToken, SignatureHelp, SignatureInformation, ParameterInformation } from 'vscode-languageserver';

import { TextDocument } from 'vscode-languageserver-textdocument';
import autoCompleteList from './assets/autocomplete';

import * as ts from 'typescript';
export type T_TypeScript = typeof import('typescript');
const tsModule: T_TypeScript = ts;

let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) =>
{
	let capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			// completionProvider: {
			// 	resolveProvider: true
			// }
			signatureHelpProvider: {
				triggerCharacters: ['(', ','],
			}
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
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}

	if (hasWorkspaceFolderCapability)
	{
		connection.workspace.onDidChangeWorkspaceFolders(
			_event =>
			{
				connection.console.log('Workspace folder change event received.');
			});
	}
});

// The example settings
interface LSPSettings
{
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: LSPSettings = { maxNumberOfProblems: 1000 };
let globalSettings: LSPSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<LSPSettings>> = new Map();

connection.onDidChangeConfiguration(change =>
{
	if (hasConfigurationCapability === true)
	{
		// Reset all cached document settings
		documentSettings.clear();
	}
	else
	{
		globalSettings = <LSPSettings>((change.settings.languageServerLSP || defaultSettings));
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<LSPSettings>
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
			section: 'languageServerLSP'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e =>
{
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change =>
{
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void>
{
	// // In this simple example we get the settings for every validate run.
	// let settings = await getDocumentSettings(textDocument.uri);

	// // The validator creates diagnostics for all uppercase words length 2 and more
	// let text = textDocument.getText();
	// let pattern = /\b[A-Z]{2,}\b/g;
	// let m: RegExpExecArray | null;

	// let problems = 0;
	// let diagnostics: Diagnostic[] = [];

	// while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems)
	// {
	// 	problems++;
	// 	let diagnostic: Diagnostic = {
	// 		severity: DiagnosticSeverity.Warning,
	// 		range: {
	// 			start: textDocument.positionAt(m.index),
	// 			end: textDocument.positionAt(m.index + m[0].length)
	// 		},
	// 		message: `${m[0]} is all uppercase.`,
	// 		source: 'ex'
	// 	};

	// 	if (hasDiagnosticRelatedInformationCapability)
	// 	{
	// 		diagnostic.relatedInformation = [
	// 			{
	// 				location: {
	// 					uri: textDocument.uri,
	// 					range: Object.assign({}, diagnostic.range)
	// 				},
	// 				message: 'Spelling matters'
	// 			},
	// 			{
	// 				location: {
	// 					uri: textDocument.uri,
	// 					range: Object.assign({}, diagnostic.range)
	// 				},
	// 				message: 'Particularly for names'
	// 			}
	// 		];
	// 	}
	// 	diagnostics.push(diagnostic);
	// }

	// // Send the computed diagnostics to VSCode.
	// connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change =>
{
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
// connection.onCompletion(
// 	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] =>
// 	{
// 		// The pass parameter contains the position of the text document in
// 		// which code complete got requested. For the example we ignore this
// 		// info and always provide the same completion items.
// 		return autoCompleteList.map<CompletionItem>((item, index) =>
// 		{
// 			return {
// 				label: item.label,
// 				kind: item.kind,
// 				data: index
// 			}
// 		})
// 	}
// );

// This handler resolves additional information for the item selected in
// the completion list.
// connection.onCompletionResolve(
// 	(item: CompletionItem): CompletionItem =>
// 	{
// 		const element = autoCompleteList.find((_, index) => index === item.data);

// 		item.detail = element?.detail();
// 		item.documentation = element?.documentation;
// 		item.kind = element?.kind;

// 		return item;
// 	}
// );

connection.onSignatureHelp((docPos, token) => getSignatureHelp(docPos, token));

const tokenSplitter = /([\w\$]+)/g;                     //Captures symbol names
const symbolMatcher = /[\w\$]+/g;                       //Like above but non-capturing
const firstSymbolMatcher = /(^[\w\$]+)/;                //Like above but from start of string only
const ambientValidator = /(?:^|\(|\[|,)\s*[\w\$]+$/g;   //Matches strings that end with an ambient symbol; fails for sub properties – ...hopefully
const braceMatcher = /{(?:(?!{).)*?}/g;                 //Matches well paired braces
const bracketMatcher = /\[(?:(?!\[).)*?\]/g;            //Matches well paired square brackets
const matchedParens = /\((?:(?!\().)*?\)/g;             //Matches well paired parentheses
const importLineMatcher = /(\bimport\s+)([\w$\.\*]+)/;  //Finds import statements (group 1: preamble, group 2: fully qualified class)
const superclassMatcher = /(\bextends\s+)([\w$\.\*]+)/; //Finds extends statements (group 1: preamble, group 2: class - possibly fully qualified)


function getSignatureHelp(textDocumentPosition: TextDocumentPositionParams, token: CancellationToken): SignatureHelp | null
{
	let lspSignature: SignatureInformation;
	const start = {
		line: textDocumentPosition.position.line,
		character: 0,
	};
	const end = {
		line: textDocumentPosition.position.line + 1,
		character: 0,
	};

	const document = documents.get(textDocumentPosition.textDocument.uri);
	let lineIndex = textDocumentPosition.position.line;
	let line = document?.getText({ start, end }).substr(0, textDocumentPosition.position.character).trim() || '';
	line = line.replace(braceMatcher, '');
	line = line.replace(bracketMatcher, '');

	let charIndex = line.length - 1;
	let unmatchedParentheses = 1;
	let paramIndex = 0;
	let char: string;

	while (charIndex >= 0)
	{
		char = line.charAt(charIndex);
		if (char === '(')
		{
			unmatchedParentheses--;
		}
		else
			if (char === ')')
			{
				unmatchedParentheses++;
			}
			else
				if (unmatchedParentheses === 1 && char === ',')
				{
					paramIndex++;
				}

		if (unmatchedParentheses === 0)
		{
			break;
		}

		charIndex--;
	}

	if (unmatchedParentheses !== 0)
	{
		return null;
	}

	let sigLabel = '';
	let callOuter = line.substring(0, charIndex);
	const funcao = autoCompleteList.find(x => x.label.toUpperCase() === callOuter.toUpperCase());

	if (!funcao)
	{
		return null;
	}

	const sigParamemterInfos: ParameterInformation[] = [];

	if (funcao.parameters)
	{
		let label: string = '';
		for (const iterator of funcao.parameters)
		{
			label = tsModule.displayPartsToString([{ text: `${iterator.type} ${iterator.isReturnValue ? 'End ' : ''}${iterator.name}`, kind: ts.SymbolDisplayPartKind.parameterName.toString() }]);
			sigParamemterInfos.push({
				label
				// documentation: `${iterator.type} ${iterator.isReturnValue ? 'End ' : ''}${iterator.name}`
			});
		}
	}

	sigLabel = funcao.detail();

	lspSignature = {
		label: sigLabel,
		documentation: funcao.documentation,
		parameters: sigParamemterInfos
	};

	return {
		signatures: [lspSignature],
		activeSignature: 0,
		activeParameter: paramIndex
	};
}

documents.listen(connection);

connection.listen();
