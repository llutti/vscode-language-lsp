import { MarkupContent } from 'vscode-languageserver/node';

export enum EParameterType
{
  Alfa = 'Alfa',
  Numero = 'Numero',
  Data = 'Data',
  Funcao = 'Funcao',
  Lista = 'Lista',
  Cursor = 'Cursor',
  Tabela = 'Tabela'
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
  documentation?: string | MarkupContent;
  isReturnValue: boolean;
}

export enum LSPSeniorSystems
{
  'HCM' = 'HCM',
  'ERP' = 'ERP',
  'SENIOR' = 'SENIOR',
  'CUSTOMIZADO' = 'CUSTOMIZADO'
}

export interface LSPTemplateClass
{
  system: LSPSeniorSystems
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
  public readonly system: LSPSeniorSystems;

  constructor(system: LSPSeniorSystems, name: string)
  {
    this.name = name.toLowerCase();
    this.label = '';
    this.fileUri = 'interno';
    this.system = system;
  }

  public signature(): string
  {
    if (this.type === LSPTypeObject.Constant)
    {
      return '';
    }

    const params = this.parameters?.map<string>(p => `${p.type} ${p.isReturnValue ? 'End ' : ''}${p.name}`).join(', ') || '';
    const prefix = `[${this.system}]`;
    const sufixo = this.type === LSPTypeObject.Function ? `: ${EParameterType.Numero}` : '';

    return `${prefix} ${this.label}(${params})${sufixo}`;
  }

  public static fromTemplate(template: LSPTemplateClass): LSPClass
  {
    const novaClasse = new LSPClass(template.system, template.label);

    novaClasse.label = template.label;
    novaClasse.documentation = template.documentation;
    novaClasse.type = template.type;
    novaClasse.parameters = template.parameters;
    novaClasse.insertText = template.insertText;

    return novaClasse;
  }
}
