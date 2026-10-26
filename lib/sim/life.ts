import { rng } from "@/lib/geo";
import type { P2 } from "@/lib/city/types";

/**
 * PedestrianSimulation + AmbientCreatureSimulation.
 * People only live on walkable data from the city build (sidewalk paths,
 * parks, plazas); creatures only where their habitat exists (parks, plazas,
 * river banks, open sky above the skyline).
 */

type Mode = "path" | "wander" | "group" | "gaze";

export interface Person {
  mode: Mode;
  x: number; z: number; yaw: number;
  speed: number;
  move: number; // 0 standing … 1 walking (animation blend)
  phase: number;
  wait: number; // seconds left standing
  // path walkers
  path: number; s: number; dir: 1 | -1; off: number;
  // wanderers
  space: number; tx: number; tz: number; node: number;
  color: number; // palette index
}

export interface Pet { kind: "dog" | "cat"; owner: number; x: number; z: number; yaw: number; move: number; phase: number }

const turnTo = (cur: number, want: number, k: number) => {
  let d = want - cur;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return cur + d * Math.min(1, k);
};

export class PedestrianSimulation {
  readonly people: Person[] = [];
  readonly pets: Pet[] = [];
  private R: () => number;
  private paths: { pts: P2[]; cum: number[]; length: number }[];
  private grid = new Map<number, number[]>();

  constructor(sidewalks: P2[][], readonly spaces: { kind: "park" | "plaza"; pts: P2[]; links: number[][] }[], counts: { walkers: number; strollers: number; groups: number; pets: number }, seed = 21) {
    this.R = rng(seed);
    const R = this.R;
    this.paths = sidewalks.map((pts) => {
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      return { pts, cum, length: cum[cum.length - 1] };
    }).filter((p) => p.length > 25);
    const base = (): Person => ({ mode: "path", x: 0, z: 0, yaw: 0, speed: 1.1 + R() * 0.5, move: 1, phase: R() * 10, wait: 0, path: 0, s: 0, dir: 1, off: 0, space: 0, tx: 0, tz: 0, node: 0, color: Math.floor(R() * 1e6) });

    // sidewalk walkers, weighted by path length
    const total = this.paths.reduce((a, p) => a + p.length, 0);
    for (let i = 0; i < counts.walkers && total; i++) {
      let r = R() * total, pi = 0;
      while (pi < this.paths.length - 1 && (r -= this.paths[pi].length) > 0) pi++;
      const p = base();
      p.path = pi;
      p.s = R() * this.paths[pi].length;
      p.dir = R() < 0.5 ? 1 : -1;
      p.off = (R() - 0.5) * 1.6;
      this.people.push(p);
    }
    if (!spaces.length) return;
    // park strollers, people gazing at the view, and chatting groups
    for (let i = 0; i < counts.strollers; i++) {
      const p = base();
      p.mode = R() < 0.25 ? "gaze" : "wander";
      p.space = Math.floor(R() * spaces.length);
      p.node = Math.floor(R() * spaces[p.space].pts.length);
      const pt = spaces[p.space].pts[p.node];
      p.x = pt[0];
      p.z = pt[1];
      p.tx = p.x; p.tz = p.z;
      p.speed = 0.8 + R() * 0.4;
      p.wait = R() * 6;
      p.yaw = R() * Math.PI * 2;
      this.people.push(p);
    }
    for (let g = 0; g < counts.groups; g++) {
      const space = Math.floor(R() * spaces.length);
      const c = spaces[space].pts[Math.floor(R() * spaces[space].pts.length)];
      const n = 2 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + R() * 0.3;
        const p = base();
        p.mode = "group";
        p.space = space;
        p.x = c[0] + Math.cos(a) * 0.75;
        p.z = c[1] + Math.sin(a) * 0.75;
        p.yaw = Math.atan2(c[0] - p.x, c[1] - p.z); // face the middle of the group
        p.move = 0;
        this.people.push(p);
      }
    }
    // pets: dogs walk with park strollers, cats rest in parks
    const owners = this.people.map((p, i) => (p.mode === "wander" ? i : -1)).filter((i) => i >= 0);
    for (let i = 0; i < counts.pets; i++) {
      if (R() < 0.65 && owners.length) {
        const owner = owners[Math.floor(R() * owners.length)];
        const o = this.people[owner];
        this.pets.push({ kind: "dog", owner, x: o.x + 1, z: o.z, yaw: o.yaw, move: 0, phase: R() * 10 });
      } else {
        const sp = spaces[Math.floor(R() * spaces.length)];
        if (sp.kind !== "park") continue;
        const pt = sp.pts[Math.floor(R() * sp.pts.length)];
        this.pets.push({ kind: "cat", owner: -1, x: pt[0] + 1.5, z: pt[1], yaw: R() * 6, move: 0, phase: R() * 10 });
      }
    }
    this.update(0.01);
  }

  update(dt: number) {
    dt = Math.min(dt, 0.1);
    const R = this.R;
    for (const p of this.people) {
      if (p.mode === "path") {
        const path = this.paths[p.path];
        if (p.wait > 0) {
          p.wait -= dt;
          p.move = Math.max(0, p.move - dt * 3);
          if (p.wait <= 0 && R() < 0.5) p.dir = p.dir === 1 ? -1 : 1; // sometimes turn back
        } else {
          p.move = Math.min(1, p.move + dt * 3);
          p.s += p.speed * p.dir * dt;
          if (p.s < 0 || p.s > path.length) {
            p.s = Math.max(0, Math.min(path.length, p.s));
            p.dir = p.dir === 1 ? -1 : 1;
            p.wait = 1 + R() * 2;
          } else if (R() < dt * 0.02) p.wait = 2 + R() * 4; // window shopping
        }
        // position on the polyline + lateral offset
        const cum = path.cum;
        let i = 1;
        while (i < cum.length - 1 && cum[i] < p.s) i++;
        const a = path.pts[i - 1], b = path.pts[i];
        const seg = cum[i] - cum[i - 1] || 1;
        const t = Math.max(0, Math.min(1, (p.s - cum[i - 1]) / seg));
        const dx = (b[0] - a[0]) / seg, dz = (b[1] - a[1]) / seg;
        p.x = a[0] + (b[0] - a[0]) * t - dz * p.off;
        p.z = a[1] + (b[1] - a[1]) * t + dx * p.off;
        p.yaw = turnTo(p.yaw, Math.atan2(dx * p.dir, dz * p.dir), dt * 6);
      } else if (p.mode === "wander") {
        const dx = p.tx - p.x, dz = p.tz - p.z;
        const d = Math.hypot(dx, dz);
        if (p.wait > 0) {
          p.wait -= dt;
          p.move = Math.max(0, p.move - dt * 2);
          if (p.wait <= 0) {
            // next waypoint: a linked neighbour (the straight line to it is clear)
            const sp = this.spaces[p.space];
            const nb = sp.links[p.node] ?? [];
            if (nb.length) p.node = nb[Math.floor(R() * nb.length)];
            p.tx = sp.pts[p.node][0];
            p.tz = sp.pts[p.node][1];
          }
        } else if (d < 0.5) {
          p.wait = 3 + R() * 8;
        } else {
          p.move = Math.min(1, p.move + dt * 2);
          const want = Math.atan2(dx, dz);
          p.yaw = turnTo(p.yaw, want, dt * 4);
          // walk mostly where we face: no sideways sliding
          const f = Math.max(0, Math.cos(want - p.yaw));
          p.x += Math.sin(p.yaw) * p.speed * f * dt;
          p.z += Math.cos(p.yaw) * p.speed * f * dt;
        }
      } else if (p.mode === "gaze") {
        p.move = 0;
        p.wait -= dt;
        if (p.wait <= 0) {
          p.wait = 6 + R() * 10;
          p.tx = p.yaw + (R() - 0.5) * 1.6; // look somewhere else
        }
        p.yaw = turnTo(p.yaw, p.tx, dt * 1.2);
      }
    }
    this.separate();
    for (const pet of this.pets) {
      if (pet.kind === "cat") {
        pet.move = 0;
        continue;
      }
      const o = this.people[pet.owner];
      const fx = o.x + Math.sin(o.yaw + 1.2) * 1.1, fz = o.z + Math.cos(o.yaw + 1.2) * 1.1;
      const dx = fx - pet.x, dz = fz - pet.z;
      const d = Math.hypot(dx, dz);
      const sp = Math.min(3, d * 1.5);
      pet.move = Math.min(1, sp / 1.2);
      if (d > 0.05) {
        pet.yaw = turnTo(pet.yaw, Math.atan2(dx, dz), dt * 5);
        pet.x += (dx / d) * sp * dt;
        pet.z += (dz / d) * sp * dt;
      }
    }
  }

  /** Push walkers apart so silhouettes don't overlap (2 m hash grid). */
  private separate() {
    this.grid.clear();
    const key = (x: number, z: number) => (Math.floor(x / 2) + 4096) * 8192 + Math.floor(z / 2) + 4096;
    this.people.forEach((p, i) => {
      const k = key(p.x, p.z);
      let c = this.grid.get(k);
      if (!c) this.grid.set(k, (c = []));
      c.push(i);
    });
    for (const [k, cell] of this.grid) {
      if (cell.length < 2 && !this.grid.has(k + 1) && !this.grid.has(k + 8192)) continue;
      const near = [...cell, ...(this.grid.get(k + 1) ?? []), ...(this.grid.get(k + 8192) ?? []), ...(this.grid.get(k + 8193) ?? [])];
      for (let a = 0; a < near.length; a++) for (let b = a + 1; b < near.length; b++) {
        const p = this.people[near[a]], q = this.people[near[b]];
        const dx = q.x - p.x, dz = q.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.55 || d < 1e-4) continue;
        const push = (0.55 - d) / 2;
        if (p.mode === "path") p.off -= Math.sign(p.off || 1) * push * 0.5;
        else if (p.mode === "wander") { p.x -= (dx / d) * push * 0.3; p.z -= (dz / d) * push * 0.3; }
        if (q.mode === "path") q.off += Math.sign(q.off || 1) * push * 0.5;
        else if (q.mode === "wander") { q.x += (dx / d) * push * 0.3; q.z += (dz / d) * push * 0.3; }
        p.off = Math.max(-1.1, Math.min(1.1, p.off));
        q.off = Math.max(-1.1, Math.min(1.1, q.off));
      }
    }
  }
}

/* ------------------------------------------------------------ creatures */

export interface Bird { flock: number; ox: number; oy: number; oz: number; phase: number; x: number; y: number; z: number; yaw: number; bank: number }
interface Flock { cx: number; cz: number; rx: number; rz: number; alt: number; speed: number; t: number; tilt: number }
export interface GroundBird { kind: "pigeon" | "egret"; x: number; z: number; yaw: number; hop: number; phase: number; hx: number; hz: number }

export class AmbientCreatureSimulation {
  readonly birds: Bird[] = [];
  readonly ground: GroundBird[] = [];
  private flocks: Flock[] = [];
  private time = 0;
  private R: () => number;

  constructor(
    anchors: { parks: P2[]; plazas: P2[]; banks: P2[]; river: P2[] },
    skyline: (x: number, z: number) => number,
    counts: { flocks: number; pigeons: number; egrets: number },
    seed = 99,
  ) {
    this.R = rng(seed);
    const R = this.R;
    const centres = [...anchors.parks, ...anchors.river];
    for (let f = 0; f < counts.flocks && centres.length; f++) {
      const c = centres[Math.floor(R() * centres.length)];
      const rx = 90 + R() * 160, rz = 70 + R() * 140;
      // fly above everything along the loop
      const tilt = R() * 6.28;
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      // highest roof anywhere under the (rotated) loop, incl. the flock's spread
      let top = 0;
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        const lx = Math.cos(a) * rx, lz = Math.sin(a) * rz;
        for (const m of [-12, 0, 12]) for (const n of [-12, 0, 12])
          top = Math.max(top, skyline(c[0] + lx * ct - lz * st + m, c[1] + lx * st + lz * ct + n));
      }
      this.flocks.push({ cx: c[0], cz: c[1], rx, rz, alt: top + 25 + R() * 30, speed: (9 + R() * 4) / Math.max(rx, rz), t: R() * 6.28, tilt });
      const n = 5 + Math.floor(R() * 7);
      for (let b = 0; b < n; b++) {
        this.birds.push({ flock: f, ox: (R() - 0.5) * 14, oy: (R() - 0.5) * 5, oz: (R() - 0.5) * 14, phase: R() * 10, x: 0, y: 0, z: 0, yaw: 0, bank: 0 });
      }
    }
    for (let i = 0; i < counts.pigeons && anchors.plazas.length + anchors.parks.length; i++) {
      const pool = anchors.plazas.length && R() < 0.7 ? anchors.plazas : anchors.parks;
      const c = pool[Math.floor(R() * pool.length)];
      const x = c[0] + (R() - 0.5) * 6, z = c[1] + (R() - 0.5) * 6;
      this.ground.push({ kind: "pigeon", x, z, yaw: R() * 6.28, hop: 0, phase: R() * 10, hx: x, hz: z });
    }
    for (let i = 0; i < counts.egrets && anchors.banks.length; i++) {
      const c = anchors.banks[Math.floor(R() * anchors.banks.length)];
      this.ground.push({ kind: "egret", x: c[0], z: c[1], yaw: R() * 6.28, hop: 0, phase: R() * 10, hx: c[0], hz: c[1] });
    }
    this.update(0.01);
  }

  update(dt: number) {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    for (const f of this.flocks) f.t += f.speed * dt;
    for (const b of this.birds) {
      const f = this.flocks[b.flock];
      // smooth closed loop (rotated ellipse with a slow wobble) + per-bird offset
      const t = f.t + b.oz * 0.002;
      const cx = Math.cos(t) * f.rx, cz = Math.sin(t) * f.rz;
      const ct = Math.cos(f.tilt), st = Math.sin(f.tilt);
      const x = f.cx + cx * ct - cz * st + b.ox + Math.sin(this.time * 0.7 + b.phase) * 2;
      const z = f.cz + cx * st + cz * ct + b.oz + Math.cos(this.time * 0.6 + b.phase) * 2;
      const y = f.alt + b.oy + Math.sin(this.time * 0.9 + b.phase) * 1.5;
      const dx = x - b.x, dz = z - b.z;
      if (Math.hypot(dx, dz) > 1e-3) {
        const want = Math.atan2(dx, dz);
        let d = want - b.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        b.bank = -d * 6;
        b.yaw += d * Math.min(1, dt * 3);
      }
      b.x = x; b.y = y; b.z = z;
    }
    const R = this.R;
    for (const g of this.ground) {
      // short hops around a home spot; egrets mostly stand still
      if (g.hop > 0) {
        g.hop -= dt;
        const sp = g.kind === "pigeon" ? 0.8 : 0.3;
        g.x += Math.sin(g.yaw) * sp * dt;
        g.z += Math.cos(g.yaw) * sp * dt;
      } else if (R() < dt * (g.kind === "pigeon" ? 0.6 : 0.08)) {
        const back = Math.hypot(g.x - g.hx, g.z - g.hz) > 3;
        g.yaw = back ? Math.atan2(g.hx - g.x, g.hz - g.z) : g.yaw + (R() - 0.5) * 2;
        g.hop = 0.4 + R() * 0.8;
      }
    }
  }
}
