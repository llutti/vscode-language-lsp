
<br />
<p align="center">
  <a href="https://github.com/llutti/vscode-language-lsp">
    <img src="https://github.com/llutti/vscode-language-lsp/raw/main/images/icon.png" alt="Logo" width="80" height="80">
  </a>

  <h2 align="center">LSP para Visual Studio Code</h2>

  <p align="center">
    Esta extensão adiciona o suporte à <b>Linguagem Senior de Programação</b>, também conhecida como LSP, ao Visual Studio Code.
  </p>

  <p align="center" style="display:flex;gap:7px;justify-content:center;align-items:center;">
    <img alt="Visual Studio Marketplace Version" src="https://img.shields.io/visual-studio-marketplace/v/llutti.lsp">
    <img alt="Visual Studio Marketplace Downloads" src="https://img.shields.io/visual-studio-marketplace/d/llutti.lsp">
    <img alt="Visual Studio Marketplace Installs" src="https://img.shields.io/visual-studio-marketplace/i/llutti.lsp">
    <img alt="Visual Studio Marketplace Rating" src="https://img.shields.io/visual-studio-marketplace/r/llutti.lsp">
    <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/llutti/vscode-language-lsp">
  </p>
</p>

Aqui estão alguns dos recursos que o **LSP** oferece:

* Colorização
* Autocomplete
* Apresentação de parâmetros das funções (nativas e customizadas)
* "*Ir para Definição*" das funções customizadas
* Snippets (trechos de códigos previamente configurados)
* Validação de Sintaxe (*em desenvolvimento*)

<br>
<br>

# **Recursos**

## Colorização

Suporta colorização da maioria das funções internas, variáveis de sistema e palavras-chave para o LSP para o [Vetorh](https://www.senior.com.br/)

 ![colorizacao](https://github.com/llutti/vscode-language-lsp/raw/main/screenshots/colorizacao.png)


## Autocomplete

Durante a digitação da regra, é apresentado uma lista de sugestões de funções ou variáveis de possíveis alternativas ao texto digitado.
 ![autocomplete](https://github.com/llutti/vscode-language-lsp/raw/main/screenshots/autocomplete.png)


## Apresentação de parâmetros das funções

Ao passar o mouse sobre um função é apresentado um popup com a lista de parâmetros e a documentação disponíveis.

**Funções nativas**

![parametros-funcao-nativa](https://github.com/llutti/vscode-language-lsp/raw/main/screenshots/parametros-funcao-nativa.png)

**Funções customizadas**

![parametros-funcao-customizada](https://github.com/llutti/vscode-language-lsp/raw/main/screenshots/parametros-funcao-customizada.png)

Durante a digitação são mostrados todos os parâmetros necessários e destacado o que está sendo preenchido no momento.

![parametros-funcao-digitacao](https://github.com/llutti/vscode-language-lsp/raw/main/screenshots/parametros-funcao-digitacao.png)

Posicionando o cursor em um parâmetro e prescionando `CTRL+SHIFT+Space` são apresentadas informações detalhadas sobre o parâmetro correspondente.

![parametros-funcao-detalhes](https://github.com/llutti/vscode-language-lsp/raw/main/screenshots/parametros-funcao-detalhes.png)


## "***Ir para Definição***" das funções customizadas

Ao clicar sobre o nome de uma *função customizada* com o CTRL prescionado ou prescionar F12 quando posicionado sobre uma *função customizada* o editor irá para o arquivo e a posição onde a função foi definida.


## Snippets

Diversos trechos de códigos comuns para o dia-a-dia

 ![snippets](https://github.com/llutti/vscode-language-lsp/raw/main/screenshots/snippets.png)

## Validação de Sintaxe

Realiza a verificação semântica do código durante a digitação e sempre que o arquivo é aberto. Para isso será realizada uma *compilação* simplificada e apenas algumas regras básicas foram implementadas. Quando encontrar uma inconsistência, será apresentado como *ERRO* ou *AVISO*.

 ![validacao-sintaxe](https://github.com/llutti/vscode-language-lsp/raw/main/screenshots/validacao-sintaxe.png)


## Licença

Este projeto é licenciado sobre a licença MIT - veja [`LICENSE.md`](https://github.com/llutti/vscode-language-lsp/raw/main/LICENSE.md) para mais informações.

## Autor

Luciano Cargnelutti - [https://llutti.dev](https://llutti.dev/)

Repositório do Projeto: [https://github.com/llutti/vscode-language-lsp](https://github.com/llutti/vscode-language-lsp)