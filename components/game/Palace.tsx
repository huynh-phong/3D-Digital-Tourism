"use client";

import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FLAG_POLE, GROUNDS, LEVEL, PALACE, PAVILION } from "@/data/dinh/layout";
import { rng } from "@/lib/geo";
import { FURNITURE, seatSize, trunkRadius, type Box, type Mat, type PalaceModel, type Tree } from "@/lib/dinh/palaceModel";
import { disposePalaceTextures, palaceTexture, worldUV, type TexName } from "@/lib/dinh/textures";
import type { Quality } from "@/lib/store/settings";

/* ------------------------------------------------------------- materials */
/**
 * PBR materials for the palace. Textured materials use world-space UVs, so
 * `metres` is the real size of one texture tile.
 */
export function usePalaceMaterials(quality: Quality) {
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    const aniso = Math.min(quality === "high" ? 8 : 4, gl.capabilities.getMaxAnisotropy());
    const tq = quality;
    const pbr = (tex: TexName, metres: number, opts: THREE.MeshStandardMaterialParameters = {}, normal = 1) => {
      const t = palaceTexture(tex, tq, aniso);
      return worldUV(
        new THREE.MeshStandardMaterial({ map: t.map, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(normal, normal), roughness: 1, ...opts }),
        metres,
      );
    };
    const mats: Record<Mat, THREE.Material> = {
      facade: pbr("plaster", 4, {}, 0.7),
      wall: pbr("paint", 3, {}, 0.5),
      floor: pbr("graniteDark", 1.6, { envMapIntensity: 0.55 }),
      stone: pbr("stoneLight", 2.4),
      path: pbr("stoneLight", 2.4),
      roof: pbr("roofTile", 2.4),
      concrete: pbr("concrete", 3, {}, 0.45),
      basementWall: pbr("concrete", 3, { color: "#ece8de" }, 0.35),
      wood: pbr("wood", 1.2),
      door: pbr("wood", 1.2, { color: "#a88a76" }),
      lacquer: pbr("lacquer", 1),
      curtain: pbr("plaster", 2, { color: "#f6f1e6" }, 0.4),
      fabric: pbr("carpetGreen", 0.8, { color: "#4a6b4c" }, 0.6),
      glass: new THREE.MeshStandardMaterial({ color: "#a9c4cf", roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      dark: new THREE.MeshStandardMaterial({ color: "#2b2f33", roughness: 0.6 }),
      metal: new THREE.MeshStandardMaterial({ color: "#8d949a", roughness: 0.32, metalness: 0.85 }),
      gold: new THREE.MeshStandardMaterial({ color: "#c9a14a", roughness: 0.28, metalness: 0.9 }),
      paper: new THREE.MeshStandardMaterial({ color: "#efe6c8", roughness: 0.9 }),
    };
    const extra = {
      grass: pbr("grass", 6, {}, 0.8),
      lawn: pbr("grass", 5, { color: "#e4ffd8" }, 0.8),
      asphalt: pbr("asphalt", 4),
      windows: pbr("windows", 4.8, { metalness: 0.35, envMapIntensity: 1.2 }),
      carpetGold: pbr("carpetGold", 2),
      carpetGreen: pbr("carpetGreen", 2.4),
      curtainRed: pbr("curtainRed", 2.4, { side: THREE.DoubleSide }),
      curtainGreen: pbr("curtainGreen", 2.4, { side: THREE.DoubleSide }),
      lacquerPanel: pbr("lacquerPanel", 2.4, { envMapIntensity: 0.8 }),
      water: (() => {
        const t = palaceTexture("water", tq, aniso);
        return worldUV(new THREE.MeshStandardMaterial({ color: "#2f6f80", normalMap: t.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.06, metalness: 0.05, envMapIntensity: 1.1, transparent: true, opacity: 0.92 }), 7);
      })(),
      frame: new THREE.MeshStandardMaterial({ color: "#3b4a47", roughness: 0.45, metalness: 0.6 }),
      cream: pbr("paint", 1, { color: "#efe4cc" }, 0.8),
      bronze: new THREE.MeshStandardMaterial({ color: "#6e5a3a", roughness: 0.42, metalness: 0.7 }),
      chairGreen: new THREE.MeshStandardMaterial({ color: "#46644b", roughness: 0.85 }),
      felt: new THREE.MeshStandardMaterial({ color: "#3c8a45", roughness: 0.95 }),
      glow: new THREE.MeshStandardMaterial({ color: "#fff8e8", emissive: "#ffefcc", emissiveIntensity: 1.6 }),
      crystal: new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff3d6", emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.2 }),
      curb: pbr("stoneLight", 1.2, { color: "#f4f2ec" }),
      leaf: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
      bark: new THREE.MeshStandardMaterial({ color: "#5a4632", roughness: 1 }),
    };
    return { mats, extra };
  }, [gl, quality]);
}
type Extra = ReturnType<typeof usePalaceMaterials>["extra"];
type Mats = Record<Mat, THREE.Material>;

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

/** Instanced copies of one geometry from a list of matrices (built once). */
function Instances({ geometry, material, items, castShadow = false, receiveShadow = true }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: THREE.Matrix4[]; castShadow?: boolean; receiveShadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    items.forEach((m, i) => ref.current!.setMatrixAt(i, m));
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [items]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow={receiveShadow} />;
}
const M4 = (x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz));

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
      {model.trees.map((t, i) => (
        <CuboidCollider key={`t${i}`} args={[trunkRadius(t.s), 3, trunkRadius(t.s)]} position={[t.x, 3, t.z]} />
      ))}
    </RigidBody>
  );
}

export function PalaceGeometry({ model, quality }: { model: PalaceModel; quality: Quality }) {
  const { mats, extra } = usePalaceMaterials(quality);
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      Object.values(extra).forEach((m) => m.dispose());
    },
    [mats, extra],
  );
  // textures are cached across quality changes; free them when the scene goes away
  useEffect(() => () => disposePalaceTextures(), []);

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
      <Grounds model={model} mats={mats} extra={extra} quality={quality} />
      <Facade mats={mats} extra={extra} quality={quality} />
      <Interior mats={mats} extra={extra} />
      <Basement mats={mats} />
      <Rooftop mats={mats} />
      {model.closedDoors.map((d, i) => (
        <group key={i} position={d.p} rotation={[0, d.ry, 0]}>
          <mesh position={[0, d.h / 2, 0]} material={mats.door}>
            <boxGeometry args={[d.w, d.h, 0.08]} />
          </mesh>
          <mesh position={[0, d.h / 2, 0]} material={mats.wood}>
            <boxGeometry args={[d.w + 0.24, d.h + 0.12, 0.05]} />
          </mesh>
          <mesh position={[d.w * 0.35, d.h / 2, 0.06]} material={mats.gold}>
            <sphereGeometry args={[0.05, 8, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------- helpers */
/** Annular sector in the XZ plane (angles measured from +x toward +z), extruded upward. */
function sectorGeo(r0: number, r1: number, a0: number, a1: number, h: number, segs = 32) {
  // drawn with y = −z so that after rotateX(−90°) shape-y maps to world +z
  const s = new THREE.Shape();
  for (let i = 0; i <= segs; i++) {
    const a = a0 + ((a1 - a0) * i) / segs;
    s[i ? "lineTo" : "moveTo"](Math.cos(a) * r1, -Math.sin(a) * r1);
  }
  for (let i = segs; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / segs;
    s.lineTo(Math.cos(a) * r0, -Math.sin(a) * r0);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); // extrusion → +y
  return g;
}

/** Plane with gentle vertical folds (curtains). */
function foldedPlane(w: number, h: number, depth = 0.07) {
  const g = new THREE.PlaneGeometry(w, h, Math.max(4, Math.round(w * 10)), 1);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * Math.PI * 5) * depth);
  g.computeVertexNormals();
  return g;
}

/* -------------------------------------------------------------- grounds */
function Grounds({ model, mats, extra, quality }: { model: PalaceModel; mats: Mats; extra: Extra; quality: Quality }) {
  const [cx, cz] = GROUNDS.lawnCenter;
  const pz = PALACE.front.z1 + 4; // pond centre (porch edge)
  const ringIn = GROUNDS.ringRadius - GROUNDS.ringWidth / 2, ringOut = GROUNDS.ringRadius + GROUNDS.ringWidth / 2;
  const geo = useMemo(() => {
    const pond = [[0.12, 0.42], [0.58, 0.88]].flatMap(([a0, a1]) => {
      const A0 = Math.PI * a0, A1 = Math.PI * a1;
      const cap = 0.6 / 18;
      return [
        sectorGeo(21.8, 22.5, A0, A1, 0.55, 24),
        sectorGeo(13.6, 14.3, A0, A1, 0.55, 24),
        sectorGeo(13.6, 22.5, A0, A0 + cap, 0.55, 2),
        sectorGeo(13.6, 22.5, A1 - cap, A1, 0.55, 2),
      ];
    });
    return {
      pondCurb: mergeGeometries(pond)!,
      pondWater: mergeGeometries([[0.12, 0.42], [0.58, 0.88]].map(([a0, a1]) => sectorGeo(14.3, 21.8, Math.PI * a0, Math.PI * a1, 0.02, 24)))!,
      lawnCurb: sectorGeo(GROUNDS.lawnRadius, GROUNDS.lawnRadius + 0.35, 0, Math.PI * 2, 0.16, 128),
      ringCurbs: mergeGeometries([sectorGeo(ringIn - 0.3, ringIn, 0, Math.PI * 2, 0.12, 128), sectorGeo(ringOut, ringOut + 0.3, 0, Math.PI * 2, 0.12, 128)])!,
      basin: sectorGeo(7.0, 7.6, 0, Math.PI * 2, 0.6, 48),
    };
  }, [ringIn, ringOut]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={extra.grass} receiveShadow>
        <planeGeometry args={[GROUNDS.halfW * 2 + 40, GROUNDS.halfD * 2 + 40]} />
      </mesh>
      {/* outside the grounds: the surrounding streets */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} material={extra.asphalt}>
        <planeGeometry args={[GROUNDS.halfW * 2 + 400, GROUNDS.halfD * 2 + 400]} />
      </mesh>
      {/* ring drive (asphalt, light curbs) around the oval lawn (white curb) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.02, cz]} material={extra.asphalt} receiveShadow>
        <ringGeometry args={[ringIn, ringOut, 128]} />
      </mesh>
      <mesh geometry={geo.ringCurbs} position={[cx, 0, cz]} material={extra.curb} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.03, cz]} material={extra.lawn} receiveShadow>
        <circleGeometry args={[GROUNDS.lawnRadius, 128]} />
      </mesh>
      <mesh geometry={geo.lawnCurb} position={[cx, 0, cz]} material={extra.curb} receiveShadow />
      {/* round fountain basin in the lawn (official visitor map) */}
      <mesh geometry={geo.basin} position={[cx, 0, cz]} material={mats.stone} castShadow receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.45, cz]} material={extra.water}>
        <circleGeometry args={[7.05, 48]} />
      </mesh>
      <Fountain x={cx} z={cz} />
      {/* drive from the gate, forecourt paving */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, (GROUNDS.gateZ + cz + GROUNDS.ringRadius) / 2]} material={extra.asphalt} receiveShadow>
        <planeGeometry args={[14, GROUNDS.gateZ - cz - GROUNDS.ringRadius + 4]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 5]} material={mats.path} receiveShadow>
        <planeGeometry args={[110, 24]} />
      </mesh>
      {/* half-moon pond along the hall, split by the central walkway */}
      <mesh geometry={geo.pondCurb} position={[0, 0, pz]} material={mats.stone} castShadow receiveShadow />
      <mesh geometry={geo.pondWater} position={[0, 0.33, pz]} material={extra.water} />
      <mesh geometry={geo.pondWater} position={[0, 0.06, pz]}>
        <meshStandardMaterial color="#26383a" roughness={1} />
      </mesh>
      <WaterAnimator material={extra.water} />
      <Lotus pz={pz} />
      <Gate mats={mats} />
      <Trees trees={model.trees} extra={extra} quality={quality} />
      <OutdoorExhibits mats={mats} />
      <Octagon mats={mats} />
      <ExhibitionHouse mats={mats} />
      <TennisCourts />
    </group>
  );
}

function WaterAnimator({ material }: { material: THREE.MeshStandardMaterial }) {
  useFrame((s) => {
    const n = material.normalMap;
    if (n) n.offset.set(s.clock.elapsedTime * 0.012, s.clock.elapsedTime * 0.008);
  });
  return null;
}

/** Two tree species (rounded canopy, tall emergent crown) with per-instance tint. */
function Trees({ trees, extra, quality }: { trees: Tree[]; extra: Extra; quality: Quality }) {
  const geos = useMemo(() => {
    const detail = quality === "high" ? 2 : 1;
    const blob = (r: number, x: number, y: number, z: number, sy = 0.8) => {
      const g = new THREE.IcosahedronGeometry(r, detail);
      g.scale(1, sy, 1);
      g.translate(x, y, z);
      return g;
    };
    const roundCrown = mergeGeometries([blob(4, 0, 8.4, 0), blob(2.9, 2.4, 7.6, 0.8), blob(2.8, -2.2, 7.8, -1), blob(2.6, 0.4, 10.4, -0.6)])!;
    const tallCrown = mergeGeometries([blob(3.4, 0, 13.6, 0, 0.7), blob(2.6, 1.9, 12.6, 0.4, 0.7), blob(2.5, -1.8, 12.9, -0.6, 0.7)])!;
    const trunk = new THREE.CylinderGeometry(0.28, 0.55, 7, 7);
    trunk.translate(0, 3.5, 0);
    const tallTrunk = new THREE.CylinderGeometry(0.3, 0.6, 12, 7);
    tallTrunk.translate(0, 6, 0);
    return { roundCrown, tallCrown, trunk, tallTrunk };
  }, [quality]);
  const split = useMemo(() => {
    const m = (t: Tree) => M4(t.x, 0, t.z, t.h * 6.28, t.s, t.s * (0.9 + t.h * 0.2), t.s);
    const round = trees.filter((t) => t.h < 0.62), tall = trees.filter((t) => t.h >= 0.62);
    return { round: round.map(m), tall: tall.map(m), rTint: round.map((t) => t.h), tTint: tall.map((t) => t.h) };
  }, [trees]);
  const roundRef = useRef<THREE.InstancedMesh>(null);
  const tallRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const c = new THREE.Color();
    const paint = (mesh: THREE.InstancedMesh | null, mats: THREE.Matrix4[], tint: number[]) => {
      if (!mesh) return;
      mats.forEach((mm, i) => {
        mesh.setMatrixAt(i, mm);
        mesh.setColorAt(i, c.setHSL(0.22 + tint[i] * 0.1, 0.42 + tint[i] * 0.15, 0.24 + tint[i] * 0.1));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    paint(roundRef.current, split.round, split.rTint);
    paint(tallRef.current, split.tall, split.tTint);
  }, [split]);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  const castCrown = quality === "high";
  return (
    <group>
      <Instances geometry={geos.trunk} material={extra.bark} items={split.round} castShadow={quality !== "low"} />
      <Instances geometry={geos.tallTrunk} material={extra.bark} items={split.tall} castShadow={quality !== "low"} />
      <instancedMesh ref={roundRef} args={[geos.roundCrown, extra.leaf, split.round.length]} castShadow={castCrown} receiveShadow />
      <instancedMesh ref={tallRef} args={[geos.tallCrown, extra.leaf, split.tall.length]} castShadow={castCrown} receiveShadow />
    </group>
  );
}

function Fountain({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    ref.current?.children.forEach((c, i) => (c.scale.y = 1 + Math.sin(s.clock.elapsedTime * 3 + i) * 0.06));
  });
  return (
    <group ref={ref} position={[x, 0.45, z]}>
      {[[0, 0, 1.15, 4.6], [2.6, 0, 0.5, 2.2], [-2.6, 0, 0.5, 2.2], [0, 2.6, 0.5, 2.2], [0, -2.6, 0.5, 2.2]].map(([dx, dz, r, h], i) => (
        <mesh key={i} position={[dx, 0, dz]}>
          <coneGeometry args={[r, h, 16, 1, true]} />
          <meshStandardMaterial color="#e3f2fa" transparent opacity={0.5} roughness={0.1} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Lotus({ pz }: { pz: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const pads = useMemo(() => {
    const R = rng(5);
    const out: [number, number][] = [];
    for (let i = 0; i < 80; i++) {
      const side = R() < 0.5 ? 0 : 1;
      const a = Math.PI * (side ? 0.6 + R() * 0.26 : 0.14 + R() * 0.26);
      const r = 15 + R() * 6;
      out.push([Math.cos(a) * r, pz + Math.sin(a) * r]);
    }
    return out;
  }, [pz]);
  useEffect(() => {
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    pads.forEach(([x, z], i) => {
      o.position.set(x, 0.37, z);
      o.rotation.set(-Math.PI / 2, 0, i);
      o.scale.setScalar(0.6 + (i % 5) * 0.12);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
      ref.current!.setColorAt(i, c.setHSL(0.27 + (i % 7) * 0.012, 0.5, 0.3 + (i % 3) * 0.04));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, [pads]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, pads.length]}>
      <circleGeometry args={[0.6, 12, 0.3, Math.PI * 1.85]} />
      <meshStandardMaterial roughness={0.6} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function Gate({ mats }: { mats: Mats }) {
  const z = GROUNDS.gateZ;
  const bars = useMemo(() => Array.from({ length: 28 }, (_, i) => M4(-6.75 + i * 0.5, 1.2, z)), [z]);
  const bar = useMemo(() => new THREE.BoxGeometry(0.06, 2.4, 0.06), []);
  return (
    <group>
      <Instances geometry={bar} material={mats.metal} items={bars} />
      {[2.35, 0.25].map((y) => (
        <mesh key={y} position={[0, y, z]} material={mats.metal}>
          <boxGeometry args={[14, 0.1, 0.1]} />
        </mesh>
      ))}
      {[-7.4, 7.4].map((x) => (
        <group key={x}>
          <mesh position={[x, 1.6, z]} material={mats.stone} castShadow>
            <boxGeometry args={[1.2, 3.2, 1.2]} />
          </mesh>
          <mesh position={[x, 3.28, z]} material={mats.stone}>
            <boxGeometry args={[1.4, 0.16, 1.4]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Illustrative tank and F-5E silhouettes where the official map marks the outdoor exhibits. */
function OutdoorExhibits({ mats }: { mats: Mats }) {
  const olive = useMemo(() => new THREE.MeshStandardMaterial({ color: "#4f5a3a", roughness: 0.75, metalness: 0.2 }), []);
  const jet = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8d949a", roughness: 0.45, metalness: 0.45 }), []);
  useEffect(() => () => [olive, jet].forEach((m) => m.dispose()), [olive, jet]);
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
    </group>
  );
}

/** Octagonal pavilion: 4 m across, on a mound, no walls, curved tile roof (official description). */
function Octagon({ mats }: { mats: Mats }) {
  const tile = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9c4a33", roughness: 0.75 }), []);
  useEffect(() => () => tile.dispose(), [tile]);
  const roof = useMemo(() => {
    const pts = [new THREE.Vector2(0.01, 1.7), new THREE.Vector2(0.9, 1.15), new THREE.Vector2(2.1, 0.45), new THREE.Vector2(3.0, 0.1), new THREE.Vector2(3.2, 0.25)];
    return new THREE.LatheGeometry(pts, 8);
  }, []);
  useEffect(() => () => roof.dispose(), [roof]);
  return (
    <group position={[176, 0, 126]}>
      <mesh position={[0, 0.6, 0]} material={mats.stone}><cylinderGeometry args={[4.5, 6, 1.2, 8]} /></mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[Math.cos((i / 8) * Math.PI * 2) * 1.9, 2.6, Math.sin((i / 8) * Math.PI * 2) * 1.9]} material={mats.wood}>
          <cylinderGeometry args={[0.1, 0.1, 2.8]} />
        </mesh>
      ))}
      <mesh geometry={roof} position={[0, 3.8, 0]} material={tile} castShadow />
    </group>
  );
}

/** Two-storey French-style exhibition building (official photo: yellow walls, teal shutters, tiled hip roof). */
function ExhibitionHouse({ mats }: { mats: Mats }) {
  const m = useMemo(
    () => ({
      yellow: worldUV(new THREE.MeshStandardMaterial({ ...pick(mats.facade as THREE.MeshStandardMaterial), color: "#f3d98c" }), 4),
      tile: new THREE.MeshStandardMaterial({ color: "#b0603f", roughness: 0.75 }),
      shutter: new THREE.MeshStandardMaterial({ color: "#5aa2ad", roughness: 0.6 }),
    }),
    [mats],
  );
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);
  const roof = useMemo(() => {
    const g = new THREE.ConeGeometry(1, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    return g;
  }, []);
  useEffect(() => () => roof.dispose(), [roof]);
  return (
    <group position={[-170, 0, 58]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 4, 0]} material={m.yellow} castShadow receiveShadow><boxGeometry args={[26, 8, 12]} /></mesh>
      <mesh position={[0, 8.15, 0]} material={mats.facade}><boxGeometry args={[26.6, 0.3, 12.6]} /></mesh>
      <mesh geometry={roof} position={[0, 10.3, 0]} scale={[19.5, 4, 9.6]} material={m.tile} castShadow />
      {[0, 1].flatMap((fl) =>
        Array.from({ length: 7 }, (_, i) => (
          <mesh key={`${fl}-${i}`} position={[-10.5 + i * 3.5, 2 + fl * 4, 6.04]} material={m.shutter}>
            <boxGeometry args={[1.3, 2.2, 0.06]} />
          </mesh>
        )),
      )}
    </group>
  );
}
const pick = (m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterialParameters => ({ map: m.map, roughnessMap: m.roughnessMap, normalMap: m.normalMap, normalScale: m.normalScale, roughness: m.roughness });

function TennisCourts() {
  return (
    <group position={[0, 0.03, -128]}>
      {[-60, -24, 24, 60].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[18, 34]} />
            <meshStandardMaterial color="#3d7f6a" roughness={0.9} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <planeGeometry args={[11, 24]} />
            <meshStandardMaterial color="#3a6f9a" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- façade */
const F = PALACE.front, RW = PALACE.rear;
const CEIL_F1 = LEVEL.f1 + 4.7;
const GLAZE_TOP = CEIL_F1 + 0.3;

/**
 * Stone curtain (rèm hoa đá): columns of stacked bamboo-node stones. Each
 * stone narrows toward its middle, so neighbouring columns leave the lens-
 * shaped openings seen in the official photos. It wraps the front and sides
 * between the two balconies of the 三 composition; the band height follows
 * the façade photos and is an estimate.
 */
function stoneCurtainGeo(quality: Quality, height: number, rows: number) {
  const radial = quality === "high" ? 9 : quality === "medium" ? 7 : 5;
  const seg = height / rows;
  const pts: THREE.Vector2[] = [];
  const steps = 6;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k <= steps; k++) {
      if (r > 0 && k === 0) continue;
      const t = k / steps;
      const w = Math.pow(Math.abs(2 * t - 1), 1.7); // 1 at the joints, 0 mid-stone
      pts.push(new THREE.Vector2(0.085 + 0.19 * w, r * seg + t * seg));
    }
  }
  pts.unshift(new THREE.Vector2(0.001, 0));
  pts.push(new THREE.Vector2(0.001, height));
  const g = new THREE.LatheGeometry(pts, radial);
  g.scale(1, 1, 0.55);
  return g;
}

function Facade({ mats, extra, quality }: { mats: Mats; extra: Extra; quality: Quality }) {
  const curtain = useMemo(() => {
    const y0 = LEVEL.l1, y1 = LEVEL.l3 - 0.4;
    const geo = stoneCurtainGeo(quality, y1 - y0, 8);
    const items: THREE.Matrix4[] = [];
    const step = 0.6;
    for (let x = F.x0 + 0.3; x <= F.x1 - 0.3; x += step) items.push(M4(x, y0, F.z1 + 1.6));
    for (let z = F.z0 + 0.3; z <= F.z1 + 1.3; z += step) {
      items.push(M4(F.x0 - 1.6, y0, z, Math.PI / 2));
      items.push(M4(F.x1 + 1.6, y0, z, Math.PI / 2));
    }
    return { geo, items };
  }, [quality]);

  // Ground-floor glazing (hall + cabinet room) and its mullions.
  const mullions = useMemo(() => {
    const v = new THREE.BoxGeometry(0.09, GLAZE_TOP - LEVEL.f1, 0.14);
    const items: THREE.Matrix4[] = [];
    const yc = (LEVEL.f1 + GLAZE_TOP) / 2;
    for (let x = -16; x <= F.x1 + 0.01; x += 1.5) if (Math.abs(x) > 3.05 || Math.abs(Math.abs(x) - 3) < 0.01) items.push(M4(x, yc, F.z1));
    for (let z = F.z0 + 0.75; z <= F.z1 - 0.5; z += 1.5) items.push(M4(F.x1, yc, z, Math.PI / 2));
    return { v, items };
  }, []);

  // Opaque window bands on storeys whose interiors are not modelled.
  const bands = useMemo(() => {
    const L = LEVEL;
    const storeys: [number, number][] = [[L.l1 + 0.5, L.l2 - 0.35], [L.l2 + 0.35, L.l3 - 0.45], [L.l3 + 0.45, L.roof - 0.5]];
    const out: { p: [number, number, number]; ry: number; w: number; h: number }[] = [];
    const along = (x0: number, x1: number, z: number, out_: 1 | -1, ranges: [number, number][]) => {
      for (const [a, b] of ranges) out.push({ p: [(x0 + x1) / 2, (a + b) / 2, z + out_ * 0.215], ry: out_ > 0 ? 0 : Math.PI, w: x1 - x0, h: b - a });
    };
    const side = (z0: number, z1: number, x: number, out_: 1 | -1, ranges: [number, number][]) => {
      for (const [a, b] of ranges) out.push({ p: [x + out_ * 0.215, (a + b) / 2, (z0 + z1) / 2], ry: out_ > 0 ? Math.PI / 2 : -Math.PI / 2, w: z1 - z0, h: b - a });
    };
    const gf: [number, number] = [L.f1 + 0.6, CEIL_F1 - 0.2];
    along(F.x0 + 1, F.x1 - 1, F.z1, 1, storeys);
    along(F.x0 + 1, -16.5, F.z1, 1, [gf]);
    side(F.z0 + 1, F.z1 - 1, F.x0, -1, [gf, ...storeys]);
    side(F.z0 + 1, F.z1 - 1, F.x1, 1, storeys);
    along(F.x0 + 1, RW.x0 - 1, F.z0, -1, [gf, ...storeys]);
    along(RW.x1 + 1, F.x1 - 1, F.z0, -1, [gf, ...storeys]);
    along(RW.x0 + 1, RW.x1 - 1, RW.z0, -1, [gf, ...storeys]);
    side(RW.z0 + 1, F.z0 - 1, RW.x0, -1, [gf, ...storeys]);
    side(RW.z0 + 1, F.z0 - 1, RW.x1, 1, [gf, ...storeys]);
    return out;
  }, []);

  // Slender piers along the top balcony (top storey of the façade photos).
  const fins = useMemo(() => {
    const h = LEVEL.roof + 0.65 - LEVEL.l3;
    const g = new THREE.BoxGeometry(0.24, h, 0.5);
    const items: THREE.Matrix4[] = [];
    const y = LEVEL.l3 + h / 2;
    for (let x = F.x0 + 1.2; x <= F.x1 - 1.1; x += 2.4) items.push(M4(x, y, F.z1 + 3.45));
    for (let z = F.z0 + 1.2; z <= F.z1 + 2.5; z += 2.4) {
      items.push(M4(F.x0 - 3.45, y, z));
      items.push(M4(F.x1 + 3.45, y, z));
    }
    return { g, items };
  }, []);

  const slab = (y: number, depth: number, t: number, key: string) => (
    <group key={key}>
      <mesh position={[0, y, F.z1 + depth / 2]} material={mats.facade} castShadow receiveShadow>
        <boxGeometry args={[F.x1 - F.x0 + depth * 2, t, depth]} />
      </mesh>
      {[F.x0 - depth / 2, F.x1 + depth / 2].map((x) => (
        <mesh key={x} position={[x, y, (F.z0 + F.z1) / 2]} material={mats.facade} castShadow receiveShadow>
          <boxGeometry args={[depth, t, F.z1 - F.z0]} />
        </mesh>
      ))}
    </group>
  );

  return (
    <group>
      {/* ground-floor glazing */}
      {[[-16, -3], [3, F.x1]].map(([a, b]) => (
        <mesh key={a} position={[(a + b) / 2, (LEVEL.f1 + GLAZE_TOP) / 2, F.z1]} material={mats.glass}>
          <planeGeometry args={[b - a, GLAZE_TOP - LEVEL.f1]} />
        </mesh>
      ))}
      <mesh position={[0, (LEVEL.f1 + 3.6 + GLAZE_TOP) / 2, F.z1]} material={mats.glass}>
        <planeGeometry args={[6, GLAZE_TOP - LEVEL.f1 - 3.6]} />
      </mesh>
      <mesh position={[F.x1, (LEVEL.f1 + GLAZE_TOP) / 2, (F.z0 + F.z1) / 2]} rotation={[0, Math.PI / 2, 0]} material={mats.glass}>
        <planeGeometry args={[F.z1 - F.z0, GLAZE_TOP - LEVEL.f1]} />
      </mesh>
      <Instances geometry={mullions.v} material={extra.frame} items={mullions.items} />
      {/* transoms */}
      <mesh position={[(F.x1 - 16) / 2, LEVEL.f1 + 3.6, F.z1]} material={extra.frame}>
        <boxGeometry args={[F.x1 + 16, 0.1, 0.14]} />
      </mesh>
      <mesh position={[F.x1, LEVEL.f1 + 3.6, (F.z0 + F.z1) / 2]} material={extra.frame}>
        <boxGeometry args={[0.14, 0.1, F.z1 - F.z0]} />
      </mesh>
      {/* window bands */}
      {bands.map((b, i) => (
        <mesh key={i} position={b.p} rotation={[0, b.ry, 0]} material={extra.windows}>
          <planeGeometry args={[b.w, b.h]} />
        </mesh>
      ))}
      {/* stone curtain */}
      <Instances geometry={curtain.geo} material={mats.curtain} items={curtain.items} castShadow={quality === "high"} />
      {/* balconies and eaves — the horizontal strokes of 三 */}
      {slab(LEVEL.l1 - 0.2, 3.8, 0.4, "b1")}
      {slab(LEVEL.l3 - 0.2, 3.8, 0.4, "b3")}
      {slab(LEVEL.roof + 0.9, 3.9, 0.5, "eave")}
      <Instances geometry={fins.g} material={mats.facade} items={fins.items} castShadow={quality !== "low"} />
      {/* entrance canopy and its two wooden columns */}
      <mesh position={[0, LEVEL.f1 + 4.2, F.z1 + 4]} material={mats.facade} castShadow receiveShadow>
        <boxGeometry args={[20, 0.4, 8]} />
      </mesh>
      {[-8.5, 8.5].map((x) => (
        <mesh key={x} position={[x, LEVEL.f1 + 2.1, F.z1 + 7.4]} material={mats.wood} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 4.2, 16]} />
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

/* ---------------------------------------------------------------- interior */
function Interior({ mats, extra }: { mats: Mats; extra: Extra }) {
  const y = LEVEL.f1;
  const cabChairs = useMemo(() => FURNITURE.cabChairs.map((c) => M4(c.x, y, c.z, c.ry)), [y]);
  const chairGeo = useMemo(() => {
    const seat = new THREE.BoxGeometry(0.62, 0.16, 0.6);
    seat.translate(0, 0.46, 0);
    const back = new THREE.BoxGeometry(0.62, 0.62, 0.12);
    back.translate(0, 0.84, -0.26);
    const armL = new THREE.BoxGeometry(0.1, 0.24, 0.56);
    armL.translate(0.31, 0.62, 0);
    const armR = armL.clone();
    armR.translate(-0.62, 0, 0);
    return mergeGeometries([seat, back, armL, armR])!;
  }, []);
  const pedestal = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.04, 0.22, 0.4, 10);
    g.translate(0, 0.2, 0);
    return g;
  }, []);
  const tableTop = useMemo(() => {
    const s = new THREE.Shape();
    s.absellipse(0, 0, 6.6, 2.5, 0, Math.PI * 2, false, 0);
    const hole = new THREE.Path();
    hole.absellipse(0, 0, 4.9, 1.1, 0, Math.PI * 2, true, 0);
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false, curveSegments: 48 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  useEffect(() => () => [chairGeo, pedestal, tableTop].forEach((g) => g.dispose()), [chairGeo, pedestal, tableTop]);

  const rearFloor = useMemo(() => {
    // plane in XY (rotated to XZ: shape y = −z); hole over the basement stair flights
    const s = new THREE.Shape([new THREE.Vector2(RW.x0 + 0.2, 36.2), new THREE.Vector2(RW.x1 - 0.2, 36.2), new THREE.Vector2(RW.x1 - 0.2, 87.8), new THREE.Vector2(RW.x0 + 0.2, 87.8)]);
    s.holes.push(new THREE.Path([new THREE.Vector2(-13.6, 66.4), new THREE.Vector2(-9, 66.4), new THREE.Vector2(-9, 74), new THREE.Vector2(-13.6, 74)]));
    return new THREE.ShapeGeometry(s);
  }, []);
  useEffect(() => () => rearFloor.dispose(), [rearFloor]);
  const curtainH = CEIL_F1 - y - 0.25;
  const folds = useMemo(() => ({ red: foldedPlane(21, curtainH), green: foldedPlane(28, curtainH) }), [curtainH]);
  useEffect(() => () => Object.values(folds).forEach((g) => g.dispose()), [folds]);
  return (
    <group>
      {/* floors: polished dark granite (as in the official corridor photos) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.012, -23]} material={mats.floor} receiveShadow>
        <planeGeometry args={[89.6, 25.6]} />
      </mesh>
      {/* rear wing floor, open over the basement stair shaft */}
      <mesh geometry={rearFloor} rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.012, 0]} material={mats.floor} receiveShadow />
      {/* Credentials Room: golden carpet; Cabinet Room: green carpet (official photos) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.022, -48]} material={extra.carpetGold} receiveShadow>
        <planeGeometry args={[25.6, 23.6]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[30.5, y + 0.022, -23]} material={extra.carpetGreen} receiveShadow>
        <planeGeometry args={[28.6, 25.6]} />
      </mesh>
      {/* hall columns */}
      {FURNITURE.hallColumns.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, y + 2.35, z]} material={mats.wall} castShadow receiveShadow>
          <cylinderGeometry args={[0.45, 0.45, 4.7, 24]} />
        </mesh>
      ))}
      {/* cornices along the hall ceiling */}
      {[-35.7, -10.3].map((z) => (
        <mesh key={z} position={[0, CEIL_F1 - 0.12, z]} material={mats.wall}>
          <boxGeometry args={[31.6, 0.24, 0.2]} />
        </mesh>
      ))}
      <Chandelier p={[0, CEIL_F1, -23]} r={1.4} extra={extra} />
      <Chandelier p={[0, CEIL_F1, -48]} r={1.25} extra={extra} />

      {/* ---- Credentials Room ---- */}
      {/* red curtains along the east wall and the end corners */}
      <mesh geometry={folds.red} position={[12.7, y + curtainH / 2, -48]} rotation={[0, -Math.PI / 2, 0]} material={extra.curtainRed} />
      {[-11, 11].map((x) => (
        <mesh key={x} position={[x, y + curtainH / 2, -59.7]} material={extra.curtainRed}>
          <planeGeometry args={[3.2, curtainH]} />
        </mesh>
      ))}
      {/* lacquer panels on the west wall */}
      <mesh position={[-12.77, y + 0.3 + (curtainH - 0.5) / 2, -48]} rotation={[0, Math.PI / 2, 0]} material={extra.lacquerPanel}>
        <planeGeometry args={[21, curtainH - 0.5]} />
      </mesh>
      {/* illustrative lacquer mural on the end wall (not the real artwork) */}
      <group position={[0, y + 2.4, -59.75]}>
        <mesh material={mats.gold}><boxGeometry args={[9.6, 3.6, 0.08]} /></mesh>
        <mesh position={[0, 0, 0.05]} material={mats.lacquer}><boxGeometry args={[9.2, 3.2, 0.04]} /></mesh>
      </group>
      <CredentialsFurniture y={y} mats={mats} extra={extra} />

      {/* ---- Cabinet Room ---- */}
      {[-10.45, -35.55].map((z) => (
        <mesh key={z} geometry={folds.green} position={[30.5, y + curtainH / 2, z]} rotation={[0, z > -20 ? Math.PI : 0, 0]} material={extra.curtainGreen} />
      ))}
      <group position={[32, y, -23]}>
        <mesh geometry={tableTop} position={[0, 0.76, 0]} material={mats.wood} castShadow receiveShadow />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.7, 0]} scale={[4.9, 1.1, 1]} material={extra.felt}>
          <circleGeometry args={[1, 40]} />
        </mesh>
        {[-4.8, -1.6, 1.6, 4.8].map((x) => (
          <mesh key={x} position={[x, 0.38, 0]} material={mats.metal}>
            <boxGeometry args={[0.08, 0.76, 3.2]} />
          </mesh>
        ))}
      </group>
      <Instances geometry={chairGeo} material={extra.chairGreen} items={cabChairs} castShadow />
      <Instances geometry={pedestal} material={mats.metal} items={cabChairs} />
      {/* rectangular ceiling light frame above the table */}
      <group position={[32, CEIL_F1 - 0.35, -23]}>
        {[[0, -1.3, 7.6, 0.18], [0, 1.3, 7.6, 0.18], [-3.7, 0, 0.18, 2.6], [3.7, 0, 0.18, 2.6]].map(([x, z, w, d], i) => (
          <mesh key={i} position={[x, 0, z]} material={extra.glow}>
            <boxGeometry args={[w, 0.16, d]} />
          </mesh>
        ))}
      </group>

    </group>
  );
}

/** Crystal chandelier: brass ring, hanging drops, warm bulb. */
function Chandelier({ p, r, extra }: { p: [number, number, number]; r: number; extra: Extra }) {
  const drops = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let ring = 0; ring < 3; ring++) {
      const rr = r * (1 - ring * 0.28), n = 18 - ring * 4;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.3;
        out.push(M4(Math.cos(a) * rr, -0.55 - ring * 0.32, Math.sin(a) * rr, 0, 1, 1.6 + ring * 0.3, 1));
      }
    }
    return out;
  }, [r]);
  const drop = useMemo(() => new THREE.OctahedronGeometry(0.07, 0), []);
  return (
    <group position={p}>
      <mesh position={[0, -0.2, 0]} material={extra.bronze}>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 6]} />
      </mesh>
      <mesh position={[0, -0.45, 0]} rotation={[Math.PI / 2, 0, 0]} material={extra.bronze}>
        <torusGeometry args={[r, 0.035, 6, 32]} />
      </mesh>
      <mesh position={[0, -0.85, 0]} material={extra.glow}>
        <sphereGeometry args={[0.32, 16, 10]} />
      </mesh>
      <Instances geometry={drop} material={extra.crystal} items={drops} receiveShadow={false} />
    </group>
  );
}

/** Credentials Room furniture after the official photo: cream sofas on lacquer bases, low tables, tall vases. */
function CredentialsFurniture({ y, mats, extra }: { y: number; mats: Mats; extra: Extra }) {
  const { credSeats: pieces, credTables: tables, credVases: vases } = FURNITURE;
  const vaseGeo = useMemo(() => {
    const pts = [[0.001, 0], [0.18, 0.02], [0.26, 0.3], [0.3, 0.7], [0.22, 1.05], [0.15, 1.25], [0.2, 1.45], [0.001, 1.45]].map(([a, b]) => new THREE.Vector2(a, b));
    return new THREE.LatheGeometry(pts, 20);
  }, []);
  useEffect(() => () => vaseGeo.dispose(), [vaseGeo]);
  return (
    <group>
      {pieces.map((p, i) => {
        const { w, d } = seatSize(p.seats);
        return (
          <group key={i} position={[p.x, y, p.z]} rotation={[0, p.side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
            <mesh position={[0, 0.16, 0]} material={mats.lacquer} castShadow><boxGeometry args={[w + 0.8, 0.32, d]} /></mesh>
            <mesh position={[0, 0.42, 0.05]} material={extra.cream} castShadow><boxGeometry args={[w, 0.2, d - 0.1]} /></mesh>
            <mesh position={[0, 0.78, -d / 2 + 0.14]} material={extra.cream} castShadow><boxGeometry args={[w, 0.56, 0.24]} /></mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * (w / 2 + 0.2), 0.48, 0]} material={mats.lacquer} castShadow><boxGeometry args={[0.4, 0.34, d]} /></mesh>
            ))}
          </group>
        );
      })}
      {tables.map(([x, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh position={[0, 0.2, 0]} material={mats.lacquer}><boxGeometry args={[0.7, 0.4, 1.2]} /></mesh>
          <mesh position={[0, 0.42, 0]} material={mats.wood}><boxGeometry args={[0.76, 0.05, 1.26]} /></mesh>
        </group>
      ))}
      {vases.map(([x, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh position={[0, 0.3, 0]} material={mats.lacquer}><boxGeometry args={[0.6, 0.6, 0.6]} /></mesh>
          <mesh geometry={vaseGeo} position={[0, 0.6, 0]} material={extra.bronze} castShadow />
        </group>
      ))}
      {/* desk in front of the mural */}
      <group position={[0, y, -57]}>
        <mesh position={[0, 0.38, 0]} material={mats.lacquer} castShadow><boxGeometry args={[3.2, 0.76, 1]} /></mesh>
      </group>
    </group>
  );
}

function Basement({ mats }: { mats: Mats }) {
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
    </group>
  );
}

function Rooftop({ mats }: { mats: Mats }) {
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
  useEffect(() => () => { flagGeo.dispose(); flagTex.dispose(); }, [flagGeo, flagTex]);
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
      <mesh geometry={flagGeo} position={[fx + 2.3, fy + 10.4, fz]}>
        <meshStandardMaterial map={flagTex} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      {/* raised square in the courtyard */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, LEVEL.roof + 0.02, (PAVILION.court.z0 + PAVILION.court.z1) / 2]} material={mats.stone}>
        <planeGeometry args={[PAVILION.court.x * 2, PAVILION.court.z1 - PAVILION.court.z0]} />
      </mesh>
    </group>
  );
}
