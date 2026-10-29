import * as THREE from "three";
import { rng } from "@/lib/geo";
import { CITY_BOUNDS, pointInPolygon } from "./buildCity";
import { prepPolygon, triangulate } from "./geom";
import type { P2 } from "./types";

/**
 * The open ring (~3 km) around the detailed city: real main roads and water
 * from OpenStreetMap continue past the city edge, while buildings thin out
 * within ~1.4 km and then stop — open ground the map can later grow into.
 * The houses here are generalised (not real footprints).
 */
export interface OutskirtsData {
  attribution: string;
  rect: { x0: number; z0: number; x1: number; z1: number };
  roads: { k: string; w: number; b?: 1; p: P2[] }[];
  /** residential streets in a ~1 km band around the city (absent in older files) */
  minor?: { k: string; w: number; p: P2[] }[];
  water: { p: P2[]; n?: string }[];
  waterways: { k: string; n?: string; p: P2[] }[];
}

/** Distance (m) from a point to the detailed city rectangle; 0 inside it. */
export function distanceToCity(x: number, z: number) {
  const dx = Math.max(CITY_BOUNDS.x0 - x, 0, x - CITY_BOUNDS.x1);
  const dz = Math.max(CITY_BOUNDS.z0 - z, 0, z - CITY_BOUNDS.z1);
  return Math.hypot(dx, dz);
}

/** How built-up the ring is at a distance from the city edge: 1 at the edge, 0 from FADE on. */
export const FADE = 1400;
export const edgeDensity = (d: number) => (d >= FADE ? 0 : (1 - d / FADE) ** 2);

/** Pieces of a polyline that lie outside the detailed city rectangle. */
export function outsideCity(p: P2[]): P2[][] {
  const B = CITY_BOUNDS;
  const pieces: P2[][] = [];
  let cur: P2[] = [];
  const flush = () => {
    if (cur.length > 1) pieces.push(cur);
    cur = [];
  };
  const add = (q: P2) => {
    const last = cur[cur.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) cur.push(q);
  };
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    // inside interval [t0, t1] (Liang–Barsky); empty when ok = false
    let t0 = 0, t1 = 1, ok = true;
    for (const [q, r] of [[-dx, a[0] - B.x0], [dx, B.x1 - a[0]], [-dz, a[1] - B.z0], [dz, B.z1 - a[1]]]) {
      if (q === 0) { if (r < 0) ok = false; continue; }
      const t = r / q;
      if (q < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
    if (!ok || t0 >= t1) {
      add(a);
      add(b);
      continue;
    }
    const at = (t: number): P2 => [a[0] + dx * t, a[1] + dz * t];
    if (t0 > 0) { add(a); add(at(t0)); }
    flush();
    if (t1 < 1) { add(at(t1)); add(b); }
  }
  flush();
  return pieces;
}

interface Flat { pos: number[]; col: number[] }
const push = (o: Flat, x: number, y: number, z: number, c: THREE.Color) => { o.pos.push(x, y, z); o.col.push(c.r, c.g, c.b); };

function ribbon(o: Flat, pts: P2[], w: number, y: number, c: THREE.Color) {
  const hw = w / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.01) continue;
    const nx = (-(b[1] - a[1]) / len) * hw, nz = ((b[0] - a[0]) / len) * hw;
    // wound so the normal is +y
    push(o, a[0] + nx, y, a[1] + nz, c); push(o, b[0] + nx, y, b[1] + nz, c); push(o, b[0] - nx, y, b[1] - nz, c);
    push(o, a[0] + nx, y, a[1] + nz, c); push(o, b[0] - nx, y, b[1] - nz, c); push(o, a[0] - nx, y, a[1] - nz, c);
  }
  for (const q of pts) {
    const seg = 8;
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
      push(o, q[0], y, q[1], c); push(o, q[0] + Math.cos(a1) * hw, y, q[1] + Math.sin(a1) * hw, c); push(o, q[0] + Math.cos(a0) * hw, y, q[1] + Math.sin(a0) * hw, c);
    }
  }
}

function flatGeometry(o: Flat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(o.pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(o.col, 3));
  const n = new Float32Array(o.pos.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute("normal", new THREE.BufferAttribute(n, 3));
  g.computeBoundingSphere();
  return g;
}

export interface OutskirtsBuild {
  water: THREE.BufferGeometry;
  roads: THREE.BufferGeometry;
  /** generalised houses: x, z, yaw, width, depth, height, colour index */
  houses: Float32Array;
  /** scattered trees on the open land: x, z, scale */
  trees: Float32Array;
}

/** 4 m occupancy grid over the ring (water, road corridors, placed houses). */
class RingMask {
  readonly c = 4;
  readonly nx: number;
  readonly nz: number;
  readonly d: Uint8Array;
  constructor(readonly r: OutskirtsData["rect"]) {
    this.nx = Math.ceil((r.x1 - r.x0) / this.c);
    this.nz = Math.ceil((r.z1 - r.z0) / this.c);
    this.d = new Uint8Array(this.nx * this.nz);
  }
  idx(x: number, z: number) {
    const i = Math.floor((x - this.r.x0) / this.c), j = Math.floor((z - this.r.z0) / this.c);
    return i < 0 || j < 0 || i >= this.nx || j >= this.nz ? -1 : j * this.nx + i;
  }
  get(x: number, z: number) {
    const k = this.idx(x, z);
    return k < 0 ? 1 : this.d[k];
  }
  set(x: number, z: number) {
    const k = this.idx(x, z);
    if (k >= 0) this.d[k] = 1;
  }
  fillPolygon(p: P2[]) {
    let z0 = Infinity, z1 = -Infinity;
    for (const q of p) { z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
    for (let z = Math.floor(z0 / this.c) * this.c + this.c / 2; z <= z1; z += this.c) {
      const xs: number[] = [];
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [xi, zi] = p[i], [xj, zj] = p[j];
        if (zi > z !== zj > z) xs.push(xi + ((z - zi) * (xj - xi)) / (zj - zi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = xs[k]; x <= xs[k + 1] + this.c; x += this.c) this.set(x, z);
    }
  }
  fillSegment(a: P2, b: P2, hw: number) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / (len || 1), uz = (b[1] - a[1]) / (len || 1);
    for (let s = 0; s <= len; s += this.c / 2) for (let o = -hw; o <= hw; o += this.c / 2) this.set(a[0] + ux * s - uz * o, a[1] + uz * s + ux * o);
  }
  /** any occupied cell in the rectangle centred at (x, z)? */
  blocked(x: number, z: number, ux: number, uz: number, w: number, d: number) {
    for (let a = -0.5; a <= 0.501; a += 0.25) for (let b = -0.5; b <= 0.501; b += 0.25) {
      if (this.get(x + ux * w * a - uz * d * b, z + uz * w * a + ux * d * b)) return true;
    }
    return false;
  }
}

export function buildOutskirts(d: OutskirtsData, quality: "low" | "medium" | "high"): OutskirtsBuild {
  const R = rng(303);
  const mask = new RingMask(d.rect);
  // the detailed city is off limits (it has its own buildings)
  for (let z = CITY_BOUNDS.z0; z < CITY_BOUNDS.z1; z += mask.c) for (let x = CITY_BOUNDS.x0; x < CITY_BOUNDS.x1; x += mask.c) mask.set(x, z);

  /* water: full outlines (inside the city they coincide with the city's own water) */
  const water: Flat = { pos: [], col: [] };
  const wcol = new THREE.Color("#2f9fd6"), bank = new THREE.Color("#ddd3bd");
  const banks: Flat = { pos: [], col: [] };
  const R0 = d.rect;
  const onRect = (a: P2, b: P2) =>
    (Math.abs(a[0] - R0.x0) < 1 && Math.abs(b[0] - R0.x0) < 1) || (Math.abs(a[0] - R0.x1) < 1 && Math.abs(b[0] - R0.x1) < 1) ||
    (Math.abs(a[1] - R0.z0) < 1 && Math.abs(b[1] - R0.z0) < 1) || (Math.abs(a[1] - R0.z1) < 1 && Math.abs(b[1] - R0.z1) < 1);
  for (const w of d.water) {
    const p = prepPolygon(w.p);
    if (!p) continue;
    mask.fillPolygon(p);
    // embankment along the shore, as in the city (not along the data's outer clip line)
    let run: P2[] = [];
    const ring = [...p, p[0]];
    for (let i = 0; i < ring.length; i++) {
      if (i > 0 && onRect(ring[i - 1], ring[i])) {
        if (run.length > 1) ribbon(banks, run, 2.6, -0.028, bank);
        run = [];
      }
      run.push(ring[i]);
    }
    if (run.length > 1) ribbon(banks, run, 2.6, -0.028, bank);
    for (const [a, b, c] of triangulate(p)) {
      const up = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0;
      for (const q of up ? [a, b, c] : [a, c, b]) push(water, q[0], -0.03, q[1], wcol);
    }
  }
  for (const w of d.waterways) {
    const width = w.k === "stream" ? 5 : 14;
    for (const piece of outsideCity(w.p)) {
      ribbon(water, piece, width, -0.03, wcol);
      for (let i = 0; i < piece.length - 1; i++) mask.fillSegment(piece[i], piece[i + 1], width / 2 + 2);
    }
  }

  /* main roads, continuing out of the city */
  const roads: Flat = { pos: [], col: [] };
  const asphalt = new THREE.Color("#5c616a"), verge = new THREE.Color("#ddd5c4");
  // Residential streets: a street is kept whole (so it ends where it really
  // ends) when it starts close to the city; how far out depends on a wavy
  // threshold, so the street grid frays out instead of stopping at a line.
  const minor = (d.minor ?? []).filter((r) => {
    let near = Infinity;
    for (const q of r.p) near = Math.min(near, distanceToCity(q[0], q[1]));
    const q = r.p[0];
    const reach = 260 + 220 * (0.5 + 0.5 * Math.sin(q[0] / 230 + Math.cos(q[1] / 190) * 2));
    return near < reach;
  });
  const pieces = [...d.roads, ...minor].flatMap((r) => outsideCity(r.p).map((p) => ({ ...r, p })));
  for (const r of pieces) ribbon(roads, r.p, r.w + 4, -0.025, verge);
  for (const r of pieces) ribbon(roads, r.p, r.w, -0.02, asphalt);
  for (const r of pieces) for (let i = 0; i < r.p.length - 1; i++) mask.fillSegment(r.p[i], r.p[i + 1], r.w / 2 + 3);

  /* houses: rows along the roads, thinning out with distance from the city */
  const houses: number[] = [];
  const budget = quality === "low" ? 4500 : quality === "medium" ? 9000 : 14000;
  const spacing = 11;
  for (const r of pieces) {
    if (("b" in r && r.b) || /motorway/.test(r.k)) continue; // no frontage on bridges and expressways
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 6) continue;
      const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
      for (let s = spacing / 2; s < len; s += spacing) {
        const x = a[0] + ux * s, z = a[1] + uz * s;
        const dens = edgeDensity(distanceToCity(x, z));
        if (dens <= 0) continue;
        for (const side of [1, -1]) {
          const rows = dens > 0.55 ? 3 : dens > 0.25 ? 2 : 1;
          for (let row = 0; row < rows; row++) {
            if (R() > dens * 0.95 || houses.length / 7 >= budget) continue;
            const w = 4.5 + R() * 3, dep = 9 + R() * 7;
            const off = r.w / 2 + 3.5 + dep / 2 + row * 19;
            const hx = x - uz * off * side, hz = z + ux * off * side;
            if (mask.blocked(hx, hz, ux, uz, w + 1, dep + 1)) continue;
            const floors = 1 + Math.floor(R() * (1 + dens * 4));
            houses.push(hx, hz, -Math.atan2(uz, ux), w, dep, floors * 3.4 + 0.4, Math.floor(R() * 12));
            const nx = -uz, nz = ux;
            for (let p = -0.5; p <= 0.5; p += 0.25) for (let q = -0.5; q <= 0.5; q += 0.25) mask.set(hx + ux * w * p + nx * dep * q, hz + uz * w * p + nz * dep * q);
          }
        }
      }
    }
  }

  /* a few trees on the open land, more near the city edge */
  const trees: number[] = [];
  const nTrees = quality === "low" ? 1500 : 4000;
  for (let i = 0, tries = 0; i < nTrees && tries < nTrees * 8; tries++) {
    const x = d.rect.x0 + R() * (d.rect.x1 - d.rect.x0), z = d.rect.z0 + R() * (d.rect.z1 - d.rect.z0);
    const dist = distanceToCity(x, z);
    if (dist <= 0 || R() > 0.25 + edgeDensity(dist) * 0.6 || mask.get(x, z)) continue;
    trees.push(x, z, 0.8 + R() * 0.6);
    i++;
  }

  // banks after the water so they draw on top (spread would overflow the stack)
  for (let i = 0; i < banks.pos.length; i++) {
    water.pos.push(banks.pos[i]);
    water.col.push(banks.col[i]);
  }
  return { water: flatGeometry(water), roads: flatGeometry(roads), houses: new Float32Array(houses), trees: new Float32Array(trees) };
}

/** Kept for tests: is a point on the ring's water? */
export const onWater = (d: OutskirtsData, x: number, z: number) => d.water.some((w) => pointInPolygon(x, z, w.p));

let outskirtsData: Promise<OutskirtsData> | null = null;
/** Ring data is fetched once per session, after the city. */
export function loadOutskirtsData(): Promise<OutskirtsData> {
  if (!outskirtsData) {
    outskirtsData = fetch("/data/outskirts.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .catch((e) => {
        outskirtsData = null;
        throw e;
      });
  }
  return outskirtsData;
}

