import * as THREE from "three";
import { SPACE_BY_ID, SPACE_DOORS, type Region, type SpaceDoor, type SpaceId } from "@/data/dinh/spaces";
import { MAIN_DOOR } from "@/data/dinh/interactions";
import type { Box, PalaceModel } from "./palaceModel";
import { RoutePlanner } from "./route";

/**
 * Splits the palace model into per-space models: each space gets only the
 * boxes (render + colliders), stair steps, closed doors, navigation graph and
 * trees inside its own regions, plus render-only boxes of what can be seen
 * through glass (`viewBoxes`). The split is pure data (CPU, small); GPU
 * resources are created only when a space is mounted.
 */
export interface SpaceModel extends PalaceModel {
  id: SpaceId;
  /** render-only boxes seen through glass (no colliders, no navigation) */
  viewBoxes: Box[];
  /** door leaves of this space (rendered and solid) */
  doors: SpaceDoor[];
}

/** World AABB of a (possibly rotated) box. */
export function boxAABB(b: Box): Region {
  const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(b.rx ?? 0, b.ry ?? 0, 0, "YXZ"));
  const e = rot.elements;
  const h = [b.s[0] / 2, b.s[1] / 2, b.s[2] / 2];
  const ex = Math.abs(e[0]) * h[0] + Math.abs(e[4]) * h[1] + Math.abs(e[8]) * h[2];
  const ey = Math.abs(e[1]) * h[0] + Math.abs(e[5]) * h[1] + Math.abs(e[9]) * h[2];
  const ez = Math.abs(e[2]) * h[0] + Math.abs(e[6]) * h[1] + Math.abs(e[10]) * h[2];
  return { x0: b.p[0] - ex, x1: b.p[0] + ex, y0: b.p[1] - ey, y1: b.p[1] + ey, z0: b.p[2] - ez, z1: b.p[2] + ez };
}

/** Do two regions overlap by more than `eps` on every axis (touching does not count)? */
export const overlaps = (a: Region, b: Region, eps = 0.02) =>
  Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > eps && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > eps && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > eps;

const grow = (r: Region, m: number): Region => ({ x0: r.x0 - m, x1: r.x1 + m, y0: r.y0, y1: r.y1, z0: r.z0 - m, z1: r.z1 + m });
const pointIn = (r: Region, p: number[], m = 0) => p[0] >= r.x0 - m && p[0] <= r.x1 + m && p[1] >= r.y0 - m && p[1] <= r.y1 + m && p[2] >= r.z0 - m && p[2] <= r.z1 + m;

/** Door leaves as solid boxes (the main door is drawn by its own component). */
function doorBoxes(doors: SpaceDoor[]): Box[] {
  return doors.map((d) => ({
    p: [d.p[0], d.p[1] + d.h / 2, d.p[2]],
    s: d.ry ? [0.16, d.h, d.w] : [d.w, d.h, 0.16],
    m: "door",
    collide: true,
    visible: false, // drawn as door leaves, see SpaceDoors
  }));
}

const cache = new WeakMap<PalaceModel, Map<SpaceId, SpaceModel>>();

export function spaceModel(model: PalaceModel, id: SpaceId): SpaceModel {
  let perModel = cache.get(model);
  if (!perModel) cache.set(model, (perModel = new Map()));
  const hit = perModel.get(id);
  if (hit) return hit;
  const space = SPACE_BY_ID.get(id)!;
  // walls sit on region borders: a small margin catches the half of the wall that lies outside
  const own = [...space.regions, ...(space.sharedRegions ?? [])].map((r) => grow(r, 0.3));
  const view = (space.viewRegions ?? []).map((r) => grow(r, 0.3));
  const boxes: Box[] = [], viewBoxes: Box[] = [];
  for (const b of model.boxes) {
    const a = boxAABB(b);
    if (own.some((r) => overlaps(a, r))) boxes.push(b);
    else if (b.visible !== false && view.some((r) => overlaps(a, r))) viewBoxes.push(b);
  }
  const steps = model.steps.filter((b) => own.some((r) => overlaps(boxAABB(b), r)));
  const closedDoors = model.closedDoors.filter((d) => own.some((r) => pointIn(r, [d.p[0], d.p[1] + 1, d.p[2]])));
  const doors = SPACE_DOORS.filter((d) => d.between.includes(id));
  boxes.push(...doorBoxes(doors));
  if (id === "exterior" || id === "hall") {
    // the closed glass main door
    boxes.push({ p: [(MAIN_DOOR.x0 + MAIN_DOOR.x1) / 2, MAIN_DOOR.y0 + MAIN_DOOR.h / 2, MAIN_DOOR.z], s: [MAIN_DOOR.x1 - MAIN_DOOR.x0, MAIN_DOOR.h, 0.16], m: "glass", collide: true, visible: false });
  }
  const nodes = model.nav.nodes.filter((n) => [...space.regions, ...(space.sharedRegions ?? [])].some((r) => pointIn(r, n.p, 0.3)));
  const keep = new Set(nodes.map((n) => n.id));
  const edges = model.nav.edges.filter(([a, c]) => keep.has(a) && keep.has(c));
  const trees = id === "exterior" ? model.trees : [];
  const sm: SpaceModel = { id, boxes, viewBoxes, steps, closedDoors, doors, nav: { nodes, edges }, trees };
  perModel.set(id, sm);
  return sm;
}

/** Route planner per space (CPU only; kept for the session — a few kB each). */
const planners = new Map<SpaceModel, RoutePlanner>();
export function spacePlanner(sm: SpaceModel): RoutePlanner {
  let p = planners.get(sm);
  if (!p) {
    p = new RoutePlanner(sm);
    planners.set(sm, p);
  }
  return p;
}
