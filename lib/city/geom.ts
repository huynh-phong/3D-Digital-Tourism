import * as THREE from "three";
import type { P2 } from "./types";

/**
 * Low-level mesh building. Every triangle goes through `tri`, which checks the
 * winding against the intended outward normal and flips it if needed — so
 * faces can never end up inside-out (the cause of "hollow" buildings before).
 */
export interface MeshBuf {
  pos: number[];
  nor: number[];
  uv: number[];
  col: number[];
}

export const newBuf = (): MeshBuf => ({ pos: [], nor: [], uv: [], col: [] });

type V3 = [number, number, number];
type UV = [number, number];

const UV0: UV = [0, 0];
export function tri(b: MeshBuf, A: V3, B: V3, C: V3, n: V3, c: THREE.Color, uvA: UV = UV0, uvB: UV = UV0, uvC: UV = UV0) {
  const e1x = B[0] - A[0], e1y = B[1] - A[1], e1z = B[2] - A[2];
  const e2x = C[0] - A[0], e2y = C[1] - A[1], e2z = C[2] - A[2];
  const cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x;
  if (cx * cx + cy * cy + cz * cz < 1e-10) return; // degenerate
  if (cx * n[0] + cy * n[1] + cz * n[2] < 0) {
    [B, C] = [C, B];
    [uvB, uvC] = [uvC, uvB];
  }
  b.pos.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
  b.nor.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
  b.uv.push(uvA[0], uvA[1], uvB[0], uvB[1], uvC[0], uvC[1]);
  b.col.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b);
}

/** Quad a-b-c-d (in order around the face). */
export function quad(b: MeshBuf, a: V3, bb: V3, c: V3, d: V3, n: V3, col: THREE.Color, uva: UV = [0, 0], uvb: UV = [0, 0], uvc: UV = [0, 0], uvd: UV = [0, 0]) {
  tri(b, a, bb, c, n, col, uva, uvb, uvc);
  tri(b, a, c, d, n, col, uva, uvc, uvd);
}

/** Oriented box: centre, size, rotation about y (and optional tilt about the local x axis). Bottom face omitted (never seen). */
export function box(b: MeshBuf, c: V3, s: V3, ry: number, col: THREE.Color, tiltX = 0, topCol?: THREE.Color) {
  const cy = Math.cos(ry), sy = Math.sin(ry), ct = Math.cos(tiltX), st = Math.sin(tiltX);
  // local axes after Ry * Rx
  const X: V3 = [cy, 0, -sy];
  const Y: V3 = [sy * st, ct, cy * st];
  const Z: V3 = [sy * ct, -st, cy * ct];
  const hx = s[0] / 2, hy = s[1] / 2, hz = s[2] / 2;
  const P = (x: number, y: number, z: number): V3 => [
    c[0] + X[0] * x + Y[0] * y + Z[0] * z,
    c[1] + X[1] * x + Y[1] * y + Z[1] * z,
    c[2] + X[2] * x + Y[2] * y + Z[2] * z,
  ];
  const neg = (v: V3): V3 => [-v[0], -v[1], -v[2]];
  quad(b, P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), P(hx, -hy, hz), X, col);
  quad(b, P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), P(-hx, -hy, -hz), neg(X), col);
  quad(b, P(-hx, hy, -hz), P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), Y, topCol ?? col);
  quad(b, P(-hx, -hy, hz), P(-hx, hy, hz), P(hx, hy, hz), P(hx, -hy, hz), Z, col);
  quad(b, P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), P(-hx, -hy, -hz), neg(Z), col);
}

/** Vertical prism (cylinder) with `sides` faces, base at y0. */
export function cylinder(b: MeshBuf, x: number, y0: number, z: number, r: number, h: number, sides: number, col: THREE.Color) {
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2, am = (a0 + a1) / 2;
    const p0: V3 = [x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r];
    const p1: V3 = [x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r];
    quad(b, p0, p1, [p1[0], y0 + h, p1[2]], [p0[0], y0 + h, p0[2]], [Math.cos(am), 0, Math.sin(am)], col);
    tri(b, [x, y0 + h, z], [p0[0], y0 + h, p0[2]], [p1[0], y0 + h, p1[2]], [0, 1, 0], col);
  }
}

export function toGeometry(b: MeshBuf) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(b.nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(b.col, 3));
  g.computeBoundingSphere();
  return g;
}

/* ----------------------------------------------------------- polygons */

/** Standard shoelace area: > 0 when counter-clockwise in the (x, z) plane. */
export function signedArea(p: P2[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i], r = p[(i + 1) % p.length];
    a += q[0] * r[1] - r[0] * q[1];
  }
  return a / 2;
}

/**
 * Clean a footprint: drop the closing duplicate, near-duplicate and collinear
 * points, and orient it so the outward normal of edge a→b is (dz, −dx).
 */
export function prepPolygon(raw: P2[]): P2[] | null {
  let p = raw.slice();
  if (p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
  const out: P2[] = [];
  for (const q of p) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 0.3) out.push(q);
  }
  if (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 0.3) out.pop();
  p = out;
  // remove collinear points
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length], b = p[i], c = p[(i + 1) % p.length];
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1]);
      if (Math.abs(cross) < 0.02 * len) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  if (p.length < 3) return null;
  if (signedArea(p) < 0) p.reverse();
  return Math.abs(signedArea(p)) > 4 ? p : null;
}

/** Outward unit normal of edge i (polygon prepared by prepPolygon). */
export function edgeNormal(p: P2[], i: number): P2 {
  const a = p[i], b = p[(i + 1) % p.length];
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l = Math.hypot(dx, dz) || 1;
  return [dz / l, -dx / l];
}

/** Inset (d > 0) or outset (d < 0) with mitred, clamped corners. */
export function offsetPolygon(p: P2[], d: number): P2[] {
  return p.map((q, i) => {
    const n1 = edgeNormal(p, (i + p.length - 1) % p.length);
    const n2 = edgeNormal(p, i);
    let mx = n1[0] + n2[0], mz = n1[1] + n2[1];
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml;
    mz /= ml;
    const cos = Math.max(0.35, mx * n2[0] + mz * n2[1]);
    const k = Math.min(d / cos, d * 2.5);
    return [q[0] - mx * k, q[1] - mz * k];
  });
}

/** Triangulate; falls back to the convex hull when the outline self-intersects. */
export function triangulate(p: P2[]): [P2, P2, P2][] {
  const tris = THREE.ShapeUtils.triangulateShape(p.map((q) => new THREE.Vector2(q[0], q[1])), []);
  let area = 0;
  const out: [P2, P2, P2][] = tris.map((t) => [p[t[0]], p[t[1]], p[t[2]]]);
  for (const [a, b, c] of out) area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  if (area > Math.abs(signedArea(p)) * 0.9 && area < Math.abs(signedArea(p)) * 1.1) return out;
  const h = convexHull(p);
  const fan: [P2, P2, P2][] = [];
  for (let i = 1; i < h.length - 1; i++) fan.push([h[0], h[i], h[i + 1]]);
  return fan;
}

export function convexHull(pts: P2[]): P2[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [], upper: P2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Oriented bounding box via the longest edge. */
export function obb(p: P2[]) {
  let longest = 0, ang = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > longest) { longest = l; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  }
  const ux = Math.cos(ang), uz = Math.sin(ang);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const q of p) {
    const u = q[0] * ux + q[1] * uz, v = -q[0] * uz + q[1] * ux;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  return { cx: cu * ux - cv * uz, cz: cu * uz + cv * ux, ux, uz, len: u1 - u0, wid: v1 - v0, area: (u1 - u0) * (v1 - v0) };
}
