import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const entries = Array.isArray(pkg.files) ? pkg.files : [];

const files = [];

function walk(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      walk(full);
    } else if (item.isFile()) {
      files.push(full);
    }
  }
}

for (const entry of entries) {
  const full = path.join(root, entry);
  if (!fs.existsSync(full)) {
    console.warn(`[vsix-check] entrada ausente: ${entry}`);
    continue;
  }
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    walk(full);
  } else if (stat.isFile()) {
    files.push(full);
  }
}

const unique = Array.from(new Set(files));
let totalBytes = 0;
const sizes = unique.map((file) => {
  const size = fs.statSync(file).size;
  totalBytes += size;
  return { file, size };
});

sizes.sort((a, b) => b.size - a.size);

console.log(`[vsix-check] arquivos: ${sizes.length}`);
console.log(`[vsix-check] tamanho total: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
console.log("[vsix-check] maiores arquivos:");
for (const item of sizes.slice(0, 10)) {
  const rel = path.relative(root, item.file).replace(/\\/g, "/");
  console.log(`- ${rel}: ${(item.size / 1024).toFixed(1)} KB`);
}
