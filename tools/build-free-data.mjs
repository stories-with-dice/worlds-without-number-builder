#!/usr/bin/env node
// Builds src/data/free.json from the FREE edition PDF of Worlds Without Number.
// Maintainer tool: the output is committed so the app works without any PDF.
// Usage: npm run data:free -- path/to/WorldsWithoutNumber_FreePDF.pdf
import fs from 'node:fs';
import path from 'node:path';
import { openBook } from './lib/pdftext.mjs';
import { detectEdition } from './lib/edition.mjs';
import { extractTables, extractMatrix, extractGrid, extractDefinitions, extractAssets, parseTags } from './lib/extract.mjs';
import { freeTables, freeMatrices, freeGrids, freeTags } from './manifest-free.mjs';

const pdf = process.argv[2] ?? 'WorldsWithoutNumber_FreePDF_Lightweight_040221.pdf';
const out = process.argv[3] ?? 'src/data/free.json';
const warnings = [];
const log = (m) => { warnings.push(m); console.warn(m); };

const book = await openBook(pdf);
const edition = await detectEdition(book);
if (edition !== 'free') {
  console.error(`Expected the FREE edition PDF, but ${pdf} looks like: ${edition}.`);
  console.error('Only free-edition content goes into the repository.');
  process.exit(1);
}

const tables = await extractTables(book, freeTables, log);
const matrices = {};
for (const m of freeMatrices) Object.assign(matrices, await extractMatrix(book, m.page, m));
const grids = {};
for (const g of freeGrids) Object.assign(grids, await extractGrid(book, g.page, g));

const tags = {};
for (const { kind, from, to } of freeTags) {
  tags[kind] = (await parseTags(book, from, to)).map(({ page, ...t }) => ({ ...t, page }));
  if (tags[kind].length !== 50) log(`WARN ${kind} tags: ${tags[kind].length}`);
}

// Factions (p324-335)
const factionTags = (await extractDefinitions(book, 325, 325)).filter((d) => d.name !== 'Attribute Checks');
const goals = await extractDefinitions(book, 327, 327);
const assetDescs = await extractDefinitions(book, 328, 333);
const assets = [
  ...(await extractAssets(book, 329, 'Cunning')),
  ...(await extractAssets(book, 331, 'Force')),
  ...(await extractAssets(book, 333, 'Wealth')),
];
for (const a of assets) {
  const d = assetDescs.find((x) => x.name.toLowerCase() === a.name.toLowerCase());
  if (d) a.text = d.text; else log(`WARN no description for asset ${a.name}`);
}

const data = {
  source: 'Worlds Without Number, free edition (Sine Nomine Publishing, 2021)',
  edition: 'free',
  generatedAt: new Date().toISOString().slice(0, 10),
  tables: { ...tables, ...matrices, ...grids },
  tags,
  factions: { tags: factionTags, goals, assets },
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data, null, 1));
console.log(`Wrote ${out}: ${Object.keys(data.tables).length} tables, ${Object.values(tags).flat().length} tags, ${assets.length} assets, ${factionTags.length} faction tags, ${goals.length} goals. ${warnings.length} warnings.`);
