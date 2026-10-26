import * as THREE from "three";
import { floorFromY, GROUNDS } from "@/data/dinh/layout";
import type { NavNode, Vec3 } from "@/types";
import { trunkRadius, type PalaceModel } from "./palaceModel";

/**
 * Route planning for the visitor's directions and for Minh Anh.
 *
 * Pure (no rendering, no Rapier) so it is unit-tested against the same
 * collision boxes the physics uses. A route is: straight walk from the start
 * to a nav node it can see → A* over the nav graph (corridors, doors, stair
 * flights) → straight walk to the destination, then "string-pulled" so it
 * cuts corners only where the straight line is provably clear. A segment is
 * clear when, at knee and chest height, it stays `margin` away from every
 * collider box and tree trunk; points on different floors are never joined
 * except along stair edges of the graph.
 */
export interface Route {
  points: Vec3[];
  /** cumulative length at each point */
  cum: number[];
  length: number;
  /** false when the destination itself is not reachable and the route ends at the nearest walkable point */
  exact: boolean;
}

interface OBB {
  c: THREE.Vector3;
  h: THREE.Vector3; // half extents
  inv: THREE.Matrix3; // world → local rotation
  min: THREE.Vector3; // world AABB
  max: THREE.Vector3;
}

const MARGIN = 0.32;

export class RoutePlanner {
  readonly nodes: NavNode[];
  private adj = new Map<string, { id: string; w: number }[]>();
  private byId = new Map<string, NavNode>();
  private obbs: OBB[] = [];
  private trees: { x: number; z: number; r: number }[] = [];
  /** areas routes avoid although they are walkable (the oval lawn) */
  private soft = [{ x: GROUNDS.lawnCenter[0], z: GROUNDS.lawnCenter[1], r: GROUNDS.lawnRadius + 0.6 }];
  private grid = new Map<string, number[]>(); // 8 m buckets of obbs, for speed
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();

  constructor(model: PalaceModel) {
    this.nodes = model.nav.nodes;
    for (const n of this.nodes) {
      this.byId.set(n.id, n);
      this.adj.set(n.id, []);
    }
    for (const [a, b] of model.nav.edges) {
      const na = this.byId.get(a)!, nb = this.byId.get(b)!;
      const w = Math.hypot(na.p[0] - nb.p[0], na.p[1] - nb.p[1], na.p[2] - nb.p[2]);
      this.adj.get(a)!.push({ id: b, w });
      this.adj.get(b)!.push({ id: a, w });
    }
    for (const b of model.boxes) {
      if (!b.collide) continue;
      const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(b.rx ?? 0, b.ry ?? 0, 0, "YXZ"));
      const h = new THREE.Vector3(b.s[0] / 2, b.s[1] / 2, b.s[2] / 2);
      const c = new THREE.Vector3(...b.p);
      // world AABB of the rotated box
      const ext = new THREE.Vector3();
      const e = rot.elements;
      ext.x = Math.abs(e[0]) * h.x + Math.abs(e[4]) * h.y + Math.abs(e[8]) * h.z;
      ext.y = Math.abs(e[1]) * h.x + Math.abs(e[5]) * h.y + Math.abs(e[9]) * h.z;
      ext.z = Math.abs(e[2]) * h.x + Math.abs(e[6]) * h.y + Math.abs(e[10]) * h.z;
      const inv = new THREE.Matrix3().setFromMatrix4(rot).transpose();
      const i = this.obbs.length;
      this.obbs.push({ c, h, inv, min: c.clone().sub(ext), max: c.clone().add(ext) });
      for (let gx = Math.floor((c.x - ext.x - 1) / 8); gx <= Math.floor((c.x + ext.x + 1) / 8); gx++)
        for (let gz = Math.floor((c.z - ext.z - 1) / 8); gz <= Math.floor((c.z + ext.z + 1) / 8); gz++) {
          const k = `${gx},${gz}`;
          if (!this.grid.has(k)) this.grid.set(k, []);
          this.grid.get(k)!.push(i);
        }
    }
    this.trees = model.trees.map((t) => ({ x: t.x, z: t.z, r: trunkRadius(t.s) }));
  }

  node(id: string) {
    return this.byId.get(id);
  }

  /** Is a capsule-sized walker at feet position p free of every obstacle? */
  free(p: Vec3, margin = MARGIN): boolean {
    for (const h of [0.35, 1.1]) if (this.hitsPoint(p[0], p[1] + h, p[2], margin)) return false;
    return !this.trees.some((t) => Math.hypot(t.x - p[0], t.z - p[2]) < t.r + margin) || p[1] > 0.9;
  }

  /** Straight walk a→b on one level without touching any obstacle. */
  clear(a: Vec3, b: Vec3, margin = MARGIN): boolean {
    if (Math.abs(a[1] - b[1]) > 0.6 || floorFromY(a[1]) !== floorFromY(b[1])) return false;
    for (const h of [0.35, 1.1]) {
      this.tmpA.set(a[0], a[1] + h, a[2]);
      this.tmpB.set(b[0], b[1] + h, b[2]);
      if (this.hitsSegment(this.tmpA, this.tmpB, margin)) return false;
    }
    if (a[1] < 0.9) {
      for (const t of this.trees) if (segPointDist2D(a, b, t.x, t.z) < t.r + margin) return false;
      // keep off the lawn, unless you are standing on it (then you may walk off it)
      for (const c of this.soft) if (Math.hypot(a[0] - c.x, a[2] - c.z) > c.r && segPointDist2D(a, b, c.x, c.z) < c.r) return false;
    }
    return true;
  }

  private candidates(x0: number, z0: number, x1: number, z1: number): Set<number> {
    const out = new Set<number>();
    for (let gx = Math.floor((Math.min(x0, x1) - 1) / 8); gx <= Math.floor((Math.max(x0, x1) + 1) / 8); gx++)
      for (let gz = Math.floor((Math.min(z0, z1) - 1) / 8); gz <= Math.floor((Math.max(z0, z1) + 1) / 8); gz++)
        for (const i of this.grid.get(`${gx},${gz}`) ?? []) out.add(i);
    return out;
  }

  private hitsPoint(x: number, y: number, z: number, m: number) {
    const v = new THREE.Vector3();
    for (const i of this.candidates(x, z, x, z)) {
      const o = this.obbs[i];
      if (x < o.min.x - m || x > o.max.x + m || y < o.min.y - 0.05 || y > o.max.y + 0.05 || z < o.min.z - m || z > o.max.z + m) continue;
      v.set(x, y, z).sub(o.c).applyMatrix3(o.inv);
      if (Math.abs(v.x) < o.h.x + m && Math.abs(v.y) < o.h.y + 0.05 && Math.abs(v.z) < o.h.z + m) return true;
    }
    return false;
  }

  /** Segment vs. boxes inflated by m horizontally (slab test in each box's frame). */
  private hitsSegment(a: THREE.Vector3, b: THREE.Vector3, m: number) {
    const p = new THREE.Vector3(), d = new THREE.Vector3();
    for (const i of this.candidates(a.x, a.z, b.x, b.z)) {
      const o = this.obbs[i];
      if (Math.max(a.x, b.x) < o.min.x - m || Math.min(a.x, b.x) > o.max.x + m) continue;
      if (Math.max(a.z, b.z) < o.min.z - m || Math.min(a.z, b.z) > o.max.z + m) continue;
      if (Math.max(a.y, b.y) < o.min.y - 0.05 || Math.min(a.y, b.y) > o.max.y + 0.05) continue;
      p.copy(a).sub(o.c).applyMatrix3(o.inv);
      d.copy(b).sub(o.c).applyMatrix3(o.inv).sub(p);
      const hx = o.h.x + m, hy = o.h.y + 0.05, hz = o.h.z + m;
      let t0 = 0, t1 = 1;
      let ok = true;
      for (const [pp, dd, hh] of [[p.x, d.x, hx], [p.y, d.y, hy], [p.z, d.z, hz]] as const) {
        if (Math.abs(dd) < 1e-9) {
          if (pp < -hh || pp > hh) { ok = false; break; }
        } else {
          let ta = (-hh - pp) / dd, tb = (hh - pp) / dd;
          if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta);
          t1 = Math.min(t1, tb);
          if (t0 > t1) { ok = false; break; }
        }
      }
      if (ok) return true;
    }
    return false;
  }

  private freeCache = new Map<string, Vec3 | null>();

  /**
   * Nearest obstacle-free point to p on its level (p itself when free). For a
   * blocked point (an exhibit, a table) candidates on rings around it are
   * scored by distance plus how far they are from the walking graph, so the
   * approach is on the side you actually come from. Cached per point.
   */
  freePointNear(p: Vec3, maxR = 10): Vec3 | null {
    if (this.free(p)) return p;
    const key = `${p[0].toFixed(1)},${p[1].toFixed(1)},${p[2].toFixed(1)},${maxR}`;
    if (this.freeCache.has(key)) return this.freeCache.get(key)!;
    let best: Vec3 | null = null, bestScore = Infinity;
    for (let r = 0.75; r <= maxR; r += 0.75) {
      if (best && r > bestScore) break; // can't beat it any more
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const q: Vec3 = [p[0] + Math.cos(a) * r, p[1], p[2] + Math.sin(a) * r];
        if (!this.free(q)) continue;
        const vis = this.visibleNodes(q, 1)[0];
        if (!vis) continue;
        const score = r + 0.35 * Math.hypot(vis.p[0] - q[0], vis.p[2] - q[2]);
        if (score < bestScore) { bestScore = score; best = q; }
      }
    }
    this.freeCache.set(key, best);
    return best;
  }

  /** Nav nodes on p's level that p can walk to in a straight line, nearest first. */
  visibleNodes(p: Vec3, k = 6): NavNode[] {
    const f = floorFromY(p[1]);
    const near = this.nodes
      .filter((n) => floorFromY(n.p[1]) === f && Math.abs(n.p[1] - p[1]) < 0.6)
      .map((n) => ({ n, d: Math.hypot(n.p[0] - p[0], n.p[2] - p[2]) }))
      .sort((a, b) => a.d - b.d);
    const out: NavNode[] = [];
    for (const { n, d } of near) {
      if (d > 90) break;
      if (this.clear(p, n.p)) out.push(n);
      if (out.length >= k) break;
    }
    return out;
  }

  private nearestAny(p: Vec3, within: number): NavNode[] {
    return this.nodes.filter((n) => dist3(n.p, p) < within);
  }

  /**
   * Walkable route from → to. Returns null when there is no connection at all;
   * `exact: false` when the destination is blocked and the route ends at the
   * nearest reachable free point instead.
   */
  plan(from: Vec3, to: Vec3): Route | null {
    const start = this.freePointNear(from, 3) ?? from;
    const free = this.freePointNear(to);
    if (!free) return null;
    const goal = free;
    const exactGoal = goal === to || Math.hypot(goal[0] - to[0], goal[2] - to[2]) < 2.5;
    if (this.clear(start, goal) && Math.hypot(start[0] - goal[0], start[2] - goal[2]) < 120) {
      return makeRoute([start, goal], exactGoal);
    }
    // on a stair flight no node is "level" with you: fall back to the nearest ones
    const vs = this.visibleNodes(start, 5), vg = this.visibleNodes(goal, 5);
    const sNodes = vs.length ? vs : this.nearestAny(start, 3.5);
    const gNodes = vg.length ? vg : this.nearestAny(goal, 3.5);
    if (!sNodes.length || !gNodes.length) return null;
    const path = this.search(start, sNodes, goal, gNodes);
    if (!path) return null;
    const pts: Vec3[] = [start, ...path.map((n) => n.p), goal];
    return makeRoute(this.pull(dedupe(pts)), exactGoal);
  }

  /** Dijkstra/A* from a virtual start (linked to sNodes) to a virtual goal. */
  private search(start: Vec3, sNodes: NavNode[], goal: Vec3, gNodes: NavNode[]): NavNode[] | null {
    const gEdge = new Map(gNodes.map((n) => [n.id, dist3(n.p, goal)]));
    const g = new Map<string, number>();
    const came = new Map<string, string>();
    const open = new Map<string, number>(); // id → f
    const h = (n: NavNode) => dist3(n.p, goal);
    for (const n of sNodes) {
      const c = dist3(start, n.p);
      g.set(n.id, c);
      open.set(n.id, c + h(n));
    }
    let best: { id: string; cost: number } | null = null;
    while (open.size) {
      let cur = "", f = Infinity;
      for (const [id, v] of open) if (v < f) { f = v; cur = id; }
      open.delete(cur);
      const gc = g.get(cur)!;
      if (best && f >= best.cost) break;
      const ge = gEdge.get(cur);
      if (ge !== undefined && (!best || gc + ge < best.cost)) best = { id: cur, cost: gc + ge };
      for (const { id, w } of this.adj.get(cur)!) {
        const t = gc + w;
        if (t < (g.get(id) ?? Infinity)) {
          g.set(id, t);
          came.set(id, cur);
          open.set(id, t + h(this.byId.get(id)!));
        }
      }
    }
    if (!best) return null;
    const out = [this.byId.get(best.id)!];
    let c = best.id;
    while (came.has(c)) {
      c = came.get(c)!;
      out.unshift(this.byId.get(c)!);
    }
    return out;
  }

  /** String pulling: skip intermediate points when the straight line is clear. */
  private pull(pts: Vec3[]): Vec3[] {
    const out: Vec3[] = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.clear(pts[i], pts[j])) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }
}

/* ------------------------------------------------------------- helpers */
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function dedupe(pts: Vec3[]) {
  return pts.filter((p, i) => i === 0 || dist3(p, pts[i - 1]) > 0.05);
}

function segPointDist2D(a: Vec3, b: Vec3, x: number, z: number) {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / l2)) : 0;
  return Math.hypot(a[0] + dx * t - x, a[2] + dz * t - z);
}

export function makeRoute(points: Vec3[], exact = true): Route {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + dist3(points[i - 1], points[i]));
  return { points, cum, length: cum[cum.length - 1], exact };
}

/** Point at arc length s along the route. */
export function pointAt(r: Route, s: number): Vec3 {
  if (s <= 0) return r.points[0];
  if (s >= r.length) return r.points[r.points.length - 1];
  let i = 1;
  while (i < r.cum.length - 1 && r.cum[i] < s) i++;
  const a = r.points[i - 1], b = r.points[i];
  const t = (s - r.cum[i - 1]) / Math.max(1e-6, r.cum[i] - r.cum[i - 1]);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Arc length of the closest point of the route to p (vertical distance
 * weighted so floors don't mix) and the distance to it.
 */
export function project(r: Route, p: Vec3, from = 0): { s: number; d: number } {
  let best = { s: 0, d: Infinity };
  for (let i = 1; i < r.points.length; i++) {
    if (r.cum[i] < from - 1e-6) continue;
    const a = r.points[i - 1], b = r.points[i];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const l2 = dx * dx + dy * dy + dz * dz;
    let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy + (p[2] - a[2]) * dz) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const q = [a[0] + dx * t, a[1] + dy * t, a[2] + dz * t];
    const d = Math.hypot(q[0] - p[0], (q[1] - p[1]) * 3, q[2] - p[2]);
    if (d < best.d) best = { s: r.cum[i - 1] + Math.sqrt(l2) * t, d };
  }
  return best;
}

/** The remaining part of a route from arc length s (first point = the point at s). */
export function sliceFrom(r: Route, s: number): Route {
  const pts: Vec3[] = [pointAt(r, s)];
  for (let i = 0; i < r.points.length; i++) if (r.cum[i] > s + 0.05) pts.push(r.points[i]);
  return makeRoute(pts, r.exact);
}

export type Turn = "straight" | "left" | "right" | "back" | "up" | "down";

/**
 * Simple instruction for someone at arc length s facing `yaw` (forward =
 * (sin yaw, cos yaw)): stairs ahead first, otherwise the bearing of a point a
 * few metres further along the route.
 */
export function instruction(r: Route, s: number, yaw: number): Turn {
  const here = pointAt(r, s);
  for (let k = 1; k <= 8; k++) {
    const q = pointAt(r, s + k);
    if (q[1] - here[1] > 0.6) return "up";
    if (q[1] - here[1] < -0.6) return "down";
  }
  const ahead = pointAt(r, Math.min(r.length, s + 4));
  const dx = ahead[0] - here[0], dz = ahead[2] - here[2];
  if (Math.hypot(dx, dz) < 0.5) return "straight";
  const fwd = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const right = dx * -Math.cos(yaw) + dz * Math.sin(yaw);
  const a = Math.atan2(right, fwd);
  if (Math.abs(a) < 0.55) return "straight";
  if (Math.abs(a) > 2.4) return "back";
  return a > 0 ? "right" : "left";
}
