import { GROUNDS, LEVEL, PALACE, PAVILION, STAIRS } from "@/data/dinh/layout";
import { CEIL_F2, CEIL_OFFICE, COURT, CREAM, OFFICE, PRES, R2, R2_DOORS, RED, VP } from "@/data/dinh/rooms2";
import { rng } from "@/lib/geo";
import type { FloorId, NavEdge, NavNode, Vec3 } from "@/types";

/**
 * Generates the walkable Independence Palace from data/dinh/layout.ts:
 * render boxes, physics colliders and the guide's navigation graph all come
 * from the same primitives, so what you see is what you collide with.
 */

export type Mat =
  | "facade" | "wall" | "floor" | "wood" | "stone" | "glass" | "concrete"
  | "path" | "roof" | "dark" | "metal" | "curtain" | "gold" | "door" | "lacquer" | "paper" | "fabric" | "basementWall" | "runner";

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
  // Phòng Trình Quốc thư (floor 2), after DDLP_0021/0030/0123: desk before the
  // lacquer painting, cream sofas and armchairs facing each other, burl tables, four
  // tall bronze vases. Positions are estimates from the photos.
  const f2 = LEVEL.f2;
  const credSeats: { x: number; z: number; seats: number; side: 1 | -1 }[] = [];
  for (const side of [1, -1] as const) credSeats.push({ x: side * 4.9, z: -20.5, seats: 3, side }, { x: side * 4.6, z: -16.4, seats: 1, side });
  // Phòng Đại yến (floor 1, left of the hall), after DDLP_0018/0118/0141: one long table
  // on the room's axis toward the painting, high-back chairs, vases on carved pedestals.
  const dyChairs: { x: number; z: number; ry: number }[] = [];
  for (let k = 0; k < 18; k++) {
    const x = -40.2 + k * 1.0;
    dyChairs.push({ x, z: -23 - 1.25, ry: 0 }, { x, z: -23 + 1.25, ry: Math.PI });
  }
  // Phòng Khánh tiết (behind the central staircase), after DDLP_0079/0105/0240: sofas
  // in damask along both long walls with low tables, a stage at the far end.
  const ktSofas: { x: number; z: number; seats: number; side: 1 | -1 }[] = [];
  for (const side of [1, -1] as const) for (const z of [-47.6, -51.2, -54.8]) ktSofas.push({ x: side * 11.6, z, seats: 3, side });
  return {
    y,
    f2,
    cabTable: { x: 32, z: -23, rx: 6.6, rz: 2.5 },
    cabChairs,
    credSeats,
    credTables: [-20.5].flatMap((z) => [[2.7, z], [-2.7, z]] as [number, number][]),
    credVases: [[5.9, -12.9], [-5.9, -12.9], [6.2, -17.6], [-6.2, -17.6]] as [number, number][],
    credDesk: { x: 0, z: -14.6, w: 3.4, d: 1.1 },
    dyTable: { x0: -40.8, x1: -22.6, z: -23, w: 1.7 },
    dyChairs,
    dyPedestals: [-41, -35, -29, -23, -19].flatMap((x) => [[x, -10.9], [x, -35.1]] as [number, number][]),
    dySideboard: { x: -44.3, z: -23, l: 7.4, d: 0.6 },
    ktSofas,
    ktTables: ktSofas.map((p) => [p.side * 10.1, p.z] as [number, number]),
    ktStage: { x0: -8, x1: 6, z0: -60, z1: -57.6, h: 0.45 },
    // central staircase (DDLP_0066, 0239): a wide central flight rising away from the hall to a
    // half landing, then two side flights turning back up to floor 2 (dimensions estimated)
    stair: { x0: -2.2, x1: 2.2, z0: -36, z1: -40.5 },
    stairSide: { xi: 2.6, xo: 5.0 },
    stairLanding: { z0: -40.5, z1: -43.8, y: LEVEL.f1 + 2.5 },
    stairWell: { x0: -5.4, x1: 5.4, z0: -36, z1: -44 },
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
  // front: wrought-iron railing on a low base (drawn by the Gate component, DDLP_0074, 0189, 0192); these are its colliders
  wall(-GROUNDS.halfW, GROUNDS.halfD, -gw, GROUNDS.halfD, 0, 2.6, "stone", [], false);
  wall(gw, GROUNDS.halfD, GROUNDS.halfW, GROUNDS.halfD, 0, 2.6, "stone", [], false);
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
  // hall | Phòng Đại yến (left of the hall, official description)
  wall(-16, F.z0, -16, F.z1, f1, ceilF1, "wall", [{ c: -22.5, w: 4, h: 3.2 }]);
  // Hall ↔ central staircase: a wide opening, the staircase is straight ahead of the entrance.
  wall(Rr.x0, F.z0, Rr.x1, F.z0, f1, ceilF1, "wall", [{ c: 0, w: 17, h: 4.4 }]);
  // Above floor 1 on the same line: closed beside the floor-2 lobby (which spans it).
  box(Rr.x0, ceilF1, F.z0 - T / 2, -13, H, F.z0 + T / 2, "facade", true, { visible: false });
  box(13, ceilF1, F.z0 - T / 2, Rr.x1, H, F.z0 + T / 2, "facade", true, { visible: false });
  // Behind the staircase: Phòng Khánh tiết, entered by two doors on either side of it.
  wall(-13, -44, 13, -44, f1, ceilF1, "wall", [{ c: -9, w: 2.4, h: 3 }, { c: 9, w: 2.4, h: 3 }]);

  // Floor-1 ceiling slab (front block), open over the first part of the central staircase.
  const ST = FURNITURE.stair;
  box(F.x0, ceilF1, F.z0, F.x1, ceilF1 + 0.3, F.z1, "wall"); // the stairwell lies behind it, in the rear wing

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
    { c: COURT.door.x, w: COURT.door.w, h: COURT.door.h }, // to the inner courtyard
  ]);

  // Slabs of the rear wing.
  /** Rectangular slab with any number of rectangular holes (grid decomposition, rows merged). */
  const slab = (x0: number, x1: number, z0: number, z1: number, hs: { x0: number; x1: number; z0: number; z1: number }[], y0: number, y1: number, m: Mat) => {
    const xs = [...new Set([x0, x1, ...hs.flatMap((h) => [h.x0, h.x1])])].filter((v) => v >= x0 && v <= x1).sort((a, b) => a - b);
    const zs = [...new Set([z0, z1, ...hs.flatMap((h) => [h.z0, h.z1])])].filter((v) => v >= z0 && v <= z1).sort((a, b) => a - b);
    for (let j = 0; j < zs.length - 1; j++) {
      let run: number | null = null;
      for (let i = 0; i <= xs.length - 1; i++) {
        const solid = i < xs.length - 1 && !hs.some((h) => (xs[i] + xs[i + 1]) / 2 > h.x0 && (xs[i] + xs[i + 1]) / 2 < h.x1 && (zs[j] + zs[j + 1]) / 2 > h.z0 && (zs[j] + zs[j + 1]) / 2 < h.z1);
        if (solid && run === null) run = xs[i];
        if (!solid && run !== null) {
          box(run, y0, zs[j], xs[i], y1, zs[j + 1], m);
          run = null;
        }
      }
    }
  };
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
  // Floor-1 ceiling / floor-2 floor (rear wing): holes over the central staircase and the roof shaft.
  slab(Rr.x0, Rr.x1, Rr.z0, Rr.z1, [
    { x0: FURNITURE.stairWell.x0, x1: FURNITURE.stairWell.x1, z0: FURNITURE.stairWell.z1, z1: FURNITURE.stairWell.z0 },
    { x0: sr.x0, x1: sr.x0 + shaftW, z0: flightZ0, z1: -64 },
    COURT.open, // the courtyard is open to the sky
  ], ceilF1, ceilF1 + 0.3, "wall");
  // Roof slab over the rear wing: hole over the roof shaft flights (top landing stays).
  slab(Rr.x0, Rr.x1, Rr.z0, Rr.z1, [{ x0: sr.x0, x1: sr.x0 + shaftW, z0: flightZ0, z1: nearLand }, COURT.open], roof - 0.3, roof, "roof");

  // ------------------------------------------------- inner courtyard (giếng trời)
  {
    const C = COURT, G = C.gallery, O = C.open, f2 = LEVEL.f2;
    // gallery back walls on both storeys (the rooms behind them are not modelled: closed doors)
    wall(G.x0, G.z0, G.x0, G.z1, f1, roof - 0.3, "wall");
    wall(G.x1, G.z0, G.x1, G.z1, f1, roof - 0.3, "wall");
    wall(G.x0, G.z1, C.passage.x0, G.z1, ceilF1, roof - 0.3, "wall");
    wall(C.passage.x1, G.z1, G.x1, G.z1, ceilF1, roof - 0.3, "wall");
    wall(C.passage.x0, G.z1, C.passage.x1, G.z1, f2, roof - 0.3, "wall"); // upper gallery, north side
    for (const z of [-84, -78]) for (const x of [G.x0 + 0.25, G.x1 - 0.25]) {
      closedDoors.push({ p: [x, f1, z], ry: Math.PI / 2, w: 1.8, h: 2.6 });
      closedDoors.push({ p: [x, f2, z], ry: Math.PI / 2, w: 1.6, h: 2.4 });
    }
    // square columns round the opening, ground floor and upper gallery
    const ring: [number, number][] = [];
    for (let x = O.x0; x <= O.x1 + 0.01; x += C.columnStep) ring.push([x, O.z0], [x, O.z1]);
    for (let z = O.z0 + C.columnStep; z < O.z1 - 0.01; z += C.columnStep + 1) ring.push([O.x0, z], [O.x1, z]);
    for (const [x, z] of ring) {
      box(x - 0.3, f1, z - 0.3, x + 0.3, ceilF1, z + 0.3, "stone");
      box(x - 0.22, f2, z - 0.22, x + 0.22, roof - 0.3, z + 0.22, "wall");
    }
    // solid white parapet of the upper gallery round the opening (DDLP_0039, 0171)
    const par = (x0: number, z0: number, x1: number, z1: number) => box(Math.min(x0, x1) - 0.12, f2, Math.min(z0, z1) - 0.12, Math.max(x0, x1) + 0.12, f2 + 1.05, Math.max(z0, z1) + 0.12, "wall");
    par(O.x0, O.z0, O.x1, O.z0);
    par(O.x0, O.z1, O.x1, O.z1);
    par(O.x0, O.z0, O.x0, O.z1);
    par(O.x1, O.z0, O.x1, O.z1);
    // slab edge beams (white fascia) at both floors
    for (const y of [ceilF1 - 0.45, roof - 0.75]) {
      box(O.x0 - 0.15, y, O.z0 - 0.15, O.x1 + 0.15, y + 0.45, O.z0 + 0.15, "wall", false);
      box(O.x0 - 0.15, y, O.z1 - 0.15, O.x1 + 0.15, y + 0.45, O.z1 + 0.15, "wall", false);
    }
    // the opening on the roof: parapet (the terrace stays safe)
    for (const [ax, az, bx, bz] of [[O.x0, O.z0, O.x1, O.z0], [O.x0, O.z1, O.x1, O.z1], [O.x0, O.z0, O.x0, O.z1], [O.x1, O.z0, O.x1, O.z1]]) wall(ax, az, bx, bz, roof, roof + 1.1, "facade");
  }
  // Roof slab over the front block.
  box(F.x0, roof - 0.3, F.z0, F.x1, roof, F.z1, "roof");
  // Solid mass of the rear wing above the ground floor (not walkable in the MVP).
  // Closed by the slabs above; nothing to add.

  // --------------------------------------------------- central staircase (floor 1 → 2)
  // Visible flight with balustrades (DDLP_0066, 0239: red runner, dark rails, white
  // posts). The floors are separate spaces: a rope barrier closes the foot and the
  // way up is the F interaction there (data/dinh/interactions.ts).
  {
    const f2 = LEVEL.f2, Lg = FURNITURE.stairLanding, SDs = FURNITURE.stairSide, n = 15;
    /** One straight flight: open dark-wood treads with the red runner and a brass rod at each nose (DDLP_0239), a ramp collider, stringers, handrails on slender balusters. */
    const flight = (x0: number, x1: number, zLow: number, zHigh: number, yLow: number, yHigh: number, rails: number[]) => {
      const run = Math.abs(zHigh - zLow), rise = yHigh - yLow, dir = Math.sign(zHigh - zLow); // +1: rises toward +z
      const w = x1 - x0, cx = (x0 + x1) / 2;
      for (let i = 0; i < n; i++) {
        const sy = yLow + (rise / n) * (i + 1);
        const za = zLow + dir * (run / n) * i, zb = zLow + dir * (run / n) * (i + 1);
        const zc = (za + zb) / 2, d = run / n + 0.03;
        steps.push({ p: [cx, sy - 0.04, zc], s: [w, 0.08, d], m: "wood", collide: false });
        steps.push({ p: [cx, sy + 0.005, zc], s: [w - 0.9, 0.012, d], m: "runner", collide: false });
        steps.push({ p: [cx, sy + 0.03, za + dir * 0.05], s: [w - 0.8, 0.025, 0.025], m: "gold", collide: false });
      }
      const len = Math.hypot(run, rise), ang = Math.atan2(rise, run) * -dir;
      const zm = (zLow + zHigh) / 2, ym = (yLow + yHigh) / 2;
      boxes.push({ p: [cx, ym - 0.15, zm], s: [w, 0.3, len], rx: ang, m: "stone", collide: true, visible: false });
      for (const sx of [x0 + 0.12, x1 - 0.12]) boxes.push({ p: [sx, ym - 0.32, zm], s: [0.16, 0.36, len], rx: ang, m: "wood", collide: false });
      for (const rx of rails) {
        boxes.push({ p: [rx, ym + 0.95, zm], s: [0.1, 0.08, len], rx: ang, m: "wood", collide: false });
        boxes.push({ p: [rx, ym + 0.5, zm], s: [0.12, 1.1, len], rx: ang, m: "metal", collide: true, visible: false });
        for (let k = 0; k <= 10; k++) {
          const t = k / 10;
          boxes.push({ p: [rx, yLow + rise * t + 0.47, zLow + (zHigh - zLow) * t], s: [0.03, 0.94, 0.03], m: "metal", collide: false });
        }
      }
    };
    // central flight: hall floor → half landing
    flight(ST.x0, ST.x1, ST.z0, ST.z1, f1, Lg.y, [ST.x0 - 0.06, ST.x1 + 0.06]);
    // half landing against the Khánh tiết wall, solid underneath
    box(-SDs.xo - 0.2, Lg.y - 0.3, Lg.z1, SDs.xo + 0.2, Lg.y, Lg.z0, "wood");
    box(-SDs.xo - 0.2, f1, Lg.z1, SDs.xo + 0.2, Lg.y - 0.3, Lg.z0 + 0.2, "wall");
    steps.push({ p: [0, Lg.y + 0.006, (Lg.z0 + Lg.z1) / 2], s: [2 * SDs.xo - 0.6, 0.012, Lg.z0 - Lg.z1 - 0.5], m: "runner", collide: false });
    for (const s of [-1, 1]) box(s * (SDs.xo + 0.2) - 0.06, Lg.y, Lg.z1, s * (SDs.xo + 0.2) + 0.06, Lg.y + 1.1, Lg.z0, "metal", true, { visible: false });
    // two side flights turning back up to floor 2
    flight(SDs.xi, SDs.xo, Lg.z0, ST.z0, Lg.y, f2, [SDs.xi + 0.06, SDs.xo - 0.06]);
    flight(-SDs.xo, -SDs.xi, Lg.z0, ST.z0, Lg.y, f2, [-SDs.xi - 0.06, -SDs.xo + 0.06]);
    // floor-2 lobby: walls, ceiling, railings round the stairwell, barrier at the head
    const lob = { x0: -13, x1: 13, z0: -46, z1: -31 };
    const cl = f2 + 4.7;
    wall(lob.x0, lob.z0, lob.x0, lob.z1, f2, cl, "wall");
    wall(lob.x1, lob.z0, lob.x1, lob.z1, f2, cl, "wall");
    wall(lob.x0, lob.z0, lob.x1, lob.z0, f2, cl, "wall", [{ c: R2_DOORS.lobbyOffice.x, w: R2_DOORS.lobbyOffice.w, h: R2_DOORS.lobbyOffice.h }]); // door to the office
    box(lob.x0, cl, lob.z0, lob.x1, cl + 0.3, lob.z1, "wall");
    // front-block part of the lobby floor (the front ceiling slab stops at F.z0 beside the stair)
    // balustrade round the stairwell (open over the central flight and the landing)
    const W = FURNITURE.stairWell, SD = FURNITURE.stairSide;
    const rail = (x0: number, z0: number, x1: number, z1: number) => {
      box(Math.min(x0, x1) - 0.05, f2 + 0.98, Math.min(z0, z1) - 0.05, Math.max(x0, x1) + 0.05, f2 + 1.06, Math.max(z0, z1) + 0.05, "wood", false);
      box(Math.min(x0, x1) - 0.06, f2, Math.min(z0, z1) - 0.06, Math.max(x0, x1) + 0.06, f2 + 1.1, Math.max(z0, z1) + 0.06, "metal", true, { visible: false });
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 0.3);
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n, z = z0 + ((z1 - z0) * k) / n;
        boxes.push({ p: [x, f2 + 0.49, z], s: [0.03, 0.98, 0.03], m: "metal", collide: false });
      }
    };
    rail(-SD.xi, W.z0, SD.xi, W.z0);
    rail(W.x0, W.z1, W.x1, W.z1);
    rail(W.x0, W.z1, W.x0, W.z0);
    rail(W.x1, W.z1, W.x1, W.z0);
    // Phòng Trình Quốc thư (estimated position on floor 2, in front of the lobby)
    const tq = { x0: -7, x1: 7, z0: -31, z1: -12 };
    const tc = f2 + 6.2; // tall enough for the 4.70 m painting
    wall(tq.x0, tq.z0, tq.x1, tq.z0, f2, cl, "wall", [{ c: 5, w: 2.4, h: 3.2 }]);
    // beside the Credentials Room: doors to the two reception rooms of the front block
    wall(lob.x0, tq.z0, tq.x0, tq.z0, f2, cl, "wall", [{ c: R2_DOORS.lobbyPres.x, w: R2_DOORS.lobbyPres.w, h: R2_DOORS.lobbyPres.h }]);
    wall(tq.x1, tq.z0, lob.x1, tq.z0, f2, cl, "wall", [{ c: R2_DOORS.lobbyVp.x, w: R2_DOORS.lobbyVp.w, h: R2_DOORS.lobbyVp.h }]);
    wall(tq.x0, tq.z0, tq.x0, tq.z1, f2, tc, "wall");
    wall(tq.x1, tq.z0, tq.x1, tq.z1, f2, tc, "wall");
    wall(tq.x0, tq.z1, tq.x1, tq.z1, f2, tc, "wall");
    box(tq.x0, tc, tq.z0, tq.x1, tc + 0.3, tq.z1, "wall");

    // ---- floor-2 reception rooms and office (data/dinh/rooms2.ts; positions estimated)
    const D = R2_DOORS, op = (d: { w: number; h: number }, c: number) => [{ c, w: d.w, h: d.h }];
    const P = R2.presReception, Rd = R2.redReception, V = R2.vpReception, C = R2.creamReception, O = R2.office;
    // west: Tiếp khách Tổng thống (lobby door in the line above) | red-chair room
    wall(P.x0, P.z0, lob.x0, P.z0, f2, CEIL_F2, "wall");
    wall(tq.x0, tq.z1, tq.x0, F.z1, f2, CEIL_F2, "wall");
    wall(P.x0, Rd.z0, P.x0, Rd.z1, f2, CEIL_F2, "wall", op(D.presRed, D.presRed.z));
    box(P.x0, CEIL_F2, P.z0, P.x1, CEIL_F2 + 0.3, P.z1, "wall");
    box(Rd.x0, CEIL_F2, Rd.z0, Rd.x1, CEIL_F2 + 0.3, Rd.z1, "wall");
    // east: long reception room | cream-armchair room
    wall(lob.x1, V.z0, V.x1, V.z0, f2, CEIL_F2, "wall");
    wall(tq.x1, tq.z1, tq.x1, F.z1, f2, CEIL_F2, "wall");
    wall(V.x1, C.z0, V.x1, C.z1, f2, CEIL_F2, "wall", op(D.vpCream, D.vpCream.z));
    box(V.x0, CEIL_F2, V.z0, V.x1, CEIL_F2 + 0.3, V.z1, "wall");
    box(C.x0, CEIL_F2, C.z0, C.x1, CEIL_F2 + 0.3, C.z1, "wall");
    // the strips behind the two inner rooms (front block, z −36 … −31) stay closed
    wall(P.x0, F.z0, lob.x0, F.z0, f2, CEIL_F2, "wall");
    wall(lob.x1, F.z0, V.x1, F.z0, f2, CEIL_F2, "wall");
    // office behind the lobby (rear wing)
    wall(O.x0, O.z0, O.x0, O.z1, f2, CEIL_OFFICE, "wall");
    wall(O.x1, O.z0, O.x1, O.z1, f2, CEIL_OFFICE, "wall");
    wall(O.x0, O.z0, O.x1, O.z0, f2, CEIL_OFFICE, "wall");
    box(O.x0, CEIL_OFFICE, O.z0, O.x1, CEIL_OFFICE + 0.3, O.z1, "wall");
  }

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
    const y2 = Fu.f2;
    for (const p of Fu.credSeats) {
      const { w, d } = seatSize(p.seats);
      prop(p.x, y2 + 0.5, p.z, d / 2 + 0.1, 0.5, (w + 0.9) / 2);
    }
    for (const [x, z] of Fu.credTables) prop(x, y2 + 0.3, z, 0.45, 0.3, 0.9);
    for (const [x, z] of Fu.credVases) prop(x, y2 + 1, z, 0.35, 1, 0.35);
    prop(Fu.credDesk.x, y2 + 0.4, Fu.credDesk.z, Fu.credDesk.w / 2 + 0.4, 0.4, Fu.credDesk.d / 2 + 0.6);
    // floor-2 reception rooms and office
    for (const s of PRES.sofas) prop(s.x, y2 + 0.45, s.z, 0.55, 0.45, 1.4);
    for (const s of [...PRES.armchairs, ...PRES.sideChairs, ...RED.chairs, ...VP.rows, ...VP.endChairs, ...CREAM.armchairs]) prop(s.x, y2 + 0.45, s.z, 0.38, 0.45, 0.38);
    for (const t of [...PRES.lowTables, ...VP.tables, ...CREAM.tables]) prop(t.x, y2 + 0.25, t.z, 0.55, 0.25, 0.55);
    for (const c of PRES.cabinets) prop(c.x, y2 + 1, c.z, 0.9, 1, 0.4);
    prop(PRES.throne.x, y2 + 0.6, PRES.throne.z, 1.4, 0.6, 0.5);
    for (const v of [...PRES.vases, ...RED.vases, ...VP.vases, ...CREAM.vases]) prop(v.x, y2 + 0.8, v.z, 0.32, 0.8, 0.32);
    prop(RED.desk.x, y2 + 0.4, RED.desk.z, RED.desk.w / 2, 0.4, RED.desk.d / 2);
    prop(RED.roundTable.x, y2 + 0.38, RED.roundTable.z, 0.9, 0.38, 0.9);
    prop(OFFICE.desk.x, y2 + 0.4, OFFICE.desk.z, OFFICE.desk.w / 2, 0.4, OFFICE.desk.d / 2);
    // Phòng Đại yến
    prop((Fu.dyTable.x0 + Fu.dyTable.x1) / 2, y + 0.4, Fu.dyTable.z, (Fu.dyTable.x1 - Fu.dyTable.x0) / 2, 0.4, Fu.dyTable.w / 2);
    for (const c of Fu.dyChairs) prop(c.x, y + 0.5, c.z, 0.25, 0.5, 0.25);
    for (const [x, z] of Fu.dyPedestals) prop(x, y + 0.6, z, 0.4, 0.6, 0.4);
    prop(Fu.dySideboard.x, y + 0.45, Fu.dySideboard.z, Fu.dySideboard.d / 2, 0.45, Fu.dySideboard.l / 2);
    // Phòng Khánh tiết
    for (const p of Fu.ktSofas) {
      const { w } = seatSize(p.seats);
      prop(p.x, y + 0.45, p.z, 0.5, 0.45, (w + 0.9) / 2);
    }
    for (const [x, z] of Fu.ktTables) prop(x, y + 0.25, z, 0.45, 0.25, 0.8);
    { const st = Fu.ktStage; prop((st.x0 + st.x1) / 2, y + st.h / 2, (st.z0 + st.z1) / 2, (st.x1 - st.x0) / 2, st.h / 2, (st.z1 - st.z0) / 2); }
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
  // Đại yến (left)
  node("dyDoor", [-16, f1, -22.5], "f1");
  node("dy", [-20, f1, -20.4], "f1");
  node("dy2", [-34, f1, -20.4], "f1");
  link("hall", "dyDoor", "dy", "dy2");
  // central staircase bay and Khánh tiết behind it
  // the staircase blocks the middle of the bay: go round it on either side, between the columns
  node("stairFoot", [0, f1, FURNITURE.stair.z0 + 1.6], "f1");
  // up the central flight, across the landing, up a side flight to floor 2 (walked, no door)
  {
    const Lg = FURNITURE.stairLanding, SDs = FURNITURE.stairSide, xm = (SDs.xi + SDs.xo) / 2;
    node("stLand", [0, Lg.y, -42.2], "f1");
    link("stairFoot", "stLand");
    for (const [s, k] of [[1, "E"], [-1, "W"]] as const) {
      node(`stSide${k}`, [s * xm, Lg.y, -42.0], "f1");
      node(`stTop${k}`, [s * xm, LEVEL.f2, FURNITURE.stair.z0 + 0.4], "f2");
      node(`stOut${k}`, [s * xm, LEVEL.f2, FURNITURE.stair.z0 + 1.4], "f2");
      link("stLand", `stSide${k}`, `stTop${k}`, `stOut${k}`);
    }
  }
  link("hall", "stairFoot");
  node("hallW", [-7, f1, -24], "f1");
  node("hallE", [7, f1, -24], "f1");
  node("credDoor", [7, f1, F.z0 - 1], "f1");
  node("credDoorW", [-7, f1, F.z0 - 1], "f1");
  node("ktDoorW", [-9, f1, -44], "f1");
  node("ktDoorE", [9, f1, -44], "f1");
  node("bayW", [-9, f1, -40], "f1");
  node("bayE", [9, f1, -40], "f1");
  link("hall", "hallE", "credDoor", "bayE", "ktDoorE");
  link("hall", "hallW", "credDoorW", "bayW", "ktDoorW");
  node("cred", [0, f1, -50], "f1");
  node("cred2", [8.5, f1, -56], "f1");
  link("ktDoorW", "cred");
  link("ktDoorE", "cred");
  node("corrDoor", [8.5, f1, -61], "f1");
  // floor 2: lobby → Credentials Room
  node("lobby", [8, LEVEL.f2, -40.5], "f2"); // beside the stairwell
  node("lobbyE", [5, LEVEL.f2, -33], "f2");
  node("tqDoor", [5, LEVEL.f2, -31], "f2");
  node("tq", [0, LEVEL.f2, -24], "f2");
  link("lobby", "lobbyE", "tqDoor", "tq");
  // floor 2: lobby → reception rooms and office (through their doors)
  const f2y = LEVEL.f2, D2 = R2_DOORS;
  node("lobbyW", [-5, f2y, -33], "f2");
  node("presDoor", [D2.lobbyPres.x, f2y, D2.lobbyPres.z], "f2");
  node("presIn", [D2.lobbyPres.x, f2y, -27.5], "f2"); // clear of the lacquer cabinet beside the door
  node("pres", [PRES.cx, f2y, -25.5], "f2");
  node("pres2", [PRES.cx - 3, f2y, -20.5], "f2");
  node("redDoor", [D2.presRed.x, f2y, D2.presRed.z], "f2");
  node("red", [RED.cx, f2y, -22], "f2");
  node("lobbyS", [6, f2y, -45], "f2"); // behind the stairwell
  node("lobbySS", [-6, f2y, -45], "f2");
  node("lobbySW", [-8, f2y, -40.5], "f2");
  link("lobby", "lobbyS", "lobbySS", "lobbySW");
  link("stOutE", "lobbyE");
  link("stOutW", "lobbyW");
  link("lobbySW", "lobbyW", "presDoor", "presIn", "pres", "pres2", "redDoor", "red");
  node("vpDoor", [D2.lobbyVp.x, f2y, D2.lobbyVp.z], "f2");
  node("vpIn", [9, f2y, -29.5], "f2"); // west end, outside the chair rows
  node("vpMid", [9, f2y, -20.5], "f2");
  node("vp", [12, f2y, -20.5], "f2");
  node("vpEnd", [26.2, f2y, -20.5], "f2");
  node("vp2", [26.4, f2y, -28], "f2");
  node("creamDoor", [D2.vpCream.x, f2y, D2.vpCream.z], "f2");
  node("cream", [37, f2y, -26], "f2");
  link("lobby", "lobbyE", "vpDoor", "vpIn", "vpMid", "vp", "vpEnd", "vp2", "creamDoor", "cream");
  node("officeDoor", [D2.lobbyOffice.x, f2y, D2.lobbyOffice.z], "f2");
  node("office", [0, f2y, -50], "f2");
  node("officeIn", [0, f2y, -45], "f2"); // the strip between the stairwell rail and the lobby wall
  link("lobbyS", "officeIn", "officeDoor", "office");
  node("corr", [0, f1, -62], "f1");
  node("corrE", [sr.x0 + shaftW / 2, f1, -62], "f1");
  node("corrW", [sb.x0 + shaftW / 2, f1, -62], "f1");
  link("cred", "cred2", "corrDoor", "corr");
  link("corrDoor", "corrE");
  link("corr", "corrW");
  link("corrE", "sr-0");
  // stair corridor → inner courtyard (between the shafts) → round the gallery
  node("cyDoor", [COURT.door.x, f1, COURT.door.z], "f1");
  node("cyPass", [0, f1, -69], "f1");
  node("cyN", [1.5, f1, -75], "f1"); // between two columns
  node("cyNE", [10.8, f1, -75], "f1");
  node("cySE", [10.8, f1, -87], "f1");
  node("cyNW", [-10.8, f1, -75], "f1");
  node("cySW", [-10.8, f1, -87], "f1");
  node("cyGarden", [1.5, f1, -81.5], "f1");
  link("corr", "cyDoor", "cyPass", "cyN");
  link("cyN", "cyNE", "cySE");
  link("cyN", "cyNW", "cySW");
  link("cyN", "cyGarden");
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
  // a few large old trees near the front corners, as in the façade photos (DDLP_0068, 0153, 0187)
  const out: Tree[] = [{ x: 74, z: 22, s: 1.7, h: 0.8 }, { x: -76, z: 18, s: 1.6, h: 0.7 }, { x: 96, z: -30, s: 1.5, h: 0.9 }, { x: -98, z: -36, s: 1.5, h: 0.75 }];
  const n = 300;
  let tries = 0;
  while (out.length < n && tries < n * 20) {
    tries++;
    const x = (R() * 2 - 1) * (GROUNDS.halfW - 6), z = (R() * 2 - 1) * (GROUNDS.halfD - 6);
    if (Math.hypot(x - cx, z - cz) < GROUNDS.ringRadius + GROUNDS.ringWidth / 2 + 5) continue; // lawn + ring drive
    if (Math.abs(x) < 88 && z > -104 && z < 34) continue; // palace, forecourt and the open lawns at its sides
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
