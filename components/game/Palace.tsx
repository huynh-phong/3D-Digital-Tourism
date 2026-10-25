"use client";

import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FLAG_POLE, GROUNDS, LEVEL, PALACE, PAVILION } from "@/data/dinh/layout";
import { rng } from "@/lib/geo";
import type { Box, Mat, PalaceModel } from "@/lib/dinh/palaceModel";
import type { Quality } from "@/lib/store/settings";

/* ------------------------------------------------------------- materials */
function checker(c1: string, c2: string, n = 8, size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const s = size / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = (i + j) % 2 ? c1 : c2;
    g.fillRect(i * s, j * s, s, s);
  }
  g.strokeStyle = "rgba(0,0,0,0.08)";
  for (let i = 0; i <= n; i++) {
    g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, size); g.stroke();
    g.beginPath(); g.moveTo(0, i * s); g.lineTo(size, i * s); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function noiseTex(base: string, spread: number, size = 128) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const R = rng(9);
  for (let i = 0; i < size * size * 0.35; i++) {
    const v = Math.floor((R() - 0.5) * spread);
    g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`;
    g.fillRect(R() * size, R() * size, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function usePalaceMaterials() {
  return useMemo(() => {
    const marble = checker("#e9e4da", "#d9d2c4");
    marble.repeat.set(12, 12);
    const grass = noiseTex("#6fa25a", 60);
    grass.repeat.set(80, 80);
    const mats: Record<Mat, THREE.Material> = {
      facade: new THREE.MeshStandardMaterial({ color: "#f2efe8", roughness: 0.75 }),
      wall: new THREE.MeshStandardMaterial({ color: "#efe7d6", roughness: 0.9 }),
      marble: new THREE.MeshStandardMaterial({ map: marble, roughness: 0.35 }),
      carpet: new THREE.MeshStandardMaterial({ color: "#9e2b25", roughness: 1 }),
      wood: new THREE.MeshStandardMaterial({ color: "#7a5236", roughness: 0.6 }),
      stone: new THREE.MeshStandardMaterial({ color: "#d9d2c3", roughness: 0.9 }),
      glass: new THREE.MeshStandardMaterial({ color: "#5f7d8e", roughness: 0.12, metalness: 0.5, transparent: true, opacity: 0.45, depthWrite: false }),
      concrete: new THREE.MeshStandardMaterial({ color: "#8f8e88", roughness: 0.95 }),
      path: new THREE.MeshStandardMaterial({ color: "#d6cfbf", roughness: 1 }),
      roof: new THREE.MeshStandardMaterial({ color: "#c9c3b6", roughness: 0.9 }),
      dark: new THREE.MeshStandardMaterial({ color: "#2b2f33", roughness: 0.7 }),
      metal: new THREE.MeshStandardMaterial({ color: "#6c737a", roughness: 0.4, metalness: 0.6 }),
      curtain: new THREE.MeshStandardMaterial({ color: "#e6dfd0", roughness: 0.85 }),
      gold: new THREE.MeshStandardMaterial({ color: "#c9a14a", roughness: 0.35, metalness: 0.7 }),
      door: new THREE.MeshStandardMaterial({ color: "#5b3b25", roughness: 0.55 }),
      lacquer: new THREE.MeshStandardMaterial({ color: "#3a1d14", roughness: 0.3 }),
      paper: new THREE.MeshStandardMaterial({ color: "#efe6c8", roughness: 0.9 }),
      fabric: new THREE.MeshStandardMaterial({ color: "#7b2a24", roughness: 0.95 }),
      basementWall: new THREE.MeshStandardMaterial({ color: "#b8b4a8", roughness: 0.95 }),
    };
    const grassMat = new THREE.MeshStandardMaterial({ map: grass, roughness: 1 });
    const lawnMat = new THREE.MeshStandardMaterial({ color: "#7cbc62", roughness: 1 });
    const water = new THREE.MeshStandardMaterial({ color: "#4f8fb3", roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.88 });
    return { mats, grassMat, lawnMat, water, textures: [marble, grass] };
  }, []);
}

/* ------------------------------------------------------- instanced boxes */
function BoxBatch({ boxes, material, shadows }: { boxes: Box[]; material: THREE.Material; shadows: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => {
    const o = new THREE.Object3D();
    boxes.forEach((b, i) => {
      o.position.set(...b.p);
      o.rotation.set(b.rx ?? 0, b.ry ?? 0, 0, "YXZ");
      o.scale.set(...b.s);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [boxes]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <instancedMesh ref={ref} args={[geo, material, boxes.length]} castShadow={shadows} receiveShadow />;
}

export function PalaceColliders({ model }: { model: PalaceModel }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      {model.boxes
        .filter((b) => b.collide)
        .map((b, i) => (
          <CuboidCollider
            key={i}
            args={[b.s[0] / 2, b.s[1] / 2, b.s[2] / 2]}
            position={b.p}
            rotation={new THREE.Euler(b.rx ?? 0, b.ry ?? 0, 0, "YXZ").toArray().slice(0, 3) as [number, number, number]}
          />
        ))}
    </RigidBody>
  );
}

export function PalaceGeometry({ model, quality }: { model: PalaceModel; quality: Quality }) {
  const { mats, grassMat, lawnMat, water, textures } = usePalaceMaterials();
  useEffect(() => () => {
    Object.values(mats).forEach((m) => m.dispose());
    [grassMat, lawnMat, water].forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  }, [mats, grassMat, lawnMat, water, textures]);

  const shadows = quality !== "low";
  const groups = useMemo(() => {
    const g = new Map<Mat, Box[]>();
    for (const b of [...model.boxes, ...model.steps]) {
      if (b.visible === false) continue;
      if (!g.has(b.m)) g.set(b.m, []);
      g.get(b.m)!.push(b);
    }
    return g;
  }, [model]);

  return (
    <group>
      {[...groups].map(([m, list]) => (
        <BoxBatch key={m} boxes={list} material={mats[m]} shadows={shadows} />
      ))}
      <Grounds grassMat={grassMat} lawnMat={lawnMat} water={water} mats={mats} quality={quality} />
      <Facade mats={mats} />
      <Interior mats={mats} />
      <Basement mats={mats} />
      <Rooftop mats={mats} />
      {model.closedDoors.map((d, i) => (
        <group key={i} position={d.p} rotation={[0, d.ry, 0]}>
          <mesh position={[0, d.h / 2, 0]} material={mats.door}>
            <boxGeometry args={[d.w, d.h, 0.08]} />
          </mesh>
          <mesh position={[d.w * 0.35, d.h / 2, 0.06]} material={mats.gold}>
            <sphereGeometry args={[0.05, 8, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------- grounds */
function Grounds({ grassMat, lawnMat, water, mats, quality }: { grassMat: THREE.Material; lawnMat: THREE.Material; water: THREE.Material; mats: Record<Mat, THREE.Material>; quality: Quality }) {
  const [cx, cz] = GROUNDS.lawnCenter;
  const trees = useMemo(() => {
    const R = rng(1966);
    const out: { x: number; z: number; s: number; h: number }[] = [];
    const n = quality === "low" ? 140 : quality === "medium" ? 260 : 380;
    let tries = 0;
    while (out.length < n && tries < n * 20) {
      tries++;
      const x = (R() * 2 - 1) * (GROUNDS.halfW - 6), z = (R() * 2 - 1) * (GROUNDS.halfD - 6);
      if (Math.hypot(x - cx, z - cz) < GROUNDS.ringRadius + GROUNDS.ringWidth / 2 + 4) continue; // lawn + ring
      if (Math.abs(x) < 56 && z > -96 && z < 30) continue; // palace + forecourt
      if (Math.abs(x) < 12 && z > 60) continue; // gate drive
      if (Math.hypot(x - 90, z - 100) < 26) continue; // outdoor exhibits
      if (Math.hypot(x - 176, z - 126) < 10) continue; // octagon
      if (Math.hypot(x + 160, z - 58) < 22) continue; // exhibition house
      if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 7)) continue;
      out.push({ x, z, s: 0.8 + R() * 0.9, h: R() });
    }
    return out;
  }, [cx, cz, quality]);

  const trunk = useRef<THREE.InstancedMesh>(null);
  const crown = useRef<THREE.InstancedMesh>(null);
  const tg = useMemo(() => {
    const t = new THREE.CylinderGeometry(0.3, 0.55, 6, 7);
    t.translate(0, 3, 0);
    const c = new THREE.IcosahedronGeometry(4.2, 1);
    c.scale(1, 0.8, 1);
    c.translate(0, 8.5, 0);
    return { t, c };
  }, []);
  useEffect(() => {
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    trees.forEach((tr, i) => {
      o.position.set(tr.x, 0, tr.z);
      o.scale.setScalar(tr.s);
      o.rotation.set(0, tr.h * 6, 0);
      o.updateMatrix();
      trunk.current!.setMatrixAt(i, o.matrix);
      crown.current!.setMatrixAt(i, o.matrix);
      crown.current!.setColorAt(i, col.setHSL(0.26 + tr.h * 0.06, 0.45, 0.28 + tr.h * 0.1));
    });
    trunk.current!.instanceMatrix.needsUpdate = true;
    crown.current!.instanceMatrix.needsUpdate = true;
    if (crown.current!.instanceColor) crown.current!.instanceColor.needsUpdate = true;
    trunk.current!.computeBoundingSphere();
    crown.current!.computeBoundingSphere();
  }, [trees]);

  // Tree trunks are colliders (players can't walk through them).
  const pondArcs: [number, number][] = [[0.12, 0.42], [0.58, 0.88]];
  const pz = PALACE.front.z1 + 4;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={grassMat} receiveShadow>
        <planeGeometry args={[GROUNDS.halfW * 2 + 40, GROUNDS.halfD * 2 + 40]} />
      </mesh>
      {/* Outside the grounds: street ring for context */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[GROUNDS.halfW * 2 + 400, GROUNDS.halfD * 2 + 400]} />
        <meshStandardMaterial color="#6b6e72" roughness={1} />
      </mesh>
      {/* ring drive + lawn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.02, cz]} material={mats.path} receiveShadow>
        <ringGeometry args={[GROUNDS.ringRadius - GROUNDS.ringWidth / 2, GROUNDS.ringRadius + GROUNDS.ringWidth / 2, 96]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.015, cz]} material={lawnMat} receiveShadow>
        <circleGeometry args={[GROUNDS.lawnRadius, 96]} />
      </mesh>
      {/* fountain in the lawn (official map shows a round basin) */}
      <mesh position={[cx, 0.25, cz]} material={mats.stone}>
        <cylinderGeometry args={[7.4, 7.6, 0.5, 40]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.52, cz]} material={water}>
        <circleGeometry args={[7, 40]} />
      </mesh>
      <Fountain x={cx} z={cz} />
      {/* drive from the gate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, (GROUNDS.gateZ + cz + GROUNDS.ringRadius) / 2]} material={mats.path} receiveShadow>
        <planeGeometry args={[14, GROUNDS.gateZ - cz - GROUNDS.ringRadius + 4]} />
      </mesh>
      {/* forecourt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 6]} material={mats.path} receiveShadow>
        <planeGeometry args={[110, 26]} />
      </mesh>
      {/* half-moon pond */}
      {pondArcs.map(([a0, a1], i) => (
        <group key={i}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, pz]} material={mats.stone}>
            <ringGeometry args={[13.6, 22.4, 24, 1, -Math.PI * a1, Math.PI * (a1 - a0)]} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, pz]} material={water}>
            <ringGeometry args={[14.2, 21.8, 24, 1, -Math.PI * a1, Math.PI * (a1 - a0)]} />
          </mesh>
        </group>
      ))}
      <Lotus pz={pz} />
      {/* gate */}
      <Gate mats={mats} />
      {/* trees */}
      <instancedMesh ref={trunk} args={[tg.t, undefined, trees.length]} castShadow={quality !== "low"}>
        <meshStandardMaterial color="#5e4630" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crown} args={[tg.c, undefined, trees.length]} castShadow={quality === "high"}>
        <meshStandardMaterial roughness={0.95} flatShading />
      </instancedMesh>
      <RigidBody type="fixed" colliders={false}>
        {trees.map((t, i) => (
          <CuboidCollider key={i} args={[0.5 * t.s, 3, 0.5 * t.s]} position={[t.x, 3, t.z]} />
        ))}
        <CuboidCollider args={[7.6, 0.5, 7.6]} position={[cx, 0.25, cz]} />
      </RigidBody>
      <OutdoorExhibits mats={mats} />
      <Octagon mats={mats} />
      <ExhibitionHouse mats={mats} />
      <TennisCourts />
    </group>
  );
}

function Fountain({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) ref.current.scale.y = 1 + Math.sin(s.clock.elapsedTime * 3) * 0.06;
  });
  return (
    <mesh ref={ref} position={[x, 0.5, z]}>
      <coneGeometry args={[1.2, 5, 16, 1, true]} />
      <meshStandardMaterial color="#cfe8f7" transparent opacity={0.55} roughness={0.1} />
    </mesh>
  );
}

function Lotus({ pz }: { pz: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const pads = useMemo(() => {
    const R = rng(5);
    const out: [number, number][] = [];
    for (let i = 0; i < 70; i++) {
      const side = R() < 0.5 ? 0 : 1;
      const a = Math.PI * (side ? 0.6 + R() * 0.26 : 0.14 + R() * 0.26);
      const r = 15 + R() * 6;
      out.push([Math.cos(a) * r, pz + Math.sin(a) * r]);
    }
    return out;
  }, [pz]);
  useEffect(() => {
    const o = new THREE.Object3D();
    pads.forEach(([x, z], i) => {
      o.position.set(x, 0.15, z);
      o.rotation.set(-Math.PI / 2, 0, i);
      o.scale.setScalar(0.6 + (i % 5) * 0.12);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [pads]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, pads.length]}>
      <circleGeometry args={[0.6, 10, 0.3, Math.PI * 1.85]} />
      <meshStandardMaterial color="#3f7d3a" roughness={0.8} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function Gate({ mats }: { mats: Record<Mat, THREE.Material> }) {
  const z = GROUNDS.gateZ;
  const bars = useMemo(() => Array.from({ length: 28 }, (_, i) => -6.75 + i * 0.5), []);
  return (
    <group>
      {bars.map((x) => (
        <mesh key={x} position={[x, 1.2, z]} material={mats.metal}>
          <boxGeometry args={[0.06, 2.4, 0.06]} />
        </mesh>
      ))}
      <mesh position={[0, 2.35, z]} material={mats.metal}>
        <boxGeometry args={[14, 0.12, 0.1]} />
      </mesh>
      {[-7.4, 7.4].map((x) => (
        <mesh key={x} position={[x, 1.6, z]} material={mats.stone} castShadow>
          <boxGeometry args={[1.2, 3.2, 1.2]} />
        </mesh>
      ))}
    </group>
  );
}

/** Illustrative tank and F-5E silhouettes where the official map marks the outdoor exhibits. */
function OutdoorExhibits({ mats }: { mats: Record<Mat, THREE.Material> }) {
  const olive = useMemo(() => new THREE.MeshStandardMaterial({ color: "#4f5a3a", roughness: 0.8 }), []);
  const jet = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8d949a", roughness: 0.5, metalness: 0.3 }), []);
  const tank = (x: number, z: number, r: number) => (
    <group position={[x, 0, z]} rotation={[0, r, 0]}>
      <mesh position={[0, 0.9, 0]} material={olive} castShadow><boxGeometry args={[3.2, 1.0, 6.2]} /></mesh>
      {[-1.45, 1.45].map((sx) => (
        <mesh key={sx} position={[sx, 0.5, 0]} material={mats.dark} castShadow><boxGeometry args={[0.6, 1, 6.4]} /></mesh>
      ))}
      <mesh position={[0, 1.75, -0.4]} material={olive} castShadow><cylinderGeometry args={[1.25, 1.4, 0.75, 16]} /></mesh>
      <mesh position={[0, 1.8, 2.4]} rotation={[Math.PI / 2, 0, 0]} material={olive}><cylinderGeometry args={[0.1, 0.12, 5, 8]} /></mesh>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.stone}><planeGeometry args={[5.2, 8.4]} /></mesh>
    </group>
  );
  return (
    <group>
      {tank(76, 116, 0.6)}
      {tank(86, 106, 0.4)}
      <group position={[106, 0, 84]} rotation={[0, -0.5, 0]}>
        <mesh position={[0, 1.6, 0]} rotation={[Math.PI / 2, 0, 0]} material={jet} castShadow><cylinderGeometry args={[0.55, 0.35, 14, 12]} /></mesh>
        <mesh position={[0, 1.6, 7.6]} rotation={[Math.PI / 2, 0, 0]} material={jet}><coneGeometry args={[0.55, 2, 12]} /></mesh>
        <mesh position={[0, 1.5, 0.5]} material={jet} castShadow><boxGeometry args={[8.1, 0.12, 2.8]} /></mesh>
        <mesh position={[0, 1.7, -6]} material={jet}><boxGeometry args={[4.2, 0.1, 1.2]} /></mesh>
        <mesh position={[0, 3, -6.3]} material={jet}><boxGeometry args={[0.12, 2.6, 1.4]} /></mesh>
        <mesh position={[0, 2.1, 4.4]} material={mats.glass}><sphereGeometry args={[0.45, 10, 8]} /></mesh>
        {[[0, 0.55, 4.5], [-1.4, 0.55, -0.6], [1.4, 0.55, -0.6]].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]} material={mats.dark}><cylinderGeometry args={[0.08, 0.08, 1.1]} /></mesh>
        ))}
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.8, 1.2, 3.3]} position={[76, 1.2, 116]} rotation={[0, 0.6, 0]} />
        <CuboidCollider args={[1.8, 1.2, 3.3]} position={[86, 1.2, 106]} rotation={[0, 0.4, 0]} />
        <CuboidCollider args={[3.5, 1.5, 7]} position={[106, 1.5, 84]} rotation={[0, -0.5, 0]} />
      </RigidBody>
    </group>
  );
}

function Octagon({ mats }: { mats: Record<Mat, THREE.Material> }) {
  const tile = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9c4a33", roughness: 0.8 }), []);
  return (
    <group position={[176, 0, 126]}>
      <mesh position={[0, 0.6, 0]} material={mats.stone}><cylinderGeometry args={[4.5, 6, 1.2, 8]} /></mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[Math.cos((i / 8) * Math.PI * 2) * 1.9, 2.6, Math.sin((i / 8) * Math.PI * 2) * 1.9]} material={mats.wood}>
          <cylinderGeometry args={[0.1, 0.1, 2.8]} />
        </mesh>
      ))}
      <mesh position={[0, 4.6, 0]} material={tile}><coneGeometry args={[2.9, 1.8, 8]} /></mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[4.5, 0.6, 4.5]} position={[0, 0.6, 0]} />
      </RigidBody>
    </group>
  );
}

function ExhibitionHouse({ mats }: { mats: Record<Mat, THREE.Material> }) {
  const yellow = useMemo(() => new THREE.MeshStandardMaterial({ color: "#efd58f", roughness: 0.8 }), []);
  const tile = useMemo(() => new THREE.MeshStandardMaterial({ color: "#a65a40", roughness: 0.8 }), []);
  return (
    <group position={[-170, 0, 58]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 4, 0]} material={yellow} castShadow><boxGeometry args={[26, 8, 12]} /></mesh>
      <mesh position={[0, 9, 0]} rotation={[0, 0, 0]} material={tile}><boxGeometry args={[27, 2, 13]} /></mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-10 + i * 4, 4, 6.05]} material={mats.dark}><boxGeometry args={[1.4, 2.4, 0.05]} /></mesh>
      ))}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[13, 4, 6]} position={[0, 4, 0]} />
      </RigidBody>
    </group>
  );
}

function TennisCourts() {
  return (
    <group position={[0, 0.03, -128]}>
      {[-60, -24, 24, 60].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, 0]}>
          <planeGeometry args={[18, 34]} />
          <meshStandardMaterial color="#3d7f6a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- façade */
function Facade({ mats }: { mats: Record<Mat, THREE.Material> }) {
  const F = PALACE.front, R = PALACE.rear;
  const curtainRef = useRef<THREE.InstancedMesh>(null);
  const curtainPos = useMemo(() => {
    const out: [number, number, number, number][] = [];
    const y = LEVEL.l1 + STOREY_MID;
    const step = 0.9;
    for (let x = F.x0 + 0.5; x <= F.x1 - 0.5; x += step) out.push([x, y, F.z1 + 1.6, 0]);
    for (let z = F.z0 + 0.5; z <= F.z1 + 1.2; z += step) {
      out.push([F.x0 - 1.6, y, z, Math.PI / 2]);
      out.push([F.x1 + 1.6, y, z, Math.PI / 2]);
    }
    return out;
  }, [F]);
  useEffect(() => {
    const o = new THREE.Object3D();
    curtainPos.forEach(([x, y, z, r], i) => {
      o.position.set(x, y, z);
      o.rotation.set(0, r, 0);
      o.updateMatrix();
      curtainRef.current!.setMatrixAt(i, o.matrix);
    });
    curtainRef.current!.instanceMatrix.needsUpdate = true;
    curtainRef.current!.computeBoundingSphere();
  }, [curtainPos]);
  const curtainGeo = useMemo(() => {
    // a stylised bamboo segment: stacked rounded blocks
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.CylinderGeometry(0.17, 0.17, 1.05, 8);
      g.translate(0, -1.6 + i * 1.08, 0);
      parts.push(g);
    }
    return mergeAll(parts);
  }, []);

  return (
    <group>
      {/* window bands on the façade (ground floor glazing + upper floors) */}
      {[LEVEL.f1 + 0.6, LEVEL.l2 + 0.8, LEVEL.l3 + 0.8].map((y, i) => (
        <group key={i}>
          {/* front glazing; the ground-floor band leaves the entrance open */}
          {(i === 0 ? [[F.x0 + 2, -3.2], [3.2, F.x1 - 2]] : [[F.x0 + 2, F.x1 - 2]]).map(([a, b]) => (
            <mesh key={a} position={[(a + b) / 2, y + 1.6, F.z1 + 0.22]} material={mats.glass}>
              <boxGeometry args={[b - a, 3.2, 0.05]} />
            </mesh>
          ))}
          <mesh position={[F.x0 - 0.22, y + 1.6, (F.z0 + F.z1) / 2]} material={mats.glass}>
            <boxGeometry args={[0.05, 3.2, F.z1 - F.z0 - 4]} />
          </mesh>
          <mesh position={[F.x1 + 0.22, y + 1.6, (F.z0 + F.z1) / 2]} material={mats.glass}>
            <boxGeometry args={[0.05, 3.2, F.z1 - F.z0 - 4]} />
          </mesh>
        </group>
      ))}
      {[LEVEL.l1, LEVEL.l2, LEVEL.l3].map((y, i) => (
        <mesh key={i} position={[0, y + 2.6, R.z0 - 0.22]} material={mats.glass}>
          <boxGeometry args={[R.x1 - R.x0 - 4, 2.6, 0.05]} />
        </mesh>
      ))}
      {/* stone curtain around the 2nd floor */}
      <instancedMesh ref={curtainRef} args={[curtainGeo, mats.curtain, curtainPos.length]} castShadow />
      {/* balconies / eaves — the horizontal strokes of 三 */}
      <mesh position={[0, LEVEL.l1 - 0.15, F.z1 + 1.8]} material={mats.facade} castShadow receiveShadow>
        <boxGeometry args={[F.x1 - F.x0 + 7, 0.35, 3.8]} />
      </mesh>
      <mesh position={[0, LEVEL.l3 - 0.15, F.z1 + 1.8]} material={mats.facade} castShadow receiveShadow>
        <boxGeometry args={[F.x1 - F.x0 + 7, 0.35, 3.8]} />
      </mesh>
      <mesh position={[0, LEVEL.roof + 0.9, F.z1 + 0.6]} material={mats.facade} castShadow>
        <boxGeometry args={[F.x1 - F.x0 + 3, 0.5, 2]} />
      </mesh>
      {/* entrance canopy and the two columns */}
      <mesh position={[0, LEVEL.f1 + 4.2, F.z1 + 4]} material={mats.facade} castShadow receiveShadow>
        <boxGeometry args={[20, 0.4, 8]} />
      </mesh>
      {[-8.5, 8.5].map((x) => (
        <mesh key={x} position={[x, LEVEL.f1 + 2.1, F.z1 + 7.4]} material={mats.wood} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 4.2, 12]} />
        </mesh>
      ))}
      {/* open entrance doors (folded back) */}
      {[-3.3, 3.3].map((x) => (
        <mesh key={x} position={[x, LEVEL.f1 + 1.8, F.z1 - 0.6]} rotation={[0, x > 0 ? 0.5 : -0.5, 0]} material={mats.door}>
          <boxGeometry args={[0.08, 3.5, 1.4]} />
        </mesh>
      ))}
    </group>
  );
}
const STOREY_MID = 2.6;

function mergeAll(parts: THREE.BufferGeometry[]) {
  // tiny local merge to avoid importing BufferGeometryUtils here
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  let off = 0;
  for (const g of parts) {
    const ni = g.toNonIndexed();
    const p = ni.getAttribute("position"), n = ni.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      idx.push(off + i);
    }
    off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/* ---------------------------------------------------------------- interior */
function Interior({ mats }: { mats: Record<Mat, THREE.Material> }) {
  const y = LEVEL.f1;
  const chairs = useMemo(() => {
    const out: { p: [number, number, number]; r: number }[] = [];
    // Cabinet room: chairs around the table (illustrative)
    for (let i = 0; i < 7; i++) {
      const x = 27.2 + i * 1.6;
      const half = 2.5 * Math.sqrt(Math.max(0, 1 - ((x - 32) / 6.6) ** 2)); // table ellipse edge
      out.push({ p: [x, y, -23 - half - 0.75], r: 0 });
      out.push({ p: [x, y, -23 + half + 0.75], r: Math.PI });
    }
    out.push({ p: [24.6, y, -23], r: Math.PI / 2 }, { p: [39.4, y, -23], r: -Math.PI / 2 });
    // Credentials room: rows of armchairs along the walls
    for (let i = 0; i < 6; i++) {
      out.push({ p: [-10.5, y, -40 - i * 2.6], r: Math.PI / 2 });
      out.push({ p: [10.5, y, -40 - i * 2.6], r: -Math.PI / 2 });
    }
    return out;
  }, [y]);
  return (
    <group>
      {/* floors */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.012, -23]} material={mats.marble} receiveShadow>
        <planeGeometry args={[89.6, 25.6]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.012, -62]} material={mats.marble} receiveShadow>
        <planeGeometry args={[41.6, 51.6]} />
      </mesh>
      {/* red carpet from the entrance to the credentials room */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.02, -35]} material={mats.carpet} receiveShadow>
        <planeGeometry args={[3, 50]} />
      </mesh>
      {/* hall columns */}
      {[-10, -4, 4, 10].flatMap((x) =>
        [-16, -30].map((z) => (
          <mesh key={`${x},${z}`} position={[x, y + 2.35, z]} material={mats.facade} castShadow>
            <cylinderGeometry args={[0.45, 0.45, 4.7, 16]} />
          </mesh>
        )),
      )}
      {/* chandeliers (simple discs) */}
      {[[0, -23], [0, -48], [31, -23]].map(([x, z], i) => (
        <group key={i} position={[x, y + 4.1, z]}>
          <mesh material={mats.gold}><cylinderGeometry args={[1.4, 0.8, 0.35, 16]} /></mesh>
          <mesh position={[0, -0.25, 0]}>
            <sphereGeometry args={[0.5, 12, 8]} />
            <meshStandardMaterial color="#fff6dc" emissive="#ffe6a8" emissiveIntensity={1.5} />
          </mesh>
        </group>
      ))}
      {/* Cabinet room table (illustrative) */}
      <group position={[32, y, -23]}>
        <mesh position={[0, 0.76, 0]} material={mats.wood} castShadow receiveShadow scale={[1, 1, 0.38]}>
          <cylinderGeometry args={[6.6, 6.6, 0.08, 40]} />
        </mesh>
        <mesh position={[0, 0.38, 0]} material={mats.wood}><boxGeometry args={[8, 0.76, 0.6]} /></mesh>
      </group>
      {chairs.map((c, i) => (
        <Chair key={i} p={c.p} r={c.r} mats={mats} />
      ))}
      {/* Credentials room: decorative wall panel (placeholder, not the real artwork) */}
      <group position={[0, y + 2.4, -59.75]}>
        <mesh material={mats.gold}><boxGeometry args={[9.4, 3.4, 0.08]} /></mesh>
        <mesh position={[0, 0, 0.05]} material={mats.lacquer}><boxGeometry args={[9, 3, 0.04]} /></mesh>
        {[-3, -1, 1.5, 3.2].map((x, i) => (
          <mesh key={i} position={[x, -0.2 + (i % 2) * 0.5, 0.08]} material={mats.gold}>
            <circleGeometry args={[0.25 + (i % 3) * 0.1, 16]} />
          </mesh>
        ))}
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[6.6, 0.5, 2.6]} position={[32, y + 0.5, -23]} />
        {chairs.map((c, i) => (
          <CuboidCollider key={i} args={[0.35, 0.5, 0.35]} position={[c.p[0], y + 0.5, c.p[2]]} />
        ))}
        {[-10, -4, 4, 10].flatMap((x) => [-16, -30].map((z) => <CuboidCollider key={`${x},${z}`} args={[0.45, 2.3, 0.45]} position={[x, y + 2.35, z]} />))}
      </RigidBody>
    </group>
  );
}

function Chair({ p, r, mats }: { p: [number, number, number]; r: number; mats: Record<Mat, THREE.Material> }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <mesh position={[0, 0.45, 0]} material={mats.fabric} castShadow><boxGeometry args={[0.6, 0.12, 0.6]} /></mesh>
      <mesh position={[0, 0.85, -0.27]} material={mats.fabric} castShadow><boxGeometry args={[0.6, 0.8, 0.08]} /></mesh>
      <mesh position={[0, 0.2, 0]} material={mats.wood}><boxGeometry args={[0.5, 0.4, 0.5]} /></mesh>
    </group>
  );
}

function Basement({ mats }: { mats: Record<Mat, THREE.Material> }) {
  const y = LEVEL.basement;
  return (
    <group>
      {/* Generic communications desks (simulated) */}
      {[0, 1, 2].map((i) => (
        <group key={i} position={[-17.5, y, -54 + i * 4.5]}>
          <mesh position={[0, 0.4, 0]} material={mats.metal} castShadow><boxGeometry args={[1.4, 0.8, 3]} /></mesh>
          <mesh position={[-0.4, 1.2, 0]} material={mats.dark}><boxGeometry args={[0.5, 0.8, 2.6]} /></mesh>
          {[-0.8, 0, 0.8].map((z) => (
            <mesh key={z} position={[-0.14, 1.25, z]}>
              <boxGeometry args={[0.02, 0.12, 0.2]} />
              <meshStandardMaterial color="#8bd18b" emissive="#3c9a3c" emissiveIntensity={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Generic wall maps in the working room (simulated) */}
      {[-48, -44].map((z) => (
        <mesh key={z} position={[20.7, y + 2, z]} rotation={[0, -Math.PI / 2, 0]} material={mats.paper}>
          <planeGeometry args={[3.2, 2.2]} />
        </mesh>
      ))}
      <mesh position={[10, y + 0.4, -50]} material={mats.wood} castShadow><boxGeometry args={[4, 0.8, 2]} /></mesh>
      <RigidBody type="fixed" colliders={false}>
        {[0, 1, 2].map((i) => <CuboidCollider key={i} args={[0.7, 0.6, 1.5]} position={[-17.5, y + 0.6, -54 + i * 4.5]} />)}
        <CuboidCollider args={[2, 0.5, 1]} position={[10, y + 0.5, -50]} />
      </RigidBody>
    </group>
  );
}

function Rooftop({ mats }: { mats: Record<Mat, THREE.Material> }) {
  const flag = useRef<THREE.Mesh>(null);
  const flagGeo = useMemo(() => new THREE.PlaneGeometry(4.5, 3, 18, 6), []);
  const base = useMemo(() => Float32Array.from(flagGeo.getAttribute("position").array), [flagGeo]);
  const flagTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 300; c.height = 200;
    const g = c.getContext("2d")!;
    g.fillStyle = "#da251d"; g.fillRect(0, 0, 300, 200);
    g.fillStyle = "#ffff00"; g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      g.lineTo(150 + Math.cos(a) * 60, 100 + Math.sin(a) * 60);
    }
    g.closePath(); g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useFrame((s) => {
    const pos = flagGeo.getAttribute("position");
    const t = s.clock.elapsedTime;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3] + 2.25;
      pos.setZ(i, Math.sin(x * 1.6 - t * 4) * 0.18 * (x / 4.5));
    }
    pos.needsUpdate = true;
    flagGeo.computeVertexNormals();
  });
  const [fx, fy, fz] = FLAG_POLE;
  return (
    <group>
      <mesh position={[fx, fy + 6, fz]} material={mats.metal} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 12, 10]} />
      </mesh>
      <mesh ref={flag} geometry={flagGeo} position={[fx + 2.3, fy + 10.4, fz]}>
        <meshStandardMaterial map={flagTex} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      {/* raised square in the courtyard */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, LEVEL.roof + 0.02, (PAVILION.court.z0 + PAVILION.court.z1) / 2]} material={mats.stone}>
        <planeGeometry args={[PAVILION.court.x * 2, PAVILION.court.z1 - PAVILION.court.z0]} />
      </mesh>
    </group>
  );
}
