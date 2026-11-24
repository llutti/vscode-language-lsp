import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { createCompilerSession } from '../packages/compiler/dist/index.js';

const contextCount = Math.max(2, Number(process.env.LSP_BENCHMARK_CONTEXTS ?? '2'));
const rootDir = process.env.LSP_BENCHMARK_ROOT ?? process.cwd();
const filePattern = process.env.LSP_BENCHMARK_PATTERN ?? '**/*.{lsp,lspt}';
const system = process.env.LSP_BENCHMARK_SYSTEM ?? 'HCM';
const context = {
  name: 'benchmark',
  rootDir,
  filePattern,
  includeSubdirectories: true,
  system
};

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
}

async function compileOnce(session) {
  const startedAt = performance.now();
  await session.compile(context, new Map(), { includeSemantics: false, includeSemanticPayload: false });
  return performance.now() - startedAt;
}

async function runSerial() {
  const session = createCompilerSession();
  const durations = [];
  for (let index = 0; index < contextCount; index += 1) durations.push(await compileOnce(session));
  return durations;
}

async function runParallel() {
  const sessions = Array.from({ length: contextCount }, () => createCompilerSession());
  return await Promise.all(sessions.map((session) => compileOnce(session)));
}

const serialStartedAt = performance.now();
const serial = await runSerial();
const serialTotalMs = performance.now() - serialStartedAt;
const parallelStartedAt = performance.now();
const parallel = await runParallel();
const parallelTotalMs = performance.now() - parallelStartedAt;

console.log(JSON.stringify({
  contextCount,
  rootDir,
  filePattern,
  cpuCount: os.cpus().length,
  rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  serial: { totalMs: Math.round(serialTotalMs), p50Ms: Math.round(percentile(serial, 0.5)), p95Ms: Math.round(percentile(serial, 0.95)) },
  parallel: { totalMs: Math.round(parallelTotalMs), p50Ms: Math.round(percentile(parallel, 0.5)), p95Ms: Math.round(percentile(parallel, 0.95)) },
  speedup: Number((serialTotalMs / Math.max(1, parallelTotalMs)).toFixed(2)),
  note: 'Benchmark only; the extension remains serialized unless parallelism is explicitly implemented and enabled.'
}, null, 2));
