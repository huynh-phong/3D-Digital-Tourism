import * as THREE from "three";
import { box, cylinder, edgeNormal, newBuf, obb, offsetPolygon, quad, signedArea, tri, triangulate, type MeshBuf } from "./geom";
import type { P2 } from "./types";

/**
 * Reusable architectural "kits". A building = footprint + kit; the kit decides
 * the facade texture (by mesh bucket), storey height, roof form and details.
 */

export type FacadeStyle = "shop" | "shopfront" | "apartment" | "office" | "glass" | "colonial";
export type RoofStyle = "tile" | "metal" | "flat";
export const FACADE_STYLES: FacadeStyle[] = ["shop", "shopfront", "apartment", "office", "glass", "colonial"];
export const ROOF_STYLES: RoofStyle[] = ["tile", "metal", "flat"];

/** Bay width × storey height of one facade texture tile (metres). */
export const TILE: Record<FacadeStyle, { w: number; h: number }> = {
  shop: { w: 4.2, h: 3.4 },
  shopfront: { w: 4.2, h: 3.8 },
  apartment: { w: 3.4, h: 3.1 },
  office: { w: 4.0, h: 3.7 },
  glass: { w: 1.6, h: 3.8 },
  colonial: { w: 4.2, h: 4.4 },
};

const C = (h: string) => new THREE.Color(h);
/**
 * "Miniature city" palette, softened toward the reference look: cream, sand,
 * sage and pale teal walls, terracotta tile roofs, muted metal roofs, glass in
 * grey-teal. Saturated colours are kept for small accents (awnings, signs).
 */
export const PALETTE = {
  pastel: [
    "#f7ecd4", "#f4dcae", "#d4e7bd", "#c3e3d6", "#b9e0e2", "#c8dbef", "#f6bea4", "#f0a98f",
    "#f8e49e", "#efe7d8", "#ddeec8", "#fae1c2", "#f8cfcf", "#fff3da", "#e6d6f0", "#cfe9f0",
  ].map(C),
  apartment: ["#f7f0e0", "#f2dfbb", "#d4e6d6", "#c8e0de", "#efd5bc", "#f6ecd8", "#d6e2c2", "#e4ebe6", "#f6e3c9"].map(C),
  office: ["#f1ece0", "#dde6e4", "#f2e7d0", "#d6e3d8", "#e9e4f0"].map(C),
  glass: ["#9cc6d4", "#8dbad0", "#a8d0da", "#86b6c8", "#9cc8c2", "#b1cfe0"].map(C),
  colonial: ["#f2d98f", "#f6e7b8", "#ebc597", "#f8ecce"].map(C),
  roofTile: ["#d95a3b", "#e46c42", "#cf4f37", "#e08053", "#d4643f", "#c94c33"].map(C),
  roofMetal: ["#6aaa9b", "#7fa6c4", "#8fbb7c", "#6b98b3", "#c3ccce", "#d98a5b"].map(C),
  roofFlat: ["#ece4d3", "#ded8ca", "#d2dcc6", "#f0e3c8", "#e2dccc", "#e8d9b8", "#d8d6cc"].map(C),
  awning: ["#c8553d", "#2f8f86", "#ddb85e", "#e9e1cf", "#d98a5b", "#5a7fa8"].map(C),
  sign: ["#b94537", "#2f8f86", "#ddb85e", "#5a7fa8", "#d98a5b", "#7a5a8f"].map(C),
  planter: ["#7fb55e", "#6fa85a", "#97c26b"].map(C),
  /** window surrounds / shutters: white, cream, and painted accents */
  trim: ["#fbf7ee", "#f4ead6", "#ffffff", "#e8efe9"].map(C),
  shutter: ["#3f8f7a", "#2f7fb0", "#a8643f", "#5f9e4e", "#2e8f9f", "#c45f43", "#6d7fb8"].map(C),
};

export interface Buckets {
  walls: Record<FacadeStyle, MeshBuf>;
  roofs: Record<RoofStyle, MeshBuf>;
  details: MeshBuf;
}

export const newBuckets = (): Buckets => ({
  walls: Object.fromEntries(FACADE_STYLES.map((s) => [s, newBuf()])) as Record<FacadeStyle, MeshBuf>,
  roofs: Object.fromEntries(ROOF_STYLES.map((s) => [s, newBuf()])) as Record<RoofStyle, MeshBuf>,
  details: newBuf(),
});

export type Kind = "shophouse" | "apartment" | "office" | "tower" | "colonial";

export interface BuildingSpec {
  poly: P2[]; // prepared (CCW, outward normal = (dz, -dx))
  kind: Kind;
  floors: number;
  wall: THREE.Color;
  /** index of the street-facing edge (generated shophouses only) */
  front?: number;
  /** street furniture & rooftop equipment (off on low quality) */
  detail?: boolean;
  R: () => number;
}

const pick = <T,>(arr: T[], R: () => number) => arr[Math.floor(R() * arr.length) % arr.length];

/** Wall band from y0 to y1 around the polygon with a facade style; u restarts per facade. */
function walls(b: MeshBuf, p: P2[], y0: number, y1: number, style: FacadeStyle, col: THREE.Color, plain = false, blankEdge?: (i: number) => boolean) {
  const t = TILE[style];
  // plain=true samples the blank band at the top of the tile (parapets, cornices)
  const v0 = plain ? 0.9 : 0, v1 = plain ? 0.97 : (y1 - y0) / t.h;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], c = p[(i + 1) % p.length];
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (len < 0.05) continue;
    const [nx, nz] = edgeNormal(p, i);
    if (blankEdge?.(i)) {
      // party wall: solid colour (plain band of the tile), no windows
      quad(b, [a[0], y0, a[1]], [c[0], y0, c[1]], [c[0], y1, c[1]], [a[0], y1, a[1]], [nx, 0, nz], col, [0, 0.9], [0.12, 0.9], [0.12, 0.97], [0, 0.97]);
      continue;
    }
    // whole number of bays per facade so windows never get cut at corners;
    // very short edges use the plain margin of the tile.
    const bays = len < t.w * 0.55 ? 0.12 : Math.max(1, Math.round(len / t.w));
    quad(b, [a[0], y0, a[1]], [c[0], y0, c[1]], [c[0], y1, c[1]], [a[0], y1, a[1]], [nx, 0, nz], col, [0, v0], [bays, v0], [bays, v1], [0, v1]);
  }
}

/** Flat cap over a polygon (normal up). Plain UV (tile corner). */
function cap(b: MeshBuf, p: P2[], y: number, col: THREE.Color, uvScale = 0) {
  for (const [a, c, d] of triangulate(p)) {
    tri(b, [a[0], y, a[1]], [c[0], y, c[1]], [d[0], y, d[1]], [0, 1, 0], col,
      [a[0] * uvScale, a[1] * uvScale], [c[0] * uvScale, c[1] * uvScale], [d[0] * uvScale, d[1] * uvScale]);
  }
}

/** Flat roof with a parapet (outer wall continues, inner faces + coping). */
function flatRoofWithParapet(B: Buckets, p: P2[], top: number, style: FacadeStyle, wall: THREE.Color, R: () => number) {
  const ph = 0.9;
  const inner = offsetPolygon(p, 0.35);
  if (Math.abs(signedArea(inner)) < 2) {
    cap(B.roofs.flat, p, top, pick(PALETTE.roofFlat, R), 0.25);
    return;
  }
  walls(B.walls[style], p, top, top + ph, style, wall, true);
  const coping = wall.clone().lerp(new THREE.Color("#ffffff"), 0.35);
  for (let i = 0; i < p.length; i++) {
    const a = p[i], c = p[(i + 1) % p.length], ai = inner[i], ci = inner[(i + 1) % p.length];
    const [nx, nz] = edgeNormal(p, i);
    // inner face looks inward
    quad(B.details, [ai[0], top, ai[1]], [ci[0], top, ci[1]], [ci[0], top + ph, ci[1]], [ai[0], top + ph, ai[1]], [-nx, 0, -nz], wall.clone().multiplyScalar(0.85));
    quad(B.details, [a[0], top + ph, a[1]], [c[0], top + ph, c[1]], [ci[0], top + ph, ci[1]], [ai[0], top + ph, ai[1]], [0, 1, 0], coping);
  }
  cap(B.roofs.flat, inner, top + 0.02, pick(PALETTE.roofFlat, R), 0.25);
}

/** Pitched roof (gable or hip) over the footprint's oriented box. */
function pitchedRoof(B: Buckets, p: P2[], top: number, style: FacadeStyle, wall: THREE.Color, roof: RoofStyle, col: THREE.Color, hip: boolean) {
  const o = obb(p);
  const over = 0.35;
  const L = o.len / 2 + over, W = o.wid / 2 + over;
  const pitch = roof === "metal" ? 0.32 : 0.5;
  const rise = Math.min(W * pitch, 4);
  const ux = o.ux, uz = o.uz, vx = -uz, vz = ux;
  const P = (u: number, v: number, y: number): [number, number, number] => [o.cx + ux * u + vx * v, y, o.cz + uz * u + vz * v];
  const hipIn = hip ? Math.min(W, L * 0.45) : 0;
  const r1 = P(-L + hipIn, 0, top + rise), r2 = P(L - hipIn, 0, top + rise);
  const e1 = P(-L, -W, top), e2 = P(L, -W, top), e3 = P(L, W, top), e4 = P(-L, W, top);
  const slope = Math.hypot(W, rise);
  // normals of the two slopes
  const nA: [number, number, number] = [-vx * rise / slope, W / slope, -vz * rise / slope];
  const nB: [number, number, number] = [vx * rise / slope, W / slope, vz * rise / slope];
  const b = B.roofs[roof];
  const uvs = (len: number) => [[0, 0], [len, 0], [len, slope], [0, slope]] as [number, number][];
  const [a0, a1, a2, a3] = uvs(L * 2);
  quad(b, e1, e2, r2, r1, nA, col, a0, a1, a2, a3);
  quad(b, e3, e4, r1, r2, nB, col, a0, a1, a2, a3);
  if (hip) {
    const ln = Math.hypot(hipIn, rise);
    tri(b, e2, e3, r2, [ux * rise / ln, hipIn / ln, uz * rise / ln], col, [0, 0], [W * 2, 0], [W, slope]);
    tri(b, e4, e1, r1, [-ux * rise / ln, hipIn / ln, -uz * rise / ln], col, [0, 0], [W * 2, 0], [W, slope]);
  } else {
    // gable walls (plain part of the facade texture)
    const g1 = P(-L + over, -W + over, top), g2 = P(-L + over, W - over, top), gt1 = P(-L + over, 0, top + rise * ((W - over) / W));
    const g3 = P(L - over, W - over, top), g4 = P(L - over, -W + over, top), gt2 = P(L - over, 0, top + rise * ((W - over) / W));
    tri(B.walls[style], g1, g2, gt1, [-ux, 0, -uz], wall, [0.02, 0.92], [0.06, 0.92], [0.04, 0.95]);
    tri(B.walls[style], g3, g4, gt2, [ux, 0, uz], wall, [0.02, 0.92], [0.06, 0.92], [0.04, 0.95]);
  }
}

/** Rooftop equipment typical of Saigon: stainless water tanks, small stair huts. */
function rooftopKit(B: Buckets, p: P2[], top: number, R: () => number, big: boolean) {
  const o = obb(p);
  if (o.len < 3 || o.wid < 3) return;
  const steel = new THREE.Color("#dfe5e8");
  const n = big ? 1 + Math.floor(R() * 3) : R() < 0.55 ? 1 : 0;
  for (let i = 0; i < n; i++) {
    const u = (R() - 0.5) * Math.max(0, o.len - 3), v = (R() - 0.5) * Math.max(0, o.wid - 3);
    const x = o.cx + o.ux * u - o.uz * v, z = o.cz + o.uz * u + o.ux * v;
    if (big) box(B.details, [x, top + 1.2, z], [2.4, 2.4, 2.2], Math.atan2(o.uz, o.ux), new THREE.Color("#c8c3b8"));
    else {
      box(B.details, [x, top + 0.45, z], [1.1, 0.9, 0.9], 0, new THREE.Color("#8d8a84"));
      cylinder(B.details, x, top + 0.9, z, 0.55, 1.1, 6, steel);
    }
  }
}

/**
 * Projecting floor slabs (gờ tầng) every `every` storeys: a thin outward ring
 * whose top catches the light, so tall blocks read as stacked floors rather
 * than plain boxes (as in the close-up reference of the city).
 */
function floorLedges(B: Buckets, p: P2[], storeyH: number, floors: number, every: number, col: THREE.Color) {
  const out = offsetPolygon(p, -0.3);
  if (out.length !== p.length) return;
  const top = col.clone().lerp(new THREE.Color("#ffffff"), 0.25);
  let n = 0;
  for (let f = every; f < floors && n < 4; f += every, n++) {
    const y = f * storeyH;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], c = p[(i + 1) % p.length], ao = out[i], co = out[(i + 1) % p.length];
      if (Math.hypot(c[0] - a[0], c[1] - a[1]) < 4) continue;
      const [nx, nz] = edgeNormal(p, i);
      quad(B.details, [ao[0], y - 0.2, ao[1]], [co[0], y - 0.2, co[1]], [co[0], y, co[1]], [ao[0], y, ao[1]], [nx, 0, nz], col);
      quad(B.details, [a[0], y, a[1]], [c[0], y, c[1]], [co[0], y, co[1]], [ao[0], y, ao[1]], [0, 1, 0], top);
    }
  }
}

/** Box balconies with railings on the longest facade of an apartment block. */
function balconies(B: Buckets, p: P2[], storeyH: number, floors: number, wall: THREE.Color, R: () => number) {
  let best = -1, len = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], c = p[(i + 1) % p.length], l = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (l > len) { len = l; best = i; }
  }
  if (len < 7) return;
  const a = p[best], c = p[(best + 1) % p.length];
  const [nx, nz] = edgeNormal(p, best);
  const ux = (c[0] - a[0]) / len, uz = (c[1] - a[1]) / len;
  const ry = -Math.atan2(c[1] - a[1], c[0] - a[0]);
  const slab = wall.clone().lerp(new THREE.Color("#ffffff"), 0.3);
  const rail = new THREE.Color("#4a4a46");
  const bay = TILE.apartment.w * 2;
  const nb = Math.min(3, Math.floor(len / bay));
  const off = (len - nb * bay) / 2 + bay / 2;
  let count = 0;
  for (let f = 1; f < Math.min(floors, 9) && count < 8; f += 2) {
    for (let k = 0; k < nb && count < 8; k++) {
      if (R() < 0.3) continue;
      const t = off + k * bay, y = f * storeyH;
      const x = a[0] + ux * t + nx * 0.55, z = a[1] + uz * t + nz * 0.55;
      box(B.details, [x, y + 0.08, z], [2.6, 0.16, 1.1], ry, slab);
      box(B.details, [x + nx * 0.5, y + 0.6, z + nz * 0.5], [2.6, 0.85, 0.07], ry, rail);
      count++;
    }
  }
}

/** Potted plants / small roof gardens on flat roofs (frequent on Saigon rooftops). */
function roofGarden(B: Buckets, p: P2[], top: number, R: () => number) {
  const o = obb(p);
  if (o.len < 5 || o.wid < 4) return;
  const n = 2 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const u = (R() - 0.5) * (o.len - 2.5), v = (R() - 0.5) * (o.wid - 2.5);
    const x = o.cx + o.ux * u - o.uz * v, z = o.cz + o.uz * u + o.ux * v;
    box(B.details, [x, top + 0.35, z], [0.9, 0.7, 0.9], Math.atan2(o.uz, o.ux), pick(PALETTE.planter, R));
  }
}

/** Street-front details for shophouses: balconies, awning, shop sign. */
function shopFront(B: Buckets, p: P2[], front: number, floors: number, wall: THREE.Color, R: () => number) {
  const a = p[front], c = p[(front + 1) % p.length];
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const [nx, nz] = edgeNormal(p, front);
  const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
  const ry = -Math.atan2(c[1] - a[1], c[0] - a[0]);
  const at = (out: number, y: number): [number, number, number] => [mx + nx * out, y, mz + nz * out];
  const g = TILE.shopfront.h;
  const rail = new THREE.Color("#3b3f45");
  const slab = wall.clone().multiplyScalar(0.92);
  // balconies on up to three upper floors (the texture already draws railings)
  let n = 0;
  for (let f = 0; f < floors - 1 && n < 3; f++) {
    if (R() < 0.35) continue;
    const y = g + f * TILE.shop.h;
    box(B.details, at(0.45, y + 0.08), [len - 0.5, 0.16, 0.9], ry, slab);
    // low parapet + slim iron top rail (a solid 0.8 m dark panel read as a black slab)
    box(B.details, at(0.88, y + 0.38), [len - 0.5, 0.45, 0.07], ry, slab.clone().lerp(WHITE, 0.25));
    box(B.details, at(0.88, y + 0.9), [len - 0.5, 0.05, 0.09], ry, rail);
    n++;
  }
  if (R() < 0.75) {
    const col = pick(PALETTE.awning, R);
    box(B.details, at(0.8, g - 0.55), [len - 0.3, 0.12, 1.6], ry, col, -0.28);
  }
  if (R() < 0.6) {
    box(B.details, at(0.12, g + 0.35), [len * 0.8, 0.7, 0.12], ry, pick(PALETTE.sign, R), 0, new THREE.Color("#ffffff"));
  }
}

const WHITE = new THREE.Color("#ffffff");

/**
 * Street parapet of a flat-roofed shophouse (mặt tiền giả): the front wall rises
 * above the roof with a cornice and either a stepped crest or a short tiled
 * canopy — the typical Saigon tube-house silhouette.
 */
function frontParapet(B: Buckets, p: P2[], front: number, top: number, wall: THREE.Color, R: () => number) {
  const a = p[front], c = p[(front + 1) % p.length];
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  if (len < 3) return;
  const [nx, nz] = edgeNormal(p, front);
  const ry = -Math.atan2(c[1] - a[1], c[0] - a[0]);
  const mx = (a[0] + c[0]) / 2 - nx * 0.15, mz = (a[1] + c[1]) / 2 - nz * 0.15;
  const h = 1.3 + R() * 0.9;
  const col = wall.clone().lerp(WHITE, 0.12);
  box(B.details, [mx, top + h / 2, mz], [len, h, 0.3], ry, col);
  box(B.details, [mx + nx * 0.12, top + h, mz + nz * 0.12], [len + 0.1, 0.16, 0.55], ry, col.clone().lerp(WHITE, 0.3));
  if (R() < 0.5) box(B.details, [mx, top + h + 0.4, mz], [len * 0.42, 0.8, 0.3], ry, col);
  else box(B.details, [mx + nx * 0.5, top + h * 0.5, mz + nz * 0.5], [len, 0.12, 1.1], ry, pick(PALETTE.roofTile, R), -0.45);
}

/** Stair hut on a flat roof (tum thang) with its own little tiled gable roof. */
function stairHut(B: Buckets, p: P2[], top: number, wall: THREE.Color, R: () => number) {
  const o = obb(p);
  if (o.len < 7 || o.wid < 3.4) return;
  const ww = Math.min(3.2, o.wid - 0.8), wl = 3.4, h = 2.6;
  const u = (R() < 0.5 ? -1 : 1) * (o.len / 2 - wl / 2 - 1.2);
  const x = o.cx + o.ux * u, z = o.cz + o.uz * u;
  const ry = -Math.atan2(o.uz, o.ux);
  box(B.details, [x, top + h / 2, z], [wl, h, ww], ry, wall.clone().lerp(WHITE, 0.08));
  const roof = pick(PALETTE.roofTile, R), t = 0.5, half = ww / 2 + 0.3;
  const ridge = top + h + (ww / 2) * Math.tan(t);
  for (const side of [1, -1]) {
    const off = (half / 2) * side;
    box(B.details, [x - o.uz * off, ridge - (half / 2) * Math.tan(t), z + o.ux * off], [wl + 0.5, 0.15, half / Math.cos(t)], ry, roof, t * side);
  }
}

/** Vertical fins (lam đứng) on the longest facade of an office block. */
function facadeFins(B: Buckets, p: P2[], top: number, wall: THREE.Color) {
  let best = -1, len = 0;
  for (let i = 0; i < p.length; i++) {
    const l = Math.hypot(p[(i + 1) % p.length][0] - p[i][0], p[(i + 1) % p.length][1] - p[i][1]);
    if (l > len) { len = l; best = i; }
  }
  if (len < 12) return;
  const a = p[best], c = p[(best + 1) % p.length];
  const [nx, nz] = edgeNormal(p, best);
  const ux = (c[0] - a[0]) / len, uz = (c[1] - a[1]) / len, ry = -Math.atan2(uz, ux);
  const n = Math.min(10, Math.floor(len / TILE.office.w));
  const col = wall.clone().lerp(WHITE, 0.35);
  for (let k = 1; k < n; k++) {
    const t = (k / n) * len;
    box(B.details, [a[0] + ux * t + nx * 0.35, top / 2, a[1] + uz * t + nz * 0.35], [0.25, top, 0.7], ry, col);
  }
}

/**
 * Street facade of a shophouse, in real geometry (not texture): a moulded
 * band at every floor, window surrounds lined up with the facade texture's
 * windows (sill and hood; jambs on some houses) in a contrasting colour,
 * louvred shutter panels on some houses, pilasters framing the shop, and on
 * some houses balconies on every upper floor (or a recessed loggia band).
 */
function streetFacade(B: Buckets, p: P2[], front: number, floors: number, wall: THREE.Color, R: () => number) {
  const a = p[front], c = p[(front + 1) % p.length];
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  if (len < 2.5) return;
  const [nx, nz] = edgeNormal(p, front);
  const ux = (c[0] - a[0]) / len, uz = (c[1] - a[1]) / len;
  const ry = -Math.atan2(uz, ux);
  const at = (t: number, out: number, y: number): [number, number, number] => [a[0] + ux * t + nx * out, y, a[1] + uz * t + nz * out];
  const g = TILE.shopfront.h, fh = TILE.shop.h;
  const trimCol = pick(PALETTE.trim, R);
  const band = wall.clone().lerp(WHITE, 0.4);
  const shutters = R() < 0.4 ? pick(PALETTE.shutter, R) : null;
  const jambs = R() < 0.25;
  const style = R(); // < 0.3: balconies on every floor, < 0.45: recessed loggias, else windows only
  // shop pilasters at both ends of the ground floor
  for (const t of [0.18, len - 0.18]) box(B.details, at(t, 0.12, g / 2), [0.36, g, 0.3], ry, band);
  const bays = Math.max(1, Math.round(len / TILE.shop.w)), bw = len / bays;
  for (let f = 0; f < floors - 1; f++) {
    const y0 = g + f * fh;
    // moulded floor band
    box(B.details, at(len / 2, 0.14, y0 + 0.08), [len, 0.2, 0.3], ry, band);
    if (style < 0.3 && f < 4) {
      box(B.details, at(len / 2, 0.5, y0 + 0.1), [len - 0.3, 0.16, 0.95], ry, band);
      // balustrade: low parapet in the band colour + a slim metal top rail
      box(B.details, at(len / 2, 0.95, y0 + 0.42), [len - 0.3, 0.5, 0.08], ry, band);
      box(B.details, at(len / 2, 0.95, y0 + 0.96), [len - 0.3, 0.05, 0.1], ry, new THREE.Color("#55606a"));
      continue; // balcony floors use the texture's French doors
    }
    if (style < 0.45) {
      // loggia: a deep frame round the whole floor's opening
      box(B.details, at(len / 2, 0.25, y0 + fh - 0.25), [len - 0.2, 0.3, 0.5], ry, trimCol);
      for (const t of [0.15, len - 0.15]) box(B.details, at(t, 0.25, y0 + fh / 2), [0.3, fh - 0.3, 0.5], ry, trimCol);
      continue;
    }
    for (let k = 0; k < bays; k++) {
      const t = (k + 0.5) * bw, ww = bw * 0.48;
      box(B.details, at(t, 0.12, y0 + 0.6), [ww + 0.3, 0.12, 0.28], ry, trimCol); // sill
      box(B.details, at(t, 0.16, y0 + 2.92), [ww + 0.45, 0.16, 0.36], ry, trimCol); // hood
      if (jambs) for (const s of [-1, 1]) box(B.details, at(t + s * (ww / 2 + 0.06), 0.08, y0 + 1.76), [0.12, 2.2, 0.16], ry, trimCol);
      if (shutters && bw > 2.6) for (const s of [-1, 1]) box(B.details, at(t + s * (ww / 2 + 0.38), 0.07, y0 + 1.72), [0.55, 2.0, 0.08], ry, shutters);
    }
  }
}

/** Light roof canopy over a roof terrace: four posts and a sloped sheet. */
function roofCanopy(B: Buckets, p: P2[], top: number, R: () => number) {
  const o = obb(p);
  if (o.len < 5 || o.wid < 3.5) return;
  const L = Math.min(4.5, o.len * 0.45), W = Math.min(3.6, o.wid - 0.8);
  const u = (R() < 0.5 ? -1 : 1) * (o.len / 2 - L / 2 - 0.6);
  const cx = o.cx + o.ux * u, cz = o.cz + o.uz * u, ry = -Math.atan2(o.uz, o.ux);
  const post = new THREE.Color("#5b6066");
  for (const su of [-1, 1]) for (const sv of [-1, 1]) {
    const x = cx + o.ux * su * (L / 2 - 0.15) - o.uz * sv * (W / 2 - 0.15), z = cz + o.uz * su * (L / 2 - 0.15) + o.ux * sv * (W / 2 - 0.15);
    box(B.details, [x, top + 1.25, z], [0.12, 2.5, 0.12], ry, post);
  }
  box(B.details, [cx, top + 2.55, cz], [L + 0.4, 0.1, W + 0.4], ry, pick(PALETTE.roofMetal, R), 0.12);
}

/** Close enough to a rectangle for a pitched roof that follows its oriented box. */
export function rectish(p: P2[]) {
  return p.length <= 8 && Math.abs(signedArea(p)) / obb(p).area > 0.86;
}

/** Build one building into the buckets. Returns its roof height. */
export function addBuilding(B: Buckets, s: BuildingSpec): number {
  const { poly: p, kind, floors, wall, R } = s;
  switch (kind) {
    case "shophouse": {
      const g = TILE.shopfront.h;
      const top = g + (floors - 1) * TILE.shop.h;
      // Row houses share side walls: only the street front (and back) get openings.
      let blank: ((i: number) => boolean) | undefined;
      if (s.front !== undefined) {
        const fn = edgeNormal(p, s.front);
        blank = (i) => { const n = edgeNormal(p, i); return Math.abs(n[0] * fn[0] + n[1] * fn[1]) < 0.5; };
      }
      walls(B.walls.shopfront, p, 0, g, "shopfront", wall, false, (i) => (s.front !== undefined ? i !== s.front : false) || !!blank?.(i));
      walls(B.walls.shop, p, g, top, "shop", wall, false, blank);
      const r = R();
      const pitched = rectish(p);
      if (r < 0.42 && pitched) pitchedRoof(B, p, top, "shop", wall, "tile", pick(PALETTE.roofTile, R), R() < 0.4);
      else if (r < 0.55 && pitched) pitchedRoof(B, p, top, "shop", wall, "metal", pick(PALETTE.roofMetal, R), false);
      else {
        flatRoofWithParapet(B, p, top, "shop", wall, R);
        if (s.detail !== false) {
          rooftopKit(B, p, top, R, false);
          if (s.front !== undefined && R() < 0.6) frontParapet(B, p, s.front, top, wall, R);
          if (floors >= 2 && R() < 0.4) stairHut(B, p, top, wall, R);
          else if (R() < 0.3) roofCanopy(B, p, top, R);
        }
      }
      if (s.front !== undefined && s.detail !== false) {
        shopFront(B, p, s.front, floors, wall, R);
        streetFacade(B, p, s.front, floors, wall, R);
      }
      return top;
    }
    case "colonial": {
      const top = floors * TILE.colonial.h;
      walls(B.walls.colonial, p, 0, top, "colonial", wall);
      // cornice
      const out = offsetPolygon(p, -0.35);
      walls(B.walls.colonial, out, top, top + 0.5, "colonial", wall.clone().multiplyScalar(0.92), true);
      cap(B.details, out, top + 0.5, wall.clone().multiplyScalar(0.92));
      if (rectish(p)) pitchedRoof(B, p, top + 0.5, "colonial", wall, "tile", pick(PALETTE.roofTile, R), true);
      else flatRoofWithParapet(B, p, top + 0.5, "colonial", wall, R);
      return top;
    }
    case "apartment": {
      const top = floors * TILE.apartment.h;
      walls(B.walls.apartment, p, 0, top, "apartment", wall);
      flatRoofWithParapet(B, p, top, "apartment", wall, R);
      if (s.detail !== false) {
        rooftopKit(B, p, top, R, R() < 0.5);
        if (floors >= 3) floorLedges(B, p, TILE.apartment.h, floors, floors > 8 ? 3 : 2, wall.clone().multiplyScalar(0.9));
        if (floors >= 3 && R() < 0.6) balconies(B, p, TILE.apartment.h, floors, wall, R);
        if (R() < 0.3) roofGarden(B, p, top, R);
      }
      return top;
    }
    case "office": {
      const top = floors * TILE.office.h;
      walls(B.walls.office, p, 0, top, "office", wall);
      flatRoofWithParapet(B, p, top, "office", wall, R);
      rooftopKit(B, p, top, R, true);
      if (s.detail !== false && floors >= 4) floorLedges(B, p, TILE.office.h, floors, 2, wall.clone().multiplyScalar(0.88));
      if (s.detail !== false && floors >= 6 && R() < 0.45) facadeFins(B, p, top, wall);
      return top;
    }
    case "tower": {
      // podium + shaft + set-back crown, so towers aren't plain boxes
      const podium = 3;
      const shaft = Math.max(6, floors - podium);
      const pTop = podium * TILE.office.h;
      walls(B.walls.office, p, 0, pTop, "office", PALETTE.office[0]);
      cap(B.roofs.flat, p, pTop, PALETTE.roofFlat[0], 0.25);
      const body = offsetPolygon(p, Math.min(2.5, Math.sqrt(Math.abs(signedArea(p))) * 0.08));
      const sTop = pTop + shaft * TILE.glass.h;
      // tall towers step back once (giật cấp) about 60 % of the way up
      let upper = body;
      if (shaft >= 18 && R() < 0.5) {
        const step = offsetPolygon(body, Math.min(3, Math.sqrt(Math.abs(signedArea(body))) * 0.12));
        if (step.length === body.length && Math.abs(signedArea(step)) > 60) {
          const mid = pTop + Math.round(shaft * 0.6) * TILE.glass.h;
          walls(B.walls.glass, body, pTop, mid, "glass", wall);
          cap(B.roofs.flat, body, mid + 0.01, PALETTE.roofFlat[2], 0.25);
          walls(B.walls.glass, step, mid, sTop, "glass", wall.clone().lerp(WHITE, 0.08));
          upper = step;
        }
      }
      if (upper === body) walls(B.walls.glass, body, pTop, sTop, "glass", wall);
      const crown = offsetPolygon(upper, Math.min(2, Math.sqrt(Math.abs(signedArea(upper))) * 0.1));
      walls(B.walls.glass, crown, sTop, sTop + 2 * TILE.glass.h, "glass", wall.clone().lerp(new THREE.Color("#ffffff"), 0.15));
      cap(B.roofs.flat, upper, sTop + 0.01, PALETTE.roofFlat[2], 0.25);
      flatRoofWithParapet(B, crown, sTop + 2 * TILE.glass.h, "office", PALETTE.office[1], R);
      rooftopKit(B, crown, sTop + 2 * TILE.glass.h, R, true);
      return sTop + 2 * TILE.glass.h;
    }
  }
}

/** Choose a kit for an OSM footprint from its size and (known or estimated) height. */
export function classify(area: number, osmHeight: number, R: () => number, compact: boolean, urban = 1): { kind: Kind; floors: number; wall: THREE.Color } {
  // `urban` (0..1) = how central the site is; unknown-height towers only appear in the core
  if (osmHeight > 60 || (osmHeight === 0 && area > 1500 && urban > 0.55 && R() < 0.35)) {
    const floors = osmHeight ? Math.round(osmHeight / TILE.glass.h) : 14 + Math.floor(R() * 22);
    return { kind: "tower", floors: Math.max(9, floors), wall: pick(PALETTE.glass, R) };
  }
  if (osmHeight > 26 || (osmHeight === 0 && area > 900 && R() < 0.5 * urban)) {
    const floors = osmHeight ? Math.round(osmHeight / TILE.office.h) : 7 + Math.floor(R() * 8);
    return R() < 0.6
      ? { kind: "office", floors: Math.max(5, floors), wall: pick(PALETTE.office, R) }
      : { kind: "apartment", floors: Math.max(6, Math.round((floors * TILE.office.h) / TILE.apartment.h)), wall: pick(PALETTE.apartment, R) };
  }
  if (area < 220 && compact) {
    const floors = osmHeight ? Math.max(1, Math.round((osmHeight - 0.4) / TILE.shop.h)) : 2 + Math.floor(R() * R() * 5);
    return { kind: "shophouse", floors: Math.max(1, floors), wall: pick(PALETTE.pastel, R) };
  }
  if (area < 700 && R() < 0.3 && compact) {
    return { kind: "colonial", floors: osmHeight ? Math.max(1, Math.round(osmHeight / TILE.colonial.h)) : 1 + Math.floor(R() * 3), wall: pick(PALETTE.colonial, R) };
  }
  const floors = osmHeight ? Math.max(2, Math.round(osmHeight / TILE.apartment.h)) : 3 + Math.floor(R() * 6);
  return { kind: "apartment", floors, wall: pick(PALETTE.apartment, R) };
}
