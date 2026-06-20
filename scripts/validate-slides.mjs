import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const files = [
  "modulo-1-intro-setup.html",
  "modulo-2-rotas-layouts.html",
  "modulo-3-componentes-client.html",
  "modulo-4-dados-deploy.html",
];

for (const file of files) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  const passos = [...html.matchAll(/Passo (\d+)\/(\d+)/g)].map((m) => Number(m[1]));
  const totals = [...new Set([...html.matchAll(/Passo \d+\/(\d+)/g)].map((m) => m[1]))];
  const deckStart = html.indexOf('<div class="slides-deck">');
  const deckEnd = html.indexOf("</div>\n\n<script");
  const inner = html.slice(deckStart, deckEnd);
  const opens = (inner.match(/<div/g) || []).length;
  const closes = (inner.match(/<\/div>/g) || []).length;
  const ok = passos.length === 20 && totals.length === 1 && totals[0] === "20" && opens === closes;
  console.log(`${file}: ${ok ? "OK" : "FAIL"} — ${passos.length} passos, div ${opens}/${closes}`);
}
