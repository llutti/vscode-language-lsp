import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { Position, Range } from 'vscode-languageserver-textdocument';
import { EParameterType, LSPTypeObject } from './lsp-elements';
import { templatesInternosERP, templatesInternosHCM, templatesInternosSENIOR } from './lsp-internal-templates';

type LSPTokenType = 'Texto' | 'Numero' | 'Simbolo' | 'ComentarioLinha' | 'Comando' | 'ComentarioBloco' | 'Identificador'
	| 'PalavraReservada' | 'VariavelReservada' | 'TipoDado' | 'FuncaoCustomizada';

interface LSPToken
{
	innerId: number; // ID Sequencial
	range: Range;
	value: string;
	type: LSPTokenType;
	valid: boolean;
}

type LSPTipoBloco = 'Chave' | 'Se' | 'Inicio' | 'Para' | 'Enquanto' | 'Parenteses';
interface Bloco
{
	tipo: LSPTipoBloco;
	ativo: boolean;
	range: Range;
}

const LSPTipoDados: string[] = Object
	.entries(EParameterType)
	.map(([, value]) => value.toUpperCase()).sort();

const LSPComando: string[] = ['CONTINUE', 'DEFINIR', 'END', 'ENQUANTO', 'EXECSQL', 'FIM', 'INICIO', 'FUNCAO', 'PARA', 'PARE', 'SE', 'SENAO', 'VAPARA'].sort();

const LSPPalavrasReservada: string[] = ['DEFINIRCAMPOS', 'LIMPAR',
	...[...templatesInternosSENIOR,
	...templatesInternosHCM,
	...templatesInternosERP]
		.filter(t => (t.type !== LSPTypeObject.Constant) && (t.label.toUpperCase() !== 'PARA'))
		.map(t => t.label.toUpperCase())].sort();

const LSPVariaveisReservada: string[] = templatesInternosHCM
	.filter(t => t.type === LSPTypeObject.Constant)
	.map(t => t.label.toUpperCase()).sort();

const parserContent = (text: string): LSPToken[] =>
{
	const delimiters = '><,.;=()[]{}\\/+-*@"';
	const numbersValids = '0123456789';
	const decimalDelimiterChar = '.';
	const tokens: LSPToken[] = [];
	let innerId = 0;
	let charPosition = 0;
	let charValue = '';
	let nextCharValue = '';
	let ehNumeroNegativo = false;
	let token: string | null = null;
	let lineNumber = 0;
	let charLinePosition = 0;
	let startToken: Position = {
		line: 0,
		character: 0
	};
	let ehIdentificador = false;
	const conactenarToken = (value: string) => token === null ? token = value : token += value;
	const addToken = (params: { startToken: Position, endToken: Position, value: string | null, type?: LSPTokenType, valid?: boolean }) =>
	{
		const { startToken, endToken, value, valid = true } = params;
		let { type = 'Identificador' } = params;

		if (value !== null)
		{
			const upperValue = value?.toUpperCase();
			if (type === 'Identificador')
			{
				if (LSPPalavrasReservada.includes(upperValue) === true)
				{
					type = 'PalavraReservada';
				}
				else
					if (LSPVariaveisReservada.includes(upperValue) === true)
					{
						type = 'VariavelReservada';
					}
					else
						if (LSPTipoDados.includes(upperValue) === true)
						{
							type = 'TipoDado';
						}
						else
							if (LSPComando.includes(upperValue) === true)
							{
								type = 'Comando';
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
					type,
					valid
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
			token = null;

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
			ehNumeroNegativo = false;
			token = null;
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
			token = null;

			if (nextCharValue === '\n')
			{
				charPosition++;
			}

			ehIdentificador = false;
			ehNumeroNegativo = false;
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
			ehNumeroNegativo = false;
			token = null;
			charPosition++;
			charLinePosition++;
			startToken = {
				line: lineNumber,
				character: charLinePosition
			};

			if (charValue === '-')
			{
				if (numbersValids.includes(text.charAt(charPosition)) === true)
				{
					ehNumeroNegativo = true;
					continue;
				}
			}

			// Comentario de Linha
			if (charValue === '@')
			{
				let comentarioValido = false;

				charValue = text.charAt(charPosition);
				nextCharValue = text.charAt(charPosition + 1);
				if (charValue === '@')
				{
					comentarioValido = true;
					token = '';

					charPosition++;
					charLinePosition++;
					startToken = {
						line: lineNumber,
						character: charLinePosition
					};

				}
				else
				{
					while ((charPosition < text.length)
						&& (charValue !== '\r')
						&& (charValue !== '\n'))
					{
						conactenarToken(charValue);

						charPosition++;
						charLinePosition++;
						charValue = text.charAt(charPosition);
						nextCharValue = text.charAt(charPosition + 1);

						if (charValue === '@')
						{
							comentarioValido = true;

							charPosition++;
							charLinePosition++;
							startToken = {
								line: lineNumber,
								character: charLinePosition
							};

							break;
						}
					}
				}

				addToken(
					{
						startToken,
						endToken: {
							line: lineNumber,
							character: charLinePosition
						},
						value: token,
						type: 'ComentarioLinha',
						valid: comentarioValido
					});
				token = null;
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

					conactenarToken(charValue);
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
				token = null;
				adicionarSimbolo = false;
			}

			// String
			if (charValue === '"')
			{
				let oldCharValue = charValue;
				charValue = text.charAt(charPosition);
				nextCharValue = text.charAt(charPosition + 1);
				token = ''; // Inicializar para quando for uma String vazia

				while (true)
				{
					if (charPosition >= text.length)
					{
						break;
					}

					if (((charValue === '\\') || (charValue === '"'))
						&& (oldCharValue === '\\'))
					{
						conactenarToken(charValue);
						charValue = '';
					}

					if ((charValue === '"')
						&& (oldCharValue !== '\\'))
					{
						charPosition++;
						charLinePosition++;

						break;
					}

					conactenarToken(charValue);

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

				token = null;
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
			token = null;

			let decimalDelimiterValid = true;
			while ((numbersValids.includes(charValue) === true)
				|| ((decimalDelimiterValid === true) && (charValue === decimalDelimiterChar)))
			{
				if (charValue === decimalDelimiterChar)
				{
					if (numbersValids.includes(text.charAt(charPosition + 1)) === false)
					{
						break;
					}
					decimalDelimiterValid = false;
				}

				conactenarToken(charValue);

				charPosition++;
				charLinePosition++;
				if (charPosition >= text.length)
				{
					break;
				}

				charValue = text.charAt(charPosition);
			}

			if (ehNumeroNegativo === true)
			{
				token = '-' + token;
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

			ehNumeroNegativo = false;
			ehIdentificador = false;
			token = null;
			startToken = {
				line: lineNumber,
				character: charLinePosition
			};

			continue;
		}

		ehIdentificador = true;
		ehNumeroNegativo = false;
		conactenarToken(charValue);
		charPosition++;
		charLinePosition++;
	}

	return tokens;
};

const checkSintaxe = (maxNumberOfProblems: number, tokens: LSPToken[] = []): Diagnostic[] =>
{
	// Se maxNumberOfProblems for ZERO nao validar nada
	if (maxNumberOfProblems === 0)
	{
		return [];
	}

	let blocos: Bloco[] = [];
	const diagnostics: Diagnostic[] = tokens
		.filter(t => (t.type === 'ComentarioLinha') && (t.valid === false))
		.map<Diagnostic>(
			token =>
			{
				return {
					severity: DiagnosticSeverity.Error,
					range: token.range,
					message: 'Comentário de Linha não finalizado corretamente.'
				};
			});

	const innerTokens = tokens.filter(t => (t.type !== 'ComentarioBloco') && (t.type !== 'ComentarioLinha'));

	const ehPontoVirgula = (): boolean => (tokenActive?.type === 'Simbolo') && (tokenActive?.value === ';');

	const validarPontoVirgula = (severity: DiagnosticSeverity = DiagnosticSeverity.Error): boolean =>
	{
		if (ehPontoVirgula() === false)
		{
			const diagnostic: Diagnostic = {
				severity,
				range: oldToken.range,
				message: `Faltou o ponto e vírgula. [;]`
			};
			diagnostics.push(diagnostic);

			return false;
		}
		return true;
	};

	const adicionarBloco = (tipo: LSPTipoBloco, range: Range): void =>
	{
		blocos.push(
			{
				tipo,
				ativo: true,
				range
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

		} while (token?.type === 'ComentarioBloco');

		return token;
	};

	const ehWebservice = (): boolean =>
	{
		const retorno = (innerTokens[position]?.value === '.');

		while (innerTokens[position]?.value === '.')
		{
			oldToken = tokenActive;
			tokenActive = nextToken(); // Ponto
			oldToken = tokenActive;
			tokenActive = nextToken(); // Identificador
		}

		return retorno;
	};

	const checkSintaxeDefinirFuncao = (): boolean =>
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

		oldToken = tokenActive;
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
				oldToken = tokenActive;
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

		return validarPontoVirgula();
	};

	const checkSintaxeExpressao = (): boolean =>
	{
		if ((tokenActive?.type !== 'Numero')
			&& (tokenActive?.type !== 'Identificador')
			&& (tokenActive?.type !== 'Texto')
			&& ((tokenActive?.type === 'Simbolo') && (tokenActive?.value !== '(')))
		{
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: tokenActive.range,
				message: `Expressão Inválida.`
			};
			diagnostics.push(diagnostic);

			return false;
		}

		if (tokenActive?.type === 'Texto')
		{
			oldToken = tokenActive;
			tokenActive = nextToken();

			while (position <= innerTokens.length)
			{
				if ((tokenActive?.type !== 'Simbolo')
					|| (tokenActive?.value !== '+'))
				{
					const diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Error,
						range: tokenActive.range,
						message: `Era esperado um "+".`
					};
					diagnostics.push(diagnostic);

					return false;
				}

				oldToken = tokenActive;
				tokenActive = nextToken();

				if ((tokenActive?.type !== 'Texto')
					&& (tokenActive?.type !== 'Identificador'))
				{
					const diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Error,
						range: tokenActive.range,
						message: `Era esperado um "Texto" ou uma "Variável".`
					};
					diagnostics.push(diagnostic);

					return false;
				}

				oldToken = tokenActive;
				tokenActive = nextToken();

				if ((tokenActive?.type === 'Simbolo')
					&& (tokenActive?.value === ')'))
				{
					oldToken = tokenActive;
					tokenActive = nextToken();

					return removerBloco('Parenteses');
				}
			}
			return false;
		}

		return true;
	};

	const checkSintaxeFuncao = (customizada = false): boolean =>
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

		adicionarBloco('Parenteses', tokenActive.range);

		oldToken = tokenActive;
		tokenActive = nextToken();

		if (tokenActive?.type === 'Simbolo')
		{
			if (tokenActive?.value === ')')
			{
				removerBloco('Parenteses');

				oldToken = tokenActive;
				tokenActive = nextToken();

				return validarPontoVirgula();
			}

			if (['('].includes(tokenActive?.value) === false)
			{
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Error,
					range: oldToken.range,
					message: `Parâmetro inválido.`
				};
				diagnostics.push(diagnostic);

				return false;
			}
		}

		let sintaxeFuncaoValida = true;
		let finalizarWhile = false;
		let rangeError = oldToken.range;
		let foiVirgula = false;

		while (position <= innerTokens.length)
		{
			if (finalizarWhile === true)
			{
				break;
			}

			if (tokenActive?.type === 'Simbolo')
			{
				switch (tokenActive?.value)
				{
					case ',':
						{
							if (foiVirgula === true)
							{
								const diagnostic: Diagnostic = {
									severity: DiagnosticSeverity.Error,
									range: rangeError,
									message: `Faltou informar parâmetro.`
								};
								diagnostics.push(diagnostic);

								sintaxeFuncaoValida = false;
								finalizarWhile = true;
								continue;
							}

							foiVirgula = true;

							break;
						}
					case '(':
						{
							adicionarBloco('Parenteses', oldToken.range);

							oldToken = tokenActive;
							rangeError = oldToken.range;
							tokenActive = nextToken();

							if (checkSintaxeExpressao() === false)
							{
								sintaxeFuncaoValida = false;
								finalizarWhile = true;
							}

							continue;
						}
					case ')':
						{
							// const diagnostic: Diagnostic = {
							// 	severity: DiagnosticSeverity.Hint,
							// 	range: oldToken.range,
							// 	message: `LOG: )`
							// };
							// diagnostics.push(diagnostic);

							if (foiVirgula === true)
							{
								const diagnostic: Diagnostic = {
									severity: DiagnosticSeverity.Error,
									range: rangeError,
									message: `Faltou informar parâmetro.`
								};
								diagnostics.push(diagnostic);

								sintaxeFuncaoValida = false;
								finalizarWhile = true;
								continue;
							}

							if (removerBloco('Parenteses') === false)
							{
								const diagnostic: Diagnostic = {
									severity: DiagnosticSeverity.Error,
									range: rangeError,
									message: `Tentativa de Fechar Parenteses antes de Abrir.`
								};
								diagnostics.push(diagnostic);

								sintaxeFuncaoValida = false;
								finalizarWhile = true;
								continue;
							}

							const bloco = blocos[blocos.length - 1];
							if (bloco?.tipo !== 'Parenteses')
							{
								// const diagnostic: Diagnostic = {
								// 	severity: DiagnosticSeverity.Hint,
								// 	range: oldToken.range,
								// 	message: `LOG: Bloco nao eh parenteses`
								// };
								// diagnostics.push(diagnostic);

								finalizarWhile = true;
								continue;
							}

							break;
						}
					default:
						{
							if (tokenActive?.value === '.')
							{
								if (oldToken?.type === 'Identificador')
								{
									oldToken = tokenActive;
									rangeError = oldToken.range;
									tokenActive = nextToken();

									if (tokenActive?.type === 'Identificador')
									{
										continue;
									}
								}
							}

							if (['+', '-', '*', '/'].includes(tokenActive?.value) === true)
							{
								if (oldToken?.type === 'Numero')
								{
									oldToken = tokenActive;
									rangeError = oldToken.range;
									tokenActive = nextToken();

									if ((tokenActive?.type === 'Numero')
										|| (tokenActive?.type === 'Identificador'))
									{
										continue;
									}
								}
								else
									if (oldToken?.type === 'Identificador')
									{
										oldToken = tokenActive;
										rangeError = oldToken.range;
										tokenActive = nextToken();

										if ((tokenActive?.type === 'Numero')
											|| (tokenActive?.type === 'Identificador'))
										{
											continue;
										}
										// const diagnostic: Diagnostic = {
										// 	severity: DiagnosticSeverity.Information,
										// 	range: oldToken.range,
										// 	message: `LOG: ${tokenActive?.type} | ${tokenActive?.value} | ${oldToken?.value}`
										// };
										// diagnostics.push(diagnostic);

										if ((tokenActive?.type === 'Simbolo')
											&& (tokenActive?.value === oldToken?.value)
											&& (['+', '-'].includes(oldToken?.value) === true))
										{
											oldToken = tokenActive;
											rangeError = oldToken.range;
											tokenActive = nextToken();

											continue;
										}
									}
							}

							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: tokenActive.range,
								message: `Símbolo Inválido.`
							};
							diagnostics.push(diagnostic);

							sintaxeFuncaoValida = false;
							finalizarWhile = true;
							continue;
						}
				}
			}
			else
			{
				foiVirgula = false;

				if (customizada === true)
				{
					if (tokenActive?.type === 'Texto')
					{
						const diagnostic: Diagnostic = {
							severity: DiagnosticSeverity.Error,
							range: tokenActive.range,
							message: `Não é permitir parâmetro do tipo "Texto" em funções customizadas.`
						};
						diagnostics.push(diagnostic);

						sintaxeFuncaoValida = false;
						finalizarWhile = true;
						continue;
					}
				}

				// TODO validar quantidade de paramentros com base nas especificacoes
				// TODO validar o tipo dos dados
			}

			oldToken = tokenActive;
			rangeError = oldToken.range;
			tokenActive = nextToken();
		}

		if (sintaxeFuncaoValida === false)
		{
			return false;
		}

		oldToken = tokenActive;
		tokenActive = nextToken();

		return validarPontoVirgula();
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

		adicionarBloco('Parenteses', tokenActive.range);

		oldToken = tokenActive;
		tokenActive = nextToken();
		while (position <= innerTokens.length)
		{
			if ((tokenActive?.type !== 'Texto')
				&& (tokenActive?.type !== 'Numero')
				&& (tokenActive?.type !== 'ComentarioLinha')
				&& (tokenActive?.type !== 'ComentarioBloco'))
			{
				switch (tokenActive?.value)
				{
					case '(':
						{
							adicionarBloco('Parenteses', tokenActive.range);
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
			if ((tokenActive?.type !== 'Texto')
				&& (tokenActive?.type !== 'Numero')
				&& (tokenActive?.type !== 'ComentarioLinha')
				&& (tokenActive?.type !== 'ComentarioBloco'))
			{
				switch (tokenActive?.value)
				{
					case '(':
						{
							adicionarBloco('Parenteses', oldToken.range);

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

		adicionarBloco('Parenteses', tokenActive.range);

		oldToken = tokenActive;
		tokenActive = nextToken();
		while (position <= innerTokens.length)
		{
			if ((tokenActive?.type !== 'Texto')
				&& (tokenActive?.type !== 'Numero')
				&& (tokenActive?.type !== 'ComentarioLinha')
				&& (tokenActive?.type !== 'ComentarioBloco'))
			{
				switch (tokenActive?.value)
				{
					case '(':
						{
							adicionarBloco('Parenteses', tokenActive.range);
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
					case 'PARA':
					case 'ENQUANTO':
					case 'INICIO':
					case 'FIM':
						{
							const diagnostic: Diagnostic = {
								severity: DiagnosticSeverity.Error,
								range: oldToken.range,
								message: `Esperava-se ")" (SintaxePara).`
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

	// let debugExecID = 0;
	while ((position <= innerTokens.length)
		&& (diagnostics.length < maxNumberOfProblems))
	{
		// debugExecID++;
		// console.log(debugExecID);
		// console.dir(tokenActive, { depth: 4 });

		// if (tokenActive?.value?.startsWith('DEFINIRCAMPOS'))
		// if (tokenActive?.value === 'DEFINIRCAMPOS')
		// {
		// 	const diagnostic: Diagnostic = {
		// 		severity: DiagnosticSeverity.Information,
		// 		range: tokenActive.range,
		// 		message: `Tipo do Token: ${tokenActive?.type}`
		// 	};
		// 	diagnostics.push(diagnostic);
		// }
		switch (tokenActive?.type)
		{
			case 'Comando':
				{
					switch (tokenActive?.value)
					{
						case 'DEFINIR':
							{
								oldToken = tokenActive;
								tokenActive = nextToken();

								let tipoVariavel = tokenActive?.value;
								// if (LSPTipoDados.includes(tokenActive?.value) === false)
								if (tokenActive?.type !== 'TipoDado')
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

								oldToken = tokenActive;
								tokenActive = nextToken();

								if ((tokenActive?.type !== 'Identificador')
									&& (tokenActive?.type !== 'FuncaoCustomizada'))
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

								if (['CURSOR', 'LISTA', 'WEBSERVICE'].includes(tipoVariavel) === true)
								{
									if (validarPontoVirgula() === false)
									{
										continue;
									}
								}

								if (['ALFA', 'DATA', 'NUMERO', 'Tabela'].includes(tipoVariavel) === true)
								{
									if (ehPontoVirgula() === false)
									{
										if (checkSintaxeIndexadorVariavel() === false)
										{
											continue;
										}

										if (validarPontoVirgula() === false)
										{
											continue;
										}
									}
								}

								if (tipoVariavel === 'FUNCAO')
								{
									if (checkSintaxeDefinirFuncao() === false)
									{
										continue;
									}
								}
								break;
							}
						case 'INICIO':
							{
								adicionarBloco('Inicio', tokenActive.range);

								oldToken = tokenActive;
								tokenActive = nextToken();

								if ((tokenActive?.type === 'Comando')
									&& (tokenActive?.value === 'FIM'))
								{
									const diagnostic: Diagnostic = {
										severity: DiagnosticSeverity.Information,
										range: oldToken.range,
										message: 'Bloco INICIO/FIM vazio.',
										code: '0123'
									};
									diagnostics.push(diagnostic);
								}

								continue;
							}
						case 'FIM':
							{
								oldToken = tokenActive;
								tokenActive = nextToken();

								validarPontoVirgula(DiagnosticSeverity.Warning);

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
									if ((tokenActive?.type === 'Comando')
										&& (tokenActive?.value === 'FIM'))
									{
										continue;
									}

									oldToken = tokenActive;
									tokenActive = nextToken();
									permiteSenao = (tokenActive?.value === 'SENAO');

									continue;
								}

								if ((tokenActive?.type === 'Comando')
									&& (tokenActive?.value === 'FIM'))
								{
									continue;
								}

								break;
							}
						case 'PARE':
							{
								oldToken = tokenActive;
								tokenActive = nextToken();

								if (validarPontoVirgula() === false)
								{
									continue;
								}

								break;
							}
						case 'SE':
							{
								adicionarBloco('Se', tokenActive.range);

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
										severity: DiagnosticSeverity.Information,
										range: oldToken.range,
										message: `É recomendado incluir um Bloco INICIO/FIM para o "SE".`
									};
									diagnostics.push(diagnostic);
								}

								continue;
							}
						case 'ENQUANTO':
							{
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
										severity: DiagnosticSeverity.Information,
										range: oldToken.range,
										message: `É recomendado incluir um Bloco INICIO/FIM para o "ENQUANTO".`
									};
									diagnostics.push(diagnostic);
								}

								continue;
							}
						case 'EXECSQL':
							{
								oldToken = tokenActive;
								tokenActive = nextToken();

								if ((tokenActive?.type !== 'Identificador')
									&& (tokenActive?.type !== 'Texto'))
								{
									const diagnostic: Diagnostic = {
										severity: DiagnosticSeverity.Error,
										range: tokenActive.range,
										message: `Parâmetro inválido.`
									};
									diagnostics.push(diagnostic);

									continue;
								}

								oldToken = tokenActive;
								tokenActive = nextToken();

								if (validarPontoVirgula() === false)
								{
									continue;
								}

								break;
							}
						case 'PARA':
							{
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
										severity: DiagnosticSeverity.Information,
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
										severity: DiagnosticSeverity.Information,
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
								if (validarPontoVirgula() === false)
								{
									continue;
								}

								break;
							}
					}

					break;
				}
			case 'TipoDado':
				{
					switch (tokenActive?.value)
					{
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

								if (checkSintaxeDefinirFuncao() === false)
								{
									continue;
								}

								break;
							}
					}

					break;
				}
			case 'Simbolo':
				{
					switch (tokenActive?.value)
					{
						case '(':
							{
								adicionarBloco('Parenteses', tokenActive.range);

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
								adicionarBloco('Chave', tokenActive.range);

								oldToken = tokenActive;
								tokenActive = nextToken();

								if ((tokenActive?.type === 'Simbolo')
									&& (tokenActive?.value === '}'))
								{
									const diagnostic: Diagnostic = {
										severity: DiagnosticSeverity.Information,
										range: oldToken.range,
										message: 'Bloco {/} vazio.',
										code: '0124'
									};
									diagnostics.push(diagnostic);
								}

								continue;
							}
						case '}':
							{
								if (removerBloco('Chave') === false)
								{
									if (removerBloco('Se') === false)
									{
										const diagnostic: Diagnostic = {
											severity: DiagnosticSeverity.Error,
											range: tokenActive.range,
											message: `Encontrado um "}" sem um "{" correspondente.`
										};
										diagnostics.push(diagnostic);
									}

									removerBloco('Chave');
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
					}

					break;
				}
			case 'PalavraReservada':
				{
					oldToken = tokenActive;
					tokenActive = nextToken();

					if (checkSintaxeFuncao() === false)
					{
						continue;
					}

					break;
				}
		}

		oldToken = tokenActive;
		tokenActive = nextToken();
	}

	blocos
		.forEach(
			bloco =>
			{
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Error,
					range: bloco.range,
					message: `Faltou Finalizar o Bloco "${bloco.tipo}".`
				};
				diagnostics.push(diagnostic);
			}
		);

	return diagnostics;
};

export { checkSintaxe, parserContent };
