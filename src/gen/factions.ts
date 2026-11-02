// Factions (WWN p322-335). Creation rules from "Creating Factions", p327:
//   small:  best 3-4, second 2-3, worst 1-2
//   medium: best 5-6, second 4-5, worst 2-3; 2 assets in the best attribute + 2 others
//   large:  best 7-8, second 6-7, worst 3-4; 4 assets in the best attribute + 4 others
// Hit points come from the attribute table; the Base of Influence at the HQ has max HP.
import { Rng } from '../rng';
import { free, roll } from '../data';
import type { Asset } from '../data';
import type { Faction, FactionAsset, Nation, Site } from '../types';

const HP = [0, 1, 2, 4, 6, 9, 12, 16, 20];
const MAGIC = ['None', 'Low', 'Medium', 'High'] as const;
type Attr = 'cunning' | 'force' | 'wealth';
const ATTR_NAME: Record<Attr, Asset['attribute']> = { cunning: 'Cunning', force: 'Force', wealth: 'Wealth' };

interface Candidate {
  name: string; kind: string; size: Faction['size']; primary: Attr[]; magic: Faction['magic'][];
  tagHints: string[]; home?: Site; nation?: string; actors: string; weight: number;
}

function ratings(size: Faction['size'], rng: Rng): [number, number, number] {
  if (size === 'small') return [rng.int(3, 4), rng.int(2, 3), rng.int(1, 2)];
  if (size === 'medium') return [rng.int(5, 6), rng.int(4, 5), rng.int(2, 3)];
  return [rng.int(7, 8), rng.int(6, 7), rng.int(3, 4)];
}

/** The faction income rule (p324): half Wealth plus a quarter of Force and Cunning, rounded up. */
export function income(f: Pick<Faction, 'wealth' | 'force' | 'cunning'>): number {
  return Math.ceil(f.wealth / 2 + (f.force + f.cunning) / 4);
}

function pickAssets(attr: Attr, rating: number, magic: Faction['magic'], count: number, rng: Rng): Asset[] {
  const ml = MAGIC.indexOf(magic);
  const pool = free.factions.assets.filter((a) => a.attribute === ATTR_NAME[attr] && a.rating <= rating && MAGIC.indexOf(a.magic as Faction['magic']) <= ml);
  // Prefer assets near the faction's rating.
  const sorted = rng.shuffle([...pool]).sort((a, b) => b.rating - a.rating + (rng.next() - 0.5) * 4);
  return sorted.slice(0, count);
}

export function generateFactions(count: number, nations: Nation[], sites: Site[], gods: { id: string; name: string }[], seed: string): Faction[] {
  const rng = new Rng(seed);
  const cand: Candidate[] = [];
  const bySize = [...nations].sort((a, b) => b.hexes.length - a.hexes.length);
  bySize.forEach((n, k) => {
    cand.push({
      name: `Crown of ${n.name}`, kind: 'Kingdom government', size: k === 0 || n.hexes.length > 60 ? 'large' : 'medium',
      primary: ['force', 'wealth'], magic: ['Low', 'Medium'], tagHints: ['Massive', 'Rooted', 'Martial', 'Imperialist'],
      home: sites.find((s) => s.id === n.capital), nation: n.id, actors: 'actors.nobles', weight: k < 2 ? 6 : 2,
    });
  });
  for (const s of sites) {
    const n = s.nation;
    if (s.kind === 'court' && !s.name.startsWith('Court of')) {
      const ct = s.meta.courtType;
      const map: Record<string, [string, Attr[], string[], string, Faction['magic'][]]> = {
        business: ['Merchant house', ['wealth'], ['Rich', 'Supported'], 'actors.merchants', ['None', 'Low']],
        criminal: ['Criminal syndicate', ['cunning'], ['Machiavellian', 'Concealed', 'Scavenger'], 'actors.warlords', ['None', 'Low']],
        clan: ['Clan alliance', ['force', 'cunning'], ['Tenacious', 'Rooted', 'Martial'], 'actors.warlords', ['None', 'Low']],
        religious: ['Religious order', ['cunning', 'wealth'], ['Zealot', 'Populist'], 'actors.zealots', ['Low', 'Medium']],
        aristocratic: ['Noble house', ['force', 'wealth'], ['Rooted', 'Supported'], 'actors.nobles', ['None', 'Low']],
      };
      const [kind, primary, tagHints, actors, magic] = map[ct] ?? map.aristocratic;
      cand.push({ name: s.name, kind, size: rng.chance(0.3) ? 'medium' : 'small', primary, magic, tagHints, home: s, nation: n, actors, weight: 2 });
    }
    if (s.kind === 'ruin' && s.tags.some((t) => /Raider|Conqueror|Zealots|Wizard|Remnants|Civil War/.test(t))) {
      const wizard = s.tags.includes("Wizard's Lair");
      cand.push({
        name: wizard ? `The Cabal of ${s.name}` : `Warband of ${s.name}`, kind: wizard ? 'Sorcerous cabal' : 'Raider warband',
        size: 'small', primary: wizard ? ['cunning'] : ['force'], magic: wizard ? ['High', 'Medium'] : ['None', 'Low'],
        tagHints: wizard ? ['Innovative', 'Concealed'] : ['Scavenger', 'Mobile', 'Martial'], home: s, nation: n,
        actors: wizard ? 'actors.sorcerers' : 'actors.warlords', weight: 1.5,
      });
    }
    if (s.kind === 'city' && rng.chance(0.25)) {
      cand.push({ name: `Free Council of ${s.name}`, kind: 'City council', size: 'small', primary: ['wealth', 'cunning'], magic: ['None', 'Low'], tagHints: ['Rich', 'Populist'], home: s, nation: n, actors: 'actors.merchants', weight: 1 });
    }
  }
  const cultGod = gods.find((g) => g.id === 'god-cult');
  const cultHome = rng.pick(sites.filter((s) => s.kind === 'city' || s.kind === 'ruin' || s.kind === 'community'));
  if (cultGod && cultHome) {
    cand.push({ name: `Cult of ${cultGod.name}`, kind: 'Sinister cult', size: 'small', primary: ['cunning'], magic: ['Medium', 'Low'], tagHints: ['Zealot', 'Concealed'], home: cultHome, nation: cultHome.nation, actors: 'actors.zealots', weight: 3 });
  }

  // Pick distinct candidates, weighted.
  const chosen: Candidate[] = [];
  const pool = [...cand];
  while (chosen.length < count && pool.length) {
    const c = rng.weighted(pool.map((p) => [p, p.weight] as [Candidate, number]));
    chosen.push(c);
    pool.splice(pool.indexOf(c), 1);
  }

  const factions: Faction[] = chosen.map((c, k) => {
    const frng = rng.child(`f-${k}`);
    const order: Attr[] = [frng.pick(c.primary)];
    for (const a of frng.shuffle(['cunning', 'force', 'wealth'] as Attr[])) if (!order.includes(a)) order.push(a);
    const [best, second, worst] = ratings(c.size, frng);
    const vals: Record<Attr, number> = { cunning: 0, force: 0, wealth: 0 };
    vals[order[0]] = best; vals[order[1]] = second; vals[order[2]] = worst;
    const magic = frng.pick(c.magic);
    const hp = HP[vals.cunning] + HP[vals.force] + HP[vals.wealth];
    const homeName = c.home?.name ?? 'its home';
    const otherSites = sites.filter((s) => s.nation && s.nation === c.nation && s.id !== c.home?.id);
    const place = (): { location: string; site?: string } => {
      const s = frng.chance(0.5) && otherSites.length ? frng.pick(otherSites) : c.home;
      return { location: s?.name ?? homeName, site: s?.id };
    };

    // Assets: medium 2+2, large 4+4 (p327). Small factions: 1+1 (the book gives no number).
    const nPrimary = c.size === 'large' ? 4 : c.size === 'medium' ? 2 : 1;
    const assets: FactionAsset[] = [{ name: 'Base of Influence', attribute: '-', hp, maxHp: hp, location: homeName, site: c.home?.id }];
    for (const a of pickAssets(order[0], vals[order[0]], magic, nPrimary, frng)) assets.push({ name: a.name, attribute: a.attribute, hp: a.hp, maxHp: a.hp, ...place() });
    for (let i = 0; i < nPrimary; i++) {
      const attr = order[1 + (i % 2)];
      const [a] = pickAssets(attr, vals[attr], magic, 1, frng.child(`o${i}`));
      if (a && !assets.some((x) => x.name === a.name)) assets.push({ name: a.name, attribute: a.attribute, hp: a.hp, maxHp: a.hp, ...place() });
    }

    const tags = free.factions.tags.map((t) => t.name);
    const hinted = c.tagHints.filter((t) => tags.includes(t));
    const tag = hinted.length && frng.chance(0.8) ? frng.pick(hinted) : frng.pick(tags);
    const goal = frng.pick(free.factions.goals).name;
    const fac: Faction = {
      id: `faction-${k}`, name: c.name, kind: c.kind, size: c.size,
      cunning: vals.cunning, force: vals.force, wealth: vals.wealth, magic, hp,
      treasure: income(vals), tags: [tag], goal, homeSite: c.home?.id, nation: c.nation, assets, rivals: [],
      facts: [
        { label: 'Recent activity', text: roll(c.actors, frng), ref: c.actors },
        { label: 'Recent event', text: roll('actors.events', frng), ref: 'actors.events' },
      ],
    };
    return fac;
  });

  // Rivals: factions in the same or neighboring nations.
  for (const a of factions) {
    const near = factions.filter((b) => b !== a && (b.nation === a.nation || nations.find((n) => n.id === a.nation)?.relations.some((r) => r.nation === b.nation && r.kind === 'dispute')));
    const pool2 = near.length ? near : factions.filter((b) => b !== a);
    if (pool2.length) {
      const r = rng.pick(pool2);
      if (!a.rivals.includes(r.id)) a.rivals.push(r.id);
      if (!r.rivals.includes(a.id)) r.rivals.push(a.id);
    }
  }
  return factions;
}
