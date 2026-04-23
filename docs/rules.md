# Regras de Validação – LSP V2

Este documento descreve **todas as regras de validação implementadas** no compilador/analisador V2, em linguagem humana.

> O `spec.md` permanece como fonte conceitual principal.
> Este arquivo descreve o comportamento semântico e sintático esperado da V2 no estado atual.
> O catálogo normativo de códigos, severidades e mensagens vive em `docs/messages.md`.

Contrato TS-like/LSP-like (M8):
- Formatter oficial: apenas `Format Document` (sem `rangeFormatting`).
- Formatação `Senao` seguido de `Se`: sem recuo extra no `Se` (mesmo nível de indentação do `Senao`).
- Diagnostics oficiais: pull-only (`textDocument/diagnostic`).
- Semantic tokens oficiais: `full` + `delta`, sem `range`.
- Instrumentação de decisão/causa/correlação: `docs/observability-schema-v1.md`.
- Durante burst de edição, snapshot sticky não-vazio não pode mascarar snapshot estável mais novo com `0` diagnósticos para o mesmo URI/contexto.
- Embedded SQL formatting aceita atualmente os dialetos `sql`, `oracle` e `sqlserver`; a implementação deve manter fallback seguro para `sql` quando o provider subjacente não reconhecer uma opção futura.
- Formatter: em assignments multiline com cadeia aditiva (`+`/`-`), a forma canônica pode mover o operador para o início da linha seguinte, alinhado à coluna de continuação do `=`.
- Formatter: comentários de linha trailing em cada termo devem permanecer inline e com conteúdo preservado; no último termo, o comentário final deve ficar após `;`, separado por um único espaço.
- Formatter: quando o `;` vier isolado na linha seguinte após o último termo, ele deve ser recolocado no final do último termo antes do comentário trailing final.

---

## 1. Contexto e descoberta de arquivos

- Cada **contexto** valida arquivos de um diretório raiz, com:
  - `filePattern` (glob ou `re:<regex>`).
  - `includeSubdirectories` (include/exclude subpastas).
- Quando `includeSubdirectories=false`, somente arquivos **no diretório raiz** são considerados (usa o basename do pattern).
- O `filePattern` (glob ou regex `re:`) é avaliado sobre o **nome do arquivo** (`basename`), não sobre o path completo.
- A ordem de leitura é **alfabética pelo basename** (case-insensitive).
- Símbolos e diagnósticos **não vazam entre contextos**.

---

## 2. Lexer (Tokenizer)

- **Comentários de linha**: `@ ... @`
  - Deve haver **segundo `@`** na mesma linha.
  - Se não houver, gera **erro léxico**.
  - **Não há escape `\@`**.
- **Comentários de bloco**: `/* ... */`, devem fechar.
- **Strings**: delimitadas por `"`.
  - Suporta escape `\"`.
- **Case-insensitive** para keywords/tipos.
- Operadores reconhecidos:
  - Lógicos: `e`, `ou`
  - Comparação: `=`, `<>`, `>`, `<`, `>=`, `<=`
  - Aritméticos: `+`, `-`, `*`, `/`, `++`, `--`
- Delimitadores: `()[]{},.;:`

---

## 3. Parser / AST

- AST tipada com `range` e `sourcePath`.
- Blocos: `Inicio/Fim` e `{ }`.
- `Definir Funcao` multilinha até `;`.
- Error recovery sincroniza em: `;`, `}`, `Fim`, início de comandos.

---

## 4. Escopos

- Escopos: **global**, **função**, **bloco**.
- Funções customizadas **só podem** ser declaradas e implementadas no escopo global.
- Declaração fora do escopo global gera `LSP1105`.
- Implementação fora do escopo global gera `LSP1103`.

---

## 5. Variáveis e declaração implícita

- **Numero implícito**:
  - Literais numéricos com sinal negativo (ex.: `-1`) são tratados como `Numero` para inferência e atribuição.
  - A **primeira atribuição sem declaração** define a variável como `Numero` no **escopo atual** (função/bloco ou global). No escopo global, a definição vale para os demais arquivos do contexto (após a declaração).
  - Se já existir **qualquer definição anterior** (global ou local) com o mesmo nome, **não cria implícito**.
    - Se o tipo anterior for diferente, gera **Error**.
    - Se o tipo anterior for o mesmo, a variável implícita **não deve ser recriada**; o comportamento segue o símbolo já existente, sem usar `LSP1406` como sugestão genérica.
  - Se a variável for usada antes de declaração formal, ela será tratada como `Numero` (desde que não exista definição anterior).
  - Se posteriormente for declarada com **outro tipo**, isso é **erro** (`LSP1002`).
- Atribuição com tipo incompatível (`LSP1006`):
  - Regra geral: se uma variável declarada `Alfa/Data/Numero` receber um valor incompatível, emitir erro.
  - Exceções válidas no LSP (ignorar):
    - esperado `Data` e recebido `Numero`
    - esperado `Numero` e recebido `Data`
- Uso antes da declaração:
  - Gera **Warning** quando existe declaração posterior no mesmo escopo.
  - **Exceção**: para `Numero` implícito.
- Variáveis não utilizadas:
  - `LSP1203` é **Info**.
  - **Escopo global**: só calcular/emitir quando o **contexto estiver totalmente validado**.
  - **Escopo global**: considerar a variável “utilizada” se houver **leitura** ou **>= 2 atribuições** após a declaração.
  - **Escopo local** (função/bloco): manter a regra padrão de unused no fechamento do escopo.
- Tipos internos (constantes) são conhecidos e têm tipo fixo.
- **Leitura sem declaração**:
  - Expressões como `x = x - 1;` continuam tratando o `x` do lado direito como leitura; se ele ainda não existir nesse ponto, deve gerar `LSP1005`.
  - **Não** cria `Numero` implícito.
  - O tipo permanece **Desconhecido** até uma declaração explícita ou atribuição.
- **LSP1406**:
  - Emitir **apenas** para **sombreamento de ancestral com tipo diferente**.
  - A severidade é **Error**.
  - Não aplicar a parâmetros de função customizada.
  - Não checar escopos irmãos.
  - O `range` deve apontar para a **declaração** (`declRange`), e não para a última ocorrência.

---

## 6. Funções customizadas

- Sintaxe: `Definir Funcao` e `Funcao <nome>(...)`.
- Máximo **15 parâmetros**.
- Parâmetros são **obrigatórios** (sem opcionais).
- **Parâmetro `END`**:
  - Warning se nunca atribuído (`LSP1202`).
  - Se o `END` é passado como argumento em chamadas (atribuição indireta), gera **Info** sugerindo variável intermediária (`LSP1204`).
- Parâmetro não utilizado → **Warning** (`LSP1201`).

---

## 7. Funções internas

- Assinaturas por `system` (Senior obrigatório + HCM/ERP/Acesso).
- Validam **quantidade de parâmetros** e **tipos**.
- Compatibilidade de tipos (regra prática do LSP):
  - Se uma função interna espera `Data` e recebe `Numero`, **não emitir diagnóstico**.
  - Se uma função interna espera `Numero` e recebe `Data`, **não emitir diagnóstico**.

---

## 7.1 Família de diagnósticos — quantidade inválida de parâmetros

- `LSP1303`, `LSP1401`, `LSP1410` e `LSP1417` pertencem à mesma família conceitual: chamadas com **quantidade inválida de parâmetros**.
- Os códigos permanecem separados por **contexto semântico**:
  - `LSP1303`: método conhecido de `Cursor`;
  - `LSP1401`: chamada genérica de função (interna/custom);
  - `LSP1410`: `ConverteMascara`;
  - `LSP1417`: método conhecido de `Lista`.
- A redação recomendada para mensagens e documentação é sempre: **Quantidade de parâmetros inválida em <contexto>**.

---

## 8. Cursor

- `Cursor.SQL` é um **método/comando especial** de `Cursor`.
- A única sintaxe válida é: `<variavelCursor>.SQL "<comando_SQL>";`.
- Após `.SQL` deve haver **obrigatoriamente** um `StringLiteral`; o comando deve terminar com `;`.
- O conteúdo do `StringLiteral` deve conter **SELECT**, senão **Erro**.
- Qualquer forma diferente deve gerar erro (por exemplo: `cur.SQL = "...";`, `cur.SQL;`, `cur.SQL("...")`).
- Campos do primeiro `SELECT` são inferidos como **readonly**.
- Campos readonly do Cursor **não podem** receber atribuição.
- Métodos de Cursor conhecidos (`AbrirCursor`, `FecharCursor`, `Proximo`) devem validar **quantidade de parâmetros** (assinatura fixa).

---

## 9. Listas dinâmicas

- Métodos conhecidos e validados (documentação oficial).
- `DefinirCampos`, `AdicionarCampo`, `EfetivarCampos` etc.
- `AdicionarCampo` **cria campos** na lista com tipo explícito.
- Métodos de lista só podem ser chamados por **variável do tipo Lista**.
  - Há exceção quando existe **assinatura interna** com o mesmo nome e quantidade de parâmetros.

---

## 10. Regras especiais: ConverteMascara

Assinatura: `ConverteMascara(Tipo_Dado, Valor_Origem, Alfa_Destino, Mascara)`

- **Tipo_Dado = 1, 2, 4**:
  - `Valor_Origem` deve ser `Numero`.
  - Se for `Data`, gerar **Warning** (compatibilidade prática do LSP).
  - Nos demais casos incompatíveis, gerar **Error**.
- **Tipo_Dado = 3**:
  - `Valor_Origem` pode ser `Data` **ou** `Numero`.
- **Tipo_Dado = 5**:
  - `Valor_Origem` deve ser o **literal 0**.
  - Se for diferente, gerar **Error**.
- `Alfa_Destino` deve ser **Alfa**.
- `Mascara` deve ser **Alfa**.
- O analisador pode emitir códigos específicos de `ConverteMascara` para essas validações (`LSP1411`, `LSP1412`, `LSP1413`, `LSP1414`, `LSP1415`, `LSP1416`), conforme o parâmetro e o tipo incompatível.
- `Alfa_Destino` deve ser **atribuível** (`Identifier`, `MemberAccess` ou `IndexAccess` compatível).
  - Caso contrário, emitir `LSP1413`.
- `LSP1406` **não** deve ser usado como regra genérica de sugestão de escopo em `ConverteMascara`.
  - `LSP1406` fica restrito ao caso de **sombreamento de ancestral com tipo diferente**.

---

## 11. Diagnostics e Quick Fix

Os códigos, severidades e mensagens ficam em `docs/messages.md`.

Quick Fix implementados atualmente:

- `LSP0001`: parcial, apenas em casos específicos suportados pela extensão (ex.: inserção de `;`).
- `LSP1003`: declara variável `Alfa`.
- `LSP1005`: declara variável com o nome diagnosticado.
- `LSP1204`: cria variável local intermediária e atribui o `END` após a chamada.
- `LSP1404`: cria variável `Data`.

Observações:
- `LSP1406` **não** possui Quick Fix ativo no estado atual do código.
- O catálogo normativo de severidades e mensagens efetivas deve ser mantido em `docs/messages.md`.

---

## 11.1 Refactors nativos

- Refactors oficiais da extensão devem ser expostos por `CodeActionKind.Refactor`.
- Refactors incluídos no pacote atual:
  - envolver com bloco;
  - envolver com `Se (...)`;
  - envolver com `Enquanto (...)`;
  - envolver com `Para (...)`;
  - alternar bloco `Inicio/Fim` ↔ `{ }`.
- A criação de bloco deve respeitar `lsp.refactor.defaultBlockStyle`.
  - Valor default: `inicioFim`.
- Refactors de `Se`, `Enquanto` e `Para` devem sempre gerar bloco completo.
- Quando o estilo for `inicioFim`, o fechamento deve ser sempre `Fim;`.
- A seleção deve ser expandida pragmaticamente para linhas completas antes da transformação.
- A ação não deve ser oferecida dentro de string literal.
- Comentários podem estar contidos na seleção e devem ser preservados sem alteração de conteúdo.
- A alternância de bloco só deve aparecer quando o bloco selecionado ou sob o cursor for claramente reconhecível.

---

## 12. VaPara e rótulos

- `VaPara` deve usar alvo **identificador de rótulo**: `VaPara <rotulo>;`.
- Rótulos usam sintaxe `<rotulo>:` (dois-pontos), com `;` opcional após o `:` (`<rotulo>:;` também é válido).
- O rótulo referenciado por `VaPara` deve existir no **mesmo arquivo** e no **mesmo escopo lógico**:
  - `VaPara` em escopo global resolve apenas rótulos globais.
  - `VaPara` dentro de função resolve apenas rótulos da mesma função.
- Referência para rótulo ausente no arquivo gera **Erro** (`LSP1418`).

---

# Regras implementáveis — Variáveis do tipo `Tabela`

Esta seção descreve as regras operacionais e validáveis da V2 para `Tabela`.

> Esta seção deve refletir apenas regras efetivamente implementadas ou planejadas como objetivo imediato de implementação.

---

## Regra 1 — Declaração de `Tabela`

A V2 deve aceitar a sintaxe:

```lsp
Definir Tabela <nome>[<ocorrencias>] = {
  <colunas>
};
```

### Requisitos mínimos

- `Tabela` deve ser reconhecida como tipo válido de declaração;
- a declaração deve conter identificador da tabela;
- a declaração deve conter ocorrências entre colchetes;
- a declaração deve conter bloco de colunas entre `{` e `}`;
- a declaração deve terminar com `;`.

---

## Regra 2 — Ocorrências da tabela

O valor de ocorrências:

- deve ser literal numérico inteiro;
- deve ser maior que zero.

### Deve gerar diagnóstico quando

- faltar o bloco `[<ocorrencias>]`;
- o valor não for numérico;
- o valor for menor ou igual a zero;
- os colchetes estiverem malformados.

---

## Regra 3 — Colunas permitidas

Na implementação inicial, o schema da tabela deve permitir apenas colunas dos tipos:

- `Alfa`
- `Numero`
- `Data`

### Deve gerar diagnóstico quando

- a coluna usar tipo fora desse conjunto;
- a coluna não tiver identificador.

---

## Regra 4 — Colunas `Alfa`

Devem ser aceitas as formas:

```lsp
Alfa Campo;
Alfa Campo[30];
```

### Regras

- `Alfa Campo;` é válido;
- `Alfa Campo[n];` é válido quando `n` for inteiro positivo.

### Deve gerar diagnóstico quando

- `Alfa Campo[]`;
- `Alfa Campo[0]`;
- `Alfa Campo[-1]`;
- `Alfa Campo[abc]`.

---

## Regra 5 — Colunas `Numero` e `Data`

As formas válidas são:

```lsp
Numero Campo;
Data Campo;
```

### Deve gerar diagnóstico quando

- `Numero Campo[n]`;
- `Data Campo[n]`.

---

## Regra 6 — Tabela vazia

A declaração de `Tabela` deve possuir pelo menos uma coluna.

### Deve gerar diagnóstico quando

```lsp
Definir Tabela Vazia[10] = {
};
```

---

## Regra 7 — Colunas duplicadas

Não deve ser permitido repetir o mesmo nome de coluna dentro da mesma tabela.

### Deve gerar diagnóstico quando

duas ou mais colunas da mesma tabela tiverem o mesmo identificador.

---

## Regra 8 — Símbolo semântico da tabela

A variável `Tabela` deve carregar metadados suficientes para representar:

- o número de ocorrências;
- a lista de colunas;
- o tipo e o tamanho das colunas, quando aplicável.

### Objetivo

Permitir suporte futuro a:

- hover estruturado;
- completion de campos;
- validação de acesso tipado.

---

## Regra 9 — Hover

Quando a tabela estiver corretamente declarada, o hover deve exibir:

- tipo `Tabela`;
- ocorrências;
- schema resumido da tabela.

---

## Regra 10 — Snippet de declaração

Ao digitar `Definir Tabela`, a extensão deve oferecer snippet estrutural com:

- nome da tabela;
- ocorrências;
- pelo menos uma coluna inicial.

---

## Regra 11 — Acesso por índice e coluna em `Tabela`

O acesso a colunas de `Tabela` deve seguir obrigatoriamente o formato:

```lsp
<tabela>[<indice>].<coluna>
```

### Regras

- `Tabela.Coluna` (sem indexador) é inválido;
- `Tabela[idx].Coluna` com coluna inexistente é inválido;
- a atribuição em coluna deve respeitar o tipo declarado da coluna (`Alfa`/`Numero`/`Data`);
- em atribuição de coluna, continuam válidas as mesmas exceções práticas de compatibilidade entre `Numero` e `Data`.

### Deve gerar diagnóstico quando

- houver acesso sem indexador (`Tabela.Coluna`);
- o nome após `.` não existir no schema da tabela;
- houver atribuição incompatível com o tipo da coluna.

---

## Fora do escopo inicial

Não faz parte do escopo inicial desta implementação:

- permitir colunas `Lista`, `Cursor`, `Tabela` ou `Funcao`;
- aceitar expressões arbitrárias nas ocorrências;
- suportar leitura/escrita rica de campos da tabela em expressões complexas.

Esses pontos devem ficar para fase posterior, após estabilização da declaração, do schema e dos diagnósticos.

---

## Regras operacionais — Organização de pastas (extension/compiler)

- O agrupamento principal do código deve ser por domínio funcional.
- Nova subpasta só deve ser criada com massa crítica real e fronteira clara de responsabilidade.
- Arquivo específico e pequeno deve permanecer próximo do domínio que o utiliza.
- Evitar profundidade desnecessária e pastas genéricas sem domínio (`utils`, `helpers`, `types`, `services`).
- Arquivos de composição/entrada devem ficar em pontos previsíveis da árvore.


## Regra 10 — Parâmetros duplicados em função customizada

Não deve ser permitido repetir o mesmo nome de parâmetro dentro da mesma assinatura de função customizada.

- Emitir **Warning** (`LSP1424`).
- Considerar duplicado apenas dentro da **mesma assinatura**.
- Repetição do mesmo nome em **funções diferentes** é permitida.
- Para evitar duplicidade entre `Definir Funcao` e `Funcao`, quando existir implementação o diagnóstico deve ser emitido **apenas na implementação**; a declaração só recebe o diagnóstico se não houver implementação correspondente.


## Tabela — compatibilidade histórica e índice

A declaração de `Tabela` aceita tanto a forma canônica com `{ ... }` quanto a forma histórica com `Inicio/Fim`.

O acesso `Tabela[idx].Coluna` agora também valida:
- `LSP1510` quando `idx` não é `Numero`;
- `LSP1511` quando `idx` é literal fora do intervalo `1..N`.


## Embedded SQL highlight interno controlado

- O highlight leve original por faixa continua válido para o literal SQL elegível como um todo.
- Em candidatos semanticamente seguros, a implementação também pode emitir tokens internos adicionais para:
  - palavras-chave SQL reconhecidas;
  - funções SQL reconhecidas;
  - propriedades qualificadas (`Tabela.Campo`);
  - parâmetros bind (`:pValor`).
- Em variáveis consumidas por wrappers autorizados, fragmentos estruturais seguros também podem receber highlight SQL quando a cadeia continuar semanticamente reconhecível, incluindo continuações como `AND`, `OR`, `WHERE`, `FROM`, `GROUP BY`, `HAVING`, `ORDER BY`, `JOIN`, `UNION`, `INTO`, `VALUES` e `SET`.
- Casos dinâmicos/ambíguos continuam restritos ao highlight leve/global já existente.
