// Table data. Free-edition tables are bundled; Deluxe tables are loaded at run time
// from the JSON that the premium CLI writes from the user's own PDF.
import freeJson from './data/free.json';
import { Rng } from './rng';

export interface Row { min: number; max: number; text: string; name?: string }
export interface Table { title: string; die: number; page: number; rows: Row[] }
export interface Matrix { title: string; page: number; groups: { name: string; entries: string[] }[] }
/** A table with named lines and labeled columns instead of a die column (e.g. p256 site treasure value). */
export interface Grid { title: string; page: number; columns: string[]; lines: { name: string; cells: string[] }[] }
export interface Tag {
  name: string; description: string; page: number;
  enemies: string[]; friends: string[]; complications: string[]; things: string[]; places: string[];
}
export type TagKind = 'community' | 'court' | 'ruin' | 'wilderness';
export interface Asset {
  name: string; attribute: 'Cunning' | 'Force' | 'Wealth'; rating: number; cost: number; hp: number;
  magic: string; attack: string; counter: string; qualities: string[]; text?: string;
}
export interface Seed { n: number; text: string }
export type SeedKind = 'enemy' | 'friend' | 'complication' | 'thing' | 'place';

interface FreeData {
  tables: Record<string, Table | Matrix | Grid>;
  tags: Record<TagKind, Tag[]>;
  factions: { tags: { name: string; text: string; page: number }[]; goals: { name: string; text: string; page: number }[]; assets: Asset[] };
}
export interface PremiumData {
  edition: 'deluxe';
  version: number;
  tables: Record<string, Table>;
  seeds: Record<SeedKind, Seed[]>;
}

export const free = freeJson as unknown as FreeData;

let premium: PremiumData | null = null;
const PREMIUM_KEY = 'wwn.premium';

export function getPremium(): PremiumData | null {
  return premium;
}

/** Checks that a parsed JSON object is premium data from the CLI. */
export function validatePremium(obj: unknown): PremiumData {
  const p = obj as PremiumData;
  if (!p || p.edition !== 'deluxe' || !p.tables || !p.seeds || !p.tables['npc.twists']) {
    throw new Error('This file is not premium data from the wwn-premium CLI.');
  }
  return p;
}

export function setPremium(p: PremiumData | null, persist = true): void {
  premium = p;
  if (!persist) return;
  try {
    if (p) localStorage.setItem(PREMIUM_KEY, JSON.stringify(p));
    else localStorage.removeItem(PREMIUM_KEY);
  } catch { /* storage full or blocked; data stays for this session */ }
}

/**
 * Loads premium data from browser storage, or from /data/premium.json, which only the
 * local dev server provides (from premium/premium.json, written by `npm run premium`).
 */
export async function loadPremium(): Promise<PremiumData | null> {
  try {
    const saved = localStorage.getItem(PREMIUM_KEY);
    if (saved) { premium = validatePremium(JSON.parse(saved)); return premium; }
  } catch { /* ignore broken storage */ }
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/premium.json`, { cache: 'no-store' });
    if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) {
      premium = validatePremium(await res.json());
      return premium;
    }
  } catch { /* no premium file */ }
  return null;
}

function findTable(id: string): Table | undefined {
  const t = (free.tables[id] as Table | undefined) ?? premium?.tables[id];
  return t && 'rows' in t ? t : undefined;
}

export function table(id: string): Table {
  const t = findTable(id);
  if (!t) throw new Error(`Unknown table ${id}`);
  return t;
}

export function matrix(id: string): Matrix {
  return free.tables[id] as Matrix;
}

export function grid(id: string): Grid {
  return free.tables[id] as Grid;
}

/** True when `id` is a die table that `roll` can use. */
export function isTable(id: string): boolean {
  return findTable(id) !== undefined;
}

/** Formats a row: "Name: text", or "Name, text" when the book writes it as one phrase. */
export function rowText(r: Row): string {
  if (!r.name) return r.text;
  if (!r.text) return r.name;
  return /^[,;]/.test(r.text) ? `${r.name}${r.text}` : `${r.name}: ${r.text}`;
}

/** Rolls the table's die and returns the matching row. */
export function rollRow(id: string, rng: Rng): Row {
  const t = table(id);
  const n = rng.die(t.die);
  return t.rows.find((r) => n >= r.min && n <= r.max) ?? t.rows[t.rows.length - 1];
}

const REROLL = /^roll (twice|again)/i;

/**
 * Rolls on a table and returns plain text. "Roll twice" rows roll two more
 * results and keep the book's instruction after them.
 */
export function roll(id: string, rng: Rng, depth = 0): string {
  const r = rollRow(id, rng);
  const text = rowText(r);
  if (!REROLL.test(r.text) || depth > 1) return text;
  const others = table(id).rows.filter((x) => !REROLL.test(x.text));
  const a = rowText(rng.pick(others));
  if (/^roll again/i.test(r.text)) return `${a} (${text})`;
  let b = rowText(rng.pick(others));
  if (b === a) b = rowText(rng.pick(others));
  return `${a}; ${b} (${text})`;
}

/** Rolls n distinct results. */
export function rollDistinct(id: string, rng: Rng, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n * 6 && out.length < n; i++) {
    const v = roll(id, rng);
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export function tag(kind: TagKind, name: string): Tag | undefined {
  return free.tags[kind].find((t) => t.name === name);
}

/** Picks two different tags of a kind, as the book suggests for each site. */
export function pickTags(kind: TagKind, rng: Rng, n = 2): string[] {
  return rng.shuffle([...free.tags[kind]]).slice(0, n).map((t) => t.name);
}

export function tablePage(id: string): number | undefined {
  return findTable(id)?.page ?? free.tables[id]?.page;
}
