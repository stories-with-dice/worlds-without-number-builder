import { describe, expect, it } from 'vitest';
import { buildWorld, DEFAULT_SETTINGS, reroll, SIZE_PRESETS } from '../src/gen/world';
import { Rng } from '../src/rng';
import { generateDungeon } from '../src/gen/dungeon';
import { availableKinds, generateAdventure } from '../src/gen/adventure';
import { rerollSeed } from '../src/gen/premium';
import type { AnchorKind } from '../src/types';
import { free, setPremium } from '../src/data';
import type { PremiumData } from '../src/data';

describe('free data', () => {
  it('has every tag set and the core tables', () => {
    for (const k of ['community', 'court', 'ruin', 'wilderness'] as const) expect(free.tags[k]).toHaveLength(50);
    expect(free.factions.assets.length).toBeGreaterThan(60);
  });
});

describe('world generation', () => {
  it('is deterministic for a seed', () => {
    const a = buildWorld(DEFAULT_SETTINGS, 'salt-moth-417');
    const b = buildWorld(DEFAULT_SETTINGS, 'salt-moth-417');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('builds every map size for many seeds', () => {
    for (const [cols, rows] of Object.values(SIZE_PRESETS)) {
      for (let s = 0; s < 6; s++) {
        for (const oceanSides of [-1, 0, 4]) {
          const w = buildWorld({ ...DEFAULT_SETTINGS, cols, rows, oceanSides }, `test-${s}`);
          expect(w.hexes).toHaveLength(cols * rows);
          expect(w.nations.length).toBeGreaterThan(0);
          expect(w.sites.some((x) => x.kind === 'capital')).toBe(true);
          expect(w.factions.length).toBeGreaterThan(0);
          for (const site of w.sites) {
            expect(site.tags).toHaveLength(2);
            for (const f of site.facts) expect(f.text.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('keeps terrain and nations when sites are regenerated', () => {
    const w = buildWorld(DEFAULT_SETTINGS, 'keep-1');
    const terrain = JSON.stringify(w.hexes.map((h) => h.terrain));
    const nations = w.nations.map((n) => n.name).join();
    const sites = w.sites.map((s) => s.name).join();
    reroll(w, 'sites');
    expect(JSON.stringify(w.hexes.map((h) => h.terrain))).toBe(terrain);
    expect(w.nations.map((n) => n.name).join()).toBe(nations);
    expect(w.sites.map((s) => s.name).join()).not.toBe(sites);
  });

  it('density changes the number of sites', () => {
    const dense = buildWorld({ ...DEFAULT_SETTINGS, density: 6 }, 'dens');
    const sparse = buildWorld({ ...DEFAULT_SETTINGS, density: 20 }, 'dens');
    expect(dense.sites.length).toBeGreaterThan(sparse.sites.length);
  });
});

describe('dungeons', () => {
  it('connects every room', () => {
    for (let s = 0; s < 20; s++) {
      const d = generateDungeon(`d-${s}`, { rooms: 10 + s });
      expect(d.rooms).toHaveLength(10 + s);
      const seen = new Set([1]);
      const stack = [1];
      while (stack.length) {
        const r = stack.pop()!;
        for (const l of d.links) {
          const o = l.a === r ? l.b : l.b === r ? l.a : 0;
          if (o && !seen.has(o)) { seen.add(o); stack.push(o); }
        }
      }
      expect(seen.size).toBe(d.rooms.length);
      expect(d.wandering).toHaveLength(6);
    }
  });
});

describe('adventures', () => {
  const w = buildWorld(DEFAULT_SETTINGS, 'adv-world');
  const all = ['combat', 'investigation', 'social', 'treasure'] as const;

  it('fills every challenge for every anchor kind and is deterministic', () => {
    const anchors: ({ kind: AnchorKind; id: string } | undefined)[] = [
      undefined,
      ...w.sites.map((s) => ({ kind: 'site' as const, id: s.id })),
      { kind: 'faction', id: w.factions[0].id },
      { kind: 'nation', id: w.nations[0].id },
    ];
    for (const [i, anchor] of anchors.entries()) {
      const a = generateAdventure(`a-${i}`, { kinds: [...all] }, w, anchor);
      expect(a.sections.map((x) => x.kind)).toEqual([...all]);
      for (const x of a.sections) for (const f of x.facts) expect(f.text.length, `${x.kind} ${f.label}`).toBeGreaterThan(0);
      expect(a.sections[3].facts[1].text).toMatch(/^[\d,]+ sp/);
      expect(JSON.stringify(generateAdventure(`a-${i}`, { kinds: [...all] }, w, anchor))).toBe(JSON.stringify(a));
    }
  });

  it('keeps one section the same when another is removed', () => {
    const a = generateAdventure('same', { kinds: [...all] }, w);
    const b = generateAdventure('same', { kinds: ['social'] }, w);
    expect(b.sections[0]).toEqual(a.sections[2]);
  });

  it('drops adventures whose anchor is gone when factions are regenerated', () => {
    const v = buildWorld(DEFAULT_SETTINGS, 'adv-drop');
    v.adventures.push(generateAdventure('x', { kinds: ['social'] }, v, { kind: 'faction', id: 'gone' }));
    v.adventures.push(generateAdventure('y', { kinds: ['social'] }, v));
    reroll(v, 'factions');
    expect(v.adventures.map((a) => a.seed)).toEqual(['y']);
  });
});

describe('premium adventure sections', () => {
  // A fake Deluxe dataset: the tests must not need the real premium.json.
  const table = (title: string, die: number) => ({ title, die, page: 377, rows: Array.from({ length: die }, (_, i) => ({ min: i + 1, max: i + 1, text: `${title} ${i + 1}` })) });
  const kinds = ['enemy', 'friend', 'complication', 'thing', 'place'] as const;
  const fake: PremiumData = {
    edition: 'deluxe', version: 1,
    tables: Object.fromEntries(['npc.twists', 'hooks.bait', 'hooks.intro', 'oracle.theme', 'oracle.mistake', 'oracle.reality', 'oracle.npc', 'oracle.event', 'oracle.affirm'].map((id) => [id, table(id, 6)])),
    seeds: Object.fromEntries(kinds.map((k, ki) => [k, Array.from({ length: 20 }, (_, i) => ({ n: ki * 20 + i + 1, text: `A ${k.charAt(0).toUpperCase() + k.slice(1)} meets a Thing in a Place.` }))])) as PremiumData['seeds'],
  };
  const w = buildWorld(DEFAULT_SETTINGS, 'adv-premium');

  it('skips premium sections without Deluxe data', () => {
    setPremium(null, false);
    expect(availableKinds()).not.toContain('fractal');
    const a = generateAdventure('p', { kinds: ['social', 'fractal', 'oracle'] }, w);
    expect(a.sections.map((x) => x.kind)).toEqual(['social']);
  });

  it('builds fractal and oracle sections with Deluxe data', () => {
    setPremium(fake, false);
    try {
      const site = w.sites.find((x) => x.kind === 'ruin')!;
      const a = generateAdventure('p', { kinds: ['fractal', 'oracle'], fractalSteps: 3 }, w, { kind: 'site', id: site.id });
      const [fr, or] = a.sections;
      expect(fr.kind).toBe('fractal');
      // The fractal components are the same tag elements that the prompts show.
      expect(fr.facts.slice(0, 5).map((x) => x.text)).toEqual(a.prompts.slice(-5).map((x) => x.text));
      expect(fr.facts.filter((x) => x.ref?.startsWith('seeds.'))).toHaveLength(4);
      expect(fr.facts[6].label).toMatch(/^Step 1: complicate the (thing|place|enemy|friend|complication) \(seed \d+\)$/);
      expect(or.facts).toHaveLength(8);
      expect(rerollSeed('seeds.thing', new Rng('r'))!.n).toBeGreaterThan(60);
      const none = generateAdventure('q', { kinds: ['fractal'], fractalSteps: 0 }, w);
      expect(none.sections[0].facts.filter((x) => x.ref?.startsWith('seeds.'))).toHaveLength(1);
    } finally {
      setPremium(null, false);
    }
  });
});
