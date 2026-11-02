import type { TagKind } from './data';

export type Terrain =
  | 'ocean' | 'lake' | 'grassland' | 'farmland' | 'lightForest' | 'denseForest' | 'jungle' | 'rainForest'
  | 'rollingHills' | 'rockyHills' | 'mountains' | 'volcano' | 'sandDesert' | 'scrubDesert' | 'swamp'
  | 'canyons' | 'arratu' | 'blasted' | 'megaplex' | 'pit';

/** A labeled fact from a table roll. `ref` is the table id, for page references. */
export interface Fact { label: string; text: string; ref?: string }

export interface Hex {
  i: number;           // index in world.hexes
  col: number;
  row: number;
  terrain: Terrain;
  elev: number;
  moist: number;
  river: boolean;
  road: boolean;
  nation?: string;     // nation id
  feature?: string;    // terrain feature id
}

export interface TerrainFeature {
  id: string;
  name: string;
  kind: string;        // book terrain feature name, e.g. "Jagged mountains"
  description: string;
  hexes: number[];
  center: number;
  facts: Fact[];
}

export interface God {
  id: string;
  name: string;
  domain: string;
  facts: Fact[];
}

export interface Nation {
  id: string;
  name: string;
  style: string;       // name style (linguistic touchstone)
  color: string;
  seat: number;        // hex of the capital, fixed when the nation is created
  capital?: string;    // site id
  hexes: number[];
  population: number;
  facts: Fact[];
  relations: { nation: string; kind: 'dispute' | 'tie'; text: string }[];
  gods: string[];      // god ids
}

export type SiteKind = 'capital' | 'city' | 'community' | 'court' | 'ruin' | 'wilderness';

export interface Site {
  id: string;
  kind: SiteKind;
  name: string;
  hex: number;
  nation?: string;
  subtitle: string;    // short type line, e.g. "Business court"
  tagKind: TagKind;
  tags: string[];
  facts: Fact[];
  population?: number;
  meta: Record<string, string>;
}

export interface FactionAsset { name: string; attribute: string; hp: number; maxHp: number; location: string; site?: string }

export interface Faction {
  id: string;
  name: string;
  kind: string;        // what the faction is: kingdom, cult, guild...
  size: 'small' | 'medium' | 'large';
  cunning: number;
  force: number;
  wealth: number;
  magic: 'None' | 'Low' | 'Medium' | 'High';
  hp: number;
  treasure: number;
  tags: string[];
  goal: string;
  homeSite?: string;   // site id of the Base of Influence
  nation?: string;
  assets: FactionAsset[];
  rivals: string[];
  facts: Fact[];
}

export interface Room {
  n: number;
  x: number;
  y: number;
  name: string;
  function: string;
  contents: string;   // Creature / Hazard / Enigma / Distractor / Empty
  detail: string;
  treasure?: string;
  level?: number;
  notes: string[];
}

export interface Dungeon {
  id: string;
  seed: string;
  siteId?: string;
  name: string;
  siteType: string;
  example: string;
  inhabitantKind: string;
  facts: Fact[];
  groups: { name: string; came: string; staying: string; doing: string; mood: string }[];
  relations: string[];
  rooms: Room[];
  links: { a: number; b: number; kind: 'open' | 'secret' | 'stairs' | 'hazard' }[];
  features: string[];
  wandering: string[];
}

export type ChallengeKind = 'combat' | 'investigation' | 'social' | 'treasure' | 'fractal' | 'oracle';
export type LairKind = 'urban' | 'wild' | 'deep';
export type AnchorKind = 'site' | 'faction' | 'nation';

/** Choices for the adventure generator. Empty values mean "pick from the anchor, or at random". */
export interface AdventureOptions {
  kinds: ChallengeKind[];
  lair?: LairKind;        // combat environment (p232-233)
  beast?: boolean;        // combat target is a bestial monster (p233)
  siteValue?: string;     // line of the site treasure value table (p256)
  owner?: string;         // line of the magic item chance table (p257)
  fractalSteps?: number;  // complication steps after the premise seed (Deluxe p380)
}

export interface Adventure {
  id: string;
  seed: string;
  name: string;
  anchor?: { kind: AnchorKind; id: string };
  options: AdventureOptions;
  prompts: Fact[];        // context from the anchor: goal, problems, tag elements
  sections: { kind: ChallengeKind; title: string; page: string; facts: Fact[] }[];
}

export interface Settings {
  cols: number;
  rows: number;
  density: 6 | 8 | 10 | 12 | 20;
  nations: number;
  factions: number;
  oceanSides: number;  // -1 = random 1-2
  hexMiles: number;
}

export interface Seeds { terrain: string; nations: string; sites: string; factions: string }

export interface Override { name?: string; notes?: string }

export interface World {
  version: 1;
  master: string;
  settings: Settings;
  seeds: Seeds;
  regionName: string;
  regionStyle: string;
  oceanSides: string[];
  hexes: Hex[];
  rivers: number[][];
  roads: number[][];
  features: TerrainFeature[];
  gods: God[];
  nations: Nation[];
  sites: Site[];
  factions: Faction[];
  dungeons: Dungeon[];
  adventures: Adventure[];
  overrides: Record<string, Override>;
  extras: Record<string, Extra[]>;
}

/** Results from premium generators attached to an entity (NPCs, seeds, architecture). */
export interface Extra { id: string; title: string; facts: Fact[] }
