import * as THREE from "three";
import { box, cylinder, newBuf, quad, toGeometry, tri, type MeshBuf } from "@/lib/city/geom";

/**
 * Low-poly models for everything that moves. Each model has two parts:
 *   paint — vertex colour white, tinted per instance (body colour)
 *   trim  — fixed vertex colours (glass, lights, tyres, skin…)
 * Local frame: +z forward, +y up, origin on the ground at the centre.
 */
const C = (h: string) => new THREE.Color(h);
const WHITE = C("#ffffff");
const GLASS = C("#2d3e4c");
const DARK = C("#24272b");
const LIGHT = C("#fff3c4");
const TAIL = C("#d23b2f");
const SKIN = C("#d8a77f");
const PANTS = C("#334155");
const CHROME = C("#c9ced3");

export interface Model {
  paint: THREE.BufferGeometry;
  trim: THREE.BufferGeometry;
  /** wheel hubs: [x, y(=radius), z, radius, width] */
  wheels: [number, number, number, number, number][];
  length: number;
}

const finish = (paint: MeshBuf, trim: MeshBuf, wheels: Model["wheels"], length: number): Model => ({
  paint: toGeometry(paint),
  trim: toGeometry(trim),
  wheels,
  length,
});

function rider(trim: MeshBuf, paint: MeshBuf, z: number, seatY: number, helmet: THREE.Color) {
  box(paint, [0, seatY + 0.32, z], [0.42, 0.55, 0.28], 0, WHITE); // shirt takes the body colour
  box(trim, [0, seatY + 0.75, z + 0.04], [0.24, 0.24, 0.26], 0, helmet); // helmet
  box(trim, [0, seatY + 0.05, z + 0.25], [0.36, 0.18, 0.5], 0, PANTS); // thighs
  box(trim, [0.24, seatY + 0.35, z + 0.25], [0.09, 0.09, 0.45], 0, SKIN, -0.5); // arms
  box(trim, [-0.24, seatY + 0.35, z + 0.25], [0.09, 0.09, 0.45], 0, SKIN, -0.5);
}

/* ---------------------------------------------------------------- road */
export type VehicleKind =
  | "motorbike" | "scooter" | "delivery" | "pillion" | "ebike" | "bicycle"
  | "car" | "hatchback" | "suv" | "pickup" | "ev" | "taxi"
  | "bus" | "minibus" | "van" | "minitruck" | "truck";

export function vehicleModels(): Record<VehicleKind, Model> {
  const out = {} as Record<VehicleKind, Model>;
  {
    const p = newBuf(), t = newBuf();
    box(p, [0, 0.55, 0.05], [0.32, 0.32, 1.3], 0, WHITE); // tank & frame
    box(p, [0, 0.62, 0.62], [0.36, 0.42, 0.22], 0, WHITE, 0.25); // headlight cowl
    box(t, [0, 0.72, -0.15], [0.34, 0.1, 0.62], 0, DARK); // seat
    box(t, [0, 0.95, 0.66], [0.62, 0.05, 0.05], 0, CHROME); // handlebar
    box(t, [0, 0.66, 0.74], [0.16, 0.12, 0.04], 0, LIGHT);
    rider(t, p, -0.1, 0.72, C("#e63946"));
    out.motorbike = finish(p, t, [[0, 0.3, 0.68, 0.3, 0.1], [0, 0.3, -0.62, 0.3, 0.12]], 1.9);
  }
  {
    const p = newBuf(), t = newBuf();
    box(p, [0, 0.42, -0.2], [0.44, 0.42, 0.9], 0, WHITE); // body under the seat
    box(p, [0, 0.62, 0.55], [0.4, 0.9, 0.18], 0, WHITE, -0.2); // leg shield
    box(p, [0, 0.25, 0.2], [0.34, 0.08, 0.6], 0, WHITE); // floorboard
    box(t, [0, 0.68, -0.25], [0.36, 0.1, 0.62], 0, DARK);
    box(t, [0, 1.1, 0.62], [0.6, 0.05, 0.05], 0, CHROME);
    rider(t, p, -0.2, 0.68, C("#f4f4f4"));
    out.scooter = finish(p, t, [[0, 0.24, 0.68, 0.24, 0.12], [0, 0.24, -0.6, 0.24, 0.14]], 1.8);
  }
  const car = (len: number, wid: number, cabinLen: number, h: number) => {
    const p = newBuf(), t = newBuf();
    box(p, [0, 0.55, 0], [wid, 0.6, len], 0, WHITE);
    box(p, [0, 0.98 + (h - 1.45) / 2, -0.15], [wid * 0.86, h - 1.05 + 0.2, cabinLen], 0, WHITE);
    // windows: slightly proud of the cabin on all four sides
    const cy = 0.98 + (h - 1.45) / 2;
    box(t, [0, cy, -0.15 + cabinLen / 2 + 0.01], [wid * 0.8, (h - 0.85) * 0.55, 0.05], 0, GLASS, 0.35);
    box(t, [0, cy, -0.15 - cabinLen / 2 - 0.01], [wid * 0.8, (h - 0.85) * 0.55, 0.05], 0, GLASS, -0.3);
    for (const s of [1, -1]) box(t, [s * (wid * 0.43 + 0.01), cy, -0.15], [0.04, (h - 0.85) * 0.5, cabinLen * 0.85], 0, GLASS);
    for (const s of [1, -1]) {
      box(t, [s * wid * 0.32, 0.62, len / 2 + 0.01], [0.32, 0.14, 0.04], 0, LIGHT);
      box(t, [s * wid * 0.32, 0.65, -len / 2 - 0.01], [0.3, 0.12, 0.04], 0, TAIL);
    }
    const r = 0.33;
    const wz = len / 2 - 0.75;
    return { p, t, wheels: [[wid / 2 - 0.12, r, wz, r, 0.22], [-wid / 2 + 0.12, r, wz, r, 0.22], [wid / 2 - 0.12, r, -wz, r, 0.22], [-wid / 2 + 0.12, r, -wz, r, 0.22]] as Model["wheels"] };
  };
  {
    const c = car(4.3, 1.8, 2.2, 1.5);
    out.car = finish(c.p, c.t, c.wheels, 4.3);
  }
  {
    const c = car(4.5, 1.8, 2.3, 1.5);
    box(c.t, [0, 1.62, -0.1], [0.7, 0.22, 0.3], 0, C("#fff7d1")); // roof sign
    out.taxi = finish(c.p, c.t, c.wheels, 4.5);
  }
  {
    const p = newBuf(), t = newBuf();
    box(p, [0, 1.6, 0], [2.5, 2.6, 11], 0, WHITE);
    box(t, [0, 2.2, 0], [2.56, 0.9, 9.6], 0, GLASS); // side window band
    box(t, [0, 2.0, 5.51], [2.2, 1.3, 0.04], 0, GLASS);
    box(t, [0, 2.95, 0], [2.3, 0.08, 10.6], 0, C("#f2f2f2")); // roof strip
    for (const s of [1, -1]) box(t, [s * 0.9, 0.75, 5.51], [0.3, 0.16, 0.04], 0, LIGHT);
    const r = 0.5;
    out.bus = finish(p, t, [[1.1, r, 3.6, r, 0.3], [-1.1, r, 3.6, r, 0.3], [1.1, r, -3.4, r, 0.3], [-1.1, r, -3.4, r, 0.3]], 11);
  }
  {
    const p = newBuf(), t = newBuf();
    box(p, [0, 1.25, 0.2], [1.9, 2.0, 4.6], 0, WHITE);
    box(t, [0, 1.75, 2.51], [1.7, 0.75, 0.04], 0, GLASS, 0.15);
    for (const s of [1, -1]) box(t, [s * 0.96, 1.8, 1.8], [0.03, 0.6, 0.9], 0, GLASS);
    for (const s of [1, -1]) box(t, [s * 0.6, 0.7, 2.51], [0.3, 0.14, 0.04], 0, LIGHT);
    const r = 0.36;
    out.van = finish(p, t, [[0.86, r, 1.6, r, 0.22], [-0.86, r, 1.6, r, 0.22], [0.86, r, -1.4, r, 0.22], [-0.86, r, -1.4, r, 0.22]], 4.8);
  }
  {
    const p = newBuf(), t = newBuf();
    box(p, [0, 1.4, 3.4], [2.3, 2.2, 1.9], 0, WHITE); // cab
    box(t, [0, 2.0, 4.36], [2.1, 0.8, 0.04], 0, GLASS, 0.1);
    box(t, [0, 1.85, -1.0], [2.5, 2.7, 6.6], 0, C("#e9e6df")); // cargo box (neutral)
    box(t, [0, 0.62, -0.2], [1.2, 0.25, 8.6], 0, DARK); // chassis
    for (const s of [1, -1]) box(t, [s * 0.8, 0.85, 4.36], [0.3, 0.16, 0.04], 0, LIGHT);
    const r = 0.5;
    out.truck = finish(p, t, [[1.05, r, 3.5, r, 0.3], [-1.05, r, 3.5, r, 0.3], [1.05, r, -2.2, r, 0.35], [-1.05, r, -2.2, r, 0.35], [1.05, r, -3.4, r, 0.35], [-1.05, r, -3.4, r, 0.35]], 8.8);
  }
  {
    const p = newBuf(), t = newBuf();
    box(t, [0, 0.62, 0], [0.05, 0.05, 0.9], 0, DARK, 0.2);
    box(t, [0, 0.45, -0.25], [0.05, 0.5, 0.05], 0, DARK);
    box(t, [0, 0.95, 0.4], [0.5, 0.04, 0.04], 0, CHROME);
    box(t, [0, 0.82, -0.25], [0.2, 0.06, 0.26], 0, DARK);
    rider(t, p, -0.15, 0.82, C("#f2b630"));
    out.bicycle = finish(p, t, [[0, 0.33, 0.5, 0.33, 0.05], [0, 0.33, -0.5, 0.33, 0.05]], 1.7);
  }
  {
    // delivery bike: underbone motorbike with a big insulated box behind the rider
    const p = newBuf(), t = newBuf();
    box(p, [0, 0.55, 0.05], [0.32, 0.32, 1.3], 0, WHITE);
    box(p, [0, 0.62, 0.62], [0.36, 0.42, 0.22], 0, WHITE, 0.25);
    box(t, [0, 0.72, -0.1], [0.34, 0.1, 0.5], 0, DARK);
    box(t, [0, 0.95, 0.66], [0.62, 0.05, 0.05], 0, CHROME);
    box(t, [0, 0.66, 0.74], [0.16, 0.12, 0.04], 0, LIGHT);
    box(t, [0, 0.62, -0.88], [0.18, 0.1, 0.04], 0, TAIL);
    box(t, [0, 1.15, -0.62], [0.56, 0.52, 0.5], 0, C("#2fae66")); // cargo box (plain green, no branding)
    box(t, [0, 1.42, -0.62], [0.58, 0.04, 0.52], 0, C("#e9f5ec"));
    rider(t, p, 0.02, 0.72, C("#2fae66"));
    out.delivery = finish(p, t, [[0, 0.3, 0.68, 0.3, 0.1], [0, 0.3, -0.62, 0.3, 0.12]], 2.0);
  }
  {
    // motorbike carrying two people
    const p = newBuf(), t = newBuf();
    box(p, [0, 0.55, 0.05], [0.32, 0.32, 1.3], 0, WHITE);
    box(p, [0, 0.62, 0.62], [0.36, 0.42, 0.22], 0, WHITE, 0.25);
    box(t, [0, 0.72, -0.2], [0.34, 0.1, 0.8], 0, DARK);
    box(t, [0, 0.95, 0.66], [0.62, 0.05, 0.05], 0, CHROME);
    box(t, [0, 0.66, 0.74], [0.16, 0.12, 0.04], 0, LIGHT);
    box(t, [0, 0.62, -0.84], [0.18, 0.1, 0.04], 0, TAIL);
    rider(t, p, 0.05, 0.72, C("#1d3557"));
    rider(t, p, -0.48, 0.76, C("#f4acb7"));
    out.pillion = finish(p, t, [[0, 0.3, 0.68, 0.3, 0.1], [0, 0.3, -0.62, 0.3, 0.12]], 1.95);
  }
  {
    // electric scooter: one rounded body, no tank, small wheels, LED bar
    const p = newBuf(), t = newBuf();
    box(p, [0, 0.45, -0.25], [0.42, 0.36, 0.95], 0, WHITE);
    box(p, [0, 0.58, -0.3], [0.38, 0.2, 0.7], 0, WHITE, 0.12);
    box(p, [0, 0.65, 0.55], [0.36, 0.95, 0.16], 0, WHITE, -0.25);
    box(p, [0, 0.22, 0.18], [0.32, 0.06, 0.55], 0, WHITE);
    box(t, [0, 0.7, -0.28], [0.34, 0.08, 0.6], 0, DARK);
    box(t, [0, 1.12, 0.6], [0.58, 0.05, 0.05], 0, DARK);
    box(t, [0, 0.95, 0.66], [0.3, 0.06, 0.04], 0, LIGHT);
    box(t, [0, 0.5, -0.74], [0.3, 0.05, 0.03], 0, TAIL);
    rider(t, p, -0.22, 0.7, C("#90be6d"));
    out.ebike = finish(p, t, [[0, 0.22, 0.66, 0.22, 0.13], [0, 0.22, -0.6, 0.22, 0.15]], 1.75);
  }
  {
    // hatchback: the cabin runs on to a cut-off tail
    const c = car(3.8, 1.7, 2.1, 1.48);
    box(c.p, [0, 1.12, -0.95], [1.46, 0.5, 0.9], 0, WHITE, -0.25);
    out.hatchback = finish(c.p, c.t, c.wheels, 3.8);
  }
  {
    const c = car(4.7, 1.9, 2.8, 1.8);
    box(c.t, [0, 1.86, -0.2], [1.5, 0.06, 2.4], 0, DARK); // roof rails
    box(c.t, [0, 0.42, 2.36], [1.7, 0.2, 0.06], 0, DARK); // bumper guard
    for (const s of [1, -1]) box(c.t, [s * 1.0, 1.15, 0.95], [0.12, 0.1, 0.18], 0, DARK); // mirrors
    out.suv = finish(c.p, c.t, c.wheels.map(([x, , z, , w]) => [x, 0.38, z, 0.38, w]) as Model["wheels"], 4.7);
  }
  {
    // pickup: cab forward, open bed behind
    const p = newBuf(), t = newBuf();
    box(p, [0, 0.6, 0], [1.85, 0.65, 5.2], 0, WHITE);
    box(p, [0, 1.3, 0.75], [1.65, 0.8, 1.9], 0, WHITE);
    box(t, [0, 1.35, 1.71], [1.5, 0.5, 0.04], 0, GLASS, 0.3);
    for (const s of [1, -1]) box(t, [s * 0.83, 1.35, 0.75], [0.03, 0.45, 1.5], 0, GLASS);
    box(t, [0, 0.95, -1.4], [1.6, 0.06, 2.2], 0, DARK);
    for (const s of [1, -1]) box(t, [s * 0.92, 1.05, -1.4], [0.06, 0.3, 2.3], 0, CHROME);
    for (const s of [1, -1]) {
      box(t, [s * 0.6, 0.7, 2.61], [0.3, 0.14, 0.04], 0, LIGHT);
      box(t, [s * 0.75, 0.75, -2.61], [0.2, 0.18, 0.04], 0, TAIL);
    }
    const r = 0.38;
    out.pickup = finish(p, t, [[0.85, r, 1.7, r, 0.24], [-0.85, r, 1.7, r, 0.24], [0.85, r, -1.6, r, 0.24], [-0.85, r, -1.6, r, 0.24]], 5.2);
  }
  {
    // electric car: glass roof and light bars instead of a grille
    const c = car(4.4, 1.85, 2.6, 1.45);
    box(c.t, [0, 1.47, -0.15], [1.4, 0.04, 2.3], 0, GLASS);
    box(c.t, [0, 0.72, 2.21], [1.5, 0.06, 0.04], 0, LIGHT);
    box(c.t, [0, 0.78, -2.21], [1.5, 0.06, 0.04], 0, TAIL);
    out.ev = finish(c.p, c.t, c.wheels, 4.4);
  }
  {
    // 16-seat minibus / shuttle
    const p = newBuf(), t = newBuf();
    box(p, [0, 1.3, 0], [2.0, 2.1, 6.6], 0, WHITE);
    box(p, [0, 0.65, 3.1], [1.95, 0.8, 0.6], 0, WHITE);
    box(t, [0, 1.75, 0], [2.04, 0.7, 5.6], 0, GLASS);
    box(t, [0, 1.75, 3.31], [1.8, 0.8, 0.04], 0, GLASS, 0.2);
    for (const s of [1, -1]) {
      box(t, [s * 0.7, 0.75, 3.41], [0.28, 0.14, 0.04], 0, LIGHT);
      box(t, [s * 0.8, 0.8, -3.31], [0.2, 0.2, 0.04], 0, TAIL);
    }
    const r = 0.38;
    out.minibus = finish(p, t, [[0.9, r, 2.3, r, 0.24], [-0.9, r, 2.3, r, 0.24], [0.9, r, -2.2, r, 0.24], [-0.9, r, -2.2, r, 0.24]], 6.6);
  }
  {
    // small truck (1-2 t): short cab + tarp-covered bed
    const p = newBuf(), t = newBuf();
    box(p, [0, 1.25, 2.0], [1.8, 1.7, 1.5], 0, WHITE);
    box(t, [0, 1.65, 2.76], [1.6, 0.65, 0.04], 0, GLASS, 0.1);
    box(t, [0, 0.62, -0.2], [1.0, 0.2, 5.4], 0, DARK);
    box(t, [0, 1.4, -0.75], [1.9, 1.5, 3.4], 0, C("#3f7d6e"));
    for (const s of [1, -1]) box(t, [s * 0.6, 0.75, 2.76], [0.28, 0.14, 0.04], 0, LIGHT);
    const r = 0.4;
    out.minitruck = finish(p, t, [[0.8, r, 2.0, r, 0.24], [-0.8, r, 2.0, r, 0.24], [0.8, r, -1.6, r, 0.28], [-0.8, r, -1.6, r, 0.28]], 5.6);
  }
  return out;
}

/** Unit wheel: radius 1, width 1, axle along x. */
export function wheelGeometry() {
  const g = new THREE.CylinderGeometry(1, 1, 1, 10);
  g.rotateZ(Math.PI / 2);
  // a lighter hub so the spin is visible up close
  const colors: number[] = [];
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const hub = Math.abs(pos.getX(i)) > 0.45 && Math.hypot(pos.getY(i), pos.getZ(i)) < 0.5;
    const c = hub ? CHROME : DARK;
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

/* --------------------------------------------------------------- water */
export type BoatKind = "tour" | "glasstour" | "ferry" | "barge" | "cargo" | "tug" | "boat" | "speedboat";

function hull(p: MeshBuf, len: number, wid: number, h: number, col: THREE.Color) {
  // pointed bow: box for the body + a wedge at the front
  const body = len * 0.78;
  box(p, [0, h / 2, -len / 2 + body / 2], [wid, h, body], 0, col);
  const z0 = -len / 2 + body, z1 = len / 2;
  const L: [number, number, number] = [-wid / 2, 0, z0], Rr: [number, number, number] = [wid / 2, 0, z0];
  const Lt: [number, number, number] = [-wid / 2, h, z0], Rt: [number, number, number] = [wid / 2, h, z0];
  const tip: [number, number, number] = [0, h * 0.4, z1], tipT: [number, number, number] = [0, h, z1];
  const nl = new THREE.Vector3(-(z1 - z0), 0, wid / 2).normalize();
  quad(p, L, tip, tipT, Lt, [nl.x, 0, nl.z], col);
  quad(p, tip, Rr, Rt, tipT, [-nl.x, 0, nl.z], col);
  tri(p, Lt, tipT, Rt, [0, 1, 0], col);
}

export function boatModels(): Record<BoatKind, Model> {
  const out = {} as Record<BoatKind, Model>;
  {
    const p = newBuf(), t = newBuf();
    hull(p, 26, 6, 1.6, WHITE);
    box(t, [0, 2.6, -1.5], [5.2, 2.0, 18], 0, C("#fbfbf8")); // main deck cabin
    box(t, [0, 2.7, -1.5], [5.26, 0.9, 17], 0, GLASS);
    box(t, [0, 4.4, -3], [4.6, 1.6, 12], 0, C("#ffffff")); // upper deck
    box(t, [0, 4.5, -3], [4.66, 0.7, 11], 0, GLASS);
    box(t, [0, 5.3, -3], [4.9, 0.12, 12.6], 0, C("#e63946")); // canopy
    out.tour = finish(p, t, [], 26);
  }
  {
    const p = newBuf(), t = newBuf();
    hull(p, 18, 5, 1.3, WHITE);
    box(t, [0, 2.2, -1], [4.4, 1.8, 11], 0, C("#f6f4ee"));
    box(t, [0, 2.3, -1], [4.46, 0.8, 10], 0, GLASS);
    box(t, [0, 3.3, 2.8], [2.2, 1.1, 2.2], 0, C("#ffffff")); // wheelhouse
    out.ferry = finish(p, t, [], 18);
  }
  {
    const p = newBuf(), t = newBuf();
    box(p, [0, 0.9, 0], [8, 1.8, 40], 0, WHITE);
    box(t, [0, 2.4, -1], [6.8, 1.4, 30], 0, C("#a0785a")); // sand / cargo
    box(t, [0, 3.0, -18], [6, 3, 3.5], 0, C("#f2f2f2")); // stern house
    box(t, [0, 3.6, -16.3], [5.8, 0.8, 0.05], 0, GLASS);
    out.barge = finish(p, t, [], 40);
  }
  {
    const p = newBuf(), t = newBuf();
    hull(p, 7, 2, 0.8, WHITE);
    box(t, [0, 1.3, -1.2], [1.6, 0.9, 2.6], 0, C("#4a8a5a")); // little roof
    out.boat = finish(p, t, [], 7);
  }
  {
    const p = newBuf(), t = newBuf();
    hull(p, 8, 2.4, 0.9, WHITE);
    box(t, [0, 1.3, 0.6], [2, 0.45, 1.4], 0, GLASS, 0.3);
    box(t, [0, 1.0, -2.2], [2.2, 0.3, 2.6], 0, C("#f4f4f4"));
    out.speedboat = finish(p, t, [], 8);
  }
  {
    // single-deck sightseeing boat: long glass cabin, open bow deck with rails
    const p = newBuf(), t = newBuf();
    hull(p, 20, 5, 1.3, WHITE);
    box(t, [0, 2.2, -2], [4.4, 1.8, 12], 0, GLASS);
    box(t, [0, 3.15, -2], [4.6, 0.12, 12.6], 0, C("#f6f4ee"));
    for (const s of [1, -1]) box(t, [s * 2.3, 1.75, 5.5], [0.06, 0.6, 3.5], 0, CHROME);
    box(t, [0, 1.75, 7.2], [3.2, 0.6, 0.06], 0, CHROME);
    box(t, [0, 3.35, -6.5], [1.2, 0.3, 0.6], 0, LIGHT);
    out.glasstour = finish(p, t, [], 20);
  }
  {
    // small freighter: containers forward, bridge aft
    const p = newBuf(), t = newBuf();
    hull(p, 32, 7, 2.2, WHITE);
    const boxes: [number, string][] = [[6, "#c1121f"], [0, "#1d4ed8"], [-6, "#e9c46a"]];
    for (const [z, c] of boxes) box(t, [0, 3.4, z], [6, 2.4, 5.4], 0, C(c));
    box(t, [0, 4.6, -12], [6, 4.8, 4.5], 0, C("#f2f2f2"));
    box(t, [0, 5.6, -9.74], [5.4, 0.8, 0.05], 0, GLASS);
    box(t, [0, 7.6, -12.5], [0.7, 1.6, 0.7], 0, DARK);
    out.cargo = finish(p, t, [], 32);
  }
  {
    // tugboat: short, tall wheelhouse, tyre fenders
    const p = newBuf(), t = newBuf();
    hull(p, 12, 4.2, 1.6, WHITE);
    box(t, [0, 2.6, -0.5], [3.2, 1.6, 4.5], 0, C("#f2f2f2"));
    box(t, [0, 4.0, 0.2], [2.4, 1.3, 2.4], 0, C("#f2f2f2"));
    box(t, [0, 4.1, 1.42], [2.2, 0.6, 0.05], 0, GLASS);
    box(t, [0, 5.0, -1.4], [0.6, 1.4, 0.6], 0, DARK);
    for (const s of [1, -1]) box(t, [s * 2.15, 1.2, 0], [0.2, 0.5, 8], 0, DARK);
    out.tug = finish(p, t, [], 12);
  }
  return out;
}

/* ---------------------------------------------------------------- life */

/**
 * Person: vertex attribute `aLimb` (−1/+1 legs, ±0.6 arms, 0 rigid) drives the
 * walk cycle in the shader; `aTint` marks clothing that takes the instance colour.
 */
export function personGeometry() {
  const parts: { g: THREE.BufferGeometry; limb: number; tint: number; col: THREE.Color }[] = [];
  const add = (g: THREE.BufferGeometry, limb: number, tint: number, col: THREE.Color) => parts.push({ g, limb, tint, col });
  const bx = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    return g;
  };
  add(bx(0.17, 0.82, 0.2, 0.11, 0.41, 0), -1, 0, PANTS);
  add(bx(0.17, 0.82, 0.2, -0.11, 0.41, 0), 1, 0, PANTS);
  add(bx(0.46, 0.62, 0.26, 0, 1.13, 0), 0, 1, WHITE); // torso (shirt)
  add(bx(0.11, 0.6, 0.12, 0.3, 1.12, 0), 0.6, 1, WHITE); // arms
  add(bx(0.11, 0.6, 0.12, -0.3, 1.12, 0), -0.6, 1, WHITE);
  const head = new THREE.IcosahedronGeometry(0.15, 1);
  head.translate(0, 1.6, 0);
  add(head, 0, 0, SKIN);
  const hair = new THREE.SphereGeometry(0.16, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.45);
  hair.translate(0, 1.63, -0.01);
  add(hair, 0, 0, C("#1e1712"));
  return mergeTagged(parts);
}

/** Small dog / cat: legs flagged as limbs. */
export function petGeometry(kind: "dog" | "cat") {
  const s = kind === "dog" ? 1 : 0.7;
  const col = kind === "dog" ? C("#b98552") : C("#8a8a8a");
  const parts: { g: THREE.BufferGeometry; limb: number; tint: number; col: THREE.Color }[] = [];
  const bx = (w: number, h: number, d: number, x: number, y: number, z: number, limb: number, c = col) => {
    const g = new THREE.BoxGeometry(w * s, h * s, d * s);
    g.translate(x * s, y * s, z * s);
    parts.push({ g, limb, tint: 1, col: c });
  };
  bx(0.24, 0.24, 0.62, 0, 0.42, 0, 0);
  bx(0.2, 0.2, 0.24, 0, 0.6, 0.38, 0);
  bx(0.08, 0.3, 0.08, 0.08, 0.15, 0.22, -1);
  bx(0.08, 0.3, 0.08, -0.08, 0.15, 0.22, 1);
  bx(0.08, 0.3, 0.08, 0.08, 0.15, -0.22, 1);
  bx(0.08, 0.3, 0.08, -0.08, 0.15, -0.22, -1);
  bx(0.05, 0.05, 0.3, 0, 0.55, -0.42, 0); // tail
  return mergeTagged(parts);
}

/** Bird: wings flagged (aLimb ±1) and flapped in the shader. */
export function birdGeometry(span = 1.4, color = "#3b3b40") {
  const col = C(color);
  const parts: { g: THREE.BufferGeometry; limb: number; tint: number; col: THREE.Color }[] = [];
  const body = new THREE.ConeGeometry(0.12 * span, 0.5 * span, 5);
  body.rotateX(Math.PI / 2);
  parts.push({ g: body, limb: 0, tint: 1, col });
  for (const s of [1, -1]) {
    const w = new THREE.BufferGeometry();
    const v = new Float32Array([0, 0, 0.1 * span, s * 0.7 * span, 0, -0.05 * span, 0, 0, -0.12 * span]);
    w.setAttribute("position", new THREE.BufferAttribute(v, 3));
    w.computeVertexNormals();
    parts.push({ g: w, limb: s, tint: 1, col });
  }
  return mergeTagged(parts);
}

/** Standing water bird (egret) / ground bird (pigeon): no flapping, head bob only. */
export function waderGeometry(tall: boolean) {
  const col = tall ? C("#f7f7f2") : C("#8d93a0");
  const s = tall ? 1 : 0.45;
  const parts: { g: THREE.BufferGeometry; limb: number; tint: number; col: THREE.Color }[] = [];
  const body = new THREE.SphereGeometry(0.18 * s, 6, 4);
  body.scale(1, 0.8, 1.6);
  body.translate(0, tall ? 0.75 : 0.16, 0);
  parts.push({ g: body, limb: 0, tint: 1, col });
  const neck = new THREE.CylinderGeometry(0.03 * s, 0.04 * s, tall ? 0.45 : 0.12, 4);
  neck.translate(0, tall ? 1.05 : 0.27, 0.12 * s);
  parts.push({ g: neck, limb: 0.3, tint: 1, col });
  if (tall)
    for (const x of [0.05, -0.05]) {
      const leg = new THREE.CylinderGeometry(0.015, 0.015, 0.62, 3);
      leg.translate(x, 0.31, 0);
      parts.push({ g: leg, limb: 0, tint: 0, col: C("#2b2b2b") });
    }
  return mergeTagged(parts);
}

function mergeTagged(parts: { g: THREE.BufferGeometry; limb: number; tint: number; col: THREE.Color }[]) {
  const pos: number[] = [], nor: number[] = [], col: number[] = [], limb: number[] = [], tint: number[] = [];
  for (const p of parts) {
    const g = p.g.index ? p.g.toNonIndexed() : p.g;
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    const a = g.getAttribute("position"), n = g.getAttribute("normal");
    for (let i = 0; i < a.count; i++) {
      pos.push(a.getX(i), a.getY(i), a.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      col.push(p.col.r, p.col.g, p.col.b);
      limb.push(p.limb);
      tint.push(p.tint);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("aLimb", new THREE.Float32BufferAttribute(limb, 1));
  g.setAttribute("aTint", new THREE.Float32BufferAttribute(tint, 1));
  g.computeBoundingSphere();
  return g;
}

export { cylinder };
