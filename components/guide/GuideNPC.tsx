"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Collider } from "@dimforge/rapier3d-compat";
import { STOP_BY_ID } from "@/data/dinh/tour";
import { floorFromY } from "@/data/dinh/layout";
import { angleDelta, damp } from "@/lib/geo";
import type { NavGraph } from "@/lib/dinh/nav";
import { runtime, useGame, type GuideState } from "@/lib/store/game";
import { useNarrator } from "@/lib/audio/narrator";
import type { Vec3 } from "@/types";
import { Humanoid, MINH_ANH, newAnim } from "@/components/player/Humanoid";

const WALK = 1.5;
const RUN = 3.8;
const HALF_H = 0.5;
const RADIUS = 0.28;

/** Signals from the UI (G key, stairs shortcut) to the guide. */
export const guideSignals = { call: false, snapBehindPlayer: false };

/**
 * Minh Anh — a guide that lives in the world. State machine:
 * FOLLOW · LEAD · WAIT · EXPLAIN · POINT · LISTEN · REJOIN.
 */
export function GuideNPC({ nav, spawn }: { nav: NavGraph; spawn: Vec3 }) {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const anim = useRef(newAnim());
  const { world, rapier } = useRapier();
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(...spawn));
  const yaw = useRef(Math.PI);
  const path = useRef<Vec3[]>([]);
  const repathAt = useRef(0);
  const lastGoal = useRef(new THREE.Vector3(1e9, 0, 0));
  const fade = useRef(1);
  const state = useRef<GuideState>("FOLLOW");
  const tmp = useMemo(
    () => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), goal: new THREE.Vector3(), look: new THREE.Vector3(), point: new THREE.Vector3(), frustum: new THREE.Frustum(), m: new THREE.Matrix4() }),
    [],
  );

  const onlyStatic = (c: Collider) => !!c.parent()?.isFixed();

  /** Line of sight at chest height between two feet positions. */
  const clear = (from: THREE.Vector3, to: THREE.Vector3) => {
    if (Math.abs(from.y - to.y) > 0.8) return false;
    const o = { x: from.x, y: from.y + 1.1, z: from.z };
    const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const len = Math.hypot(d.x, d.y, d.z);
    if (len < 0.01) return true;
    const ray = new rapier.Ray(o, { x: d.x / len, y: d.y / len, z: d.z / len });
    const hit = world.castRay(ray, len, true, undefined, undefined, undefined, undefined, onlyStatic);
    return !hit;
  };

  const groundAt = (x: number, y: number, z: number) => {
    const ray = new rapier.Ray({ x, y: y + 1.2, z }, { x: 0, y: -1, z: 0 });
    const hit = world.castRay(ray, 4, true, undefined, undefined, undefined, undefined, onlyStatic);
    return hit ? y + 1.2 - hit.timeOfImpact : y;
  };

  const nearestVisible = (p: THREE.Vector3) => {
    const cands = nav.nearest([p.x, p.y, p.z], undefined, 8);
    for (const n of cands) {
      tmp.b.set(...n.p);
      if (clear(p, tmp.b)) return n;
    }
    return cands[0];
  };

  const planTo = (goal: THREE.Vector3) => {
    const s = nearestVisible(pos.current);
    const e = nearestVisible(goal);
    const p = s && e ? nav.path(s.id, e.id) : null;
    path.current = p ? [...p.map((n) => n.p), [goal.x, goal.y, goal.z]] : [[goal.x, goal.y, goal.z]];
  };

  useFrame((frame, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const g = useGame.getState();
    const P = tmp.a.set(...runtime.player);
    const G = pos.current;
    const now = frame.clock.elapsedTime;
    const distP = Math.hypot(P.x - G.x, P.z - G.z);
    const sameFloor = floorFromY(P.y) === floorFromY(G.y);
    const talking = useNarrator.getState().status !== "idle";

    // ---- choose state
    let next: GuideState = g.guideState;
    const target = g.targetStopId ? STOP_BY_ID.get(g.targetStopId) : undefined;
    if (guideSignals.call) {
      next = "REJOIN";
    } else if (g.guideState === "EXPLAIN" || g.guideState === "POINT") {
      next = g.guideState;
    } else if (g.chatOpen && distP < 8 && sameFloor) {
      next = "LISTEN";
    } else if (!sameFloor || distP > 28) {
      next = "REJOIN";
    } else if (g.mode === "guided" && target) {
      tmp.b.set(...target.guideSpot);
      const atStop = G.distanceTo(tmp.b) < 1.2;
      next = distP > 12 && !atStop ? "WAIT" : "LEAD";
    } else {
      next = "FOLLOW";
    }
    if (next !== state.current) {
      state.current = next;
      if (g.guideState !== next && !(g.guideState === "EXPLAIN" || g.guideState === "POINT")) useGame.setState({ guideState: next });
    }
    const farFromGuide = !sameFloor || distP > 22;
    if (farFromGuide !== g.guideFar) useGame.setState({ guideFar: farFromGuide });

    // ---- rejoin by re-positioning only when necessary and out of view
    if (state.current === "REJOIN" && (guideSignals.call || distP > 60 || !sameFloor)) {
      tmp.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      tmp.frustum.setFromProjectionMatrix(tmp.m);
      tmp.b.set(G.x, G.y + 1, G.z);
      const visible = tmp.frustum.containsPoint(tmp.b) && sameFloor;
      if (!visible || guideSignals.snapBehindPlayer) {
        // place behind the player (relative to camera), on the player's level
        const back = -1;
        const cx = P.x + Math.sin(runtime.cameraYaw) * 2.2 * back + Math.cos(runtime.cameraYaw) * 1.2;
        const cz = P.z + Math.cos(runtime.cameraYaw) * 2.2 * back - Math.sin(runtime.cameraYaw) * 1.2;
        tmp.b.set(cx, P.y, cz);
        G.copy(clear(P, tmp.b) ? tmp.b : P.clone().add(new THREE.Vector3(0.8, 0, 0.8)));
        G.y = groundAt(G.x, P.y, G.z);
        path.current = [];
        fade.current = 0;
        guideSignals.call = false;
        guideSignals.snapBehindPlayer = false;
        state.current = "FOLLOW";
        useGame.setState({ guideState: "FOLLOW", guideFar: false });
      }
    }
    if (guideSignals.call && distP < 6 && sameFloor) {
      guideSignals.call = false;
    }

    // ---- goal for this state
    let goal: THREE.Vector3 | null = null;
    let speed = WALK;
    const pf = runtime.playerYaw;
    switch (state.current) {
      case "FOLLOW": {
        // behind-right of the player so she doesn't block the view
        tmp.goal.set(P.x - Math.sin(pf) * 1.9 - Math.cos(pf) * 1.3, P.y, P.z - Math.cos(pf) * 1.9 + Math.sin(pf) * 1.3);
        if (distP > 2.6 || G.distanceTo(tmp.goal) > 3.5) goal = tmp.goal;
        if (distP > 7) speed = RUN;
        break;
      }
      case "LEAD":
      case "EXPLAIN":
      case "POINT": {
        if (target) {
          tmp.goal.set(...target.guideSpot);
          if (G.distanceTo(tmp.goal) > 0.4) goal = tmp.goal;
          // stay a few metres ahead of the visitor while leading
          if (state.current === "LEAD" && distP > 7) speed = 0.9;
          if (state.current !== "LEAD") speed = WALK;
        }
        break;
      }
      case "REJOIN":
        tmp.goal.copy(P);
        goal = distP > 2.5 ? tmp.goal : null;
        speed = RUN;
        break;
      case "WAIT":
      case "LISTEN":
        goal = null;
        break;
    }

    // ---- move
    let moved = 0;
    if (goal) {
      if (clear(G, goal) && G.distanceTo(goal) < 30) {
        path.current = [[goal.x, goal.y, goal.z]];
      } else if (now > repathAt.current || goal.distanceTo(lastGoal.current) > 3 || !path.current.length) {
        planTo(goal);
        repathAt.current = now + 0.8;
        lastGoal.current.copy(goal);
      }
      const wp = path.current[0];
      if (wp) {
        tmp.b.set(...wp);
        const dx = tmp.b.x - G.x, dz = tmp.b.z - G.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.35 && path.current.length > 1) path.current.shift();
        else if (d > 0.05) {
          const stepLen = Math.min(d, speed * dt);
          G.x += (dx / d) * stepLen;
          G.z += (dz / d) * stepLen;
          moved = stepLen / dt;
          const want = Math.atan2(dx, dz);
          yaw.current += angleDelta(yaw.current, want) * damp(9, dt);
        }
        // follow the ground (ramps, stairs)
        const gy = groundAt(G.x, Math.max(G.y, tmp.b.y), G.z);
        G.y += (gy - G.y) * damp(20, dt);
      }
    }
    if (!goal || moved < 0.05) {
      // face the visitor when idle
      const want = Math.atan2(P.x - G.x, P.z - G.z);
      yaw.current += angleDelta(yaw.current, want) * damp(5, dt);
    }

    body.current?.setNextKinematicTranslation({ x: G.x, y: G.y + HALF_H + RADIUS, z: G.z });
    if (visual.current) {
      visual.current.position.copy(G);
      visual.current.rotation.y = yaw.current;
    }
    runtime.guide = [G.x, G.y, G.z];

    // ---- animation
    fade.current = Math.min(1, fade.current + dt * 1.5);
    const a = anim.current;
    a.opacity = fade.current;
    a.speed = moved;
    a.turnRate = 0;
    tmp.look.set(P.x, P.y + 1.55, P.z);
    a.look = tmp.look;
    if (state.current === "POINT" && target) {
      tmp.point.set(...target.lookAt);
      a.pointAt = tmp.point;
      a.state = "point";
    } else {
      a.pointAt = null;
      a.state = moved > 0.1 ? "move" : talking && (state.current === "EXPLAIN" || distP < 10) ? "talk" : state.current === "WAIT" ? "wave" : state.current === "LISTEN" ? "listen" : "idle";
    }
  });

  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[spawn[0], spawn[1] + HALF_H + RADIUS, spawn[2]]}>
        <CapsuleCollider args={[HALF_H, RADIUS]} />
      </RigidBody>
      <group ref={visual}>
        <Humanoid outfit={MINH_ANH} anim={anim} />
      </group>
    </>
  );
}
