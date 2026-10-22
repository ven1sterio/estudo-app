// scripts/copy-pdf-worker.mjs
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const candidates = [
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
];

const destino = resolve("public/pdf.worker.min.mjs");
mkdirSync(dirname(destino), { recursive: true });

for (const origem of candidates) {
  if (existsSync(origem)) {
    copyFileSync(origem, destino);
    console.log(`✓ pdf.worker.min.mjs copiado de ${origem}`);
    process.exit(0);
  }
}

console.error("✗ pdf.worker.min.mjs não encontrado em node_modules/pdfjs-dist");
process.exit(1);