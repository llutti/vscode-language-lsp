import type { TypeName } from '../../parser/ast';
import { casefold } from '../../utils/casefold';

export type ListaMethod = {
  name: string;
  nameNormalized: string;
  paramTypes: TypeName[];
  minArgs: number;
  maxArgs: number;
  documentation?: string;
  detail?: string;
  insertText?: string;
  insertTextFormat?: 1 | 2;
};

export type ListaProperty = {
  name: string;
  nameNormalized: string;
  documentation?: string;
  detail?: string;
  insertText?: string;
  insertTextFormat?: 1 | 2;
};

/**
 * Fonte legada (V1): metodosLista (CompletionItem[]) em V1/server/src/lsp-context.ts.
 * Migramos para a V2 as propriedades: documentation, detail, insertText e insertTextFormat.
 */
const methods: ListaMethod[] = [
  {
    name: 'DefinirCampos',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    documentation: 'Inicia a fase de adição de campos na lista. Somente podem ser adicionado campos durante este período, ou seja, após a chamada deste comando. O mesmo não adiciona nenhuma informação de campos. Isto será feito por um comando que será visto mais tarde.',
    insertText: 'DefinirCampos();'
  },
  {
    name: 'EfetivarCampos',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    documentation: 'Determinará o fim da adição de campos e informará ao compilador/interpretador que a partir deste ponto a lista será usada efetivamente (receberá valores). Também permitirá ao interpretador criar estruturas internas de controle e manipulação desta lista.',
    insertText: 'EfetivarCampos();'
  },
  {
    name: 'AdicionarCampo',
    paramTypes: ['Alfa', 'Desconhecido', 'Numero'] as TypeName[],
    minArgs: 2,
    maxArgs: 3,
    documentation: 'Adiciona os campos. Nesta adição também deve ser informado o tipo e o tamanho se necessário.',
    detail: 'AdicionarCampo(Alfa NomeCampo, TipoInterno [Alfa|Numero|Data], Numero Tamanho);',
    insertText: 'AdicionarCampo("${1}",${2|Alfa,Data,Numero|});',
    insertTextFormat: 2 as const
  },
  {
    name: 'Adicionar',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    insertText: 'Adicionar();'
  },
  {
    name: 'Inserir',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    insertText: 'Inserir();'
  },
  {
    name: 'Editar',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    insertText: 'Editar();'
  },
  {
    name: 'Gravar',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    insertText: 'Gravar();'
  },
  {
    name: 'Cancelar',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    insertText: 'Cancelar();'
  },
  {
    name: 'Excluir',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    insertText: 'Excluir();'
  },
  {
    name: 'Primeiro',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    insertText: 'Primeiro();'
  },
  {
    name: 'Ultimo',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    insertText: 'Ultimo();'
  },
  {
    name: 'Anterior',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    insertText: 'Anterior();'
  },
  {
    name: 'Proximo',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    insertText: 'Proximo();'
  },
  {
    name: 'SetarChave',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    documentation: 'Coloca a lista em estado de edição de chave para que seja possível a manipulação dos valores da chave. Quando configurados estes valores, será possível procurar os registro que possuem a chave informada. Isto será feito através do comando VaiParaChave que será visto a seguir.\\nApaga os valores que estiverem na chave no momento da chamada. Para manter os valores da chave use o comando EditarChave.',
    insertText: 'SetarChave();',
    insertTextFormat: 2 as const
  },
  {
    name: 'EditarChave',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    documentation: 'Tem o mesmo objetivo do comando SetarChave mas sem apagar os valores de chave. Quando este comando for chamado os valores que estiverem contidos na chave neste momento serão mantidos e ainda assim a lista entrará em modo de edição de chave.\\nServe para procurar por chaves muito parecidas sem que seja necessário informar todos os valores novamente.',
    insertText: 'EditarChave();'
  },
  {
    name: 'VaiParaChave',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    documentation: 'Procura pelo registro que tiver a chave configurada naquele momento. Exemplo: Consideremos que a chave da lista seja o código de cadastro do funcionário e que o mesmo tenha o valor 10 após a chamada do comando SetarChave. Quando o comando VaiParaChave for chamado a lista será posicionada no primeiro registro onde o número do cadastro do funcionário for 10. Se o registro com esta característica não for encontrado, a lista não será reposicionada.\\nCaso o comando encontre o registro procurado, será retornado 1. Caso contrário será retornado 0 (zero).',
    insertText: 'VaiParaChave()'
  },
  {
    name: 'Chave',
    paramTypes: ['Alfa'] as TypeName[],
    minArgs: 1,
    maxArgs: 1,
    insertText: 'Chave("${1}");',
    insertTextFormat: 2 as const
  },
  {
    name: 'SetaNumReg',
    paramTypes: ['Numero'] as TypeName[],
    minArgs: 1,
    maxArgs: 1,
    insertText: 'SetaNumReg(${1});',
    insertTextFormat: 2 as const
  },
  {
    name: 'Limpar',
    paramTypes: [] as TypeName[],
    minArgs: 0,
    maxArgs: 0,
    insertText: 'Limpar();'
  },
].map((m) => ({ ...m, nameNormalized: casefold(m.name) }));

const properties: ListaProperty[] = [
  {
    name: 'IDA',
    insertText: 'IDA'
  },
  {
    name: 'FDA',
    insertText: 'FDA'
  },
  {
    name: 'NumReg',
    insertText: 'NumReg;'
  },
  {
    name: 'QtdRegistros',
    insertText: 'QtdRegistros;'
  },
].map((p) => ({ ...p, nameNormalized: casefold(p.name) }));

const methodMap = new Map(methods.map((m) => [m.nameNormalized, m]));
const propertiesSet = new Set(properties.map((p) => p.nameNormalized));
const globalAllowed = new Set<string>();

export function getListaMethod(name: string): ListaMethod | undefined
{
  return methodMap.get(casefold(name));
}

export function isListaProperty(name: string): boolean
{
  return propertiesSet.has(casefold(name));
}

export function isListaMethodName(name: string): boolean
{
  return methodMap.has(casefold(name));
}

export function isListaMethodGlobalAllowed(name: string): boolean
{
  return globalAllowed.has(casefold(name));
}

export function listListaMethods(): ListaMethod[]
{
  return [...methods];
}

export function listListaProperties(): ListaProperty[]
{
  return [...properties];
}
