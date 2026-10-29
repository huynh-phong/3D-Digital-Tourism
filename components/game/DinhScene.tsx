"use client";

import { Environment, Sky } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { buildPalace } from "@/lib/dinh/palaceModel";
import { spaceModel, spacePlanner } from "@/lib/dinh/spaceModel";
import { disposePalaceTextures } from "@/lib/dinh/textures";
import { runtime, useGame } from "@/lib/store/game";
import { mountedSpaces, resetWorld, spaceReady, useWorld } from "@/lib/world/streaming";
import { LIGHT_POOL, SPACE_BY_ID, type SpaceId } from "@/data/dinh/spaces";
import type { Action, Quality } from "@/lib/store/settings";
import { tickPassages, tickProximity } from "@/lib/tour/director";
import { setPlanner, tickNavigator } from "@/lib/tour/navigator";
import { GuideNPC } from "@/components/guide/GuideNPC";
import { Player, useLook, type CameraState } from "@/components/player/Player";
import { SpaceView, usePalaceMaterials } from "./Palace";
import { DestinationMarker, Markers, RouteLine } from "./RouteGuide";
import { SPAWN } from "./spawn";


interface Props {
  quality: Quality;
  reducedMotion: boolean;
  held: React.RefObject<Set<Action>>;
  cam: React.RefObject<CameraState>;
  onCanvas: (c: HTMLCanvasElement) => void;
}

export default function DinhScene({ quality, reducedMotion, held, cam, onCanvas }: Props) {
  const shadows = quality !== "low";
  return (
    <Canvas
      shadows={shadows}
      dpr={quality === "low" ? 1 : quality === "medium" ? [1, 1.5] : [1, 2]}
      gl={{ antialias: quality !== "low", powerPreference: "high-performance" }}
      camera={{ fov: 62, near: 0.15, far: 1600, position: [0, 140, 260] }}
      onCreated={({ gl }) => {
        // Neutral keeps material colours true (ACES shifted the white façade and carpets).
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.0;
        onCanvas(gl.domElement);
      }}
    >
      <Suspense fallback={null}>
        <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60}>
          <World quality={quality} reducedMotion={reducedMotion} held={held} cam={cam} />
        </Physics>
      </Suspense>
    </Canvas>
  );
}

function World({ quality, reducedMotion, held, cam }: Omit<Props, "onCanvas">) {
  // the whole palace as data (CPU); each space mounts only its own part
  const model = useMemo(() => buildPalace(), []);
  // every visit starts outside, with nothing else mounted
  useState(() => resetWorld("exterior"));
  const active = useWorld((w) => w.active);
  const loading = useWorld((w) => w.loading);
  const cached = useWorld((w) => w.cached);
  const debugAll = useWorld((w) => w.debugAll);
  const mounted = mountedSpaces({ active, loading, cached, debugAll });
  // the visitor's directions and Minh Anh plan inside the active space
  const planner = useMemo(() => spacePlanner(spaceModel(model, active)), [model, active]);
  useEffect(() => {
    setPlanner(planner);
    return () => setPlanner(null);
  }, [planner]);
  // materials and textures are shared by all spaces: owned here, freed with the scene
  const { mats, extra } = usePalaceMaterials(quality);
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      Object.values(extra).forEach((m) => m.dispose());
    },
    [mats, extra],
  );
  useEffect(() => () => disposePalaceTextures(), []);
  const [introDone, setIntroDone] = useState(false);
  const [ready, setReady] = useState(false);
  const shadows = quality !== "low";
  const { gl, scene, camera } = useThree();

  useLook(cam, gl.domElement, introDone);
  useEffect(() => {
    // Dev-only QA hook: renderer statistics and the streaming state.
    if (process.env.NODE_ENV !== "production") (window as unknown as Record<string, unknown>).__sg3dGl = { gl, scene, world: useWorld };
  }, [gl, scene]);

  useEffect(() => {
    // Don't reveal the scene until every material is compiled (avoids a stutter
    // on the first frames of the intro flight and a half-drawn scene).
    let alive = true;
    const id = requestAnimationFrame(() => {
      gl.compileAsync(scene, camera)
        .catch(() => undefined)
        .then(() => {
          if (!alive) return;
          setReady(true);
          useGame.setState({ phase: "intro" });
        });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
    // compile once per scene mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Clean up GPU resources when the scene unmounts.
  useEffect(
    () => () => {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
      });
      gl.renderLists.dispose();
    },
    [scene, gl],
  );

  return (
    <>
      <Sky sunPosition={SUN_DIR} turbidity={4} rayleigh={1.0} mieCoefficient={0.004} />
      {/* image-based light for reflections (sky + ground baked once, no downloads) */}
      <Environment frames={1} resolution={quality === "low" ? 64 : 128} environmentIntensity={0.55}>
        <Sky sunPosition={SUN_DIR} turbidity={4} rayleigh={1.0} mieCoefficient={0.004} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
          <planeGeometry args={[400, 400]} />
          <meshBasicMaterial color="#6f7d5c" />
        </mesh>
      </Environment>
      <fog attach="fog" args={["#d5e0e8", 300, 1000]} />
      <Sun shadows={shadows} quality={quality} />
      <Lighting space={active} />

      {mounted.map((id) => (
        <SpaceView
          key={id}
          sm={spaceModel(model, id)}
          mode={id === active ? "active" : id === loading ? "loading" : debugAll ? "loading" : "cached"}
          model={model}
          mats={mats}
          extra={extra}
          quality={quality}
          onReady={id === loading ? () => spaceReady(id) : undefined}
        />
      ))}
      <Player held={held} cam={cam} spawn={SPAWN} introDone={introDone} />
      {/* one Minh Anh for the whole visit: she lives outside the spaces and follows the visitor between them */}
      <GuideNPC planner={planner} spawn={[3.2, 0, SPAWN.pos[2] - 2]} />
      <Markers />
      <RouteLine />
      <DestinationMarker />
      <Ticker />
      {ready && !introDone && <IntroCamera reducedMotion={reducedMotion} onDone={() => { setIntroDone(true); useGame.setState({ phase: "choose" }); }} />}
    </>
  );
}

const SUN_DIR: [number, number, number] = [120, 80, 160];

/** Sun with a shadow frustum that follows the player (keeps shadow maps small). */
function Sun({ shadows, quality }: { shadows: boolean; quality: Quality }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const [x, y, z] = runtime.player;
    if (!light.current) return;
    light.current.position.set(x + 60, y + 90, z + 75);
    target.position.set(x, y, z);
    target.updateMatrixWorld();
  });
  const size = quality === "high" ? 2048 : 1024;
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={2.6}
        color="#fff6e8"
        castShadow={shadows}
        shadow-mapSize={[size, size]}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-camera-near={10}
        shadow-camera-far={260}
        shadow-bias={-0.0003}
        shadow-normalBias={0.035}
        shadow-radius={3}
      />
    </>
  );
}

/**
 * Interior fill: a fixed pool of soft, shadowless point lights (neutral warm
 * white) placed by the active space. The pool size never changes, so moving
 * between spaces never recompiles shaders; outdoors the pool is off and the
 * sky light is full, indoors the sky light is dimmed.
 */
function Lighting({ space }: { space: SpaceId }) {
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const scene = useThree((s) => s.scene);
  const k = useRef(0); // 0 outdoors … 1 inside the building
  const pts = SPACE_BY_ID.get(space)!.lights;
  const indoor = space !== "exterior" && space !== "roof";
  useEffect(() => {
    lights.current.forEach((l, i) => {
      if (!l) return;
      const p = pts[i];
      if (p) {
        l.position.set(p[0], p[1], p[2]);
        l.distance = p[3];
      }
    });
  }, [pts]);
  useFrame((_, dt) => {
    k.current += ((indoor ? 1 : 0) - k.current) * Math.min(1, dt * 3);
    const t = k.current;
    lights.current.forEach((l, i) => {
      if (l) l.intensity = pts[i] ? pts[i][4] * (0.25 + 0.75 * t) : 0;
    });
    // Indoors the sky must not tint walls and floors blue: dim sky IBL + hemisphere.
    scene.environmentIntensity = 0.55 - 0.37 * t;
    if (hemi.current) hemi.current.intensity = 0.55 - 0.3 * t;
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={["#eaf3ff", "#a39a80", 0.55]} />
      <ambientLight intensity={0.1} color="#fff4e6" />
      {Array.from({ length: LIGHT_POOL }, (_, i) => (
        <pointLight key={i} ref={(l) => void (lights.current[i] = l)} intensity={0} decay={1.3} color="#fff1dc" />
      ))}
    </>
  );
}

function Ticker() {
  const acc = useRef(0);
  useFrame((s, dt) => {
    tickNavigator(s.clock.elapsedTime);
    acc.current += dt;
    if (acc.current > 0.16) {
      acc.current = 0;
      tickProximity();
      tickPassages();
    }
  });
  return null;
}

/** Camera flies from above the grounds down behind the visitor at the gate. */
function IntroCamera({ reducedMotion, onDone }: { reducedMotion: boolean; onDone: () => void }) {
  const { camera } = useThree();
  const t = useRef(0);
  const from = useMemo(() => new THREE.Vector3(-120, 150, 260), []);
  const to = useMemo(() => new THREE.Vector3(0, SPAWN.pos[1] + 3.2, SPAWN.pos[2] + 4.6), []);
  const lookFrom = useMemo(() => new THREE.Vector3(0, 10, -30), []);
  const lookTo = useMemo(() => new THREE.Vector3(0, 1.5, SPAWN.pos[2] - 6), []);
  const done = useRef(false);
  useFrame((_, dt) => {
    if (done.current) return;
    const dur = reducedMotion ? 0.01 : 4.2;
    t.current = Math.min(1, t.current + dt / dur);
    const e = t.current < 0.5 ? 4 * t.current ** 3 : 1 - (-2 * t.current + 2) ** 3 / 2;
    camera.position.lerpVectors(from, to, e);
    const look = lookFrom.clone().lerp(lookTo, e);
    camera.lookAt(look);
    if (t.current >= 1) {
      done.current = true;
      onDone();
    }
  });
  return null;
}
