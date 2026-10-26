import { sampleLane } from "@/lib/city/roads";
import { rng } from "@/lib/geo";
import type { P2 } from "@/lib/city/types";
import type { BoatKind } from "./models";

/**
 * WaterTrafficSimulation — boats loop along routes built from the river/canal
 * centrelines: up one side (keeping right), a wide U-turn, back down the other.
 * Boat sizes are limited by the measured channel half-width, so barges never
 * enter the narrow canal. Routes are simulated, not real ferry timetables.
 */

export const BOATS: Record<BoatKind, { length: number; speed: number; minHalfWidth: number; weight: number }> = {
  tour: { length: 26, speed: 2.6, minHalfWidth: 70, weight: 3 },
  ferry: { length: 18, speed: 3.4, minHalfWidth: 60, weight: 2 },
  barge: { length: 40, speed: 1.8, minHalfWidth: 90, weight: 2 },
  boat: { length: 7, speed: 2.2, minHalfWidth: 10, weight: 4 },
  speedboat: { length: 8, speed: 6, minHalfWidth: 25, weight: 2 },
};

export interface Boat { kind: BoatKind; route: number; s: number; v: number; vmax: number; phase: number; x: number; y: number; z: number; yaw: number; roll: number }

interface Route { pts: P2[]; cum: number[]; length: number; halfWidth: number }

function offsetLine(pts: P2[], off: number): P2[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    return [p[0] - (dz / l) * off, p[1] + (dx / l) * off];
  });
}

function arc(center: P2, from: P2, to: P2, steps = 10): P2[] {
  const a0 = Math.atan2(from[1] - center[1], from[0] - center[0]);
  let a1 = Math.atan2(to[1] - center[1], to[0] - center[0]);
  // turn through the "outside" (the side away from the channel)
  if (a1 - a0 > 0) a1 -= Math.PI * 2;
  const r = Math.hypot(from[0] - center[0], from[1] - center[1]);
  const out: P2[] = [];
  for (let i = 1; i < steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r]);
  }
  return out;
}

export function buildLoop(center: P2[], off: number): P2[] {
  const fwd = offsetLine(center, off);
  const back = offsetLine([...center].reverse(), off);
  return [...fwd, ...arc(center[center.length - 1], fwd[fwd.length - 1], back[0]), ...back, ...arc(center[0], back[back.length - 1], fwd[0])];
}

/**
 * Closed boat loops from a centreline, validated against the water mask:
 * if a U-turn would touch land, the route end is trimmed back until it fits.
 */
export function buildBoatLoops(routes: { pts: P2[]; halfWidth: number }[], isWater: (x: number, z: number) => boolean) {
  const loops: { pts: P2[]; halfWidth: number }[] = [];
  for (const r of routes) {
    for (const frac of r.halfWidth > 40 ? [0.42, 0.18] : [0.3]) {
      const off = Math.min(r.halfWidth * frac, 70);
      let center = r.pts;
      let loop: P2[] | null = null;
      for (let trim = 0; trim < 12 && center.length > 3; trim++) {
        const cand = buildLoop(center, off);
        if (cand.every((p) => isWater(p[0], p[1]))) { loop = cand; break; }
        center = center.slice(1, -1); // pull both turnarounds inward
      }
      if (!loop) continue;
      loops.push({ pts: [...loop, loop[0]], halfWidth: frac > 0.3 ? r.halfWidth : r.halfWidth * 0.5 });
    }
  }
  return loops;
}

export class WaterTrafficSimulation {
  readonly boats: Boat[] = [];
  readonly routes: Route[] = [];
  private time = 0;
  private tmp = { x: 0, z: 0, dx: 0, dz: 1 };

  constructor(loops: { pts: P2[]; halfWidth: number }[], count: number, seed = 12) {
    const R = rng(seed);
    for (const l of loops) {
      const cum = [0];
      for (let i = 1; i < l.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(l.pts[i][0] - l.pts[i - 1][0], l.pts[i][1] - l.pts[i - 1][1]));
      this.routes.push({ pts: l.pts, cum, length: cum[cum.length - 1], halfWidth: l.halfWidth });
    }
    if (!this.routes.length) return;
    const total = this.routes.reduce((a, r) => a + r.length, 0);
    this.routes.forEach((route, ri) => {
      const kinds = (Object.keys(BOATS) as BoatKind[]).filter((k) => BOATS[k].minHalfWidth <= route.halfWidth);
      if (!kinds.length) return;
      const n = Math.max(1, Math.round((route.length / total) * count));
      for (let i = 0; i < n; i++) {
        let pickW = R() * kinds.reduce((a, k) => a + BOATS[k].weight, 0);
        let kind = kinds[0];
        for (const k of kinds) if ((pickW -= BOATS[k].weight) <= 0) { kind = k; break; }
        const vmax = BOATS[kind].speed * (0.85 + R() * 0.3);
        this.boats.push({ kind, route: ri, s: (route.length * (i + R() * 0.4)) / n, v: vmax, vmax, phase: R() * 10, x: 0, y: 0, z: 0, yaw: 0, roll: 0 });
      }
    });
    this.pose(0);
  }

  update(dt: number) {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    // keep distance from the boat ahead on the same loop
    for (const b of this.boats) {
      const route = this.routes[b.route];
      let gap = Infinity;
      for (const o of this.boats) {
        if (o === b || o.route !== b.route) continue;
        let d = o.s - b.s;
        if (d < 0) d += route.length;
        gap = Math.min(gap, d - (BOATS[o.kind].length + BOATS[b.kind].length) / 2);
      }
      const target = Math.min(b.vmax, Math.max(0, (gap - 15) * 0.2));
      b.v += (target - b.v) * Math.min(1, dt * 0.5);
      b.s = (b.s + b.v * dt) % route.length;
    }
  }

  pose(dt: number) {
    for (const b of this.boats) {
      const p = sampleLane(this.routes[b.route], b.s, this.tmp);
      const yaw = Math.atan2(p.dx, p.dz);
      let d = yaw - b.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      b.yaw += dt ? d * Math.min(1, dt * 1.5) : d;
      b.roll = -d * 0.6 + Math.sin(this.time * 1.1 + b.phase) * 0.015;
      b.x = p.x;
      b.z = p.z;
      b.y = 0.05 + Math.sin(this.time * 1.3 + b.phase) * 0.06;
    }
  }
}
