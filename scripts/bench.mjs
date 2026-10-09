// Сравнивает время production-сборки bench/src в Rspack и webpack.
// Использование: node scripts/bench.mjs [число прогонов] (по умолчанию 3)
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const runs = Number(process.argv[2] ?? 3);
const root = join(import.meta.dirname, "..");
const bench = join(root, "bench");
const require = createRequire(import.meta.url);

if (!existsSync(join(bench, "src", "index.ts"))) {
  console.error("Нет bench/src — сначала запустите: npm run bench:generate");
  process.exit(1);
}

const binOf = (pkg, name) => {
  const pkgJson = require.resolve(`${pkg}/package.json`);
  const { bin } = require(pkgJson);
  return join(dirname(pkgJson), typeof bin === "string" ? bin : bin[name]);
};

const tools = [
  {
    name: "Rspack",
    args: [binOf("@rspack/cli", "rspack"), "build", "-c", join(bench, "rspack.config.mjs")],
    cacheDir: join(root, "node_modules/.cache/rspack-bench"),
    dist: join(bench, "dist-rspack"),
  },
  {
    name: "webpack",
    args: [binOf("webpack-cli", "webpack-cli"), "-c", join(bench, "webpack.config.mjs")],
    cacheDir: join(root, "node_modules/.cache/webpack-bench"),
    dist: join(bench, "dist-webpack"),
  },
];

function build(tool, cache) {
  const start = performance.now();
  const result = spawnSync(process.execPath, tool.args, {
    cwd: root,
    env: { ...process.env, BENCH_CACHE: cache ? "1" : "0", NODE_ENV: "production" },
    encoding: "utf8",
  });
  const ms = performance.now() - start;
  if (result.status !== 0) {
    console.error(`\n${tool.name} завершился с ошибкой:\n${result.stdout}${result.stderr}`);
    process.exit(1);
  }
  return ms;
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const dirSize = (dir) =>
  readdirSync(dir, { recursive: true })
    .map((file) => join(dir, file))
    .filter((file) => statSync(file).isFile())
    .reduce((sum, file) => sum + statSync(file).size, 0);

const countModules = () =>
  readdirSync(join(bench, "src"), { recursive: true }).filter((f) => f.endsWith(".ts")).length;

console.log(`Модулей: ${countModules()}, прогонов на замер: ${runs}\n`);

const results = [];
for (const tool of tools) {
  process.stdout.write(`${tool.name}: холодная сборка `);
  const cold = [];
  for (let i = 0; i < runs; i++) {
    cold.push(build(tool, false));
    process.stdout.write(".");
  }

  process.stdout.write(" прогрев кеша ");
  rmSync(tool.cacheDir, { recursive: true, force: true });
  const firstCached = build(tool, true);
  process.stdout.write(". повторная сборка с кешем ");
  const warm = [];
  for (let i = 0; i < runs; i++) {
    warm.push(build(tool, true));
    process.stdout.write(".");
  }
  console.log();

  results.push({
    name: tool.name,
    cold: median(cold),
    firstCached,
    warm: median(warm),
    size: dirSize(tool.dist),
  });
}

const sec = (ms) => `${(ms / 1000).toFixed(2)} с`;
const [rspack, webpack] = results;
const ratio = (key) => `${(webpack[key] / rspack[key]).toFixed(1)}×`;

console.log();
console.table({
  "Холодная сборка": { Rspack: sec(rspack.cold), webpack: sec(webpack.cold), "Rspack быстрее": ratio("cold") },
  "Первая сборка с записью кеша": {
    Rspack: sec(rspack.firstCached),
    webpack: sec(webpack.firstCached),
    "Rspack быстрее": ratio("firstCached"),
  },
  "Повторная сборка с кешем": { Rspack: sec(rspack.warm), webpack: sec(webpack.warm), "Rspack быстрее": ratio("warm") },
  "Размер dist": {
    Rspack: `${(rspack.size / 1024).toFixed(0)} КБ`,
    webpack: `${(webpack.size / 1024).toFixed(0)} КБ`,
    "Rspack быстрее": "",
  },
});
console.log("Время — медиана, включая запуск Node и CLI.");
