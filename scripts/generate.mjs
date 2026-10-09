// Генерирует синтетический проект в bench/src для замеров скорости сборки.
// Использование: node scripts/generate.mjs [число модулей] (по умолчанию 2000)
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const count = Number(process.argv[2] ?? 2000);
if (!Number.isInteger(count) || count < 1) {
  console.error("Число модулей должно быть целым положительным числом");
  process.exit(1);
}

const root = join(import.meta.dirname, "..", "bench", "src");
const PER_DIR = 100;

// Детерминированный ГПСЧ, чтобы при одинаковом N граф всегда был одинаковым
let seed = 42;
const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const name = (i) => `m${String(i).padStart(5, "0")}`;
const path = (i) => `${Math.floor(i / PER_DIR)}/${name(i)}`;
const relative = (from, to) => {
  const fromDir = Math.floor(from / PER_DIR);
  const toDir = Math.floor(to / PER_DIR);
  return fromDir === toDir ? `./${name(to)}` : `../${path(to)}`;
};

const lodashFns = ["chunk", "debounce", "groupBy", "sortBy", "uniq", "kebabCase", "merge", "range"];
const UTILS = 20;
const utilFns = ["format", "clamp", "hash", "pick"];

function moduleSource(i) {
  // Двоичное дерево модулей (0 -> 1, 2; 1 -> 3, 4; ...), как дерево компонентов,
  // плюс общий слой утилит (shared/), который импортируется отовсюду.
  const deps = [2 * i + 1, 2 * i + 2].filter((d) => d < count);
  const util = Math.floor(random() * UTILS);
  const utilFn = utilFns[Math.floor(random() * utilFns.length)];

  const fn = lodashFns[i % lodashFns.length];
  const lines = [
    `import { ${fn} } from "lodash-es";`,
    `import { ${utilFn} } from "../shared/util${String(util).padStart(2, "0")}";`,
  ];
  deps.forEach((d) => lines.push(`import { run as run${d} } from "${relative(i, d)}";`));
  if (i % 10 === 0) lines.push(`import "./${name(i)}.css";`);

  lines.push(
    "",
    `export interface Item${i} {`,
    "  id: number;",
    "  label: string;",
    "  tags: string[];",
    "}",
    "",
    `export class Store${i} {`,
    `  private items: Item${i}[] = [];`,
    "",
    `  add(label: string, tags: string[] = []): Item${i} {`,
    `    const item: Item${i} = { id: this.items.length + ${i}, label, tags };`,
    "    this.items.push(item);",
    "    return item;",
    "  }",
    "",
    "  find(predicate: (item: Item" + i + ") => boolean): Item" + i + " | undefined {",
    "    return this.items.find(predicate);",
    "  }",
    "",
    "  get size(): number {",
    "    return this.items.length;",
    "  }",
    "}",
    "",
    `export function compute${i}(values: number[]): number {`,
    "  return values.reduce((acc, value, index) => acc + value * (index + 1), 0) % 1000;",
    "}",
    "",
    "export function run(depth = 0): number {",
    `  const store = new Store${i}();`,
    `  store.add(\`item-${i}-\${depth}\`, ["${fn}", "generated"]);`,
    `  const used = ${fn} as unknown;`,
    `  let total = compute${i}([${i}, depth, store.size]) + (typeof used === "function" ? 1 : 0);`,
    `  total += ${utilFn}(total);`,
    ...deps.map((d) => `  total += run${d}(depth + 1);`),
    "  return total;",
    "}",
    "",
  );
  return lines.join("\n");
}

function cssSource(i) {
  const hue = (i * 37) % 360;
  return `.${name(i)} {
  color: hsl(${hue} 60% 40%);
  padding: ${(i % 8) + 4}px;
  border-radius: ${i % 12}px;
  display: flex;
  gap: 8px;
}

.${name(i)}:hover {
  background: hsl(${hue} 60% 95%);
  transform: translateY(-1px);
}
`;
}

function utilSource(u) {
  return `export const format = (value: number): number => Number(value.toFixed(${u % 4}));
export const clamp = (value: number, min = 0, max = ${1000 + u}): number => Math.min(max, Math.max(min, value));
export const hash = (value: number): number => ((value << 5) - value + ${u}) | 0;
export const pick = (value: number): number => [value, ${u}, value * 2][value % 3];
`;
}

rmSync(root, { recursive: true, force: true });
mkdirSync(join(root, "shared"), { recursive: true });
for (let u = 0; u < UTILS; u++) {
  writeFileSync(join(root, "shared", `util${String(u).padStart(2, "0")}.ts`), utilSource(u));
}
for (let i = 0; i < count; i++) {
  const dir = join(root, String(Math.floor(i / PER_DIR)));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name(i)}.ts`), moduleSource(i));
  if (i % 10 === 0) writeFileSync(join(dir, `${name(i)}.css`), cssSource(i));
}
writeFileSync(
  join(root, "index.ts"),
  `import { run } from "./${path(0)}";\n\ndocument.body.textContent = \`Результат: \${run()}\`;\n`,
);

console.log(`Сгенерировано ${count} TS-модулей и ${Math.ceil(count / 10)} CSS-файлов в bench/src`);
