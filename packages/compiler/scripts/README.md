# Scripts — HCM Docs Sync (6.10.4)

Este diretório contém scripts para **validar** e **sincronizar** o cadastro interno de funções HCM com o índice oficial (HTML estático salvo do portal).

## Requisitos
- Node 18+ (para `fetch` nativo).
- Para o script de funções, ter na raiz do repo o arquivo: `Índice das Funções.html` (salvo do portal 6.10.4) ou usar um HTML local equivalente.
- Para o script de variáveis, o índice oficial é baixado diretamente da URL padrão por default.

## URL canônica
Para automação/parse, usamos a URL **direta** (não SPA hash):

`https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/customizacoes/funcoes/<slug>.htm`

Para variáveis HCM, o padrão é:

`https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/customizacoes/variaveis/<slug>.htm`

## Comandos

### Gerar relatório de funções (dry-run)
```bash
node packages/compiler/scripts/hcm-sync-6104.mjs
```

### Aplicar docUrl/docVersion em funções já cadastradas
```bash
node packages/compiler/scripts/hcm-sync-6104.mjs --apply-docurl
```

### Validar 1 função (parâmetros/tipos) contra a documentação
```bash
node packages/compiler/scripts/hcm-sync-6104.mjs --validate-one addJSONInJSONArray
```

### Gerar exemplo de importação de funções (allow-list)
```bash
node packages/compiler/scripts/hcm-sync-6104.mjs --import-example
```

### Gerar relatório de variáveis HCM (dry-run)
```bash
node packages/compiler/scripts/hcm-sync-6104-variables.mjs
```

### Aplicar docUrl/docVersion em variáveis já cadastradas
```bash
node packages/compiler/scripts/hcm-sync-6104-variables.mjs --apply-docurl
```

### Importar variáveis faltantes do índice oficial
```bash
node packages/compiler/scripts/hcm-sync-6104-variables.mjs --import-missing
```

### Validar 1 variável contra a documentação
```bash
node packages/compiler/scripts/hcm-sync-6104-variables.mjs --validate-one cFalso
```

## Saída
Os relatórios são gravados em: `docs/reports/`
