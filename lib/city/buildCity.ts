import * as THREE from "three";
import { rng } from "@/lib/geo";
import { addBuilding, classify, newBuckets, rectish, PALETTE, type Buckets } from "./architecture";
import { box, edgeNormal, newBuf, prepPolygon, quad, signedArea, toGeometry, triangulate } from "./geom";
import { buildLanes, deckHeights, findJunctions, roadYs, type Lane } from "./roads";
import { buildBoatLoops } from "@/lib/sim/water";
import type { CityData, P2, RoadData } from "./types";

/**
 * Turns OpenStreetMap data into a handful of merged geometries.
 * Everything is in metres (+x east, +z south) with the palace at the origin.
 * Geography (roads, footprints, landmark positions) is used as-is; only the
 * way it is dressed (architecture, materials, street furniture) is generated.
 */

/** Detailed area: Districts 1 & 3 core, Thủ Thiêm edge, Thảo Cầm Viên, Ba Son and Landmark 81. */
export const CITY_BOUNDS = { x0: -860, x1: 3400, z0: -2500, z1: 1260 };

/**
 * How "central" a point is (0..1): 1 around the Nguyễn Huệ / Bến Nghé CBD and the
 * Vinhomes Central Park towers, falling off with distance. Used only to decide
 * the height of buildings whose height OSM does not record.
 */
export function urbanity(x: number, z: number) {
  const cbd = Math.hypot(x - 950, z - 350) / 1300;
  const vcp = Math.hypot(x - 2950, z - 2000) / 550;
  return Math.max(0, 1 - Math.min(cbd, vcp));
}

/** Ground colour of OSM land-use areas that are not parks. */
const LANDUSE_COLOR: Record<string, string> = {
  construction: "#cdb28a", brownfield: "#cdb28a", parking: "#a3a7ad", military: "#b9c39a",
  school: "#e8dcc0", university: "#e8dcc0", hospital: "#e6dfd2", industrial: "#cfc8bb", railway: "#c4bdb0",
  cemetery: "#8fc07a", pitch: "#5fb35a", playground: "#e7c48a", grass: "#7cc85a", recreation_ground: "#7cc85a",
  religious: "#e9dcc5", zoo: "#6cba52", theme_park: "#e8cf9a", attraction: "#e8cf9a", garden: "#7cc85a",
};
/** Land use that must never be filled with generated buildings. */
const NO_BUILD = new Set(["construction", "brownfield", "parking", "military", "school", "university", "hospital", "railway", "cemetery", "pitch", "playground", "grass", "recreation_ground", "religious", "zoo", "theme_park", "attraction", "garden", "park", "port", "harbour"]);

const inBounds = (p: P2, pad = 0) =>
  p[0] > CITY_BOUNDS.x0 - pad && p[0] < CITY_BOUNDS.x1 + pad && p[1] > CITY_BOUNDS.z0 - pad && p[1] < CITY_BOUNDS.z1 + pad;

/**
 * How much of the city stands at a point (0..1), so its edge thins out into
 * the open ring instead of ending in a straight cut: 1 deeper than ~400 m
 * inside the frame, falling to 0 at a wavy line near the frame.
 */
export const EDGE_FADE = 340;
export function edgeKeep(x: number, z: number) {
  const B = CITY_BOUNDS;
  const dIn = Math.min(x - B.x0, B.x1 - x, z - B.z0, B.z1 - z);
  const wave = 0.5 * Math.sin(x / 170) + 0.5 * Math.sin(z / 210 + 1.7) + 0.3 * Math.sin((x + z) / 97);
  const t = Math.min(1, Math.max(0, (dIn + wave * 110 - 30) / EDGE_FADE));
  return t * t * (3 - 2 * t);
}
/** Stable per-position random number in [0, 1) (does not disturb the build's RNG sequence). */
export function hash01(x: number, z: number) {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** Clips a polygon to the map frame (Sutherland–Hodgman). */
export function clipPolygon(p: P2[]): P2[] {
  const B = CITY_BOUNDS;
  const edges: [(q: P2) => boolean, (a: P2, b: P2) => P2][] = [
    [(q) => q[0] >= B.x0, (a, b) => [B.x0, a[1] + ((B.x0 - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(q) => q[0] <= B.x1, (a, b) => [B.x1, a[1] + ((B.x1 - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(q) => q[1] >= B.z0, (a, b) => [a[0] + ((B.z0 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), B.z0]],
    [(q) => q[1] <= B.z1, (a, b) => [a[0] + ((B.z1 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), B.z1]],
  ];
  let out = p;
  for (const [inside, cut] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cut(prev, cur));
    }
    if (!out.length) break;
  }
  return out;
}

/** Clips a polyline to the map frame; a line that leaves and re-enters becomes several pieces. */
export function clipPolyline(p: P2[]): P2[][] {
  const B = CITY_BOUNDS;
  const pieces: P2[][] = [];
  let cur: P2[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    // Liang–Barsky on segment i
    const a = p[i], b = p[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    let t0 = 0, t1 = 1;
    let ok = true;
    for (const [q, r] of [[-dx, a[0] - B.x0], [dx, B.x1 - a[0]], [-dz, a[1] - B.z0], [dz, B.z1 - a[1]]]) {
      if (q === 0) { if (r < 0) { ok = false; break; } continue; }
      const t = r / q;
      if (q < 0) { if (t > t1) { ok = false; break; } t0 = Math.max(t0, t); }
      else { if (t < t0) { ok = false; break; } t1 = Math.min(t1, t); }
    }
    if (!ok) { if (cur.length > 1) pieces.push(cur); cur = []; continue; }
    const s: P2 = [a[0] + dx * t0, a[1] + dz * t0], e: P2 = [a[0] + dx * t1, a[1] + dz * t1];
    if (!cur.length) cur.push(s);
    cur.push(e);
    if (t1 < 1) { if (cur.length > 1) pieces.push(cur); cur = []; }
  }
  if (cur.length > 1) pieces.push(cur);
  return pieces;
}

/** Is the segment a piece of the frame itself (left behind by clipping)? */
const onFrame = (a: P2, b: P2) => {
  const B = CITY_BOUNDS, e = 0.5;
  return (Math.abs(a[0] - B.x0) < e && Math.abs(b[0] - B.x0) < e) || (Math.abs(a[0] - B.x1) < e && Math.abs(b[0] - B.x1) < e) ||
    (Math.abs(a[1] - B.z0) < e && Math.abs(b[1] - B.z0) < e) || (Math.abs(a[1] - B.z1) < e && Math.abs(b[1] - B.z1) < e);
};

/** Shoelace area (sign depends on orientation). */
export const polygonArea = signedArea;

export function pointInPolygon(x: number, z: number, p: P2[]) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i];
    const [xj, zj] = p[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/* ------------------------------------------------------------ occupancy */
export const M = { ROAD: 1, BUILD: 2, WATER: 4, WALK: 8, ZONE: 16, JUNCTION: 32, NOBUILD: 64 } as const;

/** 1 m occupancy mask with bit flags, filled by scanline (fast even for the river). */
export class Mask {
  readonly cell = 1;
  readonly nx: number;
  readonly nz: number;
  readonly data: Uint8Array;
  constructor() {
    this.nx = Math.ceil(CITY_BOUNDS.x1 - CITY_BOUNDS.x0);
    this.nz = Math.ceil(CITY_BOUNDS.z1 - CITY_BOUNDS.z0);
    this.data = new Uint8Array(this.nx * this.nz);
  }
  get(x: number, z: number) {
    const i = Math.floor(x - CITY_BOUNDS.x0), j = Math.floor(z - CITY_BOUNDS.z0);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return M.ZONE;
    return this.data[j * this.nx + i];
  }
  set(x: number, z: number, f: number) {
    const i = Math.floor(x - CITY_BOUNDS.x0), j = Math.floor(z - CITY_BOUNDS.z0);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return;
    this.data[j * this.nx + i] |= f;
  }
  /** any of `flags` within radius r of (x, z)? */
  near(x: number, z: number, r: number, flags: number) {
    for (let dz = -r; dz <= r; dz += 1) for (let dx = -r; dx <= r; dx += 1) {
      if (dx * dx + dz * dz > r * r + 0.01) continue;
      if (this.get(x + dx, z + dz) & flags) return true;
    }
    return false;
  }
  fillPolygon(p: P2[], f: number) {
    let z0 = Infinity, z1 = -Infinity;
    for (const q of p) { z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
    z0 = Math.max(z0, CITY_BOUNDS.z0); z1 = Math.min(z1, CITY_BOUNDS.z1);
    for (let z = Math.floor(z0) + 0.5; z <= z1; z += 1) {
      const xs: number[] = [];
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [xi, zi] = p[i], [xj, zj] = p[j];
        if (zi > z !== zj > z) xs.push(xi + ((z - zi) * (xj - xi)) / (zj - zi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5) + 0.5; x <= xs[k + 1]; x += 1) this.set(x, z, f);
    }
  }
  fillSegment(a: P2, b: P2, halfWidth: number, f: number) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.01) return;
    const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
    const hw = halfWidth;
    // rectangle a→b with half width hw, plus round caps via the polygon fill
    this.fillPolygon([
      [a[0] - uz * hw - ux * hw * 0.5, a[1] + ux * hw - uz * hw * 0.5],
      [b[0] - uz * hw + ux * hw * 0.5, b[1] + ux * hw + uz * hw * 0.5],
      [b[0] + uz * hw + ux * hw * 0.5, b[1] - ux * hw + uz * hw * 0.5],
      [a[0] + uz * hw - ux * hw * 0.5, a[1] - ux * hw - uz * hw * 0.5],
    ], f);
  }
}

/* ---------------------------------------------------------------- flat */
interface Flat { pos: number[]; col: number[] }
const newFlat = (): Flat => ({ pos: [], col: [] });

function ribbon(out: Flat, pts: P2[], width: number, y: number, color: THREE.Color, joints = true) {
  const hw = width / 2;
  const push = (x: number, z: number) => { out.pos.push(x, y, z); out.col.push(color.r, color.g, color.b); };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const nx = (-dz / len) * hw, nz = (dx / len) * hw;
    // wound so the geometric normal is +y (tests assert every ground triangle faces up)
    push(a[0] + nx, a[1] + nz); push(b[0] + nx, b[1] + nz); push(b[0] - nx, b[1] - nz);
    push(a[0] + nx, a[1] + nz); push(b[0] - nx, b[1] - nz); push(a[0] - nx, a[1] - nz);
  }
  if (!joints) return;
  for (const c of pts) {
    const seg = 10;
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
      push(c[0], c[1]); push(c[0] + Math.cos(a1) * hw, c[1] + Math.sin(a1) * hw); push(c[0] + Math.cos(a0) * hw, c[1] + Math.sin(a0) * hw);
    }
  }
}

function flatGeometry(out: Flat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(out.col, 3));
  const n = new Float32Array(out.pos.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute("normal", new THREE.BufferAttribute(n, 3));
  g.computeBoundingSphere();
  return g;
}

/** Concatenates flat geometries into one. */
function mergeFlat(...gs: THREE.BufferGeometry[]) {
  const out = newFlat();
  for (const g of gs) {
    out.pos.push(...(g.getAttribute("position").array as Float32Array));
    out.col.push(...(g.getAttribute("color").array as Float32Array));
    g.dispose();
  }
  return flatGeometry(out);
}

function polygonsGeometry(polys: P2[][], y: number, color: THREE.Color | null, colors?: THREE.Color[]) {
  const out = newFlat();
  for (const [pi, raw] of polys.entries()) {
    const col = colors?.[pi] ?? color!;
    const p = prepPolygon(raw);
    if (!p) continue;
    const tris = THREE.ShapeUtils.triangulateShape(p.map((q) => new THREE.Vector2(q[0], q[1])), []);
    for (const t of tris) {
      const [a, b, c] = [p[t[0]], p[t[1]], p[t[2]]];
      // make each triangle face up (+y)
      const up = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0;
      for (const q of up ? [a, b, c] : [a, c, b]) { out.pos.push(q[0], y, q[1]); out.col.push(col.r, col.g, col.b); }
    }
  }
  return flatGeometry(out);
}

/* ------------------------------------------------------------- roads */
export type { Lane } from "./roads";
export { sampleLane } from "./roads";

/* ------------------------------------------------------------- output */
export type TreeKind = 0 | 1 | 2; // round canopy · tall (dầu/sao) · small ornamental
export interface Tree { x: number; z: number; s: number; k: TreeKind }

export interface CityBuild {
  buckets: Record<string, THREE.BufferGeometry>; // "wall:shop", "roof:tile", "details"
  ground: { roads: THREE.BufferGeometry; walks: THREE.BufferGeometry; markings: THREE.BufferGeometry; water: THREE.BufferGeometry; banks: THREE.BufferGeometry; green: THREE.BufferGeometry; decks: THREE.BufferGeometry };
  trees: Tree[];
  lanes: Lane[];
  junctions: { x: number; z: number; axis: number; offset: number }[];
  /** walkable polylines (sidewalks, pedestrian streets) */
  sidewalkPaths: P2[][];
  /** parks and plazas with free waypoints and clear links between them */
  openSpaces: { kind: "park" | "plaza"; pts: P2[]; links: number[][] }[];
  boatRoutes: { pts: P2[]; halfWidth: number; name?: string }[];
  /** closed, water-validated loops for boats */
  boatLoops: { pts: P2[]; halfWidth: number }[];
  shorePts: P2[];
  skyline: { cell: number; nx: number; nz: number; data: Float32Array };
  /** occupancy mask (only present when built on the main thread / in tests) */
  mask?: Mask;
  stats: { osmBuildings: number; genericBuildings: number; roads: number; trees: number; junctions: number };
}

export interface Exclusion { x: number; z: number; r: number; /** model height, for the skyline */ h?: number }

export function buildCity(data: CityData, exclusions: Exclusion[], zones: P2[][], quality: "low" | "medium" | "high"): CityBuild {
  const R = rng(1975);
  const detail = quality !== "low";
  const mask = new Mask();
  const B: Buckets = newBuckets();

  // Widths are estimates by class; a one-way way is usually one half of a dual
  // carriageway (e.g. Tôn Đức Thắng), so it gets a narrower estimate.
  // Everything is clipped to the map frame, so streets and the river end
  // exactly at its edge instead of trailing out into nothing.
  const roads = data.roads
    .flatMap((r): RoadData[] => (r.a ? [{ ...r, p: clipPolygon(r.p) }] : clipPolyline(r.p).map((p) => ({ ...r, p }))))
    .filter((r) => r.p.length > (r.a ? 2 : 1))
    .map((r) => (r.o && !r.a ? { ...r, w: Math.max(6, Math.round(r.w * 0.6)) } : r));
  const water = data.water.map((w) => ({ ...w, p: clipPolygon(w.p) })).filter((w) => w.p.length > 2);
  const junctions = findJunctions(roads);
  const roofTops: [number, number, number][] = [];
  // Parks and land use keep their real outlines (no straight cut at the frame);
  // areas whose centre lies outside the frame are left to the open ring.
  const centreIn = (q: P2[]) => inBounds(q.reduce((a, b) => [a[0] + b[0] / q.length, a[1] + b[1] / q.length], [0, 0]));
  const greens = data.green.filter((g) => g.p.length > 3 && centreIn(g.p));
  const lots = (data.landuse ?? []).filter((l) => l.p.length > 2 && centreIn(l.p));

  for (const w of water) mask.fillPolygon(w.p, M.WATER);
  // parks and non-residential land are never filled with generated buildings
  for (const g of greens) mask.fillPolygon(g.p, M.NOBUILD);
  for (const l of lots) if (NO_BUILD.has(l.k)) mask.fillPolygon(l.p, M.NOBUILD);
  for (const r of roads) {
    if (r.a) { mask.fillPolygon(r.p, M.WALK); continue; } // plaza
    for (let i = 0; i < r.p.length - 1; i++) {
      mask.fillSegment(r.p[i], r.p[i + 1], r.w / 2 + 3, M.WALK);
      if (r.k !== "pedestrian") mask.fillSegment(r.p[i], r.p[i + 1], r.w / 2, M.ROAD);
    }
  }
  const heights = deckHeights(roads, (x, z) => (mask.get(x, z) & M.WATER) !== 0);
  for (const j of junctions) for (let dz = -j.r; dz <= j.r; dz++) for (let dx = -j.r; dx <= j.r; dx++) if (dx * dx + dz * dz <= j.r * j.r) mask.set(j.x + dx, j.z + dz, M.JUNCTION);
  for (const zone of zones) mask.fillPolygon(zone, M.ZONE);
  for (const e of exclusions) if (e.h) roofTops.push([e.x, e.z, e.h]);
  for (const e of exclusions) for (let z = -e.r; z <= e.r; z++) for (let x = -e.r; x <= e.r; x++) if (x * x + z * z <= e.r * e.r) mask.set(e.x + x, e.z + z, M.ZONE);

  /* --- OSM buildings ------------------------------------------------- */
  let osmCount = 0;
  // Reserve every mapped footprint, even ones we don't draw, so nothing else is placed there.
  for (const b of data.buildings) if (b.p.length > 2) mask.fillPolygon(b.p, M.BUILD);
  for (const b of data.buildings) {
    if (!b.p.every((p) => inBounds(p))) continue;
    // the city thins out toward its edge (landmarks are far inside the fade band)
    if (hash01(b.p[0][0], b.p[0][1]) > edgeKeep(b.p[0][0], b.p[0][1])) continue;
    if (exclusions.some((e) => pointInPolygon(e.x, e.z, b.p))) continue; // replaced by a landmark model
    const p = prepPolygon(b.p);
    if (!p) continue;
    const area = Math.abs(signedArea(p));
    const c0 = p.reduce((acc, q) => [acc[0] + q[0] / p.length, acc[1] + q[1] / p.length], [0, 0]);
    const spec = classify(area, b.s ? b.h : 0, R, rectish(p), urbanity(c0[0], c0[1]));
    // Street front = the edge whose outside touches a road or sidewalk.
    let front: number | undefined;
    if (spec.kind === "shophouse") {
      let best = 0;
      p.forEach((q, i) => {
        const c = p[(i + 1) % p.length];
        const [nx, nz] = edgeNormal(p, i);
        const len = Math.hypot(c[0] - q[0], c[1] - q[1]);
        const mx = (q[0] + c[0]) / 2 + nx * 3, mz = (q[1] + c[1]) / 2 + nz * 3;
        const score = mask.get(mx, mz) & (M.ROAD | M.WALK) ? len : 0;
        if (score > best) { best = score; front = i; }
      });
    }
    const top = addBuilding(B, { poly: p, R, front, detail, ...spec });
    const ob = p.reduce((acc, q) => [acc[0] + q[0] / p.length, acc[1] + q[1] / p.length], [0, 0]);
    roofTops.push([ob[0], ob[1], top + 4]);
    mask.fillPolygon(p, M.BUILD);
    osmCount++;
  }

  // Evidence of an existing neighbourhood: mapped footprints per 100 m cell. New
  // districts with streets but no buildings yet (much of Thủ Thiêm) stay open.
  const DEV = 100;
  const devGrid = new Map<string, number>();
  for (const b of data.buildings) {
    const k = `${Math.floor(b.p[0][0] / DEV)},${Math.floor(b.p[0][1] / DEV)}`;
    devGrid.set(k, (devGrid.get(k) ?? 0) + 1);
  }
  const developed = (x: number, z: number) => {
    let n = 0;
    const ci = Math.floor(x / DEV), cj = Math.floor(z / DEV);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) n += devGrid.get(`${ci + di},${cj + dj}`) ?? 0;
    return n >= 4;
  };

  /* --- generalised shophouses lining streets without OSM footprints ----- */
  let genCount = 0;
  const density = quality === "low" ? 0.45 : quality === "medium" ? 0.8 : 1;
  const BLOCK = M.ROAD | M.WALK | M.BUILD | M.WATER | M.ZONE | M.JUNCTION | M.NOBUILD;
  const tryPlace = (sx: number, sz: number, ux: number, uz: number, w: number, d: number) => {
    // (sx,sz) = middle of the front edge; u along the street; n into the block
    if (!developed(sx, sz) || hash01(sx, sz) > edgeKeep(sx, sz)) return false;
    const nx = -uz, nz = ux;
    const corners: P2[] = [
      [sx - (ux * w) / 2, sz - (uz * w) / 2],
      [sx + (ux * w) / 2, sz + (uz * w) / 2],
      [sx + (ux * w) / 2 + nx * d, sz + (uz * w) / 2 + nz * d],
      [sx - (ux * w) / 2 + nx * d, sz - (uz * w) / 2 + nz * d],
    ];
    for (let t = 0.1; t <= 0.91; t += 0.2) for (let q = 0.05; q <= 1; q += 0.15) {
      const x = sx + ux * w * (t - 0.5) + nx * d * q, z = sz + uz * w * (t - 0.5) + nz * d * q;
      if (!inBounds([x, z]) || mask.get(x, z) & BLOCK) return false;
    }
    const p = prepPolygon(corners);
    if (!p) return false;
    // street-facing edge = the one whose midpoint is closest to the street point
    let front = 0, best = Infinity;
    p.forEach((a, i) => {
      const c = p[(i + 1) % p.length];
      const dd = Math.hypot((a[0] + c[0]) / 2 - sx, (a[1] + c[1]) / 2 - sz);
      if (dd < best) { best = dd; front = i; }
    });
    const floors = 2 + Math.floor(R() * R() * 5) + (R() < 0.5 ? 1 : 0);
    const top = addBuilding(B, { poly: p, kind: "shophouse", floors, wall: PALETTE.pastel[Math.floor(R() * PALETTE.pastel.length)], front, detail, R });
    roofTops.push([sx, sz, top + 3]);
    mask.fillPolygon(p, M.BUILD);
    genCount++;
    return true;
  };
  for (const r of roads) {
    if (!["residential", "tertiary", "secondary", "primary", "unclassified", "living_street"].includes(r.k)) continue;
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 8) continue;
      const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
      for (const side of [1, -1]) {
        let s = 3;
        while (s < len - 3) {
          const w = 4 + R() * 2.6;
          const setback = r.w / 2 + 3.6; // 3 m sidewalk + small forecourt
          const sx = a[0] + ux * (s + w / 2) - uz * setback * side;
          const sz = a[1] + uz * (s + w / 2) + ux * setback * side;
          // n = (-u.z, u.x) must point away from the street, into the block
          const placed = R() < density && tryPlace(sx, sz, side === 1 ? ux : -ux, side === 1 ? uz : -uz, w, 12 + R() * 7);
          s += placed ? w + 0.05 : 1.5;
        }
      }
    }
  }

  /* --- block interiors: rows of alley houses behind the street fronts ---- */
  // Unmapped ground deep inside a block (not park, school, site, water…) is
  // filled with rows of 2–5 storey houses aligned to the nearest street and
  // separated by hẻm (alleys); larger free lots in central areas get
  // apartment blocks. Every lot is tested against the mask before it is built.
  const segs: { ax: number; az: number; ux: number; uz: number; len: number }[] = [];
  const SEG_CELL = 60;
  const segGrid = new Map<string, number[]>();
  for (const r of roads) {
    if (r.a || r.k === "pedestrian") continue;
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 4) continue;
      const id = segs.push({ ax: a[0], az: a[1], ux: (b[0] - a[0]) / len, uz: (b[1] - a[1]) / len, len }) - 1;
      for (let s = 0; s <= len + SEG_CELL / 2; s += SEG_CELL / 2) {
        const t = Math.min(s, len);
        const k = `${Math.floor((a[0] + ((b[0] - a[0]) * t) / len) / SEG_CELL)},${Math.floor((a[1] + ((b[1] - a[1]) * t) / len) / SEG_CELL)}`;
        const l = segGrid.get(k) ?? [];
        if (l[l.length - 1] !== id) l.push(id);
        segGrid.set(k, l);
      }
    }
  }
  /** nearest street (distance and direction), searched within ~150 m */
  const nearestStreet = (x: number, z: number) => {
    let best = Infinity, ux = 1, uz = 0;
    const ci = Math.floor(x / SEG_CELL), cj = Math.floor(z / SEG_CELL);
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      for (const id of segGrid.get(`${ci + di},${cj + dj}`) ?? []) {
        const s = segs[id];
        const t = Math.max(0, Math.min(s.len, (x - s.ax) * s.ux + (z - s.az) * s.uz));
        const d = Math.hypot(s.ax + s.ux * t - x, s.az + s.uz * t - z);
        if (d < best) { best = d; ux = s.ux; uz = s.uz; }
      }
    }
    return { d: best, ux, uz };
  };
  const lotFree = (cx: number, cz: number, ux: number, uz: number, w: number, d: number) => {
    const nx = -uz, nz = ux;
    for (let a = -0.5; a <= 0.501; a += 0.125) for (let b = -0.5; b <= 0.501; b += 0.125) {
      const x = cx + ux * w * a + nx * d * b, z = cz + uz * w * a + nz * d * b;
      if (!inBounds([x, z]) || mask.get(x, z) & BLOCK) return false;
    }
    return true;
  };
  const rect = (cx: number, cz: number, ux: number, uz: number, w: number, d: number): P2[] => {
    const nx = -uz, nz = ux;
    return [
      [cx - (ux * w) / 2 - (nx * d) / 2, cz - (uz * w) / 2 - (nz * d) / 2],
      [cx + (ux * w) / 2 - (nx * d) / 2, cz + (uz * w) / 2 - (nz * d) / 2],
      [cx + (ux * w) / 2 + (nx * d) / 2, cz + (uz * w) / 2 + (nz * d) / 2],
      [cx - (ux * w) / 2 + (nx * d) / 2, cz - (uz * w) / 2 + (nz * d) / 2],
    ];
  };
  let infillCount = 0;
  const INFILL = quality === "low" ? 0.5 : quality === "medium" ? 0.85 : 1;
  const GRID = 9;
  for (let gz = CITY_BOUNDS.z0 + 20; gz < CITY_BOUNDS.z1 - 20; gz += GRID) {
    for (let gx = CITY_BOUNDS.x0 + 20; gx < CITY_BOUNDS.x1 - 20; gx += GRID) {
      if (mask.get(gx, gz) & BLOCK) continue;
      const st = nearestStreet(gx, gz);
      // only inside the street network, behind the street-front row
      if (st.d > 140 || st.d < 12) continue;
      if (R() > INFILL || !developed(gx, gz) || hash01(gx, gz) > edgeKeep(gx, gz) ** 1.5) continue;
      const urb = urbanity(gx, gz);
      const big = urb > 0.35 && R() < 0.12 && lotFree(gx, gz, st.ux, st.uz, 34, 28);
      const w = big ? 26 + R() * 8 : 4.5 + R() * 3, d = big ? 18 + R() * 8 : 10 + R() * 6;
      // clearance on every side keeps a walkable hẻm between rows
      if (!big && !lotFree(gx, gz, st.ux, st.uz, w + 3, d + 3)) continue;
      const p = prepPolygon(rect(gx, gz, st.ux, st.uz, w, d));
      if (!p) continue;
      let top: number;
      if (big) {
        top = addBuilding(B, { poly: p, kind: "apartment", floors: 5 + Math.floor(R() * (4 + urb * 8)), wall: PALETTE.apartment[Math.floor(R() * PALETTE.apartment.length)], detail, R });
      } else {
        // the face closest to the street is the house front
        let front = 0, best = Infinity;
        p.forEach((a, i) => {
          const c = p[(i + 1) % p.length];
          const dd = nearestStreet((a[0] + c[0]) / 2, (a[1] + c[1]) / 2).d;
          if (dd < best) { best = dd; front = i; }
        });
        const floors = 2 + Math.floor(R() * R() * 4) + (R() < 0.35 ? 1 : 0);
        top = addBuilding(B, { poly: p, kind: "shophouse", floors, wall: PALETTE.pastel[Math.floor(R() * PALETTE.pastel.length)], front, detail: false, R });
      }
      roofTops.push([gx, gz, top + 3]);
      mask.fillPolygon(p, M.BUILD);
      infillCount++;
    }
  }

  /* --- streets ---------------------------------------------------------- */
  // Flat layers are drawn as ordered decals (see CityGround), so overlapping
  // ribbons can never z-fight; elevated decks are real 3D geometry instead.
  const roadsOut = newFlat(), walks = newFlat(), marks = newFlat();
  const asphalt = new THREE.Color("#5c616a");
  const sidewalk = new THREE.Color("#e3dccd");
  const paving = new THREE.Color("#efe2c8");
  const white = new THREE.Color("#f4f4ee");
  const isElevated = (r: RoadData) => !!(r.b || (r.l ?? 0) >= 1);
  for (const r of roads) {
    if (r.a) {
      // plazas / squares: fill the outline instead of tracing it
      const p = prepPolygon(r.p);
      if (p) for (const [a, b, c] of triangulate(p)) {
        const up = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0;
        for (const q of up ? [a, b, c] : [a, c, b]) { walks.pos.push(q[0], 0.02, q[1]); walks.col.push(paving.r, paving.g, paving.b); }
      }
      continue;
    }
    if (isElevated(r)) continue;
    const ped = r.k === "pedestrian" || r.k === "footway";
    ribbon(walks, r.p, ped ? r.w : r.w + 6, 0.02, ped ? paving : sidewalk);
  }
  for (const r of roads) {
    if (r.a || isElevated(r) || r.k === "pedestrian") continue;
    ribbon(roadsOut, r.p, r.w, 0.02, asphalt);
  }
  // Basic lane marking only: a dashed centre line on wide two-way roads, kept clear of junctions.
  const nearJunction = (x: number, z: number) => (mask.get(x, z) & M.JUNCTION) !== 0;
  for (const r of roads) {
    if (r.a || r.o || isElevated(r) || r.w < 11 || r.k === "pedestrian") continue;
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 6) continue;
      const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
      for (let s = 2; s + 3 < len - 2; s += 9) {
        const x0 = a[0] + ux * s, z0 = a[1] + uz * s, x1 = a[0] + ux * (s + 3), z1 = a[1] + uz * (s + 3);
        if (nearJunction(x0, z0) || nearJunction(x1, z1)) continue;
        ribbon(marks, [[x0, z0], [x1, z1]], 0.3, 0.02, white, false);
      }
    }
  }

  /* --- bridges & flyovers: real decks with sides, rails and piers ------- */
  const decks = newBuf();
  const deckTop = new THREE.Color("#50555d");
  const deckSide = new THREE.Color("#c9c4ba");
  const railCol = new THREE.Color("#f1f1ec");
  for (const r of roads) {
    if (!isElevated(r) || r.a) continue;
    const ys = roadYs(r, heights);
    const hw = r.w / 2 + 0.6;
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.05) continue;
      const nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len;
      const ya = ys[i] + 0.15, yb = ys[i + 1] + 0.15;
      const L = (q: P2, y: number, s: number): [number, number, number] => [q[0] + nx * hw * s, y, q[1] + nz * hw * s];
      quad(decks, L(a, ya, 1), L(b, yb, 1), L(b, yb, -1), L(a, ya, -1), [0, 1, 0], deckTop);
      for (const s of [1, -1]) {
        // side skirt (1 m deep) and a low parapet
        quad(decks, L(a, ya, s), L(b, yb, s), L(b, yb - 1, s), L(a, ya - 1, s), [nx * s, 0, nz * s], deckSide);
        quad(decks, L(a, ya + 0.9, s), L(b, yb + 0.9, s), L(b, yb, s), L(a, ya, s), [nx * s, 0, nz * s], railCol);
        quad(decks, L(a, ya + 0.9, s), L(b, yb + 0.9, s), L(b, yb, s), L(a, ya, s), [-nx * s, 0, -nz * s], railCol);
      }
      // piers on land (keeps navigation channels clear)
      if (ya > 2.5 && i % 2 === 0 && !(mask.get(a[0], a[1]) & M.WATER)) {
        box(decks, [a[0], (ya - 1) / 2, a[1]], [1.6, Math.max(0.5, ya - 1), Math.max(2, r.w * 0.6)], -Math.atan2(b[1] - a[1], b[0] - a[0]), deckSide);
      }
    }
    // sidewalk ribbons at both ends where the deck meets the ground
  }

  /* --- water banks ------------------------------------------------------ */
  const banks = newFlat();
  const bankCol = new THREE.Color("#ddd3bd");
  for (const w of water) {
    // Only edges with both ends in view; out-of-view edges (incl. the clip
    // boundary) end a run instead of being bridged by one long segment.
    // long straight embankments are split into ≤ 60 m pieces
    const ring: P2[] = [];
    const closed = [...w.p, w.p[0]];
    for (let i = 0; i < closed.length; i++) {
      if (i > 0) {
        const a = closed[i - 1], b = closed[i];
        const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 60);
        for (let k = 1; k < n; k++) ring.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
      }
      ring.push(closed[i]);
    }
    let run: P2[] = [];
    for (let i = 0; i < ring.length; i++) {
      if (i > 0 && onFrame(ring[i - 1], ring[i])) {
        // the clipped edge along the frame is not a riverbank
        if (run.length > 1) ribbon(banks, run, 2.6, 0.02, bankCol);
        run = [ring[i]];
      } else if (inBounds(ring[i], 150)) run.push(ring[i]);
      else {
        if (run.length > 1) ribbon(banks, run, 2.6, 0.02, bankCol);
        run = [];
      }
    }
    if (run.length > 1) ribbon(banks, run, 2.6, 0.02, bankCol);
  }

  /* --- trees ------------------------------------------------------------ */
  const trees: Tree[] = [];
  const NO_TRUNK = M.ROAD | M.BUILD | M.WATER | M.ZONE | M.JUNCTION;
  const okTree = (x: number, z: number, crown: number) =>
    inBounds([x, z]) && !mask.near(x, z, 1, NO_TRUNK) && !mask.near(x, z, crown, M.BUILD);
  const step = quality === "low" ? 24 : quality === "medium" ? 15 : 12;
  for (const r of roads) {
    if (r.k === "pedestrian" || r.w < 6) continue;
    const streetProb = r.k === "residential" ? 0.45 : 0.85;
    if (R() > streetProb) continue; // not every street is tree-lined
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ux = (b[0] - a[0]) / (len || 1), uz = (b[1] - a[1]) / (len || 1);
      for (const side of [1, -1]) {
        for (let s = step * 0.6 + R() * 3; s < len - 4; s += step + (R() - 0.5) * 4) {
          if (R() < 0.15) continue; // natural gaps
          const off = (r.w / 2 + 1.5) * side; // middle of the 3 m sidewalk
          const x = a[0] + ux * s - uz * off, z = a[1] + uz * s + ux * off;
          const k: TreeKind = r.w >= 14 && R() < 0.45 ? 1 : R() < 0.2 ? 2 : 0;
          const sc = 0.75 + R() * 0.35;
          if (okTree(x, z, k === 1 ? 1.6 : 2.2 * sc)) trees.push({ x, z, s: sc, k });
        }
      }
    }
  }
  // parks: jittered grid inside each green polygon, away from paths and buildings
  const pStep = quality === "low" ? 16 : quality === "medium" ? 10 : 8;
  for (const g of greens) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const q of g.p) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minZ = Math.min(minZ, q[1]); maxZ = Math.max(maxZ, q[1]); }
    for (let x = minX + pStep / 2; x < maxX; x += pStep) for (let z = minZ + pStep / 2; z < maxZ; z += pStep) {
      if (R() < 0.3) continue; // clearings
      const tx = x + (R() - 0.5) * pStep * 0.8, tz = z + (R() - 0.5) * pStep * 0.8;
      if (!pointInPolygon(tx, tz, g.p) || !okTree(tx, tz, 2) || mask.near(tx, tz, 2, M.WALK)) continue;
      trees.push({ x: tx, z: tz, s: 0.85 + R() * 0.5, k: R() < 0.25 ? 1 : R() < 0.2 ? 2 : 0 });
    }
  }


  /* --- data for the living-city simulations ----------------------------- */
  // Sidewalk walking paths: offset polylines checked cell by cell; broken where
  // a building, the river or a junction interrupts them.
  const sidewalkPaths: P2[][] = [];
  const PED_BLOCK = M.BUILD | M.WATER | M.ROAD | M.ZONE;
  for (const r of roads) {
    if (r.a || isElevated(r) || r.k === "pedestrian" || r.w < 6) continue;
    for (const side of [1, -1]) {
      let run: P2[] = [];
      const flush = () => {
        if (run.length > 1 && Math.hypot(run[run.length - 1][0] - run[0][0], run[run.length - 1][1] - run[0][1]) > 25) sidewalkPaths.push(run);
        run = [];
      };
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 0.5) continue;
        const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
        const off = (r.w / 2 + 1.5) * side;
        for (let s = 0; s <= len; s += 3) {
          const x = a[0] + ux * s - uz * off, z = a[1] + uz * s + ux * off;
          const ok = inBounds([x, z]) && !(mask.get(x, z) & (PED_BLOCK | M.JUNCTION));
          if (ok) run.push([x, z]);
          else flush();
        }
      }
      flush();
    }
  }
  // Pedestrian streets (paths, not plazas): walkable, split where they cross a carriageway.
  for (const r of roads) {
    if (r.k !== "pedestrian" || r.a || r.p.length < 2) continue;
    let run: P2[] = [];
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 0; s <= len; s += 2) {
        const x = a[0] + ((b[0] - a[0]) * s) / (len || 1), z = a[1] + ((b[1] - a[1]) * s) / (len || 1);
        if (inBounds([x, z]) && !(mask.get(x, z) & (M.ROAD | M.BUILD | M.WATER))) run.push([x, z]);
        else { if (run.length > 8) sidewalkPaths.push(run); run = []; }
      }
    }
    if (run.length > 8) sidewalkPaths.push(run);
  }

  // Open spaces: parks and plazas with free waypoints to stroll between.
  const openSpaces: { kind: "park" | "plaza"; pts: P2[]; links: number[][] }[] = [];
  const clearLine = (a: P2, b: P2) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s <= len; s += 1.2) {
      const x = a[0] + ((b[0] - a[0]) * s) / (len || 1), z = a[1] + ((b[1] - a[1]) * s) / (len || 1);
      if (mask.get(x, z) & PED_BLOCK) return false;
    }
    return true;
  };
  const sampleArea = (poly: P2[], kind: "park" | "plaza", n: number) => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const q of poly) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minZ = Math.min(minZ, q[1]); maxZ = Math.max(maxZ, q[1]); }
    const pts: P2[] = [];
    for (let tries = 0; tries < n * 12 && pts.length < n; tries++) {
      const x = minX + R() * (maxX - minX), z = minZ + R() * (maxZ - minZ);
      if (!inBounds([x, z]) || !pointInPolygon(x, z, poly) || mask.near(x, z, 1.5, PED_BLOCK)) continue;
      if (trees.some((t) => Math.abs(t.x - x) < 2.5 && Math.abs(t.z - z) < 2.5)) continue;
      pts.push([x, z]);
    }
    // walkable links between nearby waypoints (straight lines that stay clear)
    const links = pts.map((a, i) => pts.map((b, j) => j).filter((j) => j !== i && Math.hypot(pts[j][0] - a[0], pts[j][1] - a[1]) < 45 && clearLine(a, pts[j])));
    const keep = pts.map((_, i) => links[i].length > 0);
    const remap = new Map<number, number>();
    const fp: P2[] = [];
    pts.forEach((p, i) => { if (keep[i]) { remap.set(i, fp.length); fp.push(p); } });
    const fl = links.filter((_, i) => keep[i]).map((l) => l.map((j) => remap.get(j)!).filter((j) => j !== undefined));
    if (fp.length >= 3) openSpaces.push({ kind, pts: fp, links: fl });
  };
  for (const g of greens) {
    const area = Math.abs(signedArea(g.p));
    if (area > 600) sampleArea(g.p, "park", Math.min(40, Math.round(area / 400)));
  }
  for (const r of roads) if (r.a) {
    const area = Math.abs(signedArea(r.p));
    if (area > 300) sampleArea(r.p, "plaza", Math.min(30, Math.round(area / 250)));
  }

  // Shore spots (for water birds): open-space points close to the water.
  const shorePts: P2[] = [];
  for (const sp of openSpaces) for (const q of sp.pts) if (mask.near(q[0], q[1], 14, M.WATER)) shorePts.push(q);
  for (const path of sidewalkPaths) for (let i = 0; i < path.length; i += 8) if (mask.near(path[i][0], path[i][1], 8, M.WATER)) shorePts.push(path[i]);

  // Boat routes from waterway centrelines, kept inside the water with clearance.
  const boatRoutes: { pts: P2[]; halfWidth: number; name?: string }[] = [];
  const waterAt = (x: number, z: number) => (mask.get(x, z) & M.WATER) !== 0;
  for (const wl of data.waterways ?? []) {
    const pts = wl.p.filter((p) => inBounds(p, -20) && waterAt(p[0], p[1]));
    if (pts.length < 3) continue;
    // channel half-width: shortest distance to land across the centreline
    let half = Infinity;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i + 1];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
      for (const s of [1, -1]) {
        let d = 0;
        while (d < 200 && waterAt(pts[i][0] + nx * d * s, pts[i][1] + nz * d * s)) d += 2;
        half = Math.min(half, d);
      }
    }
    if (half > 8) boatRoutes.push({ pts, halfWidth: half, name: wl.n });
  }
  const boatLoops = buildBoatLoops(boatRoutes, waterAt);

  // Coarse skyline (max roof height per 50 m cell) so birds fly above rooftops.
  const SKY = 50;
  const skyNx = Math.ceil((CITY_BOUNDS.x1 - CITY_BOUNDS.x0) / SKY), skyNz = Math.ceil((CITY_BOUNDS.z1 - CITY_BOUNDS.z0) / SKY);
  const skyline = new Float32Array(skyNx * skyNz);
  for (const [x, z, h] of roofTops) {
    const i = Math.floor((x - CITY_BOUNDS.x0) / SKY), j = Math.floor((z - CITY_BOUNDS.z0) / SKY);
    if (i >= 0 && j >= 0 && i < skyNx && j < skyNz) skyline[j * skyNx + i] = Math.max(skyline[j * skyNx + i], h);
  }

  const colouredLots = lots.filter((l) => LANDUSE_COLOR[l.k]);
  const buckets: Record<string, THREE.BufferGeometry> = {};
  for (const [k, b] of Object.entries(B.walls)) if (b.pos.length) buckets[`wall:${k}`] = toGeometry(b);
  for (const [k, b] of Object.entries(B.roofs)) if (b.pos.length) buckets[`roof:${k}`] = toGeometry(b);
  if (B.details.pos.length) buckets.details = toGeometry(B.details);

  return {
    buckets,
    ground: {
      roads: flatGeometry(roadsOut),
      walks: flatGeometry(walks),
      markings: flatGeometry(marks),
      water: polygonsGeometry(water.map((w) => w.p), 0.02, new THREE.Color("#2f9fd6")),
      banks: flatGeometry(banks),
      green: mergeFlat(
        // land use first, so parks drawn after it win where they overlap
        polygonsGeometry(colouredLots.map((l) => l.p), 0.02, null, colouredLots.map((l) => new THREE.Color(LANDUSE_COLOR[l.k]))),
        polygonsGeometry(greens.map((g) => g.p), 0.02, new THREE.Color("#6cc24a")),
      ),
      decks: toGeometry(decks),
    },
    trees,
    lanes: buildLanes(roads, heights, junctions, (q) => inBounds(q, -30)),
    junctions: junctions.map((j) => ({ x: j.x, z: j.z, axis: j.axis, offset: j.offset })),
    sidewalkPaths,
    openSpaces,
    boatRoutes,
    boatLoops,
    shorePts,
    skyline: { cell: SKY, nx: skyNx, nz: skyNz, data: skyline },
    mask,
    stats: { osmBuildings: osmCount, genericBuildings: genCount + infillCount, roads: roads.length, trees: trees.length, junctions: junctions.length },
  };
}
