import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, "popup"), { recursive: true });
await mkdir(path.join(dist, "icons"), { recursive: true });

const common = {
  bundle: true,
  sourcemap: false,
  minify: true,
  target: "chrome120",
  platform: "browser",
  logLevel: "info"
};

await Promise.all([
  build({
    ...common,
    entryPoints: [path.join(root, "src/content/index.ts")],
    outfile: path.join(dist, "content.js"),
    format: "iife"
  }),
  build({
    ...common,
    entryPoints: [path.join(root, "src/background/index.ts")],
    outfile: path.join(dist, "background.js"),
    format: "iife"
  }),
  build({
    ...common,
    entryPoints: [path.join(root, "src/offscreen/index.ts")],
    outfile: path.join(dist, "offscreen.js"),
    format: "iife"
  }),
  build({
    ...common,
    entryPoints: [path.join(root, "src/popup/index.tsx")],
    outfile: path.join(dist, "popup/index.js"),
    format: "iife",
    loader: { ".css": "css" }
  })
]);

await Promise.all([
  cp(path.join(root, "public/manifest.json"), path.join(dist, "manifest.json")),
  cp(path.join(root, "public/offscreen.html"), path.join(dist, "offscreen.html")),
  cp(path.join(root, "public/icons/icon128.png"), path.join(dist, "icons/icon128.png"))
]);

const popupHtml = await readFile(path.join(root, "public/popup.html"), "utf8");
await writeFile(path.join(dist, "popup/index.html"), popupHtml, "utf8");

console.log(`Built extension at ${dist}`);
