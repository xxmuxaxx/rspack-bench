import { EsbuildPlugin } from "esbuild-loader";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { resolve } from "node:path";

const dir = import.meta.dirname;
const useCache = process.env.BENCH_CACHE === "1";

// Те же задачи, что и в rspack.config.mjs: TS, CSS в отдельный файл, минификация JS и CSS.
// Компиляция и минификация идут через нативный esbuild, а не Babel/Terser,
// чтобы сравнивать сами сборщики, а не скорость JS-трансформеров.
export default {
  mode: "production",
  context: dir,
  entry: "./src/index.ts",
  output: { path: resolve(dir, "dist-webpack"), clean: true },
  resolve: { extensions: [".ts", ".js"] },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loader: "esbuild-loader",
        options: { loader: "ts", target: "es2020" },
      },
      { test: /\.css$/, use: [MiniCssExtractPlugin.loader, "css-loader"] },
    ],
  },
  plugins: [new HtmlWebpackPlugin(), new MiniCssExtractPlugin()],
  optimization: {
    minimizer: [new EsbuildPlugin({ target: "es2020", css: true })],
  },
  cache: useCache
    ? {
        type: "filesystem",
        buildDependencies: { config: [import.meta.filename] },
        cacheDirectory: resolve(dir, "../node_modules/.cache/webpack-bench"),
      }
    : false,
  devtool: false,
  performance: false,
  stats: "errors-warnings",
};
