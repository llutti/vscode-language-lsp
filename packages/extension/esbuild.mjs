import esbuild from "esbuild";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const watch = process.argv.includes("--watch");
const production = process.argv.includes("--production");

const pkgPath = path.join(__dirname, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const extensionVersion = String(pkg.version ?? "unknown");
const buildDate = new Date().toISOString();

const ctx = await esbuild.context({
  entryPoints: [
    path.join(__dirname, "src", "extension.ts"),
    path.join(__dirname, "src", "server.ts"),
    path.join(__dirname, "src", "compiler-worker.ts")
  ],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  outdir: path.join(__dirname, "dist"),
  sourcemap: production ? false : true,
  define: {
    __LSP_EXTENSION_VERSION__: JSON.stringify(extensionVersion),
    __LSP_BUILD_DATE__: JSON.stringify(buildDate)
  },
  external: ["vscode"]
});

if (watch) {
  await ctx.watch();
  console.log("[esbuild] watching...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log("[esbuild] build complete");
}
