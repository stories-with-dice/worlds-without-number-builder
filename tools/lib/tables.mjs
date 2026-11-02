// Parses the book's random tables ("dN | Title" header, numbered rows) from structured lines.
import { lineText } from './pdftext.mjs';

const DIE_RE = /^(\d*d\d+)(?:\s+(.*))?$/i;
const NUM_RE = /^(\d+)(?:\s*[–-]\s*(\d+))?$/;

/** Turns segments into cells split by wide gaps. Bold text is wrapped as **x**. */
function segsToCells(segs) {
  const cells = [];
  for (const s of segs) {
    const v = s.st === 'B' ? `**${s.s.trim()}**` + (s.s.endsWith(' ') ? ' ' : '') : s.s;
    const prev = cells[cells.length - 1];
    const prevIsNum = prev && prev.st === 'H' && NUM_RE.test(prev.s.trim()) && s.st !== 'H';
    if (s.join && prev && !prevIsNum) prev.s += v;
    else cells.push({ s: s.join ? v.trimStart() : v, x: s.x, st: s.st });
  }
  return cells.map((c) => ({ ...c, s: c.s.replace(/\*\*\s*\*\*/g, ' ').replace(/\s+/g, ' ').trim() }));
}

/** All text fragments of a line after the first `skip` cells, with x positions. */
function partsAfter(segs, skipNumber) {
  const parts = [];
  segs.forEach((seg, i) => {
    if (skipNumber && i === 0) return;
    for (const p of seg.parts ?? [{ x: seg.x, s: seg.s, sp: false, st: seg.st }]) {
      parts.push({ ...p, s: p.st === 'B' ? `**${p.s.trim()}**` : p.s });
    }
  });
  // A row number glued to its text ("23–24 Demihuman Populace") arrives as one H fragment.
  return parts;
}

function rowRange(m) {
  let a = +m[1];
  let b = m[2] !== undefined ? +m[2] : a;
  if (m[1] === '00') a = 100;
  if (m[2] === '00') b = 100;
  if (m[2] === '0') b = 10;
  return [a, b];
}

function joinText(a, b, sp = true) {
  if (!a) return b;
  if (/[a-z]-$/i.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + b; // re-join hyphenated words
  return a + (sp ? ' ' : '') + b;
}

/** Assigns fragments to columns: the right-most anchor at or left of the fragment. */
function distribute(parts, anchors, cells) {
  for (const p of parts) {
    let idx = 0;
    for (let i = 0; i < anchors.length; i++) if (p.x >= anchors[i] - 4) idx = i;
    const cur = cells[idx] ?? '';
    cells[idx] = cur ? joinText(cur, p.s.trimStart(), p.sp || !cur.endsWith(' ')) : p.s.trimStart();
  }
}

/**
 * Finds every table in one column of lines.
 * Returns [{ die, dieSize, titles: [..], rows: [{ range:[a,b], cells:[..] }] }].
 */
export function parseTablesInColumn(lines) {
  const tables = [];
  let cur = null;
  let lastY = null;

  const finish = () => {
    if (!cur) return;
    // Column anchors: the cell x positions of the row with the most cells.
    let anchors = [];
    for (const r of cur.raw) {
      const xs = segsToCells(r.lines[0].segs).slice(1).map((c) => c.x);
      if (xs.length > anchors.length) anchors = xs;
    }
    if (!anchors.length) anchors = [cur.numX + 15];
    cur.rows = cur.raw.map((r) => {
      const cells = [];
      r.lines.forEach((l, i) => distribute(partsAfter(l.segs, i === 0 && !r.glued), anchors, cells));
      if (r.glued) cells[0] = (cells[0] ?? '').replace(/^\d+(\s*[–-]\s*\d+)?\s*/, '');
      return { range: r.range, cells: cells.map((c) => (c ?? '').replace(/\*\*\s*\*\*/g, ' ').replace(/\s+/g, ' ').trim()) };
    });
    delete cur.raw;
    cur = null;
  };

  for (const line of lines) {
    const cells = segsToCells(line.segs);
    const first = cells[0]?.s ?? '';
    const headerSeg = line.segs[0];
    const dm = first.match(DIE_RE);
    if (headerSeg?.st === 'H' && dm) {
      finish();
      // Header. Extra die cells (side-by-side tables) are kept as titles too.
      const titles = [];
      if (dm[2]) titles.push(dm[2].trim());
      for (const c of cells.slice(1)) titles.push(c.s);
      const dieSize = +dm[1].split('d')[1] || 100; // "d00" is a d100
      cur = { die: dm[1].toLowerCase(), dieSize, titles, numX: line.x, raw: [] };
      tables.push(cur);
      lastY = line.y;
      continue;
    }
    if (!cur) continue;
    const gap = lastY === null ? 0 : lastY - line.y;
    let rm = first.match(NUM_RE);
    let glued = false;
    if (!rm && line.segs[0].st === 'H') {
      // "23–24 Demihuman Populace": number and text in one cell.
      const g = first.match(/^(\d+)(?:\s*[–-]\s*(\d+))?\s+\S/);
      if (g) { rm = g; glued = true; }
    }
    if (rm && Math.abs(line.x - cur.numX) < 14 && gap < 40) {
      const textX = glued ? line.x + 15 : cells[1]?.x;
      if (cur.textX === undefined && textX !== undefined) cur.textX = textX;
      cur.raw.push({ range: rowRange(rm), lines: [line], glued });
      lastY = line.y;
      continue;
    }
    const last = cur.raw[cur.raw.length - 1];
    // Continuation: indented past the number column and close to the previous line.
    if (last && line.x > cur.numX + 8 && line.x >= (cur.textX ?? 0) - 4 && gap < 18) {
      last.lines.push(line);
      lastY = line.y;
      continue;
    }
    finish();
  }
  finish();
  for (const t of tables) delete t.numX;
  return tables.filter((t) => t.rows.length > 0);
}

/** Parses all tables on a range of book pages. Adds `page` to each table. */
export async function parseTables(book, fromPage, toPage, split = true) {
  const out = [];
  for (let p = fromPage; p <= toPage; p++) {
    const pg = await book.getPage(p, split);
    for (const col of pg.cols) {
      for (const t of parseTablesInColumn(col)) out.push({ page: p, ...t });
    }
  }
  return out;
}

/** Splits "**Name**. Description" into { name, text }. Leaves plain text as { text }. */
export function splitBoldName(s) {
  const m = s.match(/^\*\*(.+?)\*\*\s*[.:]?\s*(.*)$/);
  if (m) return { name: m[1].replace(/[.:]$/, '').trim(), text: m[2].replace(/\*\*/g, '').trim() };
  return { text: s.replace(/\*\*/g, '').trim() };
}

export { lineText };
