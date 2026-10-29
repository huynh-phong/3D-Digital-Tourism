import { pointInPolygon } from "./buildCity";
import type { CityData, P2 } from "./types";

export interface Frame {
  x: number;
  z: number;
  /** rotation.y that aligns a model's local +x with the footprint's long side */
  angle: number;
  length: number;
  width: number;
}

/** Oriented box of the OSM footprint containing (x, z); null if none. */
export function footprintFrame(data: CityData, x: number, z: number, near = 0): Frame | null {
  let best: P2[] | null = null;
  let bestArea = Infinity;
  for (const b of data.buildings) {
    if (!pointInPolygon(x, z, b.p)) continue;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const q of b.p) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minZ = Math.min(minZ, q[1]); maxZ = Math.max(maxZ, q[1]); }
    const area = (maxX - minX) * (maxZ - minZ);
    if (area < bestArea) { bestArea = area; best = b.p; }
  }
  if (!best && near > 0) {
    // the anchor may sit just outside the outline (e.g. an entrance node): nearest footprint centroid
    let bd = near;
    for (const b of data.buildings) {
      const cx = b.p.reduce((s, q) => s + q[0], 0) / b.p.length, cz = b.p.reduce((s, q) => s + q[1], 0) / b.p.length;
      const d = Math.hypot(cx - x, cz - z);
      if (d < bd && b.p.length > 4) { bd = d; best = b.p; }
    }
  }
  if (!best) return null;
  let longest = 0, ang = 0;
  for (let i = 0; i < best.length; i++) {
    const a = best[i], b = best[(i + 1) % best.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > longest) { longest = len; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  }
  const ux = Math.cos(ang), uz = Math.sin(ang);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const q of best) {
    const u = q[0] * ux + q[1] * uz;
    const v = -q[0] * uz + q[1] * ux;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u);
    v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  return {
    x: cu * ux - cv * uz,
    z: cu * uz + cv * ux,
    // three.js rotation.y rotates +x toward -z, so negate the x/z-plane angle.
    angle: -ang,
    length: u1 - u0,
    width: v1 - v0,
  };
}
