import { CompletionItemKind } from 'vscode-languageserver';

export enum ETipoParametro
{
	Alfa,
	Numero,
	Data,
	Funcao,
	Lista,
}

export interface parametroItem
{
	id: number; // Deve ser único e sequencial
	tipo: ETipoParametro;
	nome: string;
	retornaValor: boolean;
}

export class AutoCompleteItem
{
	public label: string = '';
	public documentation?: string;
	public kind?: CompletionItemKind;
	public parametros?: parametroItem[];
	public detail(): string
	{
		const params = this.parametros?.map<string>(p => `${p.tipo} ${p.retornaValor ? 'End ' : ''}${p.nome}`).join(', ') || '';
		return `${this.label}(${params})`
	};
}

export interface autoCompleteItem
{
	label: string;
	detail: string;
	documentation?: string;
	kind: CompletionItemKind;
	parametros?: parametroItem[];
}

const autoCompleteList: autoCompleteItem[] =
	[
		{
			label: "IntParaAlfa",
			detail: "IntParaAlfa(Numero valor, Alfa End retorno);",
			documentation: "Converter um 'Inteiro' para 'Alfa'",
			kind: CompletionItemKind.Method,
			parametros: [
				{
					id: 1,
					tipo: ETipoParametro.Numero,
					nome: 'valor',
					retornaValor: false
				},
				{
					id: 2,
					tipo: ETipoParametro.Alfa,
					nome: 'retorno',
					retornaValor: true
				}
			]
		},
		{
			label: "AlfaParaInt",
			detail: "AlfaParaInt(Alfa texto, Numero End retorno);",
			documentation: "Converter um 'Alfa' para 'Inteiro'",
			kind: CompletionItemKind.Method
		},
		{
			label: "TamanhoAlfa",
			detail: "TamanhoAlfa(Alfa texto, Numero End tamanho);",
			documentation: "Retorno na variável 'Tamanho' a quantidade de caracteres identificado no parâmetro 'texto'",
			kind: CompletionItemKind.Method
		},
		{
			label: "ConverteMascara",
			detail: "ConverteMascara(Numero tipoDado, Numero valor, Alfa End retorno, Alfa Mascara);",
			// documentation: "",
			kind: CompletionItemKind.Method
		}
	];

export default autoCompleteList;
