import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionItemProvider, CompletionList, Position, ProviderResult, SnippetString, TextDocument } from 'vscode';
import autoCompleteList from '../autocomplete';

export class LSPCompletionItemProvider implements CompletionItemProvider
{
	provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList>
	{
		if (position.character > 4)
		{
			const lastChar = document.lineAt(position).text.substr(position.character - 1, 1);

			if (lastChar === '.')
			{
				const newPosition: Position = new Position(position.line, position.character - 1);

				const range = document.getWordRangeAtPosition(newPosition);
				const word = document.getText(range);

				if (word?.toLowerCase()?.startsWith('lst_') === true)
				{
					const metodosLista: CompletionItem[] = [
						{ label: 'Adicionar', kind: CompletionItemKind.Method, insertText: 'Adicionar();' },
						{
							label: 'AdicionarCampo',
							documentation: 'Adiciona os campos. Nesta adição também deve ser informado o tipo e o tamanho se necessário.',
							kind: CompletionItemKind.Method,
							detail:'AdicionarCampo(Alfa NomeCampo, TipoInterno [Alfa|Numero|Data], Numero Tamanho);',
							insertText: new SnippetString('AdicionarCampo("${1}",${2|Alfa,Data,Numero|});')
						},
						{ label: 'Anterior', kind: CompletionItemKind.Method, insertText: 'Anterior();' },
						{ label: 'Cancelar', kind: CompletionItemKind.Method, insertText: 'Cancelar();' },
						{ label: 'Chave', kind: CompletionItemKind.Method, insertText: new SnippetString('Chave("${1}");') },
						{
							label: 'DefinirCampos',
							documentation: 'Inicia a fase de adição de campos na lista. Somente podem ser adicionado campos durante este período, ou seja, após a chamada deste comando. O mesmo não adiciona nenhuma informação de campos. Isto será feito por um comando que será visto mais tarde.',
							kind: CompletionItemKind.Method,
							insertText: 'DefinirCampos();'
						},
						{ label: 'Editar', kind: CompletionItemKind.Method, insertText: 'Editar();' },
						{
							label: 'EditarChave',
							documentation: 'Tem o mesmo objetivo do comando SetarChave mas sem apagar os valores de chave. Quando este comando for chamado os valores que estiverem contidos na chave neste momento serão mantidos e ainda assim a lista entrará em modo de edição de chave.\nServe para procurar por chaves muito parecidas sem que seja necessário informar todos os valores novamente.',
							kind: CompletionItemKind.Method,
							insertText: 'EditarChave();'
						},
						{
							label: 'EfetivarCampos',
							documentation: 'Determinará o fim da adição de campos e informará ao compilador/interpretador que a partir deste ponto a lista será usada efetivamente (receberá valores). Também permitirá ao interpretador criar estruturas internas de controle e manipulação desta lista.',
							kind: CompletionItemKind.Method,
							insertText: 'EfetivarCampos();'
						},
						{ label: 'Excluir', kind: CompletionItemKind.Method, insertText: 'Excluir();' },
						{ label: 'FDA', kind: CompletionItemKind.Method, insertText: 'FDA' },
						{ label: 'Gravar', kind: CompletionItemKind.Method, insertText: 'Gravar();' },
						{ label: 'IDA', kind: CompletionItemKind.Method, insertText: 'IDA' },
						{ label: 'Inserir', kind: CompletionItemKind.Method, insertText: 'Inserir();' },
						{ label: 'Limpar', kind: CompletionItemKind.Method, insertText: 'Limpar();' },
						{ label: 'NumReg', kind: CompletionItemKind.Method, insertText: 'NumReg();' },
						{ label: 'Primeiro', kind: CompletionItemKind.Method, insertText: 'Primeiro();' },
						{ label: 'Proximo', kind: CompletionItemKind.Method, insertText: 'Proximo();' },
						{ label: 'QtdRegistros', kind: CompletionItemKind.Method, insertText: 'QtdRegistros;' },
						{ label: 'SetaNumReg', kind: CompletionItemKind.Method, insertText: 'SetaNumReg();' },
						{
							label: 'SetarChave',
							documentation: 'Coloca a lista em estado de edição de chave para que seja possível a manipulação dos valores da chave. Quando configurados estes valores será possível procurar os registro que possuem a chave informada. Isto será feito através do comando VaiParaChave que será visto a seguir.\nApaga os valores que estiverem na chave no momento da chamada. Para manter os valores da chave use o comando EditarChave.',
							kind: CompletionItemKind.Method,
							insertText: 'SetarChave();'
						},
						{ label: 'Ultimo', kind: CompletionItemKind.Method, insertText: 'Ultimo();' },
						{
							label: 'VaiParaChave',
							documentation: 'Procura pelo registro que tiver a chave configurada naquele momento. Exemplo: Consideremos que a chave da lista seja o código de cadastro do funcionário e que o mesmo tenha o valor 10 após a chamada do comando SetarChave. Quando o comando VaiParaChave for chamado a lista será posicionada no primeiro registro onde o número do cadastro do funcionário for 10. Se o registro com esta característica não for encontrado, a lista não será reposicionada.\nCaso o comando encontre o registro procurado, será retornado 1. Caso contrário será retornado 0 (zero).',
							kind: CompletionItemKind.Method,
							insertText: 'VaiParaChave()'
						},
					]
					return metodosLista;
				}

			}
		}

		return autoCompleteList.map<CompletionItem>((item) =>
		{
			return {
				label: item.label,
				kind: item.kind,
				detail: item?.detail(),
				documentation: item?.documentation
			}
		})
	}

	resolveCompletionItem?(item: CompletionItem, token: CancellationToken): ProviderResult<CompletionItem>
	{
		return item;
	}

}
