# Catálogo de Diagnostics – LSP V2 (100% reconciliado com o código-fonte)

Este documento foi reconciliado diretamente com o código do `p36`:

- `packages/compiler/src/diagnostics/codes.ts`
- `packages/compiler/src/semantic/analyzer.ts`
- `packages/compiler/src/parser/parser.ts`
- `packages/compiler/src/index.ts`
- `packages/extension/src/quick-fixes.ts`

Ele registra o **estado real implementado hoje**: código, severidade efetiva, mensagens emitidas e Quick Fix atualmente disponível.

Observabilidade TS-like (M8):
- Este catálogo cobre apenas códigos/mensagens de diagnostics.
- Taxonomia de decisão operacional (`publishDecision`, `formatDecision`, `tokenDecision`) é documentada em `docs/observability-schema-v1.md`.
- Traduções ES/EN do catálogo: `docs/messages-i18n.md`.

> Fonte normativa de regra humana: `docs/rules.md`
> Fonte normativa de execução/status: `docs/milestones.md`
> Este arquivo descreve o **catálogo efetivo emitido pelo código atual**.

---

## Convenções

### Severidade
- **Error**: erro semântico/sintático/léxico emitido pelo compiler.
- **Warning**: aviso semântico emitido pelo analyzer.
- **Info**: sugestão semântica emitida pelo analyzer.

### Mensagem canônica vs mensagens efetivas
- Quando um código emite exatamente uma mensagem, a tabela mostra a mensagem efetiva.
- Quando um código emite **mais de uma mensagem**, a tabela marca como **mensagens efetivas múltiplas** e lista todas na seção detalhada.

### Quick Fix
- **Sim**: existe Quick Fix implementado hoje no código da extensão.
- **Não**: não há Quick Fix ativo no código atual.
- Para `LSP0001`, o Quick Fix existe apenas no subcaso de `Esperado ';'`.

---

## Resumo por código

| Código | Severidade efetiva | Quick Fix | Observação |
|---|---|---:|---|
| LSP0001 | Error | Sim (parcial) | Parse/syntax umbrella + alguns erros sintáticos específicos emitidos como `LSP0001` |
| LSP0002 | Error | Não | Erro léxico: token inválido |
| LSP0003 | Error | Não | Erro léxico: comentário de bloco não fechado |
| LSP0004 | Error | Não | Erro léxico: string não fechada |
| LSP0005 | Error | Não | Parêntese sem fechamento |
| LSP0006 | Error | Não | Colchete sem fechamento |
| LSP0007 | Error | Não | Falta de espaço antes de comentário inline |
| LSP1001 | Warning | Não | Uso antes da declaração |
| LSP1002 | Error | Não | Conflito de tipo em variável já declarada |
| LSP1003 | Error | Sim | String literal exige declaração explícita Alfa |
| LSP1004 | Error | Não | String literal exige variável Alfa |
| LSP1005 | Error | Sim | Variável não declarada |
| LSP1006 | Error | Não | Tipo inválido na atribuição |
| LSP1101 | Warning | Não | Função declarada e não implementada |
| LSP1102 | Warning | Não | Função implementada sem declaração |
| LSP1103 | Error | Não | Implementação de função fora do escopo global |
| LSP1104 | Error | Não | Função com mais de 15 parâmetros |
| LSP1105 | Error | Não | Declaração de função fora do escopo global |
| LSP1201 | Warning | Não | Parâmetro não utilizado |
| LSP1202 | Warning | Não | Parâmetro END nunca atribuído |
| LSP1203 | Info | Não | Variável não utilizada |
| LSP1204 | Info | Sim | END atribuído via chamada |
| LSP1301 | Error | Não | Cursor.SQL sem SELECT |
| LSP1302 | Error | Não | Campo de Cursor somente leitura |
| LSP1303 | Warning | Não | Quantidade de parâmetros inválida em método de Cursor |
| LSP1401 | Warning | Não | Quantidade de parâmetros inválida em chamada de função |
| LSP1402 | Warning | Não | Tipo inválido em argumento de chamada |
| LSP1403 | Error | Não | Método de Lista chamado fora de variável Lista |
| LSP1404 | Warning | Sim | Sugestão para variável usada como Data sem declaração |
| LSP1406 | Error | Não | Sombreamento de ancestral com tipo diferente |
| LSP1408 | Error | Não | Função inexistente |
| LSP1410 | Error | Não | Quantidade de parâmetros inválida em ConverteMascara |
| LSP1411 | Error | Não | Mensagens efetivas múltiplas |
| LSP1412 | Error | Não | Mensagens efetivas múltiplas |
| LSP1413 | Error | Não | Destino de ConverteMascara não atribuível |
| LSP1414 | Warning / Error | Não | Severidade e mensagem variam por caso |
| LSP1415 | Error | Não | Tipo inválido para Tipo_Dado = 3 |
| LSP1416 | Error | Não | Valor inválido para Tipo_Dado = 5 |
| LSP1417 | Warning | Não | Quantidade de parâmetros inválida em método de Lista |
| LSP1418 | Error | Não | VaPara sem rótulo válido no arquivo atual |
| LSP1419 | Error | Não | Parâmetro END exige variável |
| LSP1420 | Warning | Não | Redeclaração global no mesmo arquivo |
| LSP1421 | Warning | Não | Redeclaração no mesmo escopo |
| LSP1422 | Error | Não | Primeiro parâmetro de Mensagem inválido |
| LSP1423 | Error | Não | `Pare`/`Continue` fora de `Enquanto`/`Para` |
| LSP1424 | Warning | Não | Parâmetro duplicado em função customizada |
| LSP1501 | Error | Não | Ocorrências de `Tabela` inválidas |
| LSP1502 | Error | Não | Coluna de `Tabela` sem nome |
| LSP1503 | Error | Não | Tipo de coluna de `Tabela` inválido |
| LSP1504 | Error | Não | Coluna duplicada em `Tabela` |
| LSP1505 | Error | Não | Tamanho inválido em coluna `Alfa` de `Tabela` |
| LSP1506 | Error | Não | Tamanho não permitido em `Numero`/`Data` de `Tabela` |
| LSP1507 | Error | Não | `Tabela` sem colunas |
| LSP1508 | Error | Não | Coluna inexistente em acesso de `Tabela` |
| LSP1509 | Error | Não | Acesso de coluna de `Tabela` sem indexador |

---

## Catálogo detalhado

### LSP0001 — Error
**Mensagens efetivas múltiplas**

Mensagens emitidas hoje:
- `Erro léxico: ...` **não** usa `LSP0001`; ver `LSP0002`, `LSP0003`, `LSP0004`.
- No parser/compile:
  - mensagens genéricas de sintaxe mapeadas para `LSP0001`
  - erros `SYN_UNCLOSED_BLOCK`, `SYN_EXPECTED_SEMICOLON` e `SYN_GENERIC` mapeiam para `LSP0001`
- No analyzer:
  - `Sintaxe '<obj>.SQL "...";' é permitida apenas para variáveis do tipo Cursor.`
  - `ExecSql requer um StringLiteral: ExecSql "...";`
  - `ExecSql deve terminar com ';'`

**Quick Fix atual:** Sim, **somente** quando a mensagem contém `Esperado ';'` e o range do diagnóstico é vazio.

---

### LSP0002 — Error
**Mensagem efetiva**
- `Erro léxico: Token inválido: <token>`

**Quick Fix atual:** Não

---

### LSP0003 — Error
**Mensagem efetiva**
- `Erro léxico: Comentário de bloco não fechado`

**Quick Fix atual:** Não

---

### LSP0004 — Error
**Mensagem efetiva**
- `Erro léxico: String não fechada`

**Quick Fix atual:** Não

---

### LSP0005 — Error
**Mensagem efetiva**
- `Parêntese '(' sem ')'`

**Quick Fix atual:** Não

---

### LSP0006 — Error
**Mensagem efetiva**
- `Colchete '[' sem ']'`

**Quick Fix atual:** Não

---

### LSP0007 — Error
**Mensagem efetiva**
- `Esperado 1 espaço antes de comentário inline`

**Quick Fix atual:** Não

---

### LSP1001 — Warning
**Mensagem efetiva**
- `Uso antes da declaração: <identificador>`

**Quick Fix atual:** Não

---

### LSP1002 — Error
**Mensagem efetiva**
- `Variável já declarada com outro tipo: <identificador>`

**Quick Fix atual:** Não

---

### LSP1003 — Error
**Mensagem efetiva**
- `Atribuição de literal Alfa exige variável declarada: <identificador>`

**Quick Fix atual:** Sim

Ações atuais:
- `Declarar Alfa <nome> (local)`
- `Declarar Alfa <nome> (global)`

---

### LSP1004 — Error
**Mensagem efetiva**
- `Atribuição de literal Alfa exige variável Alfa: <identificador>`

**Quick Fix atual:** Não

---

### LSP1005 — Error
**Mensagem efetiva**
- `Variável não declarada: <identificador>`

**Quick Fix atual:** Sim

Ação atual:
- `Declarar <tipoInferido> <nome>`

Observação:
- o Quick Fix atual **não abre prompt de rename**; declara diretamente com o nome diagnosticado.
- quando o identificador aparece como índice de `Tabela` e só existe por atribuição implícita anterior, o diagnóstico continua sendo `LSP1005`, mas a mensagem passa a exigir declaração explícita do indexador.

---

### LSP1006 — Error
**Mensagem efetiva**
- `Tipo inválido na atribuição: <identificador> (<tipoEsperado>) não aceita <tipoRecebido>`

**Quick Fix atual:** Não

---

### LSP1101 — Warning
**Mensagem efetiva**
- `Função declarada e não implementada: <nome>`

**Quick Fix atual:** Não

---

### LSP1102 — Warning
**Mensagem efetiva**
- `Função implementada sem declaração: <nome>`

**Quick Fix atual:** Não

---

### LSP1103 — Error
**Mensagem efetiva**
- `Funções só podem ser implementadas no escopo global`

**Quick Fix atual:** Não

---

### LSP1104 — Error
**Mensagem efetiva**
- `Função com mais de 15 parâmetros`

**Quick Fix atual:** Não

---

### LSP1105 — Error
**Mensagem efetiva**
- `Funções só podem ser declaradas no escopo global`

**Quick Fix atual:** Não

---

### LSP1201 — Warning
**Mensagem efetiva**
- `Parâmetro não utilizado: <identificador>`

**Quick Fix atual:** Não

---

### LSP1202 — Warning
**Mensagem efetiva**
- `Parâmetro END nunca atribuído: <identificador>`

**Quick Fix atual:** Não

---

### LSP1203 — Info
**Mensagem efetiva**
- `Variável não utilizada: <identificador>`

**Quick Fix atual:** Não

---

### LSP1204 — Info
**Mensagem efetiva**
- `Parâmetro END atribuído via chamada; considere usar variável local intermediária: <identificador>`

**Quick Fix atual:** Sim

Ação atual:
- `Usar variavel local para END (<nomeSugerido>)`

---

### LSP1301 — Error
**Mensagem efetiva**
- `Cursor.SQL deve conter um SELECT`

**Quick Fix atual:** Não

---

### LSP1302 — Error
**Mensagem efetiva**
- `Campo de Cursor é somente leitura: <campo>`

**Quick Fix atual:** Não

---

### Família conceitual — quantidade inválida de parâmetros
Os diagnósticos `LSP1303`, `LSP1401`, `LSP1410` e `LSP1417` pertencem à mesma família conceitual: chamadas com quantidade incorreta de parâmetros. Eles permanecem separados por contexto semântico para preservar precisão de manutenção, telemetria e testes.

### LSP1303 — Warning
**Mensagem efetiva**
- `Quantidade de parâmetros inválida em <métodoCursor>: esperado <n>, recebido <m>`

**Quick Fix atual:** Não

---

### LSP1401 — Warning
**Mensagem efetiva**
- `Quantidade de parâmetros inválida em <nome>: esperado <n>, recebido <m>`

**Quick Fix atual:** Não

---

### LSP1402 — Warning
**Mensagem efetiva**
- `Tipo inválido no argumento <posição> de <nome>: esperado <tipoEsperado>, recebido <tipoRecebido>`

**Observação**
- Não emitir para compatibilidade prática `Data` ↔ `Numero`.

**Quick Fix atual:** Não

---

### LSP1403 — Error
**Mensagem efetiva**
- `Método de lista deve ser chamado a partir de uma variável do tipo Lista: <método>`

**Quick Fix atual:** Não

---

### LSP1404 — Warning
**Mensagem efetiva**
- `Variável usada como Data sem declaração: <identificador>`

**Quick Fix atual:** Sim

Ação atual:
- `Declarar Data <nome>`

---

### LSP1406 — Error
**Mensagem efetiva**
- `Sombreamento de ancestral com tipo diferente: <identificador>`

**Quick Fix atual:** Não

Observação importante:
- no código atual, `LSP1406` está reconciliado como **Error**, não como Warning.
- o Quick Fix correspondente **não está ativo** no código atual.

---

### LSP1408 — Error
**Mensagem efetiva**
- `Função inexistente: <nome>`

**Quick Fix atual:** Não

---

### LSP1410 — Error
**Mensagem efetiva**
- `Quantidade de parâmetros inválida em ConverteMascara: esperado 4, recebido <n>`

**Quick Fix atual:** Não

---

### LSP1411 — Error
**Mensagens efetivas múltiplas**
- `ConverteMascara: Alfa_Origem deve ser Alfa.`
- `ConverteMascara: Alfa_Destino deve ser Alfa.`

**Quick Fix atual:** Não

---

### LSP1412 — Error
**Mensagens efetivas múltiplas**
- `ConverteMascara: Mascara_Origem deve ser Alfa.`
- `ConverteMascara: Mascara_Destino deve ser Alfa.`
- `ConverteMascara: Mascara deve ser Alfa.`

**Quick Fix atual:** Não

---

### LSP1413 — Error
**Mensagem efetiva**
- `ConverteMascara: Alfa_Origem/Destino deve ser uma variável atribuível.`

**Quick Fix atual:** Não

---

### LSP1414 — Warning / Error
**Mensagens efetivas múltiplas**
- `ConverteMascara: a variável <nome> deve ser Numero e estar definida.`
- `ConverteMascara: para Tipo_Dado 1, 2 ou 4, o Valor_Origem deve ser Numero.`

**Severidade efetiva**
- **Warning** em um caso tolerado específico
- **Error** nos demais casos

**Quick Fix atual:** Não

---

### LSP1415 — Error
**Mensagem efetiva**
- `ConverteMascara: para Tipo_Dado 3, o Valor_Origem deve ser Data ou Numero.`

**Quick Fix atual:** Não

---

### LSP1416 — Error
**Mensagem efetiva**
- `ConverteMascara: para Tipo_Dado 5, o Valor_Origem deve ser o número 0.`

**Quick Fix atual:** Não

---

### LSP1417 — Warning
**Mensagem efetiva**
- `Quantidade de parâmetros inválida em <métodoLista>: esperado <min>-<max>, recebido <n>`

**Quick Fix atual:** Não

---

### LSP1418 — Error
**Mensagem efetiva**
- `VaPara: rótulo não encontrado no arquivo atual: <rotulo>`

**Quick Fix atual:** Não

---

### LSP1419 — Error
**Mensagem efetiva**
- `Parâmetro END exige variável no argumento <posição> de <nome>`

**Quick Fix atual:** Não

---

### LSP1420 — Warning
**Mensagem efetiva**
- `Redeclaração global não permitida no mesmo arquivo: <identificador>`

**Quick Fix atual:** Não

---

### LSP1421 — Warning
**Mensagem efetiva**
- `Redeclaração não permitida no mesmo escopo: <identificador>`

**Quick Fix atual:** Não

---

### LSP1422 — Error
**Mensagem efetiva**
- `Primeiro parâmetro de Mensagem deve ser Retorna, Erro ou Refaz`

**Quick Fix atual:** Não

---

### LSP1501 — Error
**Mensagem efetiva**
- `Tabela <nome>: ocorrências devem ser inteiro positivo`

**Quick Fix atual:** Não

---

### LSP1502 — Error
**Mensagem efetiva**
- `Tabela <nome>: coluna sem nome`

**Quick Fix atual:** Não

---

### LSP1503 — Error
**Mensagem efetiva**
- `Tabela <nome>: tipo de coluna inválido (<coluna>)`

**Quick Fix atual:** Não

---

### LSP1504 — Error
**Mensagem efetiva**
- `Tabela <nome>: coluna duplicada (<coluna>)`

**Quick Fix atual:** Não

---

### LSP1505 — Error
**Mensagem efetiva**
- `Tabela <nome>: tamanho inválido em coluna Alfa (<coluna>)`

**Quick Fix atual:** Não

---

### LSP1506 — Error
**Mensagem efetiva**
- `Tabela <nome>: tamanho não permitido para coluna Numero/Data (<coluna>)`

**Quick Fix atual:** Não

---

### LSP1507 — Error
**Mensagem efetiva**
- `Tabela <nome>: deve possuir pelo menos uma coluna`

**Quick Fix atual:** Não

---

### LSP1508 — Error
**Mensagem efetiva**
- `Tabela <nome>: coluna inexistente (<coluna>)`

**Quick Fix atual:** Não

---

### LSP1509 — Error
**Mensagens efetivas**
- `Acesso a coluna de Tabela exige indexador: use Tabela[...].Coluna`
- `Atribuição em coluna de Tabela exige indexador: use Tabela[...].Coluna`

**Quick Fix atual:** Não

---

## Quick Fixes efetivamente implementados hoje

| Código | Status | Ação |
|---|---|---|
| LSP0001 | Parcial | `Inserir ';'` apenas para `Esperado ';'` com range vazio |
| LSP1003 | Sim | Declarar `Alfa` local ou global |
| LSP1005 | Sim | Declarar variável com tipo inferido |
| LSP1204 | Sim | Criar variável local intermediária para `END` |
| LSP1404 | Sim | Declarar `Data` |
| LSP1406 | Não | Sem plano ativo no código atual |

---

## Diferenças importantes em relação à documentação antiga

1. **LSP1406**
   - O código atual emite `LSP1406` como **Error** com a mensagem:
     - `Sombreamento de ancestral com tipo diferente: <identificador>`
   - Não há Quick Fix ativo para ele.

2. **LSP1103 / LSP1105**
   - `LSP1103` = implementação fora do escopo global
   - `LSP1105` = declaração fora do escopo global

3. **LSP1411 / LSP1412**
   - Cada um cobre múltiplos rótulos/mensagens concretas em `ConverteMascara`.

4. **LSP1414**
   - Não tem severidade única; o código atual pode emitir **Warning** ou **Error**.

5. **LSP0001**
   - É um guarda-chuva de sintaxe, mas também recebe alguns erros semânticos/sintáticos específicos do analyzer (`ExecSql`, shorthand `.SQL` fora de `Cursor`).

---

## Regra de manutenção

Sempre que:
- um novo diagnóstico for criado,
- a severidade mudar,
- a mensagem efetiva mudar,
- um Quick Fix for adicionado/removido,

este catálogo deve ser atualizado **com base no código-fonte real**.


### LSP1423 — Error

- **Mensagem efetiva:** `Pare/Continue somente pode ser utilizado dentro de blocos Enquanto ou Para.`
- Emitido quando `Pare;` ou `Continue;` aparece fora do corpo semântico de um laço `Enquanto` ou `Para`.
- Não possui Quick Fix no estado atual.


### LSP1424 — Warning
- **Mensagem**: `Parâmetro duplicado na função <funcao>: <parametro>`
- **Quando ocorre**: quando a assinatura efetiva de uma função customizada repete o mesmo nome de parâmetro mais de uma vez.
- **Critério anti-duplicação**: se existir implementação, o diagnóstico é emitido apenas nela; a declaração isolada só recebe o diagnóstico quando não existe implementação correspondente.


### LSP1510 — Error
- **Mensagem efetiva:** `Índice de Tabela deve ser Numero.`
- Emitido quando o índice em `Tabela[idx].Coluna` não possui tipo compatível com `Numero`.
- Neste pacote, a validação cobre especialmente literais e variáveis com tipo conhecido no ponto de uso.

### LSP1511 — Error
- **Mensagem efetiva:** `Índice literal fora do intervalo da Tabela.`
- Emitido quando o índice literal em `Tabela[idx].Coluna` fica fora do intervalo `1..N`, onde `N` é a quantidade de ocorrências declarada da tabela. Isso inclui qualquer literal negativo.
- A validação de faixa é intencionalmente restrita a índices literais neste pacote.
