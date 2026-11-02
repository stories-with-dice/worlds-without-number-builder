// Generators that need Deluxe-only tables ("Additional GM Tools" and "Iterums", WWN Deluxe p370-391).
// They work only after the user loads premium.json made by the premium CLI from their own PDF.
import { Rng } from '../rng';
import { free, getPremium, roll, tag } from '../data';
import type { SeedKind, TagKind } from '../data';
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

export const SEED_KINDS = Object.keys(KIND_FIELD) as SeedKind[];
const cap = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);

/** One fractal component: an Enemy, Friend, Complication, Thing, or Place taken from a tag (p380). */
export interface Component { kind: SeedKind; tag: string; text: string }

/** One component of each kind from a list of tags (one tag picked per component). */
export function tagComponents(kind: TagKind, tagNames: string[], rng: Rng): Component[] {
  const tags = tagNames.map((n) => tag(kind, n)).filter((t) => t !== undefined);
  if (!tags.length) return [];
  return SEED_KINDS.flatMap((k) => {
    const t = rng.pick(tags);
    const list = t[KIND_FIELD[k]];
    return list.length ? [{ kind: k, tag: t.name, text: rng.pick(list) }] : [];
  });
}

/** A seed fact. The ref "seeds.<kind>" (or "seeds.any") lets the app roll it again. */
function seedFact(label: string, kind: SeedKind | 'any', rng: Rng): Fact & { kinds: SeedKind[] } {
  const p = getPremium()!;
  const seed = rng.pick(kind === 'any' ? Object.values(p.seeds).flat() : p.seeds[kind]);
  return { label: `${label} (seed ${seed.n})`, text: seed.text, ref: `seeds.${kind}`, kinds: SEED_KINDS.filter((k) => new RegExp(`\\b${cap(k)}`).test(seed.text)) };
}

/** Rolls a seed again for a fact made by `fractal`. Returns undefined for other refs. */
export function rerollSeed(ref: string, rng: Rng): { n: number; text: string } | undefined {
  const m = ref.match(/^seeds\.(\w+)$/);
  const p = getPremium();
  if (!m || !p) return undefined;
  return rng.pick(m[1] === 'any' ? Object.values(p.seeds).flat() : p.seeds[m[1] as SeedKind] ?? []);
}

/**
 * Fractal adventure seeds (p380-383):
 *  1. Get one Enemy, Friend, Complication, Thing, and Place from the site's tags.
 *     With no tags, two random tags of one kind give the components.
 *  2. Roll a d100 premise seed and plug the components into it.
 *  3. For each step, take a component of the latest seed and roll a d20 seed of its kind to complicate it.
 */
export function fractal(rng: Rng, components: Component[], steps: number): Fact[] {
  if (!components.length) {
    const kind = rng.pick(['community', 'court', 'ruin', 'wilderness'] as const);
    components = tagComponents(kind, rng.shuffle(free.tags[kind].map((t) => t.name)).slice(0, 2), rng);
  }
  const facts: Fact[] = components.map((c) => ({ label: `${cap(c.kind)} (${c.tag})`, text: c.text }));
  let last = seedFact('Premise', 'any', rng);
  facts.push(last);
  for (let i = 1; i <= steps && last.kinds.length; i++) {
    const k = rng.pick(last.kinds);
    last = seedFact(`Step ${i}: complicate the ${k}`, k, rng);
    facts.push(last);
  }
  return facts.map(({ label, text, ref }) => ({ label, text, ref }));
}

/** Fractal adventure seed for a site page, with one complication step 60% of the time. */
export function adventureSeed(rng: Rng, site: Site): Extra {
  const facts = fractal(rng, tagComponents(site.tagKind, site.tags, rng), rng.chance(0.6) ? 1 : 0);
  return { id: `seed-${rng.seed}`, title: `Adventure seed: ${site.name}`, facts };
}

/** Adventure hooks (p376) and oracular adventure adjustments (p377), for an adventure section. */
export function oracle(rng: Rng): Fact[] {
  return [
    f('Bait for the hook', 'hooks.bait', rng),
    f('How the hook is introduced', 'hooks.intro', rng),
    f('Theme that informs the adventure', 'oracle.theme', rng),
    f('Mistake that twists the adventure', 'oracle.mistake', rng),
    f('Reality that intrudes', 'oracle.reality', rng),
    f('How to change a key NPC', 'oracle.npc', rng),
    f('Event to throw in', 'oracle.event', rng),
    f('Is your main idea right? (affirmation or negation)', 'oracle.affirm', rng),
  ];
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
