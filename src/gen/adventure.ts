// Adventure challenges, following "Creating Adventures" (WWN p230-257):
//  - Combat challenges: complications and twists (p232-233).
//  - Investigation challenges: hook, introduction, three investigation scenes, reaction, failsafe, resolution (p248-251).
//  - Social challenges: one-roll social challenge target (p252-253).
//  - Treasure: silver piece value of the site (p256), magic items and valuables (p257).
//  - Premium (Deluxe only, needs premium.json): fractal adventure seeds (p380-383) and
//    adventure hooks with oracular adventure adjustments (p376-377).
// An adventure can have an anchor (a site, faction, or nation). The anchor picks sensible defaults
// and adds prompts from the site's tags (p152-221).
import { Rng } from '../rng';
import { grid, roll, rollDistinct, tag } from '../data';
import type { Adventure, AdventureOptions, AnchorKind, ChallengeKind, Fact, LairKind, Site, World } from '../types';
import { fractal, oracle, premiumReady, tagComponents } from './premium';
import type { Component } from './premium';

export const CHALLENGES: Record<ChallengeKind, { title: string; page: string; premium?: boolean }> = {
  combat: { title: 'Combat challenge', page: '230-233' },
  investigation: { title: 'Investigation challenge', page: '248-251' },
  social: { title: 'Social challenge', page: '252-253' },
  treasure: { title: 'Treasure', page: '256-257' },
  fractal: { title: 'Fractal adventure seed', page: '380-383', premium: true },
  oracle: { title: 'Oracular adventure adjustments', page: '376-377', premium: true },
};

/** Challenge kinds the generator can use now: premium kinds need loaded Deluxe data. */
export function availableKinds(): ChallengeKind[] {
  return (Object.keys(CHALLENGES) as ChallengeKind[]).filter((k) => !CHALLENGES[k].premium || premiumReady());
}

export const LAIRS: Record<LairKind, { label: string; table: string }> = {
  urban: { label: 'Urban dwelling', table: 'lair.urban' },
  wild: { label: 'Wilderness lair', table: 'lair.wild' },
  deep: { label: 'Deep chamber', table: 'lair.deep' },
};

const f = (label: string, id: string, rng: Rng): Fact => ({ label, text: roll(id, rng), ref: id });

/** The site that gives an anchor its place and tags: the site itself, a faction's base, or a nation's capital. */
export function anchorSite(world: World, anchor?: Adventure['anchor']): Site | undefined {
  if (!anchor) return undefined;
  const id = anchor.kind === 'site' ? anchor.id
    : anchor.kind === 'faction' ? world.factions.find((x) => x.id === anchor.id)?.homeSite
      : world.nations.find((x) => x.id === anchor.id)?.capital;
  return world.sites.find((s) => s.id === id);
}

export function anchorExists(world: World, anchor: { kind: AnchorKind; id: string }): boolean {
  const list: { id: string }[] = anchor.kind === 'site' ? world.sites : anchor.kind === 'faction' ? world.factions : world.nations;
  return list.some((x) => x.id === anchor.id);
}

// ---------------------------------------------------------------- treasure value (p256-257)

/** Finds a grid line by the start of its name, e.g. "Minor Deep". */
function line(id: string, prefix: string) {
  return grid(id).lines.find((l) => l.name.toLowerCase().startsWith(prefix.toLowerCase()));
}

/** A default line of the site value table for a site. The book says to pick the most appropriate line. */
function siteValueFor(site: Site | undefined, world: World, rng: Rng): string {
  const lines = grid('treasure.siteValue').lines.map((l) => l.name);
  if (!site) return rng.pick(lines);
  const court: Record<string, string[]> = {
    aristocratic: ['Great noble', 'Rural noble'], business: ["Merchant prince"], criminal: ['Successful bandit chief'],
    clan: ['Rural noble'], religious: ['Richly adorned great temple'],
  };
  let options: string[];
  if (world.hexes[site.hex].terrain === 'arratu') options = ['Outsider settlement', 'Outsider city'];
  else if (site.kind === 'court') options = court[site.meta.courtType] ?? ['Rural noble'];
  else if (site.kind === 'ruin') options = site.meta.category === 'deep' ? ['Significant Deep', 'Sprawling Deep'] : site.meta.category === 'ancient' ? ['Significant Deep', 'Ancient royal palace', 'Lost settlement', 'Great wizard'] : ['Minor Deep', 'Lost settlement'];
  else if (site.kind === 'wilderness') options = ['Solitary dangerous monster', 'Minor bandit cache', 'Successful bandit chief'];
  else options = ["Merchant prince", 'Rural noble', 'Richly adorned great temple'];
  return line('treasure.siteValue', rng.pick(options))?.name ?? rng.pick(lines);
}

/** A default line of the magic item chance table for a site value line. */
function ownerFor(siteValue: string): string {
  const map: [RegExp, string][] = [
    [/^minor bandit/i, 'Minor unguarded trove'], [/bandit chief|noble|merchant/i, 'Adventurer or noble'],
    [/dangerous monster/i, 'Trove of 5-10 HD'], [/legendary monster/i, 'Trove of 11+ HD'],
    [/wizard/i, 'Great wizard'], [/temple/i, 'Minor mage or shaman'],
  ];
  const hit = map.find(([re]) => re.test(siteValue));
  return line('treasure.magicChance', hit?.[1] ?? 'Major unguarded trove')!.name;
}

/** Rolls "2d6 x 2,000" or "1d6". */
function rollValue(expr: string, rng: Rng): number {
  const m = expr.match(/^(\d*d\d+)(?:\s*x\s*([\d,]+))?$/i);
  if (!m) throw new Error(`Bad treasure value: ${expr}`);
  return rng.dice(m[1]) * Number((m[2] ?? '1').replace(/,/g, ''));
}

/** Column index for a die result in cells like "1–19", "20", or "N/A". */
function column(cells: string[], n: number): number {
  return cells.findIndex((c) => {
    const m = c.match(/^(\d+)(?:\s*[–-]\s*(\d+))?$/);
    return m && n >= +m[1] && n <= +(m[2] ?? m[1]);
  });
}

function treasure(rng: Rng, siteValue: string, owner: string): Fact[] {
  const value = grid('treasure.siteValue');
  const valueLine = value.lines.find((l) => l.name === siteValue)!;
  const roll2d6 = rng.dice('2d6');
  const col = column(value.columns, roll2d6);
  const expr = valueLine.cells[col];
  const total = rollValue(expr, rng);
  const facts: Fact[] = [
    { label: 'Type of site', text: siteValue, ref: 'treasure.siteValue' },
    { label: 'Total value', text: `${total.toLocaleString('en-US')} sp (2d6 = ${roll2d6}, ${expr})`, ref: 'treasure.siteValue' },
    { label: 'Placement', text: 'Split the total into troves. Put about half in one or two major troves; the PCs will likely miss some of it (p.244, p.256).' },
  ];

  const chance = grid('treasure.magicChance');
  const ownerLine = chance.lines.find((l) => l.name === owner)!;
  const d20 = rng.die(20);
  const count = Math.max(0, column(ownerLine.cells, d20));
  const items = Array.from({ length: count }, () => roll('treasure.magicType', rng));
  facts.push({ label: 'Magic items', text: `${owner}, d20 = ${d20}: ${count ? `${chance.columns[count].toLowerCase()}: ${items.join(', ')}` : 'none'}${count === 3 ? ' (three or more; add more if it fits)' : ''}`, ref: 'treasure.magicChance' });

  for (let i = 1; i <= 3; i++) {
    facts.push(f(`Valuable ${i}`, rng.chance(0.4) ? 'treasure.jewelry' : 'treasure.valuables', rng));
    facts.push(f(`Why valuable ${i} is special`, 'treasure.whyValuable', rng));
  }
  return facts;
}

// ---------------------------------------------------------------- challenges

function anchorPrompts(world: World, anchor: Adventure['anchor'], site: Site | undefined, components: Component[]): Fact[] {
  const out: Fact[] = [];
  if (anchor?.kind === 'faction') {
    const fac = world.factions.find((x) => x.id === anchor.id);
    if (fac) out.push({ label: 'Faction goal', text: fac.goal }, ...fac.tags.map((t) => ({ label: 'Faction tag', text: t })));
  } else if (anchor?.kind === 'nation') {
    out.push(...(world.nations.find((x) => x.id === anchor.id)?.facts.filter((x) => x.ref === 'nation.problems') ?? []));
  }
  if (site) {
    out.push(...site.facts.filter((x) => /problem|conflict/i.test(x.label)).slice(0, 2));
    out.push(...components.map((c) => ({ label: `${c.kind.charAt(0).toUpperCase() + c.kind.slice(1)} (${c.tag})`, text: c.text })));
  }
  return out;
}

function lairFor(site: Site | undefined, rng: Rng): LairKind {
  if (!site) return rng.pick(['urban', 'wild', 'deep'] as const);
  if (site.kind === 'wilderness') return 'wild';
  if (site.kind === 'ruin') return site.meta.category === 'deep' || rng.chance(0.6) ? 'deep' : 'wild';
  return 'urban';
}

function combat(rng: Rng, lair: LairKind, beast: boolean, site: Site | undefined): Fact[] {
  const enemies = site ? site.tags.flatMap((t) => tag(site.tagKind, t)?.enemies ?? []) : [];
  const target: Fact = beast ? f('Target', 'wild.beasts', rng)
    : enemies.length && rng.chance(0.7) ? { label: 'Target (from the site tags)', text: rng.pick(enemies) }
      : f('Target', rng.pick(['wild.human', 'wild.nonhuman']), rng);
  return [
    target,
    { label: 'Environment', text: LAIRS[lair].label },
    ...(beast ? [f('What the beast is doing', 'lair.beast', rng)] : [f('What is going on right now', 'lair.now', rng), f('Problem they have', 'lair.problems', rng)]),
    f('Twist about the target or their allies', 'lair.twists', rng),
    f(`${LAIRS[lair].label} complication`, LAIRS[lair].table, rng),
    { label: 'Prepare', text: 'List the creatures and their statistics, note how the environment affects a fight, plan routes that avoid the fight, and decide the consequences of the target\'s death (p.230-231).' },
  ];
}

function investigation(rng: Rng): Fact[] {
  const complications = rollDistinct('invest.complications', rng, 3);
  return [
    f('Hook: why it is enticing', 'invest.hook', rng),
    f('Introduction: why it is worth following up', 'invest.intro', rng),
    ...complications.map((text, i) => ({ label: `Investigation scene ${i + 1}: complication`, text, ref: 'invest.complications' })),
    f('Reaction: the culprit\'s first instinct', 'invest.reaction', rng),
    f('Failsafe: the cost of the clue', 'invest.clueCost', rng),
    f('Resolution twist', 'invest.twists', rng),
  ];
}

function social(rng: Rng): Fact[] {
  return [
    f('What they want accomplished', 'social.want', rng),
    f('How the PCs learn about them', 'social.learn', rng),
    f('Why they will not cooperate', 'social.cooperate', rng),
    f('Their weakest point', 'social.weakness', rng),
    f('Their current mood', 'social.mood', rng),
    f('Twist to the negotiation', 'social.twists', rng),
  ];
}

// ---------------------------------------------------------------- adventure

export function generateAdventure(seed: string, opts: AdventureOptions, world: World, anchor?: Adventure['anchor'], name = 'Adventure'): Adventure {
  const rng = new Rng(seed);
  const site = anchorSite(world, anchor);
  const options: AdventureOptions = { ...opts };
  const sections: Adventure['sections'] = [];
  // One Enemy, Friend, Complication, Thing, and Place from the site's two tags (p152-221).
  // The prompts show them, and the fractal seed plugs them in (Deluxe p380).
  const components = site ? tagComponents(site.tagKind, site.tags, rng.child('prompts')) : [];
  // Each section has its own stream, so adding or removing one does not change the others.
  for (const kind of availableKinds().filter((k) => opts.kinds.includes(k))) {
    const r = rng.child(kind);
    let facts: Fact[];
    if (kind === 'combat') {
      options.lair ??= lairFor(site, r);
      options.beast ??= options.lair !== 'urban' && r.chance(0.4);
      facts = combat(r, options.lair, options.beast, site);
    } else if (kind === 'investigation') facts = investigation(r);
    else if (kind === 'social') facts = social(r);
    else if (kind === 'fractal') facts = fractal(r, components, options.fractalSteps ??= 1);
    else if (kind === 'oracle') facts = oracle(r);
    else {
      options.siteValue ??= siteValueFor(site, world, r);
      options.owner ??= ownerFor(options.siteValue);
      facts = treasure(r, options.siteValue, options.owner);
    }
    sections.push({ kind, ...CHALLENGES[kind], facts });
  }
  return {
    id: `adventure-${seed}`,
    seed,
    name,
    anchor,
    options,
    prompts: anchorPrompts(world, anchor, site, components),
    sections,
  };
}
