"use client";

import { CameraControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { LANDMARKS, project } from "@/data/landmarks";
import { CITY_BOUNDS, type CityBuild, type Tree } from "@/lib/city/buildCity";
import { mapView, useCityBuild } from "@/lib/city/useCityBuild";
import { footprintFrame, type Frame } from "@/lib/city/footprint";
import type { CityData, P2 } from "@/lib/city/types";
import { GROUNDS } from "@/data/dinh/layout";
import { rng } from "@/lib/geo";
import type { Landmark } from "@/types";
import { Cathedral, CityHall, Market, PalaceMini, PostOffice, Theatre, Tower } from "./LandmarkModels";
import { LivingCity } from "./LivingCity";
import { CityBuildings, CityGround, CitySun, CityTrees } from "./CityLayers";

export interface CitySceneHandle {
  reset: (smooth?: boolean) => void;
  flyTo: (id: string, close?: boolean) => Promise<void>;
  dive: () => Promise<void>;
}

const CENTER = { x: 420, z: 60 };
const HOME = { pos: [CENTER.x - 900, 1050, CENTER.z + 1250] as const, target: [CENTER.x, 0, CENTER.z] as const };

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
      camera={{ fov: 42, near: 5, far: 9000, position: [...HOME.pos] }}
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

function CityContent({
  data, dark, quality, reducedMotion, markerEls, onReady, handleRef,
}: Props & { handleRef: React.ForwardedRef<CitySceneHandle> }) {
  const controls = useRef<CameraControls>(null);
  const { scene } = useThree();

  const landmarkPos = useMemo(() => {
    const m = new Map<string, { x: number; z: number; frame: Frame | null }>();
    for (const l of LANDMARKS) {
      const [x, z] = project(l.lat, l.lon);
      m.set(l.id, { x, z, frame: l.kind === "palace" || l.kind === "street" || l.kind === "riverside" ? null : footprintFrame(data, x, z) });
    }
    return m;
  }, [data]);

  const exclusions = useMemo(
    () =>
      LANDMARKS.filter((l) => !["street", "riverside"].includes(l.kind)).map((l) => {
        const p = landmarkPos.get(l.id)!;
        return { x: p.x, z: p.z, r: l.kind === "palace" ? 60 : 45 };
      }),
    [landmarkPos],
  );
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
      if (!p || !controls.current) return;
      const dist = close ? 260 : 520;
      const h = close ? 160 : 330;
      // approach from the south-east so the palace front (north-east) is visible
      await controls.current.setLookAt(p.x + dist * 0.75, h, p.z + dist * 0.25, p.x, 10, p.z, !reducedMotion);
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

  useEffect(() => {
    scene.fog = new THREE.Fog(dark ? "#1a2233" : "#cfe8f5", 2600, 7500);
  }, [dark, scene]);

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

  return (
    <>
      <CameraControls
        ref={controls}
        makeDefault
        minDistance={60}
        maxDistance={2600}
        maxPolarAngle={Math.PI * 0.44}
        minPolarAngle={0.15}
        dollySpeed={0.6}
        smoothTime={reducedMotion ? 0.05 : 0.6}
      />
      <color attach="background" args={[dark ? "#141c2b" : "#bfe3f6"]} />
      <hemisphereLight args={[dark ? "#3a4a6e" : "#ffffff", dark ? "#1a1a14" : "#c9b48a", dark ? 0.55 : 1.35]} />
      <ambientLight intensity={dark ? 0.25 : 0.4} />
      <CitySun dark={dark} shadows={shadows} quality={quality} controls={controls} />

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(CITY_BOUNDS.x0 + CITY_BOUNDS.x1) / 2, -0.05, (CITY_BOUNDS.z0 + CITY_BOUNDS.z1) / 2]} receiveShadow={shadows}>
        <planeGeometry args={[CITY_BOUNDS.x1 - CITY_BOUNDS.x0 + 3000, CITY_BOUNDS.z1 - CITY_BOUNDS.z0 + 3000]} />
        <meshStandardMaterial color={dark ? "#2b302c" : "#ebe3cf"} roughness={1} />
      </mesh>
      {city && (
        <>
          <CityGround city={city} dark={dark} shadows={shadows} />
          <CityBuildings city={city} dark={dark} shadows={shadows} controls={controls} />
          <CityTrees trees={allTrees} dark={dark} shadows={shadows} />
        </>
      )}
      {city && <LivingCity city={city} quality={quality} controls={controls} extraSpaces={palaceSpaces} shadows={shadows} />}

      {/* landmarks */}
      {LANDMARKS.map((l) => {
        const p = landmarkPos.get(l.id)!;
        if (l.kind === "palace")
          return (
            <group key={l.id} position={[p.x, 0, p.z]} rotation={[0, PALACE_ROT, 0]}>
              <PalaceMini />
            </group>
          );
        const f = p.frame ?? { x: p.x, z: p.z, angle: 0, length: 40, width: 30 };
        if (l.kind === "cathedral") return <Cathedral key={l.id} f={f} />;
        if (l.kind === "postoffice") return <PostOffice key={l.id} f={f} />;
        if (l.kind === "market") return <Market key={l.id} f={f} />;
        if (l.kind === "theatre") return <Theatre key={l.id} f={f} />;
        if (l.kind === "hall") return <CityHall key={l.id} f={f} />;
        if (l.kind === "tower") return <Tower key={l.id} f={f} />;
        return null;
      })}
      <MarkerProjector positions={landmarkPos} els={markerEls} />
    </>
  );
}

export const MARKER_H: Record<Landmark["kind"], number> = {
  palace: 48, cathedral: 70, postoffice: 34, market: 40, street: 22, theatre: 32, tower: 285, hall: 40, riverside: 18,
};

/** Projects landmark anchors to screen space and moves the DOM labels (no React re-render). */
function MarkerProjector({ positions, els }: { positions: Map<string, { x: number; z: number }>; els: React.RefObject<Map<string, HTMLElement>> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  const { camera, size } = useThree();
  useFrame(() => {
    for (const l of LANDMARKS) {
      const el = els.current?.get(l.id);
      const p = positions.get(l.id);
      if (!el || !p) continue;
      v.set(p.x, MARKER_H[l.kind], p.z);
      const d = camera.position.distanceTo(v);
      v.project(camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.visibility = visible ? "visible" : "hidden";
      // Far away: compact pins (names only for the open landmark); close: full labels.
      el.dataset.far = String(d > 2200 && l.status !== "available");
      el.style.zIndex = String(Math.max(1, Math.round(10000 - d)));
    }
  });
  return null;
}
