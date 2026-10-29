"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { KinematicCharacterController, Collider } from "@dimforge/rapier3d-compat";
import { angleDelta, clamp, damp } from "@/lib/geo";
import { MOVE } from "@/lib/game/config";
import { runtime, useGame } from "@/lib/store/game";
import { useSettings, type Action } from "@/lib/store/settings";
import { usePointerLock } from "@/lib/game/pointer";
import { Humanoid, newAnim, VISITOR } from "./Humanoid";

const EYE = 1.62;
const HALF_H = 0.55;
const RADIUS = 0.3;
const THIRD_DIST = 4.6;

export interface CameraState {
  yaw: number;
  pitch: number;
  dist: number; // current (collision-limited) third-person distance
}

/**
 * Player: kinematic capsule moved by Rapier's character controller (walls,
 * steps, slopes, ground snapping), with first/third-person camera.
 */
export function Player({
  held,
  cam,
  spawn,
  introDone,
}: {
  held: React.RefObject<Set<Action>>;
  cam: React.RefObject<CameraState>;
  spawn: { pos: [number, number, number]; yaw: number };
  introDone: boolean;
}) {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const anim = useRef(newAnim());
  const { world, rapier } = useRapier();
  const { camera } = useThree();
  const controller = useRef<KinematicCharacterController | null>(null);
  const vel = useRef(new THREE.Vector3());
  const facing = useRef(spawn.yaw);
  const grounded = useRef(true);
  const smoothSpeed = useRef(0);
  const tmp = useMemo(() => ({ fwd: new THREE.Vector3(), right: new THREE.Vector3(), move: new THREE.Vector3(), target: new THREE.Vector3(), camPos: new THREE.Vector3() }), []);
  const camMode = useGame((s) => s.camMode);
  const phase = useGame((s) => s.phase);
  const teleport = useGame((s) => s.teleport);

  useEffect(() => {
    const c = world.createCharacterController(0.04);
    c.setUp({ x: 0, y: 1, z: 0 });
    c.setMaxSlopeClimbAngle((42 * Math.PI) / 180);
    c.setMinSlopeSlideAngle((55 * Math.PI) / 180);
    c.enableAutostep(0.35, 0.2, true);
    c.enableSnapToGround(0.4);
    c.setApplyImpulsesToDynamicBodies(false);
    controller.current = c;
    return () => {
      world.removeCharacterController(c);
      controller.current = null;
    };
  }, [world]);

  // Teleport requests (stairs shortcut, rejoin, restart).
  useEffect(() => {
    if (!teleport || !body.current) return;
    const [x, y, z] = teleport.pos;
    body.current.setNextKinematicTranslation({ x, y: y + HALF_H + RADIUS + 0.05, z });
    body.current.setTranslation({ x, y: y + HALF_H + RADIUS + 0.05, z }, true);
    vel.current.set(0, 0, 0);
    facing.current = teleport.yaw;
    if (cam.current) cam.current.yaw = teleport.yaw;
  }, [teleport, cam]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const rb = body.current;
    const ctrl = controller.current;
    const c = cam.current;
    if (!rb || !ctrl || !c) return;
    const collider = rb.collider(0) as unknown as Collider;
    // frozen while a door / stair transition fades
    const playing = phase === "playing" && !useGame.getState().fade;

    // ---- input
    const keys = held.current;
    let ix = 0, iz = 0;
    if (playing) {
      if (keys?.has("forward")) iz += 1;
      if (keys?.has("back")) iz -= 1;
      if (keys?.has("left")) ix -= 1;
      if (keys?.has("right")) ix += 1;
      ix += runtime.input.x;
      iz += runtime.input.y;
    }
    // normalise so diagonals are never faster than straight lines
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    const running = playing && (keys?.has("run") || runtime.input.run);
    const speedTarget = (running ? MOVE.run : MOVE.walk) * Math.min(1, len);

    // camera-relative movement
    tmp.fwd.set(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    tmp.right.set(-Math.cos(c.yaw), 0, Math.sin(c.yaw));
    tmp.move.copy(tmp.fwd).multiplyScalar(iz).addScaledVector(tmp.right, ix);
    if (tmp.move.lengthSq() > 1e-6) tmp.move.normalize();

    // accelerate / decelerate at bounded rates (responsive, never instantaneous)
    const horiz = new THREE.Vector3(vel.current.x, 0, vel.current.z);
    const desired = tmp.move.clone().multiplyScalar(speedTarget);
    const dv = desired.clone().sub(horiz);
    const maxDv = (speedTarget > 0.01 ? MOVE.accel : MOVE.decel) * dt;
    if (dv.length() > maxDv) dv.setLength(maxDv);
    horiz.add(dv);
    vel.current.x = horiz.x;
    vel.current.z = horiz.z;

    // gravity / jump
    if (grounded.current) {
      vel.current.y = -2;
      if (playing && (keys?.has("jump") || runtime.input.jump)) {
        vel.current.y = MOVE.jumpVelocity;
        runtime.input.jump = false;
      }
    } else {
      vel.current.y -= MOVE.gravity * dt;
    }

    const desiredMove = { x: vel.current.x * dt, y: vel.current.y * dt, z: vel.current.z * dt };
    ctrl.computeColliderMovement(collider, desiredMove, rapier.QueryFilterFlags.EXCLUDE_SENSORS);
    const m = ctrl.computedMovement();
    grounded.current = ctrl.computedGrounded();
    const p = rb.translation();
    const next = { x: p.x + m.x, y: p.y + m.y, z: p.z + m.z };
    // Safety net: never fall out of the world.
    if (next.y < -30) {
      next.x = spawn.pos[0]; next.y = spawn.pos[1] + 2; next.z = spawn.pos[2];
    }
    rb.setNextKinematicTranslation(next);
    // measured (collision-limited) ground speed drives the gait: walking into a wall never "runs in place"
    const actualSpeed = Math.hypot(m.x, m.z) / Math.max(dt, 1e-4);
    smoothSpeed.current += (actualSpeed - smoothSpeed.current) * damp(14, dt);

    // ---- facing & animation
    const feetY = next.y - HALF_H - RADIUS;
    let turnRate = 0;
    if (camMode === "first") {
      const d = angleDelta(facing.current, c.yaw);
      facing.current += d;
      turnRate = d / dt;
    } else if (horiz.lengthSq() > 0.05) {
      const want = Math.atan2(horiz.x, horiz.z);
      const d = angleDelta(facing.current, want);
      const step = clamp(d * damp(12, dt), -MOVE.turnRate * dt, MOVE.turnRate * dt);
      facing.current += step;
      turnRate = step / dt;
    }
    if (visual.current) {
      visual.current.position.set(next.x, feetY, next.z);
      visual.current.rotation.y = facing.current;
      visual.current.visible = camMode === "third";
    }
    const a = anim.current;
    a.speed = grounded.current ? smoothSpeed.current : 0;
    a.turnRate = turnRate;
    a.state = useGame.getState().panel ? "interact" : "move";

    runtime.player = [next.x, feetY, next.z];
    runtime.playerYaw = facing.current;
    runtime.playerSpeed = smoothSpeed.current;
    runtime.cameraYaw = c.yaw;

    // ---- camera
    if (!introDone) return;
    const pitch = c.pitch;
    if (camMode === "first") {
      camera.position.set(next.x, feetY + EYE, next.z);
      // nudge the eye slightly forward, then pull back if that would clip a wall
      tmp.target.set(next.x + Math.sin(c.yaw) * Math.cos(pitch), feetY + EYE + Math.sin(pitch), next.z + Math.cos(c.yaw) * Math.cos(pitch));
      camera.lookAt(tmp.target);
    } else {
      tmp.target.set(next.x, feetY + 1.55, next.z);
      const dir = new THREE.Vector3(-Math.sin(c.yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(c.yaw) * Math.cos(pitch));
      // camera collision: ray from the head toward the desired camera spot
      const ray = new rapier.Ray({ x: tmp.target.x, y: tmp.target.y, z: tmp.target.z }, { x: dir.x, y: dir.y, z: dir.z });
      const hit = world.castRay(ray, THIRD_DIST, true, undefined, undefined, collider);
      const allowed = hit ? Math.max(0.6, hit.timeOfImpact - 0.3) : THIRD_DIST;
      // shrink fast (avoid clipping), grow back slowly (avoid popping)
      c.dist += (allowed - c.dist) * damp(allowed < c.dist ? 30 : 4, dt);
      c.dist = Math.min(c.dist, allowed + 0.05);
      tmp.camPos.copy(tmp.target).addScaledVector(dir, c.dist);
      camera.position.copy(tmp.camPos);
      camera.lookAt(tmp.target);
    }
    (camera as THREE.PerspectiveCamera).near = camMode === "first" ? 0.08 : 0.15;
  });

  return (
    <>
      <RigidBody
        ref={body}
        type="kinematicPosition"
        colliders={false}
        position={[spawn.pos[0], spawn.pos[1] + HALF_H + RADIUS + 0.05, spawn.pos[2]]}
        enabledRotations={[false, false, false]}
      >
        <CapsuleCollider args={[HALF_H, RADIUS]} />
      </RigidBody>
      <group ref={visual}>
        <Humanoid outfit={VISITOR} anim={anim} />
      </group>
    </>
  );
}

/**
 * Mouse / touch look. With pointer lock, raw mouse deltas turn the camera;
 * without it, dragging on the scene does. Deltas are only applied while the
 * lock is held (no drift after Esc), the first events after a lock change and
 * single-event spikes (a known browser glitch) are discarded.
 */
export function useLook(cam: React.RefObject<CameraState>, canvas: HTMLCanvasElement | null, enabled: boolean) {
  useEffect(() => {
    if (!canvas) return;
    let dragging = false;
    let lastX = 0, lastY = 0;
    const apply = (dx: number, dy: number) => {
      const c = cam.current;
      if (!c || !enabled) return;
      const s = useSettings.getState();
      const k = 0.0022 * s.sensitivity;
      c.yaw -= dx * k;
      c.pitch += (s.invertY ? dy : -dy) * k;
      c.pitch = clamp(c.pitch, -1.2, 1.2);
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      if (performance.now() - usePointerLock.getState().changedAt < 80) return;
      if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
      apply(e.movementX, e.movementY);
    };
    const onDown = (e: PointerEvent) => {
      if (document.pointerLockElement === canvas) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPMove = (e: PointerEvent) => {
      if (!dragging || document.pointerLockElement === canvas) return;
      apply((e.clientX - lastX) * 1.6, (e.clientY - lastY) * 1.6);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => (dragging = false);
    // a lock change always ends any drag in progress
    const unsub = usePointerLock.subscribe(() => (dragging = false));
    document.addEventListener("mousemove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onPMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      unsub();
      document.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onPMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [cam, canvas, enabled]);
}
