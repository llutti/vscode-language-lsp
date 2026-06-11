# Log das Alterações realizadas

Alterações realizadas na extensão.

## [2.0.4] - 01/06/2026
### Novidades
  - Adicionar documentação da função `CalculaDias`
  - Adicionar documentação da variável reservada `ValStr`

## [2.0.3] - 28/05/2026
### Atualizar
  - Ajustar o formatador para normalizar operadores lógicos (`e`/`ou`) em expressões multilinha de `Se`, `Enquanto` e `Para`, movendo o operador do fim da linha anterior para o início da linha de continuação.
  - Preservar comentários inline ao normalizar expressões lógicas multilinha, mantendo o padrão TS-like do formatador.

## [2.0.2] - 06/05/2026
### Novidades
  - Adicionar o diagnóstico `LSP1106` para sinalizar declarações duplicadas de `Definir Funcao`.

### Atualizar
  - Melhorar o retorno do formatador quando a formatação for bloqueada por erro sintático, exibindo uma mensagem com a causa do bloqueio.

## [2.0.1] - 05/05/2026
### Atualizar
  - Melhorar documentação das funções:
    - `HoraServidor`
    - `MontaComandoLike`
    - `NomeComputador`
    - `NomeUsuarioWindows`
    - `RetCodUsuPorColab`
  - Ampliar palavras chave para sintaxe highlight do SQL.

## [2.0.0] - 23/04/2026
### Novidades
- Novo compilador com análise semântica, dignósticos aprimorados
- Maior suporte a funções internas da Senior (Tecnologia, ERP, HCM, Ronda Acesso)
- Hover e autocomplete aprimorados (internas, keywords, tipos, snippets)
- Syntax highlighting aprimorado
- Formatador de código
- Correções rápidas para diversos dignósticos
- Diversas opções de refatoração
- Outras melhorias:
  - Renomear variável [F2]
  - Ir para definição [F12] (funções customizadas)
  - Ir para implementação [CTRL+F12] (funções customizadas)

## [1.2.17] - 21/01/2026
### Atualizar
  - Atualizar dependências do projeto
  - Melhorar documentação das funções:
    - `Concatena`
    - `WCheckValImage`
  - Ajustar link's de documentação, para a versão 6.10.4 do HCM

## [1.2.16] - 02/10/2025
### Atualizar
  - Atualizar dependências do projeto
  - Melhorar o snippet "cor"
  - Melhorar documentação da função "TrocaString"

## [1.2.15] - 27/06/2025
### Atualizar
  - Atualizar dependências do projeto
  - Melhorar o snippet "cor"

## [1.2.14] - 29/01/2025
### Atualizar
  - Atualizar os parâmetros das funções `BusCadChefe` e `BusCadChefeLocal`
  - Atualizar dependências do projeto

## [1.2.13] - 03/04/2024
### Adicionado
  - Implementado o recurso de "ir para definição" para funções customizadas (definidas no LSP)

## [1.2.12] - 02/02/2024
### Corrigir
  - Diagnóstico de "senao sem inicio/fim"; ([#12](https://github.com/llutti/vscode-language-lsp/issues/12))
  - Diagnóstico atribuição de valores; ([#12](https://github.com/llutti/vscode-language-lsp/issues/12))

## [1.2.11] - 25/01/2024
- Documentação da função:
  - `RetornaEscala (HCM)`
  - `LimpaEspacos (ERP)`
- Preparar para separar as funções do Ronda Senior (Acesso);

## [1.2.10] - 01/11/2023
### Adicionado
- Documentação das funções:
  - `HttpAlteraCabecalhoRequisicao`
  - `HttpDelete`
  - `HttpDeleteBody`
  - `HttpDownload`
  - `HttpGet`
  - `HttpNormalizaRetorno`
  - `HttpObjeto`
  - `HttpPatch`
  - `HttpPost`
  - `HttpPut`
  - `HttpSetAttachment`

- Documentação da função:
  - `GravaImagemBanco`

## [1.2.8] - 05/07/2023
### Adicionado
- Documentação das funções:
  - `AlteraControle`
  - `ExtrasIntervalo`
  - `InsClauSQLWhere`
  - `RetornaCodLoc`

## [1.2.7] - 12/05/2023
### Adicionado
- Funções da SENIOR:
  - `ExecProg`
  - `GeraSenha`

## [1.2.6] - 13/04/2023
### Corrigir
- Corrigir o link para as imagens do Readme.

### Adicionado
- Funções da SENIOR para gestão de usuários no SGU.
  - `AssociaUsuColab`
  - `SegEntAdicGrp`
  - `SegEntCodigo`
  - `SegEntGrava`
  - `SegEntLePorNome`
  - `SegEntSetaNome`
  - `SegEntSetaDesc`
  - `SegUsuCria`
  - `SegUsuSetaGrpAcs`
  - `SegUsuSetaNomeComp`

## [1.2.5] - 30/03/2023
### Adicionado
- Funções da SENIOR para integração com o **LDAP** e/ou **AD**.
  - `ADAdicionaAtributoEntidade`
  - `ADAlteraEntidade`
  - `ADAlteraEntidadeDN`
  - `ADAlteraEntidadePorAtributos`
  - `ADAtribuiSenha`
  - `ADBuscaEntidade`
  - `ADBuscaEntidadeEx`
  - `ADCriaUsuario`
  - `ADDeletaEntidade`
  - `ADDeletaValorAtributo`
  - `ADFinalizaAlteracao`
  - `ADIniciaAlteracao`
  - `ADPegaValorAtributoEntidade`

## [1.2.4] - 18/01/2023
### Adicionado
- Funções da SENIOR para manipulação da Barra de progresso dos relatórios.
  - `OcultaBarraProgressoRelatorio`
  - `AtualizaBarraProgreso`
  - `IniciaBarraProgresso`
  - `FinalizaBarraProgresso`

## [1.2.3] - 17/10/2022
### Adicionado
- Informar que a existência de bloco `Inicio`/`Fim` ou `{chaves}` vazio.
- Novas funções do HCM para manipulação de JSON (`getJSONDecimal`,`getJSONDateTime`,`addKeyAndStringValueInJSON`, entre outras).

### Modificado
- Não gerar erro quando encontra um comentário de linha sem conteúdo (`@@`).

## [1.2.2] - 15/08/2022
### Adicionado
- Verificar sintaxe dos comentários de linha.
- Destacar (colorir) funções customizadas.

## [1.2.1] - 28/07/2022
### Modificado
- Corrigir classificação do `Inicio`/`Fim` para ter o mesmo tratamento dos `[colchetes]` ou `[parenteses]` ao realçar os "pares".

## [1.2.0] - 04/05/2021
### Adicionado
- Adicionado recursos (funções, métodos, constantes) do ERP da Senior
- Novo parâmetro que permite filtar os recursos por sistema. O valor padrão é "**HCM**"

## [1.1.1] - 03/12/2021
### Modificado
- Tradução das Propriedades no menu de configurações do VSCode.
- Melhoria e ampliação da verificação de sintaxe.
- Melhoria na detecção dos números negativos e com decimais.

## [1.1.0] - 17/11/2021
### Modificado
- Remover parâmetro que permitir Ativar/Desativar validação de Sintaxe.

### Adicionado
- Não permitir utilizar Palavras reservadas da linguagem como identificadores
- Checar a sintaxe da definição de `Numero` indexado. Exemplo: `Definir Numero nMeses[12];`
- Checar a sintaxe da definição de `Alfa` indexado. Exemplo: `Definir Alfa aMeses[12];`
- Checar a sintaxe da definição de `Data` indexado. Exemplo: `Definir Data dMeses[12];`
- Checar a sintaxe da definição de `Se`. Exemplo: `Se (nNumCad > 0);`
- Checar a sintaxe da definição de `Enquanto`. Exemplo: `Enquanto ((SQL_EOF(cPesquisa) = cFalso)`
- Checar a sintaxe da definição de `Para`. Exemplo: `Para (nIndex=1; nIndex<=10; nIndex++)`
- Controle bloco para:
  - `Inicio`/`Fim`
  - `{`/`}`
  - `(`/`)`

### Correções
- Limpar os "Problemas" quando um arquivo é fechado

### Problema Conhecido
- Quando um `Se` não tem um bloco `Inicio/Fim` é apresentado um alerta incorreto quando tem um `Senao` sem um `Se`

## [1.0.4] - 12/11/2021
### Correções
- Corrigir a validação de sintaxe para desconsiderar conteúdo "String"

## [1.0.3] - 12/11/2021
### Adicionado
- Validar Sintaxe das seguintes regras:
  - Definição de Variáveis
  - Definição de Função
  - Comando `Vapara`

## [1.0.2] - 23/04/2021
### Adicionado
- Validação de sintaxe da regra (em carater Experimental):
  - Novo parâmetro para Ativar/Desativar a verificação
  - Verificar a falta do ";" depois do "Fim" ou da definição de variáveis

### Alterações
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
### Alterações
- Melhoria na identificação dos parâmetros das funções customizadas
- Melhoria na documentação do comando *ExecSQLEx*

## [0.0.9] - 15/09/2020
### Adicionado
- Criado um *parser* para identificar as funções customizadas

### Alterações
- Melhorado o tratamento para parâmetros do tipo texto na SignatureHelp

## [0.0.8] - 14/09/2020
### Adicionado
- Foram adicionadas as constantes *cVerdadeiro* e *cFalso* no *AutoComplete*

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
