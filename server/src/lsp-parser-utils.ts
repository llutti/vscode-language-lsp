import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { Position, Range } from 'vscode-languageserver-textdocument';

type LSPTokenType = 'Alfa' | 'Numero' | 'Simbolo' | 'ComentarioLinha' | 'ComentarioBloco' | 'Identificador' | 'PalavraReservada' | 'Desconhecido';

interface LSPToken
{
	innerId: number; // ID Sequencial
	range: Range;
	value: string;
	type: LSPTokenType;
}

const parserContent = (text: string): LSPToken[] =>
{
	const delimiters = '><,.;=()[]{}\\/+-*@"';
	const numbersValids = '0123456789';
	const tokens: LSPToken[] = [];
	let innerId = 0;
	let charPosition = 0;
	let charValue = '';
	let nextCharValue = '';
	let token = '';
	let lineNumber = 0;
	let charLinePosition = 0;
	let startToken: Position = {
		line: 0,
		character: 0
	};
	let ehIdentificador = false;

	const addToken = (params: { startToken: Position, endToken: Position, value: string, type?: LSPTokenType; }) =>
	{
		const { startToken, endToken, value, type = 'Desconhecido' } = params;

		if (value !== '')
		{
			tokens.push(
				{
					innerId: ++innerId,
					range: {
						start: startToken,
						end: endToken
					},
					value: value?.toUpperCase(),
					type
				});
		}
	};

	/*eslint no-constant-condition: ["error", { "checkLoops": false }]*/
	while (true)
	{
		if (charPosition >= text.length)
		{
			addToken(
				{
					startToken,
					endToken: {
						line: lineNumber,
						character: charLinePosition
					},
					value: token
				});
			token = '';

			break;
		}

		charValue = text.charAt(charPosition);
		nextCharValue = text.charAt(charPosition + 1);

		if (charValue === '\n')
		{
			charPosition++;
			continue;
		}

		if (charValue === ' ')
		{
			addToken(
				{
					startToken,
					endToken: {
						line: lineNumber,
						character: charLinePosition
					},
					value: token
				});

			ehIdentificador = false;
			token = '';
			charPosition++;
			charLinePosition++;
			startToken = {
				line: lineNumber,
				character: charLinePosition
			};

			continue;
		}

		// Quebra de Linha
		if (charValue === '\r')
		{
			addToken(
				{
					startToken,
					endToken: {
						line: lineNumber,
						character: charLinePosition
					},
					value: token
				});
			token = '';

			if (nextCharValue === '\n')
			{
				charPosition++;
			}

			ehIdentificador = false;
			lineNumber++;
			charLinePosition = 0;
			charPosition++;
			startToken = {
				line: lineNumber,
				character: charLinePosition
			};

			continue;
		}

		if (delimiters.includes(charValue) === true)
		{
			addToken(
				{
					startToken,
					endToken: {
						line: lineNumber,
						character: charLinePosition
					},
					value: token
				});

			let adicionarSimbolo = true;

			ehIdentificador = false;
			token = '';
			charPosition++;
			charLinePosition++;
			startToken = {
				line: lineNumber,
				character: charLinePosition
			};

			// Comentario de Linha
			if (charValue === '@')
			{
				charValue = text.charAt(charPosition);
				nextCharValue = text.charAt(charPosition + 1);

				while ((charValue !== '@')
					&& (charValue !== '\r')
					&& (charValue !== '\n'))
				{
					if (charPosition >= text.length)
					{
						break;
					}

					token += charValue;

					charPosition++;
					charLinePosition++;
					charValue = text.charAt(charPosition);
					nextCharValue = text.charAt(charPosition + 1);
				}

				addToken(
					{
						startToken,
						endToken: {
							line: lineNumber,
							character: charLinePosition
						},
						value: token,
						type: 'ComentarioLinha'
					});
				token = '';
				adicionarSimbolo = false;
			}

			// Comentario multiplas Linhas
			if ((charValue === '/')
				&& (nextCharValue === '*'))
			{
				let oldCharValue = charValue;
				charValue = text.charAt(charPosition);
				nextCharValue = text.charAt(charPosition + 1);

				while (true)
				{
					if (charPosition >= text.length)
					{
						break;
					}

					if ((oldCharValue === '*')
						&& (charValue === '/'))
					{
						charPosition++;
						charLinePosition++;

						break;
					}

					token += charValue;
					charPosition++;
					charLinePosition++;

					if (charValue === '\r')
					{
						lineNumber++;
						charLinePosition = 0;
					}

					oldCharValue = charValue;
					charValue = text.charAt(charPosition);
					nextCharValue = text.charAt(charPosition + 1);
				}

				addToken(
					{
						startToken,
						endToken: {
							line: lineNumber,
							character: charLinePosition
						},
						value: token,
						type: 'ComentarioBloco'
					});
				token = '';
				adicionarSimbolo = false;
			}

			// String
			if (charValue === '"')
			{
				let oldCharValue = charValue;
				charValue = text.charAt(charPosition);
				nextCharValue = text.charAt(charPosition + 1);

				while (true)
				{
					if (charPosition >= text.length)
					{
						break;
					}

					if ((charValue === '\\')
						&& (oldCharValue !== '\\'))
					{
						token += charValue;
						charValue = '';
					}

					if ((charValue === '"')
						&& (oldCharValue !== '\\'))
					{
						charPosition++;
						charLinePosition++;

						break;
					}

					token += charValue;

					charPosition++;
					charLinePosition++;

					if (charValue === '\r')
					{
						lineNumber++;
						charLinePosition = 0;
					}
					oldCharValue = charValue;
					charValue = text.charAt(charPosition);
					nextCharValue = text.charAt(charPosition + 1);
				}

				addToken(
					{
						startToken,
						endToken: {
							line: lineNumber,
							character: charLinePosition
						},
						value: token,
						type: 'Alfa'
					});

				token = '';
				adicionarSimbolo = false;
			}

			if (adicionarSimbolo === true)
			{
				addToken(
					{
						startToken,
						endToken: {
							line: lineNumber,
							character: charLinePosition
						},
						value: charValue,
						type: 'Simbolo'
					});
			}

			// charPosition++;
			// charLinePosition++;

			continue;
		}

		if ((numbersValids.includes(charValue) === true)
			&& (ehIdentificador === false))
		{
			addToken(
				{
					startToken,
					endToken: {
						line: lineNumber,
						character: charLinePosition
					},
					value: token
				});
			token = '';

			let decimalDelimiterValid = true;
			while ((numbersValids.includes(charValue) === true)
				|| ((decimalDelimiterValid === true) && (charValue === ',')))
			{
				token += charValue;

				if (charValue === ',')
				{
					decimalDelimiterValid = false;
				}

				charPosition++;
				charLinePosition++;
				if (charPosition >= text.length)
				{
					break;
				}

				charValue = text.charAt(charPosition);
			}

			addToken(
				{
					startToken,
					endToken: {
						line: lineNumber,
						character: charLinePosition
					},
					value: token,
					type: 'Numero'
				});

			ehIdentificador = false;
			token = '';
			startToken = {
				line: lineNumber,
				character: charLinePosition
			};

			continue;
		}

		ehIdentificador = true;
		token += charValue;
		charPosition++;
		charLinePosition++;
	}

	return tokens;
};

const checkSintaxe = (maxNumberOfProblems: number, tokens: LSPToken[] = []): Diagnostic[] =>
{
	const diagnostics: Diagnostic[] = [];
	const innerTokens = tokens.filter(t => (t.type !== 'ComentarioBloco') && (t.type !== 'ComentarioLinha'));

	const nextToken = (): LSPToken =>
	{
		let token: LSPToken;

		do
		{
			token = innerTokens[position] ?? null;
			position++;

			if (token === null)
			{
				break;
			}

		} while (
			(token?.type === 'ComentarioBloco')
			|| (token?.type === 'ComentarioLinha'));

		return token;
	};

	const ehWebservice = (): boolean =>
	{
		const retorno = (innerTokens[position]?.value === '.');

		while (innerTokens[position]?.value === '.')
		{
			tokenActive = nextToken(); // Ponto
			tokenActive = nextToken(); // Identificador
		}

		return retorno;
	};

	const checkSintaxeFuncao = (): boolean =>
	{
		if (tokenActive?.value !== '(')
		{
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: oldToken.range,
				message: `Faltou abrir parenteses. [(]`
			};
			diagnostics.push(diagnostic);

			return false;
		}

		tokenActive = nextToken();

		let sintaxeFuncaoValida = true;
		while (tokenActive?.value !== ')')
		{
			if (tokenActive?.value !== 'NUMERO')
			{
				sintaxeFuncaoValida = false;

				break;
			}

			oldToken = tokenActive;
			tokenActive = nextToken();

			if (tokenActive?.value === 'END')
			{
				tokenActive = nextToken();
			}

			if (tokenActive?.type !== 'Desconhecido')
			{
				sintaxeFuncaoValida = false;

				break;
			}

			oldToken = tokenActive;
			tokenActive = nextToken();

			if (tokenActive?.type !== 'Simbolo')
			{
				sintaxeFuncaoValida = false;

				break;
			}

			if (tokenActive?.value === ')')
			{
				continue;
			}

			if (tokenActive?.value !== ',')
			{
				sintaxeFuncaoValida = false;

				break;
			}

			oldToken = tokenActive;
			tokenActive = nextToken();
		}

		if (sintaxeFuncaoValida === false)
		{
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: oldToken.range,
				message: `Definição da Função inválida.`
			};
			diagnostics.push(diagnostic);

			return false;
		}

		oldToken = tokenActive;
		tokenActive = nextToken();
		if (tokenActive?.value !== ';')
		{
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: oldToken.range,
				message: `Faltou o ponto e vírgula. [;]`
			};
			diagnostics.push(diagnostic);

			return false;
		}
		return true;
	};

	const checkSintaxeIndexadorVariavel = (): boolean =>
	{
		if (tokenActive?.value === '[')
		{
			oldToken = tokenActive;
			tokenActive = nextToken();

			if (tokenActive?.type !== 'Numero')
			{
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Error,
					range: oldToken.range,
					message: `Número Inválido.`
				};
				diagnostics.push(diagnostic);

				return false;
			}

			oldToken = tokenActive;
			tokenActive = nextToken();

			if (tokenActive?.value !== ']')
			{
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Error,
					range: oldToken.range,
					message: `Era esperado "]".`
				};
				diagnostics.push(diagnostic);

				return false;
			}

			oldToken = tokenActive;
			tokenActive = nextToken();
		}
		return true;
	};

	let position = 0;
	let oldToken: LSPToken;
	let tokenActive = nextToken();

	while ((position <= innerTokens.length)
		&& (diagnostics.length < maxNumberOfProblems))
	{
		if (tokenActive?.type === 'Desconhecido')
		{
			switch (tokenActive?.value)
			{
				case 'DEFINIR':
					{
						tokenActive = nextToken();

						let tipoVariavel = tokenActive?.value;
						if (['ALFA', 'CURSOR', 'DATA', 'FUNCAO', 'LISTA', 'NUMERO'].includes(tokenActive?.value) === false)
						{
							if (ehWebservice() === true)
							{
								tipoVariavel = 'WEBSERVICE';
							}
							else
							{
								const diagnostic: Diagnostic = {
									severity: DiagnosticSeverity.Error,
									range: tokenActive.range,
									message: `Tipo da Variável inválido`
								};
								diagnostics.push(diagnostic);

								continue;
							}
						}

						tokenActive = nextToken();

						if (tokenActive?.type !== 'Desconhecido')
						{
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: tokenActive.range,
								message: `Identificado inválido`
							};
							diagnostics.push(diagnostic);

							continue;
						}

						oldToken = tokenActive;
						tokenActive = nextToken();

						if ((['CURSOR', 'LISTA', 'WEBSERVICE'].includes(tipoVariavel) === true)
							&& (tokenActive?.value !== ';'))
						{
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: oldToken.range,
								message: `Faltou o ponto e vírgula. [;]`
							};
							diagnostics.push(diagnostic);

							continue;
						}

						if (['ALFA', 'DATA', 'NUMERO'].includes(tipoVariavel) === true)
						{
							if (tokenActive?.value !== ';')
							{
								if (checkSintaxeIndexadorVariavel() === false)
								{
									continue;
								}

								if (tokenActive?.value !== ';')
								{
									const diagnostic: Diagnostic = {
										severity: DiagnosticSeverity.Error,
										range: oldToken.range,
										message: `Faltou o ponto e vírgula. [;]`
									};
									diagnostics.push(diagnostic);

									continue;
								}
							}
						}

						if (tipoVariavel === 'FUNCAO')
						{
							if (checkSintaxeFuncao() === false)
							{
								continue;
							}
						}
						break;
					}
				case 'FIM':
					{
						oldToken = tokenActive;
						tokenActive = nextToken();

						if (tokenActive?.value !== ';')
						{
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Warning,
								range: oldToken.range,
								message: `Faltou o ponto e vírgula. [;]`
							};
							diagnostics.push(diagnostic);

							continue;
						}

						break;
					}
				case 'FUNCAO':
					{
						oldToken = tokenActive;
						tokenActive = nextToken();

						if (tokenActive?.type !== 'Desconhecido')
						{
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: tokenActive.range,
								message: `Nome da função é inválido`
							};
							diagnostics.push(diagnostic);

							continue;
						}

						// TODO Verificar se a funcao já foi Definida

						oldToken = tokenActive;
						tokenActive = nextToken();

						if (checkSintaxeFuncao() === false)
						{
							continue;
						}
						break;
					}
				case 'PARE':
					{
						oldToken = tokenActive;
						tokenActive = nextToken();

						if (tokenActive?.value !== ';')
						{
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: oldToken.range,
								message: `Faltou o ponto e vírgula. [;]`
							};
							diagnostics.push(diagnostic);

							continue;
						}

						break;
					}
				case 'VAPARA':
					{
						oldToken = tokenActive;
						tokenActive = nextToken();

						if (tokenActive?.type !== 'Desconhecido')
						{
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: tokenActive.range,
								message: `Identificado o "LABEL" é inválido`
							};
							diagnostics.push(diagnostic);

							continue;
						}

						// TODO Verificar se existe um Label com o nome definido

						oldToken = tokenActive;
						tokenActive = nextToken();
						if (tokenActive?.value !== ';')
						{
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: oldToken.range,
								message: `Faltou o ponto e vírgula. [;]`
							};
							diagnostics.push(diagnostic);

							continue;
						}

						break;
					}
				default:
					break;
			}
		}
		tokenActive = nextToken();
	}

	return diagnostics;
};

export { checkSintaxe, parserContent };
