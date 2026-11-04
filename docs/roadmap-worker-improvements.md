# Roadmap de melhorias do Compiler Worker

## Objetivo

Este documento propõe melhorias para o fluxo de compilação executado pelo Worker da extensão.

O projeto já possui uma arquitetura completa, com sessão persistente, cache incremental, compilação parcial, controle de versões, semântica sob demanda, métricas e descarte de respostas obsoletas. O objetivo não é substituir a implementação atual, mas reforçar sua segurança, observabilidade e manutenibilidade.

## Resumo executivo

Melhorias prioritárias:

1. serializar o acesso à sessão persistente do compilador;
2. extrair e validar o protocolo Worker ↔ servidor;
3. melhorar a serialização e o diagnóstico de erros;
4. tratar falhas e reinicialização do Worker;
5. ampliar testes de concorrência, ciclo de vida e contratos;
6. otimizar o transporte de resultados grandes.

## Estado atual

O Worker local está em:

- `packages/extension/src/server/runtime/compiler-worker.ts`

O servidor cria uma única instância do Worker e mantém uma sessão persistente:

```ts
const session = createCompilerSession();
```

O servidor já possui mecanismos importantes contra commits obsoletos:

- `requestId` por compilação;
- `latestByContext` e `runningByContext`;
- controle de geração do contexto;
- controle de versão do documento;
- ciclos de validação;
- coalescência de compilações pendentes;
- descarte de respostas antigas.

O principal risco identificado é que o listener do Worker dispara `handleRequest()` sem aguardar a requisição anterior:

```ts
parentPort?.on('message', (message: CompileRequest) => {
  void handleRequest(message);
});
```

Como a sessão é persistente e possui estado incremental, duas chamadas simultâneas podem acessar ou alterar o mesmo cache.

## Priorização

| Prioridade | Tema | Impacto | Esforço |
| --- | --- | --- | --- |
| P0 | Serialização da sessão | Alto | Baixo |
| P0 | Tratamento de falha do Worker | Alto | Médio |
| P1 | Protocolo compartilhado e validação runtime | Alto | Médio |
| P1 | Erros estruturados e observabilidade | Médio/alto | Baixo |
| P1 | Testes de concorrência e ciclo de vida | Alto | Médio |
| P2 | Otimização do payload | Médio | Médio/alto |
| P2 | Cancelamento cooperativo | Médio | Alto |
| P3 | Paralelismo controlado por contexto | Médio | Alto |

## Fase 1 — Segurança da execução

### 1. Serializar chamadas ao CompilerSession

**Prioridade:** P0
**Impacto:** alto
**Esforço:** baixo
**Dependências:** nenhuma

#### Problema

O Worker pode iniciar várias chamadas a `session.compile()` ao mesmo tempo. Isso é arriscado porque a sessão mantém cache incremental de arquivos, símbolos e semântica.

#### Proposta

Introduzir uma fila de execução no Worker. A primeira versão deve serializar todas as compilações:

```ts
let executionQueue = Promise.resolve();

parentPort.on('message', (message: unknown) => {
  executionQueue = executionQueue
    .then(() => handleRequest(message))
    .catch(() => undefined);
});
```

A fila deve registrar o tempo de espera antes da execução.

#### Critérios de aceite

- nunca existir mais de uma chamada ativa a `session.compile()`;
- respostas continuarem associadas ao `requestId` correto;
- compilações obsoletas ainda serem descartadas pelo servidor;
- não haver perda de mensagens após uma exceção;
- testes cobrirem duas mensagens recebidas em sequência.

#### Observação

A primeira versão sacrifica algum paralelismo para garantir consistência. Depois que a fila estiver coberta por testes, pode-se avaliar paralelismo entre contextos independentes.

### 2. Tratar falhas e encerramento do Worker

**Prioridade:** P0
**Impacto:** alto
**Esforço:** médio
**Dependências:** protocolo de erro estruturado

#### Problema

Uma exceção não capturada, erro de carregamento ou saída inesperada pode deixar requisições pendentes sem resposta e o servidor em estado de compilação permanente.

#### Proposta

Adicionar tratamento para:

- evento `error`;
- evento `exit` com código diferente de zero;
- limpeza de `pendingCompiles`;
- liberação de `compileRunning`;
- registro do contexto afetado;
- recriação controlada do Worker;
- limite de tentativas para evitar loop de reinicialização.

#### Critérios de aceite

- o servidor detectar a saída inesperada;
- compilações pendentes não ficarem presas indefinidamente;
- o Worker poder ser recriado sem reiniciar a extensão;
- o usuário receber log compreensível;
- existirem testes de `error` e `exit`.

## Fase 2 — Contrato e diagnóstico

### 3. Extrair um protocolo compartilhado

**Prioridade:** P1
**Impacto:** alto
**Esforço:** médio
**Dependências:** nenhuma

#### Problema

Os tipos de requisição e resposta estão definidos em arquivos diferentes do Worker e do servidor, facilitando divergências.

#### Proposta

Criar:

```text
packages/extension/src/server/compile/worker-protocol.ts
```

O arquivo deve conter:

- `CompileRequest`;
- `CompileResponse`;
- `CompileResultSizeBreakdown`;
- tipos de erro;
- tipos auxiliares serializáveis;
- funções de validação runtime.

O `server.ts` e o Worker devem importar esses tipos do mesmo módulo.

#### Critérios de aceite

- nenhum dos lados redeclarar os tipos do protocolo;
- mudanças exigirem alteração em um único contrato;
- testes validarem mensagens válidas e inválidas.

### 4. Validar mensagens em runtime

**Prioridade:** P1
**Impacto:** médio/alto
**Esforço:** baixo/médio
**Dependências:** item 3

#### Problema

`CompileRequest` é apenas uma garantia de compilação TypeScript. Mensagens recebidas pelo Worker podem estar incompletas ou inválidas.

#### Proposta

Adicionar `isCompileRequest(message: unknown)`, validando:

- `requestId` numérico;
- `context` com campos obrigatórios;
- `overrides` como pares de strings;
- `options` como objeto, quando presente;
- arrays de caminhos contendo strings.

Mensagens inválidas devem ser ignoradas e registradas em modo debug, sem derrubar o Worker.

#### Critérios de aceite

- mensagens inválidas não provocarem exceção;
- mensagens incompletas não chegarem ao compilador;
- comportamento coberto por testes unitários.

### 5. Usar erros estruturados

**Prioridade:** P1
**Impacto:** médio
**Esforço:** baixo
**Dependências:** item 3

#### Problema

O Worker atualmente converte erros para `String(error)`, perdendo stack trace, nome e informações úteis.

#### Proposta

Representar erros assim:

```ts
type WorkerError = {
  message: string;
  name?: string;
  stack?: string;
};
```

O stack deve ser enviado ou registrado somente quando o modo de debug estiver habilitado, para evitar exposição desnecessária de caminhos locais.

#### Critérios de aceite

- mensagens exibirem contexto suficiente;
- logs de debug preservarem stack trace;
- erros que não sejam instâncias de `Error` continuarem tratados.

## Fase 3 — Testes e observabilidade

### 6. Ampliar os testes do Worker

**Prioridade:** P1
**Impacto:** alto
**Esforço:** médio
**Dependências:** fases 1 e 2

Criar testes para:

- mensagens inválidas;
- duas requisições simultâneas;
- erro durante compilação;
- recuperação da fila após erro;
- resposta com `requestId` correto;
- resposta obsoleta;
- reinicialização do Worker;
- contexto com geração antiga;
- payload sem semântica;
- payload com estatísticas.

O teste de concorrência deve verificar que a segunda compilação só começa após a conclusão da primeira quando ambas usam a mesma sessão.

### 7. Adicionar métricas da fila

**Prioridade:** P1
**Impacto:** médio
**Esforço:** baixo/médio
**Dependências:** item 1

Registrar:

- tamanho máximo da fila;
- tempo de espera na fila;
- quantidade de requisições serializadas;
- quantidade descartada antes da execução;
- quantidade de erros do Worker;
- quantidade de reinicializações;
- tempo de execução do compilador;
- tamanho de requisição e resposta.

Isso permitirá diferenciar lentidão do compilador de lentidão causada pelo agendamento ou transporte.

## Fase 4 — Otimização do transporte

### 8. Reduzir respostas desnecessárias

**Prioridade:** P2
**Impacto:** médio
**Esforço:** médio
**Dependências:** protocolo compartilhado

O resultado pode transportar arquivos, símbolos, semântica e estatísticas na mesma resposta. A política deve ser explícita:

- diagnóstico rápido: diagnósticos e arquivos necessários;
- navegação: símbolos;
- tokens semânticos: semântica apenas dos arquivos solicitados;
- métricas: estatísticas apenas quando habilitadas;
- bootstrap: resultado completo.

O projeto já possui `includeSemanticPayload`, `semanticFilePaths` e `semanticBudgetFiles`. A melhoria é consolidar essa política no protocolo e evitar campos que não serão consumidos.

### 9. Avaliar formatos compactos

**Prioridade:** P2
**Impacto:** médio
**Esforço:** médio/alto
**Dependências:** métricas de payload

Antes de introduzir compressão ou `Transferable`, medir os maiores componentes do payload. Se semântica ou símbolos forem dominantes, avaliar:

- respostas por arquivo;
- deltas de semântica;
- reuso de dados já presentes no servidor;
- estruturas compactas para posições;
- exclusão de campos redundantes.

Essa etapa só deve ser implementada após identificar um gargalo real.

## Fase 5 — Cancelamento e paralelismo controlado

### 10. Implementar cancelamento cooperativo

**Prioridade:** P2
**Impacto:** médio
**Esforço:** alto
**Dependências:** fila, protocolo e suporte do compilador

O tipo local menciona `abortSignal`, mas sinais de aborto não são transferidos de forma útil pelo `postMessage`. Eles não devem ser tratados como solução de cancelamento entre threads.

Proposta:

- enviar um comando explícito `cancel` com `requestId`;
- manter requisições canceladas no Worker;
- verificar cancelamento em pontos seguros do compilador;
- devolver resposta marcada como cancelada ou descartá-la;
- preservar a consistência da sessão.

O cancelamento deve ser cooperativo. Encerrar o Worker para cancelar uma compilação deve ser último recurso, pois destrói o cache incremental.

### 11. Avaliar paralelismo por contexto

**Prioridade:** P3
**Impacto:** médio
**Esforço:** alto
**Dependências:** itens 1, 6 e 10

Depois de provar a segurança da serialização, avaliar uma fila por contexto. Isso permitiria compilar contextos independentes em paralelo, mantendo serialização dentro de cada contexto.

Antes de implementar, confirmar que:

- sessões e caches são isoláveis;
- não há estado global mutável no compilador;
- o custo de múltiplas sessões não supera o ganho;
- o consumo de memória permanece aceitável.

## Ordem sugerida de execução

### Milestone 1 — Robustez mínima

- criar protocolo compartilhado;
- adicionar validação runtime;
- serializar o acesso à sessão;
- adicionar testes básicos de erro e concorrência.

### Milestone 2 — Recuperação operacional

- tratar `error` e `exit` do Worker;
- limpar requisições pendentes;
- implementar recriação controlada;
- adicionar métricas de falha e reinicialização.

### Milestone 3 — Diagnóstico e desempenho

- implementar erros estruturados;
- medir espera na fila;
- analisar os maiores payloads;
- reduzir respostas desnecessárias.

### Milestone 4 — Otimizações avançadas

- cancelamento cooperativo;
- deltas de semântica;
- filas por contexto;
- paralelismo controlado.

## Critérios gerais de sucesso

O roadmap poderá ser considerado concluído quando:

- nenhuma compilação concorrente acessar a mesma sessão sem controle;
- mensagens inválidas não derrubarem o Worker;
- falha do Worker não deixar o servidor permanentemente ocupado;
- respostas obsoletas continuarem sendo descartadas;
- existirem testes para concorrência, erro, reinicialização e protocolo;
- métricas permitirem identificar fila, compilador e transporte como fontes de latência;
- melhorias de payload forem justificadas por medições reais.

## Decisões que devem ser preservadas

- manter o cache incremental do compilador;
- manter o descarte de respostas obsoletas no servidor;
- manter o controle de versão e geração de contexto;
- não introduzir compressão ou paralelismo antes de medir o problema;
- não usar encerramento forçado do Worker como mecanismo normal de cancelamento.
