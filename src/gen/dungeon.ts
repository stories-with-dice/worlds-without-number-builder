// Exploration site ("dungeon") generator, following "Creating Exploration Challenges" (WWN p234-247):
//  1. Choose the site type (p238).
//  2. Choose the inhabitant framework and groups (p239-240).
//  3. Generate rooms of interest (p241).
//  4. Lay out the rooms with exits and egresses (p243).
//  5. Add optional map features (p243).
//  6. Stock the rooms: 1d8 contents + 1d6 treasure (p244-245).
//  7. Build a six-entry wandering encounter table (p236, p247).
import { Rng } from '../rng';
import { matrix, roll, rollDistinct } from '../data';
import type { Dungeon, Fact, Room, Site } from '../types';

export const INHABITANT_KINDS: Record<string, string> = {
  ancient: 'Ancient sorcerer-king ruin',
  deep: 'Subterranean Deep',
  modern: 'Modern ruin site',
  arratu: 'Alien arratu',
  wilderness: 'Trackless wilderness',
};

// Exits (d8, p243): 1-2 one, 3-4 two, 5-7 three, 8 four.
const EXITS = [0, 1, 1, 2, 2, 3, 3, 3, 4];
// Egresses (d12, p243): 1-2 N, 3 NE, 4-5 E, 6 SE, 7-8 S, 9 SW, 10-11 W, 12 NW.
const DIRS: [number, number][] = [[0, -1], [0, -1], [1, -1], [1, 0], [1, 0], [1, 1], [0, 1], [0, 1], [-1, 1], [-1, 0], [-1, 0], [-1, -1]];

// Contents (1d8) and treasure (1d6) from p244.
function contents(rng: Rng): { kind: string; treasure: boolean } {
  const c = rng.die(8), t = rng.die(6);
  if (c <= 2) return { kind: 'Creature', treasure: t <= 3 };
  if (c === 3) return { kind: 'Hazard', treasure: t <= 2 };
  if (c === 4) return { kind: 'Enigma', treasure: t <= 2 };
  if (c <= 6) return { kind: 'Distractor', treasure: t === 1 };
  return { kind: 'Empty', treasure: t === 1 };
}

export interface DungeonOptions {
  rooms: number;          // 10 small, 20 session, 30-40 large (p234-235)
  inhabitantKind?: string;
  siteGroup?: string;
  siteExample?: string;
  name?: string;
}

export function generateDungeon(seed: string, opts: DungeonOptions, site?: Site): Dungeon {
  const rng = new Rng(seed);
  const facts: Fact[] = [];

  // 1. Site type.
  const sites = matrix('dungeon.siteTypes');
  const group = sites.groups.find((g) => g.name === opts.siteGroup) ?? rng.pick(sites.groups);
  const example = opts.siteExample ?? rng.pick(group.entries);
  facts.push({ label: 'Site type', text: `${group.name}: ${example}`, ref: 'dungeon.siteTypes' });

  // 2. Inhabitants.
  const kind = opts.inhabitantKind ?? rng.pick(Object.keys(INHABITANT_KINDS));
  const framework = roll('dungeon.inhabitants', rng);
  facts.push({ label: 'Inhabitant framework', text: framework, ref: 'dungeon.inhabitants' });
  const groupCount = /multiple|several|two|rival|hostile to each other/i.test(framework) ? rng.int(2, 3) : /no discernible|congery/i.test(framework) ? 0 : 1;
  const groupNames = rollDistinct(`dungeon.inhabitantTypes.${kind}`, rng, Math.max(1, groupCount));
  const groups = groupNames.slice(0, Math.max(groupCount, 1)).map((name) => ({
    name,
    came: roll('dungeon.came', rng),
    staying: roll('dungeon.staying', rng),
    doing: roll('dungeon.trying', rng),
    mood: roll('dungeon.mood', rng),
  }));
  const relations: string[] = [];
  for (let a = 0; a < groups.length; a++) {
    for (let b = a + 1; b < groups.length; b++) {
      const hostile = rng.chance(0.6);
      relations.push(`${groups[a].name} and ${groups[b].name}: ${hostile ? 'hostile, because ' : 'allied, because '}${roll(hostile ? 'dungeon.hostility' : 'dungeon.alliances', rng).replace(/^./, (c) => c.toLowerCase())}`);
    }
  }

  // 3. Rooms of interest: a few characteristic of the site type, the rest from the table.
  const rooms = matrix('dungeon.rooms');
  const roomName = (): [string, string] => {
    const g = rng.pick(rooms.groups);
    return [rng.pick(g.entries), g.name];
  };

  // 4. Layout on a grid, card by card.
  const total = Math.max(4, opts.rooms);
  const placed: Room[] = [];
  const at = new Map<string, number>();
  const links: Dungeon['links'] = [];
  const linked = (a: number, b: number) => links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
  const add = (x: number, y: number): Room => {
    const [name, func] = roomName();
    const r: Room = { n: placed.length + 1, x, y, name, function: func, contents: 'Empty', detail: '', notes: [] };
    placed.push(r);
    at.set(`${x},${y}`, r.n);
    return r;
  };
  const entrance = add(0, 0);
  entrance.notes.push('Entrance (ingress point)');
  const queue: Room[] = [entrance];
  let guard = 0;
  while (placed.length < total && guard++ < total * 40) {
    let room = queue.shift();
    if (!room) {
      // Dead end everywhere: return to an earlier room and add a fresh connection.
      room = rng.pick(placed);
    }
    let exits = EXITS[rng.die(8)];
    if (room === entrance) exits = Math.max(2, exits); // give the PCs a choice at the start
    const used = new Set<number>();
    for (let e = 0; e < exits && placed.length < total; e++) {
      let d = rng.die(12) - 1;
      for (let t = 0; t < 4 && used.has(d); t++) d = rng.die(12) - 1;
      used.add(d);
      const [dx, dy] = DIRS[d];
      const nx = room.x + dx, ny = room.y + dy;
      const existing = at.get(`${nx},${ny}`);
      if (existing) {
        if (!linked(room.n, existing)) links.push({ a: room.n, b: existing, kind: 'open' }); // a loop
        continue;
      }
      const r = add(nx, ny);
      links.push({ a: room.n, b: r.n, kind: 'open' });
      queue.push(r);
    }
  }
  // Make sure there is at least one loop.
  if (links.length < placed.length) {
    for (const r of rng.shuffle([...placed])) {
      const near = placed.find((o) => o !== r && Math.abs(o.x - r.x) <= 1 && Math.abs(o.y - r.y) <= 1 && !linked(o.n, r.n));
      if (near) { links.push({ a: r.n, b: near.n, kind: 'open' }); break; }
    }
  }

  // 5. Optional map features.
  const features: string[] = [];
  const far = [...placed].sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y));
  if (placed.length >= 8 && rng.chance(0.6)) {
    const r = far[0];
    r.notes.push('Stairs or shaft down to a deeper level');
    features.push(`Different levels: room ${r.n} leads down to a lower level, where worse things dwell.`);
  }
  if (rng.chance(0.3)) {
    const l = rng.pick(links.filter((x) => x.a !== 1 && x.b !== 1));
    if (l) { l.kind = 'hazard'; features.push(`A river, crevasse, or pit cuts the way between rooms ${l.a} and ${l.b}.`); }
  }
  if (rng.chance(0.4)) {
    const l = rng.pick(links.filter((x) => x.kind === 'open' && x.a !== 1));
    if (l) { l.kind = 'secret'; features.push(`The passage between rooms ${l.a} and ${l.b} is a secret or concealed door.`); }
  }
  if (kind === 'arratu' && rng.chance(0.7)) features.push('Toxic atmosphere: lingering here adds System Strain until the explorers leave or pass out.');
  if (rng.chance(0.15)) features.push(`Timed accessibility: room ${rng.pick(placed).n} opens only at certain times or with a key.`);

  // 6. Stock the rooms.
  const valuables = () => roll('treasure.valuables', rng);
  for (const r of placed) {
    const c = contents(rng);
    r.contents = c.kind;
    if (c.kind === 'Creature') {
      // Most creatures come from the inhabitant groups; about a third are unrelated.
      const g = groups.length && rng.chance(0.67) ? rng.pick(groups) : null;
      r.detail = g ? `${g.name}. ${g.doing}; ${g.mood.replace(/^./, (x) => x.toLowerCase())}.` : `Unaffiliated creature: ${roll(rng.pick(['wild.beasts', 'dungeon.encounterTemplate']), rng)}`;
    } else if (c.kind === 'Hazard') r.detail = roll('dungeon.hazards', rng);
    else if (c.kind === 'Enigma') r.detail = roll('dungeon.enigmas', rng);
    else if (c.kind === 'Distractor') r.detail = roll('dungeon.distractors', rng);
    if (c.treasure) r.treasure = `${valuables()}: ${roll('dungeon.treasureLocations', rng).replace(/^./, (x) => x.toLowerCase())}`;
  }
  // Half the loot goes in one or two major troves (p244).
  const withTreasure = placed.filter((r) => r.treasure);
  rng.shuffle([...withTreasure]).slice(0, Math.min(2, withTreasure.length)).forEach((r) => r.notes.push('Major trove: about half of the site\'s total loot'));

  // 7. Wandering encounters: six entries, about a third environmental events.
  const wandering: string[] = [];
  for (let i = 0; i < 6; i++) {
    if (i >= 4) wandering.push(`Event: ${roll('events.dungeon', rng)}`);
    else if (groups.length && i < 3) wandering.push(`${rng.pick(groups).name}: ${roll('dungeon.trying', rng).replace(/^./, (x) => x.toLowerCase())}`);
    else wandering.push(roll('dungeon.encounterTemplate', rng));
  }

  return {
    id: `dungeon-${seed}`,
    seed,
    siteId: site?.id,
    name: opts.name ?? site?.name ?? example,
    siteType: group.name,
    example,
    inhabitantKind: INHABITANT_KINDS[kind] ?? kind,
    facts,
    groups,
    relations,
    rooms: placed,
    links,
    features,
    wandering,
  };
}
