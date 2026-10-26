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
/** Bright, saturated "miniature city" palette. */
export const PALETTE = {
  pastel: ["#f6c2c9", "#f8d877", "#a8e0c9", "#9fd3ef", "#f7b37a", "#fbe7b0", "#c9b8ef", "#f39c8a", "#ffffff", "#bfe59a", "#f4a9b8", "#ffe08a"].map(C),
  apartment: ["#f3efe6", "#f6d7a7", "#cfe7f2", "#e9b9a5", "#d7ecc9", "#fff3d6", "#f1c6b3"].map(C),
  office: ["#e8e4dc", "#d5dde4", "#f0e6d2", "#c9d6cf"].map(C),
  glass: ["#5fb3d9", "#3f8fc1", "#5cc3b5", "#7fa9d6", "#4aa3a0"].map(C),
  colonial: ["#f2cf6b", "#f6e3a4", "#e9b980", "#fff1c9"].map(C),
  roofTile: ["#d8552f", "#e76f2e", "#c4462e", "#e0833a", "#b8452f"].map(C),
  roofMetal: ["#3f8f7a", "#3a7fbf", "#5aa66b", "#2f6f9e", "#c9d1d6"].map(C),
  roofFlat: ["#d9d3c7", "#e8b49a", "#cfe3c2", "#cfe0ea", "#f2efe8", "#e9d9a8", "#c9c4bb"].map(C),
  awning: ["#e8453c", "#2f7fd1", "#2fa36b", "#f2b630", "#ef7a2b", "#ffffff"].map(C),
  sign: ["#e63946", "#1d7fd1", "#f4b400", "#2a9d8f", "#ff7f11", "#7b2cbf"].map(C),
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
    box(B.details, at(0.88, y + 0.55), [len - 0.5, 0.8, 0.06], ry, rail);
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
        if (s.detail !== false) rooftopKit(B, p, top, R, false);
      }
      if (s.front !== undefined && s.detail !== false) shopFront(B, p, s.front, floors, wall, R);
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
      if (s.detail !== false) rooftopKit(B, p, top, R, R() < 0.5);
      return top;
    }
    case "office": {
      const top = floors * TILE.office.h;
      walls(B.walls.office, p, 0, top, "office", wall);
      flatRoofWithParapet(B, p, top, "office", wall, R);
      rooftopKit(B, p, top, R, true);
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
      walls(B.walls.glass, body, pTop, sTop, "glass", wall);
      const crown = offsetPolygon(body, Math.min(2, Math.sqrt(Math.abs(signedArea(body))) * 0.1));
      walls(B.walls.glass, crown, sTop, sTop + 2 * TILE.glass.h, "glass", wall.clone().lerp(new THREE.Color("#ffffff"), 0.15));
      cap(B.roofs.flat, body, sTop + 0.01, PALETTE.roofFlat[2], 0.25);
      flatRoofWithParapet(B, crown, sTop + 2 * TILE.glass.h, "office", PALETTE.office[1], R);
      rooftopKit(B, crown, sTop + 2 * TILE.glass.h, R, true);
      return sTop + 2 * TILE.glass.h;
    }
  }
}

/** Choose a kit for an OSM footprint from its size and (known or estimated) height. */
export function classify(area: number, osmHeight: number, R: () => number, compact: boolean): { kind: Kind; floors: number; wall: THREE.Color } {
  if (osmHeight > 60 || (osmHeight === 0 && area > 1500 && R() < 0.35)) {
    const floors = osmHeight ? Math.round(osmHeight / TILE.glass.h) : 14 + Math.floor(R() * 22);
    return { kind: "tower", floors: Math.max(9, floors), wall: pick(PALETTE.glass, R) };
  }
  if (osmHeight > 26 || (osmHeight === 0 && area > 900 && R() < 0.5)) {
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
