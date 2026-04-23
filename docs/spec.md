# LSP Compiler v2 – Especificação Oficial

Este documento representa a **fonte de verdade** para o redesign do compilador da linguagem **LSP (Senior)** e da nova versão da extensão VSCode.

## Baseline oficial de UX/LSP da V2:
- A referência de comportamento para recursos de edição, formatação, capacidades LSP e experiência geral do editor é o padrão **TS-like** (**TypeScript-like adaptado ao LSP**).
- Quando houver ambiguidade entre comportamento legado da V1 e UX moderna do editor, priorizar o contrato TS-like, desde que não viole regras semânticas da linguagem LSP.

Documentos complementares:
- `docs/rules.md` – regras de validação em linguagem humana
- `docs/messages.md` – catálogo de mensagens por severidade
- `docs/milestones.md` – trilhas operacionais vigentes e status de execução
- `docs/milestone-implementation-quality-reassessment.md` – protocolo recorrente de auditoria técnica da implementação e comparação futura de aderência a boas práticas, arquitetura e robustez

---

## 1. Objetivos do Projeto

- Recriar o compilador da linguagem LSP com uma arquitetura **mais robusta, extensível e correta semanticamente**.
- Permitir evolução segura da linguagem e da extensão (novos recursos, validações e documentação).
- Melhorar significativamente a **experiência do desenvolvedor no VSCode**.

---

## 2. Escopo Geral do Compilador

### 2.1 Linguagem

- Linguagem LSP (Senior)
- Código distribuído em **múltiplos arquivos texto**
- Arquivos devem ser lidos **em ordem alfabética**
- Regras detalhadas em `docs/rules.md`

---


## 2.3 Literais numéricos com sinal

- Um literal como `-1` deve ser tratado semanticamente como `Numero`.
- Isso vale para atribuição, inferência de tipo e validações que exigem literal numérico.
- A distinção importante é entre **literal numérico com sinal** e **expressão aritmética**.
  - `pGLNivel = -1;` → literal numérico válido.
  - `x = x - 1;` → expressão aritmética; o identificador `x` do lado direito continua sendo leitura normal e segue as regras usuais de declaração/uso.

## 3. Systems (Systems)

- Existe sempre o system **Senior** (obrigatório)
- Pode existir **apenas um system adicional ativo** por contexto
- Systems válidos são definidos pelo enum `LSPSeniorSystems`
- Funções internas podem existir com:
  - Mesmo nome
  - Assinaturas diferentes
  - Dependendo do system

---

## 4. Escopo por Diretório (Validation Context)

### 4.1 Conceito

- O compilador funciona por **contextos independentes**
- Cada contexto é definido por:
  - Diretório raiz
  - Regex de arquivos válidos
  - System ativo
  - Flag de inclusão de subdiretórios

### 4.2 Regras

- Um workspace do VSCode pode conter **múltiplos diretórios ativos**
- Cada arquivo pertence a **um único contexto**
- Validações, símbolos e diagnósticos **não vazam entre contextos**
- Cada contexto deve declarar explicitamente:
  - Se subdiretórios devem ou não ser incluídos
- Regras detalhadas em `docs/rules.md`

## 4.3 Vincular arquivos .txt no VSCode (opcional)

O padrão oficial da linguagem é **`.lspt`** — arquivos com essa extensão já são reconhecidos automaticamente.
Se você precisar trabalhar com `.txt`, faça a associação no workspace:
1. Abra o Command Palette (`Ctrl+Shift+P`).
2. Execute “Change Language Mode”.
3. Selecione “LSP”.

Opcionalmente, crie um `.vscode/settings.json` no workspace com:
```json
{
  "files.associations": {
    "*.txt": "lsp"
  }
}
```

Se quiser limitar a associação somente aos arquivos do projeto (evitando afetar outros `.txt`), use padrões mais específicos:
```json
{
  "files.associations": {
    "**/exemplos/HR/HR*.txt": "lsp",
    "**/exemplos/QL/antigos/Regra QL*.txt": "lsp",
    "**/exemplos/RS/RS*.txt": "lsp",
    "**/exemplos/SM/SM*.txt": "lsp",
    "**/exemplos/TR/TR*.txt": "lsp",
    "**/exemplos/SIA/**/*.txt": "lsp"
  }
}
```

> VSCode usa glob e não regex em `files.associations`. Para padrões numéricos (SIA), a forma recomendada é restringir pela pasta.
> Exemplo pronto: `.vscode/settings.example.json`.

---

## 5. Tipos da Linguagem

```ts
export enum EParameterType {
  Alfa = 'Alfa',
  Numero = 'Numero',
  Data = 'Data',
  Funcao = 'Funcao',
  Lista = 'Lista',
  Cursor = 'Cursor',
  Tabela = 'Tabela'
}
```

### 5.1 Particularidades

#### Cursor

- Variáveis do tipo `Cursor` possuem **métodos próprios definidos pela linguagem** (conforme documentação oficial Senior)
- Esses métodos estão disponíveis automaticamente para qualquer variável do tipo `Cursor`
- Os métodos possuem assinaturas fixas e devem ser **validados semanticamente** (quantidade e tipo de parâmetros)
- O membro `.SQL` de `Cursor` é um **método/comando especial**, não uma propriedade genérica
- A única sintaxe válida é: `<variavelCursor>.SQL "<comando_SQL>";`
- Após `.SQL` deve existir **obrigatoriamente** um `StringLiteral`
- O comando deve terminar com `;`
- O conteúdo do `StringLiteral` deve conter obrigatoriamente um comando `SELECT`
- Qualquer forma diferente deve gerar erro (por exemplo: `cur.SQL = "...";`, `cur.SQL;`, `cur.SQL("...")`)
- Campos retornados pelo `SELECT` são acessíveis como propriedades **readonly**

#### Lista

- Variáveis do tipo `Lista` possuem **métodos próprios definidos pela linguagem** (ex: métodos já existentes na V1)
- Esses métodos devem ser conhecidos pelo compilador para:
  - Validação semântica
  - Autocomplete
  - Hover documentation
  - Completar como **snippet** quando aplicável (via `insertText` + `insertTextFormat=Snippet`)
  - Exibir `documentation`/`detail` (quando disponíveis) em hover e completion
- Além dos métodos, as propriedades padrão da lista (ex.: `IDA`, `FDA`, `NumReg`, `QtdRegistros`) devem aparecer no autocomplete
- A lista possui uma particularidade que permite **mutação de seu shape semântico**
- O método `.AdicionarCampo(nome, tipo)`:
  - Cria dinamicamente um novo campo/propriedade
  - O campo criado possui tipo explícito (`Data`, `Numero` ou `Alfa`)
  - Após a criação, o campo passa a ser válido para acesso tipado
- O compilador deve interceptar semanticamente esse método e atualizar o símbolo da lista

---

## 6. Funções

### 6.1 Funções Customizadas

- Declaradas via `Definir Funcao`
- Implementadas via `Funcao <nome>(); {}` ou `Inicio/Fim`
- **Somente em escopo global**
- Não podem ser declaradas ou implementadas dentro de blocos

#### Parâmetros

- Sintaxe: `Tipo [END] identificador`
- `END`:
  - Opcional
  - Deve ser tratado desde a v2 (semântica futura)
- Máximo de **15 parâmetros** por função
- **Todos os parâmetros definidos são obrigatórios**
  - Não existem parâmetros opcionais
  - A regra vale para funções customizadas e internas

### 6.2 Regras de Parâmetros

- Regras detalhadas em `docs/rules.md`

---

## 7. Funções Internas

- Definidas via templates internos (V1)
- Organizadas por `system`
- `templatesInternosSENIOR` é **obrigatório**
- Funções internas devem possuir:
  - Assinatura conhecida
  - Documentação associada (concluída)
- As chamadas devem validar:
  - Quantidade de parâmetros
  - Tipos esperados

---

## 8. Variáveis

### 8.1 Escopos

- Global
- Função (escopo próprio)
- Blocos (`Se`, `Enquanto`, `Para`, etc.)

### 8.2 Regras de Diagnóstico

As regras detalhadas estão em `docs/rules.md`.

---

## 9. Estruturas de Controle

- `Se / Senao`
- `Enquanto`
- `Para`

### Regras

- Sintaxe semelhante a `if / else / while / for` do JavaScript
- Aceita:
  - Comando único sem bloco
  - Bloco múltiplo com delimitadores

### Delimitadores de Bloco

- `Inicio / Fim`
- `{ / }`

> Uso de `;` é obrigatório para finalizar comandos, com exceções previstas na linguagem

---

## 10. Operadores e Palavras Reservadas

### 10.1 Operadores Lógicos

- `=` igual
- `>` maior que
- `<` menor que
- `<>` diferente
- `>=` maior ou igual
- `<=` menor ou igual
- `e` AND lógico
- `ou` OR lógico

### 10.2 Operadores Aritméticos

- `+` adição
- `-` subtração
- `*` multiplicação
- `/` divisão
- `++` incremento
- `--` decremento

### 10.3 Comentários

Regras detalhadas em `docs/rules.md`.

### 10.4 Palavras Reservadas

- Conforme definido na documentação oficial da Senior (comandos básicos e internos da linguagem LSP)

---

## 11. Variáveis e Constantes Internas

- Variáveis predefinidas pela linguagem:
  - `cVerdadeiro`
  - `cFalso`
  - Outras existentes na V1

---

## 12. Importação e Migração da V1

A V2 deve prever um processo explícito de migração da V1, incluindo:

- Importação de **funções internas** com documentação (**concluída**)
- Importação de **variáveis internas** (**concluída**)
- Leitura e adaptação das definições do arquivo `lsp-configuration.json` (**concluída**)
- Migração e compatibilidade de **snippets** (**concluída**)
- **Fonte canônica de snippets**: `packages/extension/snippets.json`; o servidor LSP deve consumir catálogo derivado e não manter lista hardcoded paralela em `server.ts`

Esse processo deve ser tratado como uma atividade dedicada da V2.

---


## 14. Formatação de Código (Formatter)

- Recurso obrigatório da V2.
- Implementação **Nível B**: **AST → Printer → Doc IR → Renderer**.
- Integração LSP:
  - Habilitar apenas `textDocument/formatting` (**formatDocument**).
  - **Não** registrar capability/handler de `textDocument/rangeFormatting` (sem “Format Selection”).
  - Retornar **um único `TextEdit`** substituindo o documento inteiro.
- Em arquivo com erro sintático não recuperável, o formatter deve operar em **no-op**:
  - não alterar o texto;
  - retornar **sem edits** pela integração LSP.
- Regras de segurança:
  - O formatter **só pode alterar whitespace** (espaços/indent/quebras de linha).
  - **Nunca** alterar o conteúdo de tokens sensíveis: **string literals** e **comentários** (inclui SQL/HTML embutido em string).
- EOL:
  - Preservar o EOL original do documento (**CRLF** vs **LF**).
- Layout / estilo:
  - **Sem wrap/printWidth** (não quebrar linhas por largura).
  - Estilo **canônico “TypeScript-like” adaptado ao LSP**: o formatter não tenta preservar alinhamentos manuais/colunas do arquivo original.
  - Preservar espaçamento vertical existente quando já estiver consistente com o estilo canônico (incluindo múltiplas linhas em branco intencionais).
  - Evitar inserir novas linhas em branco desnecessárias durante a normalização.
  - Estruturas (`Se/Senao/Para/Enquanto`) seguem indentação consistente, com **continuation indent** em headers multilinha.
- Regra específica (expressões aditivas multiline em assignment) — **normalização de `+`/`-` com comentários trailing**:
  - Em assignments multiline cujo RHS forme cadeia aditiva (`+`/`-`), o formatter pode mover o operador do fim da linha anterior para o início da linha seguinte para imprimir a forma canônica.
  - Forma canônica:
    - a primeira linha mantém o primeiro operando do RHS;
    - cada linha de continuação começa com `+` ou `-`, alinhado na coluna de continuação do `=`;
    - comentários de linha trailing associados aos termos devem permanecer inline, sem alteração do conteúdo do comentário;
    - quando o `;` estiver isolado na linha seguinte, ele deve ser recolocado no último termo antes do comentário trailing final;
    - o comentário trailing final do statement deve ser impresso após `;` com um único espaço separador.
  - Esta normalização vale para soma e subtração e não substitui a trilha específica já existente para concatenação/string e SQL embutido.
- Regra específica (`Se/Senao`) — **normalização do elseBranch**:
  - Se o `elseBranch` for um bloco `Inicio/Fim`, imprimir sempre no formato canônico:
    - `Senao` em linha própria
    - `Inicio` em linha própria
    - corpo indentado
    - `Fim;` em linha própria
  - **Não permitir** modo “inline” (`Senao Inicio ...`) quando:
    - o `elseBranch` for bloco `Inicio/Fim`, **ou**
    - houver **mais de 1 statement**, **ou**
    - o ramo contiver **strings multiline** (continuação com `\`), comum em SQL.
  - Observação: existe fixture de regressão `senao-inicio-inline.lspt` cobrindo este caso (idempotência e layout).
  - Exceção permitida: **comentário de linha** (preservar como átomo e permitir inline quando já estiver inline).
  - Regra canônica de `else-if`:
    - quando `Senao` for seguido por `Se` na linha seguinte, o `Se` deve ficar no **mesmo nível de indentação** do `Senao`;
    - não aplicar recuo adicional no `Se` apenas por estar no `elseBranch`;
    - o corpo desse `Se` continua seguindo as regras normais de indentação (bloco ou single-statement);
    - esta normalização faz parte do contrato oficial do formatter, não é heurística opcional.

---

## 15. Syntax Highlighting Avançado

- Diferenciar visualmente:
  - Funções customizadas
  - Funções internas
  - Variáveis customizadas
  - Variáveis internas
  - Parâmetros `END`
- Variáveis customizadas não devem mudar de classificação visual por escopo (global/local); o token base deve permanecer `variable`, mantendo apenas `declaration` quando aplicável.
- Regras para evitar “piscar”/sobrescrita de cor (TextMate vs Semantic Tokens):
  - Quando emitir ocorrência semântica de `parameter` (declaration), o **range deve cobrir apenas o identificador do parâmetro** (ex.: `pX`), e **nunca** incluir o tipo `Numero`.
    - Motivo: se o range incluir `Numero`, o tema pode colorir todo o trecho como `parameter`, apagando o destaque de keyword/tipo.
  - As palavras reservadas `numero` e `end` devem ser destacadas também quando usadas na lista de parâmetros.    - **Funções (internas e customizadas)** devem usar o mesmo tokenType `function` (não distinguir para fins de Syntax Highlighting).

### 15.1 Variáveis internas

- Variáveis internas (ex.: `WEB_HTML`) devem ser destacadas como `variable` com modifiers:
  - `defaultLibrary`
  - `internal`
- Variáveis internas constantes (ex.: `cFalso`, `cVerdadeiro`) devem incluir também o modifier:
  - `readonly`
- A extensão deve mapear `variable.defaultLibrary.internal` para um scope com boa diferenciação visual na maioria dos temas.
---

## 11. Catálogo de Diagnostics (V2)

O catálogo completo de códigos, mensagens e severidades está em:
- `docs/messages.md`

> O checklist operacional vive em `docs/milestones.md`.
> Para o histórico da fase de Pull Diagnostics: `docs/archive/milestones/milestone-perf-highlight-pull.md`.

### Observações de severidade
- O compilador pode rebaixar alguns diagnósticos para **Warning** durante fases de migração, evitando ruído nos exemplos.
- Erros sintáticos atualmente cobrem:
  - Blocos `Inicio`/`Fim` não fechados
  - `{`/`}` não fechados
  - Parênteses `(` não fechados
  - Colchetes `[` não fechados

---

Os milestones vivem em `docs/milestones.md`.

---

## 16. Testes e Cobertura de Regras

### 16.1 Estrategia recomendada

Usar **fixtures minimas** e **testes automatizados** em conjunto:

- **Fixtures**: arquivos pequenos e focados em `packages/compiler/test/fixtures/` com exemplos minimos para cada regra.
- **Testes**: casos em `packages/compiler/test/` que carregam as fixtures e validam diagnosticos, semantica e parser.

Vantagens:
- Fixtures evitam duplicacao de strings longas nos testes.
- Testes ficam mais legiveis e reutilizaveis.
- Facilita expandir cobertura quando novas regras surgirem.

### 16.2 Regras de manutencao

- **Toda nova regra implementada** deve vir acompanhada de **teste de cobertura**.
- O teste deve falhar antes da implementacao e passar depois.
- Sempre que possivel, **adicionar fixture** dedicada para a regra.
- Atualizar `docs/rules-coverage.md` com o mapeamento regra â†’ teste.

## 17. Refactors nativos da extensão

- A extensão deve expor refactors estruturais via `CodeActionKind.Refactor`.
- Escopo inicial oficial:
  - `Envolver com bloco`
  - `Envolver com Se (...)`
  - `Envolver com Enquanto (...)`
  - `Envolver com Para (...)`
  - `Alternar bloco: Inicio/Fim ↔ { }`
  - `Converter texto multilinha em concatenação`
- Os refactors que criam bloco devem respeitar `lsp.refactor.defaultBlockStyle`:
  - `inicioFim` (default)
  - `braces`
- `Se`, `Enquanto` e `Para` devem sempre gerar bloco completo; não faz parte do contrato gerar forma inline.
- Os refactors devem operar apenas em contexto estrutural previsível:
  - seleção não vazia expandida para linhas completas, ou
  - bloco claramente reconhecido sob o cursor no caso de alternância.
- Não oferecer refactor dentro de string literal.
- Exceção formal: o refactor `Converter texto multilinha em concatenação` pode ser oferecido com o cursor dentro de string literal elegível ou em cadeia de concatenação mista da mesma linha/statement, desde que a ação atue apenas sobre os literais elegíveis da expressão sem alterar partes dinâmicas.
- Comentários podem fazer parte da seleção do refactor e devem ser preservados como conteúdo atômico dentro da transformação.
- Quando o estilo gerado for `Inicio/Fim`, o fechamento deve ser sempre `Fim;`.
- O resultado deve sair textual e estruturalmente compatível com o formatter canônico, sem depender dele para correções básicas de moldura.
- Para o refactor de conversão de texto multilinha:
  - reconhecer string literal com continuações explícitas por `\` + quebra de linha;
  - substituir apenas o literal por uma cadeia concatenada com `+`, preservando o restante do statement hospedeiro;
  - manter o conteúdo textual de cada segmento, normalizando apenas a indentação comum das linhas continuadas para gerar forma editável previsível.

## Changelog

### Decisões recentes

- **`activationEvents`**: permanecer **vazio** por enquanto devido a erro na geração do `.vsix`. Registrar apenas anotação de verificação futura (sem “fix” nesta fase).
- **System `SENIOR`**: **não** pode ser selecionado em nenhum `Validation Context`. Ele é **sempre carregado** obrigatoriamente em conjunto com o system adicional do contexto.
- **Associação de arquivos**: o padrão oficial passa a ser **`.lspt`**. O usuário pode associar `.txt` via `files.associations` no workspace quando desejar.
- **Ordenação com subdiretórios**: trata-se de uma **regra da linguagem LSP**. Quando `includeSubdirectories = true`, a ordem de compilação deve ser determinística por **nome do arquivo (`basename`)**, com comparação case-insensitive, **ignorando subdiretórios no critério de ordenação**.
- **Cursor methods**: validação semântica e autocomplete devem ser alinhados por uma fonte única de verdade (tabela central de métodos/arity).
- **Encoding**: todo o projeto deve ser **UTF-8** (mensagens e leitura de fonte). Mensagens com encoding inválido (ex.: `parÃ¢metros`) são proibidas e devem ser corrigidas.
- **Diagnósticos**: publicar somente após a compilação do contexto ser finalizada.
- **Diagnósticos (modo)**: operar em **pull-only** (`textDocument/diagnostic`) e remover configurações de modo (`lsp.diagnostics.mode`).
- **System em contexto**: não permitir troca do system para arquivos que pertencem a um contexto (apenas modo `SingleFile`).
- **Formatter**: baseline **TypeScript-like** (canônico), **sem wrap/printWidth**, sem `formatRange`, EOL preservado; não tenta preservar alinhamentos manuais/colunas do original (exceção: comentário de linha).
  - O baseline preserva espaçamento vertical existente quando já está compatível com o estilo canônico (não força colapso global de linhas em branco).
- **Syntax Highlight**: não distinguir funções internas vs customizadas; ambas devem ser destacadas como `function`.
- **Variáveis internas**: emitir semantic token `variable` com modifiers `defaultLibrary` + `internal` (e `readonly` quando constante). Na extensão, mapear `variable.defaultLibrary.internal` para scopes que evitem colisão de cor em temas comuns.
- **Compatibilidade `Se/Senao`**: manter aceito o padrão `Fim; Senao` (com `;` antes de `Senao`) por compatibilidade com bases legadas.
- **`VaPara` e rótulos**: `VaPara <rotulo>;` deve referenciar rótulo definido como `<rotulo>:` (ou `<rotulo>:;`) no **mesmo arquivo** e no **mesmo escopo** (`global` ou função atual); não pode resolver rótulos de outros arquivos do contexto.
- **Métodos de `Lista`**: migrar da V1 `documentation` + `insertText`/`insertTextFormat` e passar a usar na V2 (hover + autocomplete como snippet quando aplicável).
- **Refactors nativos**: a extensão passa a oferecer refactors textuais estruturais via `CodeActionKind.Refactor`, com estilo de bloco controlado por `lsp.refactor.defaultBlockStyle`.


## Validation Context

- `system` no contexto representa **apenas o system adicional** (ex.: `HCM`, `ACESSO`, `ERP`).
  - O system `SENIOR` é **sempre carregado** e **não** deve ser permitido como valor configurável no contexto.
- **Classificação por pattern**:
  - `filePattern` (glob ou `re:`) é aplicado sobre o **nome do arquivo** (`basename`), não sobre o caminho completo.
- **Ordenação de arquivos**:
  - Sem subdiretórios (`includeSubdirectories = false`): ordenar alfabeticamente por nome do arquivo (`basename`), case-insensitive.
  - Com subdiretórios (`includeSubdirectories = true`): ordenar alfabeticamente por nome do arquivo (`basename`), case-insensitive, ignorando o caminho de subpastas no critério de ordenação.
  - Em caso de colisão de `basename` (mesmo nome em subpastas), usar o caminho completo como desempate para manter determinismo.

- **Versionamento (incremental/TS-like)**:
  - O reuso incremental deve usar *versionKey* semântico por **conteúdo**.
  - Arquivo do disco (fechado): `disk:<len>:<hash>`; `mtime/size` são apenas *hint* para evitar reler/re-hash.
  - Arquivo aberto (override): `override:<len>:<hash>`; é normal divergir do disco enquanto não salvar.

## Associação de Arquivos

- Padrão de extensão suportada: **`.lspt`**.
- Para trabalhar com arquivos `.txt`, configurar no workspace:

```json
{
  "files.associations": {
    "*.txt": "lsp"
  }
}
```

> Evitar associar `.txt` globalmente por padrão, para não impactar arquivos de texto genéricos no VS Code.

## Encoding

- **Obrigatório UTF-8**:
  - Arquivos de código LSP (workspace) devem ser lidos como UTF-8 (`readFile(..., "utf8")`).
  - Arquivos de mensagens/diagnósticos do projeto devem estar salvos em UTF-8.
- É proibido introduzir strings com encoding quebrado (ex.: `parÃ¢metros`). Se detectado, corrigir imediatamente e adicionar teste para prevenir regressão.

## Cursor

- **Tabela única de métodos**: métodos sugeridos pelo autocomplete do server e métodos validados na semântica devem vir de uma fonte única (ex.: `cursorMethods.ts`) contendo aridade/assinaturas.


## Empacotamento

- **Decisão final**: manter `activationEvents` vazio.
- Motivo: redundância com auto-activation do VS Code a partir das contribuições em `package.json` (ex.: linguagem `lsp`), sem ganho funcional em declarar `onLanguage:lsp` manualmente.

### Pacotes do monorepo

- O compilador é publicado/consumido no workspace como `@lsp/compiler`.
- A extensão (`packages/extension`) deve referenciar o compilador em **dependencies** (e não em devDependencies) para garantir resolução durante o build/bundle.

---

# Adendo – Últimas definições (2026-02)

## Debug

- Configuração simplificada (somente):
  - `lsp.debug.enabled`
  - `lsp.debug.path` (aceita caminho relativo ao workspace)

- Cache persistido de texto (cold start): por padrão é gravado em `globalStorageUri/cache/` (VSCode), evitando poluir o workspace/contexto.
- Quando habilitado, o servidor grava automaticamente arquivos `.jsonl` de métricas e observabilidade no diretório configurado.
- Não existe comando manual de export.

### Metadados no início dos arquivos `.jsonl`

- Ao iniciar a gravação de um arquivo de **métricas** (`lsp-metrics*.jsonl`) ou **observabilidade** (`lsp-observability*.jsonl`), a **primeira linha** do arquivo deve ser um registro `.meta` contendo:
  - `extensionVersion`
  - `extensionBuildDate`
  - `vscodeVersion`
  - `timestamp`
  - `kind` (ex.: `".meta"`)
- Se houver rotação/criação de um novo arquivo, o registro `.meta` deve ser escrito novamente no início do novo arquivo.

### Baseline de comparação de performance/observabilidade (2026-03-11)

Para futuras avaliações de performance, usar como referência inicial o comparativo registrado em:
- `docs/archive/notes/observability-comparison-2026-03-11.md`

Sessões de referência:
- `2026-03-11T02:23:31.495Z`
- `2026-03-11T02:25:40.092Z`

Valores observados no comparativo (pull diagnostics):
- `unchanged ratio`: `0.7602 -> 0.9452`
- `cacheHitTrue`: `0.8211 -> 0.9852`
- `ensureScheduledTrue`: `0.9024 -> 0.5689` (ainda acima do limite do gate)
- `contextMatchedFalse`: `0.0488 -> 0`
- `pull latency p95/p99/max`: `4/9/18ms -> 6/9/16ms`

Valores observados no comparativo (semantic tokens):
- `durationMs p95`: `556ms -> 1377ms`
- `durationMs p99`: `1088ms -> 2803ms`
- `durationMs max`: `1129ms -> 5168ms`

Regra operacional:
- Toda nova coleta relevante deve ser comparada contra este baseline e anexada em novo relatório versionado em `docs/`.

## Documentação oficial

- Os JSONs de assinaturas/variáveis internas podem conter:
  - `docUrl`
  - `docVersion`
- Quando `docUrl` existir, o hover deve exibir, ao final, **com uma linha em branco antes**, um link:
  - Rótulo base: `Documentação oficial`
  - Quando `docVersion` existir, incluir no próprio rótulo do link no formato: `Documentação oficial (<versão>)`.

## Sintaxe e semântica

- `ConverteMascara(Tipo_Dado, Valor_Origem, Alfa_Destino, Mascara)`:
  - Para `Tipo_Dado = 3`, `Valor_Origem` pode ser `Data` **ou** `Numero` (demais regras permanecem inalteradas).

- `ExecSql` é comando/statement com sintaxe própria: `ExecSql <StringLiteral>;` (ponto-e-vírgula obrigatório).
- `ExecSqlEx` é outro comando (função interna), sem conflitar com `ExecSql`.
- `WEB_HTML` é variável interna do tipo **Alfa** e não pode gerar falso LSP1005 quando for alvo de atribuição.

## Diagnósticos

- **VSCode Diagnostic.source**: usar `lsp` (não `lsp-v2`).
- **LSP1203 (variável não utilizada)**:
  - **Escopo global**: só calcular/emitr quando o **contexto estiver totalmente validado** (evitar falso positivo HR850→HR899).
  - **Escopo global**: considerar a variável “utilizada” se houver **leitura** *ou* se houver **>= 2 atribuições (writes)** após a declaração.
  - **Escopo local** (função/bloco): manter a regra padrão (unused no fechamento do escopo).
- LSP1406: emitir **apenas** para “sombreamento de ancestral com tipo diferente” (erro).
  - não aplicar a parâmetros de função customizada
  - não checar escopos irmãos
  - apontar range na declaração (`declRange`), não na última ocorrência

- LSP1006 (atribuição com tipo incompatível):
  - Regra geral: emitir quando o tipo esperado e o tipo recebido forem incompatíveis.
  - Exceções válidas no LSP (ignorar o diagnóstico):
    - **Esperado `Data` e recebido `Numero`**
    - **Esperado `Numero` e recebido `Data`**

- Limpeza de diagnósticos por contexto:
  - Quando **não houver nenhum arquivo aberto** pertencente a um contexto, os diagnósticos daquele contexto devem ser **limpos**.

### Diagnósticos (estado atual)

A extensão opera em **pull-only** (LSP `textDocument/diagnostic`), com refresh debounced (`workspace/diagnostic/refresh`) para manter a UX durante edição.

Regras vigentes:

- Não expor configuração de modo (`lsp.diagnostics.mode` removida).
- Sempre anunciar `diagnosticProvider` no initialize.
- Não usar `publishDiagnostics` para publicação regular de diagnósticos.
- Manter limpeza de diagnósticos quando o último arquivo do contexto for fechado.
- No cache comprometido do contexto, o pull deve priorizar o agrupamento por arquivo (`diagnosticsByFile`) antes de reprojetar `compilerDiagnostics`.
- O defer inicial de `didOpen` só pode responder com snapshot reaproveitado quando já existir estado útil **não-vazio** para o URI; sem snapshot confiável, o handler deve seguir para o caminho budgetado/prefixado em vez de devolver `0` transitório.
- Quando existir snapshot estável autoritativo para o mesmo `dirtyStamp` e a mesma versão do documento, o pull deve preferir esse snapshot direto antes de reprojetar/recomputar diagnósticos.

Critérios mínimos para marcar Pull-only como concluído:

1. Diagnósticos corretos em multi-contexto, sem vazamento e com limpeza quando não houver arquivo aberto (regra acima permanece obrigatória).
2. Latência aceitável em projetos grandes (sem recompilar contextos completos em cenários comuns).
3. Telemetria/métricas suficientes para comparar modos (antes/depois) e detectar regressões.

## UX

- Remover/desabilitar mensagem de status bar durante compilação (evitar “piscar” com compilação rápida).
- A opção de trocar o contexto/system via status bar deve estar disponível **somente** quando o arquivo ativo for um contexto do tipo **SingleFile**.

## Formatter

- Preservar layout quando já estiver bom; ajustar apenas quando necessário.
- Evitar inserir múltiplas linhas em branco sem necessidade.
- Strings literais: preservar conteúdo (não reindentação interna automática) como regra geral.
- Exceção formal: quando a feature dedicada de embedded SQL estiver habilitada e o contexto for semanticamente reconhecido (`ExecSql`, `<cursor>.SQL`, `ExecSQLEx`, `SQL_DefinirComando`), o formatter pode reconstruir o conteúdo interno da string SQL elegível para aplicar apenas whitespace canônico do SQL, preservando o wrapper LSP, os delimitadores, a semântica da expressão hospedeira e o fallback obrigatório para `no-op` em caso de ambiguidade.
- O dialeto configurável atual para formatação de SQL embutido é `sql`, `oracle` ou `sqlserver`; internamente a implementação adapta o dialeto para o provider compatível mantendo fallback seguro para `sql`.
- A cobertura atual também pode reconstruir concatenações estáticas simples e `SQL_DefinirComando(..., variável)` quando o valor da variável for reconstruível com segurança no mesmo arquivo/bloco; casos dinâmicos ou ambíguos permanecem em `no-op`.

## Syntax highlight

- **Funções (internas e customizadas)**: não distinguir; ambas devem ser destacadas como `function`.
- Para compatibilidade com temas, o mapeamento de semantic tokens deve cobrir também `function.declaration` e `function.definition`.
- Para “campos dinâmicos”, aplicar highlight apenas quando a referência ao campo for via string literal.
- Embedded SQL highlight evolui do modo leve por faixa para um modo interno controlado em candidatos semanticamente seguros, emitindo tokens para palavras-chave SQL, funções SQL reconhecidas, identificadores SQL bare e qualificados como `property`, parâmetros bind como `parameter.defaultLibrary.readonly` e literais SQL internos como `string.defaultLibrary`, sem se tornar um parser SQL completo.
- Em variáveis consumidas por wrappers suportados, o highlight também pode manter o tratamento SQL em fragmentos estruturais seguros de continuação (por exemplo `AND`, `OR`, `WHERE`, `FROM`, `GROUP BY`, `HAVING`, `ORDER BY`, `JOIN`, `UNION`, `INTO`, `VALUES`, `SET`) e em cadeias incrementais como `aFiltro = aFiltro + " and (...)"`, desde que a sequência continue semanticamente reconhecível como SQL.

### Lista: completion de campos dinâmicos

- Ao sugerir “propriedades customizadas” adicionadas via `.AdicionarCampo(...)`, o item deve ser do tipo **Property** (não Method), para refletir o ícone correto no VSCode.

## Tipagem em atribuições

- Ao validar atribuições (`<ident> = <expr>;`), o compilador deve validar o tipo do RHS contra o tipo do LHS.
- Exceção (compatibilidade com LSP):
  - `Data` ⇄ `Numero` é permitido sem diagnóstico.


## Decisões recentes (2026-02-12)

### Patches e distribuição
- **Não incluir arquivos dentro de `dist/` em patches**: a partir de agora, os patches fornecidos devem conter apenas fontes (ex.: `src/`, `internals/`, `syntaxes/`). A recompilação deve ser feita no repositório do usuário.

### Completion: Cursor e Lista
- **Cursor**: campos inferidos do `SELECT` (ex.: `Cur_X.Sql "Select T.Campo From ...";`) devem aparecer no completion como **propriedades** (Property).
- **Cursor**: o membro **`SQL`** deve permanecer como **método** (Method) e **não** pode ser sugerido como propriedade.
- **Lista**: o membro **`SQL`** deve permanecer como **método** (Method) e **não** pode ser sugerido como propriedade.

### Hover (assinaturas/documentação)
- O hover deve seguir o mesmo padrão das demais funções, incluindo **link de documentação (`docUrl`)** quando disponível.
- Para descrições de parâmetros com quebras de linha (`\n`), o renderer deve **preservar a formatação markdown** (indentando linhas de continuação) para listas e blocos de código renderizarem corretamente.
- **Não normalizar “tokens legados” no TypeScript**: quando necessário, a correção deve ser feita na origem (`*-signatures.json`).
- `docUrl: ""` deve ser tratado como ausente (permitindo fallback quando aplicável).

### Status de migração V1 → V2
- **Snippets**: considerar **convertido** (V1 e V2 equivalentes).
- **Leitura/adaptação do `lsp-configuration.json`**: considerar **convertido** (V2 já contribui arquivo de configuration).

- Format: a implementação vigente da extensão responde com **um único `TextEdit` full-document** quando há mudança; não há contrato ativo de hunks múltiplos na resposta final do LSP.

- Format: o formatter deve **preservar newline final** (se o original não termina com newline, o formatado também não deve terminar).

- Antes de responder via `public-api` sem snapshot útil para o URI, o handler de pull diagnostics deve verificar se já existe full compile do contexto em fila/em execução; nesse caso, ele pode aguardar um budget curto para preferir o resultado autoritativo `context-projected` e evitar a sequência `public-api=0` seguida de `context-projected>0`.
- Se um prefix compile via `public-api` ainda devolver `0` sem snapshot autoritativo por arquivo e houver full compile do mesmo contexto em voo/fila, o handler deve fazer um *second look* curto antes de consolidar esse `0`, para reduzir falsos vazios transitórios sem impedir `0` legítimo de arquivos realmente limpos.


## Atualização operacional — Fase 2 (2026-03-06)

- O caminho de `pull diagnostics` passou a priorizar `diagnosticsByFile` / cache comprometido por arquivo antes de reprojectar `compilerDiagnostics`.
- `didOpen` cold só pode reaproveitar snapshot quando houver estado útil; snapshot vazio não deve ser promovido nesse ramo.
- Quando existe full compile do mesmo contexto em voo/fila e o arquivo ainda não tem snapshot autoritativo por arquivo, o handler pode aguardar um budget curto e/ou fazer um *second look* antes de consolidar `count=0`.
- Em `SingleFile/Fallback`, reabrir o mesmo URI deve iniciar nova sessão lógica do documento, invalidando estado residual de diagnostics, semantic tokens e validações agendadas da sessão anterior.
- Logs de `2026-03-06` mostraram melhora real de corretude e de latência warm, mas ainda restou um resíduo localizado de arbitragem (`SIA\motivo`) e o principal gargalo segue em `overheadMs` fora do compiler.

---

# Variáveis do tipo `Tabela`

## Objetivo

Formalizar a regra de declaração de variáveis do tipo `Tabela` na V2, tomando como base a sintaxe histórica da linguagem e os exemplos reais existentes em `QL/_Antigos/Regra QL*.txt`.

Uma variável do tipo `Tabela` representa uma estrutura tabular com:

- nome da tabela;
- quantidade máxima de ocorrências;
- conjunto fixo de colunas;
- tipo de cada coluna;
- linhas indexadas de `1` até `N`.

---

## Sintaxe canônica

```lsp
Definir Tabela <nome_da_tabela>[<numero_de_ocorrencias>] = {
  <definicao_de_coluna>;
  <definicao_de_coluna>;
  ...
};
```

Cada coluna deve seguir uma das formas abaixo:

```lsp
<tipo_coluna> <nome_coluna>;
```

ou, no caso de `Alfa` com tamanho explícito:

```lsp
Alfa <nome_coluna>[<tamanho>];
```

### Exemplo

```lsp
Definir Tabela Meses[12] = {
  Alfa Nome_Mes[30];
  Numero Numero_Dias;
};
```

---

## Estrutura obrigatória da declaração

Uma declaração de `Tabela` exige obrigatoriamente:

1. palavra-chave `Definir`;
2. tipo `Tabela`;
3. identificador da variável;
4. quantidade de ocorrências entre colchetes;
5. operador `=`;
6. bloco de definição entre `{` e `}`;
7. `;` após o fechamento do bloco.

### Exemplo válido

```lsp
Definir Tabela ve_CodHor[100] = {
  Numero nCod;
  Numero nIni;
  Numero nFim;
  Numero nPer;
};
```

### Exemplo inválido

```lsp
Definir Tabela Meses = {
  Alfa Nome[30];
};
```

Motivo: falta o bloco de ocorrências `[<numero>]`.

---

## Modelo semântico

Toda variável `Tabela` deve possuir, conceitualmente:

- `name`: nome da tabela;
- `occurrences`: número máximo de linhas/ocorrências;
- `columns[]`: lista fixa de colunas.

Cada coluna deve possuir, no mínimo:

- `name`;
- `typeName`;
- `size` quando aplicável;
- `declRange`.

### Domínio inicial permitido para colunas

Na primeira implementação da V2, o schema interno de `Tabela` deve aceitar apenas:

- `Alfa`
- `Numero`
- `Data`

### Fora do escopo inicial

Na primeira versão da implementação de `Tabela`, não faz parte do escopo permitir colunas do tipo:

- `Tabela`
- `Lista`
- `Cursor`
- `Funcao`

Essa restrição reduz a complexidade e é compatível com os exemplos antigos utilizados como referência.

---

## Regras das colunas

## `Alfa`

Devem ser aceitas duas formas:

```lsp
Alfa Nome;
Alfa Nome[30];
```

### Regra

- `Alfa Nome;` é válido;
- `Alfa Nome[30];` é válido;
- quando o tamanho não for informado, ele permanece indefinido no modelo sintático/semântico;
- quando o tamanho for informado, ele deve ser literal numérico inteiro positivo.

## `Numero`

A forma válida é:

```lsp
Numero Codigo;
```

Não deve aceitar tamanho entre colchetes.

## `Data`

A forma válida é:

```lsp
Data DataIni;
```

Não deve aceitar tamanho entre colchetes.

---

## Regras das ocorrências

O valor entre colchetes em `Definir Tabela Nome[<n>]` representa o número máximo de ocorrências da tabela.

### Regra inicial da V2

Na primeira implementação, o valor deve ser:

- literal numérico inteiro;
- maior que zero.

### Fora do escopo inicial

Não faz parte do escopo inicial permitir:

- expressões aritméticas;
- constantes simbólicas;
- chamadas de função;
- qualquer cálculo dinâmico em runtime.

---

## Regras de validação conceitual

Uma declaração de `Tabela` deve ser considerada inválida quando ocorrer qualquer uma das situações abaixo:

- ausência do bloco de ocorrências;
- ocorrências com valor inválido (`<= 0` ou não numérico);
- bloco de colunas vazio;
- coluna sem nome;
- tipo de coluna fora do conjunto permitido;
- coluna duplicada dentro da mesma tabela;
- `Alfa Campo[n]` com `n` inválido;
- uso de `[n]` em colunas `Numero` ou `Data`.

---

## Acesso a colunas de `Tabela`

Na V2, o acesso válido de coluna usa indexador obrigatório:

```lsp
Tabela[idx].Coluna
```

### Regras atuais

- `Tabela.Coluna` (sem indexador) é inválido;
- acesso a coluna inexistente deve gerar diagnóstico;
- atribuição em coluna deve respeitar o tipo da coluna (`Alfa`/`Numero`/`Data`), com a mesma política de compatibilidade prática `Numero`/`Data` já adotada para variáveis.

### Exemplos

Válido:

```lsp
ve_CodHor[ie].nCod = 10;
```

Inválido:

```lsp
ve_CodHor.nCod = 10;        @ sem indexador @
ve_CodHor[ie].NaoExiste = 1; @ coluna inexistente @
```

---

## Regras de UX previstas

## Hover

Ao passar o mouse sobre a variável da tabela, o hover deve exibir:

- tipo `Tabela`;
- quantidade de ocorrências;
- resumo do schema.

### Exemplo esperado de hover

```text
Tabela Meses[12]
Campos:
- Nome_Mes: Alfa[30]
- Numero_Dias: Numero
```

## Completion

Ao digitar `Definir Tabela`, a extensão deve sugerir snippet estrutural.

No acesso por membro, a extensão deve sugerir colunas de tabela apenas no formato indexado:

- `Tabela[idx].` -> sugerir colunas;
- `Tabela.` -> não sugerir colunas.

### Exemplo de snippet esperado

```lsp
Definir Tabela ${1:NomeTabela}[${2:10}] = {
  Alfa ${3:Campo}[${4:30}];
};
```

---

## Estratégia recomendada de implementação

A implementação de `Tabela` na V2 deve ser dividida em fases.

## Fase 1

Implementar:

- parsing dedicado da declaração;
- modelo de AST próprio para `Tabela`;
- schema interno de colunas;
- validação semântica da definição;
- hover e snippet de declaração.

## Fase 2

Implementar:

- evolução de acesso tipado em expressões complexas;
- validações avançadas de leitura/escrita por contexto de expressão;
- evolução de completion de campos em cenários avançados.

---

## Casos de validação recomendados

Usar como referência os arquivos antigos:

- `QL/_Antigos/Regra QL820 - GER - Funcoes Gerais (A) .txt`
- `QL/_Antigos/Regra QL822 - GER - Funcoes Gerais (B) .txt`

Casos mínimos a validar:

- tabela com múltiplas colunas `Alfa` e `Numero`;
- `Alfa` com e sem tamanho explícito;
- ocorrência fixa numérica;
- fechamento correto com `};`.

---

## Observação de compatibilidade

A V2 já reconhece `Tabela` como tipo oficial da linguagem. Esta seção formaliza a particularidade sintática e semântica que ainda não está documentada com o mesmo nível de detalhe já aplicado a `Cursor` e `Lista`.

---

## Governança de estrutura de pastas (código-fonte)

Esta seção define como expandir e manter a árvore de pastas de `packages/extension/src` e `packages/compiler/src` de forma previsível.

### Princípio central

- Organizar por domínio funcional (responsabilidade de negócio/fluxo), não por estética, tamanho de arquivo ou conveniência pontual.

### Quando ampliar nível de pastas

- Criar uma subpasta quando existir massa crítica real no mesmo domínio (geralmente 3+ arquivos com coesão forte e crescimento esperado).
- Não criar subpasta para agrupar apenas 1 arquivo sem previsão de evolução.
- Revisar elevação de nível quando houver dificuldade recorrente de localização ou quando o domínio já exigir fronteira explícita.

### Critérios para posicionar novos arquivos

- Arquivos de fluxo específico ficam próximos do domínio que os consome diretamente.
- Arquivos transversais ficam no domínio de orquestração/composição e não em pastas genéricas sem dono.
- Arquivos centrais de entrada/composição devem permanecer em localização previsível:
  - `packages/extension/src/extension.ts`
  - `packages/extension/src/server.ts`
  - pontos equivalentes de entrada no compiler.

### Quando criar subpasta vs manter no nível atual

- Criar subpasta quando:
  - houver conjunto coeso de arquivos do mesmo fluxo;
  - o conjunto tiver fronteira clara com outros domínios;
  - a extração reduzir ambiguidade de navegação.
- Manter no nível atual quando:
  - o arquivo for pequeno e altamente específico de um único domínio já existente;
  - separar o arquivo aumentaria salto de navegação sem ganho real.

### Regras de profundidade

- Evitar profundidade excessiva (mais níveis só quando houver ganho claro de legibilidade).
- Preferir menos níveis com nomes de domínio claros a árvores longas com pastas intermediárias vagas.

### Anti-patterns a evitar

- pastas genéricas como eixo principal (`utils`, `helpers`, `types`, `services`) sem domínio explícito;
- profundidade artificial para “organizar visualmente” sem ganho de arquitetura;
- separar arquivos do mesmo fluxo sem necessidade;
- manter arquivos órfãos no topo quando já existe domínio claro.

### Exemplos práticos de posicionamento

- Novo scheduler de compilação incremental da extensão:
  - `packages/extension/src/server/compile/<arquivo>.ts`
- Nova regra de decisão para publicação de diagnóstico:
  - `packages/extension/src/server/diagnostics/<arquivo>.ts`
- Novo catálogo de assinaturas internas do compiler:
  - `packages/compiler/src/internals/data/<arquivo>.json`
- Nova função utilitária exclusiva de membros internos:
  - `packages/compiler/src/internals/members/<arquivo>.ts`


### Compatibilidade histórica de Tabela

Além da forma canônica com `{ ... }`, a implementação também aceita a forma histórica com `Inicio/Fim`:

```lsp
Definir Tabela Emails[3] =
Inicio
  Alfa aRemEma[100];
Fim;
```

Em ambos os casos, o modelo semântico é o mesmo.

Também há validação semântica do índice de acesso a `Tabela`:
- `LSP1510`: índice com tipo incompatível (deve ser `Numero`)
- `LSP1511`: índice literal fora do intervalo `1..N` da tabela

## Observability update — diagnostics perceived latency
- Pull diagnostics must now emit explicit follow-up timing fields for perceived latency analysis: `pullFollowupScheduledAt`, `pullFollowupStartedAt`, `pullFollowupExecutedAt`, `pullFollowupResolvedAt`, `pullFollowupFirstObservedAt`, `pullTimeToFirstObservedMs`, and `pullTimeToAuthoritativeMs`.
- Follow-up resolution for diagnostics clearing must be tracked even when the authoritative result is `0` diagnostics, so the instrumentation can measure cleanup latency and not only non-empty recovery.
- Authoritative pull-diagnostics follow-up scheduling should prefer the reduced delay constants to shrink time-to-authoritative without regressing pull request latency.
