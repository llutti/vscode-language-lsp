import { CancellationToken, CompletionItem, CompletionParams, Hover, ParameterInformation, SignatureHelp, SignatureInformation, TextDocumentPositionParams } from 'vscode-languageserver';
import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import { LSPClass, LSPTemplateClass } from './lsp-elements';

const tokenSplitter = /([\w\$]+)/g;                     // Captures symbol names
const symbolMatcher = /[\w\$]+/g;                       // Like above but non-capturing
const firstSymbolMatcher = /(^[\w\$]+)/;                // Like above but from start of string only
const ambientValidator = /(?:^|\(|\[|,)\s*[\w\$]+$/g;   // Matches strings that end with an ambient symbol; fails for sub properties – ...hopefully
const braceMatcher = /{(?:(?!{).)*?}/g;                 // Matches well paired braces
const bracketMatcher = /\[(?:(?!\[).)*?\]/g;            // Matches well paired square brackets
const matchedParens = /\((?:(?!\().)*?\)/g;             // Matches well paired parentheses

export class LSPContext
{
	private static _classLookup: { [fullTypeOrUri: string]: LSPClass } = Object.create(null);
	private static _globalCompletions: CompletionItem[] = [];

	public static async getCompletions(textDocumentPosition: CompletionParams, cancellationToken: CancellationToken): Promise<CompletionItem[]>
	{
		return [];
	}

	public static async getSignatureHelp(textDocumentPosition: TextDocumentPositionParams, token: CancellationToken, document?: TextDocument): Promise<SignatureHelp | null>
	{
		if (!document)
		{
			return null;
		}

		let lspSignature: SignatureInformation;
		let lineIndex = textDocumentPosition.position.line;
		const start = {
			line: lineIndex,
			character: 0,
		};
		const end = {
			line: lineIndex + 1,
			character: 0,
		};


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
		let callOuter = line.substring(0, charIndex).toLowerCase();
		const funcao = this._classLookup[callOuter];

		if (!funcao)
		{
			return null;
		}

		const sigParamemterInfos: ParameterInformation[] = [];

		if (funcao.parameters)
		{
			for (const parametro of funcao.parameters)
			{
				sigParamemterInfos.push(
					{
						label: `${parametro.type} ${parametro.isReturnValue ? 'End ' : ''}${parametro.name}`,
						documentation: parametro.documenation
					}
				);
			}
		}

		sigLabel = funcao.signature();

		lspSignature = {
			label: sigLabel,
			documentation: funcao?.documentation,
			parameters: sigParamemterInfos
		};

		return {
			signatures: [lspSignature],
			activeSignature: 0,
			activeParameter: paramIndex
		};
	}

	public static async getHoverInfo(textDocumentPosition: TextDocumentPositionParams, document?: TextDocument): Promise<Hover | null>
	{
		const lineIndex = textDocumentPosition.position.line;
		const charIndex = textDocumentPosition.position.character;
		const start = {
			line: lineIndex,
			character: 0,
		};
		const end = {
			line: lineIndex + 1,
			character: 0,
		};

		let fullLine = document?.getText({ start, end }).trim() || '';
		if (!fullLine.charAt(charIndex).match(symbolMatcher))
		{
			return null;
		}

		let line = fullLine.substr(0, charIndex + 1).trim();
		if (this.positionInsideStringLiteral(line))
		{
			return null;
		}

		firstSymbolMatcher.lastIndex = 0;
		let result = firstSymbolMatcher.exec(fullLine.substr(charIndex + 1));
		if (result)
		{
			line += result[1];
		}

		let char: string;
		let startWord = charIndex;
		let endWord = charIndex;

		while (startWord > 0)
		{
			char = line.charAt(startWord);

			if ((/[[a-z0-9]/gi).test(char) === false)
			{
				break;
			}

			startWord--;
		}

		while (endWord < line.length)
		{
			char = line.charAt(endWord);

			if ((/[[a-z0-9]/gi).test(char) === false)
			{
				break;
			}

			endWord++;
		}

		let callOuter = line.substring(startWord, endWord).toLowerCase();
		const word = this._classLookup[callOuter];
		if (!word)
		{
			return null;
		}

		let hoverContents = `\`\`\`lsp\n${word.signature()}\n\`\`\``;
		if (word.documentation)
		{
			hoverContents = hoverContents + '\n---\n' + word.documentation?.toString();
		}

		const range: Range = {
			start: {
				line: lineIndex,
				character: startWord
			},
			end: {
				line: lineIndex,
				character: endWord
			}
		}

		return {
			contents: hoverContents,
			range
		};

	}

	public static registerClass(lspClass: LSPClass): void
	{
		if (!lspClass.name)
		{
			return;
		}

		this._classLookup[lspClass.name] = lspClass;
		this._classLookup[lspClass.fileUri] = lspClass;
	}

	public static loadInternalTemplates(templates: LSPTemplateClass[]): void
	{
		templates.forEach(template =>
		{
			let lspClass = LSPClass.fromTemplate(template, true);

			this.registerClass(lspClass);

			this._globalCompletions.push({
				label: lspClass.label,
				detail: lspClass.signature(),
				kind: lspClass.type
			});
		});
	}

	private static positionInsideStringLiteral(line: string, position?: number): boolean
	{
		position = position || line.length;
		let inString = false;
		let char: string;
		let lookingFor: string = '';
		for (let i = 0; i < position; i++)
		{
			char = line.charAt(i);
			if (inString)
			{
				if (char === lookingFor)
				{
					inString = false;
				} else if (char === '\\')
				{
					i++;
				}
			} else if (char === '\'' || char === '"')
			{
				inString = true;
				lookingFor = char;
			}
		}
		return inString;
	}
}