import { CompletionItemKind } from 'vscode-languageserver';

export enum ETipoParametro
{
	Alfa = 'Alfa',
	Numero = 'Numero',
	Data = 'Data',
	Funcao = 'Funcao',
	Lista = 'Lista',
}

export interface parametroItem
{
	id?: number; // Deve ser único e sequencial
	tipo: ETipoParametro;
	nome: string;
	retornaValor: boolean;
}

// export interface autoCompleteItem
// {
// 	label: string;
// 	detail: string;
// 	documentation?: string;
// 	kind: CompletionItemKind;
// 	parametros?: parametroItem[];
// }

export class AutoCompleteItem
{
	public label: string = '';
	public documentation?: string;
	public kind?: CompletionItemKind;
	public parametros?: parametroItem[];

	constructor(params: { label: string, kind?: CompletionItemKind, documentation?: string, parametros?: parametroItem[] })
	{
		this.label = params.label;
		this.documentation = params?.documentation;
		this.kind = params?.kind;
		this.parametros = params?.parametros;
	}

	public detail(): string
	{
		const params = this.parametros?.map<string>(p => `${p.tipo} ${p.retornaValor ? 'End ' : ''}${p.nome}`).join(', ') || '';
		return `${this.label}(${params})`
	};
}

const autoCompleteList: AutoCompleteItem[] = [
	new AutoCompleteItem({
		label: "AlfaParaInt",
		documentation: "Converte um texto para um número não formatado",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Origem",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Retorno",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ConverteMascara",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "TipoDado",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "ValorNum",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "ValorStr",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Mascara",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "MontaData",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "xdia",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xmes",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xano",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xData",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "IntParaAlfa",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "Origem",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Retorno",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WInsSelecaodaLista",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "HTML",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Marcador",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "NomeLista",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Opcional",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "ItemSelecionado",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WInsSelecaodoBanco",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "HTML",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Marcador",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "SQL",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "CampoValor",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "CampoDescricao",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Opcional",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "ItemSelecionado",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipoSQL",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WAdicionanoHTML",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aValor",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aHTML",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aMarcador",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WAdicionaListaErros",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aMsgErro",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "TrocaString",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aStrIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aStrOut",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aStrIn",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aStrFim",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "DescItemLista",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "xNomLis",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "xIteLis",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "xDesLis",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "DesmontaData",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Data,
				nome: "Data_Origem",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Dia",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Mes",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Ano",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "ConverteDataBanco",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Data,
				nome: "Data_Origem",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Data_Destino",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ConverteMinutosHoras",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "xQuantidadeMinutos",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "xRetornoHoras",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaEscala",
		documentation: "Retorna a escala do colaborador em determinada data, considerando as programações de troca de escala e histórico do colaborador",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodEsc",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodTma",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TurInt",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodEqp",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodCat",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Mensagem",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetSalDat",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Saldo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "ValSaldo",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "LiquidoFolha",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NatEve",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "ConSol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Liquido",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "PerPag",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatPag",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "LiquidoFerias",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NatEve",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Liquido",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "PerPag",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatPag",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "LiquidoRescisao",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipRcs",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NatEve",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Liquido",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "PerPag",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatPag",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCheckValInteger",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Campo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Descricao",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Retorno",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Opcional",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "aTamMax",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCheckValString",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Campo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Descricao",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Retorno",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Opcional",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "aTamMax",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCheckValData",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Campo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Descricao",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Retorno",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Opcional",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCheckValHora",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Campo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Descricao",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Retorno",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Opcional",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCheckValCheckBox",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Campo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Descricao",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Retorno",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WLerHTML",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aArquivo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aHTML",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetColabPorCodUsu",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "CodUsu",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCountFields",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "aQtdCampos",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WReturnFieldsName",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "aIndice",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNomeCampo",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "CopiarAlfa",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Texto",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Posicao_Inicial",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Quantidade_Caracteres",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "DeletarAlfa",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "Variavel/Campo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Posicao",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Quantidade",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "LerPosicaoAlfa",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "Origem",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Destino",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Posicao",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "PosicaoAlfa",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Texto_Pesquisar",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Campo_Pesquisado",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Posicao",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "TamanhoAlfa",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Origem",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Tamanho",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaHorario",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Considerar Feriado (S",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "N)",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodHor",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExtensoSemana",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Data,
				nome: "",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Extenso",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaEscala",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Escala",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Turma",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Intervalo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Mensagem",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "Para",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "<valor inicial>;",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "<condição>;",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "<contador>",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetDifDat",
		documentation: "Retorna a diferença de tempo entre duas datas",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "Serviço (1-Dia|2-Meses|3-Anos|4-Meses c/Ajuste|5-Anos c/Ajuste|4-Meses c/Ajuste[DI/DF])",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DataIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DataFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Retorno",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RestoDivisao",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "Dividendo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Divisor",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Resto",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "Divide",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "Divisor",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Dividendo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipoDivisao (1-Normal|2-Resto|3-Parte inteira da divisão)",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Retorno",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "TruncarValor",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "Valor",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetHtmlFicReg",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "Pasta",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "vHtml",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Alt",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WStrtoJavaScript",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aStrOrigem",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aStrDestino",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "TiraEspacos",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "xDigito",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "xRetorno",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ConverteParaMaiusculo",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "TextoConverter",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "TextoConvertido",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WAlteraValorCampo",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNomeValor",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aValorCampo",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "MontaAbrangencia",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "pCpoTab",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "pAbgInf",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "pAbrRetorno",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "__Inserir",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: ":Nome_Variavel",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCheckValDouble",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aDescricao",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "aRetorno",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aOpcional",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "aTamMax",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetQtdVagLoc",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TabOrg",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumLoc",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "EstCar",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "CodCar",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Turno DatAlt QtdVaga",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipVag",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "BusCadChefe",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatBas",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Nivel",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "ExcecaoChefia",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "EmpChe",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipChe",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CadChe",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "LocChe",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "LocCol",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "EnviaEMail",
		documentation: "Função que permite enviar e-mails. (CodErroEnviaEmail e MsgErroEnviaEmail)",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "[Alfa Rememetente]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Destinatario",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "[Alfa CopiaPara]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "[Alfa CopiaOcultaPara]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "[Alfa Assunto]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "[Alfa Texto]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "[Alfa Anexos]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nPapelCarta",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "EnviaEMailHTML",
		documentation: "Função que permite enviar e-mails em formato HTML e com imagens no corpo do E-mail. (CodErroEnviaEmail e MsgErroEnviaEmail)",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "[Alfa Rememetente]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Destinatario",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "[Alfa CopiaPara]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "[Alfa CopiaOcultaPara]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "[Alfa Assunto]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "[Alfa Texto]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "[Alfa Anexos]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "aTratarAnexo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nPapelCarta",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "BusEmailFunc",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "EmailParticular",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "EmailComercial",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaBatidaHorario",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "CodHor",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "SeqMar",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "UsoMar",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "HorMar",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TolAnt",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TolApo",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "FaiMov",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExtrasIntervalo",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "horaini",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "horafim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "diaext",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "qtddiu",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "qtdnot",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetMinRefHTr",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "QtdeMinutos",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetVinEmp",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DataRef",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaCodLoc",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumLoc",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "CodLoc",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetTurCol",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Data,
				nome: "",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Turno",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "InsClauSQLWhere",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "SectionName",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "WhereClau",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaHorarioApurado",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodHor",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Mensagem",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "DataHoje",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Data,
				nome: "Retorno",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaAnoData",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Data,
				nome: "DataBase",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Ano",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaMesData",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Data,
				nome: "DataBase",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Mes",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaDiaData",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Data,
				nome: "DataBase",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Dia",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "AlteraControle",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Nome_Controle",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Nome_Propriedade",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Valor_Propriedade",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaDiaSemana",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Data,
				nome: "DataBase",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Retorno",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "AdicionarCampo",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "NomeCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Tipo_Campo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "[",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Tamanho]",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "Chave",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Nome_Campo [;Nome_Campo[;Nome_Campo]...]",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "VerDatFer",
		documentation: "Procura se a data específica é um feriado para o colaborador. Para isto, verifica pela filial e pela escala. Se a data for feriado,  retornará 1. Caso contrário, retornará 0.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetNivLoc",
		documentation: "Função que retorna a quantidade de níveis do local informado",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "TabOrg",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "CodLoc",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatLoc",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Nivloc",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "Concatena",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "Texto1",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Texto2",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Texto3",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Destino",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "ArredondarValor",
		documentation: "Esta função arredonda determinado valor, conforme a quantidade de casa decimais informada",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "ValorVariavel",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Precisao",
				retornaValor: false
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
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "PerIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "PerFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "SolIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "SolFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "IniFal",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "FimFal",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TemFal",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "LerPassesVtr",
		documentation: "Verifica se houve digitação de Passes de Vale Transporte",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "PerIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "PerFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TemDig",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalcularVtr",
		documentation: "Esta função calcula o valor e a quantidade de passes de vale transporte",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Tipcol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "PerIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "PerFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "RecCal",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "SolIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "SolFim",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "GravarVtr",
		documentation: "Grava os passes na tabela R028PVT, calculada anteriormente pela função CalculaVtr",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Tipcol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "PerIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "PerFim",
				retornaValor: false
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
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "SectionName",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetEscEmp",
		documentation: "Retorna a escala do funcionário em uma determinada data",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatEsc",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "VerAbrBHR",
		documentation: "Esta função verifica se o colaborador está incluído na abrangência de um determinado banco de horas",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodBhr",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatBus",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "ColBhr",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WWriteCookie",
		documentation: "Grava um campo no Cookie ativo",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Nome",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Valor",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetSinEmp",
		documentation: "Esta função retorna o código do sindicato de um colaborador em uma determinada data na variável de sistema CodSinEmp",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DataRef",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalIdaEmp",
		documentation: "cula a idade do colaborador na Data de Referência",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatRef",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalculaQtdMinutos",
		documentation: "Calcula a quantidade de minutos existente entre uma Data/Hora Inicial e uma Data/Hora Final",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Data,
				nome: "DatIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Hora HorIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DatFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Hora Horfim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Qtd_Minutos",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaNumLoc",
		documentation: "Converte o código do local para o número do local. Considera a data setada em DatRef",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "TabOrg",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "pCodLoc",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaNivelLocal",
		documentation: "Retorna uma fração do código do local do nível inicial até o nível final informados",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "TabOrg",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "CodLoc",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NivIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NivFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "NivLoc",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaAscII",
		documentation: "Esta função retorna o caractere ASCII de um número.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "CodigoASCII",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Retorno",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "PertenceGrupo",
		documentation: "Identifica se o usuário ativo pertence ao grupo de usuários passado como parâmetro. Se pertencer retornará 1, caso contrário retornará 0",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "NomGru",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WSetarCalculo",
		documentation: "Função utilizada para setar o código de cálculo para processos automáticos, via regra (Somente RubiWeb)",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodCal",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "UltimoDia",
		documentation: "Esta função verifica qual é o último dia do mês/ano da data informada, retornando esta nova data dia/mês/ano na própria variável indicada",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Data,
				nome: "Mes",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetLocEmp",
		documentation: "Retorna o local do funcionário em uma determinada data.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatLoc",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WSQLSenior2paraSQLNativo",
		documentation: "Retorna a Sintaxe de um comando SQL Senior2 para o SQL Nativo, correspondente ao banco que estiver sendo utilizado",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "SqlSenior2",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "SqlNativo",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalculaTotCol",
		documentation: "Esta função calcula o totalizador do evento, valor ou referência, de acordo com o cálculo, totalizador e o colaborador enviados por parâmetro.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "xCodCal",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodTot",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Retorna",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SelectData",
		documentation: "Função na qual é possível executar qualquer SELECT",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "SQL",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "CamposRet",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TemDados",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetCampoNumero",
		documentation: "Para buscar algum campo retornado das funções SelectData e SelectMaskedData",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "Indice",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Campos",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Retorno",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetCampoAlfa",
		documentation: "Para buscar algum campo retornado das funções SelectData e SelectMaskedData",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "Indice",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Campos",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Retorno",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetSitEmp",
		documentation: "Retorna a Situação do Colaborador em uma determinda Data (Retorna na variável SitEmp)",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "xNumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xTipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xNumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xDatSit",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetCodUsuPorColab",
		documentation: "Esta função retornará o código do usuário associadr. Caso não houver retornará zero.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "MontarSQLHistoricoSeq",
		documentation: "Esta função retorna um SQL com base em uma data e seqüência para uso com os históricos do sistema",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Tabela",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DataReferencia",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "SQL",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "MontarSQLHistorico",
		documentation: "Retorna um SQL com base em uma data para uso com os históricos do sistema",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Tabela",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DataReferencia",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "SQL",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetSalEmp",
		documentation: "Esta função retorna o salário do funcionário em uma determinada data.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DatSal",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WTextoParaFormatoHTML",
		documentation: "Retorna a expressão alfanumérica passada como parâmetro convertida para HTML",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "TextoInicial",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "TextoFinal",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetEstCarEmp",
		documentation: "Função que retorna a estrutura de cargos utilizada pela empresa na data informada.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatRef",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalTotFolha",
		documentation: "Utilizada para carregar as variáveis de sistema",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodRat",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetCarEmp",
		documentation: "Retorna o Cargo do funcionário em uma determinada data.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatCar",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetNomCodNiv",
		documentation: "Retorna o Nome e o código do Local do Empregado em um determinado nível.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatRef",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NivIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NivFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "NomeLoc",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "CodNivLoc",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "TiraAcentos",
		documentation: "Retira os caracteres especiais, retornando o texto em maíusculo.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Texto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Retorno",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalSalEmpCS",
		documentation: "Esta função retorna o salário do funcionário em relação ao tipo",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "TipSal",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DataBase",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExtensoMes",
		documentation: "Esta função retorna o nome por extenso do mês passado como parâmetro",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "DataBase",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Extenso",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "BusSalClaNiv",
		documentation: "Esta função retorna o valor do salário da estrutura/classe/nível passados como parâmetro, e se desejar (informando tipo 2), o número de meses de complemento do nível salarial.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "EstruturaSalario",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Classe",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Nivel",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Tipo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatSal",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NivelMercado",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "ValorSalario",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NroMeses",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetExtMoeda",
		documentation: "Gera o extenso de um valor (moeda). Obs: não completa o espaço restante com o caracter “*”.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "Valor",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "ExtensoDoValor",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExtensoNumero",
		documentation: "Retorna o valor por extenso do número passado como parâmetro.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "Valor",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "ExtensoDoValor",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ProximaPagina",
		documentation: "Permite verificar se uma determinada seção será impressa na próxima página.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Secao",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Retorno",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "BusHorBase",
		documentation: "Retorna o horário base do colaborador em uma determinada data.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatHor",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "Minusculo",
		documentation: "Converte um valor alfanumérico de maiúsculo para minúsculo (SOMENTE NO RUBI)",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Texto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Retorno",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "PrimeiraLetraMiuscula(S/N)",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExecutaRelatorio",
		documentation: "Permite que sejam executados relatórios através das regras.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "NomeModelo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "ExibirTelaEntrada",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SetaNumeroTelaEntrada",
		documentation: "Permite ao usuário alterar os valores numéricos da tela de entrada do modelo.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "NomeCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Valor",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SetaDataTelaEntrada",
		documentation: "Permite ao usuário alterar os valores do tipo data da tela de entrada do modelo.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "NomeCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Valor",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SetaAlfaTelaEntrada",
		documentation: "Permite ao usuário alterar os valores alfanuméricos da tela de entrada do modelo.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "NomeCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Valor",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "EscondeCampoTelaEntrada",
		documentation: "Permite ao usuário esconder determinados campos da tela de entrada do modelo",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "NomeCampo",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetCodNomLocNiv",
		documentation: "Retorna o nome e o código do local, no nível informado",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumLoc",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NroNiv",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DatLoc",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "NomLoc",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "CodNivLoc",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetNumLocNiv",
		documentation: "Retorna o código do local no nível passado como parâmetro.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "TabOrg",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumLoc",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DataRef",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Nivel",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumLocNiv",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ConvStrPNum",
		documentation: "Converte um valor tipo string para numérico.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "ValorEntrada",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "ValorRetorno",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "BuscaDiaSit",
		documentation: "Esta função retorna a quantidade de dias de uma situação em um período informado. Esta função não apresenta as seguintes situações: 15 (ronda) e 16 (todos os módulos)",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nTipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "dDatIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "dDatFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nCodSit",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nQtdDia",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetSalEst",
		documentation: "Retorna o salário (sem nenhuma conversão) de uma Estrutura/Classe/Nível específica em uma determinada data.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nEstSal",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aClaSal",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNivSal",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "dDatRef",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetBHRDat",
		documentation: "Esta função retorna o saldo do banco de horas conforme a data especificada para verificação. O valor que será retornado corresponderá ao saldo inicial da data. Não são considerados os lançamentos efetuados no dia.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodBhr",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatBas",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "BhrDat",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExcLanBhr",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodBhr",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatLan",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodSit",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "IncLanBhr",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodBhr",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatLan",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodSit",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "QtdHor",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatCmp",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetDatCmp",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatLan",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodBhr",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodSit",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatCmp",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetTabOrgEmp",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DataRef",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TabOrg",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "GravaFotoColaboradorEmDisco",
		documentation: "Grava a foto do colaborador em disco. Esta foto será salva no mesmo tamanho em que foi gravada no Banco de Dados, sempre no formato JPEG (*.JPG).",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "DirArq",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "NomArq",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Retorno[0=Sucesso | 1=Erro]",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "MsgErro",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "BusCadChefeLocal",
		documentation: "Busca o chefe de um local especificado.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TabOrg",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "CodLoc",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Turno",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Nivel",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatBas",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "EmpChe",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipChe",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CadChe",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "LocChe",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "LocCol",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExecSQLEx",
		documentation: "Implementada a função ExecSqlEx que permite a execução de comandos SQL no banco de dados efetuando tratamento de exceções",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "ComandoSQL",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Sucesso(0 - Sucesso | 1 - Erro)",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "MensagemErro",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "InserirAlfa",
		documentation: "Insere um ou mais caracteres em uma Variável/Campo, a partir da posição indicada. Havendo informação no campo alfa, no qual deseja-se inserir o texto, as que estiverem a partir da posicão indicada serão deslocadas para a direita e o que passar do tamanho definido do campo/variável será truncado.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Texto_Origem",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Variável_Destino",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Posicao_Inicial",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "TempoTrabFun",
		documentation: "Esta função retorna o tempo de trabalho em meses, de um funcionário em um determinado período",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DataIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DataFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "ConAfa",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NrMeses",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "MensagemLog",
		documentation: "Esta função cancela o processamento em execução e mostra a mensagem de erro passada como parâmetro",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Mensagem",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetPrxClaNiv",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "Opcao(1-Classe | 2-Nível)",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Estrutura",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DatBas",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Classe",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Nivel",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "ProximaClasse",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "ProximoNivel",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "InsSQLWhereSimples",
		documentation: "Permite Inserir uma cláusula WHERE dentro de um SQL durante a execução da regra de pré-seleção. As tabelas referenciadas no SQL não são incluídas na cláusula FROM do comando SQL.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "NomeSecao",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "ClausulaWhere",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetAdiEmp",
		documentation: "Esta função retorna o Adicional do funcionário em uma determinada data",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nTipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "dDatAdi",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalculaQtdDep",
		documentation: "Calcula a quantidade de dependentes.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nTipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "dDatPag",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetEtbEmp",
		documentation: "Retorna a estabilidade do funcionário em uma determinada data.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nTipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "dDatEtb",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_Criar",
		documentation: "Função que cria um cursor, ou um objeto para execução de SQL, e retorna no parâmetro \"Objeto\".",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_Destruir",
		documentation: "Função que destrói um cursor depois de sua utilização, o mesmo deve ser chamado quando o cursor não for mais utilizado.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_DefinirComando",
		documentation: "Função que aplica o comando SQL para o cursor passado como parâmetro.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aSQL",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_BOF",
		documentation: "Função que retorna se o cursor está na posição inicial (antes do primeiro registro). Se o cursor está na posição BOF, o valor retornado é 1 (um), caso contrário é 0 (zero).",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_EOF",
		documentation: "Função que retorna se o cursor está na posição final (depois do último registro). Se o cursor está na posição EOF, o valor retornado é 1 (um), caso contrário é 0 (zero)",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_AbrirCursor",
		documentation: "Função que abre o cursor depois de informado o SQL a ser utilizado.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_Proximo",
		documentation: "Função que posiciona o cursor no próximo registro.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_FecharCursor",
		documentation: "Função que fecha a pesquisa sendo feita pelo cursor.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_RetornarBoleano",
		documentation: "Função que retorna um valor boleano de um campo do registro do cursor.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nValor",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_RetornarInteiro",
		documentation: "Função que retorna um valor inteiro de um campo do registro do cursor.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nValor",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_RetornarFlutuante",
		documentation: "Função que retorna um valor flutuante de um campo do registro do cursor.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nValor",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_RetornarData",
		documentation: "Função que retorna uma data de um campo do registro do cursor.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "dValor",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_RetornarAlfa",
		documentation: "Função que retorna um valor do tipo alfa (string) de um campo do registro do cursor.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aValor",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_RetornarBlob",
		documentation: "Função que retorna um Blob de um campo do registro do cursor.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aValor",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_RetornarSeNulo",
		documentation: "Função que retorna um valor booleano, que significa se o campo é nulo ou não.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_DefinirBoleano",
		documentation: "Função que define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo boleano.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nValor",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_DefinirInteiro",
		documentation: "Função que define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo inteiro.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nValor",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_DefinirFlutuante",
		documentation: "Função que define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo numérico com ponto flutuante.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nValor",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_DefinirData",
		documentation: "Função que define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo data.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "dValor",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_DefinirAlfa",
		documentation: "Função que define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo alfanumérico.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aValor",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_DefinirBlob",
		documentation: "Função que seta define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo blob.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aValor",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SQL_UsarAbrangencia",
		documentation: "Função que informa ao cursor se é para utilizar abrangência de usuários.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nUsar",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "CalSalEmp",
		documentation: "Retorna o salário do funcionário em relação ao tipo.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nTipCal",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nTipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "dDatSal",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetQtdDiasUtil",
		documentation: "Retorna a quantidade de dias úteis dentro de um determinado período, levando-se em consideração os dias de segunda a sexta-feira, desde que não estejam cadastrados como feriado na Tabela de Feriados passada como parâmetro na função.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Data,
				nome: "dDatIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "dDatFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nTabFer",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nQtdDiasUtil",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetApuPon",
		documentation: "Esta função retorna o tipo de apuração do colaborador, conforme o histórico de apuração.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nTipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "dDatApu",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nApuPon",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetFilEmp",
		documentation: "Retorna a filial do funcionário em uma determinada data.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nTipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "dDatRef",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "CarregaImgControle",
		documentation: "Carregar uma imagem do banco ou arquivo para um controle imagem do modelo",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "NomeDoControleImagem",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "Opcao[0-Arquivo;1-Banco;2-Variavel]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "CaminhoCampoNome",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "ClausulaWhereSQL",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "SqlSenior2",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "Gravarnl",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nManArquivo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aVar",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "Abrir",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "NomeArq",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "ModoAbertura [Ler|Gravar|LerNL|GravarNL]",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "ExecutaTelaSgi",
		documentation: "Esta função executa a tela do SGI passada como parâmetro. Se a tela for executada com sucesso, a função retornará 1. Caso contrário, retornará 0.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "xNomeTela",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "GlbRetVarStr",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aVarNome",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aVarValor",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "GlbAdiVarStr",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aVarNome",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aVarValor",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "CarregaAbrUsu",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNomCam",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "aCond",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aSobrepoeAbr",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aValorAbr",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaAbrUsu",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCodMod",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "aTipoAbr",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "aCodUsu",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "aIDPerfil",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "aCond",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aValAbr",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SetaValorFormula",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "aNomeControle",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nValorControle",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "BusCraTit",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumEmpFun",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nTipColFun",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumCadFun",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "dDatAccFun",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumCraFun",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "VerNumAbr",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumero",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aAbrangencia",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nRetorno (0-Não está|1-Está)",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "MontaCriteriosAperfeicoamento",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "xHisCua",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xValCua",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xRevCua",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xCerApr",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xCerPar",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xSitAnd",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xSitCom",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xSitDes",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xSitSus",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xSitMed",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xSitFre",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xSitTrf",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xAbrCua",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "WPersonalizaMenuWeb",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nPosicao",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aMenuPai",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aTitulo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aLink",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNome",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aTipo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nTarget",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetLocNiv",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nTipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nNroNiv",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "CodLoc",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "CarregaDistribuicaoEPI",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TabOrg",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumLoc",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "EstCar",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "CodCar",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DatIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DatFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DatRef",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "AbrEpi",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "ColBom",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "TipOpe",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "TipPes",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipOrd",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaDistribuicaoEPI",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "TipOpe [I",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "P",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "A",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "F]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodEpi",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "MedEpi",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "DesMot",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DatEnt",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DatRev",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DatVal",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "RecIns",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Data,
				nome: "DatAju",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodMtv",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Data,
				nome: "dDatDev",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "GlbAdiVarNumDat",
		documentation: "Adiciona uma variável global numérica/data em memória",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aVarNome",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nValor",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "GlbAdiVarStr",
		documentation: "Adiciona uma variável global alfa numérica em memória",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "VarNome",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aValor",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "GlbRetVarNumDat",
		documentation: "Retorna o conteúdo de uma variável global numérica, armazenada pela função GlbAdiVarNumDat. Exemplo: x := GlbRetVarNumDat(vNomVar);",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "VarNome",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "GlbRetVarStr",
		documentation: "Retorna o conteúdo de uma variável global armazenada pela função GlbAdiVarStr.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "VarNome",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aVarValor",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "AlteraValorFormula",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNomeFormula",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nValor",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetHorPrvTrb",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "NumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "TipCol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "NumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "HorIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "HorFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatVer",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xhorprv",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "xdiaint",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WCheckValImage",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aDescricao",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aRetorno",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "lfa aOpcional",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aExtensao",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "aTamMax",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "GravaImagemBanco",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aTabela",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCamposChave",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aOutrosCampos",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCampoImagem",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "aOrigem",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aArquivo",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aMensagem",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "Encriptar",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aValor",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "aChave",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aResultado",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "Desencriptar",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aValor",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "aChave",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aResultado",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ArqExiste",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNomeArq",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetHorTrab",
		documentation: "Retorna a quantidade de horas trabalhadas num determinado período.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "dDatIni",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "dDatFim",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aAbrTip",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aAbrLoc",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aFilSit",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aAbrSit",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nQtdHor",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ConverteDataHoraDateTime",
		documentation: "A função serve para montar uma data e uma hora passados como parâmetro em uma string no formato datetime do banco.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "dData",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nHora",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aDataHoraBanco",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "GeraHash",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "Texto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Algoritmo [MD5 | SHA1 | SHA256 | SHA512]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "Hash",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "WRemoteAddr",
		documentation: "Retorna o endereço IP da estação que está acessando o sistema. Utilizada apenas nos sistemas Web.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aIp",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegEntLe",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nCodEnt",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegEntEhUsuario",
		documentation: "Esta função indica se o Usuário/Grupo passado em aObjeto é um usuário. Se sim o resultado direto da função é 1 senão será 0.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegUsuAtivado",
		documentation: "Esta função indica se o acesso ao usuário passado em aObjeto está desativado. Se sim o resultado direto da função é 1 senão será 0.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegEntQtdGrp",
		documentation: "Esta função retorna diretamente a quantidade de grupos do Usuário/Grupo passado em aObjeto.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegEntNome",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNome",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegUsuNomeComp",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNome",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegUsuSetaSenha",
		documentation: "Esta função seta a senha do usuário passado em aObjeto através do parâmetro aNovaSenha retornando o aObjeto(Usuário) com a senha setada.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNovaSenha",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegUsuSetaAtivado",
		documentation: "Esta função seta a opção Conta Desabilitada do usuário passado em aObjeto através do parâmetro nOpcao: 1 = Conta Habilitada ou 0 = Conta Desabilitada retornando aObjeto(Usuário) com a opção setada.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nOpcao [0:Desabilitar | 1: Habilitar]",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegUsuDatExp",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aObjeto",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetDiaHor",
		documentation: "Função que concatena os dias da semana que contenham o mesmo horário de curso.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nCodHCu",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNomDia1",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNomDia2",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNomDia3",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNomDia4",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNomDia5",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNomDia6",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNomDia7",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aStrHor1",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aStrHor2",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aStrHor3",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aStrHor4",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aStrHor5",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aStrHor6",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aStrHor7",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaDistribuicaoEPI",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "TipOpe",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodEpi",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "MedEpi",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "DesMot",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatEnt",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatRev",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatVal",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "RecIns",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "DatAju",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "CodMtv",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ValidaPISCPF",
		documentation: "Função para Validar um número de CPF ou PIS.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nTipo [1-PIS | 2-CPF]",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aPISCPF",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nValido [0-OK | 10-Inválido]",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "TrocaCadastro",
		documentation: "Esta função tem a funcionalidade de efetuar a troca de cadastro de colaboradores.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nCadNov",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nCadAnt",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nTipCol",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "SegEntExistePorNome",
		documentation: "Essa função verifica pelo nome se o usuário/grupo existe.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNome",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "NumeroParaAlfa",
		documentation: "Converte um número para formato alfanumérico, mantendo as casas decimais e sem arredondar.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nOrigem",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aDestino",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "GravaFotoColaboradorEmDisco",
		documentation: "Grava a foto do colaborador em disco. Esta foto será salva no mesmo tamanho em que foi gravada no Banco de Dados, sempre no formato JPEG (*.JPG).",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumEmp",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nTipcol",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumCad",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aDirArq",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNomArq",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nRetorno",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aMsgErro",
				retornaValor: false
			}
		]
	})
	, new AutoCompleteItem({
		label: "GravaFotoCandidatoEmDisco",
		documentation: "Grava a foto do candidato em disco. Esta foto será salva no mesmo tamanho em que foi gravada no Banco de Dados,  no formato JPEG (*.JPG).",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "nNumCan",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aDirArq",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNomArq",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Numero,
				nome: "nRetorno",
				retornaValor: true
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aMsgErro);",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "RetornaNomeUsuario",
		documentation: "É uma função que permite utilizar os nomes disponíveis no cadastro de propriedades do usuário no SGU - Senior Gerenciador de usuários.",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Numero,
				nome: "aCodUsu",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aNomUsu",
				retornaValor: true
			}
		]
	})
	, new AutoCompleteItem({
		label: "ConverteCodificacaoString",
		documentation: "Esta função altera a codificação de um texto contido em uma variável, onde este texto com a codificação alterada pode ser utilizado para comunicação com web services. Se o sistema não suportar a codificação informada, será emitida a seguinte mensagem: \"A codificação X não é suportada. Verifique a documentação\".",
		kind: CompletionItemKind.Method,
		parametros: [
			{
				tipo: ETipoParametro.Alfa,
				nome: "aString",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aCodificacao",
				retornaValor: false
			},
			{
				tipo: ETipoParametro.Alfa,
				nome: "aResultado",
				retornaValor: true
			}
		]
	})

];


export default autoCompleteList;
