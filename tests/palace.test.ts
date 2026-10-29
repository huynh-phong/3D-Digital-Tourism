import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { buildPalace } from "@/lib/dinh/palaceModel";
import { NavGraph } from "@/lib/dinh/nav";
import { RoutePlanner } from "@/lib/dinh/route";
import { DEST_BY_KEY } from "@/lib/tour/destinations";
import { INTERACTABLES, TOUR_STOPS } from "@/data/dinh/tour";
import { floorFromY } from "@/data/dinh/layout";
import type { Vec3 } from "@/types";

const model = buildPalace();
const nav = new NavGraph(model.nav.nodes, model.nav.edges);

describe("navigation graph", () => {
  it("connects the gate to every tour stop and interactable", () => {
    const targets: Vec3[] = [
      ...TOUR_STOPS.filter((s) => s.floor !== "f2").map((s) => s.guideSpot),
      ...TOUR_STOPS.filter((s) => s.floor !== "f2").map((s) => s.position),
      ...INTERACTABLES.map((i) => i.position),
    ];
    for (const t of targets) {
      const end = nav.nearest(t, (n) => floorFromY(n.p[1]) === floorFromY(t[1]), 1)[0];
      expect(end, `no node near ${t}`).toBeTruthy();
      expect(Math.hypot(end.p[0] - t[0], end.p[2] - t[2]), `node too far from ${t}`).toBeLessThan(26);
      expect(nav.path("gate", end.id), `no path gate -> ${end.id}`).not.toBeNull();
    }
  });
});

/** Walks a capsule with Rapier's character controller along nav paths — the same setup as the game. */
describe("physics walkthrough", () => {
  let world: RAPIER.World;
  let body: RAPIER.RigidBody;
  let collider: RAPIER.Collider;
  let ctrl: RAPIER.KinematicCharacterController;
  const HALF_H = 0.55;
  const R = 0.3;

  beforeAll(async () => {
    await RAPIER.init();
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    for (const b of model.boxes.filter((x) => x.collide)) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(b.rx ?? 0, b.ry ?? 0, 0, "YXZ"));
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(b.s[0] / 2, b.s[1] / 2, b.s[2] / 2)
          .setTranslation(b.p[0], b.p[1], b.p[2])
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      );
    }
    body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, HALF_H + R + 0.05, 138));
    collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_H, R), body);
    ctrl = world.createCharacterController(0.04);
    ctrl.setMaxSlopeClimbAngle((42 * Math.PI) / 180);
    ctrl.setMinSlopeSlideAngle((55 * Math.PI) / 180);
    ctrl.enableAutostep(0.35, 0.2, true);
    ctrl.enableSnapToGround(0.4);
    world.step();
  });

  const feet = (): Vec3 => {
    const t = body.translation();
    return [t.x, t.y - HALF_H - R, t.z];
  };
  const place = (p: Vec3) => {
    body.setTranslation({ x: p[0], y: p[1] + HALF_H + R + 0.05, z: p[2] }, true);
    world.step();
  };

  /** Steer toward each waypoint in turn. */
  const walk = (path: Vec3[]) => {
    const dt = 1 / 60;
    const speed = 2.5;
    let vy = 0;
    for (const wp of path) {
      for (let i = 0; i < 60 * 60; i++) {
        const f = feet();
        const dx = wp[0] - f[0];
        const dz = wp[2] - f[2];
        const d = Math.hypot(dx, dz);
        if (d < 0.45) break;
        vy = ctrl.computedGrounded() ? -2 : vy - 22 * dt;
        const s = Math.min(d, speed * dt);
        ctrl.computeColliderMovement(collider, { x: (dx / d) * s, y: vy * dt, z: (dz / d) * s });
        const m = ctrl.computedMovement();
        const t = body.translation();
        body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
        world.step();
      }
      const f = feet();
      if (Math.hypot(wp[0] - f[0], wp[2] - f[2]) > 1) return { ok: false, at: wp, feet: f };
    }
    return { ok: true, at: null, feet: feet() };
  };

  const route = (from: string, to: string) => nav.path(from, to)!.map((n) => n.p);

  it("walks from the gate up the front steps into the hall", () => {
    place(nav.get("gate")!.p);
    const r = walk(route("gate", "hall"));
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect(r.feet[1]).toBeGreaterThan(1.2);
  });

  it("climbs the stairs from the hall to the flagpole on the roof", () => {
    place(nav.get("hall")!.p);
    const r = walk(route("hall", "flag"));
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect(r.feet[1]).toBeGreaterThan(21);
  });

  it("goes down to the basement communications area", () => {
    place(nav.get("hall")!.p);
    const r = walk(route("hall", "bComms"));
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect(r.feet[1]).toBeLessThan(-3.5);
  });

  it("reaches the cabinet room and the outdoor exhibits", () => {
    place(nav.get("hall")!.p);
    expect(walk(route("hall", "cabinet2")).ok).toBe(true);
    place(nav.get("gate")!.p);
    expect(walk(route("gate", "exF5e")).ok).toBe(true);
  });

  it("a capsule following planned routes reaches the destinations (gate → roof, basement, exhibits)", () => {
    const planner = new RoutePlanner(model);
    for (const key of ["stop:stop-roof", "stop:stop-basement", "stop:stop-cabinet", "room:b_maps", "interactable:i-f5e", "stop:stop-lawn"]) {
      const d = DEST_BY_KEY.get(key)!;
      place([0, 0, 138]);
      const r = planner.plan(feet(), d.point)!;
      const w = walk(r.points.slice(1));
      expect(w.ok, `${key} ${JSON.stringify(w)}`).toBe(true);
      expect(Math.hypot(w.feet[0] - d.point[0], w.feet[2] - d.point[2]), key).toBeLessThan(r.exact ? 1.5 : 10);
      expect(Math.abs(w.feet[1] - d.point[1]), key).toBeLessThan(0.6);
    }
  });

  it("cannot walk through the closed palace walls", () => {
    place([30, 0, 2]);
    expect(walk([[30, 0, -20]]).ok).toBe(false);
    place([0, 1.5, -22]);
    expect(walk([[-30, 1.5, -22]]).ok).toBe(false); // closed east wing
  });
});
