# Fixtures de testes

Este diretorio guarda arquivos LSP minimos usados pelos testes em `packages/compiler/test`.

Uso sugerido:
- Cada regra nova -> 1 fixture pequena e focada.
- Reaproveite fixtures existentes quando fizer sentido.

Exemplo basico de leitura:

import fs from "node:fs";
import path from "node:path";

const fixturePath = path.join(__dirname, "fixtures", "minha-regra.lsp");
const text = fs.readFileSync(fixturePath, "utf8");
