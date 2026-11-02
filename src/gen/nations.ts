// Nations, their societies, governments, histories, and gods (WWN p118-145).
import { Rng } from '../rng';
import { roll, rollDistinct, table, rowText } from '../data';
import type { Fact, God, Hex, Nation, Settings } from '../types';
import { dijkstra, distance, Grid, neighbors } from './hex';
import { isWater, TERRAIN_INFO } from './terrain';
import { NameBook, placeName, STYLE_IDS, STYLES, word } from '../names';

const COLORS = ['#c0392b', '#2471a3', '#b9770e', '#7d3c98', '#138d75', '#a04000', '#2e4053', '#b03a2e', '#1e8449', '#6c3483', '#af601a', '#1a5276'];

const f = (label: string, id: string, rng: Rng): Fact => ({ label, text: roll(id, rng), ref: id });

/** Rolls inside part of a table, e.g. 1d10 or 1d10+10 on the nation themes. */
function rollBetween(id: string, rng: Rng, lo: number, hi: number): string {
  const rows = table(id).rows.filter((r) => r.min >= lo && r.max <= hi);
  return rowText(rng.pick(rows));
}

/** Hexes a nation can settle (not "wilderness" for the population rule on p124). */
export function settled(h: Hex): boolean {
  return !['ocean', 'lake', 'mountains', 'volcano', 'pit', 'arratu', 'blasted', 'sandDesert', 'swamp'].includes(h.terrain);
}

export function makeGod(id: string, style: string, rng: Rng, sinister = false): God {
  const concern = rng.chance(0.5)
    ? { label: 'Human concern', text: roll('religion.humanConcern', rng), ref: 'religion.humanConcern' }
    : { label: 'Natural principle', text: roll('religion.naturalPrinciple', rng), ref: 'religion.naturalPrinciple' };
  const facts: Fact[] = [
    concern,
    f('Origin', 'religion.godOrigin', rng),
    f('Role in society', 'religion.society', rng),
    f('Why the faith matters', 'religion.why', rng),
    f('What the faith wants', 'religion.wants', rng),
    f('Church structure', 'religion.structure', rng),
    f('Religious requirement', 'religion.requirements', rng),
  ];
  if (sinister) {
    facts.push(
      f('Cult goal', 'cult.goal', rng),
      f('What is horrible about it', 'cult.horror', rng),
      f('How the clergy enforce their will', 'cult.enforce', rng),
      f('Rewards for followers', 'cult.rewards', rng),
      f('Cult unity', 'cult.unity', rng),
      f('Cult trait', 'cult.traits', rng),
    );
  }
  const name = word(style, rng);
  return { id, name, domain: (sinister ? 'Sinister cult: ' : '') + concern.text, facts };
}

export function nationFacts(rng: Rng): Fact[] {
  const single = rng.chance(0.55);
  return [
    { label: 'Dark theme', text: rollBetween('nation.themes', rng, 1, 10), ref: 'nation.themes' },
    { label: 'Bright theme', text: rollBetween('nation.themes', rng, 11, 20), ref: 'nation.themes' },
    // Society (p128-131)
    f('Typical build', 'society.build', rng),
    f('Skin', 'society.skin', rng),
    { label: 'Hair', text: `${roll('society.hairColor', rng)}; ${roll('society.hairTexture', rng).toLowerCase()}`, ref: 'society.hairColor' },
    f('Eyes', 'society.eyes', rng),
    f('Adornment', 'society.adornment', rng),
    ...(rng.chance(0.4) ? [f('Physical quirk', 'society.quirks', rng)] : []),
    { label: 'Values they esteem', text: rollDistinct('society.values', rng, 2).join('; '), ref: 'society.values' },
    f('Major unit of social identity', 'society.identity', rng),
    f('Template society for inspiration', 'society.templates', rng),
    // Government (p132-135)
    f('Number of rulers', 'gov.numRulers', rng),
    single ? f('Ruler', 'gov.singleRulers', rng) : f('Rulers', 'gov.multipleRulers', rng),
    f('Ruling class', 'gov.rulingClass', rng),
    f('Source of legitimacy', 'gov.legitimacy', rng),
    f('Institutions of control', 'gov.institutions', rng),
    f('Stability', 'gov.stability', rng),
    f('How established the ruler is', 'gov.established', rng),
    f('Government strength', 'gov.strength', rng),
    f('Struggle within the government', 'gov.struggle', rng),
    f('Problem with the ministers', 'gov.ministers', rng),
    f('Officials causing problems', 'gov.officials', rng),
    f('Recent governmental event', 'gov.event', rng),
    // History (p136-139)
    f('Origin', 'history.origin', rng),
    f('Fate of the original inhabitants', 'history.originalInhabitants', rng),
    { label: 'Past crisis', text: `${roll('history.crises', rng)}; overcome because: ${roll('history.overcome', rng).toLowerCase()}`, ref: 'history.crises' },
    { label: 'Historical events', text: rollDistinct('history.events', rng, 3).join(', '), ref: 'history.events' },
    // Current state (p125)
    f('Current problem', 'nation.problems', rng),
    f('Good thing happening now', 'nation.goodThings', rng),
  ];
}

export interface NationsResult { nations: Nation[]; gods: God[] }

export function generateNations(settings: Settings, hexes: Hex[], seed: string, regionStyle: string, names: NameBook): NationsResult {
  const rng = new Rng(seed);
  const g: Grid = { cols: settings.cols, rows: settings.rows };
  hexes.forEach((h) => { delete h.nation; });

  // Capitals: on good land, near rivers or coast, spread apart (p124 "City Placement").
  const score = (h: Hex) => {
    if (!settled(h) || h.terrain === 'rockyHills') return -1;
    let s = 1;
    if (h.river) s += 3;
    if (neighbors(g, h.i).some((j) => hexes[j].terrain === 'ocean' || hexes[j].terrain === 'lake')) s += 2.5;
    if (h.terrain === 'grassland' || h.terrain === 'farmland') s += 2;
    if (h.terrain === 'lightForest' || h.terrain === 'rollingHills') s += 1;
    return s + rng.next();
  };
  const candidates = hexes.map((h) => [h.i, score(h)] as const).filter(([, s]) => s > 0);
  const landCount = hexes.filter((h) => !isWater(h.terrain)).length;
  const count = Math.max(1, Math.min(settings.nations, Math.floor(landCount / 12)));
  const minGap = Math.max(3, Math.floor(Math.sqrt(landCount / count) * 0.8));
  const caps: number[] = [];
  for (const [i] of [...candidates].sort((a, b) => b[1] - a[1])) {
    if (caps.length >= count) break;
    if (caps.every((c) => distance(g, c, i) >= minGap)) caps.push(i);
  }
  for (const [i] of rng.shuffle([...candidates])) {
    if (caps.length >= count) break;
    if (caps.every((c) => distance(g, c, i) >= 3)) caps.push(i);
  }

  // Borders follow barriers: grow outward with terrain costs; rough land stays unclaimed.
  const budget = Math.sqrt(landCount / Math.max(1, caps.length)) * 2.3;
  const { dist, origin } = dijkstra(g, caps, (a, b) => {
    const t = hexes[b].terrain;
    if (isWater(t)) return Infinity;
    let c = TERRAIN_INFO[t].rough ?? 1;
    if (hexes[b].river !== hexes[a].river) c += 2; // rivers make borders
    return c;
  }, budget);

  const styles = rng.shuffle([...STYLE_IDS]);
  const nations: Nation[] = caps.map((cap, k) => {
    const style = k === 0 ? regionStyle : styles[k % styles.length];
    const nrng = rng.child(`nation-${k}`);
    return {
      id: `nation-${k}`,
      name: names.unique(() => placeName(style, nrng)),
      style,
      color: COLORS[k % COLORS.length],
      seat: cap,
      hexes: [],
      population: 0,
      facts: [{ label: 'Linguistic touchstone', text: STYLES[style].label }, ...nationFacts(nrng)],
      relations: [],
      gods: [],
    };
  });
  for (const h of hexes) {
    if (dist[h.i] < Infinity && origin[h.i] >= 0) {
      h.nation = nations[origin[h.i]].id;
      nations[origin[h.i]].hexes.push(h.i);
    }
  }

  // Population: about 60 people per square mile of settled land (p124).
  const sqMiles = (Math.sqrt(3) / 2) * settings.hexMiles ** 2;
  for (const n of nations) {
    n.population = Math.round(n.hexes.filter((i) => settled(hexes[i])).length * sqMiles * 60 / 100) * 100;
  }

  // Relations between neighbors (p125).
  for (let a = 0; a < nations.length; a++) {
    for (let b = a + 1; b < nations.length; b++) {
      const touching = nations[a].hexes.some((i) => neighbors(g, i).some((j) => hexes[j].nation === nations[b].id));
      if (!touching) continue;
      const rr = rng.child(`rel-${a}-${b}`);
      const kinds: ('dispute' | 'tie')[] = rr.chance(0.3) ? ['dispute', 'tie'] : [rr.chance(0.55) ? 'dispute' : 'tie'];
      for (const kind of kinds) {
        const id = kind === 'dispute' ? 'nation.disputes' : 'nation.ties';
        nations[a].relations.push({ nation: nations[b].id, kind, text: roll(id, rr) });
        nations[b].relations.push({ nation: nations[a].id, kind, text: roll(id, rr) });
      }
    }
  }

  // Gods: a few honored region-wide, one local god per nation, and one sinister cult (p118, p140-145).
  const gods: God[] = [];
  const grng = rng.child('gods');
  const regional = grng.int(1, 3);
  for (let k = 0; k < regional; k++) gods.push(makeGod(`god-r${k}`, regionStyle, grng.child(`r${k}`)));
  nations.forEach((n, k) => {
    const local = makeGod(`god-n${k}`, n.style, grng.child(`n${k}`));
    gods.push(local);
    n.gods = [local.id, ...gods.filter((x) => x.id.startsWith('god-r') && grng.chance(0.7)).map((x) => x.id)];
  });
  const cult = makeGod('god-cult', grng.pick(STYLE_IDS), grng.child('cult'), true);
  gods.push(cult);

  return { nations, gods };
}
