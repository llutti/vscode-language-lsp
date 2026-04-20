import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "v1", "server", "src", "lsp-internal-templates.ts");
const outDir = path.join(root, "packages", "compiler", "src", "internals");

const text = fs.readFileSync(sourcePath, "utf8");

function isQuote(ch) {
  return ch === "'" || ch === '"';
}

function readString(input, start) {
  const quote = input[start];
  let i = start + 1;
  let value = "";
  while (i < input.length) {
    const ch = input[i];
    if (ch === "\\") {
      const next = input[i + 1] ?? "";
      value += next;
      i += 2;
      continue;
    }
    if (ch === quote) {
      return { value, end: i + 1 };
    }
    value += ch;
    i += 1;
  }
  return { value, end: i };
}

function extractBalanced(input, startIndex, openChar, closeChar) {
  let depth = 0;
  let i = startIndex;
  let inString = false;
  let quote = "";

  for (; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (isQuote(ch)) {
      inString = true;
      quote = ch;
      continue;
    }

    if (ch === openChar) {
      depth += 1;
    } else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return { content: input.slice(startIndex, i + 1), end: i + 1 };
      }
    }
  }

  return { content: input.slice(startIndex), end: input.length };
}

function extractArrayBlock(source, marker) {
  const idx = source.indexOf(marker);
  if (idx < 0) return "";
  const assign = source.indexOf("=", idx);
  if (assign < 0) return "";
  const start = source.indexOf("[", assign);
  if (start < 0) return "";
  const { content } = extractBalanced(source, start, "[", "]");
  return content.slice(1, -1);
}

function splitTopLevelObjects(arrayText) {
  const objects = [];
  let i = 0;
  while (i < arrayText.length) {
    if (arrayText[i] === "{") {
      const { content, end } = extractBalanced(arrayText, i, "{", "}");
      objects.push(content);
      i = end;
      continue;
    }
    i += 1;
  }
  return objects;
}

function extractStringLiterals(text) {
  const parts = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (!isQuote(ch)) continue;
    const { value, end } = readString(text, i);
    parts.push(value);
    i = end - 1;
  }
  return parts.join("");
}

function extractFieldValue(objText, fieldName) {
  const idx = objText.indexOf(fieldName);
  if (idx < 0) return null;
  const colon = objText.indexOf(":", idx);
  if (colon < 0) return null;

  let i = colon + 1;
  while (i < objText.length && /\s/.test(objText[i])) i += 1;
  if (i >= objText.length) return null;

  const ch = objText[i];
  if (isQuote(ch)) {
    const { value } = readString(objText, i);
    return value;
  }
  if (ch === "{") {
    const { content } = extractBalanced(objText, i, "{", "}");
    return extractStringLiterals(content);
  }
  return null;
}

function extractParams(objText) {
  const paramsIndex = objText.indexOf("parameters");
  if (paramsIndex < 0) return [];
  const arrayStart = objText.indexOf("[", paramsIndex);
  if (arrayStart < 0) return [];
  const { content } = extractBalanced(objText, arrayStart, "[", "]");
  const arrayBody = content.slice(1, -1);
  const paramObjects = splitTopLevelObjects(arrayBody);

  return paramObjects.map((paramText) => {
    const nameMatch = /name:\s*['\"]([^'\"]+)['\"]/.exec(paramText);
    const typeMatch = /type:\s*EParameterType\.([A-Za-z]+)/.exec(paramText);
    const returnMatch = /isReturnValue:\s*(true|false)/.exec(paramText);
    const documentation = extractFieldValue(paramText, "documentation");

    return {
      name: nameMatch ? nameMatch[1] : "",
      type: typeMatch ? typeMatch[1] : "Desconhecido",
      isReturnValue: returnMatch ? returnMatch[1] === "true" : false,
      documentation: documentation || undefined
    };
  });
}

function mapType(raw) {
  const map = {
    Alfa: "Alfa",
    Numero: "Numero",
    Data: "Data",
    Funcao: "Funcao",
    Lista: "Lista",
    Cursor: "Cursor",
    Tabela: "Tabela"
  };
  return map[raw] ?? "Desconhecido";
}

function buildSignatures(marker) {
  const array = extractArrayBlock(text, marker);
  const objects = splitTopLevelObjects(array);

  return objects
    .map((obj) => {
      const labelMatch = /label:\s*['\"]([^'\"]+)['\"]/.exec(obj);
      if (!labelMatch) return null;
      const name = labelMatch[1];
      const documentation = extractFieldValue(obj, "documentation");
      const params = extractParams(obj).map((p) => ({
        name: p.name,
        type: mapType(p.type),
        isReturnValue: p.isReturnValue,
        documentation: p.documentation
      }));

      return {
        name,
        documentation: documentation || undefined,
        params
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

const systems = [
  { marker: "export const templatesInternosSENIOR", file: "senior-signatures.json" },
  { marker: "export const templatesInternosHCM", file: "hcm-signatures.json" },
  { marker: "export const templatesInternosACESSO", file: "acesso-signatures.json" },
  { marker: "export const templatesInternosERP", file: "erp-signatures.json" }
];

for (const sys of systems) {
  const sigs = buildSignatures(sys.marker);
  const outPath = path.join(outDir, sys.file);
  fs.writeFileSync(outPath, JSON.stringify(sigs, null, 2));
  console.log(`wrote ${outPath} (${sigs.length})`);
}
