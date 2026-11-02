import { describe, expect, it } from 'vitest';
import { buildWorld, DEFAULT_SETTINGS } from '../src/gen/world';
import fs from 'node:fs';
import path from 'node:path';
import { buildVaultNotes, LEAFLET_PLUGIN_FILES, LEAFLET_PLUGIN_ID } from '../src/export/obsidian';
import { generateDungeon } from '../src/gen/dungeon';
import { generateAdventure } from '../src/gen/adventure';

describe('obsidian vault', () => {
  const w = buildWorld(DEFAULT_SETTINGS, 'vault-test');
  w.dungeons.push(generateDungeon('dg', { rooms: 10 }, w.sites.find((s) => s.kind === 'ruin')));
  w.adventures.push(generateAdventure('adv', { kinds: ['combat', 'investigation', 'social', 'treasure'] }, w, { kind: 'site', id: w.sites[0].id }, w.sites[0].name));
  const files = buildVaultNotes(w);
  const paths = files.map((f) => f.path);

  it('has unique paths and every note type', () => {
    expect(new Set(paths.map((p) => p.toLowerCase())).size).toBe(paths.length);
    for (const dir of ['Nations/', 'Locations/Cities/', 'Factions/', 'Gods/', 'Geography/', 'Dungeons/', 'Adventures/']) {
      expect(paths.some((p) => p.startsWith(dir))).toBe(true);
    }
  });

  it('puts a leaflet map in the overview and a location on every site note', () => {
    const overview = files.find((f) => !f.path.includes('/') && f.path.endsWith('.md'))!;
    expect(overview.content).toContain('```leaflet');
    expect(overview.content).toContain('markerFolder: Locations');
    for (const f of files.filter((x) => x.path.startsWith('Locations/'))) {
      expect(f.content).toMatch(/^location: \[\d+(\.\d+)?, \d+(\.\d+)?\]$/m);
      expect(f.content).toMatch(/mapmarker:\n {2}icon: /);
    }
  });

  it('only links to notes that exist', () => {
    const names = new Set(paths.filter((p) => p.endsWith('.md')).map((p) => p.split('/').pop()!.replace(/\.md$/, '')));
    for (const f of files) {
      if (typeof f.content !== 'string' || !f.path.endsWith('.md')) continue;
      for (const m of f.content.matchAll(/\[\[([^\]|]+)\]\]/g)) {
        const target = m[1];
        if (target.startsWith('Maps/') || target.endsWith('.svg')) continue;
        expect(names.has(target), `${f.path} links to missing [[${target}]]`).toBe(true);
      }
    }
  });
});

describe('bundled Leaflet plugin', () => {
  it('ships the plugin files that the vault enables', () => {
    const dir = path.resolve('public', LEAFLET_PLUGIN_ID);
    for (const f of LEAFLET_PLUGIN_FILES) expect(fs.existsSync(path.join(dir, f)), f).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).id).toBe(LEAFLET_PLUGIN_ID);
    const files = buildVaultNotes(buildWorld(DEFAULT_SETTINGS, 'plugin-test'));
    const enabled = files.find((f) => f.path === '.obsidian/community-plugins.json')!;
    expect(JSON.parse(enabled.content as string)).toContain(LEAFLET_PLUGIN_ID);
  });
});
