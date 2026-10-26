"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { clamp, damp } from "@/lib/geo";
import { GAIT } from "@/lib/game/config";

const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

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
    const m = (c: string, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
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
  const R_ = { thigh: useRef<THREE.Group>(null), knee: useRef<THREE.Group>(null), sh: useRef<THREE.Group>(null), el: useRef<THREE.Group>(null) };
  const st = useRef({ phase: 0, t: 0, point: 0, talk: 0, interact: 0, wave: 0, listen: 0, moveAmp: 0, run: 0 });
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4() }), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const a = anim.current;
    if (!a || !root.current) return;
    const k = st.current;
    k.t += dt;
    // ---- gait, driven by the measured ground speed (no foot sliding):
    // cycle length grows with speed; thigh amplitude is chosen so the stance
    // foot moves backward at the body's speed on average (A = cycle / 4·leg).
    const v = a.speed;
    const leg = GAIT.legLength * s;
    k.run += (smoothstep(GAIT.runBlendFrom, GAIT.runBlendTo, v) - k.run) * damp(8, dt); // walk↔run blend
    const turningInPlace = v < 0.35 && Math.abs(a.turnRate) > 1.2;
    const cycle = GAIT.cycleBase + GAIT.cyclePerSpeed * v;
    const freq = turningInPlace ? 1.1 : v / cycle;
    k.phase += freq * Math.PI * 2 * dt;
    const targetAmp = turningInPlace ? 0.35 : clamp(v / 0.5, 0, 1);
    k.moveAmp += (targetAmp - k.moveAmp) * damp(targetAmp > k.moveAmp ? 12 : 9, dt);
    if (k.moveAmp < 0.08) {
      // stopping: let the legs settle together instead of freezing mid-stride
      const rest = Math.round(k.phase / Math.PI) * Math.PI;
      k.phase += (rest - k.phase) * damp(8, dt);
    }
    const amp = k.moveAmp;
    const ph = k.phase;
    const R = k.run;
    const thighA = Math.min(0.85, (turningInPlace ? 0.6 : cycle) / (4 * leg)) * amp;
    const want = (cond: boolean, cur: number, rate = 6) => cur + ((cond ? 1 : 0) - cur) * damp(rate, dt);
    k.point = want(a.state === "point" && !!a.pointAt, k.point);
    k.talk = want(a.state === "talk" || a.state === "point", k.talk, 4);
    k.interact = want(a.state === "interact", k.interact, 8);
    k.wave = want(a.state === "wave", k.wave, 5);
    k.listen = want(a.state === "listen", k.listen, 4);

    // Legs: walk keeps the knee nearly straight in stance; run tucks the swing leg high.
    if (L.thigh.current && R_.thigh.current && L.knee.current && R_.knee.current) {
      L.thigh.current.rotation.x = -Math.sin(ph) * thighA - 0.08 * R * amp;
      R_.thigh.current.rotation.x = Math.sin(ph) * thighA - 0.08 * R * amp;
      const kneeWalk = (q: number) => Math.max(0, Math.sin(q - 1.2)) * 0.9 * thighA * 1.6 + 0.03;
      const kneeRun = (q: number) => (0.35 + Math.max(0, Math.sin(q - 0.5)) * 1.5) * amp;
      L.knee.current.rotation.x = kneeWalk(ph) * (1 - R) + kneeRun(ph) * R;
      R_.knee.current.rotation.x = kneeWalk(ph + Math.PI) * (1 - R) + kneeRun(ph + Math.PI) * R;
    }
    // Hips: walk bobs twice per cycle; running adds a flight bounce and drops the hips slightly.
    if (hips.current) {
      const walkBob = Math.abs(Math.cos(ph)) * 0.028 - 0.014;
      const runBob = Math.abs(Math.sin(ph)) * 0.055 - 0.05;
      hips.current.position.y = 0.92 + (walkBob * (1 - R) + runBob * R) * amp;
      hips.current.rotation.y = Math.sin(ph) * (0.08 + 0.05 * R) * amp;
    }
    if (spine.current) {
      // forward lean grows with speed; lean into turns (sign follows the turn)
      spine.current.rotation.x = (0.04 + 0.18 * R) * amp + Math.sin(k.t * 1.7) * 0.008;
      spine.current.rotation.y = -Math.sin(ph) * (0.1 + 0.06 * R) * amp;
      spine.current.rotation.z = clamp(-a.turnRate * v * 0.012, -0.14, 0.14);
      spine.current.scale.y = 1 + Math.sin(k.t * 2) * 0.008; // breathing
    }
    // Arms: relaxed swing when walking, bent pumping arms when running.
    const armSwing = (0.45 * (1 - R) + 0.85 * R) * amp * Math.min(1, thighA / 0.4 + 0.3);
    const elbowBase = -0.22 - (0.25 * (1 - R) + 1.35 * R) * amp;
    if (L.sh.current && L.el.current) {
      L.sh.current.rotation.set(Math.sin(ph) * armSwing - 1.1 * k.interact + Math.sin(k.t * 2.4) * 0.06 * k.talk - 0.25 * k.listen, 0, 0.08 + 0.05 * R);
      L.el.current.rotation.x = elbowBase - 0.5 * k.interact - 0.2 * k.talk - 0.9 * k.listen;
    }
    if (R_.sh.current && R_.el.current) {
      let px = -Math.sin(ph) * armSwing - 1.1 * k.interact;
      let py = 0;
      let elbow = elbowBase - 0.5 * k.interact;
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
      const pz = (-0.08 - 0.05 * R) * (1 - k.wave) + (-0.25 + Math.sin(k.t * 7) * 0.3) * k.wave;
      elbow = elbow * (1 - k.wave) - 0.5 * k.wave;
      R_.sh.current.rotation.set(px, py, pz, "YXZ");
      R_.el.current.rotation.x = elbow;
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
    // Fade (materials are only transparent while fading, so they sort and shade as solids otherwise)
    const fading = a.opacity < 0.999;
    for (const m of Object.values(mats)) {
      m.opacity = a.opacity;
      if (m.transparent !== fading) {
        m.transparent = fading;
        m.depthWrite = !fading;
        m.needsUpdate = true;
      }
    }
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
        {limb(-1, R_)}
        <group ref={spine} position={[0, 0.02, 0]}>
          <mesh geometry={geo.torso} material={mats.top} castShadow={shadow} />
          {/* blouse / shirt front */}
          <mesh position={[0, 0.36, 0.105]} rotation={[0.12, 0, 0]} material={mats.accent}>
            <planeGeometry args={[0.11, 0.2]} />
          </mesh>
          {outfit.badge && <mesh geometry={geo.badge} material={mats.badge} position={[-0.09, 0.33, 0.12]} />}
          <mesh geometry={geo.collar} material={mats.skin} />
          {arm(1, L)}
          {arm(-1, R_)}
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
