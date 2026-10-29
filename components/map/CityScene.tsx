"use client";

import { CameraControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { CONTEXT_BUILDINGS, LANDMARKS, project } from "@/data/landmarks";
import { CITY_BOUNDS, pointInPolygon, type CityBuild, type Tree } from "@/lib/city/buildCity";
import { mapView, useCityBuild } from "@/lib/city/useCityBuild";
import { footprintFrame, type Frame } from "@/lib/city/footprint";
import { loadOutskirtsData, type OutskirtsData } from "@/lib/city/outskirts";
import type { CityData, P2 } from "@/lib/city/types";
import { GROUNDS } from "@/data/dinh/layout";
import { rng } from "@/lib/geo";
import type { Landmark, LandmarkKind } from "@/types";
import {
  BaSonBridge, Cathedral, CityHall, Landmark81, Market, Museum, PalaceMini, PostOffice, Theatre, Tower, Wharf, ZooGate,
} from "./LandmarkModels";
import { LivingCity } from "./LivingCity";
import { OutskirtsLayer } from "./OutskirtsLayer";
import { CityBuildings, CityGround, CitySun, CityTrees } from "./CityLayers";

export interface CitySceneHandle {
  reset: (smooth?: boolean) => void;
  flyTo: (id: string, close?: boolean) => Promise<void>;
  dive: () => Promise<void>;
}

/** Initial view: the whole central map (palace to Landmark 81), seen from the south-west. */
const CENTER = { x: 1250, z: -620 };
const HOME = { pos: [CENTER.x - 1550, 2350, CENTER.z + 2750] as const, target: [CENTER.x, 0, CENTER.z] as const };

/**
 * Palace orientation in the city: its front faces Nam Kỳ Khởi Nghĩa (north-east).
 * Local +z (front) must map to world (+x, −z): rotation.y = 3π/4.
 */
const PALACE_ROT = (3 * Math.PI) / 4;

function groundsPolygon(): P2[] {
  const c = Math.cos(PALACE_ROT), s = Math.sin(PALACE_ROT);
  const pts: P2[] = [
    [-GROUNDS.halfW, -GROUNDS.halfD], [GROUNDS.halfW, -GROUNDS.halfD], [GROUNDS.halfW, GROUNDS.halfD], [-GROUNDS.halfW, GROUNDS.halfD],
  ];
  // rotation.y: (x, z) -> (x cos + z sin, -x sin + z cos)
  return pts.map(([x, z]) => [x * c + z * s, -x * s + z * c]);
}

interface Props {
  data: CityData;
  dark: boolean;
  quality: "low" | "medium" | "high";
  reducedMotion: boolean;
  /** DOM label elements keyed by landmark id; positioned every frame. */
  markerEls: React.RefObject<Map<string, HTMLElement>>;
  onReady: (stats: CityBuild["stats"]) => void;
}

export const CityScene = forwardRef<CitySceneHandle, Props>(function CityScene(props, ref) {
  const { quality } = props;
  return (
    <Canvas
      shadows={quality !== "low"}
      dpr={quality === "low" ? 1 : [1, 1.75]}
      gl={{ antialias: quality !== "low", powerPreference: "high-performance" }}
      camera={{ fov: 42, near: 2, far: 12000, position: [...HOME.pos] }}
      onCreated={({ gl }) => {
        // Neutral keeps the saturated "miniature city" palette (ACES washes it out).
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <CityContent {...props} handleRef={ref} />
    </Canvas>
  );
});

type Anchor = { x: number; z: number; frame: Frame | null };

/** The Ba Son bridge line (OSM) and its pylon: the first point on dry land east of the river. */
function baSonGeometry(data: CityData) {
  const parts = data.roads.filter((r) => r.n === "Cầu Ba Son").map((r) => r.p);
  if (!parts.length) return null;
  const line = parts.reduce((a, b) => (b.length > a.length ? b : a));
  // walk from west to east
  const pts = line[0][0] < line[line.length - 1][0] ? line : [...line].reverse();
  const inWater = (x: number, z: number) => data.water.some((w) => pointInPolygon(x, z, w.p));
  let seenWater = false;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s < len; s += 5) {
      const x = a[0] + ((b[0] - a[0]) * s) / len, z = a[1] + ((b[1] - a[1]) * s) / len;
      const w = inWater(x, z);
      if (w) seenWater = true;
      else if (seenWater) return { line: pts, pylon: [x, z] as P2 };
    }
  }
  return { line: pts, pylon: pts[Math.floor(pts.length / 2)] };
}

function CityContent({
  data, dark, quality, reducedMotion, markerEls, onReady, handleRef,
}: Props & { handleRef: React.ForwardedRef<CitySceneHandle> }) {
  const controls = useRef<CameraControls>(null);
  const { scene, camera } = useThree();

  // the open ring around the city (roads, water, thinning houses); optional
  const [outskirts, setOutskirts] = useState<OutskirtsData | null>(null);
  useEffect(() => {
    let alive = true;
    loadOutskirtsData().then((d) => alive && setOutskirts(d)).catch((e) => console.warn("[map] outskirts unavailable", e));
    return () => void (alive = false);
  }, []);

  const landmarkPos = useMemo(() => {
    const m = new Map<string, Anchor>();
    for (const l of LANDMARKS) {
      const [x, z] = project(l.lat, l.lon);
      const fit = l.geometry === "footprint" && l.kind !== "palace";
      m.set(l.id, { x, z, frame: fit ? footprintFrame(data, x, z, l.kind === "landmark81" ? 90 : 25) : null });
    }
    for (const c of CONTEXT_BUILDINGS) {
      const [x, z] = project(c.lat, c.lon);
      m.set(c.id, { x, z, frame: footprintFrame(data, x, z) });
    }
    return m;
  }, [data]);

  const baSon = useMemo(() => baSonGeometry(data), [data]);
  const zoo = useMemo(() => {
    const park = data.green.find((g) => g.n === "Thảo Cầm Viên Sài Gòn");
    if (!park) return null;
    // ticket office on Nguyễn Bỉnh Khiêm (OSM node 5416327328)
    const gate = project(10.787744, 106.705462) as P2;
    const R = rng(5);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const q of park.p) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
    const pens: P2[] = [];
    for (let i = 0; i < 400 && pens.length < 7; i++) {
      const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0);
      if (pointInPolygon(x, z, park.p) && Math.hypot(x - gate[0], z - gate[1]) > 60 && pens.every((p) => Math.hypot(p[0] - x, p[1] - z) > 40)) pens.push([x, z]);
    }
    const c = park.p.reduce((a, q) => [a[0] + q[0] / park.p.length, a[1] + q[1] / park.p.length], [0, 0]);
    return { gate, pens, yaw: -Math.atan2(c[1] - gate[1], c[0] - gate[0]) + Math.PI / 2 };
  }, [data]);

  const exclusions = useMemo(() => {
    const out: { x: number; z: number; r: number; h?: number }[] = [];
    for (const l of LANDMARKS) {
      if (l.geometry !== "footprint") continue;
      const p = landmarkPos.get(l.id)!;
      const at = p.frame ?? p;
      out.push({ x: at.x, z: at.z, r: l.kind === "palace" ? 60 : l.kind === "landmark81" ? 55 : 45, h: l.kind === "landmark81" ? 461 : l.kind === "tower" ? 262 : undefined });
    }
    for (const c of CONTEXT_BUILDINGS) {
      const p = landmarkPos.get(c.id)!;
      out.push({ x: p.x, z: p.z, r: 45 });
    }
    if (zoo) out.push({ x: zoo.gate[0], z: zoo.gate[1], r: 14 });
    return out;
  }, [landmarkPos, zoo]);
  const zones = useMemo(() => [groundsPolygon()], []);
  // Built in a Web Worker; null while building (the loading screen stays up).
  const city = useCityBuild(data, exclusions, zones, quality);

  useEffect(() => {
    if (city) onReady(city.stats);
  }, [city, onReady]);

  // Trees inside the palace grounds (outside the lawn, buildings and paths).
  const groundsTrees = useMemo(() => {
    const out: Tree[] = [];
    const R = rng(11);
    const c = Math.cos(PALACE_ROT), s = Math.sin(PALACE_ROT);
    for (let i = 0; i < 260; i++) {
      const lx = (R() * 2 - 1) * (GROUNDS.halfW - 8), lz = (R() * 2 - 1) * (GROUNDS.halfD - 8);
      const dl = Math.hypot(lx - GROUNDS.lawnCenter[0], lz - GROUNDS.lawnCenter[1]);
      if (dl < GROUNDS.ringRadius + 10) continue;
      if (Math.abs(lx) < 60 && lz > -100 && lz < 20) continue; // palace
      if (Math.abs(lx) < 12 && lz > 100) continue; // gate drive
      out.push({ x: lx * c + lz * s, z: -lx * s + lz * c, s: 1 + R() * 0.6, k: R() < 0.35 ? 1 : 0 });
    }
    return out;
  }, []);

  useImperativeHandle(handleRef, () => ({
    reset: (smooth = true) => {
      void controls.current?.setLookAt(...HOME.pos, ...HOME.target, smooth && !reducedMotion);
    },
    flyTo: async (id, close = false) => {
      const p = landmarkPos.get(id);
      const l = LANDMARKS.find((x) => x.id === id);
      if (!p || !l || !controls.current) return;
      const at = p.frame ?? p;
      // tall or sprawling places need a wider shot
      const scale = l.kind === "landmark81" ? 2.2 : l.kind === "tower" ? 1.5 : l.geometry === "boundary" ? 1.4 : 1;
      const dist = (close ? 260 : 520) * scale;
      const h = (close ? 160 : 330) * scale;
      // approach from the south-east so the palace front (north-east) is visible
      await controls.current.setLookAt(at.x + dist * 0.75, h, at.z + dist * 0.25, at.x, l.kind === "landmark81" ? 120 : 10, at.z, !reducedMotion);
    },
    dive: async () => {
      const p = landmarkPos.get("dinh-doc-lap")!;
      if (!controls.current) return;
      // Fly toward the main gate on Nam Kỳ Khởi Nghĩa (palace local +z → world NE).
      const gx = p.x + Math.sin(PALACE_ROT) * 170, gz = p.z + Math.cos(PALACE_ROT) * 170;
      await controls.current.setLookAt(gx + 30, 30, gz - 30, p.x, 12, p.z, !reducedMotion);
    },
  }));

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.setBoundary(new THREE.Box3(new THREE.Vector3(CITY_BOUNDS.x0, 0, CITY_BOUNDS.z0), new THREE.Vector3(CITY_BOUNDS.x1, 400, CITY_BOUNDS.z1)));
    c.boundaryEnclosesCamera = false;
    if (process.env.NODE_ENV !== "production") (window as unknown as Record<string, unknown>).__sg3dMap = { controls: c };
    if (mapView.returningFromTour) {
      // Coming back from the palace: start at the gate where we dived in, then pull back.
      mapView.returningFromTour = false;
      const p = landmarkPos.get("dinh-doc-lap")!;
      const gx = p.x + Math.sin(PALACE_ROT) * 170, gz = p.z + Math.cos(PALACE_ROT) * 170;
      void c.setLookAt(gx + 30, 30, gz - 30, p.x, 12, p.z, false).then(() =>
        c.setLookAt(p.x + 520 * 0.75, 330, p.z + 520 * 0.25, p.x, 10, p.z, !reducedMotion),
      );
    } else void c.setLookAt(...HOME.pos, ...HOME.target, false);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fog and the clip planes follow the zoom: the whole city from above, street level stays crisp.
  const fog = useMemo(() => new THREE.Fog("#cfe8f5", 2600, 7500), []);
  useEffect(() => {
    fog.color.set(dark ? "#1a2233" : "#cfe8f5");
    scene.fog = fog;
  }, [dark, scene, fog]);
  const lifeGroup = useRef<THREE.Group>(null);
  useFrame(() => {
    const d = controls.current?.distance ?? 2000;
    fog.near = Math.max(2600, d * 1.1);
    fog.far = Math.max(7500, d * 3.2);
    const pc = camera as THREE.PerspectiveCamera;
    const far = Math.max(12000, d * 4), near = Math.max(2, d * 0.002);
    if (Math.abs(pc.far - far) > far * 0.1 || Math.abs(pc.near - near) > near * 0.25) {
      pc.far = far;
      pc.near = near;
      pc.updateProjectionMatrix();
    }
    // traffic and people are invisible from the highest views: stop drawing them
    if (lifeGroup.current) lifeGroup.current.visible = d < 4500;
  });

  const shadows = quality !== "low";
  const origin = landmarkPos.get("dinh-doc-lap")!;
  // Visitors stroll around the palace lawn (ring drive), in city coordinates.
  const palaceSpaces = useMemo(() => {
    const c = Math.cos(PALACE_ROT), s = Math.sin(PALACE_ROT);
    const pts: P2[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const lx = GROUNDS.lawnCenter[0] + Math.cos(a) * GROUNDS.ringRadius, lz = GROUNDS.lawnCenter[1] + Math.sin(a) * GROUNDS.ringRadius;
      pts.push([origin.x + lx * c + lz * s, origin.z - lx * s + lz * c]);
    }
    return [{ kind: "plaza" as const, pts, links: pts.map((_, i) => [(i + 1) % pts.length, (i + pts.length - 1) % pts.length]) }];
  }, [origin]);
  const allTrees = useMemo(() => [...(city?.trees ?? []), ...groundsTrees.map((t) => ({ ...t, x: t.x + origin.x, z: t.z + origin.z }))], [city, groundsTrees, origin]);

  const model = (l: Landmark) => {
    const p = landmarkPos.get(l.id)!;
    const f = p.frame ?? { x: p.x, z: p.z, angle: 0, length: 40, width: 30 };
    switch (l.kind) {
      case "palace":
        return (
          <group key={l.id} position={[p.x, 0, p.z]} rotation={[0, PALACE_ROT, 0]}>
            <PalaceMini />
          </group>
        );
      case "cathedral": return <Cathedral key={l.id} f={f} />;
      case "postoffice": return <PostOffice key={l.id} f={f} />;
      case "market": return <Market key={l.id} f={f} />;
      case "tower": return <Tower key={l.id} f={f} />;
      case "museum": return <Museum key={l.id} f={f} />;
      case "wharf": return <Wharf key={l.id} f={f} />;
      case "landmark81": return <Landmark81 key={l.id} f={f} />;
      case "bridge": return baSon ? <BaSonBridge key={l.id} line={baSon.line} pylon={baSon.pylon} /> : null;
      case "zoo": return zoo ? <ZooGate key={l.id} gate={zoo.gate} yaw={zoo.yaw} pens={zoo.pens} /> : null;
    }
  };

  return (
    <>
      <CameraControls
        ref={controls}
        makeDefault
        minDistance={60}
        maxDistance={5200}
        maxPolarAngle={Math.PI * 0.44}
        minPolarAngle={0.15}
        dollySpeed={0.6}
        smoothTime={reducedMotion ? 0.05 : 0.6}
      />
      <color attach="background" args={[dark ? "#141c2b" : "#bfe3f6"]} />
      <hemisphereLight args={[dark ? "#3a4a6e" : "#ffffff", dark ? "#1a1a14" : "#c9b48a", dark ? 0.55 : 1.35]} />
      <ambientLight intensity={dark ? 0.25 : 0.4} />
      <CitySun dark={dark} shadows={shadows} quality={quality} controls={controls} />

      <MapBase dark={dark} shadows={shadows} />
      {outskirts && <OutskirtsLayer data={outskirts} quality={quality} dark={dark} shadows={shadows} />}
      {city && (
        <>
          <CityGround city={city} dark={dark} shadows={shadows} />
          <CityBuildings city={city} dark={dark} shadows={shadows} controls={controls} />
          <CityTrees trees={allTrees} dark={dark} shadows={shadows} />
        </>
      )}
      <group ref={lifeGroup}>
        {city && <LivingCity city={city} quality={quality} controls={controls} extraSpaces={palaceSpaces} shadows={shadows} />}
      </group>

      {/* the 10 landmarks + two context buildings */}
      {LANDMARKS.map(model)}
      {CONTEXT_BUILDINGS.map((c) => {
        const p = landmarkPos.get(c.id)!;
        const f = p.frame ?? { x: p.x, z: p.z, angle: 0, length: 40, width: 30 };
        return c.kind === "theatre" ? <Theatre key={c.id} f={f} /> : <CityHall key={c.id} f={f} />;
      })}
      <MarkerProjector positions={landmarkPos} els={markerEls} controls={controls} />
    </>
  );
}

/**
 * Ground of the map: the mapped city sits in a wide plain (3 km margin on
 * every side) crossed by the real roads and river, the space later districts
 * can be added to.
 */
function MapBase({ dark, shadows }: { dark: boolean; shadows: boolean }) {
  const M = 3000;
  return (
    // First of the flat layers and writes no depth: rivers and roads are drawn
    // over it by render order, never by a depth test a few cm apart (that
    // shimmered when the camera turned).
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(CITY_BOUNDS.x0 + CITY_BOUNDS.x1) / 2, -0.05, (CITY_BOUNDS.z0 + CITY_BOUNDS.z1) / 2]} renderOrder={-10} receiveShadow={shadows}>
      <planeGeometry args={[CITY_BOUNDS.x1 - CITY_BOUNDS.x0 + M * 2, CITY_BOUNDS.z1 - CITY_BOUNDS.z0 + M * 2]} />
      <meshStandardMaterial color={dark ? "#2b302c" : "#ebe3cf"} roughness={1} depthWrite={false} />
    </mesh>
  );
}

/** Height (m) of each marker's anchor above the ground: just over the model. */
export const MARKER_H: Record<LandmarkKind, number> = {
  palace: 48, cathedral: 70, postoffice: 34, museum: 26, wharf: 30, market: 40,
  landmark81: 475, tower: 285, zoo: 30, bridge: 125,
};

/** Display level of a label: full name + status, short name, or just the pin. */
export type LabelMode = "full" | "short" | "dot";

/**
 * Projects landmark anchors to screen space and moves the DOM labels without a
 * React re-render. The level of detail follows the zoom; labels are placed in
 * priority order (selected, the open palace, then nearest) and a label that
 * would overlap one already placed is lifted, then shortened, then reduced to a pin.
 */
function MarkerProjector({ positions, els, controls }: { positions: Map<string, Anchor>; els: React.RefObject<Map<string, HTMLElement>>; controls: React.RefObject<CameraControls | null> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  const { camera, size } = useThree();
  const items = useMemo(() => LANDMARKS.map((l) => ({ l, x: 0, y: 0, d: 0, vis: false })), []);
  useFrame(() => {
    const zoom = controls.current?.distance ?? 2000;
    const base: LabelMode = zoom > 9000 ? "dot" : zoom > 2600 ? "short" : "full";
    for (const it of items) {
      const p = positions.get(it.l.id);
      if (!p) continue;
      const at = p.frame ?? p;
      v.set(at.x, MARKER_H[it.l.kind], at.z);
      it.d = camera.position.distanceTo(v);
      v.project(camera);
      it.vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      it.x = (v.x * 0.5 + 0.5) * size.width;
      it.y = (-v.y * 0.5 + 0.5) * size.height;
    }
    const placed: [number, number, number, number][] = [];
    const hit = (r: [number, number, number, number]) => placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
    const order = [...items].sort((a, b) => {
      const ea = els.current?.get(a.l.id), eb = els.current?.get(b.l.id);
      const pa = (ea?.dataset.selected === "true" ? 0 : 2) + (a.l.status === "available" ? 0 : 1);
      const pb = (eb?.dataset.selected === "true" ? 0 : 2) + (b.l.status === "available" ? 0 : 1);
      return pa - pb || a.d - b.d;
    });
    for (const it of order) {
      const el = els.current?.get(it.l.id);
      if (!el) continue;
      el.style.visibility = it.vis ? "visible" : "hidden";
      if (!it.vis) continue;
      const selected = el.dataset.selected === "true";
      // the palace and the selected place always keep at least their short name
      const first: LabelMode = selected ? "full" : base === "dot" && it.l.status === "available" ? "short" : base;
      const tries: LabelMode[] = first === "full" ? ["full", "short", "dot"] : first === "short" ? ["short", "dot"] : ["dot"];
      let mode: LabelMode = "dot", lift = 0;
      search: for (const m of tries) {
        // label text lengths are provided by the DOM (they depend on the language)
        const chars = Number(m === "full" ? el.dataset.fullLen : el.dataset.shortLen) || 12;
        const w = m === "dot" ? 26 : chars * 7 + (m === "full" && it.l.status !== "available" ? 110 : 44);
        const h = m === "dot" ? 26 : 28;
        for (const up of m === "dot" ? [0] : [0, 30, 60]) {
          const r: [number, number, number, number] = [it.x - w / 2, it.y - 20 - up - h, it.x + w / 2, it.y - 20 - up];
          if (!hit(r) || m === "dot") {
            placed.push(r);
            mode = m;
            lift = up;
            break search;
          }
        }
      }
      if (el.dataset.mode !== mode) el.dataset.mode = mode;
      el.style.setProperty("--lift", `${lift}px`);
      el.style.transform = `translate(-50%, -100%) translate(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px)`;
      el.style.zIndex = String(selected ? 20000 : Math.max(1, Math.round(15000 - it.d / 10)));
    }
  });
  return null;
}
