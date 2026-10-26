import { GROUNDS, LEVEL, PALACE, PAVILION, STAIRS } from "@/data/dinh/layout";
import { rng } from "@/lib/geo";
import type { FloorId, NavEdge, NavNode, Vec3 } from "@/types";

/**
 * Generates the walkable Independence Palace from data/dinh/layout.ts:
 * render boxes, physics colliders and the guide's navigation graph all come
 * from the same primitives, so what you see is what you collide with.
 */

export type Mat =
  | "facade" | "wall" | "floor" | "wood" | "stone" | "glass" | "concrete"
  | "path" | "roof" | "dark" | "metal" | "curtain" | "gold" | "door" | "lacquer" | "paper" | "fabric" | "basementWall";

export interface Box {
  p: Vec3; // centre
  s: Vec3; // size
  m: Mat;
  collide: boolean;
  rx?: number; // rotation about x (ramps)
  ry?: number; // rotation about y
  visible?: boolean;
}

export interface StairVisual {
  /** step boxes for the visual staircase */
  steps: Box[];
}

export interface Tree {
  x: number;
  z: number;
  s: number; // scale
  h: number; // 0..1 variation (species, hue)
}

export interface PalaceModel {
  boxes: Box[];
  steps: Box[];
  nav: { nodes: NavNode[]; edges: NavEdge[] };
  closedDoors: { p: Vec3; ry: number; w: number; h: number }[];
  /** grounds trees (trunks are obstacles for walking and route planning) */
  trees: Tree[];
}

/** Trunk collision radius for a tree of scale s. */
export const trunkRadius = (s: number) => 0.5 * s;

/**
 * Furniture and exhibit layout shared by the renderer (Palace.tsx) and the
 * physics / route planner (their footprints are added to `boxes` as invisible
 * colliders), so nothing can be walked or routed through.
 */
export const FURNITURE = (() => {
  const y = LEVEL.f1;
  const cabChairs: { x: number; z: number; ry: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI - Math.PI;
    for (const side of [1, -1]) {
      const ang = side > 0 ? a : -a;
      const x = 32 + Math.cos(ang) * 7.4, z = -23 + Math.sin(ang) * 3.3;
      cabChairs.push({ x, z, ry: Math.atan2(32 - x, -23 - z) });
    }
  }
  const credSeats: { x: number; z: number; seats: number; side: 1 | -1 }[] = [];
  for (const side of [1, -1] as const) credSeats.push({ x: side * 9.4, z: -39.6, seats: 1, side }, { x: side * 9.4, z: -45, seats: 3, side }, { x: side * 9.4, z: -51.2, seats: 1, side });
  return {
    y,
    cabTable: { x: 32, z: -23, rx: 6.6, rz: 2.5 },
    cabChairs,
    credSeats,
    credTables: [-42.2, -48.3].flatMap((z) => [[8.9, z], [-8.9, z]] as [number, number][]),
    credVases: [-41, -47, -53, -57.5].flatMap((z) => [[11.8, z], [-11.8, z]] as [number, number][]),
    credDesk: { x: 0, z: -57, w: 3.2, d: 1 },
    hallColumns: [-10, -4, 4, 10].flatMap((x) => [-16, -30].map((z) => [x, z] as [number, number])),
  };
})();
export const seatSize = (seats: number) => ({ w: 0.85 * seats, d: 0.95 });

const T = 0.4; // wall thickness

export function buildPalace(): PalaceModel {
  const boxes: Box[] = [];
  const steps: Box[] = [];
  const nodes: NavNode[] = [];
  const edges: NavEdge[] = [];
  const closedDoors: PalaceModel["closedDoors"] = [];

  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: Mat, collide = true, extra: Partial<Box> = {}) => {
    boxes.push({ p: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], s: [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)], m, collide, ...extra });
  };
  const node = (id: string, p: Vec3, floor: FloorId) => nodes.push({ id, p, floor });
  const link = (...ids: string[]) => {
    for (let i = 0; i < ids.length - 1; i++) edges.push([ids[i], ids[i + 1]]);
  };

  /**
   * Axis-aligned wall from (x0,z0) to (x1,z1) — one of the axes must match.
   * openings: { c: centre along the wall, w: width, h: height from y0 }.
   */
  const wall = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, m: Mat, openings: { c: number; w: number; h: number }[] = [], visible = true) => {
    const alongX = Math.abs(z1 - z0) < 1e-6;
    const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1);
    const a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
    const fixed = alongX ? z0 : x0;
    const seg = (s0: number, s1: number, ya: number, yb: number) => {
      if (s1 - s0 < 0.01 || yb - ya < 0.01) return;
      const extra = visible ? {} : { visible: false };
      if (alongX) box(s0, ya, fixed - T / 2, s1, yb, fixed + T / 2, m, true, extra);
      else box(fixed - T / 2, ya, s0, fixed + T / 2, yb, s1, m, true, extra);
    };
    const ops = [...openings].sort((a, b) => a.c - b.c);
    let cur = a0;
    for (const o of ops) {
      seg(cur, o.c - o.w / 2, y0, y1);
      seg(o.c - o.w / 2, o.c + o.w / 2, y0 + o.h, y1); // lintel
      cur = o.c + o.w / 2;
    }
    seg(cur, a1, y0, y1);
  };

  const { front: F, rear: Rr } = PALACE;
  const f1 = LEVEL.f1, bas = LEVEL.basement, roof = LEVEL.roof;
  const ceilF1 = f1 + 4.7; // underside of the slab above the ground floor

  // ------------------------------------------------------------------ grounds
  // Ground collider (rendered separately as grass), open above the basement under the rear wing.
  {
    const gx0 = -GROUNDS.halfW - 20, gx1 = GROUNDS.halfW + 20, gz0 = -GROUNDS.halfD - 20, gz1 = GROUNDS.halfD + 20;
    const { rear } = PALACE;
    const g = (x0: number, z0: number, x1: number, z1: number) => box(x0, -1, z0, x1, 0, z1, "path", true, { visible: false });
    g(gx0, gz0, rear.x0, gz1);
    g(rear.x1, gz0, gx1, gz1);
    g(rear.x0, gz0, rear.x1, rear.z0);
    g(rear.x0, rear.z1, rear.x1, gz1);
  }
  // Boundary walls with the (closed) main gate on Nam Kỳ Khởi Nghĩa.
  const gw = 7;
  wall(-GROUNDS.halfW, GROUNDS.halfD, -gw, GROUNDS.halfD, 0, 2.6, "stone");
  wall(gw, GROUNDS.halfD, GROUNDS.halfW, GROUNDS.halfD, 0, 2.6, "stone");
  box(-gw, 0, GROUNDS.halfD - 0.2, gw, 2.4, GROUNDS.halfD + 0.2, "metal", true, { visible: false }); // gate collider
  wall(-GROUNDS.halfW, -GROUNDS.halfD, GROUNDS.halfW, -GROUNDS.halfD, 0, 2.6, "stone");
  wall(-GROUNDS.halfW, -GROUNDS.halfD, -GROUNDS.halfW, GROUNDS.halfD, 0, 2.6, "stone");
  wall(GROUNDS.halfW, -GROUNDS.halfD, GROUNDS.halfW, GROUNDS.halfD, 0, 2.6, "stone");

  // ------------------------------------------------------------- front steps
  const stepTopZ = F.z1 + 4; // porch edge (-6)
  const stepRun = 5;
  // Porch / plinth of the front block (solid up to the ground-floor level).
  box(F.x0 - 2, 0, F.z0, F.x1 + 2, f1, stepTopZ, "stone");
  // Ramp collider for the steps; visual steps drawn on top.
  {
    const len = Math.hypot(stepRun, f1);
    const ang = Math.atan2(f1, stepRun);
    boxes.push({ p: [0, f1 / 2 - 0.15, stepTopZ + stepRun / 2], s: [16, 0.3, len], m: "stone", collide: true, rx: ang, visible: false });
    const n = 10;
    for (let i = 0; i < n; i++) {
      const h = (f1 / n) * (i + 1);
      const z1 = stepTopZ + stepRun - (stepRun / n) * i;
      steps.push({ p: [0, h / 2, z1 - stepRun / n / 2], s: [16, h, stepRun / n], m: "stone", collide: false });
    }
  }

  // --------------------------------------------------------------- pond curbs
  // Half-moon pond in front of the hall, split by the central walkway.
  const pondC: [number, number] = [0, stepTopZ];
  for (const [a0, a1] of [[0.12, 0.42], [0.58, 0.88]]) {
    const segs = 5;
    for (let i = 0; i < segs; i++) {
      const a = Math.PI * (a0 + ((a1 - a0) * (i + 0.5)) / segs);
      const r = 18;
      const cx = pondC[0] + Math.cos(a) * r, cz = pondC[1] + Math.sin(a) * r;
      const arcLen = (Math.PI * (a1 - a0) * r) / segs + 0.6;
      boxes.push({ p: [cx, 0.3, cz], s: [arcLen, 0.6, 8.6], m: "stone", collide: true, ry: -a + Math.PI / 2, visible: false });
    }
  }

  // -------------------------------------------------------------- front block
  // Outer walls, full height. Front wall has the main entrance.
  const H = roof; // top of walls (roof slab level)
  // Ground floor: glazed front (hall + cabinet room) and glazed cabinet side;
  // the glass itself is drawn by the façade component, these are its colliders.
  const glazeTop = ceilF1 + 0.3;
  wall(F.x0, F.z1, -16, F.z1, f1, glazeTop, "facade");
  wall(-16, F.z1, F.x1, F.z1, f1, glazeTop, "glass", [{ c: 0, w: 6, h: 3.6 }], false);
  wall(F.x0, F.z1, F.x1, F.z1, glazeTop, H, "facade");
  wall(F.x0, F.z0, F.x0, F.z1, f1, H, "facade");
  wall(F.x1, F.z0, F.x1, F.z1, f1, glazeTop, "glass", [], false);
  wall(F.x1, F.z0, F.x1, F.z1, glazeTop, H, "facade");
  // Back wall of the front block, outside the rear wing.
  wall(F.x0, F.z0, Rr.x0, F.z0, f1, H, "facade");
  wall(Rr.x1, F.z0, F.x1, F.z0, f1, H, "facade");
  // Interior: hall | cabinet room (+x) | closed area (−x).
  wall(16, F.z0, 16, F.z1, f1, ceilF1, "wall", [{ c: -22.5, w: 4, h: 3.2 }]);
  wall(-16, F.z0, -16, F.z1, f1, ceilF1, "wall");
  closedDoors.push({ p: [-15.75, f1, -22.5], ry: -Math.PI / 2, w: 2.4, h: 3 });
  // Hall ↔ rear wing (credentials room) across z = F.z0 between the wing walls.
  wall(Rr.x0, F.z0, Rr.x1, F.z0, f1, ceilF1, "wall", [{ c: 0, w: 5, h: 3.6 }]);
  // Upper part of the same line (closed above the ground floor).
  box(Rr.x0, ceilF1, F.z0 - T / 2, Rr.x1, H, F.z0 + T / 2, "facade", true, { visible: false });

  // Ground-floor ceiling slab (front block).
  box(F.x0, ceilF1, F.z0, F.x1, ceilF1 + 0.3, F.z1, "wall");

  // ---------------------------------------------------------------- rear wing
  wall(Rr.x0, Rr.z0, Rr.x0, Rr.z1, bas, H, "facade");
  wall(Rr.x1, Rr.z0, Rr.x1, Rr.z1, bas, H, "facade");
  wall(Rr.x0, Rr.z0, Rr.x1, Rr.z0, bas, H, "facade");
  // Credentials room
  wall(-13, -60, -13, F.z0, f1, ceilF1, "wall");
  wall(13, -60, 13, F.z0, f1, ceilF1, "wall");
  wall(-13, -60, 13, -60, f1, ceilF1, "wall", [{ c: 8.5, w: 3, h: 3.2 }]);
  // Close the voids beside the credentials room.
  wall(Rr.x0, -60, -13, -60, f1, ceilF1, "wall");
  wall(13, -60, Rr.x1, -60, f1, ceilF1, "wall");
  // Corridor south wall with openings to the two stair shafts.
  const [sb, sr] = STAIRS;
  const shaftW = 4.6, shaftL = 10;
  wall(Rr.x0, -64, Rr.x1, -64, f1, ceilF1, "wall", [
    { c: sb.x0 + shaftW / 2, w: 4.0, h: 3.2 },
    { c: sr.x0 + shaftW / 2, w: 4.0, h: 3.2 },
  ]);

  // Slabs of the rear wing.
  const holes = (x0: number, x1: number, z0: number, z1: number, hx0: number, hx1: number, hz0: number, hz1: number, y0: number, y1: number, m: Mat) => {
    // rectangle minus one rectangular hole → up to 4 boxes
    box(x0, y0, z0, hx0, y1, z1, m);
    box(hx1, y0, z0, x1, y1, z1, m);
    box(hx0, y0, z0, hx1, y1, hz0, m);
    box(hx0, y0, hz1, hx1, y1, z1, m);
  };
  const flightZ0 = -64 - shaftL; // far end (-74)
  const nearLand = -64 - 2.4; // -66.4
  // Ground-floor slab over the basement: hole over the basement shaft flights.
  holes(Rr.x0, Rr.x1, Rr.z0, Rr.z1, sb.x0, sb.x0 + shaftW, flightZ0, nearLand, f1 - 0.3, f1, "wall");
  // Ground-floor ceiling (rear wing): hole over the roof shaft flights.
  holes(Rr.x0, Rr.x1, Rr.z0, Rr.z1, sr.x0, sr.x0 + shaftW, flightZ0, -64, ceilF1, ceilF1 + 0.3, "wall");
  // Roof slab over the rear wing: hole over the roof shaft flights (top landing stays).
  holes(Rr.x0, Rr.x1, Rr.z0, Rr.z1, sr.x0, sr.x0 + shaftW, flightZ0, nearLand, roof - 0.3, roof, "roof");
  // Roof slab over the front block.
  box(F.x0, roof - 0.3, F.z0, F.x1, roof, F.z1, "roof");
  // Solid mass of the rear wing above the ground floor (not walkable in the MVP).
  // Closed by the slabs above; nothing to add.

  // ------------------------------------------------------------------ stairs
  const shaft = (st: (typeof STAIRS)[number], id: string) => {
    const xA = st.x0 + 1.1, xB = st.x0 + 3.5, xm = st.x0 + shaftW / 2;
    const zNear = st.zNear, zN = nearLand, zF = flightZ0 + 2.4;
    const rise = (st.to - st.from) / st.flights;
    const run = zN - zF;
    // Enclosure
    wall(st.x0, flightZ0, st.x0, zNear, st.from, st.to + 3.2, "wall");
    wall(st.x0 + shaftW, flightZ0, st.x0 + shaftW, zNear, st.from, st.to + 3.2, "wall");
    wall(st.x0, flightZ0, st.x0 + shaftW, flightZ0, st.from, st.to + 3.2, "wall");
    // Divider between lanes (flight region only)
    box(st.x0 + 2.2, st.from, zF, st.x0 + 2.4, st.to + 1.1, zN, "metal");
    // Front face above the entrance level, with closed doors on intermediate floors.
    const entryTop = st.from + 3.2;
    box(st.x0, Math.max(entryTop, st.id === "stair-roof" ? ceilF1 + 0.3 : entryTop), zNear - T / 2, st.x0 + shaftW, st.to, zNear + T / 2, "wall");
    // Landings + flights
    node(`${id}-0`, [xm, st.from, zNear - 1.2], "f1");
    let y = st.from;
    let prev = `${id}-0`;
    for (let k = 0; k < st.flights; k++) {
      const up = k % 2 === 0; // even flights go near→far on lane A
      const x = up ? xA : xB;
      const yTop = y + rise;
      // ramp collider
      const len = Math.hypot(run, rise);
      // +z end (near side) is lower on "up" flights
      const ang = Math.atan2(rise, run) * (up ? 1 : -1);
      boxes.push({ p: [x, (y + yTop) / 2 - 0.15, (zN + zF) / 2], s: [2.2, 0.3, len], m: "stone", collide: true, rx: ang, visible: false });
      // visual steps
      const n = Math.max(8, Math.round(rise / 0.17));
      for (let i = 0; i < n; i++) {
        const sy = y + (rise / n) * (i + 1);
        const t0 = i / n, t1 = (i + 1) / n;
        const za = up ? zN - run * t0 : zF + run * t0;
        const zb = up ? zN - run * t1 : zF + run * t1;
        steps.push({ p: [x, sy - 0.1, (za + zb) / 2], s: [2.2, 0.2, Math.abs(zb - za) + 0.02], m: "stone", collide: false });
      }
      // landing at the end of this flight
      if (up) box(st.x0, yTop - 0.3, flightZ0, st.x0 + shaftW, yTop, zF, "stone");
      else if (yTop < st.to - 0.01) box(st.x0, yTop - 0.3, zN, st.x0 + shaftW, yTop, zNear, "stone");
      const a = `${id}-${k}a`, b = `${id}-${k}b`;
      node(a, [x, y, up ? zN - 0.4 : zF + 0.4], "f1");
      node(b, [x, yTop, up ? zF - 0.8 : zN + 0.8], "f1");
      link(prev, a, b);
      prev = b;
      if (k < st.flights - 1) {
        // walk across the landing to the next lane before turning (keeps clear of the divider)
        const c = `${id}-${k}c`;
        node(c, [up ? xB : xA, yTop, up ? zF - 0.8 : zN + 0.8], "f1");
        link(b, c);
        prev = c;
      }
      y = yTop;
      // closed doors on intermediate near landings
      if (!up && yTop < st.to - 0.01 && yTop > st.from + 0.01) closedDoors.push({ p: [xm, yTop, zNear - 0.25], ry: 0, w: 2, h: 2.6 });
    }
    node(`${id}-top`, [xm, st.to, zNear - 1.2], "f1");
    link(prev, `${id}-top`);
  };
  shaft(sb, "sb");
  shaft(sr, "sr");

  // Roof stair house + parapet.
  wall(sr.x0, flightZ0, sr.x0, -64, roof, roof + 3.2, "facade");
  wall(sr.x0 + shaftW, flightZ0, sr.x0 + shaftW, -64, roof, roof + 3.2, "facade");
  wall(sr.x0, -64, sr.x0 + shaftW, -64, roof, roof + 3.2, "facade", [{ c: sr.x0 + shaftW / 2, w: 3, h: 2.6 }]);
  box(sr.x0 - 0.2, roof + 3.2, flightZ0 - 0.2, sr.x0 + shaftW + 0.2, roof + 3.5, -63.8, "roof");
  const para = (x0: number, z0: number, x1: number, z1: number) => wall(x0, z0, x1, z1, roof, roof + 1.1, "facade");
  para(F.x0, F.z1, F.x1, F.z1);
  para(F.x0, F.z0, F.x0, F.z1);
  para(F.x1, F.z0, F.x1, F.z1);
  para(F.x0, F.z0, Rr.x0, F.z0);
  para(Rr.x1, F.z0, F.x1, F.z0);
  para(Rr.x0, Rr.z0, Rr.x0, F.z0);
  para(Rr.x1, Rr.z0, Rr.x1, F.z0);
  para(Rr.x0, Rr.z0, Rr.x1, Rr.z0);

  // Rooftop pavilion "口": a gallery of pillars around an open courtyard.
  const P = PAVILION;
  for (const [x, z] of ringPillars(P.outer.x, P.outer.z0, P.outer.z1, 3)) {
    if (Math.abs(x) < 2.2 || (Math.abs(z - (P.outer.z0 + P.outer.z1) / 2) < 2.2 && Math.abs(Math.abs(x) - P.outer.x) < 0.1)) continue; // openings
    box(x - 0.35, roof, z - 0.35, x + 0.35, roof + 4, z + 0.35, "facade");
  }
  for (const [x, z] of ringPillars(P.court.x, P.court.z0, P.court.z1, 3)) {
    if (Math.abs(x) < 2 || Math.abs(z - (P.court.z0 + P.court.z1) / 2) < 2) continue;
    box(x - 0.3, roof, z - 0.3, x + 0.3, roof + 4, z + 0.3, "facade");
  }
  // gallery roof (visual) with courtyard opening
  holes(-P.outer.x - 1, P.outer.x + 1, P.outer.z0 - 1, P.outer.z1 + 1, -P.court.x, P.court.x, P.court.z0, P.court.z1, roof + 4, roof + 4.5, "roof");
  // flagpole collider
  box(-0.25, roof, -23.25, 0.25, roof + 12, -22.75, "metal", true, { visible: false });

  // ------------------------------------------------- furniture & exhibit footprints
  const prop = (x: number, y: number, z: number, hx: number, hy: number, hz: number, ry = 0) =>
    boxes.push({ p: [x, y, z], s: [hx * 2, hy * 2, hz * 2], m: "dark", collide: true, visible: false, ry });
  {
    const Fu = FURNITURE, y = Fu.y;
    prop(Fu.cabTable.x, y + 0.5, Fu.cabTable.z, 6.6, 0.5, 2.6);
    for (const c of Fu.cabChairs) prop(c.x, y + 0.5, c.z, 0.32, 0.5, 0.32);
    for (const [x, z] of Fu.hallColumns) prop(x, y + 2.35, z, 0.45, 2.3, 0.45);
    for (const p of Fu.credSeats) {
      const { w, d } = seatSize(p.seats);
      prop(p.x, y + 0.5, p.z, d / 2, 0.5, (w + 0.8) / 2);
    }
    for (const [x, z] of Fu.credTables) prop(x, y + 0.3, z, 0.38, 0.3, 0.63);
    for (const [x, z] of Fu.credVases) prop(x, y + 1, z, 0.3, 1, 0.3);
    prop(Fu.credDesk.x, y + 0.4, Fu.credDesk.z, Fu.credDesk.w / 2, 0.4, Fu.credDesk.d / 2);
    // basement (simulated) desks and table
    for (let i = 0; i < 3; i++) prop(-17.5, LEVEL.basement + 0.6, -54 + i * 4.5, 0.7, 0.6, 1.5);
    prop(10, LEVEL.basement + 0.5, -50, 2, 0.5, 1);
    // grounds: fountain basin, exhibits, octagon, exhibition house
    prop(GROUNDS.lawnCenter[0], 0.3, GROUNDS.lawnCenter[1], 5.4, 0.3, 5.4);
    prop(GROUNDS.lawnCenter[0], 0.3, GROUNDS.lawnCenter[1], 5.4, 0.3, 5.4, Math.PI / 4);
    prop(76, 1.2, 116, 1.8, 1.2, 3.3, 0.6);
    prop(86, 1.2, 106, 1.8, 1.2, 3.3, 0.4);
    prop(106, 1.5, 84, 3.5, 1.5, 7, -0.5);
    prop(176, 0.6, 126, 4.5, 0.6, 4.5);
    prop(-170, 4, 58, 6, 4, 13);
  }

  // ----------------------------------------------------------------- basement
  box(Rr.x0, bas - 0.3, Rr.z0, Rr.x1, bas, Rr.z1, "concrete");
  wall(Rr.x0, F.z0, Rr.x1, F.z0, bas, f1 - 0.3, "basementWall");
  wall(Rr.x0, -40, Rr.x1, -40, bas, f1 - 0.3, "basementWall");
  wall(Rr.x0, -60, Rr.x1, -60, bas, f1 - 0.3, "basementWall", [{ c: -10.5, w: 2.4, h: 2.6 }, { c: 10.5, w: 2.4, h: 2.6 }]);
  wall(-1, -60, -1, -40, bas, f1 - 0.3, "basementWall");
  wall(1, -60, 1, -40, bas, f1 - 0.3, "basementWall");
  wall(Rr.x0, -64, Rr.x1, -64, bas, f1 - 0.3, "basementWall", [{ c: sb.x0 + shaftW / 2, w: 4.0, h: 2.8 }]);

  // ------------------------------------------------------------- nav graph
  // Grounds: gate → drive → ring around the lawn → forecourt → steps.
  node("gate", [0, 0, GROUNDS.gateZ - 10], "grounds");
  const ringN = 16;
  for (let i = 0; i < ringN; i++) {
    const a = (i / ringN) * Math.PI * 2;
    node(`ring${i}`, [GROUNDS.lawnCenter[0] + Math.cos(a) * GROUNDS.ringRadius, 0, GROUNDS.lawnCenter[1] + Math.sin(a) * GROUNDS.ringRadius], "grounds");
    if (i > 0) link(`ring${i - 1}`, `ring${i}`);
  }
  link(`ring${ringN - 1}`, "ring0");
  link("gate", `ring${ringN / 4}`); // a = 90° → toward the gate (+z)
  node("forecourt", [0, 0, 8], "grounds");
  link(`ring${(ringN * 3) / 4}`, "forecourt"); // a = 270° → toward the palace
  node("pondL", [-24, 0, 4], "grounds");
  node("pondR", [24, 0, 4], "grounds");
  link(`ring${11}`, "pondL");
  link(`ring${13}`, "pondR");
  node("stepsBottom", [0, 0, stepTopZ + stepRun + 1], "grounds");
  node("stepsTop", [0, f1, stepTopZ - 1], "f1");
  link("forecourt", "stepsBottom", "stepsTop");
  // Exhibits around the lawn
  node("exTanks", [78, 0, 96], "grounds");
  node("exF5e", [100, 0, 92], "grounds");
  link(`ring${1}`, "exTanks", "exF5e", `ring0`);
  node("octagon", [170, 0, 122], "grounds");
  link("exTanks", "octagon");
  node("exhibition", [-150, 0, 58], "grounds");
  link(`ring${ringN / 2}`, "exhibition");

  // Ground floor
  node("door", [0, f1, F.z1 - 1.5], "f1");
  node("hall", [0, f1, -22], "f1");
  node("cabDoor", [16, f1, -22.5], "f1");
  node("cabinet", [23, f1, -21.5], "f1");
  node("cabinetN", [25, f1, -16.5], "f1");
  node("cabinet2", [32, f1, -16], "f1");
  link("stepsTop", "door", "hall", "cabDoor", "cabinet", "cabinetN", "cabinet2");
  node("credDoor", [0, f1, F.z0 - 1], "f1");
  node("cred", [0, f1, -46], "f1");
  node("cred2", [8.5, f1, -56], "f1");
  node("corrDoor", [8.5, f1, -61], "f1");
  node("corr", [0, f1, -62], "f1");
  node("corrE", [sr.x0 + shaftW / 2, f1, -62], "f1");
  node("corrW", [sb.x0 + shaftW / 2, f1, -62], "f1");
  link("hall", "credDoor", "cred", "cred2", "corrDoor", "corr");
  link("corrDoor", "corrE");
  link("corr", "corrW");
  link("corrE", "sr-0");
  link("corrW", "sb-top");

  // Basement
  node("bCorrW", [sb.x0 + shaftW / 2, bas, -62], "basement");
  node("bCorr", [0, bas, -62], "basement");
  node("bCorrE", [10.5, bas, -62], "basement");
  node("bCommsDoor", [-10.5, bas, -59], "basement");
  node("bComms", [-9, bas, -51], "basement");
  node("bMapsDoor", [10.5, bas, -59], "basement");
  node("bMaps", [6, bas, -50], "basement");
  link("sb-0", "bCorrW", "bCorr", "bCorrE", "bMapsDoor", "bMaps");
  link("bCorrW", "bCommsDoor", "bComms");

  // Roof
  node("roofExit", [sr.x0 + shaftW / 2, roof, -61], "roof");
  node("roofRear", [0, roof, -50], "roof");
  node("roofBack", [0, roof, -36], "roof");
  node("pavBack", [0, roof, P.outer.z0 - 1], "roof");
  node("court", [1.6, roof, -26], "roof");
  node("flag", [1.6, roof, -20.5], "roof");
  node("roofFront", [0, roof, F.z1 - 1.8], "roof");
  link("sr-top", "roofExit", "roofRear", "roofBack", "pavBack", "court", "flag", "roofFront");

  // Fix floor tags for stair nodes by height.
  for (const n of nodes) {
    if (n.id.startsWith("sb") || n.id.startsWith("sr")) n.floor = n.p[1] < 0 ? "basement" : n.p[1] > roof - 1 ? "roof" : "f1";
  }

  return { boxes, steps, nav: { nodes, edges }, closedDoors, trees: plantTrees(nodes, edges) };
}

/** Old trees around the grounds, kept off the lawn, drives, palace and exhibits. */
function plantTrees(nodes: NavNode[], edges: NavEdge[]): Tree[] {
  // keep trunks off the walking graph's ground-level paths
  const byId = new Map(nodes.map((n) => [n.id, n.p]));
  const paths = edges.map(([a, b]) => [byId.get(a)!, byId.get(b)!]).filter(([a, b]) => a[1] < 0.5 && b[1] < 0.5);
  const nearPath = (x: number, z: number) =>
    paths.some(([a, b]) => {
      const dx = b[0] - a[0], dz = b[2] - a[2], l2 = dx * dx + dz * dz;
      const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / l2)) : 0;
      return Math.hypot(a[0] + dx * t - x, a[2] + dz * t - z) < 4.5;
    });
  const [cx, cz] = GROUNDS.lawnCenter;
  const R = rng(1966);
  const out: Tree[] = [];
  const n = 300;
  let tries = 0;
  while (out.length < n && tries < n * 20) {
    tries++;
    const x = (R() * 2 - 1) * (GROUNDS.halfW - 6), z = (R() * 2 - 1) * (GROUNDS.halfD - 6);
    if (Math.hypot(x - cx, z - cz) < GROUNDS.ringRadius + GROUNDS.ringWidth / 2 + 5) continue; // lawn + ring drive
    if (Math.abs(x) < 58 && z > -98 && z < 30) continue; // palace + forecourt
    if (Math.abs(x) < 13 && z > 60) continue; // gate drive
    if (Math.hypot(x - 90, z - 100) < 28) continue; // outdoor exhibits
    if (Math.hypot(x - 176, z - 126) < 11) continue; // octagon
    if (Math.hypot(x + 160, z - 58) < 24) continue; // exhibition house
    if (Math.abs(z + 128) < 22 && Math.abs(x) < 72) continue; // tennis courts
    if (nearPath(x, z)) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 7.5)) continue;
    out.push({ x, z, s: 0.8 + R() * 0.9, h: R() });
  }
  return out;
}

function ringPillars(halfX: number, z0: number, z1: number, step: number): [number, number][] {
  const out: [number, number][] = [];
  for (let x = -halfX; x <= halfX + 0.01; x += step) {
    out.push([x, z0], [x, z1]);
  }
  for (let z = z0 + step; z < z1 - 0.01; z += step) {
    out.push([-halfX, z], [halfX, z]);
  }
  return out;
}
