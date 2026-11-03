import { sampleLane, type Lane, type RoadClass } from "@/lib/city/roads";
import { rng } from "@/lib/geo";
import type { VehicleKind } from "./models";

/**
 * TrafficSimulation — vehicles drive the lanes of the RoadNetwork.
 * - car-following: keep a gap to the vehicle ahead in the same lane
 *   (motorbikes may ride two abreast in their own sub-lane)
 * - junctions: two-phase signals; turns follow a quadratic Bézier from the end
 *   of one lane, through the junction node, to the start of the next lane
 * - vehicle mix and density depend on the road class; heavy lorries keep out
 *   of the historic core
 * - turn speed follows the turn radius and the vehicle's size (a bus takes a
 *   corner much slower than a motorbike); two-wheelers lean into turns
 * - a vehicle stuck for a long time (gridlock) re-enters elsewhere, off-screen
 * Positions are in the project's city frame (metres, +x east, +z south).
 * The mix percentages are an artistic estimate of Saigon traffic, not statistics.
 */

/** latAcc: comfortable lateral acceleration (m/s²) in turns — sets the turn speed for a given radius. */
export interface VehicleSpec { kind: VehicleKind; length: number; maxSpeed: number; accel: number; latAcc: number; classes: RoadClass[] }

const ALL: RoadClass[] = ["major", "minor", "local"];
export const VEHICLES: Record<VehicleKind, Omit<VehicleSpec, "kind">> = {
  motorbike: { length: 1.9, maxSpeed: 9, accel: 3.2, latAcc: 3.2, classes: ALL },
  scooter: { length: 1.8, maxSpeed: 8, accel: 3.0, latAcc: 3.0, classes: ALL },
  delivery: { length: 2.0, maxSpeed: 8.5, accel: 2.8, latAcc: 2.8, classes: ALL },
  pillion: { length: 1.95, maxSpeed: 8, accel: 2.6, latAcc: 2.6, classes: ALL },
  ebike: { length: 1.75, maxSpeed: 7.5, accel: 3.0, latAcc: 3.0, classes: ALL },
  bicycle: { length: 1.7, maxSpeed: 4, accel: 1.2, latAcc: 2.2, classes: ["minor", "local"] },
  car: { length: 4.3, maxSpeed: 10, accel: 2.4, latAcc: 2.2, classes: ALL },
  hatchback: { length: 3.8, maxSpeed: 10, accel: 2.5, latAcc: 2.3, classes: ALL },
  suv: { length: 4.7, maxSpeed: 10, accel: 2.2, latAcc: 2.0, classes: ["major", "minor"] },
  pickup: { length: 5.2, maxSpeed: 9, accel: 2.0, latAcc: 1.9, classes: ["major", "minor"] },
  ev: { length: 4.4, maxSpeed: 10, accel: 3.0, latAcc: 2.2, classes: ALL },
  taxi: { length: 4.5, maxSpeed: 10, accel: 2.4, latAcc: 2.2, classes: ALL },
  van: { length: 4.8, maxSpeed: 8.5, accel: 1.8, latAcc: 1.8, classes: ALL },
  minibus: { length: 6.6, maxSpeed: 8.5, accel: 1.5, latAcc: 1.5, classes: ["major", "minor"] },
  minitruck: { length: 5.6, maxSpeed: 8, accel: 1.4, latAcc: 1.5, classes: ["major", "minor"] },
  bus: { length: 11, maxSpeed: 7.5, accel: 1.1, latAcc: 1.1, classes: ["major", "minor"] },
  truck: { length: 8.8, maxSpeed: 7, accel: 1.0, latAcc: 1.0, classes: ["major"] },
};

/**
 * Mix per road class (weights). Arterials: ~50 % two-wheelers, ~32 % cars and
 * taxis, ~7 % buses, ~10 % goods vehicles, ~2 % bicycles; side streets and
 * alleys are mostly motorbikes and have no buses or lorries. Over the whole
 * network about 62 % of vehicles are two-wheelers.
 */
const MIX: Record<RoadClass, [VehicleKind, number][]> = {
  major: [
    ["motorbike", 22], ["scooter", 16], ["delivery", 7], ["pillion", 7], ["ebike", 5], ["bicycle", 2],
    ["car", 12], ["hatchback", 6], ["suv", 5], ["ev", 4], ["taxi", 7], ["pickup", 2],
    ["bus", 5], ["minibus", 3], ["van", 5], ["minitruck", 3], ["truck", 3],
  ],
  minor: [
    ["motorbike", 24], ["scooter", 18], ["delivery", 8], ["pillion", 8], ["ebike", 5], ["bicycle", 4],
    ["car", 10], ["hatchback", 6], ["suv", 3], ["ev", 3], ["taxi", 6], ["pickup", 1],
    ["bus", 2], ["minibus", 3], ["van", 4], ["minitruck", 2],
  ],
  local: [
    ["motorbike", 30], ["scooter", 24], ["delivery", 10], ["pillion", 10], ["ebike", 7], ["bicycle", 8],
    ["hatchback", 4], ["car", 3], ["ev", 1], ["van", 2], ["taxi", 1],
  ],
};
const DENSITY: Record<RoadClass, number> = { major: 1, minor: 0.6, local: 0.2 }; // relative per metre
/** Traffic peaks around the District 1 centre and fades over ~2.4 km. */
const BUSY = { x: 800, z: 150, r: 2400 };
/** Historic core (palace, cathedral, Bến Thành): no heavy lorries there. */
const CORE = { x: 350, z: 100, r: 900 };
const TWO_WHEEL = new Set<VehicleKind>(["motorbike", "scooter", "delivery", "pillion", "ebike", "bicycle"]);

/**
 * Safe speed (m/s) through the turn from lane `a` into lane `b`: v = √(latAcc · radius),
 * the radius estimated from the chord between the lanes and the turn angle.
 */
export function cornerSpeed(latAcc: number, vmax: number, a: Pick<Lane, "pts" | "endHeading">, b: Pick<Lane, "pts">) {
  const h = Math.atan2(b.pts[1][1] - b.pts[0][1], b.pts[1][0] - b.pts[0][0]);
  const theta = Math.abs(Math.atan2(Math.sin(h - a.endHeading), Math.cos(h - a.endHeading)));
  if (theta < 0.2) return vmax;
  const e = a.pts[a.pts.length - 1], st = b.pts[0];
  const chord = Math.max(2, Math.hypot(st[0] - e[0], st[1] - e[1]));
  const radius = Math.min(60, chord / (2 * Math.sin(Math.min(Math.PI / 2, theta / 2))));
  return Math.max(1.2, Math.min(vmax, Math.sqrt(latAcc * radius)));
}

export interface Vehicle {
  kind: VehicleKind;
  spec: Omit<VehicleSpec, "kind">;
  lane: number;
  s: number; // distance along lane (negative while on the connector into it)
  v: number;
  vmax: number;
  slot: number; // lateral sub-lane offset (m), bikes only
  conn: Conn | null;
  /** lane chosen ahead of the junction (so the vehicle can slow for the turn); -1 = not yet */
  next: number;
  /** safe speed through the coming turn */
  turnV: number;
  wheel: number; // wheel rotation (rad·r)
  stopped: number; // seconds standing still
  respawns: number;
  // render state (smoothed)
  x: number; y: number; z: number; yaw: number; pitch: number;
  /** body roll (rad): two-wheelers lean into turns */
  lean: number;
  /** pose refreshed this frame (false = off-screen, its last pose is kept) */
  fresh: boolean;
}

interface Conn { ax: number; az: number; ay: number; cx: number; cz: number; bx: number; bz: number; by: number; length: number; to: number; t: number }

const CYCLE = 24; // signal cycle (s): 10 green, 2 all-red, per phase

export class TrafficSimulation {
  readonly vehicles: Vehicle[] = [];
  /** set by the renderer: is a world point on screen? (respawns only happen off-screen) */
  isVisible: (x: number, z: number) => boolean = () => false;
  private time = 0;
  private R: () => number;
  private byLane = new Map<number, Vehicle[]>();
  private tmp = { x: 0, z: 0, dx: 0, dz: 1, y: 0 };

  constructor(readonly lanes: Lane[], readonly junctions: { x: number; z: number; axis: number; offset: number }[], count: number, seed = 304) {
    this.R = rng(seed);
    const usable = lanes.map((l, i) => i).filter((i) => lanes[i].length > 20);
    // busier towards District 1 / the CBD, calmer at the edges of the map
    const busy = (i: number) => {
      const m = lanes[i].pts[Math.floor(lanes[i].pts.length / 2)];
      return 0.45 + 2 * Math.max(0, 1 - Math.hypot(m[0] - BUSY.x, m[1] - BUSY.z) / BUSY.r);
    };
    const weight = (i: number) => lanes[i].length * DENSITY[lanes[i].cls] * busy(i);
    const total = usable.reduce((a, i) => a + weight(i), 0);
    if (!total) return;
    for (const i of usable) {
      const lane = lanes[i];
      const n = Math.floor((weight(i) / total) * count + this.R());
      let s = this.R() * 6;
      const mid = lane.pts[Math.floor(lane.pts.length / 2)];
      for (let k = 0; k < n && s < lane.length - 3; k++) {
        const kind = this.pickKind(lane.cls, mid[0], mid[1]);
        const spec = VEHICLES[kind];
        const v = this.make(kind, i, s);
        v.v = v.vmax * 0.6;
        this.vehicles.push(v);
        s += spec.length + 6 + this.R() * (lane.length / Math.max(1, n));
      }
    }
    for (const v of this.vehicles) this.place(v, 1);
  }

  private pickKind(cls: RoadClass, x = Infinity, z = Infinity): VehicleKind {
    const mix = MIX[cls];
    let r = this.R() * mix.reduce((a, [, w]) => a + w, 0);
    let kind = mix[0][0];
    for (const [k, w] of mix) if ((r -= w) <= 0) { kind = k; break; }
    if (kind === "truck" && Math.hypot(x - CORE.x, z - CORE.z) < CORE.r) kind = "van";
    return kind;
  }

  private turnSpeed(v: Vehicle, a: Lane, b: Lane) {
    return cornerSpeed(v.spec.latAcc, v.vmax, a, b);
  }

  private make(kind: VehicleKind, lane: number, s: number): Vehicle {
    const spec = VEHICLES[kind];
    const bike = kind === "motorbike" || kind === "scooter" || kind === "bicycle";
    return {
      kind, spec, lane, s, v: 0,
      vmax: Math.min(spec.maxSpeed, this.lanes[lane].speed * (bike ? 0.95 : 1)) * (0.85 + this.R() * 0.25),
      slot: bike ? (this.R() < 0.5 ? -0.7 : 0.7) * Math.min(1, this.lanes[lane].width / 8) : 0,
      conn: null, next: -1, turnV: Infinity, wheel: 0, stopped: 0, respawns: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, lean: 0, fresh: true,
    };
  }

  private green(lane: Lane) {
    if (lane.endJunction < 0) return true;
    const j = this.junctions[lane.endJunction];
    const t = (this.time + j.offset) % CYCLE;
    const aligned = Math.abs(Math.cos(lane.endHeading - j.axis)) > 0.707;
    // phase A: aligned approaches green 0–10 s; phase B: 12–22 s; 2 s all-red between
    return aligned ? t < 10 : t >= 12 && t < 22;
  }

  private chooseNext(v: Vehicle): number {
    const lane = this.lanes[v.lane];
    const options = lane.next.filter((j) => v.spec.classes.includes(this.lanes[j].cls));
    const list = options.length ? options : lane.next;
    if (!list.length) return -1;
    // prefer going roughly straight
    let best = list[0], bestScore = -Infinity;
    for (const j of list) {
      const nl = this.lanes[j];
      const h = Math.atan2(nl.pts[1][1] - nl.pts[0][1], nl.pts[1][0] - nl.pts[0][0]);
      const score = Math.cos(h - lane.endHeading) + this.R() * 1.2;
      if (score > bestScore) { bestScore = score; best = j; }
    }
    return best;
  }

  private gapAhead(v: Vehicle, list: Vehicle[], idx: number) {
    for (let k = idx - 1; k >= 0; k--) {
      const o = list[k];
      if (v.slot && o.slot && Math.sign(v.slot) !== Math.sign(o.slot) && o.spec.length < 2.5) continue; // bikes side by side
      return o.s - o.spec.length / 2 - (v.s + v.spec.length / 2);
    }
    return Infinity;
  }

  update(dt: number) {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.byLane.clear();
    for (const v of this.vehicles) {
      let arr = this.byLane.get(v.lane);
      if (!arr) this.byLane.set(v.lane, (arr = []));
      arr.push(v);
    }
    for (const [li, list] of this.byLane) {
      list.sort((a, b) => b.s - a.s);
      const lane = this.lanes[li];
      const green = this.green(lane);
      list.forEach((v, idx) => {
        let target = v.vmax;
        // car-following (desired gap grows with speed)
        const gap = this.gapAhead(v, list, idx);
        const minGap = (v.spec.length < 2.5 ? 1.2 : 2.5) + v.v * 0.9;
        if (gap < Infinity) target = Math.min(target, Math.max(0, (gap - minGap) * 1.1));
        // stop line at red lights
        const toEnd = lane.length - v.s - v.spec.length / 2;
        if (!green && !v.conn && toEnd < 30 && toEnd > -1) target = Math.min(target, Math.max(0, (toEnd - 1.5) * 0.8));
        // pick the next lane ~35 m ahead, then brake smoothly to the turn speed
        if (!v.conn && v.next < 0 && toEnd < 35) {
          v.next = this.chooseNext(v);
          v.turnV = v.next >= 0 ? this.turnSpeed(v, lane, this.lanes[v.next]) : v.vmax;
        }
        if (!v.conn && v.next >= 0) target = Math.min(target, Math.sqrt(v.turnV * v.turnV + 2 * 1.6 * Math.max(0, toEnd)));
        if (v.conn) target = Math.min(target, v.turnV);
        const a = target > v.v ? v.spec.accel : 6;
        v.v += Math.max(-a * dt, Math.min(a * dt, target - v.v));
        if (v.v < 0.05) v.stopped += dt;
        else v.stopped = 0;
        // gridlock breaker: after 30 s at a standstill, re-enter elsewhere (only where nobody sees it)
        if (v.stopped > 30 && !this.isVisible(v.x, v.z) && this.respawn(v)) return;

        if (v.conn) {
          // travelling the junction connector; s < 0 until we enter the next lane
          v.conn.t += (v.v * dt) / v.conn.length;
          v.s = -(1 - v.conn.t) * v.conn.length;
          if (v.conn.t >= 1) {
            v.s = 0;
            v.conn = null;
          }
        } else {
          v.s += v.v * dt;
          if (v.s >= lane.length) this.enterJunction(v);
        }
        v.wheel += v.v * dt;
      });
    }
  }

  /** Moves a vehicle to the start of a random suitable lane out of the camera's view. */
  private respawn(v: Vehicle) {
    for (let tries = 0; tries < 20; tries++) {
      const li = Math.floor(this.R() * this.lanes.length);
      const l = this.lanes[li];
      if (l.length < 30 || !v.spec.classes.includes(l.cls) || this.isVisible(l.pts[0][0], l.pts[0][1])) continue;
      if ((this.byLane.get(li) ?? []).some((o) => o.s < v.spec.length + 8)) continue;
      v.lane = li;
      v.s = 0;
      v.conn = null;
      v.next = -1;
      v.stopped = 0;
      v.respawns++;
      this.place(v, 1);
      return true;
    }
    return false;
  }

  private enterJunction(v: Vehicle) {
    const lane = this.lanes[v.lane];
    const nextIdx = v.next >= 0 ? v.next : this.chooseNext(v);
    if (nextIdx < 0) {
      // Lane leaves the map: re-enter somewhere else, out of the camera's view.
      if (this.respawn(v)) return;
      v.s = lane.length;
      v.v = 0;
      return;
    }
    const nl = this.lanes[nextIdx];
    // is there room at the start of the next lane?
    const occupied = (this.byLane.get(nextIdx) ?? []).some((o) => o.s - o.spec.length / 2 < v.spec.length + 1.5 && o.s > -40 && (!v.slot || !o.slot || Math.sign(v.slot) === Math.sign(o.slot)));
    if (occupied) {
      v.s = lane.length;
      v.v = 0;
      return;
    }
    const a = lane.pts[lane.pts.length - 1];
    const b = nl.pts[0];
    // control point: the shared road node between the two lanes (midpoint of the offsets)
    const ex = lane.pts[lane.pts.length - 1][0] - lane.pts[lane.pts.length - 2][0];
    const ez = lane.pts[lane.pts.length - 1][1] - lane.pts[lane.pts.length - 2][1];
    const el = Math.hypot(ex, ez) || 1;
    const sx = nl.pts[1][0] - nl.pts[0][0], sz = nl.pts[1][1] - nl.pts[0][1];
    const sl = Math.hypot(sx, sz) || 1;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // intersection of the two tangents (fallback: midpoint)
    let cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
    const den = (ex / el) * (sz / sl) - (ez / el) * (sx / sl);
    if (Math.abs(den) > 0.2) {
      const t = ((b[0] - a[0]) * (sz / sl) - (b[1] - a[1]) * (sx / sl)) / den;
      if (t > 0 && t < d * 2) { cx = a[0] + (ex / el) * t; cz = a[1] + (ez / el) * t; }
    }
    const length = Math.max(1, d * 1.1);
    const ay = lane.ys[lane.ys.length - 1], by = nl.ys[0];
    v.conn = { ax: a[0], az: a[1], ay, cx, cz, bx: b[0], bz: b[1], by, length, to: nextIdx, t: 0 };
    if (v.next !== nextIdx) v.turnV = this.turnSpeed(v, lane, nl); // not chosen ahead (short lane)
    v.lane = nextIdx;
    v.s = -length;
    v.next = -1;
    v.vmax = Math.min(v.spec.maxSpeed, nl.speed) * (0.85 + this.R() * 0.25);
  }

  private frame = 0;
  private acc = 0;
  /** Fixed-step update (30 Hz, at most 3 steps a frame): cost no longer grows with the frame rate. */
  step(dt: number) {
    this.acc = Math.min(this.acc + dt, 0.1);
    while (this.acc >= 1 / 30) {
      this.update(1 / 30);
      this.acc -= 1 / 30;
    }
  }

  /**
   * Writes the smoothed pose of the vehicles (call once per rendered frame).
   * With `near`, only vehicles near the view are refreshed every frame; the
   * others on a rolling 1-in-8 schedule. A vehicle refreshed after a gap snaps
   * to its true place instead of gliding there.
   */
  pose(alpha = 0.35, dt = 1 / 60, near?: (x: number, z: number) => boolean) {
    this.frame++;
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      const wasFresh = v.fresh;
      v.fresh = !near || (i & 7) === (this.frame & 7) || near(v.x, v.z);
      if (!v.fresh) continue;
      const yaw0 = v.yaw;
      this.place(v, wasFresh ? alpha : 1);
      if (TWO_WHEEL.has(v.kind) && wasFresh) {
        // lean = atan(v·ω / g), smoothed and capped
        let d = v.yaw - yaw0;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        const target = Math.max(-0.4, Math.min(0.4, -Math.atan((v.v * d) / Math.max(1e-3, dt) / 9.81)));
        v.lean += (target - v.lean) * Math.min(1, dt * 6);
      }
    }
  }

  private place(v: Vehicle, alpha: number) {
    let x: number, z: number, y: number, dx: number, dz: number;
    if (v.conn) {
      const c = v.conn, t = c.t, u = 1 - t;
      x = u * u * c.ax + 2 * u * t * c.cx + t * t * c.bx;
      z = u * u * c.az + 2 * u * t * c.cz + t * t * c.bz;
      y = c.ay + (c.by - c.ay) * t;
      dx = 2 * u * (c.cx - c.ax) + 2 * t * (c.bx - c.cx);
      dz = 2 * u * (c.cz - c.az) + 2 * t * (c.bz - c.cz);
    } else {
      const p = sampleLane(this.lanes[v.lane], Math.max(0, Math.min(v.s, this.lanes[v.lane].length)), this.tmp);
      x = p.x; z = p.z; y = p.y ?? 0; dx = p.dx; dz = p.dz;
    }
    const l = Math.hypot(dx, dz) || 1;
    // lateral sub-lane for two-wheelers
    x += (-dz / l) * v.slot;
    z += (dx / l) * v.slot;
    const yaw = Math.atan2(dx, dz);
    if (alpha >= 1) {
      v.x = x; v.y = y; v.z = z; v.yaw = yaw;
    } else {
      // smoothing removes jitter from polyline corners without lagging behind
      v.x += (x - v.x) * Math.min(1, alpha * 3);
      v.z += (z - v.z) * Math.min(1, alpha * 3);
      v.y += (y - v.y) * alpha;
      let d = yaw - v.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      v.yaw += d * alpha;
    }
  }
}
