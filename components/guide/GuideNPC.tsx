"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { STOP_BY_ID } from "@/data/dinh/tour";
import { floorFromY } from "@/data/dinh/layout";
import { DICTS } from "@/data/i18n";
import { angleDelta, damp } from "@/lib/geo";
import { narrator, useNarrator } from "@/lib/audio/narrator";
import { GUIDE } from "@/lib/game/config";
import { GuideBrain } from "@/lib/guide/brain";
import { guideSignals } from "@/lib/guide/signals";
import { pointAt, project, type Route, type RoutePlanner } from "@/lib/dinh/route";
import { runtime, useGame, type GuideNotice } from "@/lib/store/game";
import { useSettings } from "@/lib/store/settings";
import { currentDestination } from "@/lib/tour/navigator";
import { arriveAt, isNarrated } from "@/lib/tour/director";
import type { Vec3 } from "@/types";
import { Humanoid, MINH_ANH, newAnim } from "@/components/player/Humanoid";

const HALF_H = 0.5;
const RADIUS = 0.28;

/**
 * Minh Anh in the world. Decisions come from GuideBrain (lib/guide/brain.ts);
 * this component plans her routes with the same planner as the visitor's
 * directions, walks her along them (never through walls), animates her and
 * turns brain events into speech and HUD notices.
 */
export function GuideNPC({ planner, spawn }: { planner: RoutePlanner; spawn: Vec3 }) {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const anim = useRef(newAnim());
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(...spawn));
  const yaw = useRef(Math.PI);
  const brain = useRef(new GuideBrain());
  const nav = useRef({ route: null as Route | null, s: 0, key: "", plannedAt: -10, from: [0, 0, 0] as Vec3 });
  const st = useRef({ fade: 1, explainAt: -1, noticeUntil: 0, notice: null as GuideNotice, reminder: 0, measured: 0 });
  const tmp = useMemo(() => ({ look: new THREE.Vector3(), point: new THREE.Vector3(), frustum: new THREE.Frustum(), m: new THREE.Matrix4(), v: new THREE.Vector3() }), []);

  useFrame((frame, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const now = frame.clock.elapsedTime;
    const g = useGame.getState();
    if (g.phase !== "playing" && g.phase !== "paused") return;
    const P = runtime.player;
    const G = pos.current;
    const k = st.current;
    const sameFloor = floorFromY(P[1]) === floorFromY(G.y);
    const dist = sameFloor ? Math.hypot(P[0] - G.x, P[2] - G.z) : Infinity;
    const lang = useSettings.getState().lang;
    const t = DICTS[lang];
    const nar = useNarrator.getState();
    const narrating = nar.status !== "idle";

    // ---- shortcut teleports (stairs): she comes along, with a notice
    if (guideSignals.snapBehindPlayer) {
      guideSignals.snapBehindPlayer = false;
      const back: Vec3 = [P[0] - Math.sin(runtime.cameraYaw) * 1.8 + Math.cos(runtime.cameraYaw) * 1.1, P[1], P[2] - Math.cos(runtime.cameraYaw) * 1.8 - Math.sin(runtime.cameraYaw) * 1.1];
      const spot = planner.freePointNear(back, 3) ?? planner.freePointNear(P, 3) ?? P;
      G.set(spot[0], spot[1], spot[2]);
      nav.current.route = null;
      nav.current.key = "";
      k.fade = 0;
      brain.current.reset(g.guideLeading ? "LEADING" : "FOLLOWING");
      notify("shortcut", now + 4);
    }

    // ---- what is she doing?
    const dest = currentDestination();
    const leading = g.guideLeading && !!dest;
    const intent = leading ? "lead" : g.mode === "free" || !dest ? "follow" : "idle";
    const spotRaw: Vec3 | null = leading ? dest!.guideSpot : null;

    // ---- her route (lead: to her spot; follow: to a point near the visitor)
    let goal: Vec3 | null = null;
    if (leading && spotRaw) goal = spotRaw;
    else if (intent === "follow") {
      const want = guideSignals.call ? 1.6 : GUIDE.followDist + 1.2;
      if (dist > want || !sameFloor) {
        const pf = runtime.playerYaw;
        goal = [P[0] - Math.sin(pf) * 1.9 - Math.cos(pf) * 1.2, P[1], P[2] - Math.cos(pf) * 1.9 + Math.sin(pf) * 1.2];
      } else guideSignals.call = false;
    }
    const n = nav.current;
    const goalKey = goal ? (leading ? `lead:${dest!.key}` : "follow") : "";
    const keyChanged = goalKey !== n.key;
    const stale =
      goal &&
      (keyChanged ||
        (leading && !n.route && now - n.plannedAt > 3) || // retry a failed plan now and then
        (!leading && now - n.plannedAt > 0.7 && Math.hypot(goal[0] - n.from[0], goal[2] - n.from[2]) > 1.5));
    if (goal && stale) {
      const freeGoal = planner.freePointNear(goal, 6) ?? goal;
      const r = planner.plan([G.x, G.y, G.z], freeGoal);
      n.route = r;
      n.s = 0;
      n.key = goalKey;
      n.plannedAt = now;
      n.from = [...goal];
      if (leading && keyChanged) brain.current.reset(r ? "LEADING" : "WAITING");
    }
    if (!goal) {
      n.route = null;
      n.key = "";
    }
    const route = n.route;

    // ---- brain
    let gap: number | null = null;
    if (leading && route && sameFloor) {
      const pp = project(route, P);
      if (pp.d < 6) gap = n.s - pp.s;
    } else if (leading && route && !sameFloor) gap = 99;
    const atSpot = leading && !!route && route.length - n.s < 0.3;
    const stop = dest?.kind === "stop" ? STOP_BY_ID.get(dest.id) : undefined;
    const explainDue = g.mode === "guided" && !!stop && !isNarrated(stop.id);
    const playerToSpot = dest && floorFromY(P[1]) === floorFromY(dest.point[1]) ? Math.hypot(P[0] - dest.point[0], P[2] - dest.point[2]) : Infinity;
    const out = brain.current.update(dt, {
      intent,
      dist,
      gap,
      playerSpeed: runtime.playerSpeed,
      atSpot,
      playerToSpot,
      explainDue,
      narrating,
      chatOpen: g.chatOpen,
      hasRoute: !leading || !!route,
    });

    for (const e of out.events) {
      if (e === "startExplain" && stop) {
        k.explainAt = now;
        arriveAt(stop.id, useSettings.getState().autoNarrate);
      } else if (e === "pauseNarration") {
        narrator?.pause();
        notify("narrationPaused", Infinity);
      } else if (e === "resumeNarration") {
        narrator?.resume();
        notify(null, 0);
      } else if (e === "remind") {
        const line = t.guide.reminders[k.reminder++ % t.guide.reminders.length];
        narrator?.play(line, lang, "guide:remind", t.guide.name);
      } else if (e === "resume") {
        if (!narrating) narrator?.play(t.guide.resumeLines[Math.floor(now) % t.guide.resumeLines.length], lang, "guide:resume", t.guide.name);
      } else if (e === "noRoute") notify("noRoute", now + 6);
    }
    // waiting notice follows the state
    const waiting = out.state === "WAITING_FOR_PLAYER" || out.state === "REMINDING";
    if (waiting && k.notice !== "narrationPaused") notify("waiting", Infinity);
    else if (!waiting && k.notice === "waiting") notify(null, 0);
    if (out.state !== "EXPLAINING" && k.notice === "narrationPaused") notify(null, 0);
    if (k.notice && now > k.noticeUntil) notify(null, 0);

    // ---- move along the route
    let moved = 0;
    const prev = tmp.v.copy(G);
    if (route) {
      let speed = 0;
      if (leading) speed = out.state === "LEADING" || out.state === "CHECKING_DISTANCE" || out.state === "RESUMING" ? out.speed : 0;
      else if (intent === "follow" && out.state === "FOLLOWING") speed = dist > 9 || guideSignals.call ? GUIDE.hurry : dist > GUIDE.followDist + 0.4 ? GUIDE.walk : 0;
      n.s = Math.min(route.length, n.s + speed * dt);
      const p = pointAt(route, n.s);
      G.set(p[0], p[1], p[2]);
      moved = prev.distanceTo(G) / dt;
      if (moved > 0.05) {
        const ahead = pointAt(route, n.s + 1);
        const want = Math.atan2(ahead[0] - G.x, ahead[2] - G.z);
        if (Math.hypot(ahead[0] - G.x, ahead[2] - G.z) > 0.05) yaw.current += angleDelta(yaw.current, want) * damp(8, dt);
      }
    }
    // Far apart on another floor in free mode (or called from very far): rejoin out of sight.
    if (intent === "follow" && (!sameFloor || dist > 70) && !route) {
      tmp.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      tmp.frustum.setFromProjectionMatrix(tmp.m);
      if (!tmp.frustum.containsPoint(tmp.point.set(G.x, G.y + 1, G.z)) || !sameFloor) {
        const spot = planner.freePointNear([P[0] - Math.sin(runtime.playerYaw) * 2.5, P[1], P[2] - Math.cos(runtime.playerYaw) * 2.5], 3);
        if (spot) {
          G.set(spot[0], spot[1], spot[2]);
          k.fade = 0;
          n.route = null;
          n.key = "";
        }
      }
    }
    // Facing: toward the route when walking or about to; toward the visitor otherwise.
    const facePlayer = moved < 0.05 && out.state !== "RESUMING" && dist < 30;
    if (facePlayer) {
      const want = Math.atan2(P[0] - G.x, P[2] - G.z);
      yaw.current += angleDelta(yaw.current, want) * damp(4, dt);
    } else if (out.state === "RESUMING" && route) {
      const ahead = pointAt(route, n.s + 1.5);
      yaw.current += angleDelta(yaw.current, Math.atan2(ahead[0] - G.x, ahead[2] - G.z)) * damp(6, dt);
    }

    body.current?.setNextKinematicTranslation({ x: G.x, y: G.y + HALF_H + RADIUS, z: G.z });
    if (visual.current) {
      visual.current.position.copy(G);
      visual.current.rotation.y = yaw.current;
    }
    runtime.guide = [G.x, G.y, G.z];

    // beacon above her head while she waits for a visitor who is far behind
    if (beacon.current) {
      beacon.current.visible = waiting && dist > GUIDE.waitDist;
      beacon.current.position.y = 2.25 + Math.sin(now * 3) * 0.08;
      beacon.current.rotation.y = now * 1.5;
    }

    // ---- animation
    k.measured += (moved - k.measured) * damp(12, dt);
    k.fade = Math.min(1, k.fade + dt * 1.5);
    const a = anim.current;
    a.opacity = k.fade;
    a.speed = k.measured;
    a.turnRate = 0;
    tmp.look.set(P[0], P[1] + 1.55, P[2]);
    a.look = dist < 25 ? tmp.look : null;
    a.pointAt = null;
    if (out.state === "EXPLAINING" && stop && now - k.explainAt < 6) {
      tmp.point.set(...stop.lookAt);
      a.pointAt = tmp.point;
      a.state = "point";
    } else if (out.state === "EXPLAINING" || (nar.status === "speaking" && dist < 10)) a.state = "talk";
    else if (out.state === "REMINDING") a.state = "wave";
    else if (out.state === "LISTENING") a.state = "listen";
    else a.state = k.measured > 0.1 ? "move" : "idle";

    // ---- publish coarse state
    const farFromGuide = g.mode === "free" && (!sameFloor || dist > 22);
    const gapR = Math.round(dist === Infinity ? 99 : dist);
    if (out.state !== g.guideState || farFromGuide !== g.guideFar || (waiting && gapR !== g.guideGap)) useGame.setState({ guideState: out.state, guideFar: farFromGuide, guideGap: gapR });

    function notify(nt: GuideNotice, until: number) {
      k.notice = nt;
      k.noticeUntil = until;
      if (useGame.getState().guideNotice !== nt) useGame.setState({ guideNotice: nt });
    }
  });

  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[spawn[0], spawn[1] + HALF_H + RADIUS, spawn[2]]}>
        <CapsuleCollider args={[HALF_H, RADIUS]} />
      </RigidBody>
      <group ref={visual}>
        <Humanoid outfit={MINH_ANH} anim={anim} />
        <mesh ref={beacon} visible={false}>
          <octahedronGeometry args={[0.14, 0]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </group>
    </>
  );
}
