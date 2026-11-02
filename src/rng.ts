// Seeded random numbers. The same seed string always gives the same world.

/** Hashes a string into a 32-bit seed (xmur3). */
function hash(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  readonly seed: string;

  constructor(seed: string) {
    this.seed = seed;
    const h = hash(seed);
    this.a = h();
    this.b = h();
    this.c = h();
    this.d = h();
    for (let i = 0; i < 15; i++) this.next();
  }

  /** Float in [0, 1) (sfc32). */
  next(): number {
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** One die: 1..sides. */
  die(sides: number): number {
    return this.int(1, sides);
  }

  /** Dice expression like "1d4+2" or "2d6". */
  dice(expr: string): number {
    const m = expr.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (!m) throw new Error(`Bad dice: ${expr}`);
    let total = Number(m[3] ?? 0);
    for (let i = 0; i < Number(m[1] || 1); i++) total += this.die(Number(m[2]));
    return total;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  weighted<T>(items: readonly [T, number][]): T {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [v, w] of items) if ((r -= w) < 0) return v;
    return items[items.length - 1][0];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** A new independent stream, stable for the same parent seed and label. */
  child(label: string): Rng {
    return new Rng(`${this.seed}/${label}`);
  }
}

const WORDS = ['ash', 'brass', 'crown', 'dusk', 'ember', 'fen', 'gyre', 'hollow', 'iron', 'jade', 'keep', 'lantern', 'moth', 'night', 'oath', 'pale', 'quill', 'rune', 'salt', 'thorn', 'umber', 'vale', 'wyrm', 'yew'];

/** A readable random seed such as "salt-moth-417". */
export function randomSeed(): string {
  const r = new Rng(String(Math.random()) + Date.now());
  return `${r.pick(WORDS)}-${r.pick(WORDS)}-${r.int(100, 999)}`;
}
