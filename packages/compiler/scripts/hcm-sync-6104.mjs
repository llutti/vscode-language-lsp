#!/usr/bin/env node
/**
 * Sync/Report for Senior HCM internal functions (6.10.4)
 *
 * Inputs:
 *  - Static index HTML file (saved from Senior docs)
 *  - packages/compiler/src/internals/data/hcm-signatures.json
 *
 * Outputs (default under docs/reports):
 *  - hcm-6.10.4-functions-report.json
 *  - hcm-6.10.4-functions-report.md
 *
 * Notes:
 *  - Canonical URL is the **direct page**, not the SPA hash:
 *      https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/customizacoes/funcoes/<slug>.htm
 *  - This script can optionally:
 *      --apply-docurl   update docUrl+docVersion for entries already present in our JSON
 *      --import-example import a small allow-list (for review) without touching existing ones
 *      --validate-one <FunctionName> validate params/types against official page for a single function
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DEFAULT_INDEX = path.resolve(ROOT, "Índice das Funções.html");
const HCM_JSON = path.resolve(ROOT, "packages/compiler/src/internals/data/hcm-signatures.json");
const REPORT_DIR = path.resolve(ROOT, "docs/reports");

function readUtf8(p) {
  return fs.readFileSync(p, "utf8");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "");
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function canonicalizeDocUrl(hashUrl) {
  // convert:
  //  .../index.htm#customizacoes/funcoes/<slug>.htm
  // to:
  //  .../customizacoes/funcoes/<slug>.htm
  return hashUrl.replace("/index.htm#customizacoes/funcoes/", "/customizacoes/funcoes/");
}

function parseIndexHtml(html) {
  // The saved HTML contains TOC items like:
  // <a href="https://.../index.htm#customizacoes/funcoes/abrirtelacolaborador.htm%3F...">AbrirTelaColaborador</a>
  const re = /<a[^>]+href="(https?:\/\/documentacao\.senior\.com\.br\/gestao-de-pessoas-hcm\/6\.10\.4\/index\.htm#customizacoes\/funcoes\/[^"]+?\.htm)[^"]*"[^>]*>(.*?)<\/a>/gims;

  /** @type {Map<string, {name:string, hashUrl:string, docUrl:string}>} */
  const map = new Map();

  let m;
  while ((m = re.exec(html)) !== null) {
    const hashUrlRaw = m[1];
    const nameRaw = decodeEntities(stripTags(m[2])).trim();
    if (!nameRaw) continue;

    // remove encoded querystring if present in captured href portion
    const hashUrl = hashUrlRaw.split("%")[0];

    const docUrl = canonicalizeDocUrl(hashUrl);
    map.set(nameRaw.toLowerCase(), { name: nameRaw, hashUrl, docUrl });
  }

  return map;
}

function loadHcmJson() {
  return JSON.parse(readUtf8(HCM_JSON));
}

function saveHcmJson(entries) {
  fs.writeFileSync(HCM_JSON, JSON.stringify(entries, null, 2) + "\n", "utf8");
}

function buildReport(officialMap, internalEntries) {
  const internalByName = new Map(internalEntries.map((e) => [String(e.name).toLowerCase(), e]));

  const officialNames = [...officialMap.values()].map((v) => v.name);
  const internalNames = internalEntries.map((e) => String(e.name));

  const common = [];
  const missingInInternal = [];
  const missingDocUrl = [];
  const mismatchedDocUrl = [];

  for (const [k, v] of officialMap.entries()) {
    const inEntry = internalByName.get(k);
    if (inEntry) {
      common.push(v.name);
      if (!inEntry.docUrl) {
        missingDocUrl.push(v.name);
      } else if (String(inEntry.docUrl) !== v.docUrl) {
        mismatchedDocUrl.push({
          name: v.name,
          internal: inEntry.docUrl,
          official: v.docUrl,
        });
      }
    } else {
      missingInInternal.push(v.name);
    }
  }

  return {
    docVersion: "6.10.4",
    officialCount: officialMap.size,
    internalCount: internalEntries.length,
    commonCount: common.length,
    missingInInternalCount: missingInInternal.length,
    missingDocUrlCount: missingDocUrl.length,
    mismatchedDocUrlCount: mismatchedDocUrl.length,
    common,
    missingInInternal,
    missingDocUrl,
    mismatchedDocUrl,
  };
}

function applyDocUrl(officialMap, internalEntries) {
  let changed = 0;
  for (const e of internalEntries) {
    const key = String(e.name).toLowerCase();
    const off = officialMap.get(key);
    if (!off) continue;

    const nextUrl = off.docUrl;
    const nextVer = "6.10.4";
    if (e.docUrl !== nextUrl || e.docVersion !== nextVer) {
      e.docUrl = nextUrl;
      e.docVersion = nextVer;
      changed++;
    }
  }
  return changed;
}

function mdReport(r) {
  const sample = (arr, n = 15) => arr.slice(0, n).map((x) => `- ${typeof x === "string" ? x : x.name}`).join("\n");

  return `# HCM — Índice oficial de Funções vs Cadastro Interno (v${r.docVersion})

## Totais
- Oficial (índice): **${r.officialCount}**
- Interno (hcm-signatures.json): **${r.internalCount}**
- Em comum: **${r.commonCount}**
- Faltando no interno: **${r.missingInInternalCount}**
- Sem docUrl no interno (entre as em comum): **${r.missingDocUrlCount}**
- docUrl divergente (entre as em comum): **${r.mismatchedDocUrlCount}**

## Exemplos — faltando no interno
${sample(r.missingInInternal, 20) || "_(nenhum)_"}

## Exemplos — docUrl divergente
${sample(r.mismatchedDocUrl, 10) || "_(nenhum)_"}

> Observação: URL canônica usada para automação/parse é a **URL direta**:
> \`https://documentacao.senior.com.br/gestao-de-pessoas-hcm/${r.docVersion}/customizacoes/funcoes/<slug>.htm\`
`;
}

function mapDocTypeToInternal(t) {
  const norm = t.trim().toLowerCase();
  if (norm.startsWith("alfa")) return "Alfa";
  if (norm.startsWith("num")) return "Numero";
  if (norm.startsWith("data")) return "Data";
  if (norm.startsWith("hora")) return "Hora";
  return t.trim();
}

function parseFunctionPage(htmlText) {
  // parse from visible text lines (works with Senior pages where "Sintaxe:" and "Parâmetros:" appear as text)
  const text = decodeEntities(stripTags(htmlText))
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  const syntaxMatch = text.match(/Sintaxe:\s*([^\n]+)\n/i);
  const syntax = syntaxMatch ? syntaxMatch[1].trim() : null;

  // parameters appear as:
  // Parâmetros:
  // Nome Tipo Descrição
  // aTela Alfa ...
  // ...
  const params = [];
  const paramsIdx = text.toLowerCase().indexOf("parâmetros:");
  if (paramsIdx >= 0) {
    const chunk = text.slice(paramsIdx);
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);

    // find header line "Nome Tipo Descrição" then start reading until "Exemplo:" or "Utilização:"
    const headerIdx = lines.findIndex((l) => /^nome\s+tipo\s+descri/i.test(l));
    if (headerIdx >= 0) {
      for (let i = headerIdx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (/^exemplo:/i.test(l) || /^utiliza/i.test(l)) break;

        // expected: "<name> <type> <desc...>"
        const m = l.match(/^(\S+)\s+(\S+)\s+(.+)$/);
        if (!m) continue;
        const [_, name, type, desc] = m;
        params.push({
          name,
          type: mapDocTypeToInternal(type),
          documentation: desc.trim(),
          isReturnValue: /end\s+retorno/i.test(syntax ?? "") ? (name.toLowerCase() === "retorno" || name.toLowerCase() === "resultado") : false,
        });
      }
    }
  }

  // description: first paragraph after heading is usually present right after title line; keep it simple:
  const descMatch = text.match(/#?\s*[A-Za-z0-9_]+\s*\n\s*([^\n]+)\n/i);
  const description = descMatch ? descMatch[1].trim() : null;

  return { syntax, params, description, rawText: text };
}

async function validateOne(officialMap, internalEntries, fnName) {
  const key = fnName.toLowerCase();
  const off = officialMap.get(key);
  if (!off) throw new Error(`Função não encontrada no índice oficial: ${fnName}`);

  const internal = internalEntries.find((e) => String(e.name).toLowerCase() === key) ?? null;

  const res = await fetch(off.docUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`Falha ao baixar docUrl (${res.status}): ${off.docUrl}`);
  const html = await res.text();
  const parsed = parseFunctionPage(html);

  const issues = [];
  if (internal) {
    const ip = internal.params ?? [];
    const op = parsed.params ?? [];
    if (ip.length !== op.length) issues.push({ kind: "paramCountMismatch", internal: ip.length, official: op.length });

    const len = Math.min(ip.length, op.length);
    for (let i = 0; i < len; i++) {
      const a = ip[i];
      const b = op[i];
      if (String(a.name) !== String(b.name)) issues.push({ kind: "paramNameMismatch", index: i, internal: a.name, official: b.name });
      if (String(a.type) !== String(b.type)) issues.push({ kind: "paramTypeMismatch", index: i, internal: a.type, official: b.type });
      const aRet = !!a.isReturnValue;
      const bRet = !!b.isReturnValue;
      if (aRet !== bRet) issues.push({ kind: "returnFlagMismatch", index: i, internal: aRet, official: bRet });
    }
  } else {
    issues.push({ kind: "missingInInternal" });
  }

  return {
    name: fnName,
    docUrl: off.docUrl,
    syntax: parsed.syntax,
    officialParams: parsed.params,
    internalParams: internal?.params ?? null,
    issues,
  };
}

async function importExample(officialMap, internalEntries, names) {
  const existing = new Set(internalEntries.map((e) => String(e.name).toLowerCase()));
  const imported = [];

  for (const n of names) {
    const key = n.toLowerCase();
    if (existing.has(key)) continue;
    const off = officialMap.get(key);
    if (!off) continue;

    const res = await fetch(off.docUrl, { redirect: "follow" });
    if (!res.ok) continue;
    const html = await res.text();
    const parsed = parseFunctionPage(html);

    imported.push({
      name: n,
      documentation: parsed.description ?? "",
      params: parsed.params.map((p) => ({
        name: p.name,
        type: p.type,
        isReturnValue: p.isReturnValue,
        documentation: p.documentation ?? "",
      })),
      docUrl: off.docUrl,
      docVersion: "6.10.4",
    });
  }

  return imported;
}

async function main() {
  const args = process.argv.slice(2);
  const indexArgIdx = args.indexOf("--indexHtml");
  const indexPath = indexArgIdx >= 0 ? path.resolve(ROOT, args[indexArgIdx + 1]) : DEFAULT_INDEX;

  const html = readUtf8(indexPath);
  const officialMap = parseIndexHtml(html);

  const internalEntries = loadHcmJson();

  const shouldApplyDocUrl = args.includes("--apply-docurl");
  const validateIdx = args.indexOf("--validate-one");
  const importExampleFlag = args.includes("--import-example");

  ensureDir(REPORT_DIR);

  let changed = 0;
  if (shouldApplyDocUrl) {
    changed = applyDocUrl(officialMap, internalEntries);
    saveHcmJson(internalEntries);
  }

  const report = buildReport(officialMap, internalEntries);
  report.appliedDocUrlChanges = changed;
  fs.writeFileSync(path.join(REPORT_DIR, "hcm-6.10.4-functions-report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(REPORT_DIR, "hcm-6.10.4-functions-report.md"), mdReport(report), "utf8");

  if (validateIdx >= 0) {
    const fnName = args[validateIdx + 1];
    if (!fnName) throw new Error("--validate-one requer o nome da função.");
    const v = await validateOne(officialMap, internalEntries, fnName);
    fs.writeFileSync(path.join(REPORT_DIR, `hcm-6.10.4-validate-${fnName}.json`), JSON.stringify(v, null, 2) + "\n", "utf8");
  }

  if (importExampleFlag) {
    // small allow-list for manual review
    const allow = ["AbrirTelaColaborador"];
    const imported = await importExample(officialMap, internalEntries, allow);
    fs.writeFileSync(path.join(REPORT_DIR, "hcm-6.10.4-import-example.json"), JSON.stringify(imported, null, 2) + "\n", "utf8");
  }

  process.stdout.write(
    [
      `Index: ${indexPath}`,
      `Official functions: ${officialMap.size}`,
      `Internal functions: ${internalEntries.length}`,
      `Report: ${REPORT_DIR}`,
      shouldApplyDocUrl ? `Applied docUrl updates: ${changed}` : `DocUrl updates: (dry-run)`,
      validateIdx >= 0 ? `Validation saved.` : ``,
      importExampleFlag ? `Import example saved.` : ``,
    ]
      .filter(Boolean)
      .join("\n") + "\n"
  );
}

main().catch((err) => {
  console.error(err?.stack ?? String(err));
  process.exit(1);
});
