// Generators that need Deluxe-only tables ("Additional GM Tools" and "Iterums", WWN Deluxe p370-391).
// They work only after the user loads premium.json made by the premium CLI from their own PDF.
import { Rng } from '../rng';
import { getPremium, roll, tag } from '../data';
import type { SeedKind } from '../data';
import type { Extra, Fact, Site } from '../types';
import { personName } from '../names';

const f = (label: string, id: string, rng: Rng): Fact => ({ label, text: roll(id, rng), ref: id });

export function premiumReady(): boolean {
  return getPremium() !== null;
}

const SPECIFIC: Record<string, string> = {
  criminals: 'npc.criminals', nobility: 'npc.nobility', villagers: 'npc.villagers',
  merchants: 'npc.merchants', tribals: 'npc.tribals', warriors: 'npc.warriors',
};

/** Random NPC types (p384-385) plus one-roll characterization (p387-391). */
export function npc(rng: Rng, style: string, hint?: string): Extra {
  const cls = hint && SPECIFIC[hint] ? SPECIFIC[hint] : rng.pick(['npc.underclass', 'npc.commoners', 'npc.gentry', ...Object.values(SPECIFIC)]);
  const name = personName(style, rng);
  const facts: Fact[] = [
    f('Who they are', cls, rng),
    f('Twist', 'npc.twists', rng),
    f('First thing noticed', 'npc.look.first', rng),
    f('Build', 'npc.look.build', rng),
    f('Movement', 'npc.look.move', rng),
    f('Mannerism', 'npc.look.mannerisms', rng),
    f('Clothing', 'npc.look.clothing', rng),
    f('Differs from expectations', 'npc.look.differ', rng),
    { label: 'Burning ambition', text: `${roll('npc.ambition.form', rng)}. Obstacle: ${roll('npc.ambition.obstacle', rng).replace(/^./, (c) => c.toLowerCase())}`, ref: 'npc.ambition.form' },
  ];
  const extra = rng.die(3);
  if (extra === 1) facts.push({ label: 'Personal tragedy', text: `${roll('npc.tragedy.form', rng)}. Scar: ${roll('npc.tragedy.scars', rng).replace(/^./, (c) => c.toLowerCase())}`, ref: 'npc.tragedy.form' });
  if (extra === 2) facts.push({ label: 'Troubled romance', text: `${roll('npc.romance.spark', rng)}. Issue: ${roll('npc.romance.issue', rng).replace(/^./, (c) => c.toLowerCase())}`, ref: 'npc.romance.spark' });
  if (extra === 3) facts.push({ label: 'Close friendship', text: `${roll('npc.friendship.tie', rng)}. Threat: ${roll('npc.friendship.threat', rng).replace(/^./, (c) => c.toLowerCase())}`, ref: 'npc.friendship.tie' });
  return { id: `npc-${rng.seed}`, title: `NPC: ${name}`, facts };
}

/** Architectural style generator (p378-379). */
export function architecture(rng: Rng): Extra {
  return {
    id: `arch-${rng.seed}`,
    title: 'Architectural style',
    facts: [
      f('Adjectives', 'arch.adjectives', rng),
      f('Favorite materials', 'arch.materials', rng),
      f('Color scheme', 'arch.colors', rng),
      f('Visual motifs', 'arch.motifs', rng),
      f('Adornment', 'arch.adornment', rng),
      f('Structural features', 'arch.features', rng),
      f('Settlement pattern', 'arch.patterns', rng),
    ],
  };
}

const KIND_FIELD: Record<SeedKind, 'enemies' | 'friends' | 'complications' | 'things' | 'places'> = {
  enemy: 'enemies', friend: 'friends', complication: 'complications', thing: 'things', place: 'places',
};

/**
 * Fractal adventure seed (p380-383): roll a d100 seed, then fill its Enemy, Friend,
 * Complication, Thing, and Place slots from the site's two tags.
 */
export function adventureSeed(rng: Rng, site: Site): Extra {
  const p = getPremium()!;
  const all = Object.values(p.seeds).flat();
  const seed = rng.pick(all);
  const tags = site.tags.map((n) => tag(site.tagKind, n)).filter((t) => !!t);
  const facts: Fact[] = [{ label: `Seed ${seed.n}`, text: seed.text }];
  for (const kind of Object.keys(KIND_FIELD) as SeedKind[]) {
    const word = kind.charAt(0).toUpperCase() + kind.slice(1);
    if (!new RegExp(`\\b${word}`).test(seed.text)) continue;
    const options = tags.flatMap((t) => t![KIND_FIELD[kind]]);
    if (options.length) facts.push({ label: word, text: rng.pick(options) });
  }
  // One fractal step: complicate one component with a seed of its own kind.
  const kinds = facts.slice(1).map((x) => x.label.toLowerCase() as SeedKind);
  if (kinds.length && rng.chance(0.6)) {
    const k = rng.pick(kinds);
    facts.push({ label: `Complicate the ${k}`, text: rng.pick(p.seeds[k]).text });
  }
  return { id: `seed-${rng.seed}`, title: `Adventure seed: ${site.name}`, facts };
}

/** Infernal Iterum (p371) or summoned Iterum creature (p373). */
export function iterum(rng: Rng, summoned = false): Extra {
  if (summoned) {
    return {
      id: `summoned-${rng.seed}`, title: 'Summoned Iterum creatures',
      facts: [
        f('How they started being summoned', 'iterum.summoned.start', rng),
        f('Mostly good for', 'iterum.summoned.goodFor', rng),
        f('Role at home', 'iterum.summoned.role', rng),
        f('Famous summoners', 'iterum.summoned.summoners', rng),
        f('What they get out of it', 'iterum.summoned.gain', rng),
      ],
    };
  }
  return {
    id: `iterum-${rng.seed}`, title: 'Infernal Iterum',
    facts: [
      f('What its dwellers want', 'iterum.infernal.wants', rng),
      f('Why they want it', 'iterum.infernal.why', rng),
      f('How they make it happen', 'iterum.infernal.how', rng),
      f('Structure of their society', 'iterum.infernal.structure', rng),
      f('What is hellish about it', 'iterum.infernal.hellish', rng),
    ],
  };
}

/** Adventure hook and oracle tools (p376-377). */
export function hook(rng: Rng): Extra {
  return {
    id: `hook-${rng.seed}`, title: 'Adventure hook',
    facts: [
      f('Bait', 'hooks.bait', rng),
      f('How it is introduced', 'hooks.intro', rng),
      f('Theme', 'oracle.theme', rng),
      f('Mistake that twists it', 'oracle.mistake', rng),
      f('Reality that intrudes', 'oracle.reality', rng),
      f('Event to throw in', 'oracle.event', rng),
    ],
  };
}
