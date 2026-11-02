// Flat-top hexes in "odd-q" offset layout: odd columns sit half a hex lower.
// Hex labels use the Sectors Without Number style "CCRR" (column, row).

export const SQRT3 = Math.sqrt(3);

export interface Grid { cols: number; rows: number }

export const idx = (g: Grid, col: number, row: number) => row * g.cols + col;
export const colOf = (g: Grid, i: number) => i % g.cols;
export const rowOf = (g: Grid, i: number) => Math.floor(i / g.cols);
export const inside = (g: Grid, col: number, row: number) => col >= 0 && row >= 0 && col < g.cols && row < g.rows;

const EVEN = [[1, -1], [1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1]];
const ODD = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1]];

/** Neighbor indexes of hex i. */
export function neighbors(g: Grid, i: number): number[] {
  const c = colOf(g, i), r = rowOf(g, i);
  const out: number[] = [];
  for (const [dc, dr] of c & 1 ? ODD : EVEN) {
    if (inside(g, c + dc, r + dr)) out.push(idx(g, c + dc, r + dr));
  }
  return out;
}

/** Neighbor in a fixed direction 0..5 (NE, SE, S, SW, NW, N), or -1 at the edge. */
export function neighborDir(g: Grid, i: number, dir: number): number {
  const c = colOf(g, i), r = rowOf(g, i);
  const [dc, dr] = (c & 1 ? ODD : EVEN)[dir];
  return inside(g, c + dc, r + dr) ? idx(g, c + dc, r + dr) : -1;
}

function toCube(col: number, row: number): [number, number, number] {
  const x = col;
  const z = row - (col - (col & 1)) / 2;
  return [x, -x - z, z];
}

export function distance(g: Grid, a: number, b: number): number {
  const [ax, ay, az] = toCube(colOf(g, a), rowOf(g, a));
  const [bx, by, bz] = toCube(colOf(g, b), rowOf(g, b));
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

/** Pixel center of a hex with circumradius `size`. */
export function center(g: Grid, i: number, size: number): [number, number] {
  const c = colOf(g, i), r = rowOf(g, i);
  return [size + c * size * 1.5, (SQRT3 / 2) * size + size * SQRT3 * (r + 0.5 * (c & 1))];
}

export function corners(cx: number, cy: number, size: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;
    out.push([cx + size * Math.cos(a), cy + size * Math.sin(a)]);
  }
  return out;
}

/** The shared edge between hex a and neighbor b, as two points. */
export function sharedEdge(g: Grid, a: number, b: number, size: number): [[number, number], [number, number]] {
  const [ax, ay] = center(g, a, size);
  const [bx, by] = center(g, b, size);
  const ang = Math.atan2(by - ay, bx - ax);
  // Edge midpoint direction is the angle to the neighbor; corners sit ±30° from it.
  const p = (d: number): [number, number] => [ax + size * Math.cos(ang + d), ay + size * Math.sin(ang + d)];
  return [p(-Math.PI / 6), p(Math.PI / 6)];
}

export function mapPixelSize(g: Grid, size: number): [number, number] {
  return [size * 2 + (g.cols - 1) * size * 1.5, size * SQRT3 * (g.rows + 0.5)];
}

/** "0304" style label, 1-based like SWN maps. */
export function hexLabel(g: Grid, i: number): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return p(colOf(g, i) + 1) + p(rowOf(g, i) + 1);
}

/** Dijkstra from many sources. cost(from, to) returns Infinity for blocked moves. */
export function dijkstra(g: Grid, sources: number[], cost: (from: number, to: number) => number, limit = Infinity) {
  const n = g.cols * g.rows;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const origin = new Int32Array(n).fill(-1);
  const heap: [number, number][] = [];
  const push = (d: number, i: number) => {
    heap.push([d, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  sources.forEach((s, si) => { dist[s] = 0; origin[s] = si; push(0, s); });
  while (heap.length) {
    const [d, i] = pop();
    if (d > dist[i] || d > limit) continue;
    for (const j of neighbors(g, i)) {
      const nd = d + cost(i, j);
      if (nd < dist[j] && nd <= limit) {
        dist[j] = nd; prev[j] = i; origin[j] = origin[i];
        push(nd, j);
      }
    }
  }
  return { dist, prev, origin };
}

export function pathTo(prev: Int32Array, target: number): number[] {
  const path: number[] = [];
  for (let i = target; i !== -1; i = prev[i]) path.unshift(i);
  return path;
}
