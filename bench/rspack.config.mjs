import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import { resolve } from "node:path";

const dir = import.meta.dirname;
const useCache = process.env.BENCH_CACHE === "1";

export default defineConfig({
  mode: "production",
  context: dir,
  entry: "./src/index.ts",
  output: { path: resolve(dir, "dist-rspack"), clean: true },
  resolve: { extensions: [".ts", ".js"] },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loader: "builtin:swc-loader",
        options: { jsc: { parser: { syntax: "typescript" }, target: "es2020" } },
        type: "javascript/auto",
      },
      { test: /\.css$/, type: "css" },
    ],
  },
  plugins: [new rspack.HtmlRspackPlugin()],
  cache: useCache
    ? {
        type: "persistent",
        buildDependencies: [import.meta.filename],
        storage: { type: "filesystem", directory: resolve(dir, "../node_modules/.cache/rspack-bench") },
      }
    : false,
  devtool: false,
  performance: false,
  stats: "errors-warnings",
});
