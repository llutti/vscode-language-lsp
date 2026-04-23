# Catálogo i18n de Diagnostics (ES/EN)

Este documento define traduções base para códigos de diagnóstico do catálogo em `docs/messages.md`.

## Regra de manutenção

- Fonte normativa dos códigos/severidade: `docs/messages.md`.
- Este arquivo mantém equivalentes ES/EN para cada código.
- Mensagens com placeholders devem preservar `<identificador>`, `<tipoEsperado>`, etc.
- Quando um código possui mensagens efetivas múltiplas (`LSP0001`, `LSP1411`, `LSP1412`, `LSP1414`), manter traduções por variante no ponto de emissão e registrar aqui o texto guarda-chuva.

## Tabela de tradução

| Código | PT-BR (base) | ES (base) | EN (base) |
|---|---|---|---|
| LSP0001 | Erro de sintaxe | Error de sintaxis | Syntax error |
| LSP0002 | Erro léxico: token inválido | Error léxico: token inválido | Lexical error: invalid token |
| LSP0003 | Erro léxico: comentário de bloco não fechado | Error léxico: comentario de bloque no cerrado | Lexical error: unclosed block comment |
| LSP0004 | Erro léxico: string não fechada | Error léxico: cadena no cerrada | Lexical error: unterminated string |
| LSP0005 | Parêntese sem fechamento | Paréntesis sin cierre | Unclosed parenthesis |
| LSP0006 | Colchete sem fechamento | Corchete sin cierre | Unclosed bracket |
| LSP0007 | Falta de espaço antes de comentário inline | Falta de espacio antes de comentario inline | Missing space before inline comment |
| LSP1001 | Uso antes da declaração | Uso antes de la declaración | Use before declaration |
| LSP1002 | Conflito de tipo em variável já declarada | Conflicto de tipo en variable ya declarada | Type conflict in previously declared variable |
| LSP1003 | String literal exige declaração explícita Alfa | Literal de cadena requiere declaración explícita Alfa | String literal requires explicit Alfa declaration |
| LSP1004 | String literal exige variável Alfa | Literal de cadena requiere variable Alfa | String literal requires Alfa variable |
| LSP1005 | Variável não declarada | Variable no declarada | Undeclared variable |
| LSP1006 | Tipo inválido na atribuição | Tipo inválido en la asignación | Invalid assignment type |
| LSP1101 | Função declarada e não implementada | Función declarada y no implementada | Function declared but not implemented |
| LSP1102 | Função implementada sem declaração | Función implementada sin declaración | Function implemented without declaration |
| LSP1103 | Implementação de função fora do escopo global | Implementación de función fuera del ámbito global | Function implementation outside global scope |
| LSP1104 | Função com mais de 15 parâmetros | Función con más de 15 parámetros | Function with more than 15 parameters |
| LSP1105 | Declaração de função fora do escopo global | Declaración de función fuera del ámbito global | Function declaration outside global scope |
| LSP1201 | Parâmetro não utilizado | Parámetro no utilizado | Unused parameter |
| LSP1202 | Parâmetro END nunca atribuído | Parámetro END nunca asignado | END parameter never assigned |
| LSP1203 | Variável não utilizada | Variable no utilizada | Unused variable |
| LSP1204 | END atribuído via chamada | END asignado vía llamada | END assigned through call |
| LSP1301 | Cursor.SQL sem SELECT | Cursor.SQL sin SELECT | Cursor.SQL without SELECT |
| LSP1302 | Campo de Cursor somente leitura | Campo de Cursor de solo lectura | Read-only Cursor field |
| LSP1303 | Quantidade de parâmetros inválida em método de Cursor | Cantidad inválida de parámetros en método de Cursor | Invalid parameter count in Cursor method |
| LSP1401 | Quantidade de parâmetros inválida em chamada de função | Cantidad inválida de parámetros en llamada de función | Invalid parameter count in function call |
| LSP1402 | Tipo inválido em argumento de chamada | Tipo inválido en argumento de llamada | Invalid call argument type |
| LSP1403 | Método de Lista chamado fora de variável Lista | Método de Lista llamado fuera de variable Lista | Lista method called outside Lista variable |
| LSP1404 | Sugestão para variável usada como Data sem declaração | Sugerencia para variable usada como Data sin declaración | Suggestion for variable used as Data without declaration |
| LSP1406 | Sombreamento de ancestral com tipo diferente | Sombreado de ancestral con tipo diferente | Shadowing ancestor with different type |
| LSP1408 | Função inexistente | Función inexistente | Unknown function |
| LSP1410 | Quantidade de parâmetros inválida em ConverteMascara | Cantidad inválida de parámetros en ConverteMascara | Invalid parameter count in ConverteMascara |
| LSP1411 | Validação inválida de ConverteMascara (múltiplas variantes) | Validación inválida de ConverteMascara (múltiples variantes) | Invalid ConverteMascara validation (multiple variants) |
| LSP1412 | Tipo inválido em parâmetro de ConverteMascara (múltiplas variantes) | Tipo inválido en parámetro de ConverteMascara (múltiples variantes) | Invalid ConverteMascara parameter type (multiple variants) |
| LSP1413 | Destino de ConverteMascara não atribuível | Destino de ConverteMascara no asignable | Non-assignable ConverteMascara target |
| LSP1414 | Incompatibilidade em ConverteMascara (severidade variante) | Incompatibilidad en ConverteMascara (severidad variable) | ConverteMascara mismatch (variable severity) |
| LSP1415 | Tipo inválido para Tipo_Dado = 3 | Tipo inválido para Tipo_Dado = 3 | Invalid type for Tipo_Dado = 3 |
| LSP1416 | Valor inválido para Tipo_Dado = 5 | Valor inválido para Tipo_Dado = 5 | Invalid value for Tipo_Dado = 5 |
| LSP1417 | Quantidade de parâmetros inválida em método de Lista | Cantidad inválida de parámetros en método de Lista | Invalid parameter count in Lista method |
| LSP1418 | VaPara sem rótulo válido no arquivo atual | VaPara sin etiqueta válida en el archivo actual | VaPara without valid label in current file |
| LSP1419 | Parâmetro END exige variável | Parámetro END exige variable | END parameter requires variable |
| LSP1420 | Redeclaração global no mesmo arquivo | Redeclaración global en el mismo archivo | Global redeclaration in the same file |
| LSP1421 | Redeclaração no mesmo escopo | Redeclaración en el mismo ámbito | Redeclaration in the same scope |
| LSP1422 | Primeiro parâmetro de Mensagem inválido | Primer parámetro de Mensagem inválido | Invalid first Mensagem parameter |
| LSP1423 | `Pare`/`Continue` fora de `Enquanto`/`Para` | `Pare`/`Continue` fuera de `Enquanto`/`Para` | `Pare`/`Continue` outside `Enquanto`/`Para` |
