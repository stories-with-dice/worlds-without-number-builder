// Renders the world as an SVG string. Used by the app and by the Obsidian PNG export.
import type { Site, SiteKind, World } from '../types';
import { center, corners, Grid, mapPixelSize, neighbors, sharedEdge, hexLabel } from '../gen/hex';
import { TERRAIN_INFO, isWater } from '../gen/terrain';
import { nameOf } from '../gen/world';

export interface MapLayers {
  borders: boolean;
  tint: boolean;
  rivers: boolean;
  roads: boolean;
  sites: boolean;
  siteLabels: boolean;
  nationLabels: boolean;
  featureLabels: boolean;
  coords: boolean;
}

export const DEFAULT_LAYERS: MapLayers = {
  borders: true, tint: true, rivers: true, roads: true, sites: true,
  siteLabels: true, nationLabels: true, featureLabels: true, coords: false,
};

export const SITE_STYLE: Record<SiteKind, { color: string; label: string; icon: string }> = {
  capital: { color: '#f4c542', label: 'Capital', icon: 'chess-rook' },
  city: { color: '#f2efe6', label: 'City', icon: 'city' },
  community: { color: '#e3c99a', label: 'Community', icon: 'home' },
  court: { color: '#c9a0dc', label: 'Court', icon: 'crown' },
  ruin: { color: '#e0604e', label: 'Ruin', icon: 'dungeon' },
  wilderness: { color: '#6fcf8f', label: 'Wilderness site', icon: 'tree' },
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pt = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

function glyph(t: string, x: number, y: number, s: number): string {
  const k = s / 30;
  const g = (d: string, extra = '') => `<path d="${d}" transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${k.toFixed(3)})" ${extra}/>`;
  switch (t) {
    case 'mountains': return g('M-12,7 L-3,-9 L4,3 L7,-2 L13,7 Z', 'fill="#6d6359" stroke="#4a423b" stroke-width="1"');
    case 'volcano': return g('M-12,8 L-4,-6 L4,-6 L12,8 Z M-3,-7 L-1,-13 M2,-7 L4,-12', 'fill="#5a352b" stroke="#e0604e" stroke-width="1.5"');
    case 'rollingHills': case 'rockyHills': return g('M-11,4 Q-6,-4 -1,4 M1,4 Q6,-4 11,4', `fill="none" stroke="${t === 'rockyHills' ? '#6e604a' : '#7b8550'}" stroke-width="1.8"`);
    case 'denseForest': case 'jungle': case 'rainForest': return g('M-8,6 L-4,-4 L0,6 Z M0,6 L4,-6 L8,6 Z M-4,9 L0,-1 L4,9 Z', 'fill="#2f5233" opacity="0.75"');
    case 'lightForest': return g('M-6,5 L-3,-3 L0,5 Z M3,5 L6,-3 L9,5 Z', 'fill="#4e6e3a" opacity="0.7"');
    case 'swamp': return g('M-10,2 L-4,2 M-2,6 L5,6 M2,-2 L9,-2 M-6,-1 L-6,-6 M4,3 L4,-3', 'stroke="#3d5a45" stroke-width="1.5" fill="none"');
    case 'sandDesert': return g('M-10,3 Q-5,-2 0,3 Q5,-2 10,3', 'stroke="#b8975a" stroke-width="1.5" fill="none"');
    case 'scrubDesert': return g('M-6,-3 h1 M3,-5 h1 M-2,4 h1 M6,3 h1 M-9,2 h1', 'stroke="#8b7650" stroke-width="2.5" stroke-linecap="round"');
    case 'canyons': return g('M-10,-4 L-3,2 L3,-3 L10,3', 'stroke="#7d4f30" stroke-width="2" fill="none"');
    case 'arratu': return g('M0,0 m-7,0 a7,7 0 1,0 14,0 a5,5 0 1,0 -10,0 a3,3 0 1,0 6,0', 'stroke="#4f2f63" stroke-width="1.5" fill="none"');
    case 'blasted': return g('M-8,-6 L8,6 M-8,6 L8,-6 M0,-8 L0,8', 'stroke="#5d5d52" stroke-width="1.2"');
    case 'megaplex': return g('M-9,6 V-4 H-3 V6 M-1,6 V-8 H5 V6 M7,6 V0', 'stroke="#5f5d6e" stroke-width="1.5" fill="none"');
    case 'pit': return g('M0,0 m-9,0 a9,6 0 1,0 18,0 a9,6 0 1,0 -18,0', 'fill="#121014"');
    case 'farmland': return g('M-9,-5 H9 M-9,0 H9 M-9,5 H9', 'stroke="#a49a52" stroke-width="1"');
    default: return '';
  }
}

function siteMarker(s: Site, x: number, y: number, size: number, selected: boolean): string {
  const st = SITE_STYLE[s.kind];
  const r = size * 0.2;
  const stroke = selected ? '#ffd84d' : '#1b1712';
  const sw = selected ? 2.5 : 1.2;
  const common = `fill="${st.color}" stroke="${stroke}" stroke-width="${sw}" data-site="${s.id}" class="site"`;
  switch (s.kind) {
    case 'capital': {
      const pts: string[] = [];
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const rr = k % 2 ? r * 0.55 : r * 1.35;
        pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`);
      }
      return `<polygon points="${pts.join(' ')}" ${common}/>`;
    }
    case 'city': return `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" ${common}/>`;
    case 'community': return `<circle cx="${x}" cy="${y}" r="${r * 0.85}" ${common}/>`;
    case 'court': return `<polygon points="${x},${y - r * 1.2} ${x + r},${y} ${x},${y + r * 1.2} ${x - r},${y}" ${common}/>`;
    case 'ruin': return `<polygon points="${x - r},${y - r * 0.8} ${x + r},${y - r * 0.8} ${x},${y + r}" ${common}/>`;
    case 'wilderness': return `<polygon points="${x},${y - r} ${x + r},${y + r * 0.8} ${x - r},${y + r * 0.8}" ${common}/>`;
  }
}

export function renderMapSvg(world: World, layers: MapLayers, size = 30, selectedSite?: string): string {
  const g: Grid = { cols: world.settings.cols, rows: world.settings.rows };
  const [W, H] = mapPixelSize(g, size);
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}" font-family="Georgia, 'Times New Roman', serif">`);
  out.push(`<rect width="100%" height="100%" fill="#1d2b36"/>`);
  const nationColor = Object.fromEntries(world.nations.map((n) => [n.id, n.color]));

  // Terrain
  out.push('<g class="terrain">');
  for (const h of world.hexes) {
    const [cx, cy] = center(g, h.i, size);
    const poly = corners(cx, cy, size).map(pt).join(' ');
    out.push(`<polygon points="${poly}" fill="${TERRAIN_INFO[h.terrain].color}" stroke="#00000022" stroke-width="0.8" data-hex="${h.i}"/>`);
  }
  out.push('</g>');
  if (layers.tint) {
    out.push('<g class="tint" pointer-events="none">');
    for (const h of world.hexes) {
      if (!h.nation || isWater(h.terrain)) continue;
      const [cx, cy] = center(g, h.i, size);
      out.push(`<polygon points="${corners(cx, cy, size).map(pt).join(' ')}" fill="${nationColor[h.nation]}" opacity="0.16"/>`);
    }
    out.push('</g>');
  }
  out.push('<g class="glyphs" pointer-events="none">');
  for (const h of world.hexes) {
    const [cx, cy] = center(g, h.i, size);
    out.push(glyph(h.terrain, cx, cy + size * 0.12, size));
  }
  out.push('</g>');

  if (layers.rivers) {
    out.push('<g class="rivers" pointer-events="none" fill="none" stroke="#3f7fae" stroke-linecap="round" stroke-linejoin="round">');
    for (const r of world.rivers) {
      const pts = r.map((i) => center(g, i, size));
      out.push(`<polyline points="${pts.map(pt).join(' ')}" stroke-width="${(size * 0.12).toFixed(1)}"/>`);
    }
    out.push('</g>');
  }
  if (layers.roads) {
    out.push(`<g class="roads" pointer-events="none" fill="none" stroke="#6b4423" stroke-width="${(size * 0.07).toFixed(1)}" stroke-dasharray="${size * 0.2} ${size * 0.12}" stroke-linecap="round">`);
    for (const r of world.roads) out.push(`<polyline points="${r.map((i) => center(g, i, size)).map(pt).join(' ')}"/>`);
    out.push('</g>');
  }
  if (layers.borders) {
    out.push('<g class="borders" pointer-events="none" stroke-linecap="round">');
    for (const h of world.hexes) {
      if (!h.nation) continue;
      for (const j of neighbors(g, h.i)) {
        const o = world.hexes[j];
        if (o.nation === h.nation || isWater(o.terrain)) continue;
        if (o.nation && o.i < h.i) continue; // draw shared borders once
        const [a, b] = sharedEdge(g, h.i, j, size);
        out.push(`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${nationColor[h.nation]}" stroke-width="${(size * 0.1).toFixed(1)}" stroke-dasharray="${o.nation ? `${size * 0.25} ${size * 0.12}` : 'none'}" opacity="0.9"/>`);
      }
    }
    out.push('</g>');
  }
  if (layers.coords) {
    out.push(`<g class="coords" pointer-events="none" font-size="${(size * 0.26).toFixed(1)}" fill="#00000088" text-anchor="middle" font-family="monospace">`);
    for (const h of world.hexes) {
      const [cx, cy] = center(g, h.i, size);
      out.push(`<text x="${cx.toFixed(1)}" y="${(cy - size * 0.55).toFixed(1)}">${hexLabel(g, h.i)}</text>`);
    }
    out.push('</g>');
  }
  if (layers.featureLabels) {
    out.push(`<g class="feature-labels" pointer-events="none" font-size="${(size * 0.38).toFixed(1)}" font-style="italic" fill="#1b1712" opacity="0.75" text-anchor="middle">`);
    for (const f of world.features) {
      const xs = f.hexes.map((i) => center(g, i, size));
      const x = xs.reduce((s, p) => s + p[0], 0) / xs.length, y = xs.reduce((s, p) => s + p[1], 0) / xs.length;
      out.push(`<text x="${x.toFixed(1)}" y="${(y + size * 0.75).toFixed(1)}" paint-order="stroke" stroke="#ffffff66" stroke-width="2">${esc(nameOf(world, f.id, f.name))}</text>`);
    }
    out.push('</g>');
  }

  if (layers.sites) {
    const byHex = new Map<number, Site[]>();
    for (const s of world.sites) byHex.set(s.hex, [...(byHex.get(s.hex) ?? []), s]);
    out.push('<g class="sites">');
    const labels: string[] = [];
    for (const [hex, list] of byHex) {
      const [cx, cy] = center(g, hex, size);
      list.forEach((s, k) => {
        const dx = list.length > 1 ? (k - (list.length - 1) / 2) * size * 0.45 : 0;
        out.push(siteMarker(s, cx + dx, cy, size, s.id === selectedSite));
      });
      if (layers.siteLabels) {
        const main = list.find((s) => s.kind === 'capital' || s.kind === 'city') ?? list[0];
        const big = main.kind === 'capital';
        labels.push(`<text x="${cx.toFixed(1)}" y="${(cy + size * 0.62).toFixed(1)}" font-size="${(size * (big ? 0.36 : 0.28)).toFixed(1)}" font-weight="${big ? 'bold' : 'normal'}">${esc(nameOf(world, main.id, main.name))}</text>`);
      }
    }
    out.push('</g>');
    out.push(`<g class="site-labels" pointer-events="none" text-anchor="middle" fill="#14110d" paint-order="stroke" stroke="#f5efdfcc" stroke-width="${(size * 0.09).toFixed(1)}" stroke-linejoin="round">${labels.join('')}</g>`);
  }

  if (layers.nationLabels) {
    out.push(`<g class="nation-labels" pointer-events="none" text-anchor="middle" font-weight="bold" letter-spacing="${(size * 0.12).toFixed(1)}" fill="#ffffff" opacity="0.85" paint-order="stroke" stroke-width="${(size * 0.12).toFixed(1)}" stroke-linejoin="round">`);
    for (const n of world.nations) {
      if (!n.hexes.length) continue;
      const ps = n.hexes.map((i) => center(g, i, size));
      const x = ps.reduce((s, p) => s + p[0], 0) / ps.length, y = ps.reduce((s, p) => s + p[1], 0) / ps.length;
      const fs = Math.min(size * 1.1, Math.max(size * 0.55, Math.sqrt(n.hexes.length) * size * 0.16));
      out.push(`<text x="${x.toFixed(1)}" y="${(y - size * 0.3).toFixed(1)}" font-size="${fs.toFixed(1)}" stroke="${n.color}">${esc(nameOf(world, n.id, n.name).toUpperCase())}</text>`);
    }
    out.push('</g>');
  }
  out.push(`<polygon id="hex-highlight" points="" fill="none" stroke="#ffd84d" stroke-width="${(size * 0.1).toFixed(1)}" pointer-events="none"/>`);
  out.push('</svg>');
  return out.join('');
}

export function hexPolygon(world: World, i: number, size = 30): string {
  const g: Grid = { cols: world.settings.cols, rows: world.settings.rows };
  const [cx, cy] = center(g, i, size);
  return corners(cx, cy, size).map(pt).join(' ');
}
