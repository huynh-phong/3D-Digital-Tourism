import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildPalace } from "@/lib/dinh/palaceModel";
import { RoutePlanner, instruction, makeRoute, pointAt, project } from "@/lib/dinh/route";
import { DESTINATIONS, DEST_BY_KEY } from "@/lib/tour/destinations";
import { LEVEL } from "@/data/dinh/layout";
import type { Vec3 } from "@/types";

const model = buildPalace();
const planner = new RoutePlanner(model);

/** Independent obstacle test: is a point within `m` of any collider box (at knee/chest height)? */
const boxes = model.boxes
  .filter((b) => b.collide)
  .map((b) => ({ c: new THREE.Vector3(...b.p), h: b.s.map((v) => v / 2), inv: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(b.rx ?? 0, b.ry ?? 0, 0, "YXZ")).invert() }));
function blocked(p: Vec3, m = 0.15) {
  const v = new THREE.Vector3();
  for (const hgt of [0.35, 1.1]) {
    for (const b of boxes) {
      v.set(p[0], p[1] + hgt, p[2]).sub(b.c).applyMatrix4(b.inv);
      if (Math.abs(v.x) < b.h[0] + m && Math.abs(v.y) < b.h[1] && Math.abs(v.z) < b.h[2] + m) return true;
    }
  }
  return false;
}

const STARTS: Vec3[] = [
  [0, 0, 138], // gate
  [-30, 0, 100], // ring drive
  [0, LEVEL.f1, -20], // hall
  [30, LEVEL.f1, -14], // cabinet room
  [0, LEVEL.f1, -52], // Khánh tiết room
  [-8, LEVEL.basement, -52], // basement
  [0, LEVEL.roof, -40], // roof
];

describe("route planner", () => {
  it("finds a route from everywhere to every destination, never through a wall or across floors", () => {
    for (const s of STARTS) {
      // floor 2 is a separate space reached by the central staircase's F door (see tests/interaction)
      for (const d of DESTINATIONS.filter((x) => x.floor !== "f2")) {
        const r = planner.plan(s, d.point);
        expect(r, `${s} → ${d.key}`).not.toBeNull();
        const pts = r!.points;
        expect(Math.hypot(pts[0][0] - s[0], pts[0][2] - s[2])).toBeLessThan(3.5);
        const end = pts[pts.length - 1];
        expect(Math.hypot(end[0] - d.point[0], end[2] - d.point[2]), `${d.key} end`).toBeLessThan(r!.exact ? 2.6 : 10);
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i];
          const dy = Math.abs(a[1] - b[1]);
          if (dy > 0.6) {
            // only stair flights change level: short, and both ends are graph nodes
            expect(Math.hypot(a[0] - b[0], a[2] - b[2]), `${d.key} flight`).toBeLessThan(12);
            expect(planner.nodes.some((n) => n.p.every((v, k) => Math.abs(v - a[k]) < 1e-6))).toBe(true);
            continue;
          }
          const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
          for (let t = 0.5; t < len - 0.5; t += 0.5) {
            const q: Vec3 = [a[0] + ((b[0] - a[0]) * t) / len, a[1], a[2] + ((b[2] - a[2]) * t) / len];
            expect(blocked(q), `${s} → ${d.key} crosses an obstacle at ${q.map((v) => v.toFixed(1))}`).toBe(false);
          }
        }
      }
    }
  });

  it("every level edge of the walking graph is itself clear of obstacles", () => {
    for (const [a, b] of model.nav.edges) {
      const pa = planner.node(a)!.p, pb = planner.node(b)!.p;
      if (Math.abs(pa[1] - pb[1]) > 0.6) continue;
      expect(planner.clear(pa, pb, 0.2), `${a} — ${b}`).toBe(true);
    }
  });

  it("goes around the oval lawn instead of across it", () => {
    const r = planner.plan([0, 0, 138], [0, 0, 12])!;
    for (const p of r.points) expect(Math.hypot(p[0] - 0, p[2] - 80)).toBeGreaterThan(51);
  });

  it("routes to the roof and basement go through the stair shafts", () => {
    const roof = planner.plan([0, LEVEL.f1, -20], DEST_BY_KEY.get("stop:stop-roof")!.point)!;
    const ys = roof.points.map((p) => p[1]);
    expect(Math.max(...ys)).toBeGreaterThan(LEVEL.roof - 0.5);
    // climbs gradually (switchback flights), never jumps a whole storey in one segment
    for (let i = 1; i < ys.length; i++) expect(Math.abs(ys[i] - ys[i - 1])).toBeLessThan(3.1);
    const base = planner.plan([0, LEVEL.f1, -20], DEST_BY_KEY.get("stop:stop-basement")!.point)!;
    expect(Math.min(...base.points.map((p) => p[1]))).toBeLessThan(LEVEL.basement + 0.5);
  });

  it("reports blocked destinations as inexact and unreachable starts as no route", () => {
    const inTank = planner.plan([0, 0, 138], [76, 0, 116])!;
    expect(inTank).not.toBeNull();
    expect(blocked(inTank.points[inTank.points.length - 1])).toBe(false);
    // outside the closed boundary wall there is no walkable connection
    expect(planner.plan([0, 0, 170], [0, LEVEL.f1, -20])).toBeNull();
  });

  it("projects positions on the route and gives sensible turn instructions", () => {
    const r = makeRoute([[0, 0, 0], [0, 0, -10], [10, 0, -10]]);
    expect(project(r, [0.5, 0, -4]).s).toBeCloseTo(4, 1);
    expect(pointAt(r, 15)).toEqual([5, 0, -10]);
    // facing -z (yaw = π): straight on the first leg, then the route turns toward +x = left of someone facing -z
    expect(instruction(r, 1, Math.PI)).toBe("straight");
    expect(instruction(r, 9, Math.PI)).toBe("right"); // facing -z, +x is on your right
    expect(instruction(r, 9, 0)).toBe("left");
    expect(instruction(r, 9, -Math.PI / 2)).toBe("back");
    const up = makeRoute([[0, 0, 0], [0, 0, -2], [0, 3, -8]]);
    expect(instruction(up, 0, Math.PI)).toBe("up");
  });
});
