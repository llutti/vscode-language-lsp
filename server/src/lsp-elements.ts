import { MarkupContent } from 'vscode-languageserver';

export enum EParameterType
{
	Alfa = 'Alfa',
	Numero = 'Numero',
	Data = 'Data',
	Funcao = 'Funcao',
	Lista = 'Lista',
}

export enum LSPTypeObject
{
	Method = 2,
	Function = 3,
	Constant = 21,
}

export interface LSPParameter
{
	type: EParameterType;
	name: string;
	documenation?: string | MarkupContent;
	isReturnValue: boolean;
}

export interface LSPTemplateClass
{
	label: string;
	type: LSPTypeObject;
	documentation?: string | MarkupContent;
	parameters?: LSPParameter[];
	insertText?: string;
}
export class LSPClass
{
	public readonly name: string;
	public label: string;
	public fileUri: string;
	public documentation?: string | MarkupContent;
	public type?: LSPTypeObject;
	public parameters?: LSPParameter[];
	public insertText?: string;

	private isInternal: boolean

	constructor(name: string, isInternal: boolean = false)
	{
		this.name = name.toLowerCase();
		this.isInternal = isInternal;
		this.label = '';
		this.fileUri = 'interno';
	}

	public signature(): string
	{
		if (this.type === LSPTypeObject.Constant)
		{
			return '';
		}

		const params = this.parameters?.map<string>(p => `${p.type} ${p.isReturnValue ? 'End ' : ''}${p.name}`).join(', ') || '';
		const prefix = `[${this.isInternal ? 'interno' : 'customizado'}]`;
		const sufixo = this.type === LSPTypeObject.Function ? `:${EParameterType.Numero}` : '';

		return `${prefix} ${this.label} (${params})${sufixo}`;
	};

	public static fromTemplate(template: LSPTemplateClass, isInternal: boolean = false): LSPClass
	{
		let novaClasse = new LSPClass(template.label, isInternal);

		novaClasse.label = template.label;
		novaClasse.documentation = template.documentation;
		novaClasse.type = template.type;
		novaClasse.parameters = template.parameters;
		novaClasse.insertText = template.insertText;

		return novaClasse;
	}
};
