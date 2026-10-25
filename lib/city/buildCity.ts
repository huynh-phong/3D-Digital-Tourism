import * as THREE from "three";
import { rng } from "@/lib/geo";
import type { CityData, P2 } from "./types";

/**
 * Turns OpenStreetMap data into a handful of merged geometries.
 * Everything is in metres (+x east, +z south) with the palace at the origin.
 */

export const CITY_BOUNDS = { x0: -860, x1: 1860, z0: -1040, z1: 1260 };

// ----------------------------------------------------------------- helpers
const inBounds = (p: P2, pad = 0) =>
  p[0] > CITY_BOUNDS.x0 - pad && p[0] < CITY_BOUNDS.x1 + pad && p[1] > CITY_BOUNDS.z0 - pad && p[1] < CITY_BOUNDS.z1 + pad;

export function polygonArea(p: P2[]) {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return a / 2;
}

export function pointInPolygon(x: number, z: number, p: P2[]) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i];
    const [xj, zj] = p[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function centroid(p: P2[]): P2 {
  let x = 0, z = 0;
  for (const q of p) { x += q[0]; z += q[1]; }
  return [x / p.length, z / p.length];
}

/** Coarse occupancy grid used to keep generated scenery off roads and buildings. */
class Grid {
  readonly cell = 4;
  private nx: number;
  private nz: number;
  private data: Uint8Array;
  constructor() {
    this.nx = Math.ceil((CITY_BOUNDS.x1 - CITY_BOUNDS.x0) / this.cell);
    this.nz = Math.ceil((CITY_BOUNDS.z1 - CITY_BOUNDS.z0) / this.cell);
    this.data = new Uint8Array(this.nx * this.nz);
  }
  private idx(x: number, z: number) {
    const i = Math.floor((x - CITY_BOUNDS.x0) / this.cell);
    const j = Math.floor((z - CITY_BOUNDS.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return -1;
    return j * this.nx + i;
  }
  get(x: number, z: number) {
    const k = this.idx(x, z);
    return k < 0 ? 1 : this.data[k];
  }
  mark(x: number, z: number, v = 1) {
    const k = this.idx(x, z);
    if (k >= 0) this.data[k] = Math.max(this.data[k], v);
  }
  fillPolygon(p: P2[], v = 1) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const q of p) {
      minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]);
      minZ = Math.min(minZ, q[1]); maxZ = Math.max(maxZ, q[1]);
    }
    for (let x = minX; x <= maxX; x += this.cell) for (let z = minZ; z <= maxZ; z += this.cell) {
      if (pointInPolygon(x + this.cell / 2, z + this.cell / 2, p)) this.mark(x + this.cell / 2, z + this.cell / 2, v);
    }
  }
  fillSegment(a: P2, b: P2, halfWidth: number, v = 1) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(len / (this.cell / 2)));
    const nx = -(b[1] - a[1]) / (len || 1), nz = (b[0] - a[0]) / (len || 1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      for (let o = -halfWidth; o <= halfWidth; o += this.cell / 2) this.mark(x + nx * o, z + nz * o, v);
    }
  }
}

// ------------------------------------------------------------ buildings
export const FACADE_COLORS = ["#efe6d2", "#f3dfb0", "#e9c9a6", "#d9e6dd", "#cfe0ea", "#f0d3c4", "#e8e3da", "#f5ecc8", "#d8d2c4", "#f2c9a0"].map(
  (c) => new THREE.Color(c),
);
const ROOF = new THREE.Color("#b9b1a4");
const ROOF_TILE = new THREE.Color("#b5654a");

interface BuildOut {
  pos: number[];
  nor: number[];
  uv: number[];
  col: number[];
}

/** Extrude one footprint into walls + flat roof, appended to `out`. */
function extrude(out: BuildOut, poly: P2[], h: number, color: THREE.Color, roof: THREE.Color, base = 0) {
  let p = poly;
  if (polygonArea(p) < 0) p = [...p].reverse(); // make CCW in x/z (screen) sense
  const n = p.length;
  // Walls
  let u = 0;
  const dark = color.clone().multiplyScalar(0.72); // cheap ambient occlusion at the base
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const nx = dz / len, nz = -dx / len;
    const u0 = u / 3.6, u1 = (u + len) / 3.6, v0 = 0, v1 = h / 3.4;
    u += len;
    const quad = [
      [a[0], base, a[1], u0, v0, dark],
      [b[0], base, b[1], u1, v0, dark],
      [b[0], base + h, b[1], u1, v1, color],
      [a[0], base, a[1], u0, v0, dark],
      [b[0], base + h, b[1], u1, v1, color],
      [a[0], base + h, a[1], u0, v1, color],
    ] as const;
    for (const [x, y, z, uu, vv, c] of quad) {
      out.pos.push(x, y, z);
      out.nor.push(nx, 0, nz);
      out.uv.push(uu, vv);
      out.col.push(c.r, c.g, c.b);
    }
  }
  // Roof
  const contour = p.map((q) => new THREE.Vector2(q[0], q[1]));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  for (const t of tris) {
    for (const k of [t[0], t[2], t[1]]) {
      out.pos.push(p[k][0], base + h, p[k][1]);
      out.nor.push(0, 1, 0);
      out.uv.push(0.02, 0.02); // plain corner of the facade texture
      out.col.push(roof.r, roof.g, roof.b);
    }
  }
}

function toGeometry(out: BuildOut) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(out.nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(out.uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(out.col, 3));
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------- ribbons
function ribbon(out: { pos: number[]; col: number[] }, pts: P2[], width: number, y: number, color: THREE.Color) {
  const hw = width / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const nx = (-dz / len) * hw, nz = (dx / len) * hw;
    const v = [
      [a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz],
      [a[0] + nx, a[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz],
    ];
    for (const [x, z] of v) {
      out.pos.push(x, y, z);
      out.col.push(color.r, color.g, color.b);
    }
  }
  // Round joints so corners don't show gaps.
  for (const c of pts) {
    const seg = 8;
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
      out.pos.push(c[0], y, c[1], c[0] + Math.cos(a1) * hw, y, c[1] + Math.sin(a1) * hw, c[0] + Math.cos(a0) * hw, y, c[1] + Math.sin(a0) * hw);
      for (let k = 0; k < 3; k++) out.col.push(color.r, color.g, color.b);
    }
  }
}

function flatGeometry(out: { pos: number[]; col: number[] }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(out.col, 3));
  const n = new Float32Array(out.pos.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute("normal", new THREE.BufferAttribute(n, 3));
  g.computeBoundingSphere();
  return g;
}

function polygonsGeometry(polys: P2[][], y: number, color: THREE.Color) {
  const out = { pos: [] as number[], col: [] as number[] };
  for (const raw of polys) {
    let p = raw;
    if (p.length > 2 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p = p.slice(0, -1);
    if (p.length < 3) continue;
    if (polygonArea(p) < 0) p = [...p].reverse();
    const tris = THREE.ShapeUtils.triangulateShape(p.map((q) => new THREE.Vector2(q[0], q[1])), []);
    for (const t of tris) for (const k of [t[0], t[2], t[1]]) {
      out.pos.push(p[k][0], y, p[k][1]);
      out.col.push(color.r, color.g, color.b);
    }
  }
  return flatGeometry(out);
}

// ----------------------------------------------------------------- traffic
export interface Lane {
  endKey: string;
  pts: P2[];
  cum: number[]; // cumulative length
  length: number;
  next: number[]; // lane indices continuing from the end
  speed: number; // m/s
  width: number;
}

const DRIVABLE = new Set(["trunk", "primary", "secondary", "tertiary", "trunk_link", "primary_link", "secondary_link", "tertiary_link", "unclassified"]);

function offsetPolyline(pts: P2[], off: number): P2[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    // Right-hand traffic: offset to the right of travel direction.
    return [p[0] - (dz / len) * off, p[1] + (dx / len) * off];
  });
}

function buildLanes(roads: CityData["roads"]): Lane[] {
  const lanes: Lane[] = [];
  const key = (p: P2) => `${Math.round(p[0])},${Math.round(p[1])}`;
  const starts = new Map<string, number[]>();
  for (const r of roads) {
    if (!DRIVABLE.has(r.k) || r.p.length < 2) continue;
    const speed = r.k.startsWith("trunk") || r.k.startsWith("primary") ? 9 : r.k.startsWith("secondary") ? 8 : 6.5;
    for (const dir of [1, -1]) {
      const center = dir === 1 ? r.p : [...r.p].reverse();
      const pts = offsetPolyline(center, Math.max(1.6, r.w / 4));
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      if (cum[cum.length - 1] < 8) continue;
      const idx = lanes.length;
      lanes.push({ endKey: key(center[center.length - 1]), pts, cum, length: cum[cum.length - 1], next: [], speed, width: r.w });
      const k = key(center[0]);
      if (!starts.has(k)) starts.set(k, []);
      starts.get(k)!.push(idx);
      (lanes[idx] as Lane & { _end: string; _start: string })._end = key(center[center.length - 1]);
      (lanes[idx] as Lane & { _end: string; _start: string })._start = k;
    }
  }
  for (let i = 0; i < lanes.length; i++) {
    const l = lanes[i] as Lane & { _end: string; _start: string };
    const cands = (starts.get(l._end) ?? []).filter((j) => (lanes[j] as typeof l)._end !== l._start);
    l.next = cands.length ? cands : (starts.get(l._end) ?? []);
  }
  return lanes;
}

// -------------------------------------------------------------------- main
export interface CityBuild {
  buildings: THREE.BufferGeometry;
  generic: THREE.BufferGeometry;
  roads: THREE.BufferGeometry;
  markings: THREE.BufferGeometry;
  water: THREE.BufferGeometry;
  green: THREE.BufferGeometry;
  trees: { x: number; z: number; s: number }[];
  lanes: Lane[];
  walkways: { pts: P2[]; cum: number[]; length: number }[];
  stats: { osmBuildings: number; genericBuildings: number; roads: number };
}

/** Footprints we replace with hand-made landmark models (by contained point). */
export interface Exclusion {
  x: number;
  z: number;
  r: number;
}

export function buildCity(
  data: CityData,
  exclusions: Exclusion[],
  zones: P2[][],
  quality: "low" | "medium" | "high",
): CityBuild {
  const R = rng(1975);
  const grid = new Grid();

  const roads = data.roads.filter((r) => r.p.some((p) => inBounds(p, 50)));
  const water = data.water.filter((w) => w.p.some((p) => inBounds(p, 200)));

  // Occupancy: water, roads (+ sidewalks), exclusions.
  for (const w of water) grid.fillPolygon(w.p, 3);
  for (const r of roads) for (let i = 0; i < r.p.length - 1; i++) grid.fillSegment(r.p[i], r.p[i + 1], r.w / 2 + 2.5, 2);
  for (const zone of zones) grid.fillPolygon(zone, 4);
  for (const e of exclusions) for (let x = -e.r; x <= e.r; x += 4) for (let z = -e.r; z <= e.r; z += 4) if (x * x + z * z <= e.r * e.r) grid.mark(e.x + x, e.z + z, 4);

  // OSM buildings.
  const bOut: BuildOut = { pos: [], nor: [], uv: [], col: [] };
  let osmCount = 0;
  for (const b of data.buildings) {
    if (!b.p.every((p) => inBounds(p))) continue;
    const c = centroid(b.p);
    if (exclusions.some((e) => Math.hypot(c[0] - e.x, c[1] - e.z) < e.r && pointInPolygon(e.x, e.z, b.p))) continue;
    const area = Math.abs(polygonArea(b.p));
    if (area < 6) continue;
    let h = b.h;
    if (!h) {
      const r = R();
      h = area < 150 ? 7 + r * 12 : area < 900 ? 10 + r * 22 : 14 + r * 40;
    }
    const color = FACADE_COLORS[Math.floor(R() * FACADE_COLORS.length)];
    extrude(bOut, b.p, h, color, area < 160 && R() < 0.4 ? ROOF_TILE : ROOF);
    grid.fillPolygon(b.p, 5);
    osmCount++;
  }

  // Generalised shophouses (nhà ống) lining streets where OSM has no footprint.
  const gOut: BuildOut = { pos: [], nor: [], uv: [], col: [] };
  let genCount = 0;
  const density = quality === "low" ? 0.45 : quality === "medium" ? 0.75 : 1;
  const tryPlace = (cx: number, cz: number, ux: number, uz: number, w: number, d: number) => {
    // u = direction along street, n = into the block
    const nx = -uz, nz = ux;
    const corners: P2[] = [
      [cx - ux * w / 2, cz - uz * w / 2],
      [cx + ux * w / 2, cz + uz * w / 2],
      [cx + ux * w / 2 + nx * d, cz + uz * w / 2 + nz * d],
      [cx - ux * w / 2 + nx * d, cz - uz * w / 2 + nz * d],
    ];
    const samples: P2[] = [...corners, [cx + nx * d / 2, cz + nz * d / 2], [cx + nx * d * 0.2, cz + nz * d * 0.2], [cx + nx * d * 0.8, cz + nz * d * 0.8]];
    if (samples.some((s) => !inBounds(s) || grid.get(s[0], s[1]) > 0)) return false;
    const levels = 2 + Math.floor(R() * R() * 6);
    const color = FACADE_COLORS[Math.floor(R() * FACADE_COLORS.length)];
    extrude(gOut, corners, levels * 3.4 + 0.6, color, R() < 0.35 ? ROOF_TILE : ROOF);
    grid.fillPolygon(corners, 6);
    genCount++;
    return true;
  };
  for (const r of roads) {
    if (!["residential", "tertiary", "secondary", "primary", "unclassified", "living_street"].includes(r.k)) continue;
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 6) continue;
      const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
      for (const side of [1, -1]) {
        let s = 4;
        while (s < len - 4) {
          const w = 4 + R() * 2.5;
          if (R() < density) {
            const off = (r.w / 2 + 3.2) * side;
            const cx = a[0] + ux * s - uz * off, cz = a[1] + uz * s + ux * off;
            // For side = -1 the block lies to the other side: flip the along-axis.
            const placed = side === 1
              ? tryPlace(cx, cz, ux, uz, w, 12 + R() * 8)
              : tryPlace(cx, cz, -ux, -uz, w, 12 + R() * 8);
            if (!placed) s += 1;
          }
          s += w + 0.15;
        }
      }
    }
  }

  // Roads & markings.
  const roadOut = { pos: [] as number[], col: [] as number[] };
  const markOut = { pos: [] as number[], col: [] as number[] };
  const asphalt = new THREE.Color("#5d6166");
  const asphaltMinor = new THREE.Color("#6e7176");
  const plaza = new THREE.Color("#cfc6b6");
  const sidewalk = new THREE.Color("#b9b3a8");
  const white = new THREE.Color("#eeeeea");
  const byWidth = [...roads].sort((a, b) => a.w - b.w);
  for (const r of byWidth) ribbon(roadOut, r.p, r.w + 4, 0.06, sidewalk);
  for (const r of byWidth) {
    const ped = r.k === "pedestrian" || r.k === "living_street";
    ribbon(roadOut, r.p, r.w, 0.1, ped ? plaza : r.w >= 11 ? asphalt : asphaltMinor);
  }
  for (const r of roads) {
    if (r.w < 11 || r.k === "pedestrian") continue;
    // dashed centre line
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 2; s + 3 < len; s += 9) {
        const t0 = s / len, t1 = (s + 3) / len;
        ribbon(markOut, [[a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1]], 0.35, 0.14, white);
      }
    }
  }

  // Trees: along streets and inside parks.
  const trees: CityBuild["trees"] = [];
  const treeStep = quality === "low" ? 26 : quality === "medium" ? 16 : 11;
  for (const r of roads) {
    if (r.k === "residential" && R() < 0.5) continue;
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ux = (b[0] - a[0]) / (len || 1), uz = (b[1] - a[1]) / (len || 1);
      for (let s = treeStep / 2; s < len; s += treeStep) for (const side of [1, -1]) {
        const off = (r.w / 2 + 1.4) * side;
        const x = a[0] + ux * s - uz * off, z = a[1] + uz * s + ux * off;
        const g = grid.get(x, z);
        if (!inBounds([x, z]) || g >= 3) continue;
        trees.push({ x, z, s: 0.8 + R() * 0.6 });
      }
    }
  }
  const greens = data.green.filter((g) => g.p.length > 3 && g.p.some((p) => inBounds(p)));
  for (const g of greens) {
    const area = Math.abs(polygonArea(g.p));
    const n = Math.min(400, Math.floor(area / (quality === "low" ? 900 : quality === "medium" ? 420 : 250)));
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const q of g.p) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minZ = Math.min(minZ, q[1]); maxZ = Math.max(maxZ, q[1]); }
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 6) {
      tries++;
      const x = minX + R() * (maxX - minX), z = minZ + R() * (maxZ - minZ);
      if (!pointInPolygon(x, z, g.p) || grid.get(x, z) >= 2) continue;
      trees.push({ x, z, s: 0.9 + R() * 0.8 });
      placed++;
    }
  }

  // Walkways for pedestrians (pedestrian streets).
  const walkways = roads
    .filter((r) => r.k === "pedestrian" && r.p.length > 1)
    .map((r) => {
      const cum = [0];
      for (let i = 1; i < r.p.length; i++) cum.push(cum[i - 1] + Math.hypot(r.p[i][0] - r.p[i - 1][0], r.p[i][1] - r.p[i - 1][1]));
      return { pts: r.p, cum, length: cum[cum.length - 1] };
    })
    .filter((w) => w.length > 20);

  return {
    buildings: toGeometry(bOut),
    generic: toGeometry(gOut),
    roads: flatGeometry(roadOut),
    markings: flatGeometry(markOut),
    water: polygonsGeometry(water.map((w) => w.p), 0.04, new THREE.Color("#5f9fc4")),
    green: polygonsGeometry(greens.map((g) => g.p), 0.03, new THREE.Color("#8fbf78")),
    trees,
    lanes: buildLanes(roads),
    walkways,
    stats: { osmBuildings: osmCount, genericBuildings: genCount, roads: roads.length },
  };
}

/** Sample position + heading on a polyline at distance s. */
export function sampleLane(l: { pts: P2[]; cum: number[] }, s: number, out: { x: number; z: number; dx: number; dz: number }) {
  const cum = l.cum;
  let i = 1;
  // Lanes are short; linear search is fine.
  while (i < cum.length - 1 && cum[i] < s) i++;
  const a = l.pts[i - 1], b = l.pts[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const t = Math.min(1, Math.max(0, (s - cum[i - 1]) / seg));
  out.x = a[0] + (b[0] - a[0]) * t;
  out.z = a[1] + (b[1] - a[1]) * t;
  out.dx = (b[0] - a[0]) / seg;
  out.dz = (b[1] - a[1]) / seg;
  return out;
}
