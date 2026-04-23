# Scripts — HCM Docs Sync (6.10.4)

Este diretório contém scripts para **validar** e **sincronizar** o cadastro interno de funções HCM com o índice oficial (HTML estático salvo do portal).

## Requisitos
- Node 18+ (para `fetch` nativo).
- Ter na raiz do repo o arquivo: `Índice das Funções.html` (salvo do portal 6.10.4).

## URL canônica
Para automação/parse, usamos a URL **direta** (não SPA hash):

`https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/customizacoes/funcoes/<slug>.htm`

## Comandos

### Gerar relatório (dry-run)
```bash
node packages/compiler/scripts/hcm-sync-6104.mjs
```

### Aplicar docUrl/docVersion (somente funções já cadastradas)
```bash
node packages/compiler/scripts/hcm-sync-6104.mjs --apply-docurl
```

### Validar 1 função (parâmetros/tipos) contra a documentação
```bash
node packages/compiler/scripts/hcm-sync-6104.mjs --validate-one addJSONInJSONArray
```

### Gerar exemplo de importação (allow-list)
```bash
node packages/compiler/scripts/hcm-sync-6104.mjs --import-example
```

## Saída
Os relatórios são gravados em: `docs/reports/`
