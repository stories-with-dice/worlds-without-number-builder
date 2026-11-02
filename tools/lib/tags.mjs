// Parses tag entries: a heading, a description, then E/F/C/T/P lists
// (Enemies, Friends, Complications, Things, Places).
import { lineText } from './pdftext.mjs';

const KEYS = { E: 'enemies', F: 'friends', C: 'complications', T: 'things', P: 'places' };

function joinText(a, b) {
  if (!a) return b;
  if (/[a-z]-$/i.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + b;
  return a + ' ' + b;
}

/**
 * Splits "A thing, Another thing, A third" on commas that start a capitalized item.
 * Also splits on a period, or a comma with no space, because the book has a few such typos.
 */
export function splitList(s) {
  return s
    .split(/(?:[,.]\s+|,)(?=[A-Z“"'])/)
    .map((x) => x.trim().replace(/[.,]$/, ''))
    .filter(Boolean);
}

const allBold = (line) => line.segs.every((s) => s.st === 'B');

function plain(line) {
  return line.segs.map((s) => (s.join ? s.s : (s === line.segs[0] ? s.s : ' ' + s.s))).join('').replace(/\s+/g, ' ').trim();
}

/**
 * Parses tags from book pages [from, to]. Lines before the first tag heading are ignored.
 * Returns [{ name, description, enemies[], friends[], complications[], things[], places[] }].
 */
export async function parseTags(book, fromPage, toPage) {
  const tags = [];
  let cur = null;
  let field = null;
  for (let p = fromPage; p <= toPage; p++) {
    const pg = await book.getPage(p);
    for (const col of pg.cols) {
      for (const line of col) {
        const first = line.segs[0];
        if (line.segs.some((s) => s.st === 'SC')) continue; // running header
        const allHeading = line.segs.every((s) => s.st === 'H');
        const text = plain(line);
        if (allHeading && !/^d\d+/.test(text) && !/:$/.test(text)) {
          cur = { name: text, description: '', enemies: [], friends: [], complications: [], things: [], places: [], page: p };
          tags.push(cur);
          field = 'description';
          continue;
        }
        if (!cur) continue;
        const key = first.st === 'B' && KEYS[first.s.trim()];
        if (allBold(line) && !key) {
          // A bold title that is not an E/F/C/T/P label starts the next chapter of the book.
          cur = null;
          continue;
        }
        if (key) {
          field = key;
          cur[field] = [line.segs.slice(1).map((s) => s.s).join(' ').replace(/\s+/g, ' ').trim()];
          continue;
        }
        if (field === 'description') cur.description = joinText(cur.description, text);
        else if (field) cur[field][0] = joinText(cur[field][0], text);
      }
    }
  }
  for (const t of tags) {
    for (const k of Object.values(KEYS)) t[k] = t[k].length ? splitList(t[k][0]) : [];
    t.description = t.description.replace(/\*\*/g, '').trim();
  }
  return tags.filter((t) => t.enemies.length || t.friends.length);
}

export { lineText };
