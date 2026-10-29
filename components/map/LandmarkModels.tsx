"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { GROUNDS, PALACE } from "@/data/dinh/layout";
import type { Frame } from "@/lib/city/footprint";
import type { P2 } from "@/lib/city/types";

/**
 * Stylised landmark models. They are recognisable silhouettes sized to the
 * OSM footprint — NOT architectural reconstructions (stated in the UI legend).
 */

const M = {
  cream: new THREE.MeshStandardMaterial({ color: "#f1e8d6", roughness: 0.8 }),
  white: new THREE.MeshStandardMaterial({ color: "#f5f3ee", roughness: 0.7 }),
  brick: new THREE.MeshStandardMaterial({ color: "#b4553d", roughness: 0.85 }),
  slate: new THREE.MeshStandardMaterial({ color: "#5d6b78", roughness: 0.6 }),
  yellow: new THREE.MeshStandardMaterial({ color: "#e8c171", roughness: 0.75 }),
  roofRed: new THREE.MeshStandardMaterial({ color: "#a2543f", roughness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({ color: "#8fb4cf", roughness: 0.15, metalness: 0.6 }),
  dark: new THREE.MeshStandardMaterial({ color: "#3b4148", roughness: 0.6 }),
  lawn: new THREE.MeshStandardMaterial({ color: "#7fb86a", roughness: 1 }),
  grounds: new THREE.MeshStandardMaterial({ color: "#9cc884", roughness: 1 }),
  path: new THREE.MeshStandardMaterial({ color: "#d9d2c3", roughness: 1 }),
  water: new THREE.MeshStandardMaterial({ color: "#5fa2c9", roughness: 0.2, metalness: 0.1 }),
  stone: new THREE.MeshStandardMaterial({ color: "#e4ddcd", roughness: 0.9 }),
  green: new THREE.MeshStandardMaterial({ color: "#3f7a4a", roughness: 0.9 }),
};

function Box({ p, s, m, r = 0 }: { p: [number, number, number]; s: [number, number, number]; m: THREE.Material; r?: number }) {
  return (
    <mesh position={p} rotation={[0, r, 0]} material={m} castShadow receiveShadow>
      <boxGeometry args={s} />
    </mesh>
  );
}

function Pyramid({ p, w, h, m }: { p: [number, number, number]; w: number; h: number; m: THREE.Material }) {
  return (
    <mesh position={[p[0], p[1] + h / 2, p[2]]} rotation={[0, Math.PI / 4, 0]} material={m}>
      <coneGeometry args={[w * 0.72, h, 4]} />
    </mesh>
  );
}

/** Gabled roof: ridge along local x, spanning `w` in z, rising `h`. */
function Gable({ p, l, w, h, m }: { p: [number, number, number]; l: number; w: number; h: number; m: THREE.Material }) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: l, bevelEnabled: false });
    g.translate(0, 0, -l / 2);
    g.rotateY(Math.PI / 2);
    return g;
  }, [l, w, h]);
  return <mesh geometry={geo} position={p} material={m} />;
}

/** Independence Palace with its grounds, built from the same layout data as the walkable scene. */
export function PalaceMini() {
  const { front, rear } = PALACE;
  const fw = front.x1 - front.x0, fd = front.z1 - front.z0;
  const rw = rear.x1 - rear.x0, rd = rear.z1 - rear.z0;
  const curtain = useMemo(() => {
    const g = new THREE.BoxGeometry(0.5, 4.2, 0.5);
    return g;
  }, []);
  const curtainCount = Math.floor(fw / 1.4);
  return (
    <group>
      {/* grounds */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]} material={M.grounds} receiveShadow>
        <planeGeometry args={[GROUNDS.halfW * 2, GROUNDS.halfD * 2]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[GROUNDS.lawnCenter[0], 0.11, GROUNDS.lawnCenter[1]]} material={M.path}>
        <circleGeometry args={[GROUNDS.ringRadius + GROUNDS.ringWidth / 2, 48]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[GROUNDS.lawnCenter[0], 0.13, GROUNDS.lawnCenter[1]]} material={M.lawn}>
        <circleGeometry args={[GROUNDS.lawnRadius, 48]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[GROUNDS.lawnCenter[0], 0.16, GROUNDS.lawnCenter[1]]} material={M.water}>
        <circleGeometry args={[6, 24]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, (GROUNDS.lawnCenter[1] + GROUNDS.ringRadius + GROUNDS.gateZ) / 2]} material={M.path}>
        <planeGeometry args={[14, GROUNDS.gateZ - GROUNDS.lawnCenter[1] - GROUNDS.ringRadius + 4]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} material={M.path}>
        <planeGeometry args={[fw + 20, 24]} />
      </mesh>
      {/* front block */}
      <Box p={[0, 13, (front.z0 + front.z1) / 2]} s={[fw, 26 - 4.5, fd]} m={M.white} />
      <Box p={[0, 1.5, (front.z0 + front.z1) / 2 + 1]} s={[fw + 4, 3, fd + 4]} m={M.stone} />
      {/* eaves forming the 三 lines */}
      {[6.5, 11.5, 21.5].map((y) => (
        <Box key={y} p={[0, y, front.z1 + 1.2]} s={[fw + 3, 0.5, 3.5]} m={M.white} />
      ))}
      {/* stone curtain on the 2nd floor */}
      <instancedMesh
        args={[curtain, M.stone, curtainCount]}
        ref={(m) => {
          if (!m) return;
          const o = new THREE.Object3D();
          for (let i = 0; i < curtainCount; i++) {
            o.position.set(front.x0 + 0.7 + i * 1.4, 9, front.z1 + 2.6);
            o.updateMatrix();
            m.setMatrixAt(i, o.matrix);
          }
          m.instanceMatrix.needsUpdate = true;
        }}
      />
      {/* rooftop pavilion (口) + flag */}
      <Box p={[0, 23.5, (front.z0 + front.z1) / 2]} s={[24, 4, 18]} m={M.white} />
      <Box p={[0, 25.7, (front.z0 + front.z1) / 2]} s={[27, 0.5, 21]} m={M.cream} />
      <mesh position={[0, 30, (front.z0 + front.z1) / 2]} material={M.dark}>
        <cylinderGeometry args={[0.15, 0.15, 8]} />
      </mesh>
      {/* rear wing */}
      <Box p={[0, 10.75, (rear.z0 + rear.z1) / 2]} s={[rw, 21.5, rd]} m={M.cream} />
      {/* half-moon pond */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, front.z1 + 6]} material={M.water}>
        <ringGeometry args={[14, 22, 32, 1, Math.PI * 1.08, Math.PI * 0.84]} />
      </mesh>
    </group>
  );
}

export function Cathedral({ f }: { f: Frame }) {
  const L = Math.max(60, f.length), W = Math.max(25, f.width);
  return (
    <group position={[f.x, 0, f.z]} rotation={[0, f.angle, 0]}>
      <Box p={[0, 10, 0]} s={[L * 0.82, 20, W * 0.62]} m={M.brick} />
      <Gable p={[0, 20, 0]} l={L * 0.82} w={W * 0.66} h={9} m={M.slate} />
      {[-1, 1].map((s) => (
        <group key={s} position={[-L * 0.38, 0, (s * W) / 3.2]}>
          <Box p={[0, 19, 0]} s={[8, 38, 8]} m={M.brick} />
          <Box p={[0, 39, 0]} s={[8.6, 2, 8.6]} m={M.stone} />
          <Pyramid p={[0, 40, 0]} w={8} h={18} m={M.slate} />
        </group>
      ))}
    </group>
  );
}

export function PostOffice({ f }: { f: Frame }) {
  const L = Math.max(50, f.length), W = Math.max(20, f.width);
  return (
    <group position={[f.x, 0, f.z]} rotation={[0, f.angle, 0]}>
      <Box p={[0, 7, 0]} s={[L * 0.95, 14, W * 0.9]} m={M.yellow} />
      <mesh position={[0, 14, 0]} rotation={[0, 0, Math.PI / 2]} material={M.slate}>
        <cylinderGeometry args={[W * 0.35, W * 0.35, L * 0.85, 16, 1, false, 0, Math.PI]} />
      </mesh>
      <Box p={[0, 17, W * 0.46]} s={[14, 8, 1]} m={M.yellow} />
      <mesh position={[0, 18, W * 0.47 + 0.6]} rotation={[Math.PI / 2, 0, 0]} material={M.white}>
        <cylinderGeometry args={[1.6, 1.6, 0.3, 24]} />
      </mesh>
    </group>
  );
}

export function Market({ f }: { f: Frame }) {
  const L = Math.max(70, f.length), W = Math.max(50, f.width);
  return (
    <group position={[f.x, 0, f.z]} rotation={[0, f.angle, 0]}>
      <Box p={[0, 5, 0]} s={[L * 0.95, 10, W * 0.95]} m={M.cream} />
      <Gable p={[0, 10, 0]} l={L * 0.95} w={W * 0.95} h={7} m={M.roofRed} />
      <Box p={[0, 12, 0]} s={[L * 0.9, 2.5, 8]} m={M.cream} />
      <Box p={[-L * 0.47, 14, 0]} s={[8, 28, 8]} m={M.cream} />
      <mesh position={[-L * 0.47 - 4.1, 23, 0]} rotation={[0, 0, Math.PI / 2]} material={M.white}>
        <cylinderGeometry args={[2, 2, 0.3, 24]} />
      </mesh>
      <Pyramid p={[-L * 0.47, 28, 0]} w={7} h={5} m={M.roofRed} />
    </group>
  );
}

export function Theatre({ f }: { f: Frame }) {
  const L = Math.max(40, f.length), W = Math.max(30, f.width);
  return (
    <group position={[f.x, 0, f.z]} rotation={[0, f.angle, 0]}>
      <Box p={[0, 9, 0]} s={[L * 0.92, 18, W * 0.85]} m={M.cream} />
      <mesh position={[L * 0.47, 12, 0]} rotation={[0, Math.PI / 2, 0]} material={M.white}>
        <torusGeometry args={[7, 1.2, 8, 24, Math.PI]} />
      </mesh>
      <Box p={[0, 19, 0]} s={[L * 0.6, 2, W * 0.6]} m={M.slate} />
    </group>
  );
}

export function CityHall({ f }: { f: Frame }) {
  const L = Math.max(60, f.length), W = Math.max(30, f.width);
  return (
    <group position={[f.x, 0, f.z]} rotation={[0, f.angle, 0]}>
      <Box p={[0, 8, 0]} s={[L * 0.95, 16, W * 0.85]} m={M.yellow} />
      <Box p={[0, 17, 0]} s={[L * 0.95, 2, W * 0.85]} m={M.roofRed} />
      <Box p={[0, 22, 0]} s={[8, 14, 8]} m={M.yellow} />
      <Pyramid p={[0, 29, 0]} w={7} h={6} m={M.slate} />
    </group>
  );
}

export function Tower({ f }: { f: Frame }) {
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(9, 15, 262, 24, 1);
    g.scale(1.6, 1, 1);
    g.translate(0, 131, 0);
    return g;
  }, []);
  return (
    <group position={[f.x, 0, f.z]} rotation={[0, f.angle, 0]}>
      <Box p={[0, 9, 0]} s={[Math.max(40, f.length * 0.9), 18, Math.max(30, f.width * 0.9)]} m={M.cream} />
      <mesh geometry={geo} material={M.glass} castShadow />
      <mesh position={[16, 190, 0]} rotation={[0, 0, 0.04]} material={M.dark}>
        <cylinderGeometry args={[11, 11, 1.4, 24]} />
      </mesh>
      <mesh position={[0, 264, 0]} material={M.dark}>
        <cylinderGeometry args={[0.4, 0.8, 12]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ new landmarks */
const N = {
  khaki: new THREE.MeshStandardMaterial({ color: "#7b8053", roughness: 0.8 }),
  cable: new THREE.MeshStandardMaterial({ color: "#f3f4f6", roughness: 0.4 }),
  glass81: new THREE.MeshStandardMaterial({ color: "#7fb2d6", roughness: 0.12, metalness: 0.7 }),
  soil: new THREE.MeshStandardMaterial({ color: "#8a5a3b", roughness: 1 }),
  jade: new THREE.MeshStandardMaterial({ color: "#2f9e7a", roughness: 0.6 }),
  gold: new THREE.MeshStandardMaterial({ color: "#e0b042", roughness: 0.4, metalness: 0.4 }),
  red: new THREE.MeshStandardMaterial({ color: "#d63c32", roughness: 0.6 }),
  fence: new THREE.MeshStandardMaterial({ color: "#6b4f35", roughness: 0.9 }),
  grey: new THREE.MeshStandardMaterial({ color: "#8d9399", roughness: 0.8 }),
};

function Cyl({ p, r, h, m, r2 }: { p: [number, number, number]; r: number; h: number; m: THREE.Material; r2?: number }) {
  return (
    <mesh position={p} material={m} castShadow>
      <cylinderGeometry args={[r2 ?? r, r, h, 16]} />
    </mesh>
  );
}

/** War Remnants Museum: low block, entrance canopy, outdoor yard with aircraft and armour. */
export function Museum({ f }: { f: Frame }) {
  const L = Math.max(40, f.length), W = Math.max(25, f.width);
  return (
    <group position={[f.x, 0, f.z]} rotation={[0, f.angle, 0]}>
      <Box p={[0, 7, 0]} s={[L * 0.9, 14, W * 0.85]} m={M.white} />
      <Box p={[0, 14.6, 0]} s={[L * 0.92, 1.2, W * 0.88]} m={M.slate} />
      <Box p={[0, 5, W * 0.45]} s={[L * 0.4, 0.8, 6]} m={M.dark} />
      {/* display yard: helicopter, fighter jet, tank */}
      <group position={[0, 0, W * 0.5 + 18]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} material={M.path}>
          <planeGeometry args={[L, 28]} />
        </mesh>
        <group position={[-L * 0.3, 0, 0]}>
          <Box p={[0, 2, 0]} s={[9, 2.6, 2.6]} m={N.khaki} />
          <Box p={[6, 2.6, 0]} s={[6, 0.8, 0.8]} m={N.khaki} />
          <Box p={[0, 3.7, 0]} s={[14, 0.15, 0.6]} m={M.dark} r={0.6} />
        </group>
        <group position={[0, 0, -2]}>
          <Box p={[0, 2.2, 0]} s={[13, 1.6, 1.6]} m={N.grey} />
          <Box p={[0, 2.2, 0]} s={[3.5, 0.3, 10]} m={N.grey} />
          <Box p={[-5.5, 3.5, 0]} s={[1.6, 2.6, 0.3]} m={N.grey} />
        </group>
        <group position={[L * 0.3, 0, 3]}>
          <Box p={[0, 1.3, 0]} s={[7, 1.8, 3.6]} m={N.khaki} />
          <Box p={[0, 2.7, 0]} s={[3.4, 1.1, 2.6]} m={N.khaki} />
          <Box p={[3.4, 2.8, 0]} s={[4.5, 0.35, 0.35]} m={M.dark} />
        </group>
      </group>
    </group>
  );
}

/** Nhà Rồng: colonial building whose ridge carries two dragons facing a moon. */
export function Wharf({ f }: { f: Frame }) {
  const L = Math.max(36, f.length), W = Math.max(18, f.width);
  const dragon = (s: number) => (
    <group position={[s * 3.2, 18.2, 0]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[i * 0.9, Math.sin(i * 1.2) * 0.45 + 0.4, 0]} material={N.jade}>
          <sphereGeometry args={[0.55 - i * 0.07, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
  return (
    <group position={[f.x, 0, f.z]} rotation={[0, f.angle, 0]}>
      <Box p={[0, 6, 0]} s={[L * 0.9, 12, W * 0.8]} m={M.cream} />
      <Box p={[0, 3, W * 0.42]} s={[L * 0.9, 6, 2.5]} m={M.white} />
      <Gable p={[0, 12, 0]} l={L * 0.95} w={W * 0.9} h={5.5} m={M.roofRed} />
      <Box p={[0, 17.6, 0]} s={[L * 0.6, 0.4, 0.6]} m={M.roofRed} />
      {dragon(1)}
      {dragon(-1)}
      <mesh position={[0, 18.8, 0]} material={N.gold}>
        <sphereGeometry args={[0.8, 12, 8]} />
      </mesh>
      <Cyl p={[0, 9, W * 0.5 + 12]} r={0.2} h={18} m={M.white} />
      <Box p={[1.6, 16.8, W * 0.5 + 12]} s={[3, 2, 0.05]} m={N.red} />
    </group>
  );
}

/**
 * Landmark 81: nine square tubes of staggered heights (a bundle of bamboo)
 * rising to a crown and spire, 461 m in all.
 */
export function Landmark81({ f }: { f: Frame }) {
  const side = Math.min(70, Math.max(46, Math.min(f.length, f.width) * 0.9)) / 3;
  const H = [300, 350, 300, 350, 400, 350, 300, 350, 300];
  return (
    <group position={[f.x, 0, f.z]} rotation={[0, f.angle, 0]}>
      <Box p={[0, 12, 0]} s={[side * 4.2, 24, side * 4.2]} m={M.cream} />
      {H.map((h, i) => {
        const gx = (i % 3) - 1, gz = Math.floor(i / 3) - 1;
        return (
          <group key={i} position={[gx * side, 0, gz * side]}>
            <mesh position={[0, h / 2, 0]} material={N.glass81} castShadow>
              <boxGeometry args={[side * 0.98, h, side * 0.98]} />
            </mesh>
            <mesh position={[0, h + 1, 0]} material={M.white}>
              <boxGeometry args={[side * 0.9, 2, side * 0.9]} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 415, 0]} material={N.glass81}>
        <cylinderGeometry args={[side * 0.25, side * 0.5, 30, 4]} />
      </mesh>
      <Cyl p={[0, 445, 0]} r={1.2} r2={0.3} h={32} m={M.white} />
    </group>
  );
}

/** Ba Son: one pylon on the Thủ Thiêm bank with fans of stay cables to the deck on both sides. */
export function BaSonBridge({ line, pylon, deckY = 12 }: { line: P2[]; pylon: P2; deckY?: number }) {
  let ux = 1, uz = 0, best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const d = Math.hypot((a[0] + b[0]) / 2 - pylon[0], (a[1] + b[1]) / 2 - pylon[1]);
    if (d < best) {
      best = d;
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      ux = (b[0] - a[0]) / l;
      uz = (b[1] - a[1]) / l;
    }
  }
  const yaw = -Math.atan2(uz, ux);
  const H = 113;
  const cables = useMemo(() => {
    const out: { p: THREE.Vector3; q: THREE.Quaternion; len: number }[] = [];
    const top = new THREE.Vector3(0, H - 6, 0);
    for (const s of [1, -1]) for (let i = 1; i <= 9; i++) for (const side of [1, -1]) {
      const end = new THREE.Vector3(s * i * 20, deckY + 1, side * 9);
      const start = top.clone().add(new THREE.Vector3(0, -i * 2.2, side * 1.2));
      const dir = end.clone().sub(start);
      out.push({ p: start.clone().add(end).multiplyScalar(0.5), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), len: dir.length() });
    }
    return out;
  }, [deckY]);
  return (
    <group position={[pylon[0], 0, pylon[1]]} rotation={[0, yaw, 0]}>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, H * 0.42, s * 6]} rotation={[s * 0.1, 0, 0]} material={M.white} castShadow>
          <boxGeometry args={[4, H * 0.85, 3]} />
        </mesh>
      ))}
      <mesh position={[0, H * 0.92, 0]} material={M.white} castShadow>
        <boxGeometry args={[4, H * 0.18, 4]} />
      </mesh>
      {cables.map((c, i) => (
        <mesh key={i} position={c.p} quaternion={c.q} material={N.cable}>
          <cylinderGeometry args={[0.15, 0.15, c.len, 4]} />
        </mesh>
      ))}
    </group>
  );
}

/** Thảo Cầm Viên: main gate (two pillars and a sign) and animal enclosures inside the gardens. */
export function ZooGate({ gate, yaw, pens }: { gate: P2; yaw: number; pens: P2[] }) {
  return (
    <group>
      <group position={[gate[0], 0, gate[1]]} rotation={[0, yaw, 0]}>
        {[-1, 1].map((s) => (
          <Box key={s} p={[s * 8, 5, 0]} s={[2.4, 10, 2.4]} m={M.cream} />
        ))}
        <Box p={[0, 9.5, 0]} s={[19, 2, 1.4]} m={N.jade} />
        <Gable p={[0, 10.5, 0]} l={20} w={4} h={2.5} m={M.roofRed} />
      </group>
      {pens.map((p, i) => (
        <group key={i} position={[p[0], 0, p[1]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]} material={i % 2 ? N.soil : M.lawn}>
            <circleGeometry args={[11, 20]} />
          </mesh>
          <mesh position={[0, 0.8, 0]} material={N.fence}>
            <cylinderGeometry args={[11, 11, 1.6, 20, 1, true]} />
          </mesh>
          {i % 2 ? (
            <group position={[2, 0, 0]}>
              <Box p={[0, 2.2, 0]} s={[3.6, 2.2, 2]} m={N.grey} />
              <Box p={[2.2, 2.6, 0]} s={[1.2, 1.4, 1.4]} m={N.grey} />
              <Box p={[2.9, 1.4, 0]} s={[0.4, 1.8, 0.4]} m={N.grey} />
            </group>
          ) : (
            <group position={[-2, 0, 1]}>
              <Box p={[0, 2.4, 0]} s={[2.4, 1.2, 1]} m={N.gold} />
              <Box p={[1.2, 4.4, 0]} s={[0.5, 3.4, 0.5]} m={N.gold} />
              <Box p={[1.5, 6.1, 0]} s={[1, 0.5, 0.5]} m={N.gold} />
            </group>
          )}
        </group>
      ))}
    </group>
  );
}
