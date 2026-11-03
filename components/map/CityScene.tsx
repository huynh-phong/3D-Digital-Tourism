"use client";

import { CameraControls, Line } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { CONTEXT_BUILDINGS, LANDMARKS, project } from "@/data/landmarks";
import { CITY_BOUNDS, pointInPolygon, REGION_OUTLINE, type CityBuild, type Tree } from "@/lib/city/buildCity";
import { mapView, useCityBuild } from "@/lib/city/useCityBuild";
import { footprintFrame, type Frame } from "@/lib/city/footprint";
import type { CityData, P2 } from "@/lib/city/types";
import { GROUNDS } from "@/data/dinh/layout";
import { rng } from "@/lib/geo";
import type { Landmark, LandmarkKind } from "@/types";
import {
  BaSonBridge, Cathedral, CityHall, Landmark81, Market, Museum, PalaceMini, PostOffice, Theatre, Tower, Wharf, ZooGate,
} from "./LandmarkModels";
import { LivingCity } from "./LivingCity";
import { Sky } from "./Sky";
import { setLandmarkNight } from "./landmarkTextures";
import { waterUniforms } from "@/lib/city/waterMaterial";
import { CityBuildings, CityGround, CitySun, CityTrees, StreetLights } from "./CityLayers";

export interface CitySceneHandle {
  reset: (smooth?: boolean) => void;
  flyTo: (id: string, close?: boolean) => Promise<void>;
  dive: () => Promise<void>;
}

/** Initial view: the whole central map (palace to Landmark 81), seen from the south-west. */
const CENTER = { x: 1250, z: -640 };
// framed so the diorama fills most of the screen (little sky around it) while all ten places stay in view
const HOME = { pos: [CENTER.x - 1550 * 0.9, 2350 * 0.98, CENTER.z + 2750 * 0.9] as const, target: [CENTER.x, 0, CENTER.z] as const };

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
        gl.toneMappingExposure = 1.12;
      }}
    >
      <CityContent {...props} handleRef={ref} />
    </Canvas>
  );
});

type Anchor = { x: number; z: number; frame: Frame | null };

/** Dev-only handles for the headless QA scripts (window.__sg3dMap). */
function devHook(add: Record<string, unknown>) {
  const w = window as unknown as { __sg3dMap?: Record<string, unknown> };
  w.__sg3dMap = Object.assign(w.__sg3dMap ?? {}, add);
}

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
  const { scene, camera, gl } = useThree();

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
    if (process.env.NODE_ENV !== "production") devHook({ controls: c, gl, scene });
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
  // fog takes the colour of the sky's horizon (warm morning haze / violet night)
  const fog = useMemo(() => new THREE.Fog("#f1e6d4", 2600, 7500), []);
  useEffect(() => {
    fog.color.set(dark ? "#2a2342" : "#f1e6d4");
    scene.fog = fog;
    setLandmarkNight(dark);
    // the river reflects a warm violet night sky (city glow) rather than cold blue
    waterUniforms.uSky.value.set(dark ? "#5b4a7a" : "#d8ecf0");
  }, [dark, scene, fog]);
  const lifeGroup = useRef<THREE.Group>(null);
  useFrame(() => {
    const d = controls.current?.distance ?? 2000;
    fog.near = Math.max(3000, d * 1.5);
    fog.far = Math.max(9000, d * 4);
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
        maxDistance={3700}
        maxPolarAngle={Math.PI * 0.44}
        minPolarAngle={0.15}
        dollySpeed={0.6}
        smoothTime={reducedMotion ? 0.05 : 0.6}
      />
      <color attach="background" args={[dark ? "#1a1a33" : "#f1e6d4"]} />
      <Sky dark={dark} />
      {/* night: blue sky light from above, warm bounce from the lit streets below */}
      <hemisphereLight args={[dark ? "#7f86c0" : "#fff2df", dark ? "#7a5236" : "#c9b48a", dark ? 0.9 : 1.2]} />
      <ambientLight intensity={dark ? 0.3 : 0.28} color={dark ? "#ffd9b5" : "#ffffff"} />
      <CitySun dark={dark} shadows={shadows} quality={quality} controls={controls} />

      <MapBase dark={dark} shadows={shadows} />
      {city && (
        <>
          <CityGround city={city} dark={dark} shadows={shadows} />
          <CityBuildings city={city} dark={dark} shadows={shadows} />
          <CityTrees trees={allTrees} dark={dark} shadows={shadows} />
          <StreetLights city={city} dark={dark} />
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
      <MarkerStems positions={landmarkPos} dark={dark} />
      <MarkerProjector positions={landmarkPos} els={markerEls} controls={controls} />
    </>
  );
}

/**
 * The map base: the ground covers exactly the cut region (REGION_OUTLINE) and
 * stands on a plinth with an ink rim that follows the same outline, like a
 * city model cut out for display. The plinth is decoration, not terrain.
 */
function MapBase({ dark, shadows }: { dark: boolean; shadows: boolean }) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape(REGION_OUTLINE.map(([x, z]) => new THREE.Vector2(x, -z)));
    const top = new THREE.ShapeGeometry(shape);
    top.rotateX(-Math.PI / 2); // shape (x, -z) -> world (x, 0, z)
    // side walls along the outline: rim 0..-6 m, body -6..-86 m
    const wall = (y0: number, y1: number) => {
      const pos: number[] = [];
      for (let i = 0; i < REGION_OUTLINE.length; i++) {
        const a = REGION_OUTLINE[i], b = REGION_OUTLINE[(i + 1) % REGION_OUTLINE.length];
        pos.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      return g;
    };
    return { top, rim: wall(0, -6), body: wall(-6, -86) };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const mats = useMemo(() => {
    const side = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide });
    return { rim: side("#2b241d"), body: side("#c9a77c") };
  }, []);
  useEffect(() => {
    mats.body.color.set(dark ? "#b08a66" : "#c9a77c");
    mats.rim.color.set(dark ? "#e9dcc2" : "#2b241d");
  }, [dark, mats]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return (
    <group>
      {/* First of the flat layers and writes no depth: rivers and roads are drawn
          over it by render order, never by a depth test a few cm apart (that
          shimmered when the camera turned). */}
      <mesh geometry={geo.top} position={[0, -0.05, 0]} renderOrder={-10} receiveShadow={shadows}>
        <meshStandardMaterial color={dark ? "#4a4e4a" : "#e8d8b1"} roughness={1} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo.rim} material={mats.rim} />
      <mesh geometry={geo.body} material={mats.body} />
    </group>
  );
}

/** Height (m) of the top of each landmark's model: the marker stem rises from here. */
export const MARKER_H: Record<LandmarkKind, number> = {
  palace: 48, cathedral: 70, postoffice: 34, museum: 26, wharf: 30, market: 40,
  landmark81: 475, tower: 285, zoo: 30, bridge: 125,
};
/** Length (m) of the stem above the model; the label sits on its top. */
export const STEM = 70;

/** World anchors of a marker: the foot on the ground at the place, the top of the stem where the label sits. */
export function markerAnchor(a: Anchor, kind: LandmarkKind) {
  const at = a.frame ?? a;
  // the two skyscrapers already rise above everything: a short stem keeps their labels in frame
  const stem = kind === "landmark81" || kind === "tower" ? 25 : STEM;
  return { foot: new THREE.Vector3(at.x, 0, at.z), top: new THREE.Vector3(at.x, MARKER_H[kind] + stem, at.z) };
}

/**
 * The marker stems: real geometry fixed in the world (one draw call), from the
 * ground at the place up through the model to the label. Constant pixel width
 * so they stay readable at every zoom; the model hides the part inside it.
 */
function MarkerStems({ positions, dark }: { positions: Map<string, Anchor>; dark: boolean }) {
  const points = useMemo(() => LANDMARKS.flatMap((l) => {
    const { foot, top } = markerAnchor(positions.get(l.id)!, l.kind);
    return [foot, top];
  }), [positions]);
  return <Line points={points} segments lineWidth={3} color={dark ? "#f3e6cc" : "#2b241d"} renderOrder={30} />;
}

/** Display level of a label: full name + status, short name, or just the pin. */
export type LabelMode = "full" | "short" | "dot";

/**
 * Billboard labels. Each label is a DOM element whose bottom-centre is pinned,
 * every frame, to the projected top of its stem: it always faces the viewer and
 * never leaves the stem. Projection runs after the camera controls have moved
 * the camera (default priority 0, after their -1; a positive priority would
 * switch off R3F's own rendering) with a freshly updated view matrix, so
 * label and 3D stem are always from the same frame; there is no smoothing,
 * CSS transition or per-label offset that could make a label lag or wander.
 *
 * Overlaps are resolved only by the level of detail (full → short name → pin),
 * never by moving a label, and a new level must be wanted for several frames
 * before it is shown, so labels don't flicker while the camera turns.
 */
function MarkerProjector({ positions, els, controls }: { positions: Map<string, Anchor>; els: React.RefObject<Map<string, HTMLElement>>; controls: React.RefObject<CameraControls | null> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  const { camera, size } = useThree();
  const items = useMemo(
    () => LANDMARKS.map((l) => ({ l, top: markerAnchor(positions.get(l.id)!, l.kind).top, x: 0, y: 0, d: 0, vis: false, mode: "full" as LabelMode, want: "full" as LabelMode, wantFor: 0 })),
    [positions],
  );
  useEffect(() => {
    // dev hook for the label-stability check (anchors + current state)
    if (process.env.NODE_ENV !== "production") devHook({ markers: items, camera });
  }, [items, camera]);
  useFrame(() => {
    camera.updateMatrixWorld();
    const zoom = controls.current?.distance ?? 2000;
    const base: LabelMode = zoom > 9000 ? "dot" : zoom > 2600 ? "short" : "full";
    for (const it of items) {
      v.copy(it.top);
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
      const rect = (m: LabelMode): [number, number, number, number] => {
        // label text lengths are provided by the DOM (they depend on the language)
        const chars = Number(m === "full" ? el.dataset.fullLen : el.dataset.shortLen) || 12;
        const w = m === "dot" ? 26 : chars * 7 + (m === "full" && it.l.status !== "available" ? 110 : 44);
        const h = m === "dot" ? 26 : 30;
        return [it.x - w / 2, it.y - h, it.x + w / 2, it.y];
      };
      const want = tries.find((m) => m === "dot" || !hit(rect(m)))!;
      // hysteresis: switch level only after the new one has been wanted for 8 frames
      if (want === it.mode) it.wantFor = 0;
      else if (want === it.want) it.wantFor++;
      else { it.want = want; it.wantFor = 1; }
      if (it.wantFor >= 8 || selected) { it.mode = want; it.wantFor = 0; }
      placed.push(rect(it.mode));
      if (el.dataset.mode !== it.mode) el.dataset.mode = it.mode;
      el.style.transform = `translate3d(${it.x.toFixed(2)}px, ${it.y.toFixed(2)}px, 0) translate(-50%, -100%)`;
      el.style.zIndex = String(selected ? 20000 : Math.max(1, Math.round(15000 - it.d / 10)));
    }
  });
  return null;
}
