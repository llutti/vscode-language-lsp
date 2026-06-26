#!/usr/bin/env node
/**
 * Sync/Report for Senior HCM internal variables (6.10.4)
 *
 * Inputs:
 *  - Official variable index URL or local HTML file
 *  - packages/compiler/src/internals/data/hcm-internals.json
 *
 * Outputs (default under docs/reports):
 *  - hcm-6.10.4-variables-report.json
 *  - hcm-6.10.4-variables-report.md
 *
 * Notes:
 *  - Canonical URL is the direct page, not the SPA hash:
 *      https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/customizacoes/variaveis/<slug>.htm
 *  - This script can optionally:
 *      --apply-docurl   update docUrl+docVersion for entries already present in our JSON
 *      --import-missing import missing variables from the official index by fetching each page
 *      --validate-one <VariableName> validate the internal entry against the official page
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DEFAULT_INDEX_URL = "https://documentacao.senior.com.br/gestao-de-pessoas-hcm/6.10.4/customizacoes/variaveis.htm";
const HCM_JSON = path.resolve(ROOT, "packages/compiler/src/internals/data/hcm-internals.json");
const REPORT_DIR = path.resolve(ROOT, "docs/reports");

function readUtf8(p) {
  return fs.readFileSync(p, "utf8");
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value));
}

async function loadIndexSource(source) {
  if (isHttpUrl(source)) {
    const res = await fetch(source, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Falha ao baixar índice de variáveis: ${res.status} ${res.statusText}`);
    }
    return await res.text();
  }
  return readUtf8(source);
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

function canonicalizeDocUrl(link) {
  const base = new URL(DEFAULT_INDEX_URL);
  const resolved = new URL(link, base).href;
  return resolved.replace(
    "/index.htm#customizacoes/variaveis/",
    "/customizacoes/variaveis/"
  );
}

function parseIndexHtml(html) {
  const re = /<a[^>]+href="([^"]*variaveis\/[^"]+\.htm)"[^>]*>(.*?)<\/a>/gims;
  const map = new Map();

  let m;
  while ((m = re.exec(html)) !== null) {
    const hrefRaw = m[1];
    const nameRaw = decodeEntities(stripTags(m[2])).trim();
    if (!nameRaw) continue;

    const docUrl = canonicalizeDocUrl(hrefRaw);
    map.set(nameRaw.toLowerCase(), { name: nameRaw, hrefRaw, docUrl });
  }

  return map;
}

function mapDocTypeToInternal(t) {
  const norm = String(t).trim().toLowerCase();
  if (norm.startsWith("alfa")) return "Alfa";
  if (norm.startsWith("num") || norm.startsWith("número") || norm.startsWith("numeric") || norm.startsWith("numérico")) return "Numero";
  if (norm.startsWith("data")) return "Data";
  if (norm.startsWith("hora")) return "Hora";
  return undefined;
}

function parseVariablePage(htmlText) {
  const titleMatch = htmlText.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  const contentHtml = titleMatch
    ? htmlText.split(/<h1[^>]*>[^<]*<\/h1>/i)[1] ?? htmlText
    : htmlText;

  const text = decodeEntities(stripTags(contentHtml))
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const typeLineIndex = lines.findIndex((l) => /^Tipo:\s*/i.test(l));
  const descriptionLines = lines.slice(0, typeLineIndex >= 0 ? typeLineIndex : lines.length);
  const documentation = descriptionLines.join(" ").replace(/\s+/g, " ").trim();

  const typeLine = typeLineIndex >= 0 ? lines[typeLineIndex] : undefined;
  const dataType = typeLine ? mapDocTypeToInternal(typeLine.replace(/^Tipo:\s*/i, "").trim()) : undefined;
  const isConst = /constante/i.test(documentation);

  return { documentation: documentation || undefined, dataType, isConst };
}

function loadHcmJson() {
  return JSON.parse(readUtf8(HCM_JSON));
}

function saveHcmJson(entries) {
  fs.writeFileSync(HCM_JSON, JSON.stringify(entries, null, 2) + "\n", "utf8");
}

function buildReport(officialMap, internalEntries) {
  const internalByLabel = new Map(internalEntries.map((e) => [String(e.label).toLowerCase(), e]));

  const common = [];
  const missingInInternal = [];
  const missingDocUrl = [];
  const mismatchedDocUrl = [];

  for (const [k, v] of officialMap.entries()) {
    const inEntry = internalByLabel.get(k);
    if (inEntry) {
      common.push(v.name);
      if (!inEntry.docUrl) {
        missingDocUrl.push(v.name);
      } else if (String(inEntry.docUrl) !== v.docUrl) {
        mismatchedDocUrl.push({ name: v.name, internal: inEntry.docUrl, official: v.docUrl });
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

function mdReport(r) {
  const sample = (arr, n = 15) => arr.slice(0, n).map((x) => `- ${typeof x === "string" ? x : x.name}`).join("\n");

  return `# HCM — Índice oficial de Variáveis vs Cadastro Interno (v${r.docVersion})

## Totais
- Oficial (índice): **${r.officialCount}**
- Interno (hcm-internals.json): **${r.internalCount}**
- Em comum: **${r.commonCount}**
- Faltando no interno: **${r.missingInInternalCount}**
- Sem docUrl no interno (entre as em comum): **${r.missingDocUrlCount}**
- docUrl divergente (entre as em comum): **${r.mismatchedDocUrlCount}**

## Exemplos — faltando no interno
${sample(r.missingInInternal, 20) || "_(nenhum)_"}

## Exemplos — docUrl divergente
${sample(r.mismatchedDocUrl, 10) || "_(nenhum)_"}

> Observação: URL canônica usada para automação/parse é a **URL direta**:
> \`https://documentacao.senior.com.br/gestao-de-pessoas-hcm/${r.docVersion}/customizacoes/variaveis/<slug>.htm\`
`;
}

function applyDocUrl(officialMap, internalEntries) {
  let changed = 0;
  for (const e of internalEntries) {
    const key = String(e.label).toLowerCase();
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

async function importMissing(officialMap, internalEntries) {
  const existing = new Set(internalEntries.map((e) => String(e.label).toLowerCase()));
  const imported = [];

  for (const [key, off] of officialMap.entries()) {
    if (existing.has(key)) continue;

    const res = await fetch(off.docUrl, { redirect: "follow" });
    if (!res.ok) {
      console.error(`Falha ao baixar ${off.docUrl}: ${res.status}`);
      continue;
    }

    const html = await res.text();
    const parsed = parseVariablePage(html);

    const entry = {
      label: off.name,
      kind: "variable",
      isConst: Boolean(parsed.isConst),
      dataType: parsed.dataType ?? "Alfa",
      documentation: parsed.documentation ?? "",
      docUrl: off.docUrl,
      docVersion: "6.10.4",
    };

    imported.push(entry);
    internalEntries.push(entry);
  }

  return imported;
}

async function validateOne(officialMap, internalEntries, variableName) {
  const key = variableName.toLowerCase();
  const off = officialMap.get(key);
  if (!off) throw new Error(`Variável não encontrada no índice oficial: ${variableName}`);

  const internal = internalEntries.find((e) => String(e.label).toLowerCase() === key) ?? null;

  const res = await fetch(off.docUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`Falha ao baixar docUrl (${res.status}): ${off.docUrl}`);
  const html = await res.text();
  const parsed = parseVariablePage(html);

  const issues = [];
  if (internal) {
    if (internal.docUrl !== off.docUrl) {
      issues.push({ kind: "docUrlMismatch", internal: internal.docUrl, official: off.docUrl });
    }
    if (internal.docVersion !== "6.10.4") {
      issues.push({ kind: "docVersionMismatch", internal: internal.docVersion, official: "6.10.4" });
    }
    if (String(internal.dataType) !== String(parsed.dataType)) {
      issues.push({ kind: "dataTypeMismatch", internal: internal.dataType, official: parsed.dataType });
    }
  } else {
    issues.push({ kind: "missingInInternal" });
  }

  return {
    name: variableName,
    docUrl: off.docUrl,
    parsed,
    internal,
    issues,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const indexUrlArgIdx = args.indexOf("--indexUrl");
  const indexHtmlArgIdx = args.indexOf("--indexHtml");
  const indexSource = indexUrlArgIdx >= 0
    ? args[indexUrlArgIdx + 1]
    : indexHtmlArgIdx >= 0
      ? path.resolve(ROOT, args[indexHtmlArgIdx + 1])
      : DEFAULT_INDEX_URL;

  const html = await loadIndexSource(indexSource);
  const officialMap = parseIndexHtml(html);
  const internalEntries = loadHcmJson();

  const shouldApplyDocUrl = args.includes("--apply-docurl");
  const importMissingFlag = args.includes("--import-missing");
  const validateIdx = args.indexOf("--validate-one");

  ensureDir(REPORT_DIR);

  let changed = 0;
  if (shouldApplyDocUrl) {
    changed = applyDocUrl(officialMap, internalEntries);
    saveHcmJson(internalEntries);
  }

  let imported = [];
  if (importMissingFlag) {
    imported = await importMissing(officialMap, internalEntries);
    if (imported.length > 0) {
      saveHcmJson(internalEntries);
    }
  }

  const report = buildReport(officialMap, internalEntries);
  report.appliedDocUrlChanges = changed;
  report.importedCount = imported.length;
  fs.writeFileSync(path.join(REPORT_DIR, "hcm-6.10.4-variables-report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(REPORT_DIR, "hcm-6.10.4-variables-report.md"), mdReport(report), "utf8");

  if (validateIdx >= 0) {
    const variableName = args[validateIdx + 1];
    if (!variableName) throw new Error("--validate-one requer o nome da variável.");
    const validation = await validateOne(officialMap, internalEntries, variableName);
    fs.writeFileSync(path.join(REPORT_DIR, `hcm-6.10.4-validate-${variableName}.json`), JSON.stringify(validation, null, 2) + "\n", "utf8");
  }

  process.stdout.write(
    [
      `Index: ${indexSource}`,
      `Official variables: ${officialMap.size}`,
      `Internal variables: ${internalEntries.length}`,
      `Report: ${REPORT_DIR}`,
      shouldApplyDocUrl ? `Applied docUrl updates: ${changed}` : `DocUrl updates: (dry-run)`,
      importMissingFlag ? `Imported missing vars: ${imported.length}` : "",
      validateIdx >= 0 ? `Validation saved.` : "",
    ]
      .filter(Boolean)
      .join("\n") + "\n"
  );
}

main().catch((err) => {
  console.error(err?.stack ?? String(err));
  process.exit(1);
});
