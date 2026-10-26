"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type CameraControlsImpl from "camera-controls";
import type { CityBuild } from "@/lib/city/buildCity";
import { CITY_BOUNDS } from "@/lib/city/buildCity";
import type { P2 } from "@/lib/city/types";
import { rng } from "@/lib/geo";
import { SIM_DENSITY, SIM_LOD } from "@/lib/sim/config";
import { AmbientCreatureSimulation, PedestrianSimulation } from "@/lib/sim/life";
import { addLimbAttributes, limbMaterial } from "@/lib/sim/materials";
import { birdGeometry, boatModels, personGeometry, petGeometry, vehicleModels, waderGeometry, wheelGeometry, type BoatKind, type Model, type VehicleKind } from "@/lib/sim/models";
import { TrafficSimulation } from "@/lib/sim/traffic";
import { WaterTrafficSimulation } from "@/lib/sim/water";
import type { Quality } from "@/lib/store/settings";

/** Body colours by vehicle type (Saigon-ish: green buses, white/green/yellow taxis, lots of colourful bikes). */
const PAINT: Record<VehicleKind, string[]> = {
  motorbike: ["#e63946", "#1d3557", "#f1faee", "#2a9d8f", "#f4a261", "#264653", "#ffb703", "#8338ec"],
  scooter: ["#ffffff", "#e9c46a", "#e76f51", "#90be6d", "#457b9d", "#f28482", "#b5838d"],
  bicycle: ["#3a86ff", "#ff006e", "#fb5607", "#8ac926"],
  car: ["#f8f9fa", "#212529", "#adb5bd", "#c1121f", "#1d4ed8", "#6c757d", "#e9ecef", "#7f5539"],
  taxi: ["#ffffff", "#2d9d58", "#f6c90e"],
  van: ["#ffffff", "#e5e5e5", "#3d5a80", "#ee6c4d"],
  bus: ["#2e8b57", "#3c9d5d"],
  truck: ["#1d4ed8", "#c1121f", "#f8f9fa", "#2b9348"],
};
const BOAT_PAINT: Record<BoatKind, string[]> = {
  tour: ["#1d4ed8", "#c1121f", "#0f766e"],
  ferry: ["#f59e0b", "#1e40af"],
  barge: ["#475569", "#7c2d12", "#334155"],
  boat: ["#2563eb", "#16a34a", "#b45309"],
  speedboat: ["#ef4444", "#f8fafc", "#0ea5e9"],
};
const CLOTHES = ["#e63946", "#f1faee", "#a8dadc", "#457b9d", "#ffb703", "#fb8500", "#8ecae6", "#2a9d8f", "#e9c46a", "#f4acb7", "#9d4edd", "#ffffff", "#06d6a0"];

interface Props {
  city: CityBuild;
  quality: Quality;
  controls: React.RefObject<CameraControlsImpl | null>;
  extraSpaces: { kind: "park" | "plaza"; pts: P2[]; links: number[][] }[];
  shadows: boolean;
}

const M4 = new THREE.Matrix4(), M4b = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);

function compose(m: THREE.Matrix4, x: number, y: number, z: number, yaw: number, pitch = 0, roll = 0, s = 1) {
  E.set(pitch, yaw, roll, "YXZ");
  Q.setFromEuler(E);
  V.set(x, y, z);
  S.set(s, s, s);
  return m.compose(V, Q, S);
}

/** Paint (per-instance colour) + trim (fixed colours) instanced pair for one model. */
function ModelPair({ model, count, colors, seed, onMeshes, shadows }: { model: Model; count: number; colors: string[]; seed: number; onMeshes: (paint: THREE.InstancedMesh | null, trim: THREE.InstancedMesh | null) => void; shadows: boolean }) {
  const paint = useRef<THREE.InstancedMesh>(null);
  const trim = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const R = rng(seed);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) paint.current?.setColorAt(i, c.set(colors[Math.floor(R() * colors.length)]));
    if (paint.current?.instanceColor) paint.current.instanceColor.needsUpdate = true;
    onMeshes(paint.current, trim.current);
  }, [count, colors, seed, onMeshes]);
  if (!count) return null;
  return (
    <>
      <instancedMesh ref={paint} args={[model.paint, undefined, count]} frustumCulled={false} castShadow={shadows}>
        <meshStandardMaterial vertexColors roughness={0.45} metalness={0.15} />
      </instancedMesh>
      <instancedMesh ref={trim} args={[model.trim, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.5} />
      </instancedMesh>
    </>
  );
}

export function LivingCity({ city, quality, controls, extraSpaces, shadows }: Props) {
  const density = SIM_DENSITY[quality];
  const vModels = useMemo(() => vehicleModels(), []);
  const bModels = useMemo(() => boatModels(), []);
  const wheelGeo = useMemo(() => wheelGeometry(), []);
  const time = useMemo(() => ({ value: 0 }), []);

  /* ---- simulations (EntitySpawner) ---- */
  const traffic = useMemo(() => new TrafficSimulation(city.lanes, city.junctions, density.vehicles), [city, density.vehicles]);
  const water = useMemo(() => new WaterTrafficSimulation(city.boatLoops, density.boats), [city, density.boats]);
  const spaces = useMemo(() => [...city.openSpaces, ...extraSpaces], [city, extraSpaces]);
  const people = useMemo(
    () => new PedestrianSimulation(city.sidewalkPaths, spaces, { walkers: density.walkers, strollers: density.strollers, groups: density.groups, pets: density.pets }),
    [city, spaces, density],
  );
  const creatures = useMemo(() => {
    const sky = city.skyline;
    const skyline = (x: number, z: number) => {
      const i = Math.floor((x - CITY_BOUNDS.x0) / sky.cell), j = Math.floor((z - CITY_BOUNDS.z0) / sky.cell);
      let h = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < sky.nx && jj < sky.nz) h = Math.max(h, sky.data[jj * sky.nx + ii]);
      }
      return h;
    };
    return new AmbientCreatureSimulation(
      {
        parks: spaces.filter((s) => s.kind === "park").flatMap((s) => s.pts.slice(0, 3)),
        plazas: spaces.filter((s) => s.kind === "plaza").flatMap((s) => s.pts),
        banks: city.shorePts,
        river: city.boatRoutes.flatMap((r) => r.pts.filter((_, i) => i % 6 === 0)),
      },
      skyline,
      { flocks: density.flocks, pigeons: density.pigeons, egrets: density.egrets },
    );
  }, [city, spaces, density]);

  /* ---- instance bookkeeping ---- */
  const vKinds = useMemo(() => {
    const m = new Map<VehicleKind, number[]>();
    traffic.vehicles.forEach((v, i) => {
      if (!m.has(v.kind)) m.set(v.kind, []);
      m.get(v.kind)!.push(i);
    });
    return m;
  }, [traffic]);
  const bKinds = useMemo(() => {
    const m = new Map<BoatKind, number[]>();
    water.boats.forEach((b, i) => {
      if (!m.has(b.kind)) m.set(b.kind, []);
      m.get(b.kind)!.push(i);
    });
    return m;
  }, [water]);
  const wheelCount = useMemo(() => traffic.vehicles.reduce((a, v) => a + vModels[v.kind].wheels.length, 0), [traffic, vModels]);

  const vMeshes = useMemo(() => new Map<string, [THREE.InstancedMesh | null, THREE.InstancedMesh | null]>(), []);
  const wheels = useRef<THREE.InstancedMesh>(null);
  const wakes = useRef<THREE.InstancedMesh>(null);

  /* ---- people / pets / birds meshes with limb animation ---- */
  const personGeo = useMemo(() => personGeometry(), []);
  const dogGeo = useMemo(() => petGeometry("dog"), []);
  const catGeo = useMemo(() => petGeometry("cat"), []);
  const birdGeo = useMemo(() => birdGeometry(1.6), []);
  const pigeonGeo = useMemo(() => waderGeometry(false), []);
  const egretGeo = useMemo(() => waderGeometry(true), []);
  const mats = useMemo(
    () => ({
      walk: limbMaterial({ mode: "walk", freq: 7.5, amp: 0.55, time }),
      pet: limbMaterial({ mode: "walk", freq: 12, amp: 0.7, time }),
      wing: limbMaterial({ mode: "wing", freq: 11, amp: 0.7, time }),
      still: limbMaterial({ mode: "walk", freq: 2, amp: 0, time }),
      wake: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35, depthWrite: false }),
    }),
    [time],
  );
  const peopleMesh = useRef<THREE.InstancedMesh>(null);
  const dogMesh = useRef<THREE.InstancedMesh>(null);
  const catMesh = useRef<THREE.InstancedMesh>(null);
  const birdMesh = useRef<THREE.InstancedMesh>(null);
  const pigeonMesh = useRef<THREE.InstancedMesh>(null);
  const egretMesh = useRef<THREE.InstancedMesh>(null);
  const attrs = useRef(new Map<string, { phase: THREE.InstancedBufferAttribute; move: THREE.InstancedBufferAttribute }>());

  const dogs = useMemo(() => people.pets.filter((p) => p.kind === "dog"), [people]);
  const cats = useMemo(() => people.pets.filter((p) => p.kind === "cat"), [people]);
  const pigeons = useMemo(() => creatures.ground.filter((g) => g.kind === "pigeon"), [creatures]);
  const egrets = useMemo(() => creatures.ground.filter((g) => g.kind === "egret"), [creatures]);

  useEffect(() => {
    const setup = (key: string, mesh: THREE.InstancedMesh | null, n: number, palette?: string[]) => {
      if (!mesh || !n) return;
      attrs.current.set(key, addLimbAttributes(mesh, n));
      const R = rng(key.length * 97);
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) mesh.setColorAt(i, palette ? c.set(palette[Math.floor(R() * palette.length)]) : c.set("#ffffff"));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    setup("people", peopleMesh.current, people.people.length, CLOTHES);
    setup("dogs", dogMesh.current, dogs.length, ["#b98552", "#e8d5b5", "#3b2f2f", "#ffffff"]);
    setup("cats", catMesh.current, cats.length, ["#8a8a8a", "#d4a373", "#2b2b2b", "#f2e8cf"]);
    setup("birds", birdMesh.current, creatures.birds.length, ["#3b3b40", "#2f3542", "#57606f"]);
    setup("pigeons", pigeonMesh.current, pigeons.length);
    setup("egrets", egretMesh.current, egrets.length);
  }, [people, creatures, dogs, cats, pigeons, egrets]);

  // per-geometry clones: instanced attributes must not be shared between meshes
  const geos = useMemo(
    () => ({ person: personGeo.clone(), dog: dogGeo.clone(), cat: catGeo.clone(), bird: birdGeo.clone(), pigeon: pigeonGeo.clone(), egret: egretGeo.clone() }),
    [personGeo, dogGeo, catGeo, birdGeo, pigeonGeo, egretGeo],
  );

  useEffect(
    () => () => {
      Object.values(geos).forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
      wheelGeo.dispose();
      for (const m of Object.values(vModels)) { m.paint.dispose(); m.trim.dispose(); }
      for (const m of Object.values(bModels)) { m.paint.dispose(); m.trim.dispose(); }
    },
    [geos, mats, wheelGeo, vModels, bModels],
  );

  // vehicles that leave the map re-enter only where the camera can't see
  const { camera } = useThree();
  const frustum = useMemo(() => new THREE.Frustum(), []);
  useEffect(() => {
    const pt = new THREE.Vector3();
    traffic.isVisible = (x, z) => frustum.containsPoint(pt.set(x, 1, z));
  }, [traffic, frustum]);

  /* ---- the single update loop (SimulationLOD) ---- */
  useFrame((state, dt) => {
    time.value = state.clock.elapsedTime;
    frustum.setFromProjectionMatrix(M4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const camDist = controls.current?.distance ?? 1000;
    traffic.update(dt);
    traffic.pose();
    water.update(dt);
    water.pose(dt);
    const showPeople = camDist < SIM_LOD.people;
    const showGround = camDist < SIM_LOD.creaturesGround;
    if (showPeople) people.update(dt);
    creatures.update(dt);

    // vehicles
    for (const [kind, idx] of vKinds) {
      const meshes = vMeshes.get(`v:${kind}`);
      if (!meshes) continue;
      idx.forEach((vi, k) => {
        const v = traffic.vehicles[vi];
        compose(M4, v.x, v.y + 0.02, v.z, v.yaw);
        meshes[0]?.setMatrixAt(k, M4);
        meshes[1]?.setMatrixAt(k, M4);
      });
      for (const m of meshes) if (m) m.instanceMatrix.needsUpdate = true;
    }
    if (wheels.current) {
      wheels.current.visible = camDist < SIM_LOD.wheels;
      if (wheels.current.visible) {
        let w = 0;
        for (const v of traffic.vehicles) {
          compose(M4, v.x, v.y + 0.02, v.z, v.yaw);
          for (const [x, y, z, r, wd] of vModels[v.kind].wheels) {
            M4b.makeRotationX(v.wheel / r);
            M4b.scale(S.set(wd, r, r));
            M4b.setPosition(x, y, z);
            wheels.current.setMatrixAt(w++, M4b.premultiply(M4));
          }
        }
        wheels.current.instanceMatrix.needsUpdate = true;
      }
    }
    // boats + wakes
    let wi = 0;
    for (const [kind, idx] of bKinds) {
      const meshes = vMeshes.get(`b:${kind}`);
      idx.forEach((bi, k) => {
        const b = water.boats[bi];
        compose(M4, b.x, b.y, b.z, b.yaw, 0, b.roll);
        meshes?.[0]?.setMatrixAt(k, M4);
        meshes?.[1]?.setMatrixAt(k, M4);
        if (wakes.current) {
          const len = Math.max(4, b.v * 6);
          M4b.makeRotationX(-Math.PI / 2);
          M4b.scale(S.set(Math.min(8, 2 + b.v), len, 1));
          M4b.setPosition(0, 0.1 - b.y, -(BOATLEN[b.kind] / 2 + len / 2));
          wakes.current.setMatrixAt(wi++, M4b.premultiply(M4));
        }
      });
      for (const m of meshes ?? []) if (m) m.instanceMatrix.needsUpdate = true;
    }
    if (wakes.current) {
      wakes.current.instanceMatrix.needsUpdate = true;
      wakes.current.visible = camDist < SIM_LOD.wakes;
    }
    // people & pets
    const pa = attrs.current.get("people");
    if (peopleMesh.current) peopleMesh.current.visible = showPeople;
    if (showPeople && peopleMesh.current && pa) {
      people.people.forEach((p, i) => {
        peopleMesh.current!.setMatrixAt(i, compose(M4, p.x, 0.02, p.z, p.yaw));
        pa.phase.setX(i, p.phase);
        pa.move.setX(i, p.move);
      });
      peopleMesh.current.instanceMatrix.needsUpdate = true;
      pa.phase.needsUpdate = pa.move.needsUpdate = true;
    }
    const writePets = (mesh: THREE.InstancedMesh | null, list: typeof dogs, key: string) => {
      const at = attrs.current.get(key);
      if (!mesh || !at) return;
      mesh.visible = showPeople;
      if (!showPeople) return;
      list.forEach((p, i) => {
        mesh.setMatrixAt(i, compose(M4, p.x, 0.02, p.z, p.yaw));
        at.phase.setX(i, p.phase);
        at.move.setX(i, p.move);
      });
      mesh.instanceMatrix.needsUpdate = at.phase.needsUpdate = at.move.needsUpdate = true;
    };
    writePets(dogMesh.current, dogs, "dogs");
    writePets(catMesh.current, cats, "cats");
    // birds
    const ba = attrs.current.get("birds");
    if (birdMesh.current && ba) {
      creatures.birds.forEach((b, i) => {
        birdMesh.current!.setMatrixAt(i, compose(M4, b.x, b.y, b.z, b.yaw, 0, b.bank));
        ba.phase.setX(i, b.phase);
        ba.move.setX(i, 1);
      });
      birdMesh.current.instanceMatrix.needsUpdate = ba.phase.needsUpdate = ba.move.needsUpdate = true;
    }
    const writeGround = (mesh: THREE.InstancedMesh | null, list: typeof pigeons, key: string) => {
      const at = attrs.current.get(key);
      if (!mesh || !at) return;
      mesh.visible = showGround;
      if (!showGround) return;
      list.forEach((g, i) => {
        mesh.setMatrixAt(i, compose(M4, g.x, 0.02 + (g.hop > 0 && g.kind === "pigeon" ? Math.abs(Math.sin(g.hop * 12)) * 0.08 : 0), g.z, g.yaw));
        at.phase.setX(i, g.phase);
        at.move.setX(i, 0);
      });
      mesh.instanceMatrix.needsUpdate = at.phase.needsUpdate = true;
    };
    writeGround(pigeonMesh.current, pigeons, "pigeons");
    writeGround(egretMesh.current, egrets, "egrets");
  });

  const register = useMemo(() => {
    const cache = new Map<string, (p: THREE.InstancedMesh | null, t: THREE.InstancedMesh | null) => void>();
    return (key: string) => {
      if (!cache.has(key)) cache.set(key, (p, t) => vMeshes.set(key, [p, t]));
      return cache.get(key)!;
    };
  }, [vMeshes]);

  return (
    <group>
      {[...vKinds].map(([kind, idx]) => (
        <ModelPair key={`v:${kind}`} model={vModels[kind]} count={idx.length} colors={PAINT[kind]} seed={kind.length * 31} onMeshes={register(`v:${kind}`)} shadows={shadows} />
      ))}
      <instancedMesh ref={wheels} args={[wheelGeo, undefined, Math.max(1, wheelCount)]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </instancedMesh>
      {[...bKinds].map(([kind, idx]) => (
        <ModelPair key={`b:${kind}`} model={bModels[kind]} count={idx.length} colors={BOAT_PAINT[kind]} seed={kind.length * 17} onMeshes={register(`b:${kind}`)} shadows={shadows} />
      ))}
      <instancedMesh ref={wakes} args={[WAKE_GEO, mats.wake, Math.max(1, water.boats.length)]} frustumCulled={false} renderOrder={20} />
      <instancedMesh ref={peopleMesh} args={[geos.person, mats.walk, Math.max(1, people.people.length)]} frustumCulled={false} castShadow={false} />
      <instancedMesh ref={dogMesh} args={[geos.dog, mats.pet, Math.max(1, dogs.length)]} frustumCulled={false} />
      <instancedMesh ref={catMesh} args={[geos.cat, mats.still, Math.max(1, cats.length)]} frustumCulled={false} />
      <instancedMesh ref={birdMesh} args={[geos.bird, mats.wing, Math.max(1, creatures.birds.length)]} frustumCulled={false} />
      <instancedMesh ref={pigeonMesh} args={[geos.pigeon, mats.still, Math.max(1, pigeons.length)]} frustumCulled={false} />
      <instancedMesh ref={egretMesh} args={[geos.egret, mats.still, Math.max(1, egrets.length)]} frustumCulled={false} />
    </group>
  );
}

const BOATLEN: Record<BoatKind, number> = { tour: 26, ferry: 18, barge: 40, boat: 7, speedboat: 8 };

/** Wake: a V-shaped fan that fades out behind the boat. */
const WAKE_GEO = (() => {
  const g = new THREE.BufferGeometry();
  // unit triangle pointing +y (forward after the -90° x rotation), widest at the back
  const v = new Float32Array([0, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0, 0.5, -0.5, 0, -0.5, -0.5, 0]);
  g.setAttribute("position", new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
})();
