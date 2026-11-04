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

## Detalhamento técnico e referências de mercado

Esta seção transforma as sugestões em decisões implementáveis e registra padrões usados por ferramentas de linguagem e runtimes de produção. As referências não significam que o projeto deva copiar uma implementação específica; servem como comparação para validar as decisões locais.

### Padrões externos que orientam o roadmap

- O [Language Server Protocol](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/) usa JSON-RPC, identificadores de requisição e cancelamento por notificação (`$/cancelRequest`). A consequência prática é separar requisições, notificações e comandos de cancelamento no protocolo, em vez de tentar transferir `AbortSignal` pelo `postMessage`.
- O [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html) diferencia `error`, `message` e `exit`, e oferece `resourceLimits` e `performance`. O servidor deve registrar a causa do término, o código de saída e a duração de cada geração do Worker; um `exit` normal não deve ser tratado como crash.
- O [VS Code](https://code.visualstudio.com/api/advanced-topics/extension-host) executa extensões em hosts local, remoto ou web. Portanto, caminhos absolutos, disponibilidade de Node.js e capacidade de criar Workers devem ser tratados como propriedades do ambiente, não como invariantes do compilador.
- O TypeScript expõe APIs de programa incremental e watch, mas o cache é associado ao estado do programa e às alterações observadas. Isso reforça a decisão de serializar o acesso à sessão até que o isolamento de estado seja demonstrado, e não apenas inferido pelo fato de as chamadas serem assíncronas.

### 1. Fila da sessão: desenho recomendado

Usar uma fila explícita com estado observável, em vez de apenas encadear Promises anônimas. Cada item deve conter `requestId`, contexto, geração, instante de entrada, prioridade e uma função de execução. A fila deve expor pelo menos:

- `enqueue(request)`, `cancel(requestId)` e `close(reason)`;
- estado `queued`, `running`, `completed`, `cancelled` ou `failed`;
- limite de tamanho e política para overflow;
- garantia de que o `catch` de uma tarefa não interrompe a cadeia;
- `finally` para liberar o estado de execução mesmo quando o compilador lança exceção.

Política sugerida: manter apenas a compilação mais recente por contexto quando uma tarefa ainda está na fila, mas nunca substituir uma tarefa que já iniciou. A substituída deve receber um motivo explícito (`superseded`) para alimentar métricas. O limite de fila deve falhar de forma controlada, com mensagem recuperável, em vez de consumir memória indefinidamente.

Critérios adicionais:

- invariantes testáveis: `activeCount <= 1`, cada item termina uma única vez e cada resposta possui `requestId` único;
- medir `queueWaitMs`, `compileMs`, `responseMs` e `endToEndMs` separadamente;
- não manter referências a documentos, árvores ou payloads após a conclusão;
- usar monotonicidade de geração para rejeitar commits atrasados, mesmo quando a resposta chega depois de uma reinicialização.

### 2. Falha e reinicialização: máquina de estados

Modelar o ciclo de vida do Worker como `starting -> ready -> stopping -> stopped` e `failed -> restarting`, com um identificador de geração (`workerGeneration`). Toda mensagem enviada deve carregar ou ser associada à geração atual. Respostas de gerações anteriores devem ser descartadas sem alterar `compileRunning` ou `pendingCompiles` da geração nova.

Ao receber `error` ou `exit` inesperado:

1. marcar o Worker como indisponível;
2. rejeitar ou cancelar todas as pendências com um erro tipado (`WORKER_CRASHED`);
3. liberar flags e timers em uma rotina idempotente;
4. aplicar backoff exponencial com jitter, por exemplo 250 ms, 1 s, 4 s e limite de 30 s;
5. interromper após um número máximo de tentativas dentro de uma janela;
6. expor um estado degradado ao usuário e permitir retry manual.

Não reiniciar imediatamente em loop. Registrar causa, código de saída, memória disponível, contexto, número da tentativa e tempo desde a última reinicialização. O [runtime do Node](https://nodejs.org/api/worker_threads.html) deve ser tratado como fonte dos eventos de ciclo de vida; o protocolo da aplicação deve ser responsável por concluir as requisições pendentes.

### 3. Protocolo: envelope, versões e validação

Adotar um envelope discriminado, por exemplo:

```ts
type WorkerMessage =
  | { kind: 'compile'; protocolVersion: 1; request: CompileRequest }
  | { kind: 'cancel'; protocolVersion: 1; requestId: number }
  | { kind: 'ping'; protocolVersion: 1; nonce: string };
```

As respostas devem conter `kind`, `protocolVersion`, `requestId`, `workerGeneration` e `status`. Erros de validação não devem ser confundidos com erros de compilação. Recomenda-se separar códigos estáveis (`INVALID_MESSAGE`, `UNSUPPORTED_PROTOCOL`, `COMPILATION_FAILED`, `CANCELLED`, `WORKER_CRASHED`) do texto exibido ao usuário.

Validar na fronteira e normalizar os dados antes de enfileirar. Além dos campos já listados, validar limites: quantidade máxima de arquivos, tamanho máximo de caminho, tamanho de overrides e profundidade de objetos. Se o projeto já usar uma biblioteca de schemas, reutilizá-la; caso contrário, um validador pequeno e sem dependência é suficiente para este protocolo.

### 4. Erros, logs e privacidade

Usar erro serializado com `code`, `message`, `name`, `stack` opcional, `retryable`, `requestId` e `workerGeneration`. O stack completo deve permanecer em log local de debug; a resposta ao cliente deve remover caminhos absolutos, conteúdo-fonte, variáveis de ambiente e argumentos potencialmente sensíveis.

Adotar logs estruturados em uma linha por evento, com campos como `event`, `requestId`, `contextId`, `generation`, `queueWaitMs`, `compileMs`, `payloadBytes` e `outcome`. Gerar um `traceId` por operação do servidor e propagá-lo ao Worker. Amostrar operações bem-sucedidas e registrar sempre falhas, reinicializações e filas acima do limiar.

### 5. Testes de contrato e falhas reais

Além dos testes unitários, criar três camadas:

- contrato: mensagens produzidas pelo servidor são aceitas pelo Worker e respostas rejeitadas pelo servidor falham de modo previsível;
- integração: Worker real, duas compilações, erro durante `compile`, `exit` inesperado e reconstrução;
- propriedade/stress: sequências aleatórias de compile, cancel, supersede e restart, verificando que não há duas execuções da sessão e que toda requisição termina.

Usar uma barreira controlada no mock de `session.compile()` para provar a serialização, em vez de depender de temporização. Incluir testes para payload grande, contexto removido durante uma compilação, versão antiga e reinicialização no intervalo entre resposta e commit.

### 6. Payload e transporte: medir antes de mudar

Registrar tamanho bruto e, se aplicável, tamanho após serialização por componente: diagnósticos, arquivos, símbolos, semântica e estatísticas. Definir metas de produto antes da otimização, por exemplo p95 de resposta, tamanho máximo esperado e tempo aceitável de bootstrap.

Ordem recomendada de otimização:

1. remover campos que o consumidor não usa;
2. limitar semântica a arquivos solicitados;
3. enviar resultados por arquivo ou em lotes menores;
4. reutilizar dados identificados por hash de conteúdo;
5. testar estruturas compactas para posições e intervalos;
6. só então comparar compressão, `Transferable` e formatos binários.

Cada opção deve ser avaliada com CPU, memória e latência de ponta a ponta. `Transferable` pode reduzir cópias, mas não resolve objetos JavaScript já estruturados; compressão pode reduzir transporte e aumentar CPU. A decisão deve ser baseada em p50/p95 e não apenas no tamanho médio.

### 7. Cancelamento cooperativo e prioridade

Implementar cancelamento como comando idempotente. O Worker deve manter `cancelledRequestIds` apenas pelo tempo necessário, responder uma vez e limpar o conjunto em `finally`. Pontos seguros de cancelamento devem existir entre fases do compilador; nunca interromper uma mutação parcial da sessão.

Usar prioridades: edição ativa e diagnóstico do arquivo aberto acima de indexação, bootstrap e métricas. O cancelamento de uma requisição que ainda está na fila é imediato; o de uma execução ativa depende dos pontos de verificação. O servidor deve distinguir `cancelled`, `superseded` e `timed_out`, pois cada estado exige ação operacional diferente.

### 8. Paralelismo por contexto: só após evidência

Antes de criar filas por contexto, medir a relação entre ganho e custo com um experimento controlado. Criar uma sessão independente por contexto, impor limite de concorrência (por exemplo, número de núcleos menos um), limitar memória e executar cenários de um, dois e vários contextos.

O experimento deve comparar: latência p95, throughput, memória RSS/heap, taxa de reinicialização, tamanho dos caches e impacto no host da extensão. Se houver estado global ou cache compartilhado não isolável, manter uma fila única. Paralelismo só deve ser habilitado por feature flag e desativado automaticamente após pressão de memória ou falhas repetidas.

## Checklist de implementação por item

| Item | Entregável mínimo | Evidência para avançar |
| --- | --- | --- |
| Fila | classe de fila, estados e métricas | teste prova `activeCount <= 1` |
| Reinício | máquina de estados, limpeza idempotente e backoff | integração com `error` e `exit` |
| Protocolo | envelope versionado e validator | testes de contrato em ambos os lados |
| Erros | códigos, sanitização e logs estruturados | diagnóstico reproduzível sem stack exposto |
| Testes | unitário, integração e stress | execução repetida sem flakiness |
| Payload | breakdown por componente e baseline | decisão baseada em p95 |
| Cancelamento | comando idempotente e checkpoints | compilação não corrompe a sessão |
| Paralelismo | benchmark por contexto e feature flag | ganho líquido sem regressão de memória |

## Referências consultadas

- [Language Server Protocol 3.18](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/)
- [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)
- [Visual Studio Code Extension Host](https://code.visualstudio.com/api/advanced-topics/extension-host)
- [TypeScript Compiler API — incremental programs](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#writing-an-incremental-program-watcher)

## Oportunidades nas versões atuais de `vscode-languageclient` e `vscode-languageserver`

O projeto já declara `vscode-languageclient` e `vscode-languageserver` `^11.0.0`, com `11.0.0` resolvido no lockfile. A atualização ajuda diretamente em algumas frentes do roadmap, mas não elimina a necessidade de proteger a sessão persistente do compilador: o dispatch LSP controla a concorrência dos handlers da conexão, enquanto `CompilerSession` possui estado incremental próprio.

### Aplicações diretas

#### 1. Cancelamento nativo em requests

O client aceita `CancellationToken` em `sendRequest`, e o server recebe o token no handler. Isso deve orientar o item 10 do roadmap:

- usar o token LSP no caminho editor → servidor;
- converter o cancelamento em uma decisão explícita para o request interno do Worker;
- manter um `requestId` correlacionado até a sessão;
- verificar cancelamento entre fases seguras da compilação;
- retornar `CANCELLED`/descartar o resultado sem aplicar mutações parciais.

O token não deve ser enviado diretamente ao Worker via `postMessage`; ele deve ser traduzido para o comando serializável `cancel` já proposto.

#### 2. Controle de paralelismo do dispatch

As versões recentes permitem controlar o paralelismo de requests e notifications da conexão, e handlers assíncronos podem controlar a conclusão do dispatch. Isso oferece uma primeira barreira no servidor LSP:

- configurar dispatch serializado para notificações que atualizam documentos;
- permitir paralelismo apenas para requests comprovadamente independentes;
- não considerar essa configuração suficiente para proteger `CompilerSession` quando o Worker tiver seu próprio listener concorrente;
- adicionar teste que combine duas notificações de alteração com uma solicitação de compilação.

A recomendação inicial é serializar as notificações que alteram o estado do contexto e manter a fila do Worker como segunda barreira. Depois de medir, as duas filas podem ser simplificadas, mas não devem ser removidas por suposição.

#### 3. Reinicialização e `errorHandler` do Language Client

O `LanguageClient` já possui eventos de início/parada e uma política configurável de erro/restart, incluindo limite de reinicializações em uma janela de tempo. Isso pode orientar o item 2:

- centralizar a política de restart do processo/servidor no `errorHandler` do client;
- manter no servidor uma política independente para o Worker interno;
- diferenciar restart do language server de restart do Compiler Worker;
- evitar dois backoffs competindo entre si;
- propagar ao usuário o estado final quando o limite for atingido.

Se o Worker é interno ao mesmo language server, a política mais simples é reiniciar primeiro o Worker e preservar a conexão LSP. Só reiniciar o language server quando o Worker não puder ser recriado ou quando houver suspeita de corrupção de estado global.

#### 4. Progresso de trabalho e resultados parciais

`vscode-languageserver` oferece `WorkDoneProgressReporter` e suporte a partial results. Eles podem melhorar compilação inicial, indexação e análise de workspace:

- usar work-done progress para informar início, fase, percentual aproximado e conclusão;
- usar partial results para símbolos, referências ou diagnósticos de workspace potencialmente grandes;
- não publicar partial results de uma geração antiga;
- incluir `contextGeneration` e `documentVersion` na decisão de commit;
- encerrar sempre o progress em `finally`, inclusive em cancelamento e erro.

Isso complementa, mas não substitui, a otimização de payload. Partial results reduzem latência percebida e permitem descarte incremental; não necessariamente reduzem bytes totais.

#### 5. Diagnóstico pull e invalidação

O protocolo atual possui requests de diagnóstico de documento e workspace, além de refresh. Esse modelo pode orientar a separação entre “documento mudou” e “compilação concluída”:

- o client solicita diagnósticos quando necessário, em vez de o servidor enviar sempre o conjunto completo;
- o servidor devolve `resultId` e pode informar que o resultado não mudou;
- alterações de arquivo invalidam somente os contextos afetados;
- a resposta deve ser descartada se o `resultId`, a geração ou a versão não corresponderem ao estado atual.

Antes de migrar, confirmar se o client atual e a versão mínima suportada do VS Code negociam diagnóstico pull. Manter `publishDiagnostics` como fallback durante a transição.

#### 6. Sincronização incremental de documentos

O suporte do client/server para sincronização incremental e versões de documento deve ser usado como fonte canônica para `documentVersion`. O Worker não deve receber apenas o texto atual sem a versão que o originou. O envelope de compilação deve transportar:

```ts
{
  documentUri: string;
  documentVersion: number;
  contextGeneration: number;
}
```

Isso reduz commits obsoletos e torna os testes de corrida determinísticos.

#### 7. Observabilidade integrada

O client possui trace/output channel e middleware de requests/notifications. Eles podem conectar a observabilidade LSP às métricas internas:

- gerar `traceId` no início da request LSP;
- propagá-lo ao servidor, Worker e resposta;
- usar middleware para medir latência de rede/protocolo;
- usar métricas próprias para medir fila e compilador;
- evitar registrar conteúdo-fonte e caminhos sensíveis no trace normal.

Assim, uma operação pode ser decomposta em `LSP wait -> server scheduling -> Worker queue -> compile -> serialization -> LSP response`.

### Recursos que não devem ser usados como substitutos

- `CancellationToken` do LSP não torna o compilador cancelável automaticamente;
- paralelismo do dispatch não garante segurança de uma sessão incremental compartilhada;
- restart automático do `LanguageClient` não limpa necessariamente `pendingCompiles` do servidor;
- partial results não substituem controle de versão e descarte de respostas obsoletas;
- `WorkDoneProgress` melhora feedback, mas não resolve backpressure nem vazamento de payload.

### Nova ordem recomendada

1. Confirmar as capacidades negociadas em `initialize` e a versão mínima suportada.
2. Configurar dispatch e handlers assíncronos de modo compatível com a política de estado do servidor.
3. Conectar `CancellationToken` LSP ao comando interno `cancel`.
4. Adicionar restart isolado do Worker, com `errorHandler` LSP como fallback.
5. Adicionar progress e partial results apenas para operações longas/grandes.
6. Avaliar diagnóstico pull com fallback para publicação tradicional.
7. Medir novamente fila, payload e latência ponta a ponta.

Referências específicas: [repositório oficial e histórico de releases](https://github.com/microsoft/vscode-languageserver-node), [documentação do `vscode-languageclient`](https://www.npmjs.com/package/vscode-languageclient) e [especificação LSP 3.18](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/).

## Plano detalhado de implementação e testes

### Objetivo do plano

Implementar as melhorias sem perder o cache incremental, sem alterar prematuramente o comportamento funcional do servidor e com possibilidade de rollback por etapa. A estratégia é primeiro tornar o fluxo determinístico e observável; depois conectar cancelamento, progresso e resultados parciais; por fim medir otimizações e paralelismo.

### Preparação e baseline

Antes de alterar o comportamento:

1. registrar o estado atual do branch e confirmar os comandos de build, lint e testes;
2. mapear os pontos de criação do Worker, listeners de `message`, `error` e `exit`, chamadas de `session.compile()` e commits de resultados;
3. documentar o ciclo atual de uma compilação: origem LSP, agendamento, execução, resposta e descarte;
4. criar um conjunto pequeno de fixtures: arquivo válido, arquivo com erro, dois contextos, documento alterado rapidamente e projeto grande;
5. medir baseline de p50/p95 para tempo total, tempo de compilação, tamanho da resposta e memória;
6. adicionar uma flag de diagnóstico para habilitar métricas detalhadas sem alterar a experiência normal.

**Saída:** baseline versionado, mapa de dependências e matriz de testes reproduzível.

### Etapa 1 — Contrato compartilhado e validação

Criar `packages/extension/src/server/compile/worker-protocol.ts` com:

- envelope versionado para `compile`, `cancel`, `ping` e respostas;
- `requestId`, `workerGeneration`, `contextGeneration` e `documentVersion`;
- estados de resposta: `ok`, `failed`, `cancelled`, `superseded` e `rejected`;
- códigos de erro estáveis;
- tipos serializáveis, sem `Promise`, `AbortSignal`, objetos de VS Code ou referências a classes;
- funções `parseWorkerMessage`, `parseWorkerResponse` e serialização de erros.

Implementar a validação na entrada do Worker e no servidor. A validação deve rejeitar mensagens desconhecidas, campos obrigatórios ausentes, tipos incorretos e payloads acima dos limites definidos.

**Testes:** tabela de mensagens válidas; campos ausentes; tipos incorretos; versão de protocolo incompatível; request duplicado; payload acima do limite; erro não-`Error`; stack sanitizado.

**Aceite:** servidor e Worker importam o mesmo contrato; nenhuma mensagem inválida chega a `session.compile()`; testes de contrato passam nos dois sentidos.

### Etapa 2 — Fila serializada do Worker

Criar uma abstração pequena, por exemplo `CompilerExecutionQueue`, em arquivo separado do listener. A fila deve:

- aceitar itens com `requestId`, contexto e função assíncrona;
- manter no máximo uma execução ativa por `CompilerSession`;
- permitir coalescer itens ainda não iniciados do mesmo contexto;
- marcar itens substituídos como `superseded`;
- continuar funcionando depois de uma exceção;
- executar limpeza em `finally`;
- expor tamanho atual, máximo observado e tempos de espera.

Alterar `compiler-worker.ts` para validar, enfileirar e responder usando essa abstração. O listener de `parentPort` não deve chamar `handleRequest()` diretamente sem passar pela fila.

**Testes unitários:** ordem FIFO; uma execução ativa; erro na primeira tarefa não bloqueia a segunda; coalescência; fechamento da fila; cancelamento antes da execução.

**Testes de integração:** duas mensagens simultâneas; duas mensagens do mesmo contexto; contextos diferentes ainda serializados na primeira versão; resposta com `requestId` correto.

**Aceite:** nunca há duas chamadas concorrentes a `session.compile()`; a segunda tarefa começa somente após a primeira terminar; nenhuma exceção deixa a fila travada.

### Etapa 3 — Ciclo de vida e recuperação do Worker

No servidor, criar um controlador de ciclo de vida, por exemplo `CompilerWorkerController`, responsável por:

- iniciar e registrar a geração do Worker;
- encaminhar mensagens;
- receber `error` e `exit`;
- resolver/rejeitar pendências uma única vez;
- limpar `pendingCompiles`, flags, timers e listeners;
- recriar o Worker com backoff e limite de tentativas;
- descartar respostas de gerações antigas;
- expor estado `starting`, `ready`, `failed`, `restarting` e `stopped`.

Separar restart do Worker interno de restart do `LanguageClient`. O primeiro deve ser tentado sem derrubar a conexão LSP; o segundo fica como fallback para falha estrutural do servidor.

**Testes:** `error`; `exit` não-zero; `exit` normal; Worker que falha ao iniciar; falha durante compilação; múltiplas falhas; backoff; limite de tentativas; resposta antiga após restart; retry manual; limpeza idempotente.

**Aceite:** nenhuma compilação fica pendente indefinidamente; o sistema não entra em loop de restart; flags retornam a estado consistente; o usuário recebe diagnóstico acionável.

### Etapa 4 — Integração com cancelamento LSP

No servidor LSP:

1. receber `CancellationToken` nos handlers que iniciam compilação;
2. cancelar imediatamente itens ainda na fila;
3. enviar `{ kind: 'cancel', requestId }` ao Worker para itens ativos;
4. manter checkpoints entre fases seguras do compilador;
5. tornar cancelamento idempotente;
6. não aplicar resultado cancelado, obsoleto ou de geração antiga;
7. garantir limpeza em `finally`.

O cancelamento deve distinguir `cancelled` de `superseded` e `timed_out`. Não encerrar o Worker como mecanismo normal de cancelamento.

**Testes:** cancelar antes da fila; cancelar durante compilação; cancelar duas vezes; cancelar após conclusão; cancelamento e restart simultâneos; resposta cancelada não altera diagnósticos nem cache; token já cancelado na entrada.

**Aceite:** o editor consegue cancelar requests longos; o compilador não fica em estado parcial; não há resposta duplicada nem vazamento de IDs cancelados.

### Etapa 5 — Versões, gerações e descarte de resultados

Centralizar a decisão de commit em uma função testável, por exemplo `isCurrentCompileResult(response, state)`. Ela deve verificar:

- `requestId` ainda esperado;
- `workerGeneration` atual;
- `contextGeneration` atual;
- `documentVersion` atual;
- request não cancelado ou substituído;
- contexto ainda existente.

Adicionar logs de motivo de descarte: `old-request`, `old-worker`, `old-context`, `old-document`, `cancelled` ou `unknown-context`.

**Testes:** respostas fora de ordem; resposta depois de nova edição; resposta depois de fechar/reabrir contexto; resposta de Worker antigo; resposta duplicada; resposta com versão futura; resultado parcial antigo.

**Aceite:** apenas o resultado correspondente ao estado atual pode alterar diagnósticos, símbolos ou semântica.

### Etapa 6 — Observabilidade, progresso e resultados parciais

Adicionar métricas com nomes estáveis:

- `compile.queue.wait_ms`;
- `compile.execution_ms`;
- `compile.end_to_end_ms`;
- `compile.request.bytes` e `compile.response.bytes`;
- `compile.queue.depth`;
- `compile.discarded.count`;
- `worker.restart.count`;
- `worker.failure.count`;
- `compile.outcome`.

Propagar `traceId` do request LSP até o Worker. Usar `WorkDoneProgress` somente em bootstrap, indexação e operações acima de um limiar. Usar partial results apenas para coleções grandes e com a mesma validação de geração/versão do resultado final.

**Testes:** métricas em sucesso, erro, cancelamento e descarte; progress termina em `finally`; partial result seguido de cancelamento; partial result de geração antiga; traceId preservado; logs não contêm conteúdo-fonte ou caminhos indevidos.

**Aceite:** é possível separar latência de fila, compilador e transporte; nenhuma operação deixa progress aberto.

### Etapa 7 — Diagnóstico pull e redução de payload

Implementar primeiro a medição por componente. Depois:

1. remover campos não consumidos;
2. limitar semântica aos arquivos solicitados;
3. reutilizar resultados por `resultId` ou hash quando compatível;
4. avaliar envio em lotes;
5. habilitar diagnóstico pull com fallback para `publishDiagnostics`;
6. comparar formatos compactos e compressão apenas se o baseline justificar.

**Testes:** resposta vazia; resposta inalterada por `resultId`; arquivo alterado parcialmente; payload grande; fallback para client sem capacidade; partial result incompleto; compressão/descompressão com corrupção detectada.

**Aceite:** redução de payload e/ou latência no cenário que motivou a mudança, sem aumento inaceitável de CPU ou memória.

### Etapa 8 — Paralelismo controlado por contexto

Somente após as etapas anteriores:

- criar uma sessão independente por contexto;
- limitar concorrência por configuração/feature flag;
- adicionar limite de memória e desligamento automático em pressão;
- executar benchmark com um, dois e vários contextos;
- comparar contra a fila única;
- manter rollback simples para serialização global.

**Testes:** isolamento de cache; contextos concorrentes; criação e remoção durante execução; falha de uma sessão sem afetar outra; limite de concorrência; pressão de memória; restart individual; respostas cruzadas.

**Aceite:** ganho líquido de p95 ou throughput, sem regressão de consistência, memória, estabilidade ou experiência no host da extensão.

## Matriz de testes de regressão

| Área | Casos obrigatórios | Resultado esperado |
| --- | --- | --- |
| Protocolo | válido, inválido, versão incompatível | rejeição segura e erro classificável |
| Concorrência | requests simultâneos e fora de ordem | sessão protegida e commit atual |
| Ciclo de vida | erro, exit, restart, retry | pendências concluídas e estado consistente |
| Cancelamento | fila, execução, duplicado, tardio | cancelamento idempotente |
| Versões | documento, contexto e Worker antigos | resposta descartada com motivo |
| Payload | pequeno, grande, parcial, vazio | limites e consumidores preservados |
| LSP | capabilities, token, progress, pull | fallback compatível |
| Observabilidade | sucesso, erro, descarte, restart | métricas e trace completos |
| Performance | p50/p95, memória, throughput | decisão baseada em baseline |

## Estratégia de rollout

1. liberar contrato e métricas sem alteração funcional;
2. ativar fila serializada por padrão;
3. ativar recuperação do Worker;
4. ativar cancelamento apenas para operações compatíveis;
5. habilitar progress e partial results por operação;
6. testar diagnóstico pull atrás de feature flag;
7. avaliar paralelismo em benchmark e liberar somente se superar a fila única.

Cada etapa deve ter flag de desligamento, log de ativação e métrica de erro. A remoção das flags só deve ocorrer depois de uma janela de uso sem regressões.

## Critérios finais de conclusão

- build, lint e testes unitários passam;
- testes de integração do Worker passam de forma repetida e sem dependência de timing;
- não existe chamada concorrente à mesma sessão sem isolamento comprovado;
- falhas, cancelamentos e restarts não deixam pendências presas;
- respostas antigas nunca alteram o estado atual;
- métricas permitem atribuir latência a LSP, agendamento, Worker, compilador ou transporte;
- toda otimização de payload ou paralelismo possui baseline, benchmark e rollback;
- a extensão mantém comportamento compatível em ambientes local, remoto e web quando suportados.
