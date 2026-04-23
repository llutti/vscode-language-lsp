import fs from "node:fs";
import path from "node:path";

const CWD = path.resolve(process.cwd());
const ROOT = fs.existsSync(path.join(CWD, "src")) ? CWD : path.join(CWD, "packages/compiler");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`[compiler:lint] ${msg}`);
    process.exit(1);
  }
}

function walkFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(abs));
      continue;
    }
    if (entry.isFile() && abs.endsWith(".ts")) {
      out.push(abs);
    }
  }
  return out;
}

function main() {
  const parser = read("src/parser/parser.ts");
  const index = read("src/index.ts");
  const analyzer = read("src/semantic/analyzer.ts");
  const ctx = read("src/context/context-manager.ts");

  assert(parser.includes("code: ParseErrorCode;"), "ParseError deve conter campo code estruturado.");
  assert(!index.includes("message.includes("), "index.ts não deve mapear diagnóstico por message.includes.");
  assert(!analyzer.includes("const ordered = internal.sort("), "não usar sort in-place em assinaturas internas.");
  assert(ctx.includes("PATTERN_CACHE_MAX"), "cache de pattern deve ter limite de tamanho.");

  const srcDir = path.join(ROOT, "src");
  const files = walkFiles(srcDir);
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    assert(!/\bas\s+any\b/.test(content), `evite 'as any' em ${path.relative(ROOT, filePath)}`);
    assert(!/:\s*any\b/.test(content), `evite tipo explícito 'any' em ${path.relative(ROOT, filePath)}`);
    assert(!/<\s*any\s*>/.test(content), `evite cast '<any>' em ${path.relative(ROOT, filePath)}`);
  }

  console.log("[compiler:lint] OK");
}

main();
