# Milestones & Tasks – LSP Compiler v2

Este documento descreve **as atividades executáveis** do projeto, derivadas do `spec.md`.
O `spec.md` permanece como **fonte de verdade conceitual e normativa consolidada**; este arquivo é o **plano operacional e o mapa de status**.

---

## Como ler este arquivo

- **Status Geral**: mostra a situação atual do projeto e os marcos ativos.
- **Trilhas Ativas**: concentram o trabalho em andamento e os próximos patches.
- **Marcos Concluídos**: registram a base já entregue e estabilizada.
- **Backlog Estruturado**: itens futuros já decididos, mas ainda não concluídos.
- **Regra de manutenção**: toda implementação, correção ou encerramento deve atualizar imediatamente este arquivo e a documentação relacionada.
- **Governança do `spec.md`**: o `spec.md` deve registrar apenas decisões consolidadas. Histórico, fases, notas de execução, evidências temporais e checklists operacionais devem ficar em `milestones.md`, documentos específicos de milestone ou `docs/archive/`.

---

## Status Geral

- `spec.md`: ✅ consolidado, normativo e sem histórico operacional
- Arquitetura base da V2: ✅ consolidada
- Compiler (lexer/parser/semântica): ✅ implementado
- Integração VS Code / LSP: ✅ implementada
- Formatter canônico: ✅ implementado
- Semantic tokens / syntax highlighting: ✅ implementado
- Pipeline de diagnostics pull-only: ✅ implementado
- Refactors nativos de Code Action: ✅ implementados
- Fase ativa principal: **M8 – TS-like Stabilization + Diagnostics Instrumentation**
  - Referência: `docs/milestone-ts-like-stabilization.md`
- Fase ativa complementar: **M13 – Limpeza e consolidação documental de `docs/`**
  - Referência: `docs/milestone-docs-cleanup-and-archival.md`
- Marcos concluídos recentes:
  - **M10 – Suporte estruturado a Tabela**
  - **M14 – Refatoração estrutural de `packages/extension/src/server.ts`**
  - **M17 – Refactor Code Actions**
  - **M19 – Embedded SQL formatting & highlighting**
- Protocolo de reavaliação técnica recorrente:
  - `docs/milestone-implementation-quality-reassessment.md`
- Referências históricas arquivadas:
  - `docs/archive/milestones/milestone-perf-highlight-pull.md`
  - `docs/archive/milestones/milestone-pull-diagnostics-persistent-cache.md`
  - `docs/archive/milestones/milestone-format-undo-deadlock-recovery.md`

---

## Diretriz operacional vigente

A V2 adota oficialmente o baseline **TS-like** (**TypeScript-like adaptado ao LSP**) para formatter, semantic tokens, capabilities e experiência de edição.

Implicações práticas:
- `Format Document` é o caminho oficial de formatação.
- `Format Selection` / `rangeFormatting` não faz parte do contrato final.
- O formatter retorna `[]` ou **um único `TextEdit` full-document** na resposta final do LSP.
- A UI deve priorizar estabilidade visual sobre respostas transitórias.
- Diagnostics, highlight e formatter devem ser observáveis por telemetria estruturada.

---

## Trilhas Ativas


## M19 – Embedded SQL formatting & highlighting

### Atualização recente
- [x] Observabilidade detalhada por variável, dependências, merge/guard/loop e segmentação do host SQL


### Atualização recente
- [x] Classificação otimista de fragmento estrutural SQL (`AND`/`OR`) para variáveis auxiliares
- [x] Suporte a SQL com fragmento estrutural no meio, preservando o fragmento dinâmico no formatter


**Objetivo:** consolidar a trilha controlada de formatação e highlighting de SQL embutido, cobrindo Fase 1, Fase 2A, Fase 2B controlada, Fase 2C explícita de `no-op` para casos dinâmicos/ambíguos, highlight interno controlado e dialetos expostos com fallback seguro.

**Documento mestre:** `docs/milestone-embedded-sql-formatting.md`

### Estado
- [x] Flags independentes para formatter e highlighting leve
- [x] Provider dedicado de formatter SQL com registry interno consumido pelo formatter principal
- [x] Wrappers autorizados formalizados (`ExecSql`, `<cursor>.SQL`, `ExecSQLEx`, `SQL_DefinirComando`)
- [x] Fase 1 — literal único e concatenação estática segura
- [x] Fase 2A — variável estática reconstruível no mesmo arquivo/bloco
- [x] Fase 2B — concatenação híbrida controlada em posição escalar segura
- [x] Fase 2C — `no-op` explícito para concatenação dinâmica/ambígua
- [x] Highlighting leve com observabilidade separada
- [x] Highlight SQL interno controlado para candidatos semanticamente seguros
- [x] Dialetos expostos: `sql`, `oracle`, `sqlserver`
- [x] Documentação sincronizada com o milestone específico

## Histórico recente — M17 – Refactor Code Actions

**Objetivo:** adicionar a primeira trilha oficial de refactors nativos via `CodeActionKind.Refactor`, com geração textual previsível e alinhada ao formatter canônico.

**Documento mestre:** `docs/milestone-refactor-code-actions.md`

### Estado
- [x] Configuração `lsp.refactor.defaultBlockStyle`
- [x] Provider de `CodeActionKind.Refactor`
- [x] Refactor `Envolver com bloco`
- [x] Refactor `Envolver com Se (...)`
- [x] Refactor `Envolver com Enquanto (...)`
- [x] Refactor `Envolver com Para (...)`
- [x] Refactor `Alternar bloco: Inicio/Fim ↔ { }`
- [x] Cobertura automatizada da transformação central
- [x] Documentação viva sincronizada


## M16 – Diagnostics Observability v2

**Objetivo:** ampliar a telemetria de `pull diagnostics` para explicar, com menor ambiguidade, arbitragem entre candidatos, lifecycle de follow-up, reuso de projected prefix e mudança visual real por URI.

**Documento mestre:** `docs/milestone-diagnostics-observability-v2.md`
**Guia operacional:** `docs/reports/diagnostics-observability-v2-guide.md`

### Estado
- [x] Instrumentar `candidateSet` / `chosenCandidate` / `rejectedCandidates`
- [x] Instrumentar `followupId` / `generation` / alvo do follow-up
- [x] Instrumentar `resolvedReason` e supersedência básica de follow-up
- [x] Instrumentar contador e TTL de reuso de `prefix_result` projetado
- [x] Instrumentar estado visível before/after por URI
- [x] Validar o caso `TR805` com os novos campos
- [x] Guiar a próxima correção comportamental usando a nova telemetria

Evidência consolidada nesta iteração:
- `docs/relatorio-tr805-observability-e-server-followup-2026-04-01.md`
- O caso `TR805` confirmou, em logs reais, os campos novos de arbitragem/follow-up e isolou como próximo alvo o caminho `compile_inflight -> fallback-compile -> didOpenZeroRetry`.
- A execução atual do milestone operacional ampliou o conceito de compile ativo no runtime de pull para incluir estados `scheduled`/`pending`/`running`, reduzindo fallback direto e follow-up redundante quando já existe compile contextual em progresso.


## M18 – SingleFile/Fallback lifecycle hardening

**Objetivo:** eliminar reuso residual de diagnostics/semantic tokens em URIs reabertos fora de contexto (`SingleFile/Fallback`), com foco em `didClose`, reabertura do mesmo URI e descarte de trabalho tardio.

**Documento mestre:** `docs/milestone-singlefile-fallback-lixo-freeze.md`

### Estado
- [x] Instrumentar `didOpen`/`didClose` com geração lógica de abertura por URI
- [x] Limpar estado residual ao reabrir o mesmo URI ainda vivo no runtime
- [x] Endurecer descarte de validação fallback agendada quando o documento muda ou fecha antes da execução
- [x] Cobrir regressão e2e de `didOpen -> didClose -> didOpen` do mesmo URI com `pull diagnostics`/semantic tokens

### Atualização recente
- [x] Regressão automatizada adicionada para limpeza de estado residual de `pull diagnostics` e boundary de warm cache/limpeza ativa de semantic tokens na reabertura do mesmo URI fallback

## M15 – Diagnostics Visual Stability

### Atualização recente
- [x] Preservar warm-start útil na reabertura do contexto sem reabrir publicação tardia após `didClose` do último arquivo


### Atualização recente
- [x] Reduzir retenção do sticky fast-path na edição normal
- [x] Deduplificar `authoritativeZeroRearm` por URI fora de burst de edição
- [x] Dar precedência ao `stable_snapshot` autoritativo mais novo sobre candidatos não autoritativos antigos no mesmo URI/contexto
- [x] Ignorar metadados resolvidos de follow-up quando o alvo já ficou para trás do `docVersion` / `dirtyStamp` atual
- [x] Limpar estado residual por URI ao fechar documento e ao drenar contexto quiesced
- [x] Impedir reaproveitamento de sticky snapshot não-vazio antigo quando já existir snapshot estável mais novo com zero diagnósticos no mesmo URI/contexto durante burst de edição


**Objetivo:** reduzir flicker e congelamento dos diagnostics durante edição intensa e no ciclo pós-formatter, preservando corretude e convergência autoritativa.

**Documento mestre:** `docs/milestone-diagnostics-visual-stability.md`

### Estado
- [x] Introduzir retenção estável curta para bursts de edição
- [x] Endurecer limpeza do estado pendente de `pullDiagnostics.authoritativeFollowup`
- [x] Limitar o republish forçado pós-format à janela curta do marker de format
- [x] Reagendar follow-up autoritativo específico quando o primeiro pull pós-format ainda reutiliza o `resultId` pré-format
- [x] Expirar `prefix_result` projetado quando ele atravessar versões do documento fora da janela curta de edição
- [x] Agendar compile semântico curto também nos caminhos pós-format e undo-like
- [x] Medir nos logs a redução do congelamento residual após formatter
- [x] Ajustar thresholds finais de pós-format e bursts conforme evidência

Conclusão desta iteração:
- A redução pós-format foi medida em logs reais com `TR805` e comparada entre amostras de `2026-03-17` e `2026-03-19`.
- Os thresholds atuais foram revisados e mantidos, porque a evidência mostrou que o gargalo dominante remanescente está em `compile_inflight`/`fallback-compile`, não nas janelas pós-format em si.

## M8 – TS-like Stabilization + Diagnostics Instrumentation

**Objetivo:** consolidar a convergência entre spec, runtime e UX do editor, usando baseline TS-like e instrumentação suficiente para explicar regressões de diagnostics, formatter e highlight.

**Documento mestre:** `docs/milestone-ts-like-stabilization.md`
**Evidência mais recente:** `docs/archive/notes/ts-like-stabilization-evidence-2026-03-10.md`

### Estado
- [x] Baseline TS-like formalizado no `spec.md`
- [x] Novo milestone criado
- [x] Direção arquitetural consolidada
- [x] Capability de formatter ajustada para remover `rangeFormatting`
- [x] Instrumentação inicial do pull diagnostics ampliada com:
  - [x] `stableUsed`
  - [x] `isPrefix`
  - [x] `isAuthoritative`
  - [x] `dirtyStamp`
- [x] Revisar documentação legada para remover linguagem ou taxonomia superada
- [x] Introduzir taxonomia formal de decisão para diagnostics (`publishDecision`, `stalenessReason`, `authorityLevel`)
- [x] Introduzir taxonomia equivalente para formatter (`formatDecision`, `formatReason`)
- [x] Introduzir taxonomia equivalente para semantic tokens / highlight (`tokenDecision`, `tokenReason`)
- [x] Consolidar procedimento de análise por logs e métricas
- [x] Fechar critérios de aceite de estabilização

### Próximos passos recomendados
1. Expandir a observabilidade de diagnostics para explicar claramente publicação, retenção, supressão e follow-up.
2. Consolidar e usar a taxonomia de formatter com decisões explícitas (`apply`, `no_op`, `cancel`, `skip`, `error`) e razões canônicas (`full_document_edit`, `already_canonical`, `request_cancelled`, etc.).
3. Instrumentar semantic tokens / highlight com reuso, cancelamento e queda transitória.
4. Revisar documentos antigos para alinhamento total ao baseline TS-like.
5. Fechar os casos reais de flicker/jump/freeze guiados por evidência.
6. Endurecer a expiração de `projected/prefix_result` em cenários de format/undo quando o mesmo `resultId` projetado atravessa múltiplas versões do documento.

---

## Histórico — M7 – Pull Diagnostics (estabilidade + performance)

**Objetivo:** estabilizar a arbitragem do pipeline pull-only, reduzir flicker e melhorar tempos de resposta em cenários reais.

**Documento mestre (arquivo histórico):** `docs/archive/milestones/milestone-perf-highlight-pull.md`

### Estado
- [x] Migração para pull-only concluída
- [x] Anti-flicker base implementado
- [x] Dirty stamp / gating base implementados
- [x] Reuso de snapshot estável para respostas não autoritativas/prefixadas
- [x] Clears autoritativos e reduções autoritativas não devem ser retidos
- [x] Quick fix de ignore por contexto disponível
- [x] Refinar arbitragem de respostas transitórias vs autoritativas
- [x] Fechar causas de diagnósticos congelados em cenários residuais
- [x] Melhorar a leitura operacional dos `.jsonl`
- [x] Consolidar métricas finais da fase com evidência comparável

### Observação
O trabalho desta trilha continua ativo, mas agora subordinado à convergência definida em **M8**. Em outras palavras: M7 continua tratando performance e arbitragem; M8 organiza o contrato final e a instrumentação mestre.

---



## Histórico recente — M11 – Organização estrutural de pastas (extension + compiler)

**Objetivo:** reorganizar `packages/extension/src` por domínio e ajustar `packages/compiler/src` de forma conservadora (foco em `internals/`), preservando comportamento funcional.

**Documento mestre (arquivo histórico):** `docs/archive/milestones/milestone-folder-organization.md`

### Estado
- [x] Milestone/checklist operacional criado
- [x] Inventário inicial de árvore e classificação por domínio
- [x] Baseline inicial de typecheck (`compiler` e `extension`)
- [x] Reorganização da `extension` concluída
- [x] Reorganização conservadora do `compiler` concluída
- [x] Consolidação final + governança de pastas no `spec.md`

## Histórico recente — M12 – Organização estrutural de pastas de teste (extension + compiler)

**Objetivo:** reorganizar `packages/extension/test` e `packages/compiler/test` por domínio, preservando comportamento funcional, snapshots e previsibilidade de manutenção.

**Documento mestre (arquivo histórico):** `docs/archive/milestones/milestone-test-folder-organization.md`

### Estado
- [x] Milestone/checklist operacional criado
- [x] Inventário inicial das árvores de teste
- [x] Classificação de testes e snapshots por domínio
- [x] Reorganização da `extension/test` concluída
- [x] Reorganização da `compiler/test` concluída
- [x] Ajuste de imports e referências locais concluído
- [x] Validação final das suítes (`compiler` e `extension`) concluída

## M13 – Limpeza e consolidação documental de `docs/`

**Objetivo:** revisar todos os `.md` de `docs/`, classificar em `manter / arquivar / apagar`, reduzir ruído documental e consolidar `spec.md`, `rules.md` e `milestones.md` como eixo vivo principal.

**Documento mestre:** `docs/milestone-docs-cleanup-and-archival.md`

### Estado
- [x] Milestone/checklist operacional criado
- [x] Inventário inicial dos `.md` realizado
- [x] Classificação inicial `manter / arquivar / apagar` registrada
- [x] Estrutura de `docs/archive/` criada
- [x] Arquivamento dos históricos concluído
- [x] Remoção dos descartáveis concluída
- [x] Consolidação final da documentação concluída
- [x] Governança do `spec.md` consolidada: apenas decisões estáveis, sem histórico operacional

## Histórico complementar — Warm-start / bootstrap / cache persistido

**Documento de referência (arquivo histórico):** `docs/archive/milestones/milestone-pull-diagnostics-persistent-cache.md`

### Estado
- [x] Fechar warm-start com menor latência de primeira resposta
- [x] Validar bootstrap com cache persistido sem regressão visual
- [x] Garantir coerência entre cold-start, follow-up e resultado autoritativo
- [x] Consolidar documentação operacional do fluxo

---

## Histórico complementar — Recovery format/undo (deadlock)

**Documento de referência (arquivo histórico):** `docs/archive/milestones/milestone-format-undo-deadlock-recovery.md`

### Estado
- [x] Instrumentação de sinais específicos (`didUndoLikeChange`, `formatUndoCoalesced`, `followupAlreadyScheduled`, `followupSuppressedByCooldown`, `contextQuiesced`, `obsoleteWorkDropped`)
- [x] Cooldown/dedupe adicional para follow-up de diagnostics
- [x] Limpeza de follow-up pendente ao fechar documento
- [x] Ajuste de pressão de `semanticTokens.refresh` durante follow-up pendente
- [x] Regressão e2e completa `format -> undo -> format` em arquivo grande

---

## Correções V2 consolidadas

### Decisões/correções já aplicadas
- [x] Padrão oficial de arquivos: `.lspt` (associação `.txt` apenas via workspace)
- [x] Ordenação determinística por `basename` quando `includeSubdirectories = true`
- [x] Métodos de `Cursor` unificados em fonte única de verdade
- [x] Reforço de UTF-8 em mensagens e leitura de fonte
- [x] Tutorial M4.2 implementado como walkthrough + comando + persistência de estado
- [x] `activationEvents` mantido vazio
- [x] System `SENIOR` sempre carregado e não selecionável em contexto
- [x] Diagnostics operando em pull-only
- [x] Baseline de formatter definido como TS-like/canônico
- [x] Funções internas e customizadas convergidas para `function` no syntax highlight
- [x] Variáveis internas destacadas como `variable` com modifiers apropriados
- [x] Variáveis customizadas unificadas visualmente como `variable`, sem diferenciação por escopo global/local no syntax highlight
- [x] Deduplicação defensiva de occurrences semânticas por `range + tokenType + modifiers`
- [x] Compatibilidade mantida para `Fim; Senao`
- [x] Syntax highlight: parâmetros TextMate restringidos ao contexto de assinatura de função; declarações tipadas comuns não devem receber scope de parâmetro.
- [x] `VaPara` limitado ao mesmo arquivo e escopo lógico

---

## Marcos Concluídos

## M10 – Suporte estruturado a `Tabela`

**Objetivo:** formalizar e implementar a declaração estruturada de `Tabela` na V2, incluindo parser, semântica básica do schema, hover resumido e snippet inicial.

**Documento mestre:** `docs/milestone-tabela.md`

### Estado
- [x] Seção normativa de `Tabela` adicionada ao `spec.md`
- [x] Seção operacional de `Tabela` adicionada ao `rules.md`
- [x] Parser dedicado para `Definir Tabela ... = { ... };`
- [x] Representação estruturada de ocorrências e colunas no AST
- [x] Validação semântica inicial do schema (`Alfa`/`Numero`/`Data`, duplicidade, tamanho, tabela vazia)
- [x] Metadados de tabela expostos para hover
- [x] Snippet inicial de `Definir Tabela`
- [x] Completion de colunas de `Tabela` implementado na extensão
- [x] Validação final com exemplos `QL/_Antigos/Regra QL*.txt`
- [x] Rodar suíte completa do compiler/extension em ambiente com dependências resolvidas

## M14 – Refatoração estrutural de `packages/extension/src/server.ts`

**Objetivo:** reduzir `packages/extension/src/server.ts` ao papel de composition root, explicitando runtime compartilhado e separando handlers por domínio.

**Documento mestre:** `docs/archive/milestones/milestone-extension-server-refactor.md`

### Estado
- [x] Baseline documental e de testes executado
- [x] Runtime explícito introduzido com `server-runtime.ts` e `server-runtime-factory.ts`
- [x] Handlers de lifecycle extraídos
- [x] Handlers de linguagem extraídos
- [x] Handlers de formatting extraídos
- [x] Handlers de diagnostics extraídos
- [x] Handlers de semantic tokens extraídos
- [x] Orquestradores dedicados de contexto e compilação extraídos
- [x] Consolidação final com `server.ts` reduzido ao papel de composition root

### Evidência atual
- `npm run typecheck`
- `npm run lint --workspace lsp`
- `npm test --workspace lsp`

### Observação de fechamento
- `packages/extension/src/server.ts` deixou de concentrar registro de handlers e orquestração operacional pesada.
- A composição principal permanece em `server.ts`, enquanto contexto e compilação passaram a ser delegados para:
  - `packages/extension/src/server/context/context-orchestrator.ts`
  - `packages/extension/src/server/compile/compile-orchestrator.ts`
- Os helpers residuais mantidos em `server.ts` são utilitários operacionais e bridges locais de runtime, preservados intencionalmente por coesão de bootstrap e por não justificarem nova extração isolada nesta fase.
- Follow-up operacional vigente:
  - a taxonomia e a emissão estruturada de `pullDiagnostics` continuam sendo consolidadas fora do `server.ts` principal em módulos dedicados de diagnostics/observability, como parte do milestone de estabilização operacional.
  - a instrumentação de latest-wins/coalescing permanece concentrada em `packages/extension/src/server/compile/compile-orchestrator.ts`, enquanto a taxonomia de invalidação operacional agora vive em `packages/extension/src/server/context/context-invalidation.ts`.

## M1 – Consolidação de Base

- [x] Definir objetivos do compilador v2
- [x] Definir conceito de system
- [x] Definir escopo por diretório
- [x] Definir regras de funções customizadas
- [x] Definir regras de parâmetros

---

## M2 – Arquitetura do Compilador

- [x] Definir AST completa da linguagem LSP
- [x] Definir modelo de escopos e symbol table
- [x] Definir modelo de diagnostics

---

## M3 – Lexer, Parser e Analisador Semântico

### M3.1 – Lexer
- [x] Enum `TokenType`
- [x] Comentários de linha e bloco
- [x] Diferenciação entre identificadores e palavras reservadas
- [x] `range` em tokens
- [x] Erros léxicos claros
- [x] Testes unitários

### M3.2 – Parser
- [x] AST de alto nível (`Program`, `File`)
- [x] Declarações e implementações de função
- [x] Declarações de variáveis
- [x] Atribuições
- [x] Estruturas de controle (`Se/Senao`, `Enquanto`, `Para`)
- [x] Expressões, chamadas de função e acesso a propriedades
- [x] Blocos `{}` e `Inicio/Fim`
- [x] AST sem validação semântica
- [x] Testes do parser

### M3.3 – Escopos
- [x] Escopo global por contexto
- [x] Escopo por função
- [x] Escopo por bloco
- [x] Cadeia pai → filho
- [x] Associação de escopos aos nós da AST

### M3.4 – Registro de símbolos
- [x] Funções customizadas
- [x] Funções internas por system
- [x] Variáveis globais
- [x] Parâmetros de função
- [x] Estados declarados/utilizados/atribuídos

### M3.5 – Análise semântica
- [x] Uso antes da declaração
- [x] Chamadas de função (quantidade e tipos)
- [x] Funções declaradas e não implementadas
- [x] Funções implementadas sem declaração
- [x] Parâmetros não utilizados
- [x] Parâmetros `END` nunca atribuídos
- [x] Variáveis não utilizadas
- [x] Tipos semânticos de `Cursor` e `Lista`

### M3.6 – Engine de diagnostics
- [x] Modelo unificado de diagnostics
- [x] Diagnostics com `range`
- [x] Consolidação por contexto
- [x] Eliminação de duplicação
- [x] Ordenação por posição

### M3.7 – Testes do M3
- [x] Lexer
- [x] Parser / AST
- [x] Regras semânticas
- [x] Multi-arquivo com ordem alfabética
- [x] Regressões com exemplos reais
- [x] Atualização de `docs/rules-coverage.md` quando novas regras forem adicionadas

---

## M4 – Integração VS Code

### M4.1 – Language Server
- [x] Arquitetura cliente VS Code + servidor LSP
- [x] Pacote de servidor dedicado
- [x] Inicialização LSP
- [x] Integração com o compilador e cache por contexto
- [x] Handlers de diagnostics pull-only (`textDocument/diagnostic`)
- [x] Handlers de completion, hover, signatureHelp e definition
- [x] Reload por configuração
- [x] Performance multi-arquivo com debounce + incremental
- [x] Testes de integração do servidor

### M4.2 – Tutorial / onboarding
- [x] Conteúdo do tutorial
- [x] Detecção primeira instalação vs atualização
- [x] Exibição após instalação/atualização
- [x] Persistência de “não mostrar novamente”
- [x] Testes manuais do fluxo

### M4.3 – Revisão e otimizações da extensão
- [x] Revisão de uso de memória e tempos de resposta
- [x] Redução de carga de inicialização
- [x] Validação do empacotamento VSIX
- [x] Revisão de logs/erros
- [x] Checklist de regressão no VS Code

---

## M5 – Recursos Avançados

### M5.1 – Diagnostics adicionais
- [x] Variáveis não utilizadas
- [x] Parâmetros não utilizados

### M5.2 – Formatter
- [x] Regras de estilo
- [x] Formatter no compiler (AST → texto)
- [x] Preservação de strings e comentários
- [x] Testes de snapshot
- [x] Integração com VS Code
- [x] Opções configuráveis (indent size, tabs/spaces)
- [x] Normalização canônica de expressões aditivas multiline em assignment (`+`/`-`) com preservação de comentários trailing e recolocação de `;` órfão no último termo

### M5.3 – Syntax Highlighting / Semantic Tokens
- [x] Exposição de dados semânticos do compiler para a extensão
- [x] Implementação de semantic tokens
- [x] Base de escopos semânticos necessária para o highlight avançado

---

## M6 – Migração, Reuso e Evoluções Estruturais

### M6.1 – Migração da V1
- [x] Funções internas migradas
- [x] Variáveis internas migradas
- [x] `lsp-configuration.json`
- [x] Snippets

### M6.2 – Cache incremental por arquivo
- [x] Reuso de leitura/parse por arquivo
- [x] Cobertura em testes de incremental I/O e parse

### M6.3 – Compilação incremental por arquivo
- [x] `createCompilerSession`
- [x] `parseFilesIncremental`
- [x] `analyzeProgramIncremental`
- [x] Cobertura em testes incrementais

### M6.4 – Hover optimization
- [x] Índice O(1)
- [x] Cache LRU de markdown
- [x] Invalidação contextual
- [x] Testes dedicados

### M6.5 – Reorganização da arquitetura de diagnostics
- [x] Preparação e convergência para pull-only
- [x] Estado final migrado para pull-only
- [x] Anti-flicker / dirtyStamp / gate de observabilidade
- [x] Snapshot estável para respostas não autoritativas/prefixadas
- [x] Quickfix de ignore por contexto

### M6.6 – Item ainda em aberto
- [x] Tradução de todas as mensagens de diagnóstico para ES e EN

---

## Backlog Estruturado

## B1 – Documentação e convergência
- [x] Revisar `docs/messages.md` para alinhar papel de catálogo vs registro operacional
- [x] Revisar milestones/documentos antigos que ainda reflitam decisões intermediárias já superadas
- [x] Garantir que formatter/highlight/diagnostics estejam descritos de forma coerente com o baseline TS-like

## B2 – Observabilidade e métricas
- [x] Completar taxonomia de decisão para diagnostics
- [x] Completar taxonomia de decisão para formatter
- [x] Completar taxonomia de decisão para semantic tokens / highlight
- [x] Definir protocolo objetivo de leitura dos `.jsonl`
- [x] Consolidar relatórios comparáveis before/after nas fases ativas

## B3 – Estabilização funcional
- [x] Eliminar diagnósticos congelados residuais
- [x] Eliminar flicker residual de formatter
- [x] Eliminar flicker residual de highlight
- [x] Fechar critérios finais de aceite para M7/M8

## B4 – Internacionalização
- [x] Traduzir todas as mensagens de diagnóstico para ES e EN
- [x] Definir estratégia de manutenção do catálogo traduzido

---

## Regra de manutenção deste arquivo

Sempre que algo for:
- implementado,
- corrigido,
- removido,
- estabilizado,
- reclassificado,
- ou encerrado por decisão,

este arquivo e a documentação relacionada devem ser atualizados **imediatamente**.

---

## Referências operacionais

- `docs/spec.md`
- `docs/rules.md`
- `docs/messages.md`
- `docs/milestone-ts-like-stabilization.md`
- `docs/milestone-observability-refoundation.md`
- `docs/milestone-tabela.md`
- `docs/milestone-docs-cleanup-and-archival.md`

---

> Este documento deve permanecer sincronizado com o `spec.md`, mas não substitui suas definições conceituais.


- Compatibilidade histórica de `Tabela` com `Inicio/Fim` implementada.
- Validação semântica do índice de `Tabela` (`LSP1510`/`LSP1511`) implementada.
- Regra documental consolidada: variável usada como índice de `Tabela` deve já estar declarada; não há declaração implícita nesse contexto.
- Classificação semântica de `Mensagem` corrigida para evitar token `variable` no call head.
- `ExecSql` removido da emissão semântica como `function`; o destaque vem do TextMate.
- Quiesce de contexto endurecido: ao fechar o último arquivo do contexto, follow-ups pendentes de pull diagnostics são cancelados, snapshots publicáveis do contexto são drenados e o cache persistido/publicável é invalidado para evitar diagnóstico preso após `openDocsCount=0`.


- [x] Hard-stop do contexto ao fechar o último arquivo: cancelar compiles/follow-ups pendentes e descartar trabalho tardio do contexto quiesced.

- [x] Invalidação por geração do contexto para descartar resultados tardios após fechamento do último arquivo
- [x] Precedência reforçada do snapshot autoritativo estável no pós-formatter para evitar regressão de diagnósticos


## Atualização M19 – Embedded SQL
- [x] Propagação local de fragmentos SQL estruturais entre variáveis auxiliares e SQL hospedeiro no mesmo arquivo/bloco
