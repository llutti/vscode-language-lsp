# Log das Alterações realizadas

Alterações realizadas na extensão.

## [1.0.3] - 23/04/2021
### Adicionado
-

### Alteraçãoes
-

## [1.0.2] - 23/04/2021
### Adicionado
- Validação de sintaxe da regra (em carater Experimental):
  - Novo parâmetro para Ativar/Desativar a verificação
  - Verificar a falta do ";" depois do "Fim" ou da definição de variáveis

### Alteraçãoes
- Melhorar a apresentação dos parâmetros das funções durante a digitação.

## [1.0.1] - 16/04/2021
### Adicionado
- Documentação das funções para manipulação de arquivos texto.
- Melhoria na documentação das funções de envio de e-mail.

## [1.0.0] - 11/03/2021
- Publicação no marketplace do VSCode

## [0.1.3] - 05/03/2021
### Adicionado
- Adicionada documentação dos métodos: **Base64Decode**, **Base64Encode** e **WebCodificaUrl**

## [0.1.2] - 28/10/2020
### Adicionado
- Adicionada documentação dos métodos: **AbrirArquivo** e **LerNovaLinha**

## [0.1.1] - 18/09/2020
### Adicionado
- Opção gerar um "bloco de código" utilizando a sintaxe para abrir/fechar:
  - @-- Bloco ['Qualquer Texto'] --@
  - @-- FimBloco ['Qualquer Texto'] --@
- Criado novos *atalhos de código*: **InicioBlocoCodigo** e  **FimBlocoCodigo**
- Adicionado como "brackets" **Inicio**...**Fim;** para que sejam destacado
- Sempre que for digitado **Inicio** a palavra **Fim;** será adicionado automaticamente

## [0.1.0] - 16/09/2020
### Alteraçãoes
- Melhoria na identificação dos parâmetros das funções customizadas
- Melhoria na documentação do comando *ExecSQLEx*

## [0.0.9] - 15/09/2020
### Adicionado
- Criado um *parser* para identificar as funções customizadas

### Alterações
- Melhorado o tratamento para parâmetros do tipo texto na SignatureHelp

## [0.0.8] - 14/09/2020
### Adicionado
- Foram adicionadas as contantes *cVerdadeiro* e *cFalso* no *AutoComplete*

### Alterações
- Refatorar a estrutura do Client (remover os providers Hover e SignatureHelp)
- Refatorar a estrutura do Server (implementar os providers Hover e SignatureHelp)
- Melhoria na documentação de algumas funções

## [0.0.7] - 10/09/2020
### Adicionado
- Implementado o recurso "Ajuda na Assinatura dos Métodos (SignatureHelp)", para mostrar os parâmetros das funções internas

## [0.0.6] - 09/09/2020
### Adicionado
- Adicionar as funções de lista no autocomplete

### Alterações
- Movido os providers do Server para Client da extensão

## [0.0.5] - 03/09/2020
### Adicionado
- Disponibilizado recurso de "hover" (ao passar o cursor sobre uma função ou palavra chave, é apresentado um popup com a documentação)

## [0.0.4] - 28/08/2020
### Adicionado
- Foram incluídas novas funções internas da LSP no *Autocomplete*

## [0.0.3] - 27/08/2020
### Adicionado
- Implementado *Autoindentação* após o *inicio*
- Implementado *Autocomplete* baseado em um arquivo de configurações

### Alterações
- Melhoria na identificação da sintaxe

## [0.0.2] - 26/08/2020

- Foram adicionados Snippets
- Melhor identificação dos elementos de sintaxe
- Publicar no Github

## [0.0.1] - 24/08/2020

- Liberação Inicial