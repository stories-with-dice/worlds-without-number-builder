// Builds a world from settings and four layer seeds. Each layer depends only on the
// layers above it, so regenerating sites keeps the terrain and nations, and
// regenerating factions keeps everything else.
import { Rng, randomSeed } from '../rng';
import type { Settings, Seeds, World } from '../types';
import { generateTerrain } from './terrain';
import { generateNations } from './nations';
import { generateSites } from './sites';
import { generateFactions } from './factions';
import { NameBook, placeName, STYLE_IDS } from '../names';

export const DEFAULT_SETTINGS: Settings = { cols: 24, rows: 18, density: 8, nations: 5, factions: 4, oceanSides: -1, hexMiles: 8 };

export const SIZE_PRESETS: Record<string, [number, number]> = {
  'Small (16×12)': [16, 12],
  'Medium (24×18)': [24, 18],
  'Large (32×24)': [32, 24],
  'Huge (40×30)': [40, 30],
};

export function seedsFrom(master: string): Seeds {
  return { terrain: `${master}:terrain`, nations: `${master}:nations`, sites: `${master}:sites`, factions: `${master}:factions` };
}

function namesFor(world: Pick<World, 'regionName' | 'features' | 'nations' | 'sites'>): NameBook {
  const b = new NameBook();
  b.add(world.regionName);
  world.features?.forEach((x) => b.add(x.name));
  world.nations?.forEach((x) => b.add(x.name));
  return b;
}

export function buildWorld(settings: Settings, master: string, seeds: Seeds = seedsFrom(master)): World {
  const rng = new Rng(seeds.terrain);
  const regionStyle = rng.pick(STYLE_IDS);
  const regionName = placeName(regionStyle, rng.child('region'));
  const terrain = generateTerrain(settings, seeds.terrain, regionStyle);
  const world: World = {
    version: 1, master, settings: { ...settings }, seeds: { ...seeds }, regionName, regionStyle,
    oceanSides: terrain.oceanSides, hexes: terrain.hexes, rivers: terrain.rivers, roads: [], features: terrain.features,
    gods: [], nations: [], sites: [], factions: [], dungeons: [], overrides: {}, extras: {},
  };
  rebuildNations(world);
  return world;
}

export function rebuildNations(world: World): void {
  const names = namesFor({ ...world, nations: [], sites: [] });
  const { nations, gods } = generateNations(world.settings, world.hexes, world.seeds.nations, world.regionStyle, names);
  world.nations = nations;
  world.gods = gods;
  rebuildSites(world);
}

export function rebuildSites(world: World): void {
  const names = namesFor({ ...world, sites: [] });
  const { sites, roads } = generateSites(world.settings, world.hexes, world.nations, world.seeds.sites, world.regionStyle, names);
  world.sites = sites;
  world.roads = roads;
  // Dungeons belong to sites; drop the ones whose site no longer exists.
  world.dungeons = world.dungeons.filter((d) => !d.siteId);
  rebuildFactions(world);
}

export function rebuildFactions(world: World): void {
  world.factions = generateFactions(world.settings.factions, world.nations, world.sites, world.gods, world.seeds.factions);
}

/** Gives one layer a fresh seed and rebuilds it and the layers below it. */
export function reroll(world: World, layer: keyof Seeds): void {
  world.seeds[layer] = `${randomSeed()}:${layer}`;
  if (layer === 'terrain') {
    const fresh = buildWorld(world.settings, world.master, world.seeds);
    Object.assign(world, fresh, { overrides: world.overrides, extras: world.extras });
  } else if (layer === 'nations') rebuildNations(world);
  else if (layer === 'sites') rebuildSites(world);
  else rebuildFactions(world);
}

/** The display name, respecting user renames. */
export function nameOf(world: World, id: string, fallback: string): string {
  return world.overrides[id]?.name || fallback;
}
