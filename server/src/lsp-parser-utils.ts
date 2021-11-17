import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { Position, Range } from 'vscode-languageserver-textdocument';
import { EParameterType } from './lsp-elements';
import { templatesInternos } from './lsp-internal-templates';

type LSPTokenType = 'Texto' | 'Numero' | 'Simbolo' | 'ComentarioLinha' | 'Comando' | 'ComentarioBloco' | 'Identificador' | 'PalavraReservada';

interface LSPToken
{
	innerId: number; // ID Sequencial
	range: Range;
	value: string;
	type: LSPTokenType;
}

type LSPTipoBloco = 'Chave' | 'Se' | 'Inicio' | 'Para' | 'Enquanto' | 'Parenteses' | 'Desconhecido';
interface Bloco
{
	tipo: LSPTipoBloco;
	ativo: boolean;
	origem: Position;
}

const LSPTipoDados: string[] = Object.entries(EParameterType).map(([, value]) => value.toUpperCase()).sort();
const LSPPalavrasReservada: string[] = templatesInternos.map(t => t.label.toUpperCase()).sort();
const LSPComando: string[] = ['CONTINUE', 'DEFINIR', 'ENQUANTO', 'FIM', 'INICIO', 'FUNCAO', 'PARA', 'PARE', 'SE', 'SENAO', 'VAPARA'].sort();

let blocos: Bloco[] = [];

const adicionarBloco = (tipo: LSPTipoBloco, origem: Position): void =>
{
	blocos.push(
		{
			tipo,
			ativo: true,
			origem
		});
};

const removerBloco = (tipo: LSPTipoBloco): boolean =>
{
	const bloco = blocos[blocos.length - 1];
	if (bloco?.tipo !== tipo)
	{
		return false;
	}

	blocos = blocos.splice(0, blocos.length - 1);

	return true;
};

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
		const { startToken, endToken, value } = params;
		let { type = 'Identificador' } = params;

		if (value !== '')
		{
			const upperValue = value?.toUpperCase();
			if (type === 'Identificador')
			{
				if (LSPComando.includes(upperValue) === true)
				{
					type = 'Comando';
				}
				else
					if ((LSPTipoDados.includes(upperValue) === true)
						|| (LSPPalavrasReservada.includes(upperValue) === true))
					{
						type = 'PalavraReservada';
					}
			}

			tokens.push(
				{
					innerId: ++innerId,
					range: {
						start: startToken,
						end: endToken
					},
					value: upperValue,
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

		if ((charValue === ' ')
			|| (charValue === '\t'))
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

					if (((charValue === '\\') || (charValue === '"'))
						&& (oldCharValue === '\\'))
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
						type: 'Texto'
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
		let rangeError = oldToken.range;
		while (tokenActive?.value !== ')')
		{
			if (tokenActive?.value !== 'NUMERO')
			{
				sintaxeFuncaoValida = false;
				rangeError = tokenActive.range;

				break;
			}

			oldToken = tokenActive;
			rangeError = oldToken.range;
			tokenActive = nextToken();

			if (tokenActive?.value === 'END')
			{
				tokenActive = nextToken();
			}

			if (tokenActive?.type !== 'Identificador')
			{
				sintaxeFuncaoValida = false;

				break;
			}

			oldToken = tokenActive;
			rangeError = oldToken.range;
			tokenActive = nextToken();

			if (tokenActive?.type !== 'Simbolo')
			{
				sintaxeFuncaoValida = false;
				rangeError = tokenActive.range;

				break;
			}

			if (tokenActive?.value === ')')
			{
				continue;
			}

			if (tokenActive?.value !== ',')
			{
				sintaxeFuncaoValida = false;
				rangeError = tokenActive.range;

				break;
			}

			oldToken = tokenActive;
			rangeError = oldToken.range;
			tokenActive = nextToken();
		}

		if (sintaxeFuncaoValida === false)
		{
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: rangeError,
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

	const checkSintaxeSeEnquanto = (): boolean =>
	{
		if (tokenActive?.value !== '(')
		{
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: tokenActive.range,
				message: `Faltou abrir parenteses. [(]`
			};
			diagnostics.push(diagnostic);

			return false;
		}

		adicionarBloco('Parenteses', tokenActive.range.start);

		oldToken = tokenActive;
		tokenActive = nextToken();
		while (position <= innerTokens.length)
		{
			if ((tokenActive?.type === 'Comando')
				|| (tokenActive?.type === 'Identificador')
				|| (tokenActive?.type === 'Simbolo')
				|| (tokenActive?.type === 'PalavraReservada'))
			{
				switch (tokenActive?.value)
				{
					case '(':
						{
							adicionarBloco('Parenteses', tokenActive.range.start);
							break;
						}
					case ')':
						{
							if (removerBloco('Parenteses') === false)
							{
								const diagnostic: Diagnostic = {
									severity: DiagnosticSeverity.Error,
									range: tokenActive.range,
									message: `Tentativa de Fechar Parenteses antes de Abrir`
								};
								diagnostics.push(diagnostic);

								return false;
							}

							oldToken = tokenActive;
							tokenActive = nextToken();
							if (tokenActive?.value === ')')
							{
								continue;
							}

							const bloco = blocos[blocos.length - 1];
							if (bloco?.tipo !== 'Parenteses')
							{
								return true;
							}

							if ((tokenActive?.value !== 'E')
								&& (tokenActive?.value !== 'OU')
								&& (tokenActive?.type !== 'Simbolo'))
							{
								const diagnostic: Diagnostic = {
									severity: DiagnosticSeverity.Error,
									range: tokenActive.range,
									message: `Esperava-se "E" ou "OU"`
								};
								diagnostics.push(diagnostic);

								return false;
							}

							continue;
						}
					case ';':
					case 'INICIO':
						{
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: oldToken.range,
								message: `Esperava-se ")".`
							};
							diagnostics.push(diagnostic);

							return false;
						}
				}
			}

			oldToken = tokenActive;
			tokenActive = nextToken();
		}

		return true;
	};

	const checkSintaxeParenteses = (): boolean =>
	{
		while (position <= innerTokens.length)
		{
			if ((tokenActive?.type === 'Comando')
				|| (tokenActive?.type === 'Identificador')
				|| (tokenActive?.type === 'Simbolo')
				|| (tokenActive?.type === 'PalavraReservada'))
			{
				switch (tokenActive?.value)
				{
					case '(':
						{
							adicionarBloco('Parenteses', oldToken.range.start);

							break;
						}
					case ')':
						{
							if (removerBloco('Parenteses') === false)
							{
								return false;
							}

							const bloco = blocos[blocos.length - 1];
							if (bloco?.tipo !== 'Parenteses')
							{
								oldToken = tokenActive;
								tokenActive = nextToken();

								return true;
							}

							break;
						}
					case ';':
					case '{':
					case '}':
					case 'SE':
					case 'ENQUANTO':
					case 'INICIO':
					case 'FIM':
						{
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: oldToken.range,
								message: `Esperava-se ")".`
							};
							diagnostics.push(diagnostic);

							return false;
						}
				}
			}

			oldToken = tokenActive;
			tokenActive = nextToken();
		}

		return true;
	};

	const checkSintaxePara = (): boolean =>
	{
		if (tokenActive?.value !== '(')
		{
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: tokenActive.range,
				message: `Faltou abrir parenteses. [(]`
			};
			diagnostics.push(diagnostic);

			return false;
		}

		adicionarBloco('Parenteses', tokenActive.range.start);

		oldToken = tokenActive;
		tokenActive = nextToken();
		while (position <= innerTokens.length)
		{
			if ((tokenActive?.type === 'Comando')
				|| (tokenActive?.type === 'Identificador')
				|| (tokenActive?.type === 'Simbolo')
				|| (tokenActive?.type === 'PalavraReservada'))
			{
				switch (tokenActive?.value)
				{
					case '(':
						{
							adicionarBloco('Parenteses', tokenActive.range.start);
							break;
						}
					case ')':
						{
							if (removerBloco('Parenteses') === false)
							{
								const diagnostic: Diagnostic = {
									severity: DiagnosticSeverity.Error,
									range: tokenActive.range,
									message: `Tentativa de Fechar Parenteses antes de Abrir`
								};
								diagnostics.push(diagnostic);

								return false;
							}

							oldToken = tokenActive;
							tokenActive = nextToken();
							if (tokenActive?.value === ')')
							{
								continue;
							}

							const bloco = blocos[blocos.length - 1];
							if (bloco?.tipo !== 'Parenteses')
							{
								return true;
							}

							if ((tokenActive?.value !== 'E')
								&& (tokenActive?.value !== 'OU')
								&& (tokenActive?.type !== 'Simbolo'))
							{
								const diagnostic: Diagnostic = {
									severity: DiagnosticSeverity.Error,
									range: tokenActive.range,
									message: `Esperava-se "E" ou "OU"`
								};
								diagnostics.push(diagnostic);

								return false;
							}

							continue;
						}
					case '{':
					case '}':
					case 'SE':
					case 'ENQUANTO':
					case 'INICIO':
					case 'FIM':
						{
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: oldToken.range,
								message: `Esperava-se ")".`
							};
							diagnostics.push(diagnostic);

							return false;
						}
				}
			}

			oldToken = tokenActive;
			tokenActive = nextToken();
		}

		return true;
	};

	let position = 0;
	let oldToken: LSPToken;
	let tokenActive = nextToken();
	let permiteSenao = false;

	while ((position <= innerTokens.length)
		&& (diagnostics.length < maxNumberOfProblems))
	{
		if ((tokenActive?.type === 'Comando')
			|| (tokenActive?.type === 'Identificador')
			|| (tokenActive?.type === 'Simbolo')
			|| (tokenActive?.type === 'PalavraReservada'))
		{
			switch (tokenActive?.value)
			{
				case 'DEFINIR':
					{
						tokenActive = nextToken();

						let tipoVariavel = tokenActive?.value;
						if (LSPTipoDados.includes(tokenActive?.value) === false)
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

						if (tokenActive?.type !== 'Identificador')
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

						if (['ALFA', 'DATA', 'NUMERO', 'Tabela'].includes(tipoVariavel) === true)
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
				case 'INICIO':
					{
						adicionarBloco('Inicio', tokenActive.range.start);

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
						}

						if (removerBloco('Inicio') === false)
						{
							if (removerBloco('Se') === false)
							{
								const diagnostic: Diagnostic = {
									severity: DiagnosticSeverity.Error,
									range: oldToken.range,
									message: `Encontrado um "FIM" sem um "INICIO" correspondente.`
								};
								diagnostics.push(diagnostic);

								continue;
							}

							removerBloco('Inicio');
						}

						if (removerBloco('Se') === true)
						{
							oldToken = tokenActive;
							tokenActive = nextToken();
							permiteSenao = (tokenActive?.value === 'SENAO');

							continue;
						}

						break;
					}
				case 'FUNCAO':
					{
						oldToken = tokenActive;
						tokenActive = nextToken();

						if (tokenActive?.type !== 'Identificador')
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
				case 'SE':
					{
						adicionarBloco('Se', tokenActive.range.start);

						oldToken = tokenActive;
						tokenActive = nextToken();

						if (checkSintaxeSeEnquanto() === false)
						{
							continue;
						}

						if ((tokenActive?.value !== 'INICIO')
							&& (tokenActive?.value !== '{'))
						{
							removerBloco('Se');

							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Warning,
								range: oldToken.range,
								message: `É recomendado incluir um Bloco INICIO/FIM para o "SE".`
							};
							diagnostics.push(diagnostic);
						}

						continue;
					}
				case 'ENQUANTO':
					{
						// adicionarBloco('Enquanto', tokenActive.range.start);

						oldToken = tokenActive;
						tokenActive = nextToken();

						if (checkSintaxeSeEnquanto() === false)
						{
							continue;
						}

						if ((tokenActive?.value !== 'INICIO')
							&& (tokenActive?.value !== '{'))
						{
							removerBloco('Enquanto');

							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Warning,
								range: oldToken.range,
								message: `É recomendado incluir um Bloco INICIO/FIM para o "ENQUANTO".`
							};
							diagnostics.push(diagnostic);
						}

						continue;
					}
				case 'PARA':
					{
						// adicionarBloco('Para', tokenActive.range.start);

						oldToken = tokenActive;
						tokenActive = nextToken();

						if (checkSintaxePara() === false)
						{
							continue;
						}

						if ((tokenActive?.value !== 'INICIO')
							&& (tokenActive?.value !== '{'))
						{
							removerBloco('Para');

							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Warning,
								range: oldToken.range,
								message: `É recomendado incluir um Bloco INICIO/FIM para o "PARA".`
							};
							diagnostics.push(diagnostic);
						}

						continue;
					}
				case 'SENAO':
					{
						if (permiteSenao === false)
						{
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Warning,
								range: tokenActive.range,
								message: `Encontrado um "SENAO" sem um "SE" correspondente.`
							};
							diagnostics.push(diagnostic);
						}

						oldToken = tokenActive;
						tokenActive = nextToken();
						if ((tokenActive?.value !== 'INICIO')
							&& (tokenActive?.value !== 'SE'))
						{
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Warning,
								range: oldToken.range,
								message: `É recomendado incluir um Bloco INICIO/FIM para o "SENAO".`
							};
							diagnostics.push(diagnostic);

						}
						continue;
					}
				case 'VAPARA':
					{
						oldToken = tokenActive;
						tokenActive = nextToken();

						if (tokenActive?.type !== 'Identificador')
						{
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: tokenActive.range,
								message: `Identificador do "LABEL" é inválido`
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
				case '(':
					{
						adicionarBloco('Parenteses', tokenActive.range.start);

						oldToken = tokenActive;
						tokenActive = nextToken();

						if (tokenActive?.value === ')')
						{
							removerBloco('Parenteses');

							break;
						}

						if (checkSintaxeParenteses() === true)
						{
							continue;
						}

						break;
					}
				case ')':
					{
						if (removerBloco('Parenteses') === false)
						{
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: tokenActive.range,
								message: `Encontrado um ")" sem um "(" correspondente.`
							};
							diagnostics.push(diagnostic);
						}

						break;
					}
				case '{':
					{
						adicionarBloco('Chave', tokenActive.range.start);

						break;
					}
				case '}':
					{
						if (removerBloco('Chave') === false)
						{
							if (removerBloco('Se') === false)
							{
								const diagnostic: Diagnostic = {
									severity: DiagnosticSeverity.Warning,
									range: tokenActive.range,
									message: `Encontrado um "}" sem um "{" correspondente.`
								};
								diagnostics.push(diagnostic);
							}

							removerBloco('Inicio');
						}

						if (removerBloco('Se') === true)
						{
							oldToken = tokenActive;
							tokenActive = nextToken();
							permiteSenao = (tokenActive?.value === 'SENAO');

							continue;
						}

						break;
					}
				default:
					break;
			}
		}

		oldToken = tokenActive;
		tokenActive = nextToken();
	}

	return diagnostics;
};

export { checkSintaxe, parserContent };
