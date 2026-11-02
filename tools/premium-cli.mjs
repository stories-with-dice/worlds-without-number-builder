#!/usr/bin/env node
// Extracts the Deluxe-only tables the app uses from YOUR OWN copy of the
// Worlds Without Number Deluxe PDF and writes them as JSON.
//
//   npm run premium -- path/to/WorldsWithoutNumber_DeluxePDF.pdf [--out public/data/premium.json]
//
// The output stays on your machine. It is in .gitignore; do not commit or share it.
import fs from 'node:fs';
import path from 'node:path';
import { openBook } from './lib/pdftext.mjs';
import { detectEdition } from './lib/edition.mjs';
import { extractTables, extractNumbered } from './lib/extract.mjs';
import { premiumTables, premiumSeeds } from './manifest-premium.mjs';

const args = process.argv.slice(2);
if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: npm run premium -- <Deluxe PDF> [--out <file>]

Reads your own copy of the Worlds Without Number Deluxe PDF and writes the
premium tables (Iterums, Additional GM Tools, fractal adventure seeds, random
NPCs) as JSON. Default output: premium/premium.json, which the app loads
automatically when you run it with "npm run dev". You can also load the file
in the app with "Load premium.json".`);
  process.exit(args.length ? 0 : 1);
}
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : 'premium/premium.json';
const pdf = args.find((a, i) => !a.startsWith('--') && (outIdx < 0 || i !== outIdx + 1));
if (!pdf || !fs.existsSync(pdf)) { console.error(`PDF not found: ${pdf}`); process.exit(1); }

const book = await openBook(pdf);
const edition = await detectEdition(book);
if (edition !== 'deluxe') {
  console.error(`This does not look like the Deluxe edition (detected: ${edition}).`);
  console.error('The premium tables only exist in the Deluxe PDF.');
  process.exit(1);
}

const problems = [];
const tables = await extractTables(book, premiumTables, (m) => { problems.push(m); console.warn(m); });

const seedList = await extractNumbered(book, premiumSeeds.from, premiumSeeds.to);
const kinds = ['enemy', 'friend', 'complication', 'thing', 'place'];
const seeds = Object.fromEntries(kinds.map((k) => [k, []]));
for (const s of seedList) {
  if (s.n < 1 || s.n > 100) continue;
  seeds[kinds[Math.floor((s.n - 1) / 20)]].push(s);
}
for (const k of kinds) if (seeds[k].length !== 20) { const m = `WARN ${k} seeds: ${seeds[k].length} of 20`; problems.push(m); console.warn(m); }

const data = {
  source: 'Worlds Without Number, Deluxe edition (Sine Nomine Publishing, 2021). Extracted from the user\'s own copy. Do not redistribute.',
  edition: 'deluxe',
  version: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  tables,
  seeds,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data));
console.log(`Wrote ${out}: ${Object.keys(tables).length}/${premiumTables.length} tables, ${seedList.length} seeds, ${problems.length} warnings.`);
console.log('Start the app with "npm run dev" to use it, or load the file with "Load premium.json" in the app.');
