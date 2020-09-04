import { CompletionItemKind, Hover, MarkdownString, SnippetString } from 'vscode';

export enum EParameterType
{
	Alfa = 'Alfa',
	Numero = 'Numero',
	Data = 'Data',
	Funcao = 'Funcao',
	Lista = 'Lista',
}

export interface parameterItem
{
	id?: number; // Deve ser único e sequencial
	type: EParameterType;
	name: string;
	isReturnValue: boolean;
}

export class AutoCompleteItem
{
	public label: string = '';
	public documentation?: string;
	public kind?: CompletionItemKind;
	public parameters?: parameterItem[];
	public insertText?: string | SnippetString;

	constructor(params: { label: string, kind?: CompletionItemKind, documentation?: string, parameters?: parameterItem[] })
	{
		this.label = params.label;
		this.documentation = params?.documentation;
		this.kind = params?.kind;
		this.parameters = params?.parameters;
	}

	public detail(): string
	{
		const params = this.parameters?.map<string>(p => `${p.type} ${p.isReturnValue ? 'End ' : ''}${p.name}`).join(', ') || '';
		return `${this.label}(${params})`
	};

	public getHoverContens(): Hover
	{
		const hoverContents = new MarkdownString();

		hoverContents.appendCodeblock(this.detail(), 'lsp');
		this.documentation && hoverContents.appendText(this.documentation);

		const hover = new Hover(hoverContents);

		return hover;
	}
}

const autoCompleteList: AutoCompleteItem[] = [
	new AutoCompleteItem({
		label: "AlfaParaInt",
		documentation: "Converte um texto para um número não formatado",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Origem",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Retorno",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ConverteMascara",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "TipoDado",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "ValorNum",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "ValorStr",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "Mascara",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "MontaData",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "xdia",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xmes",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xano",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xData",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "IntParaAlfa",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "Origem",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Retorno",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WInsSelecaodaLista",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "HTML",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "Marcador",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "NomeLista",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Opcional",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "ItemSelecionado",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WInsSelecaodoBanco",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "HTML",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "Marcador",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "SQL",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "CampoValor",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "CampoDescricao",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Opcional",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "ItemSelecionado",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipoSQL",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WAdicionanoHTML",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aValor",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aHTML",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "aMarcador",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WAdicionaListaErros",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aMsgErro",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "TrocaString",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aStrIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aStrOut",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aStrIn",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aStrFim",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "DescItemLista",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "xNomLis",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "xIteLis",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "xDesLis",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "DesmontaData",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Data,
				name: "Data_Origem",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Dia",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Mes",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Ano",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "ConverteDataBanco",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Data,
				name: "Data_Origem",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Data_Destino",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ConverteMinutosHoras",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "xQuantidadeMinutos",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "xRetornoHoras",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaEscala",
		documentation: "Retorna a escala do colaborador em determinada data, considerando as programações de troca de escala e histórico do colaborador",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "CodEsc",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "CodTma",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "TurInt",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "CodEqp",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "CodCat",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "Mensagem",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetSalDat",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Saldo",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "ValSaldo",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "LiquidoFolha",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NatEve",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "ConSol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Liquido",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "PerPag",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatPag",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "LiquidoFerias",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NatEve",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Liquido",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "PerPag",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatPag",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "LiquidoRescisao",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipRcs",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NatEve",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Liquido",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "PerPag",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatPag",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCheckValInteger",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Campo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Descricao",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Retorno",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "Opcional",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "aTamMax",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCheckValString",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Campo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Descricao",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Retorno",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "Opcional",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "aTamMax",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCheckValData",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Campo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Descricao",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Retorno",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "Opcional",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCheckValHora",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Campo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Descricao",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Retorno",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "Opcional",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCheckValCheckBox",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Campo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Descricao",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Retorno",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WLerHTML",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aArquivo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aHTML",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetColabPorCodUsu",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "CodUsu",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCountFields",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "aQtdCampos",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WReturnFieldsName",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "aIndice",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aNomeCampo",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "CopiarAlfa",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Texto",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "Posicao_Inicial",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Quantidade_Caracteres",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "DeletarAlfa",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "Variavel/Campo",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Posicao",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Quantidade",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "LerPosicaoAlfa",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "Origem",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Destino",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Posicao",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "PosicaoAlfa",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Texto_Pesquisar",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Campo_Pesquisado",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Posicao",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "TamanhoAlfa",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Origem",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Tamanho",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaHorario",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Considerar Feriado (S",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "N)",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "CodHor",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExtensoSemana",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Data,
				name: "",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Extenso",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaEscala",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Escala",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Turma",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Intervalo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Mensagem",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "Para",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "<valor inicial>;",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "<condição>;",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "<contador>",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetDifDat",
		documentation: "Retorna a diferença de tempo entre duas datas",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "Serviço (1-Dia|2-Meses|3-Anos|4-Meses c/Ajuste|5-Anos c/Ajuste|4-Meses c/Ajuste[DI/DF])",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "DataIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "DataFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Retorno",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RestoDivisao",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "Dividendo",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Divisor",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Resto",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "Divide",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "Divisor",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Dividendo",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipoDivisao (1-Normal|2-Resto|3-Parte inteira da divisão)",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Retorno",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "TruncarValor",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "Valor",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetHtmlFicReg",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "Pasta",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "vHtml",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "Alt",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WStrtoJavaScript",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aStrOrigem",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aStrDestino",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "TiraEspacos",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "xDigito",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "xRetorno",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ConverteParaMaiusculo",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "TextoConverter",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "TextoConvertido",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WAlteraValorCampo",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aNomeValor",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aValorCampo",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "MontaAbrangencia",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "pCpoTab",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "pAbgInf",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "pAbrRetorno",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "__Inserir",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: ":Nome_Variavel",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCheckValDouble",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aDescricao",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "aRetorno",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "aOpcional",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "aTamMax",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetQtdVagLoc",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TabOrg",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumLoc",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "EstCar",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "CodCar",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Turno DatAlt QtdVaga",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "TipVag",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "BusCadChefe",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatBas",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Nivel",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "ExcecaoChefia",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "EmpChe",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "TipChe",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "CadChe",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "LocChe",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "LocCol",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "EnviaEMail",
		documentation: "Função que permite enviar e-mails. (CodErroEnviaEmail e MsgErroEnviaEmail)",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "[Alfa Rememetente]",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Destinatario",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "[Alfa CopiaPara]",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "[Alfa CopiaOcultaPara]",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "[Alfa Assunto]",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "[Alfa Texto]",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "[Alfa Anexos]",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nPapelCarta",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "EnviaEMailHTML",
		documentation: "Função que permite enviar e-mails em formato HTML e com imagens no corpo do E-mail. (CodErroEnviaEmail e MsgErroEnviaEmail)",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "[Alfa Rememetente]",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Destinatario",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "[Alfa CopiaPara]",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "[Alfa CopiaOcultaPara]",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "[Alfa Assunto]",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "[Alfa Texto]",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "[Alfa Anexos]",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "aTratarAnexo",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nPapelCarta",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "BusEmailFunc",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "EmailParticular",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "EmailComercial",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaBatidaHorario",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "CodHor",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "SeqMar",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "UsoMar",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "HorMar",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "TolAnt",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "TolApo",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "FaiMov",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExtrasIntervalo",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "horaini",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "horafim",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "diaext",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "qtddiu",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "qtdnot",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetMinRefHTr",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "QtdeMinutos",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetVinEmp",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DataRef",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaCodLoc",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumLoc",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "CodLoc",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetTurCol",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Data,
				name: "",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Turno",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "InsClauSQLWhere",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "SectionName",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "WhereClau",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaHorarioApurado",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "CodHor",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "Mensagem",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "DataHoje",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Data,
				name: "Retorno",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaAnoData",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Data,
				name: "DataBase",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Ano",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaMesData",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Data,
				name: "DataBase",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Mes",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaDiaData",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Data,
				name: "DataBase",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Dia",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "AlteraControle",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Nome_Controle",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Nome_Propriedade",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Valor_Propriedade",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaDiaSemana",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Data,
				name: "DataBase",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Retorno",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "AdicionarCampo",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "NomeCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Tipo_Campo",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "[",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Tamanho]",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "Chave",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Nome_Campo [;Nome_Campo[;Nome_Campo]...]",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "VerDatFer",
		documentation: "Procura se a data específica é um feriado para o colaborador. Para isto, verifica pela filial e pela escala. Se a data for feriado,  retornará 1. Caso contrário, retornará 0.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetNivLoc",
		documentation: "Função que retorna a quantidade de níveis do local informado",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "TabOrg",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "CodLoc",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatLoc",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Nivloc",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "Concatena",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "Texto1",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Texto2",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Texto3",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Destino",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "ArredondarValor",
		documentation: "Esta função arredonda determinado valor, conforme a quantidade de casa decimais informada",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "ValorVariavel",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "Precisao",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "InicioVtr",
		documentation: "Função para preparar os recursos de máquina (alocar memória) para o cálculo de Vale Transporte",
		kind: CompletionItemKind.Method
	})
	, new AutoCompleteItem({
		label: "VerFaltasVtr",
		documentation: "Verificar se o colaborador teve faltas no período para perda de vale transporte",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "PerIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "PerFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "SolIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "SolFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "IniFal",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "FimFal",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TemFal",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "LerPassesVtr",
		documentation: "Verifica se houve digitação de Passes de Vale Transporte",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "PerIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "PerFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TemDig",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalcularVtr",
		documentation: "Esta função calcula o valor e a quantidade de passes de vale transporte",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Tipcol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "PerIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "PerFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "RecCal",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "SolIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "SolFim",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "GravarVtr",
		documentation: "Grava os passes na tabela R028PVT, calculada anteriormente pela função CalculaVtr",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Tipcol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "PerIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "PerFim",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "FinalVtr",
		documentation: "Libera as estruturas alocadas anteriormente pela função CalculaVtr",
		kind: CompletionItemKind.Method
	})
	, new AutoCompleteItem({
		label: "ListaSecao",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "SectionName",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetEscEmp",
		documentation: "Retorna a escala do funcionário em uma determinada data",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatEsc",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "VerAbrBHR",
		documentation: "Esta função verifica se o colaborador está incluído na abrangência de um determinado banco de horas",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "CodBhr",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatBus",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "ColBhr",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WWriteCookie",
		documentation: "Grava um campo no Cookie ativo",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Nome",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Valor",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetSinEmp",
		documentation: "Esta função retorna o código do sindicato de um colaborador em uma determinada data na variável de sistema CodSinEmp",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DataRef",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalIdaEmp",
		documentation: "cula a idade do colaborador na Data de Referência",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatRef",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalculaQtdMinutos",
		documentation: "Calcula a quantidade de minutos existente entre uma Data/Hora Inicial e uma Data/Hora Final",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Data,
				name: "DatIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Hora HorIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "DatFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Hora Horfim",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Qtd_Minutos",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaNumLoc",
		documentation: "Converte o código do local para o número do local. Considera a data setada em DatRef",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "TabOrg",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "pCodLoc",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaNivelLocal",
		documentation: "Retorna uma fração do código do local do nível inicial até o nível final informados",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "TabOrg",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "CodLoc",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NivIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NivFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "NivLoc",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaAscII",
		documentation: "Esta função retorna o caractere ASCII de um número.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "CodigoASCII",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Retorno",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "PertenceGrupo",
		documentation: "Identifica se o usuário ativo pertence ao grupo de usuários passado como parâmetro. Se pertencer retornará 1, caso contrário retornará 0",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "NomGru",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WSetarCalculo",
		documentation: "Função utilizada para setar o código de cálculo para processos automáticos, via regra (Somente RubiWeb)",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "CodCal",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "UltimoDia",
		documentation: "Esta função verifica qual é o último dia do mês/ano da data informada, retornando esta nova data dia/mês/ano na própria variável indicada",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Data,
				name: "Mes",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetLocEmp",
		documentation: "Retorna o local do funcionário em uma determinada data.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatLoc",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WSQLSenior2paraSQLNativo",
		documentation: "Retorna a Sintaxe de um comando SQL Senior2 para o SQL Nativo, correspondente ao banco que estiver sendo utilizado",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "SqlSenior2",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "SqlNativo",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalculaTotCol",
		documentation: "Esta função calcula o totalizador do evento, valor ou referência, de acordo com o cálculo, totalizador e o colaborador enviados por parâmetro.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "xCodCal",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "CodTot",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Retorna",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SelectData",
		documentation: "Função na qual é possível executar qualquer SELECT",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "SQL",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "CamposRet",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "TemDados",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetCampoNumero",
		documentation: "Para buscar algum campo retornado das funções SelectData e SelectMaskedData",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "Indice",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Campos",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Retorno",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetCampoAlfa",
		documentation: "Para buscar algum campo retornado das funções SelectData e SelectMaskedData",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "Indice",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Campos",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Retorno",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetSitEmp",
		documentation: "Retorna a Situação do Colaborador em uma determinda Data (Retorna na variável SitEmp)",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "xNumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xTipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xNumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xDatSit",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetCodUsuPorColab",
		documentation: "Esta função retornará o código do usuário associadr. Caso não houver retornará zero.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "MontarSQLHistoricoSeq",
		documentation: "Esta função retorna um SQL com base em uma data e seqüência para uso com os históricos do sistema",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Tabela",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "DataReferencia",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "SQL",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "MontarSQLHistorico",
		documentation: "Retorna um SQL com base em uma data para uso com os históricos do sistema",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Tabela",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "DataReferencia",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "SQL",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetSalEmp",
		documentation: "Esta função retorna o salário do funcionário em uma determinada data.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "DatSal",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WTextoParaFormatoHTML",
		documentation: "Retorna a expressão alfanumérica passada como parâmetro convertida para HTML",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "TextoInicial",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "TextoFinal",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetEstCarEmp",
		documentation: "Função que retorna a estrutura de cargos utilizada pela empresa na data informada.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatRef",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalTotFolha",
		documentation: "Utilizada para carregar as variáveis de sistema",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "CodRat",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetCarEmp",
		documentation: "Retorna o Cargo do funcionário em uma determinada data.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatCar",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetNomCodNiv",
		documentation: "Retorna o Nome e o código do Local do Empregado em um determinado nível.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatRef",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NivIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NivFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "NomeLoc",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "CodNivLoc",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "TiraAcentos",
		documentation: "Retira os caracteres especiais, retornando o texto em maíusculo.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Texto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Retorno",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalSalEmpCS",
		documentation: "Esta função retorna o salário do funcionário em relação ao tipo",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "TipSal",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "DataBase",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExtensoMes",
		documentation: "Esta função retorna o nome por extenso do mês passado como parâmetro",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "DataBase",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Extenso",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "BusSalClaNiv",
		documentation: "Esta função retorna o valor do salário da estrutura/classe/nível passados como parâmetro, e se desejar (informando tipo 2), o número de meses de complemento do nível salarial.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "EstruturaSalario",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Classe",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Nivel",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Tipo",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatSal",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NivelMercado",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "ValorSalario",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "NroMeses",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetExtMoeda",
		documentation: "Gera o extenso de um valor (moeda). Obs: não completa o espaço restante com o caracter “*”.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "Valor",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "ExtensoDoValor",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExtensoNumero",
		documentation: "Retorna o valor por extenso do número passado como parâmetro.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "Valor",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "ExtensoDoValor",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ProximaPagina",
		documentation: "Permite verificar se uma determinada seção será impressa na próxima página.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Secao",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Retorno",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "BusHorBase",
		documentation: "Retorna o horário base do colaborador em uma determinada data.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatHor",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "Minusculo",
		documentation: "Converte um valor alfanumérico de maiúsculo para minúsculo (SOMENTE NO RUBI)",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Texto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Retorno",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "PrimeiraLetraMiuscula(S/N)",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExecutaRelatorio",
		documentation: "Permite que sejam executados relatórios através das regras.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "NomeModelo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "ExibirTelaEntrada",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SetaNumeroTelaEntrada",
		documentation: "Permite ao usuário alterar os valores numéricos da tela de entrada do modelo.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "NomeCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Valor",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SetaDataTelaEntrada",
		documentation: "Permite ao usuário alterar os valores do tipo data da tela de entrada do modelo.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "NomeCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Valor",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SetaAlfaTelaEntrada",
		documentation: "Permite ao usuário alterar os valores alfanuméricos da tela de entrada do modelo.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "NomeCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Valor",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "EscondeCampoTelaEntrada",
		documentation: "Permite ao usuário esconder determinados campos da tela de entrada do modelo",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "NomeCampo",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetCodNomLocNiv",
		documentation: "Retorna o nome e o código do local, no nível informado",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumLoc",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NroNiv",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "DatLoc",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "NomLoc",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "CodNivLoc",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetNumLocNiv",
		documentation: "Retorna o código do local no nível passado como parâmetro.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "TabOrg",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumLoc",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DataRef",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Nivel",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumLocNiv",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ConvStrPNum",
		documentation: "Converte um valor tipo string para numérico.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "ValorEntrada",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "ValorRetorno",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "BuscaDiaSit",
		documentation: "Esta função retorna a quantidade de dias de uma situação em um período informado. Esta função não apresenta as seguintes situações: 15 (ronda) e 16 (todos os módulos)",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nNumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nTipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nNumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "dDatIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "dDatFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nCodSit",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nQtdDia",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetSalEst",
		documentation: "Retorna o salário (sem nenhuma conversão) de uma Estrutura/Classe/Nível específica em uma determinada data.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nEstSal",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aClaSal",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aNivSal",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "dDatRef",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetBHRDat",
		documentation: "Esta função retorna o saldo do banco de horas conforme a data especificada para verificação. O valor que será retornado corresponderá ao saldo inicial da data. Não são considerados os lançamentos efetuados no dia.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "CodBhr",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatBas",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "BhrDat",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExcLanBhr",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "CodBhr",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatLan",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "CodSit",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "IncLanBhr",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "CodBhr",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatLan",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "CodSit",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "QtdHor",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatCmp",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetDatCmp",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatLan",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "CodBhr",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "CodSit",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatCmp",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetTabOrgEmp",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "DataRef",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TabOrg",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "GravaFotoColaboradorEmDisco",
		documentation: "Grava a foto do colaborador em disco. Esta foto será salva no mesmo tamanho em que foi gravada no Banco de Dados, sempre no formato JPEG (*.JPG).",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "DirArq",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "NomArq",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Retorno[0=Sucesso | 1=Erro]",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "MsgErro",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "BusCadChefeLocal",
		documentation: "Busca o chefe de um local especificado.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TabOrg",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "CodLoc",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Turno",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Nivel",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatBas",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "EmpChe",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "TipChe",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "CadChe",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "LocChe",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "LocCol",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExecSQLEx",
		documentation: "Implementada a função ExecSqlEx que permite a execução de comandos SQL no banco de dados efetuando tratamento de exceções",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "ComandoSQL",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Sucesso(0 - Sucesso | 1 - Erro)",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "MensagemErro",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "InserirAlfa",
		documentation: "Insere um ou mais caracteres em uma Variável/Campo, a partir da posição indicada. Havendo informação no campo alfa, no qual deseja-se inserir o texto, as que estiverem a partir da posicão indicada serão deslocadas para a direita e o que passar do tamanho definido do campo/variável será truncado.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Texto_Origem",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Variável_Destino",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "Posicao_Inicial",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "TempoTrabFun",
		documentation: "Esta função retorna o tempo de trabalho em meses, de um funcionário em um determinado período",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "DataIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "DataFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "ConAfa",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NrMeses",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "MensagemLog",
		documentation: "Esta função cancela o processamento em execução e mostra a mensagem de erro passada como parâmetro",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Mensagem",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetPrxClaNiv",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "Opcao(1-Classe | 2-Nível)",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Estrutura",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "DatBas",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Classe",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Nivel",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "ProximaClasse",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "ProximoNivel",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "InsSQLWhereSimples",
		documentation: "Permite Inserir uma cláusula WHERE dentro de um SQL durante a execução da regra de pré-seleção. As tabelas referenciadas no SQL não são incluídas na cláusula FROM do comando SQL.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "NomeSecao",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "ClausulaWhere",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetAdiEmp",
		documentation: "Esta função retorna o Adicional do funcionário em uma determinada data",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nNumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nTipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nNumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "dDatAdi",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalculaQtdDep",
		documentation: "Calcula a quantidade de dependentes.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nNumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nTipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nNumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "dDatPag",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetEtbEmp",
		documentation: "Retorna a estabilidade do funcionário em uma determinada data.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nNumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nTipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nNumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "dDatEtb",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_Criar",
		documentation: "Função que cria um cursor, ou um objeto para execução de SQL, e retorna no parâmetro \"Objeto\".",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_Destruir",
		documentation: "Função que destrói um cursor depois de sua utilização, o mesmo deve ser chamado quando o cursor não for mais utilizado.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_DefinirComando",
		documentation: "Função que aplica o comando SQL para o cursor passado como parâmetro.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aSQL",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_BOF",
		documentation: "Função que retorna se o cursor está na posição inicial (antes do primeiro registro). Se o cursor está na posição BOF, o valor retornado é 1 (um), caso contrário é 0 (zero).",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_EOF",
		documentation: "Função que retorna se o cursor está na posição final (depois do último registro). Se o cursor está na posição EOF, o valor retornado é 1 (um), caso contrário é 0 (zero)",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_AbrirCursor",
		documentation: "Função que abre o cursor depois de informado o SQL a ser utilizado.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_Proximo",
		documentation: "Função que posiciona o cursor no próximo registro.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_FecharCursor",
		documentation: "Função que fecha a pesquisa sendo feita pelo cursor.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_RetornarBoleano",
		documentation: "Função que retorna um valor boleano de um campo do registro do cursor.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nValor",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_RetornarInteiro",
		documentation: "Função que retorna um valor inteiro de um campo do registro do cursor.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nValor",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_RetornarFlutuante",
		documentation: "Função que retorna um valor flutuante de um campo do registro do cursor.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nValor",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_RetornarData",
		documentation: "Função que retorna uma data de um campo do registro do cursor.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "dValor",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_RetornarAlfa",
		documentation: "Função que retorna um valor do tipo alfa (string) de um campo do registro do cursor.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aValor",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_RetornarBlob",
		documentation: "Função que retorna um Blob de um campo do registro do cursor.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aValor",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_RetornarSeNulo",
		documentation: "Função que retorna um valor booleano, que significa se o campo é nulo ou não.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_DefinirBoleano",
		documentation: "Função que define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo boleano.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nValor",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_DefinirInteiro",
		documentation: "Função que define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo inteiro.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nValor",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_DefinirFlutuante",
		documentation: "Função que define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo numérico com ponto flutuante.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nValor",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_DefinirData",
		documentation: "Função que define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo data.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "dValor",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_DefinirAlfa",
		documentation: "Função que define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo alfanumérico.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aValor",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_DefinirBlob",
		documentation: "Função que seta define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo blob.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aValor",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_UsarAbrangencia",
		documentation: "Função que informa ao cursor se é para utilizar abrangência de usuários.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nUsar",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalSalEmp",
		documentation: "Retorna o salário do funcionário em relação ao tipo.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nTipCal",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nNumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nTipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nNumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "dDatSal",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetQtdDiasUtil",
		documentation: "Retorna a quantidade de dias úteis dentro de um determinado período, levando-se em consideração os dias de segunda a sexta-feira, desde que não estejam cadastrados como feriado na Tabela de Feriados passada como parâmetro na função.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Data,
				name: "dDatIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "dDatFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nTabFer",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nQtdDiasUtil",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetApuPon",
		documentation: "Esta função retorna o tipo de apuração do colaborador, conforme o histórico de apuração.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nNumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nTipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nNumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "dDatApu",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nApuPon",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetFilEmp",
		documentation: "Retorna a filial do funcionário em uma determinada data.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nNumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nTipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nNumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "dDatRef",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "CarregaImgControle",
		documentation: "Carregar uma imagem do banco ou arquivo para um controle imagem do modelo",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "NomeDoControleImagem",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "Opcao[0-Arquivo;1-Banco;2-Variavel]",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "CaminhoCampoNome",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "ClausulaWhereSQL",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "SqlSenior2",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "Gravarnl",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nManArquivo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aVar",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "Abrir",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "NomeArq",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "ModoAbertura [Ler|Gravar|LerNL|GravarNL]",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExecutaTelaSgi",
		documentation: "Esta função executa a tela do SGI passada como parâmetro. Se a tela for executada com sucesso, a função retornará 1. Caso contrário, retornará 0.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "xNomeTela",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "GlbRetVarStr",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aVarNome",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aVarValor",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "GlbAdiVarStr",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aVarNome",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aVarValor",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "CarregaAbrUsu",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aNomCam",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "aCond",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aSobrepoeAbr",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aValorAbr",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaAbrUsu",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aCodMod",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "aTipoAbr",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "aCodUsu",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "aIDPerfil",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "aCond",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aValAbr",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SetaValorFormula",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "aNomeControle",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nValorControle",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "BusCraTit",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nNumEmpFun",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nTipColFun",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nNumCadFun",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "dDatAccFun",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nNumCraFun",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "VerNumAbr",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nNumero",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aAbrangencia",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nRetorno (0-Não está|1-Está)",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "MontaCriteriosAperfeicoamento",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "xHisCua",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xValCua",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xRevCua",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xCerApr",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xCerPar",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xSitAnd",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xSitCom",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xSitDes",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xSitSus",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xSitMed",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xSitFre",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xSitTrf",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xAbrCua",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WPersonalizaMenuWeb",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nPosicao",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aMenuPai",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aTitulo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aLink",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aNome",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aTipo",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nTarget",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetLocNiv",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nNumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nTipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nNumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nNroNiv",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "CodLoc",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "CarregaDistribuicaoEPI",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TabOrg",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumLoc",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "EstCar",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "CodCar",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "DatIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "DatFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Data,
				name: "DatRef",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "AbrEpi",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "ColBom",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "TipOpe",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "TipPes",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipOrd",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "GlbAdiVarNumDat",
		documentation: "Adiciona uma variável global numérica/data em memória",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aVarNome",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nValor",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "GlbAdiVarStr",
		documentation: "Adiciona uma variável global alfa numérica em memória",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "VarNome",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aValor",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "GlbRetVarNumDat",
		documentation: "Retorna o conteúdo de uma variável global numérica, armazenada pela função GlbAdiVarNumDat. Exemplo: x := GlbRetVarNumDat(vNomVar);",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "VarNome",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "GlbRetVarStr",
		documentation: "Retorna o conteúdo de uma variável global armazenada pela função GlbAdiVarStr.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "VarNome",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aVarValor",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "AlteraValorFormula",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aNomeFormula",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nValor",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetHorPrvTrb",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "NumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "TipCol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "NumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "HorIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "HorFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "DatVer",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "xhorprv",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "xdiaint",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCheckValImage",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aCampo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aDescricao",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aRetorno",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "lfa aOpcional",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aExtensao",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "aTamMax",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "GravaImagemBanco",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aTabela",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCamposChave",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aOutrosCampos",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCampoImagem",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "aOrigem",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aArquivo",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aMensagem",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "Encriptar",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aValor",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "aChave",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aResultado",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "Desencriptar",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aValor",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "aChave",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aResultado",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ArqExiste",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aNomeArq",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetHorTrab",
		documentation: "Retorna a quantidade de horas trabalhadas num determinado período.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nNumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "dDatIni",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "dDatFim",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aAbrTip",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aAbrLoc",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aFilSit",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aAbrSit",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nQtdHor",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ConverteDataHoraDateTime",
		documentation: "A função serve para montar uma data e uma hora passados como parâmetro em uma string no formato datetime do banco.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "dData",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nHora",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aDataHoraBanco",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "GeraHash",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "Texto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Algoritmo [MD5 | SHA1 | SHA256 | SHA512]",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "Hash",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WRemoteAddr",
		documentation: "Retorna o endereço IP da estação que está acessando o sistema. Utilizada apenas nos sistemas Web.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aIp",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegEntLe",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nCodEnt",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegEntEhUsuario",
		documentation: "Esta função indica se o Usuário/Grupo passado em aObjeto é um usuário. Se sim o resultado direto da função é 1 senão será 0.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegUsuAtivado",
		documentation: "Esta função indica se o acesso ao usuário passado em aObjeto está desativado. Se sim o resultado direto da função é 1 senão será 0.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegEntQtdGrp",
		documentation: "Esta função retorna diretamente a quantidade de grupos do Usuário/Grupo passado em aObjeto.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegEntNome",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aNome",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegUsuNomeComp",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aNome",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegUsuSetaSenha",
		documentation: "Esta função seta a senha do usuário passado em aObjeto através do parâmetro aNovaSenha retornando o aObjeto(Usuário) com a senha setada.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "aNovaSenha",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegUsuSetaAtivado",
		documentation: "Esta função seta a opção Conta Desabilitada do usuário passado em aObjeto através do parâmetro nOpcao: 1 = Conta Habilitada ou 0 = Conta Desabilitada retornando aObjeto(Usuário) com a opção setada.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "nOpcao [0:Desabilitar | 1: Habilitar]",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegUsuDatExp",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aObjeto",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetDiaHor",
		documentation: "Função que concatena os dias da semana que contenham o mesmo horário de curso.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nCodHCu",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aNomDia1",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aNomDia2",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aNomDia3",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aNomDia4",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aNomDia5",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aNomDia6",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aNomDia7",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aStrHor1",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aStrHor2",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aStrHor3",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aStrHor4",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aStrHor5",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aStrHor6",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aStrHor7",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaDistribuicaoEPI",
		documentation: "Retorna item a item dos resultados encontrados em CarregaDistribuicaoEPI. Os itens podem ser navegados através dos parâmetro TipOpe, que retorna o item escolhido na lista, como, primeiro, ultimo, próximo e anterior. A função CarregaDistribuicaoEPI deve sempre ser chamada antes da RetornaDistribuicaoEPI para que os dados sejam carregados anteriormente.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "TipOpe",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "CodEpi",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "MedEpi",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "DesMot",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "DatEnt",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "DatRev",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "DatVal",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "RecIns",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "DatAju",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "CodMtv",
				isReturnValue: true
			},
			{
				type: EParameterType.Numero,
				name: "DatDev",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ValidaPISCPF",
		documentation: "Função para Validar um número de CPF ou PIS.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nTipo [1-PIS | 2-CPF]",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aPISCPF",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nValido [0-OK | 10-Inválido]",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "TrocaCadastro",
		documentation: "Esta função tem a funcionalidade de efetuar a troca de cadastro de colaboradores.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nCadNov",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nCadAnt",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nTipCol",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegEntExistePorNome",
		documentation: "Essa função verifica pelo nome se o usuário/grupo existe.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aNome",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "NumeroParaAlfa",
		documentation: "Converte um número para formato alfanumérico, mantendo as casas decimais e sem arredondar.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nOrigem",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aDestino",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "GravaFotoColaboradorEmDisco",
		documentation: "Grava a foto do colaborador em disco. Esta foto será salva no mesmo tamanho em que foi gravada no Banco de Dados, sempre no formato JPEG (*.JPG).",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nNumEmp",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nTipcol",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nNumCad",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aDirArq",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aNomArq",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nRetorno",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "aMsgErro",
				isReturnValue: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "GravaFotoCandidatoEmDisco",
		documentation: "Grava a foto do candidato em disco. Esta foto será salva no mesmo tamanho em que foi gravada no Banco de Dados,  no formato JPEG (*.JPG).",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "nNumCan",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aDirArq",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aNomArq",
				isReturnValue: false
			},
			{
				type: EParameterType.Numero,
				name: "nRetorno",
				isReturnValue: true
			},
			{
				type: EParameterType.Alfa,
				name: "aMsgErro);",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaNomeUsuario",
		documentation: "É uma função que permite utilizar os nomes disponíveis no cadastro de propriedades do usuário no SGU - Senior Gerenciador de usuários.",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Numero,
				name: "aCodUsu",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aNomUsu",
				isReturnValue: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ConverteCodificacaoString",
		documentation: "Esta função altera a codificação de um texto contido em uma variável, onde este texto com a codificação alterada pode ser utilizado para comunicação com web services. Se o sistema não suportar a codificação informada, será emitida a seguinte mensagem: \"A codificação X não é suportada. Verifique a documentação\".",
		kind: CompletionItemKind.Method,
		parameters: [
			{
				type: EParameterType.Alfa,
				name: "aString",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aCodificacao",
				isReturnValue: false
			},
			{
				type: EParameterType.Alfa,
				name: "aResultado",
				isReturnValue: true
			}
		]
	})

];


export default autoCompleteList;
