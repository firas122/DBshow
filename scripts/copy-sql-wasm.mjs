import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules", "sql.js", "dist");
const destDir = join(root, "public", "sql-wasm");

// sql.js is loaded at runtime from /public via a <script> tag rather than bundled,
// so the emscripten glue never hits webpack's node-builtin resolution.
const files = ["sql-wasm.js", "sql-wasm.wasm"];

if (!existsSync(srcDir)) {
  console.warn("[copy-sql-wasm] sql.js not installed yet; skipping.");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
for (const file of files) {
  const src = join(srcDir, file);
  if (!existsSync(src)) {
    console.warn(`[copy-sql-wasm] missing ${file}; skipping.`);
    continue;
  }
  copyFileSync(src, join(destDir, file));
  console.log(`[copy-sql-wasm] wrote public/sql-wasm/${file}`);
}
