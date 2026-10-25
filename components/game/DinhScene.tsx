"use client";

import { Sky } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { INTERACTABLES, TOUR_STOPS } from "@/data/dinh/tour";
import { buildPalace } from "@/lib/dinh/palaceModel";
import { NavGraph } from "@/lib/dinh/nav";
import { runtime, useGame, useProgress } from "@/lib/store/game";
import type { Action, Quality } from "@/lib/store/settings";
import { STAIR_POINTS, tickProximity } from "@/lib/tour/director";
import { GuideNPC } from "@/components/guide/GuideNPC";
import { Player, useLook, type CameraState } from "@/components/player/Player";
import { PalaceColliders, PalaceGeometry } from "./Palace";
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
      shadows={shadows ? "soft" : false}
      dpr={quality === "low" ? 1 : quality === "medium" ? [1, 1.5] : [1, 2]}
      gl={{ antialias: quality !== "low", powerPreference: "high-performance" }}
      camera={{ fov: 62, near: 0.15, far: 1600, position: [0, 140, 260] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
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
  const model = useMemo(() => buildPalace(), []);
  const nav = useMemo(() => new NavGraph(model.nav.nodes, model.nav.edges), [model]);
  const [introDone, setIntroDone] = useState(false);
  const shadows = quality !== "low";
  const { gl } = useThree();

  useLook(cam, gl.domElement, introDone);

  useEffect(() => {
    useGame.setState({ phase: "intro" });
  }, []);

  // Clean up GPU resources when the scene unmounts.
  const { scene } = useThree();
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
      <Sky sunPosition={[120, 80, 160]} turbidity={5} rayleigh={1.1} mieCoefficient={0.004} />
      <fog attach="fog" args={["#cfdbe3", 260, 900]} />
      <hemisphereLight args={["#e8f2ff", "#9a8e74", 0.85]} />
      <Sun shadows={shadows} quality={quality} />
      <InteriorLights />

      <PalaceColliders model={model} />
      <PalaceGeometry model={model} quality={quality} />
      <Player held={held} cam={cam} spawn={SPAWN} introDone={introDone} />
      <GuideNPC nav={nav} spawn={[3.2, 0, SPAWN.pos[2] - 2]} />
      <Markers />
      <Ticker />
      {!introDone && <IntroCamera reducedMotion={reducedMotion} onDone={() => { setIntroDone(true); useGame.setState({ phase: "choose" }); }} />}
    </>
  );
}

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
        intensity={2.3}
        color="#fff3df"
        castShadow={shadows}
        shadow-mapSize={[size, size]}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-camera-near={10}
        shadow-camera-far={260}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  );
}

function InteriorLights() {
  const pts: [number, number, number, number][] = [
    [0, 5.2, -23, 26], [30, 5.2, -23, 18], [-30, 5.2, -23, 14], [0, 5.2, -48, 22], [0, 5.2, -62, 16],
    [-10, -0.2, -50, 18], [10, -0.2, -50, 16], [0, -0.2, -62, 14], [11.3, 12, -69, 30], [-11.3, -1, -69, 10],
  ];
  return (
    <>
      <ambientLight intensity={0.18} />
      {pts.map(([x, y, z, d], i) => (
        <pointLight key={i} position={[x, y, z]} intensity={18} distance={d} decay={1.4} color="#ffe8c4" />
      ))}
    </>
  );
}

/** Floating markers above things you can interact with; dim once a stop is done. */
function Markers() {
  const completed = useProgress((s) => s.completed);
  const target = useGame((s) => s.targetStopId);
  const group = useRef<THREE.Group>(null);
  useFrame((s) => {
    group.current?.children.forEach((c, i) => {
      c.rotation.y = s.clock.elapsedTime * 1.2 + i;
      c.position.y = (c.userData.baseY as number) + Math.sin(s.clock.elapsedTime * 2 + i) * 0.12;
    });
  });
  const items = [
    ...TOUR_STOPS.map((s) => ({ key: s.id, p: s.position, color: s.id === target ? "#1f5fd6" : completed.includes(s.id) ? "#8a9a90" : "#17834f", size: 0.42 })),
    ...INTERACTABLES.map((i) => ({ key: i.id, p: i.position, color: "#d4a017", size: 0.3 })),
    ...STAIR_POINTS.map((s, k) => ({ key: `st${k}`, p: s.at, color: "#7a5236", size: 0.26 })),
  ];
  return (
    <group ref={group}>
      {items.map((it) => (
        <mesh key={it.key} position={[it.p[0], it.p[1] + 2.6, it.p[2]]} userData={{ baseY: it.p[1] + 2.6 }}>
          <octahedronGeometry args={[it.size, 0]} />
          <meshStandardMaterial color={it.color} emissive={it.color} emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Ticker() {
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current > 0.16) {
      acc.current = 0;
      tickProximity();
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
