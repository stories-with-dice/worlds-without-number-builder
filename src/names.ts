// Name generator. The book advises picking one "linguistic touchstone" per
// kingdom so its names share sounds. Each style below is a small, invented
// sound palette; all names in a nation use that nation's style.
import { Rng } from './rng';

interface Style {
  label: string;
  onsets: string[];
  vowels: string[];
  codas: string[];
  endings: string[];   // optional place-name endings
  syllables: [number, number];
}

export const STYLES: Record<string, Style> = {
  harsh: {
    label: 'Harsh and guttural',
    onsets: ['k', 'kr', 'g', 'gr', 'd', 'dr', 'th', 'v', 'z', 'b', 'br', 'h', 'sk', 'm', 'r'],
    vowels: ['a', 'o', 'u', 'a', 'o', 'e', 'au'],
    codas: ['k', 'g', 'rk', 'rn', 'th', 'd', 'x', 'm', 'r', 'n', 'z', 'sk', ''],
    endings: ['grad', 'hold', 'mar', 'dun', 'kar', 'vok'],
    syllables: [1, 3],
  },
  flowing: {
    label: 'Soft and flowing',
    onsets: ['l', 'm', 'n', 's', 'th', 'v', 'el', 'ar', 'f', 'y', 'r', 'c'],
    vowels: ['a', 'e', 'i', 'ia', 'ae', 'ei', 'o', 'ie'],
    codas: ['l', 'n', 'r', 's', 'th', '', '', ''],
    endings: ['wen', 'dria', 'lune', 'mir', 'sael', 'ith'],
    syllables: [2, 3],
  },
  imperial: {
    label: 'Old imperial',
    onsets: ['c', 'v', 't', 'm', 'p', 'l', 'qu', 's', 'r', 'n', 'aur', 'f', 'g'],
    vowels: ['a', 'e', 'i', 'o', 'u', 'ae', 'io'],
    codas: ['', '', 'n', 's', 'r', 'x', 'l', 'm'],
    endings: ['ium', 'ara', 'ona', 'entum', 'ia', 'us'],
    syllables: [2, 3],
  },
  desert: {
    label: 'Sun and sand',
    onsets: ['kh', 'q', 'z', 's', 'sh', 'b', 'h', 'j', 'm', 'r', 'n', 'f', 't'],
    vowels: ['a', 'aa', 'i', 'u', 'ei', 'a', 'oo'],
    codas: ['', 'r', 'd', 'n', 'm', 'sh', 'q', 'l', 'b'],
    endings: ['abad', 'esh', 'ir', 'ani', 'sar', 'ul'],
    syllables: [2, 3],
  },
  northern: {
    label: 'Cold northern',
    onsets: ['sv', 'h', 'fr', 'gr', 'tj', 'b', 'v', 'st', 'sk', 'r', 'j', 'ey', 'th'],
    vowels: ['a', 'e', 'i', 'o', 'y', 'ø', 'ei', 'au'],
    codas: ['n', 'r', 'ld', 'rd', 'nd', 'k', 'g', 'st', '', 'f'],
    endings: ['heim', 'vik', 'by', 'stad', 'fjord', 'mark'],
    syllables: [1, 2],
  },
  island: {
    label: 'Island and sea',
    onsets: ['k', 'm', 'n', 'p', 't', 'h', 'w', 'l', 'r', ''],
    vowels: ['a', 'e', 'i', 'o', 'u', 'ai', 'ao', 'au'],
    codas: ['', '', '', '', 'n'],
    endings: ['ua', 'iki', 'ono', 'ana', 'ele'],
    syllables: [2, 4],
  },
  eastern: {
    label: 'River-delta courts',
    onsets: ['ch', 'sh', 'l', 'h', 'x', 'j', 'm', 'q', 't', 'y', 'w', 'z'],
    vowels: ['a', 'ai', 'ao', 'e', 'i', 'u', 'ia', 'ou'],
    codas: ['n', 'ng', '', '', 'n'],
    endings: ['zhou', 'ling', 'an', 'shan', 'jiang'],
    syllables: [1, 2],
  },
  sylvan: {
    label: 'Deep forest',
    onsets: ['bh', 'c', 'd', 'g', 'l', 'm', 'n', 'r', 's', 't', 'f', 'dw'],
    vowels: ['a', 'ai', 'ea', 'e', 'i', 'o', 'u', 'ui'],
    codas: ['dh', 'gh', 'n', 'r', 'l', 'th', 'ch', ''],
    endings: ['wyn', 'more', 'dair', 'loch', 'ach'],
    syllables: [1, 3],
  },
};

export const STYLE_IDS = Object.keys(STYLES);

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** One word in a style. */
export function word(style: string, rng: Rng): string {
  const st = STYLES[style] ?? STYLES.imperial;
  const n = rng.int(st.syllables[0], st.syllables[1]);
  let w = '';
  for (let i = 0; i < n; i++) {
    const onset = i === 0 || rng.chance(0.7) ? rng.pick(st.onsets) : '';
    const coda = i === n - 1 || rng.chance(0.25) ? rng.pick(st.codas) : '';
    w += onset + rng.pick(st.vowels) + coda;
  }
  // Avoid tripled letters and over-long words.
  w = w.replace(/(.)\1\1+/g, '$1$1').slice(0, 11);
  return cap(w);
}

/** A place name; sometimes uses the style's endings. */
export function placeName(style: string, rng: Rng): string {
  const st = STYLES[style] ?? STYLES.imperial;
  if (rng.chance(0.35)) {
    const root = word(style, new Rng(rng.seed + rng.next())).slice(0, 6);
    return cap(root.toLowerCase() + rng.pick(st.endings));
  }
  return word(style, rng);
}

/** A person name: given name, sometimes with a family or clan name. */
export function personName(style: string, rng: Rng): string {
  const given = word(style, rng);
  return rng.chance(0.6) ? `${given} ${word(style, rng)}` : given;
}

/** Keeps generated names unique inside one world. */
export class NameBook {
  private used = new Set<string>();
  unique(make: () => string): string {
    for (let i = 0; i < 30; i++) {
      const n = make();
      if (!this.used.has(n)) { this.used.add(n); return n; }
    }
    const n = make() + ' II';
    this.used.add(n);
    return n;
  }
  add(n: string): void { this.used.add(n); }
}
