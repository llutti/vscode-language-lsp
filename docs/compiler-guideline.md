# Guideline Interno — `@lsp/compiler`

## Fronteiras de camadas
- `source/`: leitura de texto, offsets e ranges. Sem regra semântica.
- `lexer/`: tokenização e erros léxicos.
- `parser/`: AST e erros sintáticos estruturados.
- `semantic/`: regras de linguagem, escopos, diagnósticos semânticos e incrementalidade.
- `context/`: descoberta de arquivos, filtros de contexto e índice de símbolos.
- `diagnostics/`: códigos e utilitários de ordenação/deduplicação.
- `internals/`: catálogo de internas e assinaturas por sistema.
- `index.ts`: orquestração pública e contratos exportados.

## Convenções de naming e tipos
- Preferir `camelCase` para funções/variáveis e `PascalCase` para tipos.
- Evitar `any`; quando necessário, limitar escopo e justificar.
- Toda estrutura de erro parse/lexer deve carregar `code` estável.
- Não usar `message.includes(...)` como contrato funcional.
- Chaves de cache devem ser determinísticas e normalizadas com `casefold` quando aplicável.

## Regras de mutabilidade
- Não mutar arrays retornados por registries compartilhados.
- Evitar sort in-place em dados compartilhados do pipeline (`.sort` em cópia).
- Caches globais devem ter limite de tamanho ou política de invalidação.

## Performance e incrementalidade
- Hot paths não podem fazer ordenações repetidas por consulta.
- Busca por símbolo em caminho crítico deve ser O(1)/O(log n), nunca O(n) repetitivo por lookup.
- Em I/O de contexto, usar concorrência limitada para `stat/readFile`.
- Alterações de performance devem trazer benchmark reproduzível e comparação before/after.

## Diagnósticos e observabilidade
- IDs de diagnóstico são contratuais e não podem mudar sem migração.
- Registrar evidência de `perf.snapshot` e `typing.latency` em baseline quando aplicável.
- Regressão de performance acima de 10% exige investigação e registro.
