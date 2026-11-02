// Dev helper: lists every table found in a page range.
import { openBook } from './lib/pdftext.mjs';
import { parseTables } from './lib/tables.mjs';
const [, , pdf, from, to, mode] = process.argv;
const book = await openBook(pdf);
const tables = await parseTables(book, +from, +to, mode !== "full");
for (const t of tables) {
  const covered = t.rows.reduce((n, r) => n + r.range[1] - r.range[0] + 1, 0);
  const flag = covered === t.dieSize ? '' : `  !! covers ${covered}`;
  console.log(`p${t.page} ${t.die} [${t.titles.join(' / ')}] rows=${t.rows.length} cols=${Math.max(...t.rows.map(r=>r.cells.length))}${flag}`);
}
