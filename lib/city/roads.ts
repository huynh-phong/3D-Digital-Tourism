import type { P2, RoadData } from "./types";

/**
 * RoadNetwork: everything derived from the OSM road graph that both the
 * renderer and the simulations need — deck heights of bridges/flyovers,
 * driving lanes (respecting oneway), and junctions with signal phases.
 */

export const vkey = (p: P2) => `${Math.round(p[0] * 2)},${Math.round(p[1] * 2)}`;

export type RoadClass = "major" | "minor" | "local";
export const roadClass = (k: string): RoadClass =>
  k.startsWith("trunk") || k.startsWith("primary") ? "major" : k.startsWith("secondary") || k.startsWith("tertiary") ? "minor" : "local";

export const DRIVABLE = new Set([
  "trunk", "primary", "secondary", "tertiary", "trunk_link", "primary_link", "secondary_link", "tertiary_link",
  "unclassified", "residential", "living_street",
]);

/* ---------------------------------------------------------- elevation */

/**
 * Bridges and flyovers (OSM bridge=* or layer ≥ 1) are lifted. Connected
 * elevated ways form one chain; the deck rises smoothly from the points where
 * the chain meets ground-level roads, so split OSM ways never create bumps.
 */
export function deckHeights(roads: RoadData[], isWater: (x: number, z: number) => boolean): Map<string, number> {
  const elevated = roads.filter((r) => (r.b || (r.l ?? 0) >= 1) && !r.a && r.p.length > 1);
  const ground = new Set<string>();
  for (const r of roads) if (!(r.b || (r.l ?? 0) >= 1)) for (const p of r.p) ground.add(vkey(p));

  // vertex graph of elevated ways
  const adj = new Map<string, { k: string; d: number }[]>();
  const pos = new Map<string, P2>();
  const target = new Map<string, number>(); // desired deck height per vertex
  for (const r of elevated) {
    // clearance from the length of water actually crossed: river spans get
    // a tall deck (boats pass under), canal bridges a low one
    let wet = 0;
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 0; s < len; s += 4) if (isWater(a[0] + ((b[0] - a[0]) * s) / len, a[1] + ((b[1] - a[1]) * s) / len)) wet += 4;
    }
    const H = wet > 120 ? 11 : wet > 0 ? 6 : 5.5 * Math.max(1, r.l ?? 1);
    r.p.forEach((p, i) => {
      const k = vkey(p);
      pos.set(k, p);
      target.set(k, Math.max(target.get(k) ?? 0, H));
      if (!adj.has(k)) adj.set(k, []);
      const n = r.p[i + 1];
      if (n) {
        const kn = vkey(n);
        const d = Math.hypot(n[0] - p[0], n[1] - p[1]);
        adj.get(k)!.push({ k: kn, d });
        if (!adj.has(kn)) adj.set(kn, []);
        adj.get(kn)!.push({ k, d });
      }
    });
  }
  // multi-source Dijkstra from ground connections (and dangling ends)
  const dist = new Map<string, number>();
  const queue: [number, string][] = [];
  for (const k of adj.keys()) {
    if (ground.has(k) || adj.get(k)!.length <= 1) {
      dist.set(k, 0);
      queue.push([0, k]);
    }
  }
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, k] = queue.shift()!;
    if (d > (dist.get(k) ?? Infinity)) continue;
    for (const e of adj.get(k)!) {
      const nd = d + e.d;
      if (nd < (dist.get(e.k) ?? Infinity)) {
        dist.set(e.k, nd);
        queue.push([nd, e.k]);
      }
    }
  }
  const out = new Map<string, number>();
  for (const [k, H] of target) {
    const d = dist.get(k) ?? 0;
    const ramp = H * 9; // ~6° approach gradient
    const t = Math.min(1, d / ramp);
    out.set(k, H * t * t * (3 - 2 * t));
  }
  return out;
}

/** Height of each vertex of a road (0 for ground roads). */
export function roadYs(r: RoadData, heights: Map<string, number>): number[] {
  if (!(r.b || (r.l ?? 0) >= 1)) return r.p.map(() => 0);
  return r.p.map((p) => heights.get(vkey(p)) ?? 0);
}

/* -------------------------------------------------------------- lanes */

export interface Lane {
  pts: P2[];
  ys: number[];
  cum: number[];
  length: number;
  next: number[];
  speed: number; // m/s design speed
  width: number;
  cls: RoadClass;
  startKey: string;
  endKey: string;
  /** junction index at the end of the lane (−1 when not a signalled junction) */
  endJunction: number;
  /** heading at the end (radians), used for signal phases */
  endHeading: number;
  oneway: boolean;
}

export interface Junction {
  x: number;
  z: number;
  r: number;
  arms: { dx: number; dz: number; w: number }[];
  /** axis angle used to split approaches into two signal phases */
  axis: number;
  offset: number; // phase offset (s)
}

export function findJunctions(roads: RoadData[]): Junction[] {
  const map = new Map<string, { x: number; z: number; arms: { dx: number; dz: number; w: number }[] }>();
  for (const r of roads) {
    if (r.k === "pedestrian" || r.a) continue;
    r.p.forEach((p, i) => {
      const k = vkey(p);
      if (!map.has(k)) map.set(k, { x: p[0], z: p[1], arms: [] });
      const j = map.get(k)!;
      for (const n of [r.p[i - 1], r.p[i + 1]]) {
        if (!n) continue;
        const l = Math.hypot(n[0] - p[0], n[1] - p[1]) || 1;
        j.arms.push({ dx: (n[0] - p[0]) / l, dz: (n[1] - p[1]) / l, w: r.w });
      }
    });
  }
  const out: Junction[] = [];
  let i = 0;
  for (const j of map.values()) {
    if (j.arms.length < 3) continue;
    const widest = j.arms.reduce((a, b) => (b.w > a.w ? b : a));
    out.push({ x: j.x, z: j.z, r: widest.w / 2 + 2, arms: j.arms, axis: Math.atan2(widest.dz, widest.dx), offset: (i++ * 7.3) % 24 });
  }
  return out;
}

function offsetPolyline(pts: P2[], off: number): P2[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    return [p[0] - (dz / len) * off, p[1] + (dx / len) * off];
  });
}

const SPEED: Record<RoadClass, number> = { major: 10, minor: 8, local: 5.5 };

export function buildLanes(roads: RoadData[], heights: Map<string, number>, junctions: Junction[], inside: (p: P2) => boolean = () => true): Lane[] {
  const jIndex = new Map<string, number>();
  junctions.forEach((j, i) => jIndex.set(vkey([j.x, j.z]), i));
  const lanes: Lane[] = [];
  const starts = new Map<string, number[]>();
  // Lanes stop at the edge of the map: split each road into runs of inside points.
  const pieces: { r: RoadData; p: P2[]; ys: number[] }[] = [];
  for (const r of roads) {
    if (!DRIVABLE.has(r.k) || r.a || r.p.length < 2) continue;
    const ys = roadYs(r, heights);
    let run: P2[] = [], ry: number[] = [];
    r.p.forEach((q, i) => {
      if (inside(q)) { run.push(q); ry.push(ys[i]); }
      else { if (run.length > 1) pieces.push({ r, p: run, ys: ry }); run = []; ry = []; }
    });
    if (run.length > 1) pieces.push({ r, p: run, ys: ry });
  }
  for (const { r: road, p: rp, ys } of pieces) {
    const r = { ...road, p: rp };
    const dirs = r.o === 1 ? [1] : r.o === -1 ? [-1] : [1, -1];
    for (const dir of dirs) {
      const center = dir === 1 ? r.p : [...r.p].reverse();
      const y = dir === 1 ? ys : [...ys].reverse();
      // one-way roads drive down the middle; two-way roads keep right
      const pts = r.o ? offsetPolyline(center, 0) : offsetPolyline(center, Math.max(1.4, r.w / 4));
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const length = cum[cum.length - 1];
      if (length < 4) continue;
      const a = center[center.length - 2], b = center[center.length - 1];
      const startKey = vkey(center[0]), endKey = vkey(center[center.length - 1]);
      if (!starts.has(startKey)) starts.set(startKey, []);
      starts.get(startKey)!.push(lanes.length);
      const cls = roadClass(r.k);
      lanes.push({
        pts, ys: y, cum, length, next: [], speed: SPEED[cls], width: r.w, cls, startKey, endKey,
        endJunction: jIndex.get(endKey) ?? -1,
        endHeading: Math.atan2(b[1] - a[1], b[0] - a[0]),
        oneway: !!r.o,
      });
    }
  }
  for (const l of lanes) {
    const cands = (starts.get(l.endKey) ?? []).filter((j) => lanes[j].endKey !== l.startKey || lanes[j].pts.length !== l.pts.length);
    // no U-turns unless it's a dead end
    l.next = cands.length ? cands : (starts.get(l.endKey) ?? []);
  }
  return lanes;
}

/** Sample position + heading (+height) on a polyline at distance s. */
export function sampleLane(l: { pts: P2[]; cum: number[]; ys?: number[] }, s: number, out: { x: number; z: number; dx: number; dz: number; y?: number }) {
  const cum = l.cum;
  let lo = 1, hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < s) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo);
  const a = l.pts[i - 1], b = l.pts[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const t = Math.min(1, Math.max(0, (s - cum[i - 1]) / seg));
  out.x = a[0] + (b[0] - a[0]) * t;
  out.z = a[1] + (b[1] - a[1]) * t;
  out.dx = (b[0] - a[0]) / seg;
  out.dz = (b[1] - a[1]) / seg;
  if (l.ys) out.y = l.ys[i - 1] + (l.ys[i] - l.ys[i - 1]) * t;
  return out;
}
