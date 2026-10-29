import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { INTERACTIONS, INTERACTION_BY_ID, SPACE_LINKS, spacePath, type InteractionPoint } from "@/data/dinh/interactions";
import { floorFromY, LEVEL, PALACE } from "@/data/dinh/layout";
import { SPACES, spaceAt, type SpaceId } from "@/data/dinh/spaces";
import { buildPalace, type Box } from "@/lib/dinh/palaceModel";
import { boxAABB, spaceModel, spacePlanner } from "@/lib/dinh/spaceModel";
import { pickInteraction, PortalRunner, type TransitionHooks } from "@/lib/interaction/system";
import type { Vec3 } from "@/types";

const model = buildPalace();

/** Is a point inside (or within m of) any of these collider boxes at knee or chest height? */
function blockedBy(boxes: Box[], p: Vec3, m = 0.3) {
  const v = new THREE.Vector3();
  for (const b of boxes) {
    if (!b.collide) continue;
    const inv = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(b.rx ?? 0, b.ry ?? 0, 0, "YXZ")).invert();
    for (const hgt of [0.35, 1.1]) {
      v.set(p[0], p[1] + hgt, p[2]).sub(new THREE.Vector3(...b.p)).applyMatrix4(inv);
      if (Math.abs(v.x) < b.s[0] / 2 + m && Math.abs(v.y) < b.s[1] / 2 && Math.abs(v.z) < b.s[2] / 2 + m) return true;
    }
  }
  return false;
}
/** Is there a floor (a collider whose top is at the feet) under p? */
function supported(boxes: Box[], p: Vec3) {
  return boxes.some((b) => {
    if (!b.collide) return false;
    const a = boxAABB(b);
    return p[0] > a.x0 && p[0] < a.x1 && p[2] > a.z0 && p[2] < a.z1 && Math.abs(a.y1 - p[1]) < 0.4;
  });
}
const portalsOf = (pts: InteractionPoint[]) => pts.filter((i) => i.portal);

describe("room registry", () => {
  it("lists only spaces that exist in the model, each with something of its own", () => {
    for (const s of SPACES) {
      const sm = spaceModel(model, s.id);
      expect(sm.boxes.filter((b) => b.collide).length, s.id).toBeGreaterThan(3);
      expect(s.lights.length).toBeLessThanOrEqual(4);
      expect(spaceAt(s.spawn.p), s.id).toBe(s.id);
    }
    // not modelled in the simulation: no space, no door
    const ids = SPACES.map((s) => s.id as string);
    for (const missing of ["ceremonial", "banquet", "floor2"]) expect(ids).not.toContain(missing);
  });

  it("splits the palace: a room does not carry the other rooms", () => {
    const hall = spaceModel(model, "hall"), kt = spaceModel(model, "khanh_tiet"), bmaps = spaceModel(model, "b_maps");
    const inKt = (b: Box) => { const a = boxAABB(b); return a.z1 < -45 && a.z0 > -59 && a.y0 > LEVEL.f1 - 0.1 && a.y1 < LEVEL.f1 + 4; };
    expect(kt.boxes.some(inKt)).toBe(true);
    expect(hall.boxes.some(inKt)).toBe(false); // Khánh tiết furniture is not in the hall
    const cred = spaceModel(model, "credentials");
    expect(cred.boxes.every((b) => boxAABB(b).y1 > LEVEL.f2 - 0.6)).toBe(true); // only floor-2 parts
    expect(bmaps.boxes.every((b) => boxAABB(b).y0 < LEVEL.f1)).toBe(true); // nothing from upstairs
    expect(hall.trees.length).toBe(0);
    expect(spaceModel(model, "exterior").trees.length).toBeGreaterThan(50);
    // every collider of the palace belongs to at least one space
    const owned = new Set(SPACES.flatMap((s) => spaceModel(model, s.id).boxes));
    const orphans = model.boxes.filter((b) => b.collide && !owned.has(b));
    expect(orphans.length).toBe(0);
  });

  it("connects every space both ways through doors", () => {
    for (const a of SPACES) for (const b of SPACES) {
      expect(spacePath(a.id, b.id), `${a.id} → ${b.id}`).not.toBeNull();
    }
    expect(spacePath("exterior", "b_maps")!.map((d) => d.portal!.space)).toEqual(["hall", "khanh_tiet", "corridor", "stair_basement", "b_corridor", "b_maps"]);
    // the floor-1 order of the official description: Cabinet right, Banquet left, Khánh tiết behind the staircase
    expect(spacePath("exterior", "credentials")!.map((d) => d.portal!.space)).toEqual(["hall", "f2_lobby", "credentials"]);
    // every door is used both ways; Khánh tiết has two doors to the staircase hall
    const pairs = new Set(SPACE_LINKS.map((l) => [l.space, l.portal!.space].sort().join("|")));
    expect(pairs.size).toBe(SPACES.length - 1);
    expect(SPACE_LINKS.length).toBe((SPACES.length - 1) * 2 + 2);
  });
});

describe("doors between spaces", () => {
  it("link every portal both ways", () => {
    for (const p of portalsOf(INTERACTIONS)) {
      const back = INTERACTION_BY_ID.get(p.portal!.back)!;
      expect(back, p.id).toBeTruthy();
      expect(back.portal!.back).toBe(p.id);
      // coming back puts you at the same door, in the space you came from
      expect(back.space).toBe(p.portal!.space);
      expect(back.portal!.space).toBe(p.space);
    }
  });

  it("puts the visitor on a floor, clear of walls, in the target space", () => {
    for (const p of portalsOf(INTERACTIONS)) {
      const to = p.portal!.to;
      const sm = spaceModel(model, p.portal!.space);
      expect(spaceAt(to), p.id).toBe(p.portal!.space);
      expect(supported(sm.boxes, to), `${p.id}: floor`).toBe(true);
      expect(blockedBy(sm.boxes, to), `${p.id}: wall`).toBe(false);
      expect(spacePlanner(sm).freePointNear(to, 0.5), p.id).not.toBeNull();
      // near the door you came through
      const back = INTERACTION_BY_ID.get(p.portal!.back)!;
      if (p.portal!.space !== p.space) expect(Math.hypot(to[0] - back.at[0], to[2] - back.at[2]), p.id).toBeLessThan(6);
    }
  });

  it("has trigger zones on walkable ground of their own space", () => {
    for (const i of INTERACTIONS.filter((x) => x.kind === "door" || x.kind === "stairs")) {
      const sm = spaceModel(model, i.space);
      expect(spaceAt(i.at), i.id).toBe(i.space);
      expect(blockedBy(sm.boxes, i.at, 0.05), i.id).toBe(false);
      expect(floorFromY(i.at[1])).toBe(i.floor);
    }
  });
});

describe("picking the point to act on", () => {
  const of = (s: SpaceId) => INTERACTIONS.filter((i) => i.space === s);
  it("shows the right door prompt on each side of a door", () => {
    expect(pickInteraction([0, LEVEL.f1, PALACE.front.z1 + 1.5], Math.PI, of("exterior"))?.id).toBe("door-main-in");
    expect(pickInteraction([0, LEVEL.f1, PALACE.front.z1 - 1.5], 0, of("hall"))?.id).toBe("door-main-out");
    expect(pickInteraction([14.5, LEVEL.f1, -22.5], Math.PI / 2, of("hall"))?.id).toBe("door-hall-cabinet");
    expect(pickInteraction([17.5, LEVEL.f1, -22.5], -Math.PI / 2, of("cabinet"))?.id).toBe("door-cabinet-hall");
  });

  it("offers nothing from another space, nor far from every point", () => {
    expect(pickInteraction([0, LEVEL.f1, PALACE.front.z1 + 1.5], Math.PI, of("hall"))).toBeNull();
    expect(pickInteraction([-150, 0, -120], Math.PI, of("exterior"))).toBeNull();
  });

  it("prefers the point the visitor faces when two are in range", () => {
    const a = { id: "a", kind: "exhibit" as const, space: "exterior" as const, floor: "grounds" as const, at: [2, 0, 0] as Vec3, radius: 4, prompt: { vi: "a", en: "a" } };
    const b = { ...a, id: "b", at: [-1.8, 0, 0] as Vec3 };
    expect(pickInteraction([0, 0, 0], Math.PI / 2, [a, b])?.id).toBe("a");
    expect(pickInteraction([0, 0, 0], -Math.PI / 2, [a, b])?.id).toBe("b");
  });
});

describe("portal transitions", () => {
  function hooks(log: string[], at: { p: Vec3 }, fail = false): TransitionHooks {
    return {
      setFade: (f) => log.push(`fade:${f}`),
      load: (s) => (log.push(`load:${s}`), fail ? Promise.reject(new Error("boom")) : Promise.resolve()),
      activate: (s) => log.push(`activate:${s}`),
      failed: (s) => log.push(`failed:${s}`),
      teleport: (to) => {
        log.push("teleport");
        at.p = [...to];
      },
      position: () => at.p,
      arrived: () => log.push("arrived"),
      wait: () => Promise.resolve(),
    };
  }
  const portal = INTERACTION_BY_ID.get("door-lobby-credentials")!.portal!;

  it("loads the target behind the fade, then activates it, moves the visitor and fades in", async () => {
    const log: string[] = [];
    const ok = await new PortalRunner().run(portal, hooks(log, { p: [0, 1.5, -34] }));
    expect(ok).toBe(true);
    expect(log).toEqual(["fade:out", "load:credentials", "activate:credentials", "teleport", "arrived", "fade:in", "fade:null"]);
  });

  it("stays in the source space when the target fails to load", async () => {
    const log: string[] = [];
    const at = { p: [0, 1.5, -34] as Vec3 };
    const ok = await new PortalRunner().run(portal, hooks(log, at, true));
    expect(ok).toBe(false);
    expect(log).toEqual(["fade:out", "load:credentials", "failed:credentials", "fade:in", "fade:null"]);
    expect(at.p).toEqual([0, 1.5, -34]); // not moved
  });

  it("runs one transition at a time however often F is pressed", async () => {
    const runner = new PortalRunner();
    const log: string[] = [];
    const at = { p: [0, 1.5, -34] as Vec3 };
    const results = await Promise.all([runner.run(portal, hooks(log, at)), runner.run(portal, hooks(log, at)), runner.run(portal, hooks(log, at))]);
    expect(results).toEqual([true, false, false]);
    expect(log.filter((l) => l === "teleport").length).toBe(1);
    expect(runner.busy).toBe(false);
  });
});
