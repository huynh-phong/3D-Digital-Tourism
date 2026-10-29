"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { INTERACTABLES, TOUR_STOPS } from "@/data/dinh/tour";
import { usePointerLock } from "@/lib/game/pointer";
import { useGame, useProgress } from "@/lib/store/game";
import { DEST_BY_KEY, destKey } from "@/lib/tour/destinations";
import { navigateTo } from "@/lib/tour/director";
import { useWorld } from "@/lib/world/streaming";
import { spaceAt } from "@/data/dinh/spaces";
import { INTERACTIONS } from "@/data/dinh/interactions";
import { navTarget, navRuntime } from "@/lib/tour/navigator";
import type { Vec3 } from "@/types";

const ROUTE_COLOR = new THREE.Color("#2fd3ea");
const ARRIVED_COLOR = new THREE.Color("#34d399");
const BLOCKED_COLOR = new THREE.Color("#f5a524");

/* ------------------------------------------------------------ route line */
/**
 * Ribbon on the floor along the route (lifted a little on stair flights so
 * step noses don't cover it). Chevrons drift toward the destination; the part
 * behind the visitor fades out, so the line never jumps when it is replanned.
 */
function ribbon(points: Vec3[], width = 0.55) {
  const n = points.length;
  const pos: number[] = [], arc: number[] = [], side: number[] = [], idx: number[] = [];
  let s = 0;
  const lift = (i: number) => {
    const slope = (a: Vec3, b: Vec3) => Math.abs(b[1] - a[1]) / Math.max(0.01, Math.hypot(b[0] - a[0], b[2] - a[2]));
    const sl = Math.max(i > 0 ? slope(points[i - 1], points[i]) : 0, i < n - 1 ? slope(points[i], points[i + 1]) : 0);
    return 0.06 + (sl > 0.15 ? 0.32 : 0);
  };
  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (i > 0) s += Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1], p[2] - points[i - 1][2]);
    // horizontal direction in/out of this point, then a mitred normal
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    const d0 = new THREE.Vector2(p[0] - a[0], p[2] - a[2]), d1 = new THREE.Vector2(b[0] - p[0], b[2] - p[2]);
    if (d0.lengthSq() < 1e-6) d0.copy(d1);
    if (d1.lengthSq() < 1e-6) d1.copy(d0);
    d0.normalize();
    d1.normalize();
    const t = d0.clone().add(d1);
    if (t.lengthSq() < 1e-6) t.copy(d1);
    t.normalize();
    const nrm = new THREE.Vector2(-t.y, t.x);
    const miter = Math.min(2, 1 / Math.max(0.35, Math.abs(nrm.dot(new THREE.Vector2(-d1.y, d1.x)))));
    const w = (width / 2) * miter;
    const y = p[1] + lift(i);
    pos.push(p[0] + nrm.x * w, y, p[2] + nrm.y * w, p[0] - nrm.x * w, y, p[2] - nrm.y * w);
    arc.push(s, s);
    side.push(1, -1);
    if (i > 0) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aArc", new THREE.Float32BufferAttribute(arc, 1));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return { g, length: s };
}

export function RouteLine() {
  const mesh = useRef<THREE.Mesh>(null);
  const built = useRef(-1);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        uniforms: { uTime: { value: 0 }, uProgress: { value: 0 }, uLength: { value: 1 }, uColor: { value: ROUTE_COLOR.clone() }, uOpacity: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float aArc; attribute float aSide;
          varying float vArc; varying float vSide;
          void main() { vArc = aArc; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uProgress, uLength, uOpacity; uniform vec3 uColor;
          varying float vArc; varying float vSide;
          void main() {
            float behind = smoothstep(uProgress - 0.3, uProgress + 1.2, vArc);
            float tail = 1.0 - smoothstep(uLength - 0.9, uLength - 0.1, vArc);
            float edge = 1.0 - smoothstep(0.6, 1.0, abs(vSide));
            float c = fract((vArc - abs(vSide) * 0.45) * 0.7 - uTime * 0.9);
            float chevron = smoothstep(0.0, 0.12, c) * (1.0 - smoothstep(0.32, 0.46, c));
            vec3 col = uColor * (0.7 + 0.65 * chevron);
            float a = (0.42 + 0.4 * chevron) * edge * behind * tail * uOpacity;
            if (a < 0.01) discard;
            gl_FragColor = vec4(col, a);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame((s, dt) => {
    const m = mesh.current;
    if (!m) return;
    const r = navRuntime.route;
    if (navRuntime.version !== built.current) {
      built.current = navRuntime.version;
      m.geometry.dispose();
      if (r && r.points.length > 1) {
        const { g, length } = ribbon(r.points);
        m.geometry = g;
        mat.uniforms.uLength.value = length;
      } else m.geometry = new THREE.BufferGeometry();
    }
    const show = !!r && useGame.getState().navStatus === "active";
    const u = mat.uniforms;
    u.uOpacity.value += ((show ? 1 : 0) - u.uOpacity.value) * Math.min(1, dt * 6);
    u.uTime.value = s.clock.elapsedTime;
    u.uProgress.value = navRuntime.progress;
    m.visible = u.uOpacity.value > 0.01;
  });
  return <mesh ref={mesh} material={mat} renderOrder={5} frustumCulled={false} />;
}

/* ---------------------------------------------------- destination marker */
/** Pulsing ring + floating pin at the selected destination; green on arrival, amber when unreachable. */
export function DestinationMarker() {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const pin = useRef<THREE.Group>(null);
  const mats = useMemo(
    () => ({
      ring: new THREE.MeshBasicMaterial({ color: ROUTE_COLOR, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
      disc: new THREE.MeshBasicMaterial({ color: ROUTE_COLOR, transparent: true, opacity: 0.16, depthWrite: false }),
      pin: new THREE.MeshStandardMaterial({ color: ROUTE_COLOR, emissive: ROUTE_COLOR, emissiveIntensity: 0.55, roughness: 0.35 }),
      beam: new THREE.MeshBasicMaterial({ color: ROUTE_COLOR, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const st = useRef({ arrivedT: 0, scale: 0 });

  useFrame((s, dt) => {
    const g = useGame.getState();
    const d = g.destination ? DEST_BY_KEY.get(g.destination) : undefined;
    const grp = group.current;
    if (!grp) return;
    const k = st.current;
    if (!d || g.phase === "loading") {
      k.scale = Math.max(0, k.scale - dt * 4);
    } else {
      // stand-in point when the exact spot is blocked; the door on the way when it is in another space
      const r = navRuntime.route;
      const tgt = navTarget(d);
      const at: Vec3 = r && !r.exact ? r.points[r.points.length - 1] : tgt?.point ?? d.point;
      grp.position.set(at[0], at[1], at[2]);
      const arrived = g.navStatus === "arrived";
      k.arrivedT = arrived ? k.arrivedT + dt : 0;
      const target = arrived ? Math.max(0, 1 - Math.max(0, k.arrivedT - 1.2) * 1.2) : 1;
      k.scale += (target - k.scale) * Math.min(1, dt * 6);
      const col = arrived ? ARRIVED_COLOR : g.navStatus === "noPath" ? BLOCKED_COLOR : ROUTE_COLOR;
      for (const m of Object.values(mats)) m.color.copy(col);
      mats.pin.emissive.copy(col);
    }
    grp.visible = k.scale > 0.01;
    grp.scale.setScalar(Math.max(0.001, k.scale));
    const t = s.clock.elapsedTime;
    if (ring.current) {
      const p = (t * 0.8) % 1;
      ring.current.scale.setScalar(0.7 + p * 0.8);
      mats.ring.opacity = 0.65 * (1 - p);
    }
    if (pin.current) {
      pin.current.position.y = 2.1 + Math.sin(t * 2.2) * 0.12;
      pin.current.rotation.y = t * 1.2;
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]} material={mats.ring} renderOrder={6}>
        <ringGeometry args={[0.85, 1.0, 48]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.065, 0]} material={mats.disc} renderOrder={6}>
        <circleGeometry args={[0.85, 48]} />
      </mesh>
      <mesh position={[0, 1.0, 0]} material={mats.beam} renderOrder={7}>
        <cylinderGeometry args={[0.06, 0.18, 2, 16, 1, true]} />
      </mesh>
      <group ref={pin}>
        <mesh position={[0, -0.18, 0]} rotation={[Math.PI, 0, 0]} material={mats.pin}>
          <coneGeometry args={[0.16, 0.36, 16]} />
        </mesh>
        <mesh position={[0, 0.06, 0]} material={mats.pin}>
          <sphereGeometry args={[0.17, 16, 12]} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------- points of interest */
/**
 * Small floating markers above stops, exhibits and stair shortcuts. With the
 * cursor free, clicking one asks for directions to it.
 */
/** Time of the last marker click, so the scene click doesn't also grab the mouse. */
export const markerClick = { at: 0 };

export function Markers() {
  const completed = useProgress((s) => s.completed);
  const active = useWorld((w) => w.active);
  const destination = useGame((s) => s.destination);
  const group = useRef<THREE.Group>(null);
  useFrame((s) => {
    group.current?.children.forEach((c, i) => {
      c.rotation.y = s.clock.elapsedTime * 1.1 + i;
      c.position.y = (c.userData.baseY as number) + Math.sin(s.clock.elapsedTime * 1.8 + i) * 0.08;
    });
  });
  const items = useMemo(
    () => [
      ...TOUR_STOPS.map((s) => ({ key: destKey("stop", s.id), p: s.position, color: completed.includes(s.id) ? "#8a9a90" : "#1f9d63", size: 0.26 })),
      ...INTERACTABLES.map((i) => ({ key: destKey("interactable", i.id), p: i.position, color: "#d4a017", size: 0.2 })),
      ...INTERACTIONS.filter((s) => s.kind === "stairs" || s.kind === "hint").map((s) => ({ key: `stairs:${s.id}`, p: s.at, color: "#8a6a4e", size: 0.18 })),
    ].filter((it) => spaceAt(it.p) === active), // markers of unloaded spaces are not drawn
    [completed, active],
  );
  const click = (key: string) => (e: ThreeEvent<MouseEvent>) => {
    if (usePointerLock.getState().locked || key.startsWith("stairs:")) return;
    e.stopPropagation();
    markerClick.at = performance.now();
    navigateTo(key);
  };
  return (
    <group ref={group}>
      {items
        .filter((it) => it.key !== destination)
        .map((it) => (
          <mesh
            key={it.key}
            position={[it.p[0], it.p[1] + 3, it.p[2]]}
            userData={{ baseY: it.p[1] + 3 }}
            onClick={click(it.key)}
            onPointerOver={() => !usePointerLock.getState().locked && (document.body.style.cursor = "pointer")}
            onPointerOut={() => (document.body.style.cursor = "")}
          >
            <octahedronGeometry args={[it.size, 0]} />
            <meshStandardMaterial color={it.color} emissive={it.color} emissiveIntensity={0.35} />
          </mesh>
        ))}
    </group>
  );
}
