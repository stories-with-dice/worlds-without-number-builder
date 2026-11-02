// Reads a Worlds Without Number PDF and returns its text as structured lines.
// The free-data build and the premium CLI both use this module.
import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Book page N is PDF page N + 3 in both the free and the Deluxe 2021 PDFs.
export const PAGE_OFFSET = 3;

// Short style codes for the fonts the book uses.
//   H  = heading/table title (FuturaPT-Medium)
//   B  = bold label, e.g. the E/F/C/T/P letters in tags (FuturaPT-Bold / Heavy)
//   SC = running header small caps (Ubuntu)
//   I  = italic
//   T  = body text
function styleOf(fontName = '') {
  if (/Ubuntu/i.test(fontName)) return 'SC';
  if (/Medium/i.test(fontName)) return 'H';
  if (/Bold|Heavy|Demi/i.test(fontName)) return 'B';
  if (/Italic|Oblique/i.test(fontName)) return 'I';
  return 'T';
}

/**
 * Opens a PDF and returns { numPages, getPage(bookPage) }.
 * getPage returns { cols: [Line[], Line[]] } where Line = { x, y, segs: [{ s, st, x }] }.
 */
export async function openBook(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await getDocument({ data, verbosity: 0, disableFontFace: true, useSystemFonts: false }).promise;
  const cache = new Map();

  async function getPdfPage(p, split = true) {
    const key = `${p}:${split}`;
    if (cache.has(key)) return cache.get(key);
    const page = await doc.getPage(p);
    await page.getOperatorList();
    const vp = page.getViewport({ scale: 1 });
    const mid = vp.width / 2;
    const content = await page.getTextContent();
    const cols = [new Map(), new Map()];
    for (const it of content.items) {
      if (!it.str || !it.str.trim()) continue;
      const x = it.transform[4];
      let y = Math.round(it.transform[5]);
      let fname = '';
      try { fname = page.commonObjs.get(it.fontName)?.name ?? ''; } catch { /* font not loaded */ }
      const col = !split || x < mid - 5 ? 0 : 1;
      // Snap to an existing line within 2pt. Row numbers are sometimes 1pt off their text.
      for (const k of cols[col].keys()) if (Math.abs(k - y) <= 2) { y = k; break; }
      if (!cols[col].has(y)) cols[col].set(y, []);
      cols[col].get(y).push({ x, w: it.width, s: it.str, st: styleOf(fname) });
    }
    const out = cols.map((m) => {
      const ys = [...m.keys()].sort((a, b) => b - a);
      return ys.map((y) => {
        const items = m.get(y).sort((a, b) => a.x - b.x);
        // Merge items into segments. A large gap starts a new segment (table cell).
        const segs = [];
        let end = null;
        for (const it of items) {
          const gap = end === null ? Infinity : it.x - end;
          const last = segs[segs.length - 1];
          // `parts` keeps every fragment with its x, so table code can re-split cells by column.
          const part = { x: it.x, s: it.s, sp: gap > 0.5 && gap !== Infinity, st: it.st };
          if (last && gap <= 11 && last.st === it.st) {
            last.s += (gap > 0.5 ? ' ' : '') + it.s;
            last.parts.push(part);
          } else if (last && gap <= 11) {
            segs.push({ s: (gap > 0.5 ? ' ' : '') + it.s, st: it.st, x: it.x, join: true, parts: [part] });
          } else {
            segs.push({ s: it.s, st: it.st, x: it.x, parts: [{ ...part, sp: false }] });
          }
          end = it.x + it.w;
        }
        return { x: items[0].x, y, segs };
      });
    });
    const res = { pdfPage: p, cols: split ? out : [out[0]] };
    cache.set(key, res);
    return res;
  }

  return {
    numPages: doc.numPages,
    getPdfPage,
    /** split=false reads the page as one column, for tables that span both columns. */
    getPage: (bookPage, split = true) => getPdfPage(bookPage + PAGE_OFFSET, split),
  };
}

/** Plain text of a line. Cells split by a wide gap are joined with " | ". */
export function lineText(line) {
  let t = '';
  for (const s of line.segs) t += t && !s.join ? ' | ' + s.s : s.s;
  return t.trim();
}

/** Text with style markers, for human review: ## heading, **bold**. */
export function lineMarkup(line) {
  let t = '';
  for (const s of line.segs) {
    let v = s.s;
    if (s.st === 'H') v = `«${v.trim()}»`;
    else if (s.st === 'B') v = `**${v.trim()}**`;
    else if (s.st === 'SC') v = `{${v.trim()}}`;
    t += t && !s.join ? ' | ' + v : v;
  }
  return t;
}
