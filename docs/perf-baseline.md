# Perf Baseline (Boot + Digitação)

## Objetivo
Estabelecer uma linha de base para:
- `T_boot`: tempo de boot da extensão (do activate até o primeiro ciclo completo do contexto).
- `T_type` (P95): latência ao digitar (tempo entre edição e commit final de diagnostics no arquivo ativo).

## Cenário Padrão
- Workspace com contexto `HR`.
- Arquivo ativo: `HR858`.
- Ordered files do contexto HR (ex.: `HR850`, `HR851`, `HR853`, `HR858`, `HR859`, `HR860`).
- `includeSubdirectories = false`.
- System: `HCM`.

## Como Medir `T_boot`
1. Abra o workspace com o contexto HR configurado.
2. Limpe o OutputChannel “LSP”.
3. Ative logs (opcional):
   - `lsp.metrics.enabled = true`
   - `lsp.debug.logs = true`
4. Recarregue a janela do VSCode.
5. Meça do início do boot até o primeiro log de compile concluído do contexto (ex.: `compile: done ...`).

## Como Medir `T_type` (P95)
1. Com `HR858` aberto, faça uma sequência de edições simples (ex.: inserir e remover caracteres no fim da linha) por 30s.
2. Registre o tempo entre cada `didChange` e o commit final de diagnostics (via logs).
3. Calcule o P95.

## Coleta auxiliar (novo endpoint de performance)
- Use o request interno `lsp/perf/get` para inspecionar contadores por contexto:
  - `compileRequested`
  - `compileStarted`
  - `compileCommitted`
  - `compileStaleDropped`
  - `compilePendingQueued`
  - `totalQueueWaitMs`
  - `totalCompileRoundtripMs`
  - `totalWorkerPayloadBytes`
- Objetivo: comparar antes/depois por cenário de digitação e boot.

## Coleta automática em `.jsonl` (atual)
- O arquivo `lsp-metrics-*.jsonl` agora registra snapshots automáticos com `kind: "perf.snapshot"`.
- Cada snapshot contém os mesmos contadores principais de `lsp/perf/get`.
- Em `lsp-observability-*.jsonl`, durante digitação, existe o log:
  - `typing.latency: ... latencyMs=<n>`
- Em paralelo, o schema estruturado registra `message="metric.typing.latency"` com `data.value=<n>`.
- Use esse valor para validar a latência percebida entre `didChange` e o commit de diagnostics.

## Decisões recentes (2026-02-18)
- Digitação usa ciclo rápido com semântica limitada por budget (`semanticBudgetFiles`) para reduzir custo por tecla.
- Após digitação, existe follow-up semântico agendado e um segundo ciclo de drain para completar análise integral.
- Pós-format não usa caminho sem semântica: executa ciclo semântico completo para evitar inconsistência de highlight.
- Preempção de compile em execução foi limitada por throttle/janela mínima para evitar tempestade de fila.
- Cache de semantic tokens não deve ser invalidado por ciclos sem payload semântico novo.
- Métrica operacional principal para UX de digitação: `typing.latency` (observability) + `compilePendingQueued` (perf.snapshot).
- A leitura preferencial passa a ser o evento estruturado `metric.typing.latency`; o log textual permanece como compatibilidade operacional.

## Leituras recomendadas no debug
- Se `typing.latency` P95 > 2000ms, investigar:
  - `compilePendingQueued` crescendo continuamente;
  - muitos `preempt running` seguidos;
  - ciclos com `diagnosticsCount=0` após `didChange`.
- Se highlight semântico demorar/intermitir, investigar:
  - `semanticFilesAnalyzed=0` em sequência sem follow-up semântico posterior;
  - ausência de refresh após ciclo com `includeSemantics=true`.

## Baseline Atual
- Data: 2026-02-07
- Ambiente:
  - OS: (nao informado no log)
  - CPU: (nao informado no log)
  - Memoria: (nao informado no log)
  - VSCode: (nao informado no log)
  - Node: (nao informado no log)
- `T_boot`: 69041.13 ms (~69.04 s)
- `T_type` (P95): 238.48 ms (janela de digitacao estavel, filesParsed=0)
- `T_type` (P95, sem filtrar warm-up): 5167.47 ms
- Observações:
  - Fonte principal: `metrica.json` (coleta em 2026-02-07T14:45:15.045Z).
  - Amostras no arquivo:
    - total de ciclos: 11
    - 1 ciclo de boot inicial (cold start)
    - 7 ciclos de aquecimento/estabilizacao (filesParsed=1)
    - 3 ciclos estaveis de digitacao (filesParsed=0), usados para P95 de digitacao real.
  - Arquivos auxiliares: `m8.log` e `m8.json` com spans de `diagnostics.ignoreIds`.


## Perf update (2026-02-19) — pós M2/M3/M4/M5 (sessão 2026-02-19T14:30Z)

**Contexto:** `Ponto` (filesDiscovered=46, filesCount=11, openDocsCount=1)

### Diagnostics (phase=diagnostics)
- p50: **757 ms**
- p95: **1728 ms**
- p99: **2950 ms**

### Parse/Semantic
- parseMs p50: **63 ms**
- parseMs p95: **1252 ms**
- semanticMs mean: **64 ms**
- semanticMs p95: **258 ms**

### Observações
- `typing.latency` não apareceu neste lote de observability (provável logging desativado ou outro formato). Usar sessão dedicada para medir `didChange -> diagnostics commit`.
- Dirty-set deixou de explodir em digitação (esperado após M2). O ganho principal vem de reduzir fanout (dirtyDirectDependentCount próximo de 1 durante typing).


## Perf update (2026-02-19) — modo Pull ON (sessão 2026-02-19T19:58Z)

**Ambiente (meta do log)**
- VSCode: **1.109.4**
- Extension: **2.0.0** (buildDate: 2026-02-19T19:57:46.971Z)

**Modo:** `pull-only` (`textDocument/diagnostic`)

**Contexto:** `Ponto`

### Pull diagnostics

**Cache correctness note:** pull diagnostics responses are cached by VSCode using `previousResultId`. Our server-side `resultId` includes a **context dirty stamp** so diagnostics update correctly when the context is recompiled due to changes in *other* files (even when the active document version does not change).
- Na maior parte das requests, o servidor retorna `kind=unchanged` com `durationMs` **0–1ms** (resultId/caching funcionando).

### Compile roundtrip (perf.snapshot)
- No final da sessão:
  - `compileRequested`: **780**
  - `compileCommitted`: **374**
  - `totalCompileRoundtripMs / compileCommitted`: **~522ms** (média acumulada)

### Observações
- Diagnósticos ficaram corretos desde o primeiro open (sem “ghost diagnostics”).
- Digitação permanece responsiva; em `pull`, a UX depende de refresh debounced (`workspace/diagnostic/refresh`).

## Perf update (2026-02-21) — migração pull-only concluída

### Comparativo before/after
- Before: sessão documentada de 2026-02-19 (pull ON com modo transitório).
- After: código em pull-only (sem rollout por `lsp.diagnostics.mode`), com regressão local completa verde (`npm test`).

### Resultado
- Sem regressão funcional detectada na suíte local.
- Sinais de observabilidade de pull mantidos (`pullDiagnostics.request`, `pullDiagnostics.response`, `pullDiagnostics.refresh`).
- Campos de métricas pull preservados para monitorar latência/estabilidade após a remoção do legado.

## Perf update (2026-02-21) — baseline real em VSCode (logs Itaipu)

Arquivos analisados:
- `/home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-observability-2026-02-21T14-47-27-099Z.jsonl`
- `/home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-metrics-2026-02-21T14-47-27-099Z.jsonl`

Pull diagnostics (observability/metrics):
- requests/responses: **143 / 143**
- `kind=unchanged`: **121** (**84.62%**)
- `kind=full`: **22** (**15.38%**)
- `kind=error`: **0**
- `cacheHit=true`: **81.12%**
- `ensureScheduled=true`: **17.48%**
- `contextMatched=false`: **1.40%**
- source:
  - `context-cache`: **141**
  - `boot-empty`: **2**

Latência `pullDiagnostics.response`:
- p50: **0 ms**
- p95: **1 ms**
- p99: **4 ms**
- max: **6 ms**

Distribuição por contexto:
- `Ponto`: 141 respostas, `unchangedRatio=84.40%`, `p95=1ms`
- `SingleFile/Fallback`: 2 respostas, `unchangedRatio=100%`, `p95=0ms`

Perf snapshot (último registro da sessão):
- `compileRequested`: **99**
- `compileStarted`: **78**
- `compileCommitted`: **38**
- `compileStaleDropped`: **2**
- `compileErrored`: **0**
- `compilePendingQueued`: **40**
- `totalQueueWaitMs`: **7361.93**
- `totalCompileRoundtripMs`: **52791.48**
- `totalWorkerPayloadBytes`: **19138572**

Leitura operacional:
- baseline de pull-only está estável e responsivo (p95=1ms, erro=0, alto `unchanged ratio`);
- manter monitoramento contínuo para `ensureScheduled=true` e para tendência de fila (`compilePendingQueued`).

## Perf update (2026-02-21) — compiler professionalization (Fase 0/2)

Cenário reproduzível (local):
- build: `npm -w @lsp/compiler run build`
- benchmark padrão: `node scripts/bench-hr.mjs`
- benchmark alternativo com dados do repositório: `rootDir=exemplos/HR`, `filePattern=HR*.txt`, `includeSemantics=false`

Observação:
- o benchmark padrão (`scripts/bench-hr.mjs`) estava com import relativo inválido e foi corrigido para `../packages/compiler/dist/index.js`.
- no ambiente atual, `/mnt/data/hr_examples/HR` não possui arquivos (`filesDiscovered=0`), então o baseline útil foi coletado em `exemplos/HR`.

Medição em `exemplos/HR`:
- `compileContext` cold:
  - `filesDiscovered=45`
  - `filesRead=45`
  - `filesParsed=45`
  - `parseMs=4269.1`
  - `semanticMs=523.8`


## Perf update (2026-03-02) — tuning incremental + baseline SIA (sessão 2026-03-02T20:03Z)

Arquivos analisados:
- `lsp-observability-2026-03-02T20-03-33-223Z.jsonl`
- `lsp-metrics-2026-03-02T20-03-33-224Z.jsonl`

**Contexto:** `SIA` (filesCount=189)

### Pull diagnostics (phase=pullDiagnostics)
- p50: **1 ms**
- p95: **2 ms**
- max: **6 ms**
- cacheHit: **~99.57%**

## Perf update (2026-03-18) — comparação com a coleta de 2026-03-17T23:02Z

Arquivos analisados:
- `/home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-observability-2026-03-18T00-33-44-891Z.jsonl`
- `/home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-metrics-2026-03-18T00-33-44-891Z.jsonl`

Baseline de comparação imediata:
- sessão anterior analisada: `2026-03-17T23:02:22Z`

### Pull diagnostics

Sessão de 2026-03-18:
- requests/responses: **136 / 136**
- `kind=unchanged`: **76** (**55.88%**)
- `kind=full`: **60** (**44.12%**)
- `cacheHit=true`: **64.71%**
- `ensureScheduled=true`: **72.06%**
- `contextMatched=false`: **5.88%**

Comparativo com 2026-03-17T23:02Z:
- `ensureScheduledTrue`: **0.3252 -> 0.7206** piorou
- `cacheHitTrue`: **0.8906 -> 0.6471** piorou
- `fallback-compile`: **36/329 -> 48/136** piorou proporcionalmente
- `context-projected`: **101/329 -> 5/136** caiu fortemente

### Causalidade de pull

Distribuição nova:
- `pullEnsureScheduledReason`
  - `dirty_snapshot`: **59**
  - `compile_inflight`: **38**
  - `unknown`: **38**
  - `context_projection_only`: **1**
- `pullSourceOfTruth`
  - `prefix_snapshot`: **123**
  - `fresh_compile`: **8**
  - `stable_snapshot`: **4**
  - `context_projection`: **1**
- `pullAuthorityLevel`
  - `projected`: **84**
  - `non_authoritative`: **40**
  - `authoritative`: **12**

Leitura:
- o centro do problema voltou a ser `compile_inflight` + resultado prefixado/não autoritativo, não mais apenas `context projection`

### Diagnostics runtime

Na sessão de 2026-03-18:
- ciclos `phase=diagnostics`: **99**
- triggers:
  - `pullDiagnosticsGlobalFollowup`: **98**
  - `didOpenDeferredAfterRefresh`: **1**

Subfases:
- `queueWaitMs`: `p95 ~5.73ms`, `p99 ~148.82ms`
- `parseMs`: `p95 ~40.10ms`, `p99 ~850.69ms`
- `analyzeMs`: `p95 ~104.66ms`, `p99 ~620.01ms`
- `indexLookupMs`: `p95 ~341.48ms`, `p99 ~538.48ms`
- `publishPrepMs`: `p95 ~24.43ms`, `p99 ~72.21ms`

Comparativo com 2026-03-17T23:02Z:
- `queueWaitMs p95`: melhorou muito (`~380ms -> ~5.7ms`)
- `indexLookupMs p95`: piorou (`~226ms -> ~341ms`)
- `analyzeMs p95`: piorou fortemente (`~8ms -> ~105ms`)
- `pullDiagnosticsGlobalFollowup` continua dominante (`104/125 -> 98/99`)

### Followups autoritativos

Outcomes explícitos:
- `didOpenZero`: **9**
- `didOpenZeroRetry`: **2**
- `publicApiZero`: **1**

Contagem ampla do span:
- `didOpenZero`: **50**
- `didOpenZeroRetry`: **11**
- `persistedZero`: **3**

### Observação importante

Não houve eventos `metric.typing.latency` nesta coleta. Portanto, ela não deve ser usada para concluir melhora ou piora da UX de digitação.

### Próximo foco recomendado

O próximo patch deve atacar prioritariamente:

1. `compile_inflight -> fallback-compile -> pullDiagnosticsGlobalFollowup`
2. followups `didOpenZero` / `didOpenZeroRetry`
3. perda de reaproveitamento via `context-projected`

### Compile diagnostics (phase=diagnostics)

Cold start (1º ciclo / noPrevCache):
- durationMs: **~1496 ms**
- filesRead: **188**
- semanticFilesAnalyzed: **189**

Warm / incremental (29 ciclos):
- durationMs p50: **~369 ms**
- durationMs p95: **~422 ms**
- semanticMs p50: **~46 ms**
- semanticMs p95: **~80 ms**
- semanticFilesAnalyzed p50: **2** (p95: **2**, max: **4**)
- semanticDirtyCount p50: **2** (p95: **2**, max: **4**)

Leitura operacional:
- incremental semântico está “local” (dirty pequeno), mesmo com mismatch open/disk;
- cold start é o único pico relevante.


## Otimização de cold start (opções implementadas)

### Opção 1 — cache persistente de texto (consolidado)
Objetivo: reduzir o custo de cold start evitando centenas de `fs.readFile` pequenos quando o disco não mudou.

Como funciona:
- o compiler persiste um cache consolidado em `ROOT/.lsp-cache/v2-textcache-<hash>.bin` (best-effort);
- no cold start, se `mtime/size` batem, o texto é carregado do cache consolidado (um único read grande) em vez de ler arquivo por arquivo.

Notas:
- o cache é debounced (janela de 5s) e **não** escreve durante digitação (`changedFilePaths` presente);
- é best-effort: falhas de leitura/escrita não quebram a compilação.

### Opção 2 — paralelizar IO (stat/read) com limite
- `runWithConcurrency` usa `LSP_IO_CONCURRENCY` (default **32**, clamp 4..64);
- ajuste recomendado:
  - SSD: 32
  - HDD/rede: 8–16

Validação:
- comparar `filesRead` e `durationMs` no ciclo cold com/sem cache;
- garantir que warm mantém `semanticDirtyCount` baixo e `pullDiagnostics` p95 estável.

## Perf update (2026-03-07) — anti-flicker `TR705` no pull diagnostics

Logs analisados:
- `/home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-observability-2026-03-07T00-18-46-396Z.jsonl`
- `/home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-metrics-2026-03-07T00-18-46-396Z.jsonl`

Evidência da regressão:
- `TR/TR705 - WEB - Pesquisa Colaboradores.txt` apresentou no mesmo `dirtyStamp=3`:
  - `00:19:12.220Z` `count=13` (`context-projected`)
  - `00:19:12.978Z` `count=0` (`context-projected`)
- A partir desse ponto, `resultId=4:1505` foi reaproveitado (`unchanged`) e os 13 diagnósticos não voltaram de forma estável sem nova oscilação.

Correção aplicada no servidor:
- guarda de clear para `context-projected=0` transitório agora baseada em `dirtyStamp` + snapshot não-vazio do mesmo contexto/URI (`!isAuthoritative`), sem timeout temporal.

Validação local executada:
- `npm -w lsp run test:unit -- test/diagnostics-pull-readiness.test.ts test/semantic-flicker-reduction.integration.test.ts` (11 testes, 11 ok).

## Perf update (2026-03-07 01:16Z) — primeira apresentação ainda lenta

Logs analisados:
- `/home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-metrics-2026-03-07T01-16-30-496Z.jsonl`
- `/home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-observability-2026-03-07T01-16-30-496Z.jsonl`

Resumo de latência:
- `pullDiagnostics`: `p50=0ms`, `p95=1ms`, `p99=2ms`, `max=2ms`.
- `diagnostics`: `p50 ~232ms`, `p95 ~1774ms`, `max ~2276ms`.
- `didOpen -> primeiro pull count>0` (14 amostras): `p50 ~1182ms`, `p95 ~2010ms`, `max ~2484ms`.

Leitura operacional:
- O pull em si está estável e rápido.
- O atraso percebido de primeira apresentação permanece concentrado em `didOpenContextBootstrap` com compile semântico full.

Top offenders da sessão:
- `Ponto | didOpenContextBootstrap | includeSemantics=true`:
  - `duration ~1499–2276ms`
  - `workerResultBytes ~38MB`
  - `workerResultSemanticsBytes ~37MB`
- `TR | didOpenContextBootstrap | includeSemantics=true`:
  - `duration ~2134ms`
  - `workerResultBytes ~25MB`
  - `workerResultSemanticsBytes ~24MB`

Observação importante:
- Os patches de payload já reduziram o `pullDiagnosticsGlobalFollowup` (semântica no compile mantida, payload semântico removido), mas o bootstrap full continua sendo o principal custo de first paint de diagnostics.
  - `totalMs=5021.9`
- `session.compile` cold (`forceRefreshFiles=true`):
  - `filesDiscovered=45`
  - `filesRead=45`
  - `filesParsed=45`
  - `parseMs=5114.5`
  - `semanticMs=0.0`
  - `totalMs=5233.5`
- `session.compile` warm:
  - `filesDiscovered=45`
  - `filesRead=0`
  - `filesParsed=0`
  - `parseMs=0.9`
  - `semanticMs=0.0`
  - `totalMs=183.2`

Leitura operacional:
- ciclo warm manteve reutilização total de I/O e parse (`filesRead=0`, `filesParsed=0`);
- threshold operacional desta milestone segue: regressão >10% exige investigação.

## Perf update (2026-02-21) — fechamento Fase 0/6 (observabilidade + gate)

Evidência de observabilidade validada:
- relatório consolidado:
  - `node scripts/pull-metrics-report.mjs --observability /home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-observability-2026-02-21T14-47-27-099Z.jsonl --metrics /home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-metrics-2026-02-21T14-47-27-099Z.jsonl --out reports/pull-metrics-report-2026-02-21.json`
- gate:
  - `node scripts/pull-observability-gate.mjs --observability /home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-observability-2026-02-21T14-47-27-099Z.jsonl --metrics /home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-metrics-2026-02-21T14-47-27-099Z.jsonl`

Resumo validado:
- `pullEntries=143`
- `unchangedRatio=84.62%`
- `p95=1ms`
- `ensureScheduledRatio=17.48%`
- `contextMissRatio=1.40%`
- presença de `perf.snapshot`: confirmada

Gate de performance do compiler:
- benchmark padronizado:
  - `node scripts/bench-hr.mjs --rootDir exemplos/HR --filePattern HR*.txt --includeSubdirectories false --includeSemantics false --json-out reports/compiler-bench-current.json`
- gate:
  - `node scripts/compiler-perf-gate.mjs --baseline reports/compiler-bench-baseline.json --current reports/compiler-bench-current.json --max-regression-pct 10 --max-warm-total-ms 400`

Resultado do gate:
- `OK`
- `sessionWarm.totalMs=153.56ms`
- `sessionWarm.parseMs=0.93ms`
- regressão vs baseline: negativa (melhora), dentro do threshold.

## Perf update (2026-02-21 21:41) — pós modificações (logs anexados)

Logs analisados:
- `/home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-metrics-2026-02-21T21-41-07-797Z.jsonl`
- `/home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-observability-2026-02-21T21-41-07-797Z.jsonl`

Relatório consolidado:
- `reports/pull-metrics-report-2026-02-21T21-41-07-797Z.json`

Resumo da sessão:
- `responses=180`
- `unchanged=148` (`82.22%`)

## Perf update (2026-02-21 23:18) — baseline oficial Fase 4

Comando executado:
- `npm run bench:compiler:hr`
- `npm run perf:gate:compiler`

Metodologia usada no benchmark (`scripts/bench-hr.mjs`):
- `benchmarkRuns=3` (3 execuções independentes)
- `warmRuns=5` por execução
- seleção por mediana de `sessionWarm.totalMs` entre candidatos

Baseline oficial atualizado:
- arquivo: `reports/compiler-bench-baseline.json`
- `sessionWarm.totalMs`: **84.87 ms**
- `sessionWarm.parseMs`: **0.43 ms**
- `filesRead=0`, `filesParsed=0` (warm íntegro)

Resultado do gate:
- `compiler-perf-gate`: **OK** em 3/3 execuções consecutivas

Rotina de atualização de baseline (quando e por quem):
- Quando:
  - mudanças em `packages/compiler/src` com potencial impacto de runtime
  - refatorações de cache/incrementalidade/descoberta de arquivos
  - atualização planejada de referência de performance da release
- Critério mínimo para atualizar:
  - `npm run bench:compiler:hr` + `npm run perf:gate:compiler`
  - alvo: 3 execuções consecutivas com gate **OK**
  - se houver oscilação de ambiente, registrar série de tentativas e usar baseline por mediana (`warmRuns=5`, `benchmarkRuns=3`)
  - baseline novo salvo com `warmRuns=5` e `benchmarkRuns=3`
- Por quem:
  - autor do PR que altera performance do compiler
  - revisão final de mantenedor responsável por qualidade/perf do compiler
- `full=32` (`17.78%`)
- `error=0`
- `cacheHit=true`: `89.44%`
- `ensureScheduled=true`: `9.44%`
- `contextMatched=false`: `1.11%`
- latência pull:
  - `p50=0ms`
  - `p95=1ms`
  - `p99=5ms`
  - `max=8ms`

Comparativo com baseline anterior da mesma data (sessão 14:47):
- `unchangedRatio`: `84.62% -> 82.22%` (`-2.40 pp`)
- `cacheHit`: `81.12% -> 89.44%` (`+8.32 pp`)
- `ensureScheduled`: `17.48% -> 9.44%` (`-8.04 pp`)
- `contextMiss`: `1.40% -> 1.11%` (`-0.29 pp`)
- `p95`: `1ms -> 1ms` (estável)
- `p99`: `4ms -> 5ms` (`+1ms`)
- `max`: `6ms -> 8ms` (`+2ms`)

Perf snapshot (média por compile committed):
- baseline anterior: `~1389.25ms`
- sessão atual: `~1366.55ms`
- delta: `-22.70ms` (melhora)

Leitura operacional:
- desempenho geral de pull continua estável e responsivo;
- houve melhora clara em cache hit e redução de `ensureScheduled`;
- houve leve piora na cauda (`p99`/`max`) e no `unchangedRatio`, porém sem impacto no `p95` e sem erros.

## Perf update (2026-02-25 23:51) - validacao de estabilidade apos correcao de diagnosticos

Logs analisados:
- `/home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-metrics-2026-02-25T23-51-35-582Z.jsonl`
- `/home/llutti/projetos/itaipu/lsp/.lsp-debug/lsp-observability-2026-02-25T23-51-35-582Z.jsonl`

Relatorios gerados:
- `reports/pull-metrics-report-2026-02-25T23-51-35-582Z.json`
- `reports/pull-compare-2026-02-25-vs-2026-02-21.json`

Gate:
- `node scripts/pull-observability-gate.mjs ...`: `OK`

Resumo da sessao:
- `responses=274`
- `unchanged=195` (`71.17%`)
- `full=79` (`28.83%`)
- `error=0`
- `cacheHit=true`: `97.81%`
- `ensureScheduled=true`: `0.00%`
- `contextMatched=false`: `2.19%`
- latencia pull:
  - `p50=0ms`
  - `p95=3ms`
  - `p99=186ms`
  - `max=789ms`

Comparativo com baseline registrado (2026-02-21 14:47):
- `unchangedRatio`: `84.62% -> 71.17%` (`-13.45 pp`)
- `cacheHit`: `81.12% -> 97.81%` (`+16.69 pp`)
- `ensureScheduled`: `17.48% -> 0.00%` (`-17.48 pp`)
- `contextMiss`: `1.40% -> 2.19%` (`+0.79 pp`)
- `p95`: `1ms -> 3ms` (`+2ms`)
- `p99`: `4ms -> 186ms` (`+182ms`)
- `max`: `6ms -> 789ms` (`+783ms`)

Leitura operacional:
- houve melhora no caminho de agendamento/controle (`ensureScheduled` zerado) e maior reaproveitamento de cache (`cacheHit`);
- a regressao de cauda (`p99`/`max`) indica custo alto em parte do cold start;
- funcionalmente, o comportamento reportado de "limpar diagnosticos e so estabilizar apos editar" nao se repetiu nesta sessao.

## Perf update (2026-02-26) — estabilização de pull diagnostics + cache de hover (LRU)

Logs analisados (sessão):
- `lsp-metrics-2026-02-26T17-32-24-009Z.jsonl`
- `lsp-observability-2026-02-26T17-32-24-009Z.jsonl`

### Diagnósticos (phase=diagnostics)
Distribuição observada:
- p50: **~655ms**
- p95: **~915ms**
- p99: **~1218ms**
- max: **~1487ms**

Comparativo com baseline 2026-02-19 (p50 757ms / p95 1728ms / p99 2950ms):
- p50: **-102ms**
- p95: **-813ms**
- p99: **-1732ms**

### Pull diagnostics (phase=pullDiagnostics)
- volume: **334** requests
- `unchanged`: **229**
- `full`: **105**
- latência: p50 **0ms**, p99 **~121ms**, max **787ms**

Decisões aplicadas:
- evitar “aparece e some”: resultados parciais/prefix não podem limpar snapshot publicado
- **non-blocking** com budget (default 80ms) e follow-up full com semântica em background
- agendamento de follow-up controlado por **dirty stamp** do contexto (evita reprocessamento contínuo sem mudanças)

### Hover cache (LRU)
- limite padrão: **2000** (`LSP_HOVER_CACHE_MAX`)
- hit-rate observado no run: **~41%** (35 hits / 51 misses)
- tamanho máximo observado: **42**
- evictions: **0** (limite não foi exercitado neste run)

## Perf update (2026-03-04) — pós Fase 1 (Dedupe/Coalescing)

**Sessão:** `2026-03-04T10:11:54.613Z`  
**Extensão:** `2.0.0` (build `2026-03-04T10:08:21.962Z`)  
**VSCode:** `1.109.5`

### Snapshots automáticos (`perf.snapshot`) — contadores finais por contexto

| Context | compileRequested | compileStarted | compileCommitted | compilePendingQueued | totalQueueWaitMs | totalCompileRoundtripMs | totalWorkerPayloadBytes |
|---|---|---|---|---|---|---|---|
| SIA | 6 | 4 | 3 | 1 | 985 | 1608 | 29769 |
| Ponto | 74 | 41 | 40 | 1 | 13097 | 22367 | 10565677 |
| TR | 10 | 7 | 7 | 0 | 2326 | 3950 | 2831725 |


### Latência de digitação (`typing.latency` via observability)

> Estes valores incluem *warm-up* e variam conforme a interação; para comparar releases, use sempre o mesmo roteiro e recorte uma janela estável (ex.: últimos 20–30s de digitação contínua).

| Context | n | p50_ms | p95_ms | min_ms | max_ms |
|---|---|---|---|---|---|
| Ponto | 26 | 904.5 | 3242.0 | 299 | 3349 |
| TR | 3 | 1873.0 | 2917.9 | 842 | 3034 |


### Observações
- Nesta sessão, o formato `.jsonl` continha `perf.snapshot` (contadores) e logs de `typing.latency`, mas não incluiu uma série completa de spans por *phase* (p50/p95 de `phase=diagnostics`) para calcular diretamente `T_boot`/`T_type` como no baseline antigo.
- A conclusão operacional da **Fase 1** deve ser validada principalmente por:
  - queda de `compileCommitted` durante o *startup burst* por contexto;
  - redução de rajadas redundantes causadas por `semanticTokens` quando há full compile queued/in-flight;
  - `typing.latency` em janela estável (comparação antes/depois).


## Perf update (2026-03-06) — Fase 2 / hotfixes de consistência do pull + arbitragem residual

Logs analisados (sessões):
- `lsp-metrics-2026-03-06T18-55-10-949Z.jsonl`
- `lsp-observability-2026-03-06T18-55-10-949Z.jsonl`
- `lsp-metrics-2026-03-06T19-11-49-466Z.jsonl`
- `lsp-observability-2026-03-06T19-11-49-466Z.jsonl`
- `lsp-metrics-2026-03-06T19-27-34-757Z.jsonl`
- `lsp-observability-2026-03-06T19-27-34-757Z.jsonl`
- `lsp-metrics-2026-03-06T19-41-55-683Z.jsonl`
- `lsp-observability-2026-03-06T19-41-55-683Z.jsonl`

### Resumo executivo
- A regressão funcional principal de **diagnostics não apresentados** foi mitigada.
- O padrão residual de `public-api=0` seguido por `context-projected>0` caiu de vários casos espalhados para **3 arquivos residuais** na sessão mais recente, todos concentrados em `SIA\\motivo`:
  - `56-motivo-dominio-paginado.txt`
  - `60-motivo-excluir.txt`
  - `61-motivo-alterar.txt`
- Muitos `count=0` observados nos logs mais recentes são **legítimos** (arquivos efetivamente sem diagnóstico).
- O compiler incremental está saudável; o gargalo remanescente continua em **`overheadMs` fora do compiler**.

### Reuso semântico (warm)
Última sessão útil (`2026-03-06T19:41:55.683Z`):
- `TR`:
  - `semanticFilesAnalyzed` p50: **1**
  - `semanticFilesReused` p50: **29**
- `SIA`:
  - `semanticFilesAnalyzed` p50: **1**
  - `semanticFilesReused` p50: **18**

Leitura:
- a meta de reuso (`semanticFilesAnalyzed <= 3` na maioria das execuções warm) está **atendida** nas sessões recentes;
- `semanticFilesReused` permanece dominante.

### Diagnostics duration (warm)
Última sessão útil (`2026-03-06T19:41:55.683Z`):

| Contexto | n | p50 durationMs | p95 durationMs | p50 compilerTotalMs | p50 overheadMs |
|---|---:|---:|---:|---:|---:|
| `TR` | 9 | **544.3 ms** | **949.4 ms** | **84.4 ms** | **459.3 ms** |
| `SIA` | 17 | **491.2 ms** | **719.0 ms** | **135.1 ms** | **336.3 ms** |

Comparativo resumido com a primeira sessão já pós-hotfix funcional (`2026-03-06T18:55:10.949Z`):
- `TR`: p50 **597.5 -> 544.3 ms** (`-53.2 ms`)
- `SIA`: p50 **547.2 -> 491.2 ms** (`-56.0 ms`)

Leitura:
- houve **ganho mensurável** em warm após os hotfixes de consistência/arbitragem do pull;
- porém a meta da Fase 2 (**p50 <= 350 ms / p95 <= 550–600 ms**) **ainda não foi atingida**;
- `overheadMs` continua maior que `compilerTotalMs`, confirmando que o próximo foco deve permanecer no server/pull path, e não no compiler incremental.

### Estado funcional do pull diagnostics
- Hotfixes de 2026-03-06 reduziram fortemente os falsos `count=0` logo após `didOpen`.
- Sessão mais recente:
  - **15 arquivos** analisados via pull;
  - **5 arquivos** consistentemente em `count=0` sem indício de oscilação indevida (comportamento legítimo);
  - **3 arquivos** ainda apresentando o padrão residual `0 -> >0` pouco depois.

### Conclusão operacional
- **Melhora real** em corretude e em latência warm.
- **Fase 2 ainda não concluída**: falta atacar o `overheadMs` e remover o resíduo localizado de arbitragem no `public-api`.

## Perf update (2026-03-08) — patch 15 (sem nova coleta consolidada)

Mudanças aplicadas no server/pull path:
- janela dedicada de commit full recente para arbitragem de `public-api=0`:
  - `PULL_DIAGNOSTICS_CONTEXT_RECENT_COMMIT_MS` (default `650ms`);
- endurecimento do fallback direto (`computeDiagnosticsDirectlyForPull`) para evitar recomputação redundante em zeros legítimos no warm path.

Validação local executada:
- `npm -w lsp run test:unit -- test/diagnostics-pull-readiness.test.ts test/diagnostics-pull-contract.test.ts test/semantic-flicker-reduction.integration.test.ts` (passou).

Pendência para baseline numérico:
- coletar nova sessão `.jsonl` e comparar:
  - transições residuais `public-api=0 -> context-projected>0` (especialmente `SIA\\motivo\\56/60/61`);
  - `diagnostics.durationMs` p50/p95 (`TR`, `SIA`);
  - `overheadMs` p50/p95 por contexto.

## Ajuste operacional subsequente (2026-03-06)

Aplicado: ajuste adicional de arbitragem no `handleDocumentDiagnostic` (patch 10) para dar *second look* também quando há sinal recente de commit/queue de full compile do contexto, sem depender exclusivamente de `full compile queued/running`.

Situação após a mudança:
- `public-api=0 -> context-projected>0` ainda permanece com foco de validação (resíduo localizado em `SIA\motivo` observado na execução anterior).
- Não há novos números de `diagnostics.durationMs`/`overheadMs` nesta etapa; executar nova coleta de:
  - `lsp-metrics-*.jsonl`
  - `lsp-observability-*.jsonl`
  - `node scripts/pull-observability-gate.mjs ...`
  para comparar se houve redução do padrão residual e do p50/p95.


## Perf update (2026-03-06) — Fase 2 / hotfixes de consistência do pull + arbitragem residual

Logs analisados (sessões):
- `lsp-metrics-2026-03-06T18-55-10-949Z.jsonl`
- `lsp-observability-2026-03-06T18-55-10-949Z.jsonl`
- `lsp-metrics-2026-03-06T19-11-49-466Z.jsonl`
- `lsp-observability-2026-03-06T19-11-49-466Z.jsonl`
- `lsp-metrics-2026-03-06T19-27-34-757Z.jsonl`
- `lsp-observability-2026-03-06T19-27-34-757Z.jsonl`
- `lsp-metrics-2026-03-06T19-41-55-683Z.jsonl`
- `lsp-observability-2026-03-06T19-41-55-683Z.jsonl`

### Resumo executivo
- A regressão funcional principal de **diagnostics não apresentados** foi mitigada.
- O padrão residual de `public-api=0` seguido por `context-projected>0` caiu de vários casos espalhados para **3 arquivos residuais** na sessão mais recente, todos concentrados em `SIA\motivo`:
  - `56-motivo-dominio-paginado.txt`
  - `60-motivo-excluir.txt`
  - `61-motivo-alterar.txt`
- Muitos `count=0` observados nos logs mais recentes são **legítimos** (arquivos efetivamente sem diagnóstico).
- O compiler incremental está saudável; o gargalo remanescente continua em **`overheadMs` fora do compiler**.

### Reuso semântico (warm)
Última sessão útil (`2026-03-06T19:41:55.683Z`):
- `TR`:
  - `semanticFilesAnalyzed` p50: **1**
  - `semanticFilesReused` p50: **29**
- `SIA`:
  - `semanticFilesAnalyzed` p50: **1**
  - `semanticFilesReused` p50: **18**

Leitura:
- a meta de reuso (`semanticFilesAnalyzed <= 3` na maioria das execuções warm) está **atendida** nas sessões recentes;
- `semanticFilesReused` permanece dominante.

### Diagnostics duration (warm)
Última sessão útil (`2026-03-06T19:41:55.683Z`):

| Contexto | n | p50 durationMs | p95 durationMs | p50 compilerTotalMs | p50 overheadMs |
|---|---:|---:|---:|---:|---:|
| `TR` | 9 | **544.3 ms** | **949.4 ms** | **84.4 ms** | **459.3 ms** |
| `SIA` | 17 | **491.2 ms** | **719.0 ms** | **135.1 ms** | **336.3 ms** |

Comparativo resumido com a primeira sessão já pós-hotfix funcional (`2026-03-06T18:55:10.949Z`):
- `TR`: p50 **597.5 -> 544.3 ms** (`-53.2 ms`)
- `SIA`: p50 **547.2 -> 491.2 ms** (`-56.0 ms`)

Leitura:
- houve **ganho mensurável** em warm após os hotfixes de consistência/arbitragem do pull;
- porém a meta da Fase 2 (**p50 <= 350 ms / p95 <= 550–600 ms**) **ainda não foi atingida**;
- `overheadMs` continua maior que `compilerTotalMs`, confirmando que o próximo foco deve permanecer no server/pull path, e não no compiler incremental.

### Estado funcional do pull diagnostics
- Hotfixes de 2026-03-06 reduziram fortemente os falsos `count=0` logo após `didOpen`.
- Sessão mais recente:
  - **15 arquivos** analisados via pull;
  - **5 arquivos** consistentemente em `count=0` sem indício de oscilação indevida (comportamento legítimo);
  - **3 arquivos** ainda apresentando o padrão residual `0 -> >0` pouco depois.

### Conclusão operacional
- **Melhora real** em corretude e em latência warm.
- **Fase 2 ainda não concluída**: falta atacar o `overheadMs` e remover o resíduo localizado de arbitragem no `public-api`.


## Perf update (2026-04-17) — logs pre-6

Arquivos analisados:
- pacote anexo `logs-pre-6.7z`
- série `lsp-observability-2026-04-08..2026-04-15*.jsonl`

### Pull diagnostics refresh
- amostras: **93.704**
- p50: **1 ms**
- p95: **2 ms**
- p99: **29 ms**
- p999: **1324 ms**
- max: **87351 ms**

### Cauda longa
- eventos `>=1000ms`: **108** (**0,12%**)
- eventos `>=10000ms`: **11** (**0,01%**)

### Razões de refresh mais frequentes
- `authoritativeZeroRearm`: **90.303**
- `compileResult:didChangeTextDocument`: **1.084**
- `compileResult:didChangeSemanticFollowup`: **907**
- `compileResult:pullDiagnosticsGlobalFollowup`: **770**

### Ruído operacional observado
- `decision.contextInvalidation` por `watched_file_change`: **80** eventos
- padrão dominante: arquivos `.txt` em `node_modules` e `.angular/cache`
- houve incidência recorrente de arquivos de licença/copyright (`LICENSE*.txt`, `CopyrightNotice.txt`)

### Leitura operacional
- O caminho rápido continua saudável na maior parte das requests.
- O problema a monitorar não é a mediana/p95, e sim a **cauda longa rara** de refresh.
- `authoritativeZeroRearm` continua sendo o maior gerador de churn observável e deve permanecer como eixo principal de análise de estabilidade/performance.
- Em coletas futuras, comparar sempre **p95 + p99 + p999 + max** e registrar separadamente o volume de refresh por razão.
