// Renders a dungeon as a node graph of numbered rooms, like the book's stylized index-card map (p235).
import type { Dungeon } from '../types';

const COLORS: Record<string, string> = {
  Creature: '#e0604e', Hazard: '#e3a23b', Enigma: '#8e7cc3', Distractor: '#8aa0a8', Empty: '#d8d0bd',
};

export function renderDungeonSvg(d: Dungeon, cell = 70): string {
  const xs = d.rooms.map((r) => r.x), ys = d.rooms.map((r) => r.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const W = (Math.max(...xs) - minX + 1) * cell + cell / 2, H = (Math.max(...ys) - minY + 1) * cell + cell / 2;
  const pos = (n: number): [number, number] => {
    const r = d.rooms[n - 1];
    return [(r.x - minX) * cell + cell * 0.75, (r.y - minY) * cell + cell * 0.75];
  };
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Georgia, serif">`];
  out.push(`<rect width="100%" height="100%" fill="#f3ecdc"/>`);
  for (const l of d.links) {
    const [x1, y1] = pos(l.a), [x2, y2] = pos(l.b);
    const dash = l.kind === 'secret' ? 'stroke-dasharray="3 5"' : l.kind === 'hazard' ? 'stroke-dasharray="10 4"' : '';
    const color = l.kind === 'hazard' ? '#3f7fae' : '#4a3f33';
    out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${l.kind === 'hazard' ? 4 : 2.5}" ${dash}/>`);
    if (l.kind === 'secret') out.push(`<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 4}" font-size="11" text-anchor="middle" fill="#4a3f33">S</text>`);
  }
  for (const r of d.rooms) {
    const [x, y] = pos(r.n);
    const stairs = r.notes.some((n) => /Stairs/.test(n));
    out.push(`<g data-room="${r.n}" class="room"><rect x="${x - 17}" y="${y - 17}" width="34" height="34" rx="${r.n === 1 ? 17 : 4}" fill="${COLORS[r.contents] ?? '#ddd'}" stroke="#2b241c" stroke-width="${r.treasure ? 3 : 1.5}"/>`);
    out.push(`<text x="${x}" y="${y + 5}" font-size="15" text-anchor="middle" font-weight="bold" fill="#1b1712">${r.n}</text>`);
    if (r.treasure) out.push(`<text x="${x + 13}" y="${y - 10}" font-size="12" text-anchor="middle">◆</text>`);
    if (stairs) out.push(`<text x="${x - 13}" y="${y + 15}" font-size="12" text-anchor="middle">▼</text>`);
    out.push('</g>');
  }
  out.push('</svg>');
  return out.join('');
}

export const ROOM_COLORS = COLORS;
