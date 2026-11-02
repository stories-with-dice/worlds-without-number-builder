import { describe, expect, it } from 'vitest';
import { buildWorld, DEFAULT_SETTINGS, reroll, SIZE_PRESETS } from '../src/gen/world';
import { generateDungeon } from '../src/gen/dungeon';
import { free } from '../src/data';

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
