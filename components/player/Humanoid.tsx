"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { clamp, damp } from "@/lib/geo";

/**
 * Procedural, code-animated humanoid (no external assets). Gait phase is
 * driven by actual ground speed so feet don't slide. Replace with a rigged
 * GLB later by keeping the same `HumanoidAnim` contract.
 */
export type AnimState = "idle" | "move" | "talk" | "point" | "interact" | "listen" | "wave";

export interface HumanoidAnim {
  speed: number; // m/s, ground speed
  turnRate: number; // rad/s
  state: AnimState;
  /** world-space point the head looks at */
  look: THREE.Vector3 | null;
  /** world-space point the right arm points at */
  pointAt: THREE.Vector3 | null;
  /** 0..1 fade (used when the guide re-positions) */
  opacity: number;
}

export const newAnim = (): HumanoidAnim => ({ speed: 0, turnRate: 0, state: "idle", look: null, pointAt: null, opacity: 1 });

export interface Outfit {
  skin: string;
  hair: string;
  top: string;
  topAccent: string;
  bottom: string;
  shoes: string;
  skirt?: boolean;
  bun?: boolean;
  badge?: string;
  height: number; // metres
}

export const MINH_ANH: Outfit = {
  skin: "#e7c19f", hair: "#1c1511", top: "#1f3557", topAccent: "#f5f3ee", bottom: "#1f3557", shoes: "#141414",
  skirt: true, bun: true, badge: "#17834f", height: 1.62,
};
export const VISITOR: Outfit = {
  skin: "#d7a77f", hair: "#2a2018", top: "#2a9d8f", topAccent: "#e9f5f3", bottom: "#33475b", shoes: "#f2f2f2", height: 1.72,
};

function capsule(r: number, len: number) {
  const g = new THREE.CapsuleGeometry(r, len, 4, 10);
  g.translate(0, -len / 2 - r, 0);
  return g;
}

export function Humanoid({ outfit, anim, castShadow = true }: { outfit: Outfit; anim: RefObject<HumanoidAnim>; castShadow?: boolean }) {
  const s = outfit.height / 1.72;
  const mats = useMemo(() => {
    const m = (c: string, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r, transparent: true });
    return {
      skin: m(outfit.skin, 0.6), hair: m(outfit.hair, 0.5), top: m(outfit.top), accent: m(outfit.topAccent),
      bottom: m(outfit.bottom), shoes: m(outfit.shoes, 0.5), eye: m("#1a1a1a", 0.3), badge: m(outfit.badge ?? outfit.top, 0.4),
    };
  }, [outfit]);
  const geo = useMemo(
    () => ({
      thigh: capsule(0.075, 0.3),
      shin: capsule(0.06, 0.32),
      foot: (() => { const g = new THREE.BoxGeometry(0.1, 0.07, 0.24); g.translate(0, -0.035, 0.05); return g; })(),
      upper: capsule(0.055, 0.18),
      fore: capsule(0.045, 0.17),
      hand: new THREE.SphereGeometry(0.05, 8, 6),
      torso: (() => { const g = new THREE.CapsuleGeometry(0.17, 0.22, 4, 12); g.scale(1, 1, 0.68); g.translate(0, 0.27, 0); return g; })(),
      collar: (() => { const g = new THREE.CylinderGeometry(0.06, 0.09, 0.08, 10); g.translate(0, 0.5, 0.0); return g; })(),
      head: (() => { const g = new THREE.SphereGeometry(0.11, 16, 12); g.scale(0.92, 1.08, 1); return g; })(),
      hair: (() => { const g = new THREE.SphereGeometry(0.118, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62); g.scale(0.95, 1.08, 1.05); g.translate(0, 0.008, -0.01); return g; })(),
      bun: new THREE.SphereGeometry(0.06, 10, 8),
      eye: new THREE.SphereGeometry(0.014, 6, 4),
      skirt: (() => { const g = new THREE.CylinderGeometry(0.16, 0.25, 0.5, 14, 1, true); g.translate(0, -0.22, 0); return g; })(),
      hips: (() => { const g = new THREE.SphereGeometry(0.16, 12, 8); g.scale(1, 0.6, 0.75); return g; })(),
      badge: new THREE.BoxGeometry(0.05, 0.07, 0.01),
    }),
    [],
  );

  const root = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const L = { thigh: useRef<THREE.Group>(null), knee: useRef<THREE.Group>(null), sh: useRef<THREE.Group>(null), el: useRef<THREE.Group>(null) };
  const R = { thigh: useRef<THREE.Group>(null), knee: useRef<THREE.Group>(null), sh: useRef<THREE.Group>(null), el: useRef<THREE.Group>(null) };
  const st = useRef({ phase: 0, t: 0, point: 0, talk: 0, interact: 0, wave: 0, moveAmp: 0 });
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4() }), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const a = anim.current;
    if (!a || !root.current) return;
    const k = st.current;
    k.t += dt;
    const running = a.speed > 2.6;
    const stride = running ? 2.3 : 1.45; // metres per full gait cycle
    const moving = a.speed > 0.08 || Math.abs(a.turnRate) > 1.2;
    const gaitSpeed = Math.max(a.speed, Math.abs(a.turnRate) > 1.2 ? 0.6 : 0);
    k.phase += (gaitSpeed / stride) * Math.PI * 2 * dt;
    k.moveAmp += ((moving ? clamp(gaitSpeed / 1.4, 0.35, running ? 1.6 : 1) : 0) - k.moveAmp) * damp(10, dt);
    const amp = k.moveAmp;
    const ph = k.phase;
    const want = (cond: boolean, cur: number, rate = 6) => cur + ((cond ? 1 : 0) - cur) * damp(rate, dt);
    k.point = want(a.state === "point" && !!a.pointAt, k.point);
    k.talk = want(a.state === "talk" || a.state === "point", k.talk, 4);
    k.interact = want(a.state === "interact", k.interact, 8);
    k.wave = want(a.state === "wave", k.wave, 5);

    // Legs
    const swing = 0.55 * amp;
    if (L.thigh.current && R.thigh.current && L.knee.current && R.knee.current) {
      L.thigh.current.rotation.x = -Math.sin(ph) * swing;
      R.thigh.current.rotation.x = Math.sin(ph) * swing;
      L.knee.current.rotation.x = Math.max(0, Math.sin(ph - 1.2)) * 0.9 * amp + 0.02;
      R.knee.current.rotation.x = Math.max(0, Math.sin(ph + Math.PI - 1.2)) * 0.9 * amp + 0.02;
    }
    // Hips bob + lean
    if (hips.current) {
      hips.current.position.y = 0.92 + Math.abs(Math.cos(ph)) * 0.03 * amp - 0.015 * amp;
      hips.current.rotation.y = Math.sin(ph) * 0.08 * amp;
    }
    if (spine.current) {
      spine.current.rotation.x = (running ? 0.16 : 0.04) * amp + Math.sin(k.t * 1.7) * 0.01;
      spine.current.rotation.y = -Math.sin(ph) * 0.1 * amp;
      spine.current.scale.y = 1 + Math.sin(k.t * 2) * 0.008; // breathing
    }
    // Arms
    const armSwing = 0.5 * amp;
    if (L.sh.current && L.el.current) {
      L.sh.current.rotation.set(Math.sin(ph) * armSwing - 1.1 * k.interact + Math.sin(k.t * 2.4) * 0.12 * k.talk * 0.5, 0, 0.08);
      L.el.current.rotation.x = -0.25 - 0.4 * amp - 0.5 * k.interact - 0.4 * k.talk * 0.5;
    }
    if (R.sh.current && R.el.current) {
      let px = -Math.sin(ph) * armSwing - 1.1 * k.interact;
      let py = 0;
      let elbow = -0.25 - 0.4 * amp - 0.5 * k.interact;
      // talking gestures
      px += (-0.35 + Math.sin(k.t * 3.1) * 0.18) * k.talk * (1 - k.point);
      elbow += -0.7 * k.talk * (1 - k.point);
      if (a.pointAt && k.point > 0.01) {
        // direction to target in the character's local frame
        root.current.updateWorldMatrix(true, false);
        tmp.m.copy(root.current.matrixWorld).invert();
        tmp.v.copy(a.pointAt).applyMatrix4(tmp.m);
        tmp.v.y -= 1.38 * s;
        const yaw = Math.atan2(tmp.v.x, tmp.v.z);
        const elev = Math.atan2(tmp.v.y, Math.hypot(tmp.v.x, tmp.v.z));
        px = px * (1 - k.point) + (-Math.PI / 2 - elev) * k.point;
        py = clamp(yaw, -1.2, 0.9) * k.point;
        elbow = elbow * (1 - k.point) - 0.05 * k.point;
      }
      // beckoning wave
      px = px * (1 - k.wave) + -2.5 * k.wave;
      const pz = -0.08 * (1 - k.wave) + (-0.25 + Math.sin(k.t * 7) * 0.3) * k.wave;
      elbow = elbow * (1 - k.wave) - 0.5 * k.wave;
      R.sh.current.rotation.set(px, py, pz, "YXZ");
      R.el.current.rotation.x = elbow;
    }
    // Head look-at (limited)
    if (head.current) {
      let hy = 0, hx = 0;
      if (a.look) {
        root.current.updateWorldMatrix(true, false);
        tmp.m.copy(root.current.matrixWorld).invert();
        tmp.v.copy(a.look).applyMatrix4(tmp.m);
        tmp.v.y -= 1.58 * s;
        hy = clamp(Math.atan2(tmp.v.x, tmp.v.z), -1.0, 1.0);
        hx = clamp(-Math.atan2(tmp.v.y, Math.hypot(tmp.v.x, tmp.v.z)), -0.5, 0.4);
      }
      hx += Math.sin(k.t * 4.2) * 0.04 * k.talk;
      head.current.rotation.y += (hy - head.current.rotation.y) * damp(6, dt);
      head.current.rotation.x += (hx - head.current.rotation.x) * damp(6, dt);
    }
    // Fade
    for (const m of Object.values(mats)) m.opacity = a.opacity;
  });

  const shadow = castShadow;
  const limb = (side: 1 | -1, refs: typeof L) => (
    <>
      <group ref={refs.thigh} position={[0.095 * side, 0, 0]}>
        {!outfit.skirt ? <mesh geometry={geo.thigh} material={mats.bottom} castShadow={shadow} /> : <mesh geometry={geo.thigh} material={mats.skin} castShadow={shadow} />}
        <group ref={refs.knee} position={[0, -0.45, 0]}>
          <mesh geometry={geo.shin} material={outfit.skirt ? mats.skin : mats.bottom} castShadow={shadow} />
          <mesh geometry={geo.foot} material={mats.shoes} position={[0, -0.44, 0]} castShadow={shadow} />
        </group>
      </group>
    </>
  );
  const arm = (side: 1 | -1, refs: typeof L) => (
    <group ref={refs.sh} position={[0.215 * side, 0.46, 0]}>
      <mesh geometry={geo.upper} material={mats.top} castShadow={shadow} />
      <group ref={refs.el} position={[0, -0.29, 0]}>
        <mesh geometry={geo.fore} material={outfit.skirt ? mats.top : mats.skin} castShadow={shadow} />
        <mesh geometry={geo.hand} material={mats.skin} position={[0, -0.28, 0]} />
      </group>
    </group>
  );

  return (
    <group ref={root} scale={s}>
      <group ref={hips} position={[0, 0.92, 0]}>
        <mesh geometry={geo.hips} material={mats.bottom} castShadow={shadow} />
        {outfit.skirt && <mesh geometry={geo.skirt} material={mats.bottom} castShadow={shadow} />}
        {limb(1, L)}
        {limb(-1, R)}
        <group ref={spine} position={[0, 0.02, 0]}>
          <mesh geometry={geo.torso} material={mats.top} castShadow={shadow} />
          {/* blouse / shirt front */}
          <mesh position={[0, 0.36, 0.105]} rotation={[0.12, 0, 0]} material={mats.accent}>
            <planeGeometry args={[0.11, 0.2]} />
          </mesh>
          {outfit.badge && <mesh geometry={geo.badge} material={mats.badge} position={[-0.09, 0.33, 0.12]} />}
          <mesh geometry={geo.collar} material={mats.skin} />
          {arm(1, L)}
          {arm(-1, R)}
          <group ref={head} position={[0, 0.66, 0]}>
            <mesh geometry={geo.head} material={mats.skin} castShadow={shadow} />
            <mesh geometry={geo.hair} material={mats.hair} />
            {outfit.bun && <mesh geometry={geo.bun} material={mats.hair} position={[0, 0.06, -0.11]} />}
            {!outfit.bun && <mesh geometry={geo.bun} material={mats.hair} position={[0, 0.07, -0.02]} scale={[1.9, 0.6, 1.9]} />}
            <mesh geometry={geo.eye} material={mats.eye} position={[0.038, 0.015, 0.098]} />
            <mesh geometry={geo.eye} material={mats.eye} position={[-0.038, 0.015, 0.098]} />
          </group>
        </group>
      </group>
    </group>
  );
}
