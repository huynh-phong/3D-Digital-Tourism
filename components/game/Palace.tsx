"use client";

import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { MAIN_DOOR } from "@/data/dinh/interactions";
import { SPACE_BY_ID, type DecorId, type SpaceDoor } from "@/data/dinh/spaces";
import { useFrame, useThree } from "@react-three/fiber";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FLAG_POLE, GROUNDS, LEVEL, PALACE, PAVILION } from "@/data/dinh/layout";
import { rng } from "@/lib/geo";
import { FURNITURE, seatSize, trunkRadius, type Box, type Mat, type PalaceModel, type Tree } from "@/lib/dinh/palaceModel";
import type { SpaceModel } from "@/lib/dinh/spaceModel";
import { Elevations, Helipad, LawnFountain, Roofline, Topiary } from "./PalaceExterior";
import { CourtyardDecor, CreamReceptionDecor, OfficeDecor, PresReceptionDecor, RedReceptionDecor, VpReceptionDecor } from "./PalaceRoomsF2";
import { palaceTexture, worldUV, type TexName } from "@/lib/dinh/textures";
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
      // plain red stair runner (DDLP_0066, 0239)
      runner: pbr("carpetMustard", 2, { color: "#c2343a" }, 0.8),
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
      // rooms re-modelled from the reference photo set
      carpetRedFloral: pbr("carpetRedFloral", 3.2),
      carpetMustard: pbr("carpetMustard", 2.4),
      curtainGold: pbr("curtainGold", 2.4, { side: THREE.DoubleSide }),
      sheer: new THREE.MeshStandardMaterial({ color: "#fbf8f0", roughness: 0.9, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
      woodReeded: pbr("woodReeded", 1.2),
      woodPlank: pbr("woodPlank", 2.4),
      damaskRed: pbr("damaskRed", 0.9),
      burl: pbr("burl", 1.2, { envMapIntensity: 0.9 }),
      ceilingTile: pbr("ceilingTile", 2.4),
      tileGrey: pbr("tileGrey", 2.4, { envMapIntensity: 0.4 }),
      tileCross: pbr("tileCross", 2.4, { envMapIntensity: 0.4 }),
      mapPaper: pbr("mapPaper", 3),
      stageCurtain: pbr("curtainRed", 2.4, { color: "#9a6a6a", side: THREE.DoubleSide }),
      panelGlow: new THREE.MeshStandardMaterial({ color: "#fff4d6", emissive: "#ffe9b8", emissiveIntensity: 0.55, side: THREE.DoubleSide }),
      tableCream: new THREE.MeshStandardMaterial({ color: "#e6dcc6", roughness: 0.45 }),
      leatherTeal: new THREE.MeshStandardMaterial({ color: "#245f58", roughness: 0.42, metalness: 0.05 }),
      leatherBlue: new THREE.MeshStandardMaterial({ color: "#7d93a6", roughness: 0.5 }),
      bronzeVase: new THREE.MeshStandardMaterial({ color: "#8f7334", roughness: 0.32, metalness: 0.85 }),
      porcelain: new THREE.MeshStandardMaterial({ color: "#e6ecf1", roughness: 0.18, metalness: 0.05 }),
      steel: new THREE.MeshStandardMaterial({ color: "#7d8b7c", roughness: 0.55, metalness: 0.4 }),
      steelTop: new THREE.MeshStandardMaterial({ color: "#8e9c8c", roughness: 0.4, metalness: 0.3 }),
      teleprinter: new THREE.MeshStandardMaterial({ color: "#9a9a90", roughness: 0.55, metalness: 0.25 }),
      rope: new THREE.MeshStandardMaterial({ color: "#a3151b", roughness: 0.7 }),
      bark: new THREE.MeshStandardMaterial({ color: "#5a4632", roughness: 1 }),
      // exterior, roof, courtyard and floor-2 rooms (reference groups 01–06, 11–14)
      stoneRubble: pbr("stoneRubble", 2.4),
      relief: (() => {
        // one carved panel per face (plain 0–1 UVs, not world-tiled)
        const t = palaceTexture("relief", tq, aniso);
        return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.85 });
      })(),
      roofPaver: pbr("roofPaver", 2),
      mosaicBlue: pbr("mosaicBlue", 0.8),
      slate: pbr("slate", 2.6),
      damaskYellow: pbr("damaskYellow", 0.8),
      damaskRoundel: pbr("damaskRoundel", 0.7),
      carpetMaroon: pbr("carpetPlain", 1.6, { color: "#6d1424" }),
      carpetRed: pbr("carpetPlain", 1.6, { color: "#b3122a" }),
      boardsRust: pbr("boardsRust", 2.4),
      granitePink: pbr("granitePink", 1.6, { envMapIntensity: 0.6 }),
      rosewood: pbr("wood", 0.9, { color: "#6b3a2e", envMapIntensity: 0.8 }),
      leatherGreen: new THREE.MeshStandardMaterial({ color: "#1e3b33", roughness: 0.36, metalness: 0.04 }),
      hedge: pbr("grass", 0.9, { color: "#7aa45a" }, 1.6),
      fountainWhite: new THREE.MeshStandardMaterial({ color: "#eceeec", roughness: 0.3, flatShading: true }),
      jet: new THREE.MeshStandardMaterial({ color: "#f2f8fb", roughness: 0.1, transparent: true, opacity: 0.42, depthWrite: false }),
      winPane: new THREE.MeshStandardMaterial({ color: "#8d979a", roughness: 0.15, metalness: 0.25 }),
      navy: new THREE.MeshStandardMaterial({ color: "#1f2c45", roughness: 0.6 }),
      camo: pbr("camo", 3),
      terracotta: new THREE.MeshStandardMaterial({ color: "#a4482e", roughness: 0.8 }),
      palm: new THREE.MeshStandardMaterial({ color: "#4f7a33", roughness: 0.8, side: THREE.DoubleSide }),
      blueWhite: new THREE.MeshStandardMaterial({ color: "#e9eef4", roughness: 0.15 }),
      cobalt: new THREE.MeshStandardMaterial({ color: "#26388a", roughness: 0.2, metalness: 0.1 }),
      ivory: new THREE.MeshStandardMaterial({ color: "#efe5cf", roughness: 0.35 }),
      lacquerRed: new THREE.MeshStandardMaterial({ color: "#7c1612", roughness: 0.22, metalness: 0.05 }),
      fan: new THREE.MeshStandardMaterial({ color: "#c9cbc6", roughness: 0.4, metalness: 0.5 }),
    };
    return { mats, extra };
  }, [gl, quality]);
}
export type Extra = ReturnType<typeof usePalaceMaterials>["extra"];
export type Mats = Record<Mat, THREE.Material>;

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
export function Instances({ geometry, material, items, castShadow = false, receiveShadow = true }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: THREE.Matrix4[]; castShadow?: boolean; receiveShadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    items.forEach((m, i) => ref.current!.setMatrixAt(i, m));
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [items]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow={receiveShadow} />;
}
export const M4 = (x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz));

/**
 * Animations of a space stop while it sits in the cache (hidden): per-frame
 * hooks check this flag instead of running for nothing.
 */
const SpaceRunning = createContext(true);
export const useRunning = () => useContext(SpaceRunning);

export type SpaceMode = "active" | "loading" | "cached";

/** Colliders of one space (only the active space has any). */
function SpaceColliders({ sm }: { sm: SpaceModel }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      {sm.boxes
        .filter((b) => b.collide)
        .map((b, i) => (
          <CuboidCollider
            key={i}
            args={[b.s[0] / 2, b.s[1] / 2, b.s[2] / 2]}
            position={b.p}
            rotation={new THREE.Euler(b.rx ?? 0, b.ry ?? 0, 0, "YXZ").toArray().slice(0, 3) as [number, number, number]}
          />
        ))}
      {sm.trees.map((t, i) => (
        <CuboidCollider key={`t${i}`} args={[trunkRadius(t.s), 3, trunkRadius(t.s)]} position={[t.x, 3, t.z]} />
      ))}
    </RigidBody>
  );
}

/**
 * One space (room / area) of the palace: its own boxes, stair steps, doors,
 * furniture and — when active — colliders. Mounting it creates its GPU
 * resources; unmounting it frees them (geometries are disposed by the
 * components that created them; materials and textures are shared by all
 * spaces and owned by the scene). A cached space stays mounted but hidden,
 * without colliders, its animations paused.
 */
export function SpaceView({ sm, mode, mats, extra, quality, model, onReady }: { sm: SpaceModel; mode: SpaceMode; mats: Mats; extra: Extra; quality: Quality; model: PalaceModel; onReady?: () => void }) {
  const shadows = quality !== "low";
  const ref = useRef<THREE.Group>(null);
  const { gl, camera } = useThree();
  const groups = useMemo(() => {
    const g = new Map<Mat, Box[]>();
    for (const b of [...sm.boxes, ...sm.viewBoxes, ...sm.steps]) {
      if (b.visible === false) continue;
      if (!g.has(b.m)) g.set(b.m, []);
      g.get(b.m)!.push(b);
    }
    return g;
  }, [sm]);
  // A space being loaded is ready once its shaders are compiled (never shown half-built).
  useEffect(() => {
    if (mode !== "loading" || !onReady) return;
    let alive = true;
    const id = requestAnimationFrame(() => {
      if (!ref.current) return;
      gl.compileAsync(ref.current, camera)
        .catch(() => undefined)
        .then(() => alive && onReady());
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [mode, onReady, gl, camera]);
  const decor = SPACE_BY_ID.get(sm.id)!.decor;
  const has = (d: DecorId) => decor.includes(d);
  return (
    <SpaceRunning.Provider value={mode !== "cached"}>
      <group ref={ref} visible={mode !== "cached"} name={`space:${sm.id}`}>
        {[...groups].map(([m, list]) => (
          <BoxBatch key={m} boxes={list} material={mats[m]} shadows={shadows} />
        ))}
        {has("grounds") && <Grounds model={model} mats={mats} extra={extra} quality={quality} />}
        {has("groundsView") && <Grounds model={model} mats={mats} extra={extra} quality={quality} view />}
        {has("facade") && <Facade mats={mats} extra={extra} quality={quality} />}
        {has("mainDoor") && <MainDoor mats={mats} />}
        {has("hall") && <HallDecor mats={mats} extra={extra} />}
        {has("cabinet") && <CabinetDecor mats={mats} extra={extra} />}
        {has("credentials") && <CredentialsRoomDecor mats={mats} extra={extra} />}
        {has("rearFloor") && <RearFloor mats={mats} />}
        {has("stairBay") && <StairBayDecor mats={mats} extra={extra} />}
        {has("lobby2") && <LobbyDecor mats={mats} extra={extra} />}
        {has("daiYen") && <DaiYenDecor mats={mats} extra={extra} />}
        {has("khanhTiet") && <KhanhTietDecor mats={mats} extra={extra} />}
        {has("comms") && <CommsDecor mats={mats} extra={extra} />}
        {has("maps") && <MapsDecor mats={mats} extra={extra} />}
        {has("rooftop") && <Rooftop mats={mats} />}
        {has("roofline") && <Roofline mats={mats} extra={extra} />}
        {has("helipad") && <Helipad mats={mats} extra={extra} />}
        {has("presReception") && <PresReceptionDecor mats={mats} extra={extra} />}
        {has("redReception") && <RedReceptionDecor mats={mats} extra={extra} />}
        {has("vpReception") && <VpReceptionDecor mats={mats} extra={extra} />}
        {has("creamReception") && <CreamReceptionDecor mats={mats} extra={extra} />}
        {has("office2") && <OfficeDecor mats={mats} extra={extra} />}
        {has("courtyard") && <CourtyardDecor mats={mats} extra={extra} />}
        <ClosedDoors doors={sm.closedDoors} mats={mats} />
        <SpaceDoors doors={sm.doors} mats={mats} />
      </group>
      {mode === "active" && <SpaceColliders sm={sm} />}
    </SpaceRunning.Provider>
  );
}

function ClosedDoors({ doors, mats }: { doors: PalaceModel["closedDoors"]; mats: Mats }) {
  return (
    <>
      {doors.map((d, i) => (
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
    </>
  );
}

/** Double wooden doors in the doorways between spaces (the way through is F). */
function SpaceDoors({ doors, mats }: { doors: SpaceDoor[]; mats: Mats }) {
  return (
    <>
      {doors.map((d) => (
        <group key={d.id} position={d.p} rotation={[0, d.ry, 0]}>
          {[-1, 1].map((s) => (
            <group key={s} position={[(s * d.w) / 4, 0, 0]}>
              <mesh position={[0, d.h / 2, 0]} material={mats.door}>
                <boxGeometry args={[d.w / 2 - 0.04, d.h - 0.04, 0.1]} />
              </mesh>
              {[0.06, -0.06].map((z) => (
                <mesh key={z} position={[-s * (d.w / 4 - 0.18), d.h * 0.48, z]} material={mats.gold}>
                  <boxGeometry args={[0.04, 0.34, 0.04]} />
                </mesh>
              ))}
            </group>
          ))}
          <mesh position={[0, d.h / 2, 0]} material={mats.wood}>
            <boxGeometry args={[d.w + 0.24, d.h + 0.12, 0.06]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Double glass door in bronze frames across the main entrance. */
function MainDoor({ mats }: { mats: ReturnType<typeof usePalaceMaterials>["mats"] }) {
  const w = (MAIN_DOOR.x1 - MAIN_DOOR.x0) / 2, h = MAIN_DOOR.h, cx = (MAIN_DOOR.x0 + MAIN_DOOR.x1) / 2;
  return (
    <group position={[cx, MAIN_DOOR.y0, MAIN_DOOR.z]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[(s * w) / 2, 0, 0]}>
          <mesh position={[0, h / 2, 0]} material={mats.glass}>
            <boxGeometry args={[w - 0.12, h - 0.12, 0.03]} />
          </mesh>
          {/* frame */}
          {[[0, h - 0.04, w, 0.08], [0, 0.04, w, 0.08], [-w / 2 + 0.04, h / 2, 0.08, h], [w / 2 - 0.04, h / 2, 0.08, h]].map(([x, y, sx, sy], i) => (
            <mesh key={i} position={[x, y, 0]} material={mats.metal}>
              <boxGeometry args={[sx, sy, 0.08]} />
            </mesh>
          ))}
          {/* pull handle next to the meeting stiles */}
          <mesh position={[-s * (w / 2 - 0.22), h * 0.45, 0.07]} material={mats.gold}>
            <boxGeometry args={[0.04, 0.6, 0.04]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------- helpers */
/** Annular sector in the XZ plane (angles measured from +x toward +z), extruded upward. */
export function sectorGeo(r0: number, r1: number, a0: number, a1: number, h: number, segs = 32) {
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
export function foldedPlane(w: number, h: number, depth = 0.07) {
  const g = new THREE.PlaneGeometry(w, h, Math.max(4, Math.round(w * 10)), 1);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * Math.PI * 5) * depth);
  g.computeVertexNormals();
  return g;
}

/* -------------------------------------------------------------- grounds */
function Grounds({ model, mats, extra, quality, view = false }: { model: PalaceModel; mats: Mats; extra: Extra; quality: Quality; view?: boolean }) {
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
      {/* fountain in the lawn: hedge ring, basin, faceted drum, dome of jets (DDLP_0074, 0189, 0194) */}
      <LawnFountain x={cx} z={cz} mats={mats} extra={extra} />
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
      {/* seen through glass from inside, the grounds need their surfaces only */}
      {!view && (
        <>
          <Gate mats={mats} extra={extra} />
          <Topiary extra={extra} />
          <Trees trees={model.trees} extra={extra} quality={quality} />
          <OutdoorExhibits mats={mats} />
          <Octagon mats={mats} />
          <ExhibitionHouse mats={mats} />
          <TennisCourts />
        </>
      )}
    </group>
  );
}

function WaterAnimator({ material }: { material: THREE.MeshStandardMaterial }) {
  const running = useRunning();
  useFrame((s) => {
    if (!running) return;
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

/**
 * Main gate and front railing on Nam Kỳ Khởi Nghĩa (DDLP_0074, 0189, 0192):
 * spear-topped wrought-iron bars on a low pale base with pillars at intervals,
 * a double gate whose top rises in an arch with a band of rings, stone gate
 * pillars carrying black lamp posts with clustered lanterns, clipped conifers
 * along the base. Ironwork is instanced geometry (no texture cut-outs).
 */
function Gate({ mats, extra }: { mats: Mats; extra: Extra }) {
  const z = GROUNDS.gateZ, half = GROUNDS.halfW, gw = 7;
  const geo = useMemo(() => {
    const bar = new THREE.BoxGeometry(0.035, 1, 0.035);
    const spear = new THREE.ConeGeometry(0.05, 0.16, 4);
    const ring = new THREE.TorusGeometry(0.14, 0.018, 4, 12);
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const globe = new THREE.SphereGeometry(0.2, 12, 8);
    return { bar, spear, ring, unit, globe };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const items = useMemo(() => {
    const bars: THREE.Matrix4[] = [], spears: THREE.Matrix4[] = [], rings: THREE.Matrix4[] = [], iron: THREE.Matrix4[] = [], base: THREE.Matrix4[] = [], pillars: THREE.Matrix4[] = [], cones: THREE.Matrix4[] = [];
    const B = (x: number, y: number, zz: number, sx: number, sy: number, sz: number, out: THREE.Matrix4[]) => out.push(M4(x, y, zz, 0, sx, sy, sz));
    // railing: base 0.5 m, bars to 2.4 m, pillars every 9 m (only the visible front, out to ±120 m)
    for (const s of [-1, 1]) {
      const x0 = gw + 1.2, x1 = Math.min(half, 120);
      B(s * (x0 + x1) / 2, 0.25, z, x1 - x0, 0.5, 0.5, base);
      B(s * (x0 + x1) / 2, 2.25, z, x1 - x0, 0.05, 0.05, iron);
      B(s * (x0 + x1) / 2, 0.75, z, x1 - x0, 0.05, 0.05, iron);
      for (let x = x0 + 0.2; x < x1; x += 0.16) {
        B(s * x, 1.5, z, 1, 2.0, 1, bars);
        spears.push(M4(s * x, 2.58, z));
      }
      for (let x = x0 + 9; x < x1; x += 9) {
        B(s * x, 1.4, z, 0.6, 2.8, 0.6, pillars);
        cones.push(M4(s * (x + 4.5), 0.5 + 0.8, z - 1.2));
      }
    }
    // double gate: bars rising to an arch, a band of rings, rails
    for (let x = -gw + 0.1; x <= gw - 0.1; x += 0.14) {
      const top = 2.4 + 0.8 * Math.cos((x / gw) * (Math.PI / 2));
      B(x, top / 2, z, 1, top, 1, bars);
      spears.push(M4(x, top + 0.08, z));
    }
    for (const y of [0.15, 1.7, 2.15]) B(0, y, z, gw * 2, 0.07, 0.07, iron);
    for (let x = -gw + 0.3; x <= gw - 0.3; x += 0.3) rings.push(M4(x, 1.93, z));
    B(0, 1.2, z, 0.08, 2.4, 0.09, iron); // meeting stiles
    // gate pillars with lamp posts (DDLP_0192)
    for (const s of [-1, 1]) {
      B(s * (gw + 0.6), 1.6, z, 1.2, 3.2, 1.2, pillars);
      B(s * (gw + 0.6), 3.28, z, 1.4, 0.16, 1.4, pillars);
      B(s * (gw + 0.6), 5.0, z, 0.12, 3.4, 0.12, iron);
      B(s * (gw + 0.6), 6.55, z, 1.2, 0.06, 0.06, iron);
    }
    return { bars, spears, rings, iron, base, pillars, cones };
  }, [z, half]);
  const lamps = useMemo(() => [-1, 1].flatMap((s) => [-0.55, 0, 0.55].map((dx) => M4(s * (gw + 0.6) + dx, dx === 0 ? 6.95 : 6.75, z))), [z]);
  return (
    <group>
      <Instances geometry={geo.bar} material={extra.navy} items={items.bars} castShadow />
      <Instances geometry={geo.spear} material={mats.gold} items={items.spears} />
      <Instances geometry={geo.ring} material={extra.navy} items={items.rings} />
      <Instances geometry={geo.unit} material={extra.navy} items={items.iron} castShadow />
      <Instances geometry={geo.unit} material={extra.curb} items={items.base} receiveShadow />
      <Instances geometry={geo.unit} material={mats.stone} items={items.pillars} castShadow />
      <Instances geometry={geo.globe} material={extra.glow} items={lamps} />
      <TopiaryCones extra={extra} items={items.cones} />
    </group>
  );
}

function TopiaryCones({ extra, items }: { extra: Extra; items: THREE.Matrix4[] }) {
  const g = useMemo(() => new THREE.ConeGeometry(0.55, 1.6, 10), []);
  useEffect(() => () => g.dispose(), [g]);
  return <Instances geometry={g} material={extra.hedge} items={items} castShadow />;
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

function Facade({ mats, extra, quality }: { mats: Mats; extra: Extra; quality: Quality }) {
  // Ground-floor glazing (hall + cabinet room) and its mullions.
  const mullions = useMemo(() => {
    const v = new THREE.BoxGeometry(0.09, GLAZE_TOP - LEVEL.f1, 0.14);
    const items: THREE.Matrix4[] = [];
    const yc = (LEVEL.f1 + GLAZE_TOP) / 2;
    for (let x = -16; x <= F.x1 + 0.01; x += 1.5) if (Math.abs(x) > 3.05 || Math.abs(Math.abs(x) - 3) < 0.01) items.push(M4(x, yc, F.z1));
    for (let z = F.z0 + 0.75; z <= F.z1 - 0.5; z += 1.5) items.push(M4(F.x1, yc, z, Math.PI / 2));
    return { v, items };
  }, []);

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
      {/* elevations measured on DDLP_0153: fins, bands, stone curtain, windows, reliefs, honour balcony */}
      <Elevations mats={mats} extra={extra} quality={quality} />
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
/* ---------------------------------------------------- ground-floor rooms */
// Same meshes and materials as before the split into spaces; each room owns its own.
const curtainHeight = () => CEIL_F1 - LEVEL.f1 - 0.25;

/** Main hall: granite floor, columns, cornices, chandelier. */
function HallDecor({ mats, extra }: { mats: Mats; extra: Extra }) {
  const y = LEVEL.f1;
  return (
    <group>
      {/* floor: polished dark granite (as in the official corridor photos) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.012, -23]} material={mats.floor} receiveShadow>
        <planeGeometry args={[31.6, 25.6]} />
      </mesh>
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
    </group>
  );
}

/**
 * Phòng họp Hội đồng Nội các (group 07: DDLP_0001, 0017, 0019, 0098, 0139, 0247):
 * green patterned carpet, olive-gold damask curtain pairs at each tall window
 * with sheers and bronze tube sconces between them, a long ceiling coffer of
 * shallow vaults edged with cube lanterns and three two-tier candle chandeliers,
 * the oval ring table (cream top, wood edge, green well, steel hoop base) with a
 * gooseneck microphone at each seat, high-back green leather armchairs on chrome
 * legs, and carved side chairs in green damask along the wall.
 */
function CabinetDecor({ mats, extra }: { mats: Mats; extra: Extra }) {
  const y = LEVEL.f1;
  const T = FURNITURE.cabTable;
  const cabChairs = useMemo(() => FURNITURE.cabChairs.map((c) => M4(c.x, y, c.z, c.ry)), [y]);
  const geo = useMemo(() => {
    const part = (w: number, h: number, d: number, x: number, yy: number, z: number, rx = 0) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.rotateX(rx);
      g.translate(x, yy, z);
      return g;
    };
    // high-back leather armchair (DDLP_0017): tall back, padded arms
    const chair = mergeGeometries([
      part(0.64, 0.16, 0.6, 0, 0.47, 0.02),
      part(0.62, 0.86, 0.13, 0, 0.98, -0.27, -0.12),
      part(0.12, 0.22, 0.58, 0.31, 0.66, 0),
      part(0.12, 0.22, 0.58, -0.31, 0.66, 0),
    ])!;
    const legs = mergeGeometries([[-0.26, -0.24], [0.26, -0.24], [-0.26, 0.24], [0.26, 0.24]].map(([x, z]) => {
      const l = new THREE.CylinderGeometry(0.018, 0.014, 0.42, 6);
      l.translate(x, 0.21, z);
      return l;
    }))!;
    const ring = (rx: number, rz: number, hole: [number, number]) => {
      const sh = new THREE.Shape();
      sh.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
      const p = new THREE.Path();
      p.absellipse(0, 0, hole[0], hole[1], 0, Math.PI * 2, true, 0);
      sh.holes.push(p);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: false, curveSegments: 48 });
      g.rotateX(-Math.PI / 2);
      return g;
    };
    const hoop = new THREE.TorusGeometry(1, 0.025, 6, 64);
    hoop.rotateX(Math.PI / 2);
    // carved side chair: rosewood frame, damask seat and back panel (DDLP_0019)
    const sideFrame = mergeGeometries([
      part(0.5, 0.06, 0.48, 0, 0.44, 0),
      part(0.05, 0.44, 0.05, 0.22, 0.22, 0.2), part(0.05, 0.44, 0.05, -0.22, 0.22, 0.2),
      part(0.05, 1.05, 0.05, 0.22, 0.52, -0.21), part(0.05, 1.05, 0.05, -0.22, 0.52, -0.21),
      part(0.5, 0.1, 0.05, 0, 1.02, -0.21),
    ])!;
    const sidePad = mergeGeometries([part(0.42, 0.08, 0.4, 0, 0.5, 0.02), part(0.36, 0.42, 0.04, 0, 0.76, -0.19)])!;
    // shallow vault bay of the ceiling coffer (seen from below: double-sided material)
    const vault = new THREE.CylinderGeometry(1.5, 1.5, 6.6, 20, 1, true, -Math.PI / 2, Math.PI);
    vault.rotateX(Math.PI / 2);
    vault.scale(1, 0.3, 1);
    const neck = new THREE.CylinderGeometry(0.008, 0.008, 0.42, 5);
    neck.rotateX(0.5);
    neck.translate(0, 0.2, 0.1);
    const mic = mergeGeometries([part(0.08, 0.03, 0.12, 0, 0.015, 0), neck])!;
    const tube = new THREE.CylinderGeometry(0.06, 0.06, 0.34, 10);
    tube.translate(0, 0, 0.09);
    const sconce = mergeGeometries([part(0.12, 0.36, 0.04, 0, 0, 0), tube])!;
    return { chair, legs, top: ring(T.rx, T.rz, [4.9, 1.1]), edge: ring(T.rx + 0.06, T.rz + 0.06, [T.rx - 0.08, T.rz - 0.08]), hoop, sideFrame, sidePad, vault, mic, sconce, strut: new THREE.BoxGeometry(0.035, 0.76, 0.035), lantern: new THREE.BoxGeometry(0.22, 0.42, 0.22), bulb: new THREE.CylinderGeometry(0.045, 0.045, 0.3, 8) };
  }, [T.rx, T.rz]);
  const vaultMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f1ede4", roughness: 0.85, side: THREE.DoubleSide }), []);
  useEffect(() => () => { Object.values(geo).forEach((g) => g.dispose()); vaultMat.dispose(); }, [geo, vaultMat]);
  const curtainH = curtainHeight();
  const layout = useMemo(() => {
    const banks: { p: [number, number, number]; ry: number }[] = [];
    const sconces: THREE.Matrix4[] = [], bulbs: THREE.Matrix4[] = [];
    const yc = y + curtainH / 2 + 0.1;
    // tall windows on the lawn side (z = −10), the veranda side (z = −36) and the end wall (x = 45)
    for (let k = 0; k < 8; k++) {
      const x = 18.9 + k * 3.55;
      banks.push({ p: [x, yc, -10.5], ry: Math.PI }, { p: [x, yc, -35.5], ry: 0 });
      if (k < 7) {
        sconces.push(M4(x + 1.775, y + 2.7, -35.66, 0), M4(x + 1.775, y + 2.7, -10.34, Math.PI));
        bulbs.push(M4(x + 1.775, y + 2.7, -35.57, 0), M4(x + 1.775, y + 2.7, -10.43, 0));
      }
    }
    for (let k = 0; k < 6; k++) banks.push({ p: [44.5, yc, -32.6 + k * 4.25], ry: -Math.PI / 2 });
    // microphones on the table ring, one per seat, facing the seat
    const mics = FURNITURE.cabChairs.map((c) => {
      const a = Math.atan2((c.z - T.z) / T.rz, (c.x - T.x) / T.rx);
      return M4(T.x + Math.cos(a) * 5.8, y + 0.83, T.z + Math.sin(a) * 1.85, Math.atan2(c.x - T.x, c.z - T.z));
    });
    const sides: THREE.Matrix4[] = [];
    for (let x = 19.6; x <= 43; x += 1.2) sides.push(M4(x, y, -34.7, 0));
    const struts: THREE.Matrix4[] = [];
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      struts.push(M4(T.x + Math.cos(a) * 5.4, y + 0.38, T.z + Math.sin(a) * 1.7));
    }
    const lanterns: THREE.Matrix4[] = [];
    for (const s of [-1, 1]) for (let k = 0; k < 16; k++) lanterns.push(M4(22.5 + k * 1.3, CEIL_F1 - 0.42, T.z + s * 4.2));
    const vaults = Array.from({ length: 6 }, (_, k) => M4(24.5 + k * 3.0, CEIL_F1 - 0.05, T.z));
    const candles: THREE.Matrix4[] = [];
    for (const x of [25, 32, 39]) for (const [r, dy, n] of [[0.95, 0, 14], [0.6, 0.38, 10]]) for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      candles.push(M4(x + Math.cos(a) * r, CEIL_F1 - 1.0 + dy + 0.14, T.z + Math.sin(a) * r, 0, 0.6, 0.6, 0.6));
    }
    return { banks, sconces, bulbs, mics, sides, struts, lanterns, vaults, candles };
  }, [y, curtainH, T]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[30.5, y + 0.012, -23]} material={mats.floor} receiveShadow>
        <planeGeometry args={[29, 25.6]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[30.5, y + 0.022, -23]} material={extra.carpetGreen} receiveShadow>
        <planeGeometry args={[28.6, 25.6]} />
      </mesh>
      {layout.banks.map((b, i) => (
        <CurtainBank key={i} p={b.p} ry={b.ry} w={2.7} h={curtainH} drape={extra.curtainGreen} sheer={extra.sheer} />
      ))}
      {/* daylight behind the sheers of the veranda side (DDLP_0139) */}
      <mesh position={[30.5, y + curtainH / 2, -35.75]} material={extra.panelGlow}>
        <planeGeometry args={[27, curtainH * 0.92]} />
      </mesh>
      <Instances geometry={geo.sconce} material={extra.bronze} items={layout.sconces} />
      <Instances geometry={geo.bulb} material={extra.glow} items={layout.bulbs} receiveShadow={false} />
      {/* oval ring table: cream top, dark wood edge, green carpet well at floor level, steel hoop base */}
      <group position={[T.x, y, T.z]}>
        <mesh geometry={geo.top} position={[0, 0.76, 0]} material={extra.tableCream} castShadow receiveShadow />
        <mesh geometry={geo.edge} position={[0, 0.74, 0]} scale={[1, 1.3, 1]} material={mats.wood} />
        {[0.18, 0.5].map((h) => (
          <mesh key={h} geometry={geo.hoop} position={[0, h, 0]} scale={[5.4, 1, 1.7]} material={mats.metal} />
        ))}
      </group>
      <Instances geometry={geo.strut} material={mats.metal} items={layout.struts} />
      <Instances geometry={geo.mic} material={mats.dark} items={layout.mics} />
      <Instances geometry={geo.chair} material={extra.leatherGreen} items={cabChairs} castShadow />
      <Instances geometry={geo.legs} material={mats.metal} items={cabChairs} />
      <Instances geometry={geo.sideFrame} material={extra.rosewood} items={layout.sides} castShadow />
      <Instances geometry={geo.sidePad} material={extra.curtainGreen} items={layout.sides} />
      {/* ceiling coffer: frame, shallow vault bays, lantern rows, three two-tier chandeliers */}
      {[-3.45, 3.45].map((dz) => (
        <mesh key={dz} position={[32, CEIL_F1 - 0.18, T.z + dz]} material={mats.wall}>
          <boxGeometry args={[19.4, 0.36, 0.3]} />
        </mesh>
      ))}
      <Instances geometry={geo.vault} material={vaultMat} items={layout.vaults} receiveShadow={false} />
      <Instances geometry={geo.lantern} material={extra.glow} items={layout.lanterns} receiveShadow={false} />
      <Instances geometry={geo.lantern} material={extra.glow} items={layout.candles} receiveShadow={false} />
      {[25, 32, 39].map((x) => (
        <group key={x} position={[x, CEIL_F1 - 1.0, T.z]}>
          <mesh position={[0, 0.5, 0]} material={extra.bronze}><cylinderGeometry args={[0.03, 0.03, 1.0, 6]} /></mesh>
          {[[0.95, 0], [0.6, 0.38]].map(([r, dy]) => (
            <mesh key={r} position={[0, dy, 0]} rotation={[Math.PI / 2, 0, 0]} material={extra.bronze}><torusGeometry args={[r, 0.025, 6, 32]} /></mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Rear-wing granite floor (credentials room + stair corridor), open over the basement stair shaft. */
function RearFloor({ mats }: { mats: Mats }) {
  const y = LEVEL.f1;
  const rearFloor = useMemo(() => {
    // plane in XY (rotated to XZ: shape y = −z); hole over the basement stair flights
    const sh = new THREE.Shape([new THREE.Vector2(RW.x0 + 0.2, 36.2), new THREE.Vector2(RW.x1 - 0.2, 36.2), new THREE.Vector2(RW.x1 - 0.2, 87.8), new THREE.Vector2(RW.x0 + 0.2, 87.8)]);
    sh.holes.push(new THREE.Path([new THREE.Vector2(-13.6, 66.4), new THREE.Vector2(-9, 66.4), new THREE.Vector2(-9, 74), new THREE.Vector2(-13.6, 74)]));
    return new THREE.ShapeGeometry(sh);
  }, []);
  useEffect(() => () => rearFloor.dispose(), [rearFloor]);
  return <mesh geometry={rearFloor} rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.012, 0]} material={mats.floor} receiveShadow />;
}

/** Crystal chandelier: brass ring, hanging drops, warm bulb. */
export function Chandelier({ p, r, extra }: { p: [number, number, number]; r: number; extra: Extra }) {
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

/** Credentials Room furniture (DDLP_0021/0123): cream sofas and armchairs on burl-veneer plinths, burl low tables. */
function CredentialsFurniture({ y, extra }: { y: number; extra: Extra }) {
  const { credSeats: pieces, credTables: tables } = FURNITURE;
  return (
    <group>
      {pieces.map((p, i) => {
        const { w, d } = seatSize(p.seats);
        return (
          <group key={i} position={[p.x, y, p.z]} rotation={[0, p.side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
            {/* low burl plinth, cream cushions with a wave pattern, block armrests (DDLP_0123) */}
            <mesh position={[0, 0.1, 0]} material={extra.burl} castShadow><boxGeometry args={[w + 1.0, 0.2, d + 0.1]} /></mesh>
            <mesh position={[0, 0.36, 0.05]} material={extra.cream} castShadow><boxGeometry args={[w, 0.3, d - 0.1]} /></mesh>
            <mesh position={[0, 0.84, -d / 2 + 0.16]} material={extra.cream} castShadow><boxGeometry args={[w, 0.7, 0.26]} /></mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * (w / 2 + 0.25), 0.45, 0]} material={extra.burl} castShadow><boxGeometry args={[0.46, 0.5, d]} /></mesh>
            ))}
          </group>
        );
      })}
      {tables.map(([x, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh position={[0, 0.44, 0]} material={extra.burl} castShadow><boxGeometry args={[0.85, 0.08, 1.7]} /></mesh>
          {[[-0.36, -0.78], [0.36, -0.78], [-0.36, 0.78], [0.36, 0.78]].map(([lx, lz]) => (
            <mesh key={`${lx},${lz}`} position={[lx, 0.2, lz]} material={extra.burl}><boxGeometry args={[0.08, 0.4, 0.08]} /></mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
/* ============================================================ rooms from photos
 * Each component below is one room re-modelled from its group in the reference
 * set DINH_DOC_LAP_TUYEN_CHON_ANH_DUNG_3D_1 (photo ids in the comments). Sizes
 * and positions are estimates; what the photos show (furniture types and their
 * arrangement, materials, light fittings) is reproduced in 3D geometry.
 * Paintings are illustrative compositions in the right medium and at the right
 * size, not reproductions of the artworks.
 */

/** Illustrative painting surface: layered landscape in the given medium (canvas texture, freed on unmount). */
function usePaintingTexture(style: "lacquer" | "oil" | "ink", seed: number) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = style === "ink" ? 320 : 512;
    const g = c.getContext("2d")!;
    const R = rng(seed);
    const pal = {
      lacquer: { bg: ["#1a0f08", "#3a2310"], ridge: ["#2b1a0c", "#5a3a16", "#8a6024", "#c9973a"], hi: "#e2b45a" },
      oil: { bg: ["#c9b27a", "#8aa07a"], ridge: ["#4f5a3a", "#6e5a34", "#3d4a3a", "#a0582e"], hi: "#d77a3a" },
      ink: { bg: ["#efe6cf", "#e2d6b8"], ridge: ["#8a8478", "#5e5a52", "#3a3833", "#b0a890"], hi: "#9c2a1e" },
    }[style];
    const grd = g.createLinearGradient(0, 0, 0, c.height);
    grd.addColorStop(0, pal.bg[0]);
    grd.addColorStop(1, pal.bg[1]);
    g.fillStyle = grd;
    g.fillRect(0, 0, c.width, c.height);
    // receding mountain ranges (far → near)
    for (let layer = 0; layer < 5; layer++) {
      const base = c.height * (0.35 + layer * 0.13);
      g.fillStyle = pal.ridge[layer % pal.ridge.length];
      g.globalAlpha = style === "ink" ? 0.35 + layer * 0.12 : 0.9;
      g.beginPath();
      g.moveTo(0, c.height);
      let y = base;
      for (let x = 0; x <= c.width; x += 16) {
        y += (R() - 0.5) * 34 - (y - base) * 0.08;
        g.lineTo(x, y - Math.max(0, Math.sin((x / c.width) * Math.PI * (2 + layer)) * 40 * R()));
      }
      g.lineTo(c.width, c.height);
      g.fill();
    }
    // highlights: gold leaf (lacquer), warm strokes (oil), seal mark (ink)
    g.globalAlpha = 1;
    g.fillStyle = pal.hi;
    if (style === "ink") g.fillRect(c.width * 0.06, c.height * 0.1, 18, 24);
    else for (let k = 0; k < 140; k++) {
      const x = R() * c.width, y = c.height * (0.3 + R() * 0.65);
      g.globalAlpha = 0.25 + R() * 0.5;
      g.fillRect(x, y, 3 + R() * 18, 2 + R() * 5);
    }
    g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [style, seed]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** A framed painting on a wall; (x,y,z) = centre, ry = facing. */
export function Painting({ p, ry, w, h, style, seed, frame }: { p: [number, number, number]; ry: number; w: number; h: number; style: "lacquer" | "oil" | "ink"; seed: number; frame: THREE.Material }) {
  const tex = usePaintingTexture(style, seed);
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <mesh material={frame}>
        <boxGeometry args={[w + 0.24, h + 0.24, 0.08]} />
      </mesh>
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={tex} roughness={style === "lacquer" ? 0.25 : 0.8} metalness={style === "lacquer" ? 0.15 : 0} />
      </mesh>
    </group>
  );
}

/** Curtain bank: heavy drape + sheer, along a wall (centre p, width w, height h, facing ry). */
export function CurtainBank({ p, ry, w, h, drape, sheer }: { p: [number, number, number]; ry: number; w: number; h: number; drape: THREE.Material; sheer: THREE.Material }) {
  const geo = useMemo(() => foldedPlane(w, h, 0.12), [w, h]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <mesh position={[0, 0, -0.05]} material={sheer}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* drapes gathered at both sides of the window, sheer between */}
      <mesh geometry={geo} position={[-w * 0.36, 0, 0.06]} scale={[0.28, 1, 1]} material={drape} />
      <mesh geometry={geo} position={[w * 0.36, 0, 0.06]} scale={[0.28, 1, 1]} material={drape} />
    </group>
  );
}

/** Tall flared bronze vase on a lacquer stand (Trình Quốc thư, DDLP_0021/0031/0110). */
function TrumpetVase({ p, mats, extra }: { p: [number, number, number]; mats: Mats; extra: Extra }) {
  const geo = useMemo(() => {
    const pts = [[0.001, 0], [0.22, 0], [0.18, 0.15], [0.16, 0.6], [0.22, 1.2], [0.36, 1.7], [0.42, 1.85], [0.4, 1.86], [0.001, 1.86]].map(([a, b]) => new THREE.Vector2(a, b));
    return new THREE.LatheGeometry(pts, 32);
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group position={p}>
      <mesh position={[0, 0.3, 0]} material={mats.lacquer} castShadow><boxGeometry args={[0.7, 0.6, 0.7]} /></mesh>
      <mesh geometry={geo} position={[0, 0.6, 0]} material={extra.bronzeVase} castShadow />
    </group>
  );
}

/** Rectangular chandelier tiers of glass rods (Đại yến, DDLP_0018/0118). */
function TierChandelier({ p, extra }: { p: [number, number, number]; extra: Extra }) {
  const rods = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (const [half, y] of [[0.95, -0.7], [0.72, -1.15], [0.52, -1.5]] as const) {
      const n = Math.round(half * 10);
      for (let k = 0; k < n; k++) {
        const t = -half + (2 * half * (k + 0.5)) / n;
        for (const [x, z] of [[t, -half], [t, half], [-half, t], [half, t]]) out.push(M4(x, y, z, 0, 1, 1, 1));
      }
    }
    return out;
  }, []);
  const rod = useMemo(() => {
    const g = new THREE.BoxGeometry(0.045, 0.26, 0.045);
    return g;
  }, []);
  useEffect(() => () => rod.dispose(), [rod]);
  return (
    <group position={p}>
      <mesh position={[0, -0.4, 0]} material={extra.bronze}><cylinderGeometry args={[0.04, 0.04, 0.8, 6]} /></mesh>
      {[[2.0, -0.55], [1.55, -1.0], [1.15, -1.35]].map(([s, y]) => (
        <mesh key={y} position={[0, y, 0]} material={extra.bronze}><boxGeometry args={[s, 0.05, s]} /></mesh>
      ))}
      <group>
        <Instances geometry={rod} material={extra.crystal} items={rods} />
      </group>
    </group>
  );
}

/** Floor-1 central staircase bay: floor runner to the stair, rope posts at its foot. */
function StairBayDecor({ mats, extra }: { mats: Mats; extra: Extra }) {
  const y = LEVEL.f1, ST = FURNITURE.stair;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.02, ST.z0 + 3]} material={mats.runner} receiveShadow>
        <planeGeometry args={[ST.x1 - ST.x0 - 0.6, 6]} />
      </mesh>
      {/* the handrails end in dark-wood scrolls at the foot (DDLP_0239) */}
      {[ST.x0 - 0.06, ST.x1 + 0.06].map((x) => (
        <mesh key={x} position={[x, y + 0.95, ST.z0 + 0.25]} rotation={[0, Math.PI / 2, 0]} material={extra.rosewood}><torusGeometry args={[0.18, 0.05, 8, 20]} /></mesh>
      ))}
    </group>
  );
}

/** Floor-2 lobby around the stairwell. */
function LobbyDecor({ mats, extra }: { mats: Mats; extra: Extra }) {
  const y = LEVEL.f2, ST = FURNITURE.stairWell;
  const floor = useMemo(() => {
    const sh = new THREE.Shape([new THREE.Vector2(-12.8, 31.2), new THREE.Vector2(12.8, 31.2), new THREE.Vector2(12.8, 45.8), new THREE.Vector2(-12.8, 45.8)]);
    sh.holes.push(new THREE.Path([new THREE.Vector2(ST.x0, -ST.z0), new THREE.Vector2(ST.x1, -ST.z0), new THREE.Vector2(ST.x1, -ST.z1), new THREE.Vector2(ST.x0, -ST.z1)]));
    return new THREE.ShapeGeometry(sh);
  }, [ST]);
  useEffect(() => () => floor.dispose(), [floor]);
  return (
    <group>
      <mesh geometry={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.012, 0]} material={mats.floor} receiveShadow />
      <Chandelier p={[0, y + 4.7, -38.5]} r={1.1} extra={extra} />
    </group>
  );
}

/** Phòng Đại yến (DDLP_0008/0018/0042/0067/0097/0118/0141/0168/0248/0293). */
function DaiYenDecor({ mats, extra }: { mats: Mats; extra: Extra }) {
  const y = LEVEL.f1, Fu = FURNITURE;
  const cx = -30.5, z0 = -36, z1 = -10, x0 = -45, x1 = -16;
  const chairGeo = useMemo(() => {
    // high back with a carved frame, upholstered seat (DDLP_0118)
    const seat = new THREE.BoxGeometry(0.5, 0.1, 0.48);
    seat.translate(0, 0.47, 0);
    const back = new THREE.BoxGeometry(0.46, 0.75, 0.06);
    back.translate(0, 0.95, -0.22);
    const legs = [[-0.21, -0.2], [0.21, -0.2], [-0.21, 0.2], [0.21, 0.2]].map(([x, z]) => {
      const l = new THREE.BoxGeometry(0.05, 0.45, 0.05);
      l.translate(x, 0.22, z);
      return l;
    });
    return mergeGeometries([seat, back, ...legs])!;
  }, []);
  const chairs = useMemo(() => Fu.dyChairs.map((c) => M4(c.x, y, c.z, c.ry)), [Fu.dyChairs, y]);
  useEffect(() => () => chairGeo.dispose(), [chairGeo]);
  const T = Fu.dyTable, ch = CEIL_F1 - y - 0.3;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, y + 0.02, (z0 + z1) / 2]} material={extra.carpetMustard} receiveShadow>
        <planeGeometry args={[x1 - x0 - 0.4, z1 - z0 - 0.4]} />
      </mesh>
      {/* long table: dark wood top on paired trestle legs */}
      <group position={[(T.x0 + T.x1) / 2, y, T.z]}>
        <mesh position={[0, 0.75, 0]} material={mats.wood} castShadow receiveShadow><boxGeometry args={[T.x1 - T.x0, 0.07, T.w]} /></mesh>
        <mesh position={[0, 0.66, 0]} material={mats.lacquer}><boxGeometry args={[T.x1 - T.x0 - 0.3, 0.1, T.w - 0.2]} /></mesh>
        {[-7.5, -2.5, 2.5, 7.5].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 0.33, 0]} material={mats.lacquer}><boxGeometry args={[0.16, 0.66, 0.16]} /></mesh>
            <mesh position={[0, 0.06, 0]} material={mats.lacquer}><boxGeometry args={[0.16, 0.12, T.w - 0.1]} /></mesh>
          </group>
        ))}
      </group>
      <Instances geometry={chairGeo} material={mats.lacquer} items={chairs} castShadow />
      {/* curtain banks along both long walls (tall windows behind), gold damask + sheer */}
      {[-41, -35, -29, -23, -19].slice(0, 4).map((x) => (
        <group key={x}>
          <CurtainBank p={[x + 3, y + ch / 2, z1 - 0.3]} ry={Math.PI} w={4.4} h={ch} drape={extra.curtainGold} sheer={extra.sheer} />
          <CurtainBank p={[x + 3, y + ch / 2, z0 + 0.3]} ry={0} w={4.4} h={ch} drape={extra.curtainGold} sheer={extra.sheer} />
        </group>
      ))}
      {/* vases on carved pedestals between the windows */}
      {Fu.dyPedestals.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, y, z]}>
          <mesh position={[0, 0.6, 0]} material={mats.lacquer} castShadow><boxGeometry args={[0.7, 1.2, 0.7]} /></mesh>
          <mesh position={[0, 1.5, 0]} material={extra.porcelain} castShadow><cylinderGeometry args={[0.16, 0.24, 0.6, 16]} /></mesh>
          <mesh position={[0, 1.83, 0]} material={extra.porcelain}><sphereGeometry args={[0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
        </group>
      ))}
      {/* end wall: sideboard and the oil painting “Sơn Hà Cẩm Tú” (illustrative) */}
      <mesh position={[Fu.dySideboard.x, y + 0.45, Fu.dySideboard.z]} material={mats.lacquer} castShadow><boxGeometry args={[Fu.dySideboard.d, 0.9, Fu.dySideboard.l]} /></mesh>
      <Painting p={[x0 + 0.25, y + 2.6, -23]} ry={Math.PI / 2} w={7.2} h={2.1} style="oil" seed={66} frame={mats.gold} />
      {/* square tiered chandeliers on the room axis */}
      <TierChandelier p={[-35.5, CEIL_F1, -23]} extra={extra} />
      <TierChandelier p={[-25.5, CEIL_F1, -23]} extra={extra} />
      {/* wall sconces */}
      {[-38, -32, -26, -20].map((x) => [z0 + 0.25, z1 - 0.25].map((z) => (
        <mesh key={`${x},${z}`} position={[x, y + 2.6, z]} material={extra.glow}><boxGeometry args={[0.18, 0.5, 0.12]} /></mesh>
      )))}
    </group>
  );
}

/** Phòng Khánh tiết extent (behind the central staircase; estimated size). */
const KT = { x0: -13, x1: 13, z0: -60, z1: -44 } as const;

/** Phòng Khánh tiết (DDLP_0079/0096/0105/0108/0119/0137/0138/0240). */
function KhanhTietDecor({ mats, extra }: { mats: Mats; extra: Extra }) {
  const y = LEVEL.f1, Fu = FURNITURE;
  const { x0, x1, z0, z1 } = KT, ceil = CEIL_F1;
  const beams = useMemo(() => {
    // coffered ceiling: white beams on a 2.6 m grid (DDLP_0096/0137)
    const out: THREE.Matrix4[] = [];
    for (let x = x0 + 2.6; x < x1 - 0.1; x += 2.6) out.push(M4(x, ceil - 0.25, (z0 + z1) / 2, 0, 0.35, 0.5, z1 - z0));
    for (let z = z0 + 2.65; z < z1 - 0.1; z += 2.65) out.push(M4(0, ceil - 0.25, z, 0, x1 - x0, 0.5, 0.35));
    return out;
  }, [ceil, x0, x1, z0, z1]);
  const unit = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => () => unit.dispose(), [unit]);
  const pilasters = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let z = z0 + 0.6; z < z1; z += 3.2) for (const x of [x0 + 0.2, x1 - 0.2]) out.push(M4(x, y + (ceil - y) / 2, z, 0, 0.36, ceil - y, 0.9));
    return out;
  }, [y, ceil, x0, x1, z0, z1]);
  const ch = ceil - y - 0.4;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.022, (z0 + z1) / 2]} material={extra.carpetRedFloral} receiveShadow>
        <planeGeometry args={[x1 - x0 - 0.4, z1 - z0 - 0.4]} />
      </mesh>
      {/* glowing ceiling panels behind the coffers */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ceil - 0.02, (z0 + z1) / 2]} material={extra.panelGlow}>
        <planeGeometry args={[x1 - x0, z1 - z0]} />
      </mesh>
      <Instances geometry={unit} material={extra.cream} items={beams} />
      <Instances geometry={unit} material={extra.woodReeded} items={pilasters} castShadow />
      {/* gold swag curtains between the pilasters */}
      {[z0 + 2.2, z0 + 5.4, z0 + 8.6, z0 + 11.8].map((z) => [x0 + 0.3, x1 - 0.3].map((x) => (
        <CurtainBank key={`${x},${z}`} p={[x, y + ch / 2, z]} ry={x < 0 ? Math.PI / 2 : -Math.PI / 2} w={2.4} h={ch} drape={extra.curtainGold} sheer={extra.sheer} />
      )))}
      {/* damask sofas along the long walls, dark low tables */}
      {Fu.ktSofas.map((p, i) => {
        const { w } = seatSize(p.seats);
        return (
          <group key={i} position={[p.x, y, p.z]} rotation={[0, p.side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
            <mesh position={[0, 0.24, 0]} material={extra.damaskRed} castShadow><boxGeometry args={[w + 0.7, 0.36, 0.9]} /></mesh>
            <mesh position={[0, 0.66, -0.36]} material={extra.damaskRed} castShadow><boxGeometry args={[w + 0.7, 0.5, 0.2]} /></mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * (w / 2 + 0.25), 0.5, 0]} material={extra.damaskRed}><boxGeometry args={[0.22, 0.3, 0.9]} /></mesh>
            ))}
          </group>
        );
      })}
      {Fu.ktTables.map(([x, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh position={[0, 0.44, 0]} material={mats.lacquer} castShadow><boxGeometry args={[0.8, 0.06, 1.5]} /></mesh>
          {[[-0.33, -0.66], [0.33, -0.66], [-0.33, 0.66], [0.33, 0.66]].map(([lx, lz]) => (
            <mesh key={`${lx},${lz}`} position={[lx, 0.21, lz]} material={mats.lacquer}><boxGeometry args={[0.06, 0.42, 0.06]} /></mesh>
          ))}
        </group>
      ))}
      {/* stage with a red velvet backdrop at the far end */}
      {(() => {
        const st = Fu.ktStage;
        return (
          <group>
            <mesh position={[(st.x0 + st.x1) / 2, y + st.h / 2, (st.z0 + st.z1) / 2]} material={mats.wood} castShadow receiveShadow><boxGeometry args={[st.x1 - st.x0, st.h, st.z1 - st.z0]} /></mesh>
            <mesh position={[(st.x0 + st.x1) / 2, y + ch / 2 + 0.2, z0 + 0.25]} material={extra.stageCurtain}><planeGeometry args={[st.x1 - st.x0 + 1, ch]} /></mesh>
          </group>
        );
      })()}
      {/* “Việt Nam Quốc Tổ”, ink painting 5.6 m long, at the head of the room (illustrative) */}
      <Painting p={[0, y + 2.4, z1 - 0.25]} ry={Math.PI} w={5.6} h={1.9} style="ink" seed={1966} frame={mats.lacquer} />
      {/* crystal chandeliers in the coffers */}
      <Chandelier p={[0, ceil, -52]} r={1.5} extra={extra} />
      {[[-6.5, -48], [6.5, -48], [-6.5, -56], [6.5, -56]].map(([x, z]) => (
        <Chandelier key={`${x},${z}`} p={[x, ceil, z]} r={0.7} extra={extra} />
      ))}
    </group>
  );
}

/** Phòng Trình Quốc thư on floor 2 (DDLP_0021/0030/0031/0110/0123/0198/0242). */
function CredentialsRoomDecor({ mats, extra }: { mats: Mats; extra: Extra }) {
  const y = LEVEL.f2, Fu = FURNITURE;
  const x0 = -7, x1 = 7, z0 = -31, z1 = -12, ceil = y + 6.2;
  const ch = ceil - y - 0.4;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.02, (z0 + z1) / 2]} material={extra.carpetGold} receiveShadow>
        <planeGeometry args={[x1 - x0 - 0.2, z1 - z0 - 0.2]} />
      </mesh>
      {/* dark wood crown moulding */}
      {[[0, z0 + 0.22, x1 - x0, 0.1], [0, z1 - 0.22, x1 - x0, 0.1], [x0 + 0.22, (z0 + z1) / 2, 0.1, z1 - z0], [x1 - 0.22, (z0 + z1) / 2, 0.1, z1 - z0]].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, ceil - 0.2, z]} material={mats.lacquer}><boxGeometry args={[w, 0.25, d]} /></mesh>
      ))}
      {/* gold damask curtains with sheers along both long walls */}
      {[z0 + 3.5, z0 + 8.5, z0 + 13.5].map((z) => [x0 + 0.3, x1 - 0.3].map((x) => (
        <CurtainBank key={`${x},${z}`} p={[x, y + ch / 2, z]} ry={x < 0 ? Math.PI / 2 : -Math.PI / 2} w={4.4} h={ch} drape={extra.curtainGold} sheer={extra.sheer} />
      )))}
      {/* “Bình Ngô Đại Cáo”, lacquer, 8.20 m × 4.70 m (official site); illustrative surface */}
      <Painting p={[0, y + 0.55 + 2.35, z1 - 0.25]} ry={Math.PI} w={8.2} h={4.7} style="lacquer" seed={1427} frame={mats.lacquer} />
      {/* desk and chair on a low platform before the painting */}
      <group position={[Fu.credDesk.x, y, Fu.credDesk.z]}>
        <mesh position={[0, 0.06, 0]} material={mats.lacquer}><boxGeometry args={[Fu.credDesk.w + 0.8, 0.12, Fu.credDesk.d + 1.2]} /></mesh>
        <mesh position={[0, 0.5, 0.25]} material={extra.burl} castShadow><boxGeometry args={[Fu.credDesk.w, 0.76, Fu.credDesk.d]} /></mesh>
        <mesh position={[0, 0.5, 1.05]} material={extra.cream} castShadow><boxGeometry args={[0.6, 0.1, 0.55]} /></mesh>
        <mesh position={[0, 1.0, 1.3]} material={extra.cream} castShadow><boxGeometry args={[0.6, 1.0, 0.1]} /></mesh>
      </group>
      <CredentialsFurniture y={y} extra={extra} />
      {Fu.credVases.map(([x, z]) => (
        <TrumpetVase key={`${x},${z}`} p={[x, y, z]} mats={mats} extra={extra} />
      ))}
      {/* central crystal chandelier and four flush crystal lights */}
      <Chandelier p={[0, ceil, -21.5]} r={1.4} extra={extra} />
      {[[-3.6, -27], [3.6, -27], [-3.6, -16], [3.6, -16]].map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, ceil - 0.15, z]} material={extra.crystal}><cylinderGeometry args={[0.45, 0.32, 0.3, 16]} /></mesh>
      ))}
    </group>
  );
}


/** Wood-boarded walls, tiled dropped ceiling with fluorescent fittings, floor: a basement room shell. */
function BasementShell({ x0, x1, z0, z1, floor, extra, walls = extra.woodPlank }: { x0: number; x1: number; z0: number; z1: number; floor: THREE.Material; extra: Extra; walls?: THREE.Material }) {
  const y = LEVEL.basement, h = 2.9;
  const lamps = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (let x = x0 + 2.5; x < x1 - 1; x += 4) for (let z = z0 + 2.5; z < z1 - 1; z += 4) out.push(M4(x, y + h - 0.05, z, 0, 1.25, 0.08, 0.3));
    return out;
  }, [x0, x1, z0, z1, y]);
  const unit = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => () => unit.dispose(), [unit]);
  const W = x1 - x0, D = z1 - z0;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, y + 0.015, (z0 + z1) / 2]} material={floor} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, y + h, (z0 + z1) / 2]} material={extra.ceilingTile}>
        <planeGeometry args={[W, D]} />
      </mesh>
      {/* wall boarding on the four inner faces (above the door heads it is hidden by the ceiling) */}
      <mesh position={[(x0 + x1) / 2, y + h / 2, z0 + 0.02]} material={walls}><planeGeometry args={[W, h]} /></mesh>
      <mesh position={[(x0 + x1) / 2, y + h / 2, z1 - 0.02]} rotation={[0, Math.PI, 0]} material={walls}><planeGeometry args={[W, h]} /></mesh>
      <mesh position={[x0 + 0.02, y + h / 2, (z0 + z1) / 2]} rotation={[0, Math.PI / 2, 0]} material={walls}><planeGeometry args={[D, h]} /></mesh>
      <mesh position={[x1 - 0.02, y + h / 2, (z0 + z1) / 2]} rotation={[0, -Math.PI / 2, 0]} material={walls}><planeGeometry args={[D, h]} /></mesh>
      <Instances geometry={unit} material={extra.glow} items={lamps} />
    </group>
  );
}

/** Steel office desk (grey-green, drawers) and swivel chair, as in the basement photos. */
function SteelDesk({ p, ry = 0, extra }: { p: [number, number, number]; ry?: number; extra: Extra }) {
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <mesh position={[0, 0.74, 0]} material={extra.steelTop} castShadow><boxGeometry args={[2.0, 0.05, 0.95]} /></mesh>
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.36, 0]} material={extra.steel} castShadow><boxGeometry args={[0.55, 0.72, 0.9]} /></mesh>
      ))}
      <mesh position={[0, 0.5, 0.42]} material={extra.steel}><boxGeometry args={[0.8, 0.4, 0.04]} /></mesh>
      <group position={[0, 0, -0.9]}>
        <mesh position={[0, 0.45, 0]} material={extra.leatherBlue}><boxGeometry args={[0.55, 0.12, 0.5]} /></mesh>
        <mesh position={[0, 0.85, -0.24]} material={extra.leatherBlue}><boxGeometry args={[0.52, 0.65, 0.1]} /></mesh>
        <mesh position={[0, 0.2, 0]} material={extra.steel}><cylinderGeometry args={[0.04, 0.25, 0.4, 10]} /></mesh>
      </group>
    </group>
  );
}

/** Phòng bản đồ tác chiến (DDLP_0128/0132/0173/0174/0277/0298): boarded walls, framed wall maps, commander's desk. */
function MapsDecor({ mats, extra }: { mats: Mats; extra: Extra }) {
  const y = LEVEL.basement;
  const x0 = 1.2, x1 = 20.8, z0 = -59.8, z1 = -40.2;
  const board = (x: number, z: number, ry: number, w: number) => (
    <group key={`${x},${z}`} position={[x, y + 1.55, z]} rotation={[0, ry, 0]}>
      <mesh material={mats.lacquer}><boxGeometry args={[w + 0.16, 2.36, 0.06]} /></mesh>
      <mesh position={[0, 0, 0.035]} material={extra.mapPaper}><planeGeometry args={[w, 2.2]} /></mesh>
    </group>
  );
  return (
    <group>
      <BasementShell x0={x0} x1={x1} z0={z0} z1={z1} floor={extra.tileGrey} extra={extra} />
      {board(7, z1 - 0.06, Math.PI, 4.2)}
      {board(12.5, z1 - 0.06, Math.PI, 4.2)}
      {board(17.4, z1 - 0.06, Math.PI, 4.2)}
      {board(x1 - 0.06, -46, -Math.PI / 2, 4.6)}
      {board(x1 - 0.06, -53, -Math.PI / 2, 4.6)}
      {board(x0 + 0.06, -50, Math.PI / 2, 5.2)}
      <SteelDesk p={[11, y, -50]} ry={Math.PI} extra={extra} />
      {/* desk telephones and a name plate */}
      {[-0.5, -0.2].map((x) => (
        <mesh key={x} position={[11 + x, y + 0.82, -50.2]} material={mats.dark}><boxGeometry args={[0.22, 0.1, 0.2]} /></mesh>
      ))}
    </group>
  );
}

/** Phòng truyền tin (DDLP_0107/0129/0130/0131/0146/0225/0226): teleprinters on steel desks, radio sets, cabinets. */
function CommsDecor({ mats, extra }: { mats: Mats; extra: Extra }) {
  const y = LEVEL.basement;
  const x0 = -20.8, x1 = -1.2, z0 = -59.8, z1 = -40.2;
  return (
    <group>
      {/* rust-brown tongue-and-groove boarding (DDLP_0129, 0146, 0225, 0226) */}
      <BasementShell x0={x0} x1={x1} z0={z0} z1={z1} floor={extra.tileCross} extra={extra} walls={extra.boardsRust} />
      {/* switchboard desk between two grey filing cabinets (DDLP_0226) */}
      <group position={[-6, y, z0 + 1.6]}>
        <mesh position={[0, 0.74, 0]} material={extra.steelTop} castShadow><boxGeometry args={[1.8, 0.05, 0.9]} /></mesh>
        {[[-0.84, -0.4], [0.84, -0.4], [-0.84, 0.4], [0.84, 0.4]].map(([lx, lz]) => (
          <mesh key={`${lx},${lz}`} position={[lx, 0.37, lz]} material={extra.steel}><boxGeometry args={[0.06, 0.74, 0.06]} /></mesh>
        ))}
        <mesh position={[0.3, 0.92, 0]} rotation={[-0.25, 0, 0]} material={extra.lacquerRed} castShadow><boxGeometry args={[0.85, 0.3, 0.6]} /></mesh>
        <mesh position={[0.3, 1.03, 0.08]} rotation={[-0.25, 0, 0]} material={mats.paper}><boxGeometry args={[0.6, 0.02, 0.3]} /></mesh>
        <mesh position={[-0.45, 0.92, 0]} material={mats.dark}><boxGeometry args={[0.55, 0.32, 0.4]} /></mesh>
        {[-1.6, 1.6].map((x) => (
          <mesh key={x} position={[x, 0.7, -0.15]} material={extra.steel} castShadow><boxGeometry args={[0.55, 1.4, 0.7]} /></mesh>
        ))}
        <mesh position={[0, 0.45, -0.75]} material={mats.dark}><boxGeometry args={[0.55, 0.12, 0.5]} /></mesh>
      </group>
      {/* teleprinter desks with chairs (rows as in DDLP_0129/0146) */}
      {[0, 1, 2].map((i) => (
        <group key={i} position={[-17.5, y, -54 + i * 4.5]} rotation={[0, Math.PI / 2, 0]}>
          <mesh position={[0, 0.36, 0]} material={extra.steel} castShadow><boxGeometry args={[1.6, 0.72, 0.8]} /></mesh>
          <mesh position={[0, 0.92, 0.05]} material={extra.teleprinter} castShadow><boxGeometry args={[0.8, 0.4, 0.6]} /></mesh>
          <mesh position={[0, 1.18, -0.12]} material={extra.teleprinter}><boxGeometry args={[0.6, 0.18, 0.26]} /></mesh>
          <mesh position={[0, 0.48, 0.85]} material={extra.leatherBlue}><boxGeometry args={[0.5, 0.1, 0.48]} /></mesh>
          <mesh position={[0, 0.85, 1.07]} material={extra.leatherBlue}><boxGeometry args={[0.5, 0.6, 0.08]} /></mesh>
        </group>
      ))}
      {/* radio sets stacked on a steel table (DDLP_0131/0225) */}
      <group position={[-6, y, -44]}>
        <mesh position={[0, 0.38, 0]} material={extra.steel} castShadow><boxGeometry args={[1.6, 0.06, 0.8]} /></mesh>
        {[[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]].map(([lx, lz]) => (
          <mesh key={`${lx},${lz}`} position={[lx, 0.19, lz]} material={extra.steel}><boxGeometry args={[0.05, 0.38, 0.05]} /></mesh>
        ))}
        {[[-0.45, 0.6], [0.05, 0.6], [0.5, 0.6], [-0.2, 0.95], [0.3, 0.95]].map(([x, yy], k) => (
          <mesh key={k} position={[x, yy, 0]} material={mats.dark} castShadow><boxGeometry args={[0.46, 0.32, 0.5]} /></mesh>
        ))}
      </group>
      {/* tall equipment cabinets and the switchboard along the back wall (DDLP_0107) */}
      {[-18.5, -17.2, -15.9, -14.6, -13.3, -12].map((x, k) => (
        <mesh key={x} position={[x, y + 1.0, z0 + 0.45]} material={k % 2 ? extra.teleprinter : mats.dark} castShadow><boxGeometry args={[1.2, 2.0, 0.7]} /></mesh>
      ))}
    </group>
  );
}

function Rooftop({ mats }: { mats: Mats }) {
  const running = useRunning();
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
    if (!running) return;
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
