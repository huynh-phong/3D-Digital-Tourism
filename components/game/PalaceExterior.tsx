"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LEVEL, PALACE, PAVILION } from "@/data/dinh/layout";
import type { Quality } from "@/lib/store/settings";
import { Instances, M4, sectorGeo, useRunning, type Extra, type Mats } from "./Palace";

/*
 * Exterior of the palace re-modelled from reference groups 01–03 and 05
 * (DINH_DOC_LAP_TUYEN_CHON_ANH_DUNG_3D_1). The bay rhythm of the façade was
 * measured in pixels on the straight-on photo DDLP_0153 (23 bays ≈ 4 m: three
 * solid end bays with windows and carved reliefs, six stone-curtain bays each
 * side, a 15.5 m centre with the honour balcony). Heights are the photo's
 * proportions scaled to the model's storeys (estimated: no measured elevation
 * is published).
 */

const F = PALACE.front, RW = PALACE.rear;
/** Façade heights (m). */
export const FY = { fascia0: 5.0, fascia1: 6.4, win2a: 6.5, win2b: 8.1, cur0: 9.0, cur1: 17.0, win3a: 18.5, win3b: 20.1, eave0: 20.6, eave1: 21.9 } as const;
const WALL = 0.2; // outer face of the wall from its centre line
const FIN = { w: 0.45, d: 1.15 };
const CUR_ROWS = 3;

type SegKind = "end" | "curtain" | "centre";
interface Run {
  o: [number, number]; // world (x, z) of the run's left end seen from outside
  ry: number; // local +x along the run, local +z outward
  segs: [SegKind, number, number][]; // kind, length, bays
  stone: [number, number][]; // local x intervals clad in split stone on the ground storey
  y0: number; // bottom of the stone cladding
  ext: boolean; // extend horizontal bands over the corner at the run's end (convex corners)
}

const HP = Math.PI / 2;
const RUNS: Run[] = [
  // front (Nam Kỳ Khởi Nghĩa)
  { o: [F.x0, F.z1], ry: 0, segs: [["end", 13.25, 3], ["curtain", 24, 6], ["centre", 15.5, 3], ["curtain", 24, 6], ["end", 13.25, 3]], stone: [[0, 29]], y0: LEVEL.f1, ext: true },
  // sides of the front block
  { o: [F.x0, F.z0], ry: -HP, segs: [["end", 4, 1], ["curtain", 22, 5]], stone: [[0, 26]], y0: LEVEL.f1, ext: true },
  { o: [F.x1, F.z1], ry: HP, segs: [["curtain", 22, 5], ["end", 4, 1]], stone: [], y0: LEVEL.f1, ext: true },
  // back of the front block beside the rear wing
  { o: [RW.x0, F.z0], ry: Math.PI, segs: [["curtain", 20, 5], ["end", 4, 1]], stone: [[0, 24]], y0: 0, ext: true },
  { o: [F.x1, F.z0], ry: Math.PI, segs: [["end", 4, 1], ["curtain", 20, 5]], stone: [[0, 24]], y0: 0, ext: false },
  // rear wing (DDLP_0073: same curtain, split-stone ground storey)
  { o: [RW.x0, RW.z0], ry: -HP, segs: [["end", 4, 1], ["curtain", 44, 11], ["end", 4, 1]], stone: [[0, 52]], y0: 0, ext: false },
  { o: [RW.x1, F.z0], ry: HP, segs: [["end", 4, 1], ["curtain", 44, 11], ["end", 4, 1]], stone: [[0, 52]], y0: 0, ext: true },
  { o: [RW.x1, RW.z0], ry: Math.PI, segs: [["end", 9, 2], ["curtain", 24, 6], ["end", 9, 2]], stone: [[0, 42]], y0: 0, ext: true },
];

const runLen = (r: Run) => r.segs.reduce((a, s) => a + s[1], 0);
/** local (lx, y, lz) of a run → world matrix, scaled */
function at(r: Run, lx: number, y: number, lz: number, sx = 1, sy = 1, sz = 1) {
  const c = Math.cos(r.ry), s = Math.sin(r.ry);
  return M4(r.o[0] + c * lx + s * lz, y, r.o[1] - s * lx + c * lz, r.ry, sx, sy, sz);
}

/** One stone of the curtain: bamboo-node column of CUR_ROWS stones, joint radius 0.5 (scaled per run). */
function boneGeo(quality: Quality) {
  const radial = quality === "high" ? 14 : quality === "medium" ? 10 : 7;
  const h = FY.cur1 - FY.cur0, seg = h / CUR_ROWS, steps = 8;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.001, 0)];
  for (let r = 0; r < CUR_ROWS; r++) {
    for (let k = 0; k <= steps; k++) {
      if (r > 0 && k === 0) continue;
      const t = k / steps;
      const w = Math.pow(Math.abs(2 * t - 1), 1.6); // 1 at the joints, 0 mid-stone
      pts.push(new THREE.Vector2(0.15 + 0.35 * w, r * seg + t * seg));
    }
  }
  pts.push(new THREE.Vector2(0.001, h));
  return new THREE.LatheGeometry(pts, radial);
}

/** Façade elevations of every run: fins, bands, eave, stone curtain, windows, reliefs, split-stone ground storey, honour balcony. */
export function Elevations({ mats, extra, quality }: { mats: Mats; extra: Extra; quality: Quality }) {
  const geo = useMemo(() => ({ box: new THREE.BoxGeometry(1, 1, 1), plane: new THREE.PlaneGeometry(1, 1), bone: boneGeo(quality) }), [quality]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  const items = useMemo(() => {
    const plaster: THREE.Matrix4[] = [], stone: THREE.Matrix4[] = [], win: THREE.Matrix4[] = [], pane: THREE.Matrix4[] = [];
    const relief: THREE.Matrix4[] = [], bones: THREE.Matrix4[] = [], wood: THREE.Matrix4[] = [];
    const bx = (r: Run, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, out = plaster) =>
      out.push(at(r, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0));
    const pl = (r: Run, x0: number, x1: number, y0: number, y1: number, lz: number, out: THREE.Matrix4[]) =>
      out.push(at(r, (x0 + x1) / 2, (y0 + y1) / 2, lz, x1 - x0, y1 - y0, 1));
    /** framed window: glass pane + cream frame */
    const window = (r: Run, cx: number, w: number, y0: number, y1: number) => {
      pl(r, cx - w / 2, cx + w / 2, y0, y1, WALL + 0.02, pane);
      const t = 0.12, d0 = WALL, d1 = WALL + 0.12;
      bx(r, cx - w / 2 - t, cx - w / 2, y0 - t, y1 + t, d0, d1);
      bx(r, cx + w / 2, cx + w / 2 + t, y0 - t, y1 + t, d0, d1);
      bx(r, cx - w / 2, cx + w / 2, y1, y1 + t, d0, d1);
      bx(r, cx - w / 2 - 0.1, cx + w / 2 + 0.1, y0 - t - 0.04, y0, d0, d1 + 0.08); // sill
      bx(r, cx - 0.03, cx + 0.03, y0, y1, d0, WALL + 0.06); // mullion
    };

    for (const r of RUNS) {
      const L = runLen(r);
      const e = (d: number) => (r.ext ? d : 0);
      // corner pier at the start of the run
      bx(r, 0, 0.9, FY.fascia1, FY.eave0, WALL, WALL + FIN.d);
      // continuous bands: balcony fascia, ledges under/over the curtain, eave
      bx(r, 0, L + e(1.6), FY.fascia0, FY.fascia1, WALL, WALL + 1.6);
      bx(r, 0, L + e(FIN.d), FY.cur0 - 0.22, FY.cur0, WALL, WALL + FIN.d);
      bx(r, 0, L + e(FIN.d), FY.cur1, FY.cur1 + 0.22, WALL, WALL + FIN.d);
      bx(r, 0, L + e(2.2), FY.eave0, FY.eave1, WALL, WALL + 2.2);
      // window ribbons of floor 2 and of the top storey (behind the fins)
      pl(r, 0, L, FY.win2a, FY.win2b, WALL + 0.01, win);
      pl(r, 0, L, FY.win3a, FY.win3b, WALL + 0.01, win);
      // ground storey: split stone with framed windows, one per bay
      for (const [a, b] of r.stone) {
        pl(r, a, b, r.y0, FY.fascia0, WALL + 0.015, stone);
        const n = Math.max(1, Math.round((b - a) / 4));
        for (let k = 0; k < n; k++) window(r, a + ((b - a) * (k + 0.5)) / n, 1.15, r.y0 + 0.9, r.y0 + 2.8);
      }
      let x = 0;
      for (const [kind, len, bays] of r.segs) {
        const bw = len / bays;
        for (let k = 0; k < bays; k++) {
          const bx0 = x + k * bw, cx = bx0 + bw / 2;
          if (bx0 > 0.01) bx(r, bx0 - FIN.w / 2, bx0 + FIN.w / 2, FY.fascia1, FY.eave0, WALL, WALL + FIN.d); // fin
          if (kind === "end") {
            // two tall windows, each over a carved relief panel (DDLP_0191)
            window(r, cx, 1.3, 14.1, 15.95);
            window(r, cx, 1.3, 9.9, 12.7);
            pl(r, cx - 0.7, cx + 0.7, 12.78, 14.0, WALL + 0.03, relief);
            pl(r, cx - 0.7, cx + 0.7, 9.08, 9.78, WALL + 0.03, relief);
          }
        }
        if (kind === "curtain") {
          pl(r, x, x + len, FY.cur0, FY.cur1, WALL + 0.01, win);
          // stones on every third of a bay; the ones on bay lines sit behind the fins
          const s = bw / 3;
          for (let j = 0; j <= bays * 3; j++) {
            if ((j === 0 && x < 0.01) || (j === bays * 3 && x + len > L - 0.01)) continue;
            bones.push(at(r, x + j * s, FY.cur0, WALL + 0.48, s, 1, 0.62));
          }
        }
        if (kind === "centre") {
          pl(r, x, x + len, FY.cur0, FY.cur1, WALL + 0.01, win);
          // double fins at the edges of the centre (DDLP_0153)
          for (const ex of [x + 0.55, x + len - 0.55]) bx(r, ex - FIN.w / 2, ex + FIN.w / 2, FY.fascia1, FY.eave0, WALL, WALL + FIN.d);
          // honour balcony (bao lơn danh dự): projecting frame, parapet, three wood-framed windows
          const c = x + len / 2, hw = 5.6, d = WALL + 3.0;
          bx(r, c - hw, c + hw, 15.0, 15.5, WALL, d);
          bx(r, c - hw, c + hw, 8.45, 10.4, WALL, d);
          for (const s of [-1, 1]) bx(r, c + s * hw - (s > 0 ? 0.5 : 0), c + s * hw + (s < 0 ? 0.5 : 0), 10.4, 15.0, WALL, d);
          for (const wx of [-3.4, 0, 3.4]) {
            pl(r, c + wx - 1.5, c + wx + 1.5, 10.6, 14.8, WALL + 0.02, pane);
            for (const fx of [-1.5, -0.5, 0.5, 1.5]) bx(r, c + wx + fx - 0.05, c + wx + fx + 0.05, 10.6, 14.8, WALL, WALL + 0.1, wood);
            bx(r, c + wx - 1.55, c + wx + 1.55, 13.3, 13.4, WALL, WALL + 0.1, wood);
            bx(r, c + wx - 1.55, c + wx + 1.55, 14.8, 14.95, WALL, WALL + 0.1, wood);
          }
        }
        x += len;
      }
    }
    // split stone on the porch plinth (front face beside the steps, both ends)
    const porch: Run = { o: [F.x0 - 2, F.z1 + 4], ry: 0, segs: [], stone: [], y0: 0, ext: false };
    pl(porch, 0, 39, 0, LEVEL.f1, 0.012, stone); // steps at x −8…8
    pl(porch, 55, 94, 0, LEVEL.f1, 0.012, stone);
    for (const sx of [-1, 1] as const) {
      const side: Run = { o: [sx * (F.x1 + 2), sx < 0 ? F.z0 : F.z1 + 4], ry: sx < 0 ? -HP : HP, segs: [], stone: [], y0: 0, ext: false };
      pl(side, 0, F.z1 + 4 - F.z0, 0, LEVEL.f1, 0.012, stone);
    }
    return { plaster, stone, win, pane, relief, bones, wood };
  }, []);

  const shadow = quality !== "low";
  return (
    <group>
      <Instances geometry={geo.box} material={mats.facade} items={items.plaster} castShadow={shadow} />
      <Instances geometry={geo.box} material={mats.wood} items={items.wood} />
      <Instances geometry={geo.plane} material={extra.stoneRubble} items={items.stone} />
      <Instances geometry={geo.plane} material={extra.windows} items={items.win} />
      <Instances geometry={geo.plane} material={extra.winPane} items={items.pane} />
      <Instances geometry={geo.plane} material={extra.relief} items={items.relief} />
      <Instances geometry={geo.bone} material={mats.curtain} items={items.bones} castShadow={quality === "high"} />
    </group>
  );
}

/* ------------------------------------------------------------ lawn fountain */
/** Faceted "diamond" drum of the lawn fountain (DDLP_0074, 0189, 0194): two bands of triangles. */
function drumGeo(n = 14, r = 1.55, out = 0.28, h = 0.9) {
  const pos: number[] = [];
  const P = (ring: number, i: number): [number, number, number] => {
    const off = ring === 1 ? 0.5 : 0;
    const a = ((i + off) / n) * Math.PI * 2, rr = ring === 1 ? r + out : r;
    return [Math.cos(a) * rr, (ring * h) / 2, Math.sin(a) * rr];
  };
  for (let i = 0; i < n; i++) {
    for (const [lo, hi] of [[0, 1], [2, 1]] as const) {
      const a = P(lo, i), b = P(lo, i + 1), m = P(hi, i), m0 = P(hi, i - 1);
      pos.push(...a, ...m, ...b, ...a, ...m0, ...m);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function LawnFountain({ x, z, mats, extra }: { x: number; z: number; mats: Mats; extra: Extra }) {
  const geo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(1.45, 1.2, 0), new THREE.Vector3(3.6, 4.2, 0), new THREE.Vector3(5.8, 0.3, 0));
    return {
      hedge: sectorGeo(7.75, 8.7, 0, Math.PI * 2, 0.75, 96),
      curb: sectorGeo(7.0, 7.65, 0, Math.PI * 2, 0.4, 96),
      drum: drumGeo(),
      arc: new THREE.TubeGeometry(curve, 18, 0.03, 4),
    };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const arcs = useMemo(() => Array.from({ length: 40 }, (_, i) => M4(0, 0, 0, (i / 40) * Math.PI * 2)), []);
  const jets = useRef<THREE.Group>(null);
  const running = useRunning();
  useFrame((s) => {
    if (!running || !jets.current) return;
    const t = s.clock.elapsedTime;
    jets.current.scale.set(1 + Math.sin(t * 2.1) * 0.03, 1 + Math.sin(t * 3.3) * 0.05, 1 + Math.sin(t * 2.1) * 0.03);
  });
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={geo.hedge} material={extra.hedge} castShadow receiveShadow />
      <mesh geometry={geo.curb} material={mats.stone} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <circleGeometry args={[7.05, 64]} />
        <meshStandardMaterial color="#2a3b40" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]} material={extra.water}>
        <circleGeometry args={[7.05, 64]} />
      </mesh>
      <mesh geometry={geo.drum} position={[0, 0.3, 0]} material={extra.fountainWhite} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.2, 0]} material={extra.fountainWhite}>
        <circleGeometry args={[1.55, 14]} />
      </mesh>
      <group ref={jets}>
        <Instances geometry={geo.arc} material={extra.jet} items={arcs} receiveShadow={false} />
        {/* tall central plume (DDLP_0061, 0189) */}
        <mesh position={[0, 4.4, 0]} material={extra.jet}>
          <coneGeometry args={[0.16, 6.4, 10, 1, true]} />
        </mesh>
        <mesh position={[0, 1.9, 0]} rotation={[Math.PI, 0, 0]} material={extra.jet}>
          <coneGeometry args={[1.3, 1.4, 16, 1, true]} />
        </mesh>
      </group>
    </group>
  );
}

/** Clipped conifers along the base of the façade and cloud-pruned topiary beside the steps (DDLP_0153, 0071, 0299). */
export function Topiary({ extra }: { extra: Extra }) {
  const geo = useMemo(() => ({ cone: new THREE.ConeGeometry(0.75, 2.3, 10), ball: new THREE.IcosahedronGeometry(0.55, 1) }), []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const items = useMemo(() => {
    const cones: THREE.Matrix4[] = [], balls: THREE.Matrix4[] = [];
    for (const s of [-1, 1]) for (const ax of [25, 31, 37, 43]) cones.push(M4(s * ax, 1.15, F.z1 + 5.2));
    for (const s of [-1, 1]) {
      // stacked cloud-pruned tiers on the porch at the step ends
      [[0, 0.6, 1.1], [0.15, 1.45, 0.85], [-0.1, 2.15, 0.65], [0.05, 2.7, 0.45]].forEach(([dx, y, k]) => balls.push(M4(s * 9.4 + dx, LEVEL.f1 + y, F.z1 + 3.2, 0, k, k * 0.8, k)));
    }
    return { cones, balls };
  }, []);
  return (
    <group>
      <Instances geometry={geo.cone} material={extra.hedge} items={items.cones} castShadow />
      <Instances geometry={geo.ball} material={extra.hedge} items={items.balls} castShadow />
    </group>
  );
}

/* ----------------------------------------------------------------- roofline */
/** A frond bent from upright to drooping (areca / fern). */
function frondGeo(len = 2.4, w = 0.5) {
  const g = new THREE.PlaneGeometry(w, len, 1, 8);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const v = p.getY(i) + len / 2;
    const t = v / len;
    p.setXYZ(i, p.getX(i) * (1 - t * 0.7), v * Math.sin(0.95) - 0.6 * v * t, v * Math.cos(0.6));
  }
  g.computeVertexNormals();
  return g;
}

/**
 * What is seen of the roof from the grounds and the terrace: potted areca palms
 * and lamp posts along the front edge, the antenna mast, the deep fascia and the
 * railing of the Tứ phương vô sự pavilion (DDLP_0153, 0155, 0197, 0073), and the
 * paving of the terrace (DDLP_0106, 0246).
 */
export function Roofline({ mats, extra }: { mats: Mats; extra: Extra }) {
  const y = LEVEL.roof;
  const geo = useMemo(() => ({ frond: frondGeo(), pot: new THREE.CylinderGeometry(0.38, 0.28, 0.6, 12), trunk: new THREE.CylinderGeometry(0.07, 0.11, 2.6, 6), box: new THREE.BoxGeometry(1, 1, 1) }), []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const P = PAVILION;
  const items = useMemo(() => {
    const pots: THREE.Matrix4[] = [], trunks: THREE.Matrix4[] = [], fronds: THREE.Matrix4[] = [], metal: THREE.Matrix4[] = [], plaster: THREE.Matrix4[] = [];
    const palm = (x: number, z: number, k: number) => {
      pots.push(M4(x, y + 0.3, z));
      trunks.push(M4(x, y + 1.9, z));
      for (let i = 0; i < 9; i++) fronds.push(M4(x, y + 3.15, z, (i / 9) * Math.PI * 2 + k, 1, 1, 1));
    };
    [-40, -33.5, -27, -20.5, 20.5, 27, 33.5, 40].forEach((x, i) => palm(x, F.z1 - 1.6, i));
    // lamp posts between the palms
    for (const x of [-36.7, -23.7, 23.7, 36.7]) {
      metal.push(M4(x, y + 1.6, F.z1 - 1.4, 0, 0.08, 3.2, 0.08));
      metal.push(M4(x, y + 3.25, F.z1 - 1.4, 0, 0.32, 0.18, 0.32));
    }
    // antenna mast at the right end of the roof (DDLP_0153: crossed elements)
    const ax = 33, az = -16;
    metal.push(M4(ax, y + 3.5, az, 0, 0.14, 7, 0.14));
    for (let i = 0; i < 4; i++) metal.push(M4(ax, y + 6.2 + (i % 2) * 0.7, az, (i * Math.PI) / 4, 3.2 - i * 0.4, 0.06, 0.06));
    // pavilion: deep fascia ring round the gallery roof
    const fx = P.outer.x + 2.2, z0 = P.outer.z0 - 2.2, z1 = P.outer.z1 + 2.2, fy0 = y + 4.0, fy1 = y + 5.4;
    const B = (x0: number, x1: number, y0: number, y1: number, za: number, zb: number) => plaster.push(M4((x0 + x1) / 2, (y0 + y1) / 2, (za + zb) / 2, 0, x1 - x0, y1 - y0, zb - za));
    B(-fx, fx, fy0, fy1, z1 - 0.3, z1);
    B(-fx, fx, fy0, fy1, z0, z0 + 0.3);
    B(-fx, -fx + 0.3, fy0, fy1, z0, z1);
    B(fx - 0.3, fx, fy0, fy1, z0, z1);
    // soffit + cap between the fascia and the gallery roof
    B(-fx, fx, fy0, fy0 + 0.12, P.outer.z1 + 1, z1);
    B(-fx, fx, fy0, fy0 + 0.12, z0, P.outer.z0 - 1);
    B(-fx, -P.outer.x - 1, fy0, fy0 + 0.12, P.outer.z0 - 1, P.outer.z1 + 1);
    B(P.outer.x + 1, fx, fy0, fy0 + 0.12, P.outer.z0 - 1, P.outer.z1 + 1);
    // pavilion railing on the front edge
    const rz = P.outer.z1 + 0.6;
    metal.push(M4(0, y + 1.05, rz, 0, P.outer.x * 2, 0.07, 0.07));
    for (let x = -P.outer.x; x <= P.outer.x + 0.01; x += 0.3) if (Math.abs(x) > 2.2) metal.push(M4(x, y + 0.52, rz, 0, 0.035, 1.04, 0.035));
    return { pots, trunks, fronds, metal, plaster };
  }, [P, y]);
  return (
    <group>
      {/* terrace paving (front block + rear wing) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.008, (F.z0 + F.z1) / 2]} material={extra.roofPaver} receiveShadow>
        <planeGeometry args={[F.x1 - F.x0, F.z1 - F.z0]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.008, (RW.z0 + F.z0) / 2]} material={extra.roofPaver} receiveShadow>
        <planeGeometry args={[RW.x1 - RW.x0, F.z0 - RW.z0]} />
      </mesh>
      <Instances geometry={geo.pot} material={extra.terracotta} items={items.pots} castShadow />
      <Instances geometry={geo.trunk} material={extra.bark} items={items.trunks} />
      <Instances geometry={geo.frond} material={extra.palm} items={items.fronds} castShadow />
      <Instances geometry={geo.box} material={mats.metal} items={items.metal} />
      <Instances geometry={geo.box} material={mats.facade} items={items.plaster} castShadow />
    </group>
  );
}

/* ------------------------------------------------------------------ helipad */
/** Simplified UH-1 on the roof terrace (exhibit seen in DDLP_0106, 0246): fuselage, tail boom, rotors, skids. */
function Helicopter({ p, ry, mats, extra }: { p: [number, number, number]; ry: number; mats: Mats; extra: Extra }) {
  const body = useMemo(() => {
    const pts = [[0.001, -2.6], [0.6, -2.4], [0.95, -1.8], [1.1, -0.8], [1.1, 1.2], [0.9, 2.2], [0.45, 2.6], [0.001, 2.65]].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, 16);
    g.rotateZ(-Math.PI / 2); // along +x, nose at -x … turned below
    g.scale(1, 0.95, 0.8);
    return g;
  }, []);
  useEffect(() => () => body.dispose(), [body]);
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <mesh geometry={body} position={[0, 1.55, 0]} rotation={[0, Math.PI, 0]} material={extra.camo} castShadow />
      {/* cabin windows */}
      <mesh position={[-2.25, 1.85, 0]} rotation={[0, 0, 0.5]} material={mats.dark}><boxGeometry args={[0.7, 0.7, 1.3]} /></mesh>
      {/* tail boom, fin, tail rotor */}
      <mesh position={[4.9, 1.8, 0]} rotation={[0, 0, Math.PI / 2 + 0.04]} material={extra.camo} castShadow><cylinderGeometry args={[0.18, 0.42, 5.2, 10]} /></mesh>
      <mesh position={[7.3, 2.5, 0]} rotation={[0, 0, -0.35]} material={extra.camo}><boxGeometry args={[0.6, 1.5, 0.1]} /></mesh>
      <mesh position={[7.4, 2.4, 0.2]} rotation={[Math.PI / 2, 0, 0]} material={mats.dark}><boxGeometry args={[0.12, 1.6, 0.04]} /></mesh>
      {/* mast + two-blade main rotor (UH-1: about 14.6 m) */}
      <mesh position={[0.2, 2.75, 0]} material={mats.dark}><cylinderGeometry args={[0.12, 0.16, 0.5, 8]} /></mesh>
      <mesh position={[0.2, 3.02, 0]} rotation={[0, 0.5, 0]} material={mats.dark}><boxGeometry args={[14.6, 0.05, 0.5]} /></mesh>
      {/* skids */}
      {[-0.95, 0.95].map((z) => (
        <group key={z}>
          <mesh position={[-0.2, 0.08, z]} rotation={[0, 0, Math.PI / 2]} material={mats.metal}><cylinderGeometry args={[0.05, 0.05, 4.4, 6]} /></mesh>
          {[-1.1, 0.9].map((x) => (
            <mesh key={x} position={[x, 0.45, z * 0.8]} rotation={[z > 0 ? -0.35 : 0.35, 0, 0]} material={mats.metal}><cylinderGeometry args={[0.04, 0.04, 0.85, 6]} /></mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * Rear terrace used as helipad (DDLP_0106, 0246): the helicopter, the two red
 * circles painted on the paving, potted ferns along the parapet and the two
 * small white structures at the back corners.
 */
export function Helipad({ mats, extra }: { mats: Mats; extra: Extra }) {
  const y = LEVEL.roof;
  const geo = useMemo(() => ({ pot: new THREE.CylinderGeometry(0.3, 0.22, 0.45, 10), fern: new THREE.IcosahedronGeometry(0.55, 1) }), []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const ferns = useMemo(() => {
    const out: { pots: THREE.Matrix4[]; leaves: THREE.Matrix4[] } = { pots: [], leaves: [] };
    const add = (x: number, z: number) => {
      out.pots.push(M4(x, y + 0.22, z));
      out.leaves.push(M4(x, y + 0.75, z, x * z, 1, 0.65, 1));
    };
    for (let z = -84; z <= -40; z += 5.5) { add(RW.x0 + 0.9, z); add(RW.x1 - 0.9, z); }
    for (let x = -16; x <= 16; x += 5.3) add(x, RW.z0 + 0.9);
    return out;
  }, [y]);
  return (
    <group>
      <Helicopter p={[-4, y, -52]} ry={Math.PI / 2} mats={mats} extra={extra} />
      {/* the two bomb hits of 8/4/1975 on the helipad, marked with red painted circles (official site) */}
      {[[-9, -64], [7, -45]].map(([x, z]) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, y + 0.014, z]}>
          <ringGeometry args={[1.35, 1.6, 48]} />
          <meshStandardMaterial color="#c0353a" roughness={0.8} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 16.5, y, RW.z0 + 2.5]}>
          <mesh position={[0, 0.8, 0]} material={mats.facade} castShadow><boxGeometry args={[2.4, 1.6, 2.2]} /></mesh>
          <mesh position={[0, 1.66, 0]} material={mats.facade}><boxGeometry args={[2.8, 0.14, 2.6]} /></mesh>
        </group>
      ))}
      <Instances geometry={geo.pot} material={extra.terracotta} items={ferns.pots} />
      <Instances geometry={geo.fern} material={extra.palm} items={ferns.leaves} />
    </group>
  );
}
