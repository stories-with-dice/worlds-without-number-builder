// Cities, roads, and hex points of interest.
// - Cities and urbanization: WWN p124.
// - Community and court tables: p148-151, p166-171. Tags: p152-221.
// - Hex points of interest: p242 (roll a die per hex; 1-2 means a site).
import { Rng } from '../rng';
import { matrix, pickTags, roll } from '../data';
import type { Fact, Hex, Nation, Settings, Site, SiteKind } from '../types';
import { dijkstra, distance, Grid, neighbors, pathTo } from './hex';
import { isWater, TERRAIN_INFO } from './terrain';
import { NameBook, placeName, word } from '../names';
import { settled } from './nations';

const f = (label: string, id: string, rng: Rng): Fact => ({ label, text: roll(id, rng), ref: id });

export const COURT_TYPES = ['aristocratic', 'business', 'criminal', 'clan', 'religious'] as const;
export type CourtType = (typeof COURT_TYPES)[number];
export const COURT_LABEL: Record<CourtType, string> = {
  aristocratic: 'Aristocratic court', business: 'Business court', criminal: 'Criminal court',
  clan: 'Familial clan court', religious: 'Religious court',
};
const COURT_SPECIAL: Record<CourtType, [string, string]> = {
  aristocratic: ['Main theme', 'theme'], business: ['Relations with their market', 'market'],
  criminal: ['Primary mode of crime', 'crime'], clan: ['Relations with their neighbors', 'neighbors'],
  religious: ['Relations with the larger faith', 'faith'],
};

export function courtFacts(type: CourtType, rng: Rng): Fact[] {
  const p = `court.${type}`;
  const [label, key] = COURT_SPECIAL[type];
  return [
    f(label, `${p}.${key}`, rng),
    f('Major figure', `${p}.major`, rng),
    f('Major figure', `${p}.major`, rng),
    f('Minor figure', `${p}.minor`, rng),
    f('Source of a figure\'s power', `${p}.power`, rng),
    f('Internal conflict', `${p}.internal`, rng),
    f('External conflict', `${p}.external`, rng),
  ];
}

/** Village, city, or enclave tables (p149-151). */
export function communityFacts(kind: 'village' | 'city' | 'enclave', rng: Rng, capital = false): Fact[] {
  const why = kind === 'enclave' ? f('Why they stay here', 'enclave.reason', rng) : f('Why it exists', `${kind}.rationale`, rng);
  return [
    ...(capital ? [] : [why]),
    f('Who runs it', `${kind}.ruler`, rng),
    f('Significant local', `${kind}.notables`, rng),
    f('Significant local', `${kind}.notables`, rng),
    f('Pressing problem', `${kind}.problem`, rng),
    f('Local likely to deal with adventurers', `${kind}.contact`, rng),
    f('What it can offer heroes', `${kind}.offer`, rng),
  ];
}

/** Ruin tables (p187-189) and the site type matrix (p238). */
export function ruinFacts(rng: Rng, terrain: string): { facts: Fact[]; meta: Record<string, string>; subtitle: string } {
  const m = matrix('dungeon.siteTypes');
  const group = rng.pick(m.groups);
  const example = rng.pick(group.entries);
  const age = roll('ruin.age', rng);
  let category = 'modern';
  if (terrain === 'arratu') category = 'arratu';
  else if (rng.chance(0.2)) category = 'deep';
  else if (/unfathomable|ancient|centuries/i.test(age) || rng.chance(0.4)) category = 'ancient';
  const facts: Fact[] = [
    { label: 'Site type', text: `${group.name}: ${example}`, ref: 'dungeon.siteTypes' },
    f('Original purpose', 'ruin.kind', rng),
    { label: 'Age', text: age, ref: 'ruin.age' },
    f('How it was ruined', 'ruin.cause', rng),
    f('What the locals think', 'ruin.locals', rng),
    f('Why it is not plundered bare', 'ruin.unplundered', rng),
    f('Who has used it before', 'ruin.users', rng),
  ];
  if (category === 'deep') facts.push(f('Type of Deep', 'ruin.deeps', rng));
  if (category === 'ancient' && rng.chance(0.5)) {
    const culture = rng.pick(['brass', 'jikegida', 'shun', 'vothiteEmpire', 'vothiteRepublic']);
    facts.push(f('Builder culture', `ruin.culture.${culture}`, rng));
  }
  return { facts, meta: { category, siteGroup: group.name, siteExample: example }, subtitle: example };
}

export function wildernessFacts(rng: Rng): Fact[] {
  const sapient = rng.chance(0.6);
  const who = sapient ? (rng.chance(0.5) ? f('Typical encounter', 'wild.human', rng) : f('Typical encounter', 'wild.nonhuman', rng)) : f('Typical encounter', 'wild.beasts', rng);
  return [
    who,
    sapient ? f('What they are doing', 'wild.sapientsDoing', rng) : f('What it is doing', 'wild.beastsDoing', rng),
    ...(rng.chance(0.35) ? [f('Lair complication', 'lair.wild', rng)] : []),
    f('Wilderness event', 'events.wilderness', rng),
  ];
}

const DENSITY_LABEL: Record<number, string> = { 6: 'Dense (d6)', 8: 'Standard (d8)', 10: 'Light (d10)', 12: 'Sparse (d12)', 20: 'Very sparse (d20)' };
export { DENSITY_LABEL };

export interface SitesResult { sites: Site[]; roads: number[][] }

export function generateSites(settings: Settings, hexes: Hex[], nations: Nation[], seed: string, regionStyle: string, names: NameBook): SitesResult {
  const rng = new Rng(seed);
  const g: Grid = { cols: settings.cols, rows: settings.rows };
  hexes.forEach((h) => { h.road = false; });
  const sites: Site[] = [];
  let nextId = 0;
  const id = () => `site-${nextId++}`;
  const styleAt = (h: Hex) => nations.find((n) => n.id === h.nation)?.style ?? regionStyle;
  const coastal = (i: number) => neighbors(g, i).some((j) => isWater(hexes[j].terrain));

  // 1. Cities: capital at the nation's seat, others on rivers and coasts, spread apart.
  for (const n of nations) {
    const nrng = rng.child(n.id);
    const others = Math.max(1, Math.min(8, Math.round(n.hexes.length / 14)));
    const spots: number[] = [n.seat];
    const cand = nrng.shuffle(n.hexes.filter((i) => settled(hexes[i]) && hexes[i].terrain !== 'rockyHills'))
      .sort((a, b) => (Number(hexes[b].river) * 2 + Number(coastal(b))) - (Number(hexes[a].river) * 2 + Number(coastal(a))));
    for (const i of cand) {
      if (spots.length > others) break;
      if (spots.every((s) => distance(g, s, i) >= 3)) spots.push(i);
    }
    // Urbanization: 10% urban; a third in the capital; a quarter of the rest in the second city.
    const urban = n.population * 0.1;
    const capPop = urban / 3;
    const second = (urban - capPop) / 4;
    const rest = spots.length > 2 ? (urban - capPop - second) / (spots.length - 2) : 0;
    spots.forEach((hex, k) => {
      const capital = k === 0;
      const srng = nrng.child(`city-${k}`);
      const pop = Math.max(2000, Math.round((capital ? capPop : k === 1 ? second : rest * srng.int(6, 14) / 10) / 100) * 100);
      const site: Site = {
        id: id(), kind: capital ? 'capital' : 'city', hex, nation: n.id,
        name: names.unique(() => placeName(n.style, srng)),
        subtitle: capital ? `Capital of ${n.name}` : `City of ${n.name}`,
        tagKind: 'community', tags: pickTags('community', srng), population: pop,
        facts: communityFacts('city', srng, capital), meta: {},
      };
      sites.push(site);
      if (capital) {
        n.capital = site.id;
        // The ruling court sits in the capital.
        sites.push({
          id: id(), kind: 'court', hex, nation: n.id,
          name: `Court of ${site.name}`, subtitle: `${COURT_LABEL.aristocratic}, rulers of ${n.name}`,
          tagKind: 'court', tags: pickTags('court', srng), facts: courtFacts('aristocratic', srng), meta: { courtType: 'aristocratic' },
        });
      }
    });
  }

  // 2. Roads: inside each nation, and between neighboring capitals.
  const roadCost = (a: number, b: number) => {
    const t = hexes[b].terrain;
    if (isWater(t) || t === 'pit') return Infinity;
    return (TERRAIN_INFO[t].rough ?? 1) + (hexes[b].road ? -0.5 : 0) + (hexes[a].river !== hexes[b].river ? 1 : 0);
  };
  const roads: number[][] = [];
  const addRoad = (a: number, b: number) => {
    const { prev, dist } = dijkstra(g, [a], roadCost);
    if (dist[b] === Infinity || dist[b] > 60) return;
    const path = pathTo(prev, b);
    path.forEach((i) => { hexes[i].road = true; });
    roads.push(path);
  };
  const cities = sites.filter((s) => s.kind === 'city' || s.kind === 'capital');
  for (const n of nations) {
    const cap = cities.find((s) => s.id === n.capital);
    if (!cap) continue;
    for (const c of cities.filter((s) => s.nation === n.id && s.kind === 'city')) addRoad(cap.hex, c.hex);
    for (const r of n.relations) {
      const other = nations.find((x) => x.id === r.nation);
      const oc = cities.find((s) => s.id === other?.capital);
      if (oc && n.id < r.nation && !roads.some((p) => p[0] === cap.hex && p[p.length - 1] === oc.hex)) addRoad(cap.hex, oc.hex);
    }
  }

  // 3. Hex points of interest (p242): roll the density die per hex, a 1-2 means a site.
  const cityHexes = new Set(cities.map((c) => c.hex));
  const nearRoute = dijkstra(g, hexes.filter((h) => h.road || cityHexes.has(h.i)).map((h) => h.i), () => 1, 2).dist;
  const prng = rng.child('poi');
  for (const h of hexes) {
    if (isWater(h.terrain) || cityHexes.has(h.i)) continue;
    if (prng.die(settings.density) > 2) continue;
    const srng = prng.child(`hex-${h.i}`);
    let type = srng.die(10);
    // Ruins belong away from trade routes (p124 "Marking Wastelands"); reroll once if they sit on one.
    if (type <= 2 && nearRoute[h.i] === 0) type = srng.die(10);
    // Wastelands favor ruins and wilderness sites over communities.
    if (['arratu', 'blasted', 'pit', 'megaplex'].includes(h.terrain) && type >= 3 && type <= 7) type = srng.chance(0.5) ? 1 : 9;
    const style = styleAt(h);
    let kind: SiteKind;
    let site: Site;
    if (type <= 2 || h.terrain === 'megaplex' && srng.chance(0.5)) {
      kind = 'ruin';
      const r = ruinFacts(srng, h.terrain);
      const noun = r.meta.category === 'deep' ? 'Deep' : srng.pick(['Ruins', 'Ruin', 'Remnant', 'Halls', 'Fallen']);
      const nm = names.unique(() => word(style, srng));
      site = { id: id(), kind, hex: h.i, nation: h.nation, name: noun === 'Fallen' ? `Fallen ${nm}` : `${nm} ${noun}`, subtitle: r.subtitle, tagKind: 'ruin', tags: pickTags('ruin', srng), facts: r.facts, meta: r.meta };
    } else if (type <= 5) {
      kind = 'community';
      const example = roll('hex.community', srng);
      const enclave = /demihuman|monsters|aboriginal|natives/i.test(example);
      site = {
        id: id(), kind, hex: h.i, nation: h.nation, name: names.unique(() => placeName(style, srng)), subtitle: example,
        tagKind: 'community', tags: pickTags('community', srng), population: srng.int(1, 8) * 50 + srng.int(0, 49),
        facts: [{ label: 'Kind of community', text: example, ref: 'hex.community' }, ...communityFacts(enclave ? 'enclave' : 'village', srng)],
        meta: { communityKind: enclave ? 'enclave' : 'village' },
      };
    } else if (type <= 7) {
      kind = 'court';
      const example = roll('hex.court', srng);
      const ct: CourtType = /monaster|hermit|recluse/i.test(example) ? 'religious'
        : /trader|merchant|miner|prospector/i.test(example) ? 'business'
          : /tribal|clan/i.test(example) ? 'clan'
            : /degenerate|adventuring/i.test(example) ? 'criminal'
              : srng.pick(COURT_TYPES);
      const prefix: Record<CourtType, string[]> = { aristocratic: ['House', 'Hall of'], business: ['Company of', 'Concern of'], criminal: ['Band of', 'Company of'], clan: ['Clan', 'Kin of'], religious: ['Order of', 'Brotherhood of', 'Sisters of'] };
      site = {
        id: id(), kind, hex: h.i, nation: h.nation, name: `${srng.pick(prefix[ct])} ${names.unique(() => word(style, srng))}`,
        subtitle: `${COURT_LABEL[ct]}: ${example}`, tagKind: 'court', tags: pickTags('court', srng),
        facts: [{ label: 'Kind of group', text: example, ref: 'hex.court' }, ...courtFacts(ct, srng)], meta: { courtType: ct },
      };
    } else {
      kind = 'wilderness';
      const example = roll('hex.wilderness', srng);
      const t = TERRAIN_INFO[h.terrain].label;
      site = {
        id: id(), kind, hex: h.i, nation: h.nation, name: `${names.unique(() => word(style, srng))} ${srng.pick(['Hollow', 'Rise', 'Reach', 'Spring', 'Gap', 'Crag', 'Grove', 'Bluff', 'Sink', 'Vale'])}`,
        subtitle: `${example} (${t.toLowerCase()})`, tagKind: 'wilderness', tags: pickTags('wilderness', srng),
        facts: [{ label: 'Kind of site', text: example, ref: 'hex.wilderness' }, ...wildernessFacts(srng)], meta: {},
      };
    }
    sites.push(site);
  }
  return { sites, roads };
}
