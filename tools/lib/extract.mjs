// Turns a manifest of { id, page, title, ... } entries into clean JSON tables.
import { parseTables, splitBoldName } from './tables.mjs';
import { parseTags } from './tags.mjs';

const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

function cleanText(s) {
  return s.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

/** Row → { min, max, text, name? }. Bold leading names become `name`. */
function toEntry(range, cell) {
  const { name, text } = splitBoldName(cell ?? '');
  const e = { min: range[0], max: range[1], text: cleanText(text) };
  if (name) e.name = cleanText(name);
  return e;
}

function rangeOf(s) {
  const m = String(s).replace(/«|»/g, '').match(/(\d+)(?:\s*[–-]\s*(\d+))?/);
  if (!m) return null;
  let a = +m[1], b = m[2] !== undefined ? +m[2] : a;
  if (m[1] === '00') a = 100;
  if (m[2] === '00' || m[2] === '0') b = m[2] === '0' ? 10 : 100;
  return [a, b];
}

/**
 * Reads the tables in `manifest` from `book`. Each entry:
 *   { id, page, title, nth?, col?, full?, sideBySide? }
 * - title: prefix of the table title (case-insensitive).
 * - nth: which match on the page (default 0).
 * - col: which text column of a multi-column table to take.
 * - full: read the page as one column (tables spanning both columns).
 * - sideBySide: two halves of one table printed side by side (A | dN | A).
 */
export async function extractTables(book, manifest, log = () => {}) {
  const pageCache = new Map();
  const out = {};
  for (const m of manifest) {
    const key = `${m.page}:${!m.full}`;
    if (!pageCache.has(key)) pageCache.set(key, await parseTables(book, m.page, m.page, !m.full));
    const candidates = pageCache.get(key).filter((t) => t.titles.some((ti) => norm(ti).startsWith(norm(m.title))));
    const t = candidates[m.nth ?? 0];
    if (!t) { log(`MISSING ${m.id} (p${m.page} "${m.title}")`); continue; }
    let rows;
    if (m.sideBySide) {
      rows = [];
      for (const r of t.rows) {
        rows.push(toEntry(r.range, r.cells[0]));
        const rr = rangeOf(r.cells[1] ?? '');
        if (rr && r.cells[2]) rows.push(toEntry(rr, r.cells[2]));
      }
      rows.sort((a, b) => a.min - b.min);
    } else {
      rows = t.rows.map((r) => toEntry(r.range, r.cells[m.col ?? 0]));
    }
    const die = t.dieSize;
    const covered = rows.reduce((n, r) => n + r.max - r.min + 1, 0);
    if (covered !== die) log(`WARN ${m.id}: rows cover ${covered} of d${die}`);
    if (rows.some((r) => !r.text)) log(`WARN ${m.id}: empty row text`);
    out[m.id] = { title: m.label ?? (m.col !== undefined ? t.titles[m.col] : t.titles[0]), die, page: m.page, rows };
  }
  return out;
}

/**
 * Parses a "d6 group × d12 entry" matrix such as Types of Ruin Sites (p238).
 * Left column holds group labels and entries 1-6; right column holds 7-12, in group order.
 */
export async function extractMatrix(book, page, { id, title, groupMaxX = 150 }) {
  const pg = await book.getPage(page);
  const rowRe = /^\d+$/;
  const groups = [];
  const left = [];
  const right = [];
  pg.cols.forEach((col, ci) => {
    for (const l of col) {
      const n = l.segs[0]?.s.trim();
      if (!rowRe.test(n ?? '') || l.segs[0].st !== 'H') continue;
      const text = cleanText(l.segs.slice(1).map((s) => s.s).join(' '));
      if (ci === 0 && l.x < groupMaxX) groups.push(text);
      else if (ci === 0) left.push(text);
      else right.push(text);
    }
  });
  const result = groups.map((name, gi) => ({
    name,
    entries: [...left.slice(gi * 6, gi * 6 + 6), ...right.slice(gi * 6, gi * 6 + 6)],
  }));
  return { [id]: { title, page, groups: result } };
}

/** Parses "«Name:» description" paragraphs between pages. Stops at a heading with no colon. */
export async function extractDefinitions(book, from, to, { skip = [] } = {}) {
  const defs = [];
  let cur = null;
  for (let p = from; p <= to; p++) {
    const pg = await book.getPage(p);
    for (const col of pg.cols) {
      for (const l of col) {
        if (l.segs.some((s) => s.st === 'SC')) continue;
        const f = l.segs[0];
        if (f.st === 'H' && /:\s*$/.test(f.s)) {
          cur = { name: f.s.replace(/:\s*$/, '').trim(), text: l.segs.slice(1).map((s) => s.s).join(' ') , page: p };
          defs.push(cur);
          continue;
        }
        if (f.st === 'H' || l.segs.every((s) => s.st === 'B')) { cur = null; continue; }
        if (cur) {
          const t = l.segs.map((s) => s.s).join(' ');
          cur.text = /[a-z]-$/i.test(cur.text) && /^[a-z]/.test(t) ? cur.text.slice(0, -1) + t : cur.text + ' ' + t;
        }
      }
    }
  }
  return defs
    .filter((d) => !skip.includes(d.name))
    .map((d) => ({ name: d.name, text: cleanText(d.text), page: d.page }));
}

/** Parses faction asset stat blocks (full-width pages with Cost/HP/Magic/Attack/Counter/Qualities). */
export async function extractAssets(book, page, attribute) {
  const pg = await book.getPage(page, false);
  const assets = [];
  let rating = null;
  for (const l of pg.cols[0]) {
    const segs = l.segs;
    const first = segs[0]?.s.trim() ?? '';
    const g = first.match(new RegExp(`^${attribute}\\s+(\\d)$`, 'i'));
    if (segs[0]?.st === 'B' && g) { rating = +g[1]; continue; }
    if (segs[0]?.st !== 'B' || !rating) continue;
    const cells = [];
    for (const s of segs) {
      if (s.join && cells.length) cells[cells.length - 1] += s.s; else cells.push(s.s);
    }
    if (cells.length < 7) continue;
    const [name, cost, hp, magic, attack, counter, qualities] = cells.map((c) => c.trim());
    assets.push({
      name, attribute, rating, cost: +cost, hp: +hp, magic, attack, counter,
      qualities: qualities.split(/,\s*/).filter(Boolean),
    });
  }
  return assets;
}

/** Parses numbered paragraphs "**N.** text" (fractal adventure seeds). */
export async function extractNumbered(book, from, to) {
  const items = [];
  let cur = null;
  for (let p = from; p <= to; p++) {
    const pg = await book.getPage(p);
    for (const col of pg.cols) {
      for (const l of col) {
        if (l.segs.some((s) => s.st === 'SC')) continue;
        const f = l.segs[0];
        const m = f.st === 'B' && f.s.trim().match(/^(\d+)\.(.*)$/);
        if (m) {
          cur = { n: +m[1], x: l.x, text: (m[2] + ' ' + l.segs.slice(1).map((s) => s.s).join(' ')).trim() };
          items.push(cur);
          continue;
        }
        if (f.st === 'H' || f.st === 'B') { cur = null; continue; }
        // Continuation lines are indented past the number.
        if (cur && l.x > cur.x + 8) {
          const t = l.segs.map((s) => s.s).join(' ');
          cur.text = /[a-z]-$/i.test(cur.text) && /^[a-z]/.test(t) ? cur.text.slice(0, -1) + t : cur.text + ' ' + t;
        } else cur = null;
      }
    }
  }
  return items.map((i) => ({ n: i.n, text: cleanText(i.text) }));
}

export { parseTags };
