import { EParameterType, LSPClass, LSPParameter, LSPTypeObject } from './lsp-elements';

const Patterns = {
	// IMPORT: /\bimport\s+([\w$\.\*]+)/,
	// CLASS: /(\bclass\s+)([\w$\.]+)/,
	// CLASS_EXTENDS: /\bextends\s+([\w$\.]+)/,
	// CLASS_VAR: /(\bvar\s+)([\w$]+)(?:\s*:\s*([\w$\.]+))?/,                //Group 2: var name; group 3 (optional): type
	// PRIVATE: /\bprivate\b/,
	// STATIC: /\bstatic\b/,
	FUNCAO: /(\bdefinir\s+)(\bfuncao\s+)([\w$]+)(\s*\()(.*)\)(?:\s*:\s*([\w$\.]+))?/i,
	IDENTIFIER_AND_TYPE: /((\bnumero\s+)(\bend\s+){0,1}([\w$]+))/i,
	// LOCAL_VARS: /(\bvar\b)([\s\w$:,=.\[\]()-+*/"']+)/,                    //Group 2: content
	// BRACES: /[{}]/g,
	// MATCHED_BRACES: /{(?:(?!{).)*?}/g,
	// MATCHED_BRACKETS: /\[(?:(?!\[).)*?\]/g,
	// MATCHED_PARENS: /\((?:(?!\().)*?\)/g
};


export class LSPParser
{
	private static wipClass: LSPClass;
	private static isReady: PromiseLike<any> = Promise.resolve();

	public static initialise(): PromiseLike<any>
	{
		return this.isReady;
	}  // Placeholder in case we need to initialise onigasm here

	public static parseFile(fileUri: string, fileContent: string, deep: boolean = false, isIntrinsic: boolean = false): LSPClass[]
	{
		const classes: LSPClass[] = []
		let result: RegExpExecArray | null;
		let line: string;
		const lines = splitAndSanitize(fileContent);

		for (let i = 0, l = lines.length; i < l; i++)
		{
			line = lines[i];

			Patterns.FUNCAO.lastIndex = 0;
			result = Patterns.FUNCAO.exec(line);

			if (result)
			{
				const classe = new LSPClass(result[3], false);

				classe.label = result[3];
				classe.type = LSPTypeObject.Method;
				classe.parameters = LSPParser.getParameterArrayFromString(result[5]);
				classe.fileUri = fileUri;
				classes.push(classe);
			}
		}

		return classes;
	}

	private static getParameterArrayFromString(paramString: string): LSPParameter[]
	{
		let parsedParams: LSPParameter[] = [];
		if ((!paramString) || paramString.trim() === '')
		{
			return parsedParams;
		}

		let rawParams = paramString.split(',');
		let result: RegExpExecArray | null;
		let params: string;
		for (let i = 0, l = rawParams.length; i < l; i++)
		{
			Patterns.IDENTIFIER_AND_TYPE.lastIndex = 0;
			params = rawParams[i].trim();
			result = Patterns.IDENTIFIER_AND_TYPE.exec(params);
			if (result && (result[2]))
			{
				let param: LSPParameter = {
					type: EParameterType.Numero,
					name: result[4],
					isReturnValue: !!result[3]
				};

				parsedParams.push(param);
			}
		}
		return parsedParams;
	}
}

enum SanitizationState
{
	BASE = 1,
	STRING,
	BLOCK_COMMENT
}

//TODO: update to preserve comments in line-mapped array
export function splitAndSanitize(rawCode: string): string[]
{
	let sanitizedLines: string[] = [];
	let rawLines = rawCode.split(/\r?\n/);
	let state = SanitizationState.BASE;
	let sanitizedLine: string, char: string, nextChar: string, stringDelineator: string, i: number, l: number;

	rawLines.forEach(rawLine =>
	{
		sanitizedLine = '';
		state = state === SanitizationState.STRING ? SanitizationState.BASE : state;
		nextChar = rawLine[0];

		charLoop: for (i = 0, l = rawLine.length; i < l; i++)
		{
			char = nextChar;
			nextChar = rawLine[i + 1];

			stateSwitch: switch (state)
			{
				case SanitizationState.BASE:
					charSwitch: switch (char)
					{
						case `'`:
						case `"`:
							state = SanitizationState.STRING;
							stringDelineator = char;
							break charSwitch;
						case `/`:
							if (nextChar === `/`)
							{
								sanitizedLine += `//`;
								break charLoop;
							}
							if (nextChar === `*`)
							{
								sanitizedLine += `/*`;
								i++;
								state = SanitizationState.BLOCK_COMMENT;
								break stateSwitch;
							}
							break charSwitch;
					}
					sanitizedLine += char;
					break stateSwitch;

				case SanitizationState.STRING:
					charSwitch: switch (char)
					{
						case `\\`:
							sanitizedLine += ` `;
							i++;
							break charSwitch;
						case stringDelineator:
							sanitizedLine += char;
							state = SanitizationState.BASE;
							break stateSwitch;
					}
					sanitizedLine += ` `;
					break stateSwitch;

				case SanitizationState.BLOCK_COMMENT:
					if (char === `*` && nextChar === `/`)
					{
						sanitizedLine += `*/`;
						i++;
						state = SanitizationState.BASE;
					} else
					{
						sanitizedLine += ' ';
					}
					break stateSwitch;
			}
		}
		sanitizedLines.push(sanitizedLine);
	});

	return sanitizedLines;
}
