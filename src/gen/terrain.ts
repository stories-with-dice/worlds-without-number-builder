// Regional map generation, following "Making the Regional Map" (WWN p120-121):
// 1. Decide how many sides are ocean.
// 2. Place about six significant terrain features (d20 table, p121).
// 3. Sketch 1d4+2 major rivers from highlands to the sea.
// 4. Optionally add one to three lakes.
import { Rng } from '../rng';
import { roll, rollRow, table } from '../data';
import type { Fact, Hex, Settings, Terrain, TerrainFeature } from '../types';
import { center, colOf, dijkstra, distance, Grid, neighbors, pathTo, rowOf } from './hex';
import { word } from '../names';

export const TERRAIN_INFO: Record<Terrain, { label: string; color: string; water?: boolean; rough?: number }> = {
  ocean: { label: 'Ocean', color: '#2f5f7f', water: true },
  lake: { label: 'Lake', color: '#4a83a6', water: true },
  grassland: { label: 'Grassland', color: '#b9c27a', rough: 1 },
  farmland: { label: 'Ancient farmland', color: '#d2cf86', rough: 1 },
  lightForest: { label: 'Light forest', color: '#8fae63', rough: 1.5 },
  denseForest: { label: 'Dense forest', color: '#4f7a45', rough: 3 },
  jungle: { label: 'Jungle', color: '#3f7a3a', rough: 3 },
  rainForest: { label: 'Rain forest', color: '#2f6b4a', rough: 3 },
  rollingHills: { label: 'Rolling hills', color: '#a9b06a', rough: 2 },
  rockyHills: { label: 'Rocky hills', color: '#a39271', rough: 3 },
  mountains: { label: 'Mountains', color: '#8a7f73', rough: 8 },
  volcano: { label: 'Volcano', color: '#7a4a3c', rough: 12 },
  sandDesert: { label: 'Sand desert', color: '#e2c98a', rough: 5 },
  scrubDesert: { label: 'Scrub desert', color: '#cdb27f', rough: 3 },
  swamp: { label: 'Swamp', color: '#6f8a6a', rough: 4 },
  canyons: { label: 'Canyons', color: '#b5835a', rough: 4 },
  arratu: { label: 'Arratu wasteland', color: '#8e6aa0', rough: 10 },
  blasted: { label: 'Blasted lands', color: '#8a8a7a', rough: 8 },
  megaplex: { label: 'Megaplex ruins', color: '#9c9aa8', rough: 4 },
  pit: { label: 'Pit', color: '#3c3a40', rough: 99 },
};

export const isWater = (t: Terrain) => !!TERRAIN_INFO[t].water;
export const isHighland = (t: Terrain) => t === 'mountains' || t === 'volcano' || t === 'rockyHills' || t === 'rollingHills';

// --- noise ---------------------------------------------------------------

function makeNoise(rng: Rng) {
  const perm = rng.shuffle([...Array(256).keys()]);
  const vals = Array.from({ length: 256 }, () => rng.next());
  const at = (x: number, y: number) => vals[perm[(perm[x & 255] + y) & 255]];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const value = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const tx = smooth(x - xi), ty = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  return (x: number, y: number, octaves = 4) => {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += value(x * freq, y * freq) * amp;
      norm += amp; amp *= 0.5; freq *= 2;
    }
    return sum / norm;
  };
}

function quantile(values: number[], q: number): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))];
}

// --- feature handling ----------------------------------------------------

/** How each d20 "Significant Terrain Features" result changes the map. */
const FEATURE_PLAN: Record<string, { terrain: Terrain; shape: 'blob' | 'ridge' | 'islands' | 'pit' | 'volcano'; nouns: string[] }> = {
  'Ancient farmland': { terrain: 'farmland', shape: 'blob', nouns: ['Fields', 'Terraces', 'Granaries'] },
  'Arratu wasteland': { terrain: 'arratu', shape: 'blob', nouns: ['Arratu', 'Blight', 'Wastes'] },
  'Blasted lands': { terrain: 'blasted', shape: 'blob', nouns: ['Scar', 'Ashlands', 'Burnt Lands'] },
  Canyons: { terrain: 'canyons', shape: 'blob', nouns: ['Canyons', 'Gorges', 'Breaks'] },
  'Dense forest': { terrain: 'denseForest', shape: 'blob', nouns: ['Forest', 'Weald', 'Darkwood'] },
  Grasslands: { terrain: 'grassland', shape: 'blob', nouns: ['Plains', 'Steppe', 'Savanna'] },
  Islands: { terrain: 'lightForest', shape: 'islands', nouns: ['Isles', 'Archipelago', 'Island'] },
  'Jagged mountains': { terrain: 'mountains', shape: 'ridge', nouns: ['Mountains', 'Teeth', 'Spires'] },
  Jungle: { terrain: 'jungle', shape: 'blob', nouns: ['Jungle', 'Green Hell', 'Tangle'] },
  'Light forest': { terrain: 'lightForest', shape: 'blob', nouns: ['Woods', 'Groves', 'Copse'] },
  Megaplex: { terrain: 'megaplex', shape: 'blob', nouns: ['Megaplex', 'Endless Halls', 'Vault'] },
  Pit: { terrain: 'pit', shape: 'pit', nouns: ['Pit', 'Abyss', 'Maw'] },
  'Rain forest': { terrain: 'rainForest', shape: 'blob', nouns: ['Rainforest', 'Mistwood', 'Canopy'] },
  'Rocky hills': { terrain: 'rockyHills', shape: 'blob', nouns: ['Crags', 'Hills', 'Tors'] },
  'Rolling hills': { terrain: 'rollingHills', shape: 'blob', nouns: ['Downs', 'Hills', 'Wolds'] },
  'Sand desert': { terrain: 'sandDesert', shape: 'blob', nouns: ['Desert', 'Dunes', 'Sands'] },
  'Scrub desert': { terrain: 'scrubDesert', shape: 'blob', nouns: ['Barrens', 'Scrublands', 'Drylands'] },
  Swamp: { terrain: 'swamp', shape: 'blob', nouns: ['Fen', 'Marsh', 'Mire'] },
  Volcano: { terrain: 'volcano', shape: 'volcano', nouns: ['Fire Mountain', 'Smokepeak', 'Burning Peaks'] },
  'Weathered mountains': { terrain: 'mountains', shape: 'ridge', nouns: ['Mountains', 'Old Peaks', 'Range'] },
};

/** The one-roll terrain feature detail tables (p123). */
export function featureFacts(rng: Rng): Fact[] {
  return [
    { label: 'Danger', text: roll('geo.feature.danger', rng), ref: 'geo.feature.danger' },
    { label: 'Use', text: roll('geo.feature.use', rng), ref: 'geo.feature.use' },
    { label: 'Last event', text: roll('geo.feature.event', rng), ref: 'geo.feature.event' },
    { label: 'Population', text: roll('geo.feature.population', rng), ref: 'geo.feature.population' },
    { label: 'Common antagonists', text: roll('geo.feature.antagonists', rng), ref: 'geo.feature.antagonists' },
    ...(rng.chance(0.6) ? [{ label: 'Quirk', text: roll('geo.feature.quirk', rng), ref: 'geo.feature.quirk' }] : []),
  ];
}

const SIDES = ['north', 'east', 'south', 'west'] as const;

export interface TerrainResult {
  hexes: Hex[];
  rivers: number[][];
  features: TerrainFeature[];
  oceanSides: string[];
}

export function generateTerrain(settings: Settings, seed: string, regionStyle: string): TerrainResult {
  const rng = new Rng(seed);
  const g: Grid = { cols: settings.cols, rows: settings.rows };
  const n = g.cols * g.rows;
  const areaScale = n / 320;

  // 1. Ocean sides.
  let sideCount = settings.oceanSides;
  if (sideCount < 0) sideCount = rng.weighted([[1, 5], [2, 4], [3, 1]]);
  let oceanSides: string[] = [];
  if (sideCount === 2 && rng.chance(0.75)) {
    const s = rng.int(0, 3);
    oceanSides = [SIDES[s], SIDES[(s + 1) % 4]]; // a curving coastline
  } else {
    oceanSides = rng.shuffle([...SIDES]).slice(0, sideCount);
  }

  // Elevation and moisture from noise, lowered toward the ocean sides.
  const elevNoise = makeNoise(rng.child('elev'));
  const moistNoise = makeNoise(rng.child('moist'));
  const scale = 6 / Math.max(g.cols, g.rows);
  const ox = rng.int(0, 1000), oy = rng.int(0, 1000);
  const elev: number[] = [];
  const moist: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = colOf(g, i), r = rowOf(g, i) + (c & 1) * 0.5;
    let e = elevNoise(ox + c * scale, oy + r * scale);
    const u = c / (g.cols - 1), v = r / (g.rows - 0.5);
    for (const side of oceanSides) {
      const d = side === 'north' ? v : side === 'south' ? 1 - v : side === 'west' ? u : 1 - u;
      const f = Math.min(1, d / 0.38);
      e -= (1 - f * f * (3 - 2 * f)) * 0.55;
    }
    elev.push(e);
    moist.push(moistNoise(ox + 300 + c * scale * 1.3, oy + 300 + r * scale * 1.3));
  }

  const oceanFrac = [0, 0.16, 0.27, 0.36, 0.45][sideCount];
  const sea = sideCount ? quantile(elev, oceanFrac) : -Infinity;
  const hexes: Hex[] = Array.from({ length: n }, (_, i) => ({
    i, col: colOf(g, i), row: rowOf(g, i), terrain: 'grassland' as Terrain,
    elev: elev[i], moist: moist[i], river: false, road: false,
  }));

  // Water connected to an ocean edge is ocean; other low basins become lakes or marsh.
  const below = (i: number) => elev[i] < sea;
  const edgeOf = (i: number) => {
    const c = colOf(g, i), r = rowOf(g, i);
    return (oceanSides.includes('north') && r === 0) || (oceanSides.includes('south') && r === g.rows - 1)
      || (oceanSides.includes('west') && c === 0) || (oceanSides.includes('east') && c === g.cols - 1);
  };
  const ocean = new Set<number>();
  const stack = [...Array(n).keys()].filter((i) => below(i) && edgeOf(i));
  stack.forEach((i) => ocean.add(i));
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of neighbors(g, i)) if (below(j) && !ocean.has(j)) { ocean.add(j); stack.push(j); }
  }

  const land = [...Array(n).keys()].filter((i) => !ocean.has(i)).map((i) => elev[i]);
  const mountainLine = quantile(land, 0.92);
  const hillLine = quantile(land, 0.8);
  // Moisture rises near the coast.
  const coastDist = dijkstra(g, [...ocean], () => 1).dist;
  for (const h of hexes) {
    if (ocean.has(h.i)) { h.terrain = 'ocean'; continue; }
    const m = h.moist + (coastDist[h.i] <= 2 ? 0.08 : 0);
    if (h.elev >= mountainLine) h.terrain = 'mountains';
    else if (h.elev >= hillLine) h.terrain = m > 0.5 ? 'rollingHills' : 'rockyHills';
    else if (m < 0.3) h.terrain = 'scrubDesert';
    else if (m < 0.47) h.terrain = 'grassland';
    else if (m < 0.6) h.terrain = 'lightForest';
    else if (m < 0.72 || h.elev > sea + 0.08) h.terrain = 'denseForest';
    else h.terrain = 'swamp';
    h.moist = m;
  }

  // Lakes: 1-3 low inland basins.
  const lakeCount = rng.int(1, 3);
  const basins = hexes
    .filter((h) => h.terrain !== 'ocean' && h.terrain !== 'mountains' && coastDist[h.i] >= 3)
    .filter((h) => neighbors(g, h.i).every((j) => elev[j] >= h.elev - 0.02))
    .sort((a, b) => a.elev - b.elev);
  const lakes: number[] = [];
  for (const b of basins) {
    if (lakes.length >= lakeCount) break;
    if (lakes.some((l) => distance(g, l, b.i) < 5)) continue;
    lakes.push(b.i);
    b.terrain = 'lake';
    if (rng.chance(0.5)) {
      const j = rng.pick(neighbors(g, b.i).filter((k) => hexes[k].terrain !== 'ocean'));
      if (j !== undefined && hexes[j].terrain !== 'mountains') hexes[j].terrain = 'lake';
    }
  }

  // 2. Significant terrain features.
  const featureCount = Math.max(3, Math.min(14, Math.round(6 * areaScale)));
  const features: TerrainFeature[] = [];
  const taken = new Set<number>();
  const landIdx = () => hexes.filter((h) => !isWater(h.terrain) && !taken.has(h.i)).map((h) => h.i);
  const kinds: string[] = [];
  for (let f = 0; f < featureCount; f++) {
    let row = rollRow('geo.terrain', rng);
    // Islands need ocean; avoid too many repeats.
    for (let t = 0; t < 6 && ((row.name === 'Islands' && !ocean.size) || kinds.filter((k) => k === row.name).length >= 2); t++) {
      row = rollRow('geo.terrain', rng);
    }
    if (row.name === 'Islands' && !ocean.size) continue;
    const kind = row.name ?? row.text;
    kinds.push(kind);
    const plan = FEATURE_PLAN[kind];
    if (!plan) continue;

    // Center: far from other features (best of several samples).
    let pool: number[];
    if (plan.shape === 'islands') {
      // Open sea two to four hexes off the coast.
      const landDist = dijkstra(g, hexes.filter((h) => !ocean.has(h.i)).map((h) => h.i), () => 1).dist;
      pool = [...ocean].filter((i) => landDist[i] >= 2 && landDist[i] <= 4);
    } else pool = landIdx();
    if (plan.shape === 'volcano') {
      const mts = pool.filter((i) => hexes[i].terrain === 'mountains');
      if (mts.length) pool = mts;
    }
    if (plan.terrain === 'swamp') {
      const wet = pool.filter((i) => coastDist[i] <= 3 || neighbors(g, i).some((j) => hexes[j].terrain === 'lake'));
      if (wet.length) pool = wet;
    }
    if (!pool.length) continue;
    let best = pool[0], bestScore = -1;
    for (let k = 0; k < 12; k++) {
      const c = rng.pick(pool);
      const s = features.length ? Math.min(...features.map((ft) => distance(g, ft.center, c))) : rng.next();
      if (s > bestScore) { bestScore = s; best = c; }
    }

    const id = `feat-${f}`;
    const area: number[] = [];
    const size = Math.max(2, Math.round(n * rng.next() * 0.035 + n * 0.012));
    if (plan.shape === 'blob') {
      const frontier = [best];
      const seen = new Set([best]);
      while (frontier.length && area.length < size) {
        const k = rng.int(0, frontier.length - 1);
        const i = frontier.splice(k, 1)[0];
        if (isWater(hexes[i].terrain) || taken.has(i)) continue;
        area.push(i);
        for (const j of neighbors(g, i)) if (!seen.has(j)) { seen.add(j); frontier.push(j); }
      }
      for (const i of area) hexes[i].terrain = plan.terrain;
    } else if (plan.shape === 'ridge' || plan.shape === 'volcano') {
      // A winding mountain spine with a skirt of hills.
      let dir = rng.int(0, 5);
      let i = best;
      const length = plan.shape === 'volcano' ? rng.int(1, 3) : Math.max(4, Math.round(size * 0.6));
      for (let k = 0; k < length; k++) {
        if (!isWater(hexes[i].terrain) && !taken.has(i)) { area.push(i); hexes[i].terrain = 'mountains'; hexes[i].elev = Math.max(hexes[i].elev, mountainLine + 0.05); }
        if (rng.chance(0.35)) dir = (dir + (rng.chance(0.5) ? 1 : 5)) % 6;
        const nb = neighbors(g, i);
        const next = nb[dir % nb.length];
        if (next === undefined) break;
        i = next;
      }
      const skirt = kind === 'Weathered mountains' ? 0.8 : 0.35;
      for (const a of [...area]) {
        for (const j of neighbors(g, a)) {
          if (!isWater(hexes[j].terrain) && !taken.has(j) && !area.includes(j) && rng.chance(skirt)) {
            hexes[j].terrain = rng.chance(0.5) ? 'rockyHills' : 'rollingHills';
            hexes[j].elev = Math.max(hexes[j].elev, hillLine + 0.02);
            area.push(j);
          }
        }
      }
      if (plan.shape === 'volcano' && area.length) hexes[area[0]].terrain = 'volcano';
    } else if (plan.shape === 'islands') {
      const count = rng.int(1, 4);
      let i = best;
      for (let k = 0; k < count; k++) {
        area.push(i);
        hexes[i].terrain = rng.pick(['lightForest', 'grassland', 'rollingHills', 'jungle'] as Terrain[]);
        hexes[i].elev = sea + 0.05;
        ocean.delete(i);
        const options = neighbors(g, i).filter((j) => ocean.has(j));
        if (!options.length) break;
        i = rng.pick(options);
        if (rng.chance(0.4)) { const jump = neighbors(g, i).filter((j) => ocean.has(j)); if (jump.length) i = rng.pick(jump); }
      }
    } else if (plan.shape === 'pit') {
      area.push(best);
      hexes[best].terrain = 'pit';
      for (const j of neighbors(g, best)) {
        if (!isWater(hexes[j].terrain) && !taken.has(j) && rng.chance(0.6)) { hexes[j].terrain = rng.pick(['canyons', 'blasted'] as Terrain[]); area.push(j); }
      }
    }
    if (!area.length) continue;
    area.forEach((i) => { taken.add(i); hexes[i].feature = id; });
    const name = `${word(regionStyle, rng)} ${rng.pick(plan.nouns)}`;
    features.push({ id, name, kind, description: row.text, hexes: area, center: area[0], facts: featureFacts(rng) });
  }

  // 3. Rivers: 1d4+2 (scaled), from highlands down to the sea or a lake.
  const riverCount = Math.max(2, Math.round(rng.dice('1d4+2') * Math.min(1.5, Math.sqrt(areaScale))));
  const rivers: number[][] = [];
  const maxLen = Math.max(6, Math.round(Math.max(g.cols, g.rows) * 0.7));
  const sources = rng.shuffle(hexes.filter((h) => isHighland(h.terrain) && h.terrain !== 'volcano').map((h) => h.i));
  for (const s of sources) {
    if (rivers.length >= riverCount) break;
    if (rivers.some((r) => r.some((i) => distance(g, i, s) < 3))) continue;
    const targets = new Set(hexes.filter((h) => isWater(h.terrain) || h.river).map((h) => h.i));
    if (!targets.size) break;
    const { dist, prev } = dijkstra(g, [s], (a, b) => {
      const t = hexes[b].terrain;
      if (t === 'mountains' || t === 'volcano' || t === 'pit') return 50;
      const climb = Math.max(0, hexes[b].elev - hexes[a].elev);
      return 1 + climb * 40 + rng.next() * 0.3;
    }, 400);
    let target = -1, bestD = Infinity;
    for (const t of targets) if (dist[t] < bestD) { bestD = dist[t]; target = t; }
    if (target < 0) continue;
    const path = pathTo(prev, target);
    if (path.length < 3 || path.length > maxLen) continue;
    // Stop at the first water hex; join an existing river and stop there.
    const cut: number[] = [];
    for (const i of path) {
      cut.push(i);
      if (i !== s && (isWater(hexes[i].terrain) || hexes[i].river)) break;
    }
    for (const i of cut) if (!isWater(hexes[i].terrain)) hexes[i].river = true;
    rivers.push(cut);
  }

  return { hexes, rivers, features, oceanSides };
}

/** Pixel polyline for a river: center to center, ending on the water edge. */
export function riverPoints(g: Grid, path: number[], size: number): [number, number][] {
  return path.map((i) => center(g, i, size));
}

export { table };
