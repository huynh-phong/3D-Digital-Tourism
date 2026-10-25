"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "@/lib/geo";
import { sampleLane, type Lane } from "@/lib/city/buildCity";
import type { P2 } from "@/lib/city/types";

const CAR_COLORS = ["#f4f4f2", "#1d2733", "#b8bcc2", "#c0392b", "#2f6fb2", "#e8c547", "#6b7b8c", "#f0f0f0"];
const BIKE_COLORS = ["#c0392b", "#1f2a36", "#2f6fb2", "#e2e2e2", "#d35400", "#2c8a5a"];

function carGeometry() {
  const body = new THREE.BoxGeometry(1.8, 0.9, 4.3);
  body.translate(0, 0.75, 0);
  const cabin = new THREE.BoxGeometry(1.6, 0.6, 2.2);
  cabin.translate(0, 1.5, -0.2);
  return mergeGeometries([body, cabin])!;
}

function bikeGeometry() {
  const bike = new THREE.BoxGeometry(0.5, 0.7, 1.8);
  bike.translate(0, 0.55, 0);
  const rider = new THREE.CapsuleGeometry(0.28, 0.6, 2, 6);
  rider.translate(0, 1.45, -0.1);
  const helmet = new THREE.SphereGeometry(0.2, 8, 6);
  helmet.translate(0, 2.0, -0.1);
  return mergeGeometries([bike, rider, helmet])!;
}

interface Vehicle {
  lane: number;
  s: number;
  v: number;
  car: boolean;
  wait: number;
}

const MIN_GAP_CAR = 7;
const MIN_GAP_BIKE = 3.5;

/**
 * Cars and motorbikes driving on the right-hand lanes derived from OSM roads.
 * Vehicles follow the one ahead in their lane (no overlap) and take turns
 * through junctions with a simple per-junction lock.
 */
export function Traffic({ lanes, count, paused }: { lanes: Lane[]; count: number; paused: boolean }) {
  const carRef = useRef<THREE.InstancedMesh>(null);
  const bikeRef = useRef<THREE.InstancedMesh>(null);
  const carGeo = useMemo(() => carGeometry(), []);
  const bikeGeo = useMemo(() => bikeGeometry(), []);

  const sim = useMemo(() => {
    const R = rng(304);
    const vehicles: Vehicle[] = [];
    const usable = lanes.map((l, i) => i).filter((i) => lanes[i].length > 30);
    if (!usable.length) return { vehicles, cars: 0, bikes: 0, R };
    // Spread vehicles proportionally to lane length.
    const total = usable.reduce((a, i) => a + lanes[i].length, 0);
    for (const i of usable) {
      const n = Math.round((lanes[i].length / total) * count);
      for (let k = 0; k < n; k++) {
        vehicles.push({ lane: i, s: ((k + R() * 0.5) / Math.max(1, n)) * lanes[i].length, v: 0, car: R() < 0.35, wait: 0 });
      }
    }
    return { vehicles, cars: vehicles.filter((v) => v.car).length, bikes: vehicles.filter((v) => !v.car).length, R };
  }, [lanes, count]);

  useEffect(() => {
    const c = new THREE.Color();
    let ci = 0, bi = 0;
    for (const v of sim.vehicles) {
      if (v.car) carRef.current?.setColorAt(ci++, c.set(CAR_COLORS[Math.floor(sim.R() * CAR_COLORS.length)]));
      else bikeRef.current?.setColorAt(bi++, c.set(BIKE_COLORS[Math.floor(sim.R() * BIKE_COLORS.length)]));
    }
    if (carRef.current?.instanceColor) carRef.current.instanceColor.needsUpdate = true;
    if (bikeRef.current?.instanceColor) bikeRef.current.instanceColor.needsUpdate = true;
  }, [sim]);

  const tmp = useMemo(() => ({ o: new THREE.Object3D(), p: { x: 0, z: 0, dx: 0, dz: 1 } }), []);
  const locks = useMemo(() => new Map<string, number>(), []);
  const byLane = useMemo(() => new Map<number, Vehicle[]>(), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const { vehicles } = sim;
    const now = state.clock.elapsedTime;
    if (!paused) {
      byLane.clear();
      for (const v of vehicles) {
        let arr = byLane.get(v.lane);
        if (!arr) byLane.set(v.lane, (arr = []));
        arr.push(v);
      }
      for (const [laneIdx, arr] of byLane) {
        arr.sort((a, b) => b.s - a.s);
        const lane = lanes[laneIdx];
        for (let k = 0; k < arr.length; k++) {
          const v = arr[k];
          const gapMin = v.car ? MIN_GAP_CAR : MIN_GAP_BIKE;
          let target = lane.speed * (v.car ? 1 : 1.1);
          if (k > 0) {
            const gap = arr[k - 1].s - v.s;
            target = Math.min(target, Math.max(0, (gap - gapMin) * 1.2));
          }
          const remaining = lane.length - v.s;
          if (remaining < 8) {
            const lock = locks.get(lane.endKey) ?? 0;
            if (lock > now && v.wait === 0) target = Math.min(target, Math.max(0, remaining - 2));
          }
          v.v += (target - v.v) * Math.min(1, dt * 2.5);
          v.s += v.v * dt;
          if (v.s >= lane.length) {
            const lock = locks.get(lane.endKey) ?? 0;
            const choices = lane.next;
            if (!choices.length || lock > now) {
              v.s = lane.length - 0.01;
              v.v = 0;
              v.wait += dt;
              if (v.wait > 6 && choices.length === 0) {
                // Dead end: respawn quietly on a random lane start.
                v.lane = Math.floor(sim.R() * lanes.length);
                v.s = 0;
                v.wait = 0;
              }
              continue;
            }
            const nextIdx = choices[Math.floor(sim.R() * choices.length)];
            const occupied = vehicles.some((o) => o !== v && o.lane === nextIdx && o.s < gapMin + 1);
            if (occupied) {
              v.s = lane.length - 0.01;
              v.v = 0;
              continue;
            }
            locks.set(lane.endKey, now + (v.car ? 1.3 : 0.8));
            v.lane = nextIdx;
            v.s = 0;
            v.wait = 0;
          }
        }
      }
    }

    let ci = 0, bi = 0;
    for (const v of vehicles) {
      sampleLane(lanes[v.lane], v.s, tmp.p);
      tmp.o.position.set(tmp.p.x, 0.12, tmp.p.z);
      tmp.o.rotation.set(0, Math.atan2(tmp.p.dx, tmp.p.dz), 0);
      tmp.o.updateMatrix();
      if (v.car) carRef.current?.setMatrixAt(ci++, tmp.o.matrix);
      else bikeRef.current?.setMatrixAt(bi++, tmp.o.matrix);
    }
    if (carRef.current) carRef.current.instanceMatrix.needsUpdate = true;
    if (bikeRef.current) bikeRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!sim.vehicles.length) return null;
  return (
    <group>
      <instancedMesh ref={carRef} args={[carGeo, undefined, Math.max(1, sim.cars)]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.45} metalness={0.2} />
      </instancedMesh>
      <instancedMesh ref={bikeRef} args={[bikeGeo, undefined, Math.max(1, sim.bikes)]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
    </group>
  );
}

/** People strolling on pedestrian streets (e.g. Nguyễn Huệ). */
export function Pedestrians({ walkways, count }: { walkways: { pts: P2[]; cum: number[]; length: number }[]; count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.CapsuleGeometry(0.25, 1.0, 2, 6);
    g.translate(0, 0.85, 0);
    return g;
  }, []);
  const people = useMemo(() => {
    const R = rng(7);
    if (!walkways.length) return [];
    return Array.from({ length: count }, () => {
      const w = Math.floor(R() * walkways.length);
      return { w, s: R() * walkways[w].length, dir: R() < 0.5 ? 1 : -1, off: (R() - 0.5) * 12, speed: 0.9 + R() * 0.6, phase: R() * 10 };
    });
  }, [walkways, count]);
  useEffect(() => {
    const c = new THREE.Color();
    const R = rng(8);
    const palette = ["#e74c3c", "#3498db", "#f1c40f", "#ecf0f1", "#2ecc71", "#9b59b6", "#e67e22", "#34495e"];
    people.forEach((_, i) => ref.current?.setColorAt(i, c.set(palette[Math.floor(R() * palette.length)])));
    if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [people]);
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), p: { x: 0, z: 0, dx: 0, dz: 1 } }), []);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    people.forEach((p, i) => {
      const w = walkways[p.w];
      p.s += p.dir * p.speed * Math.min(dt, 0.05);
      if (p.s > w.length) { p.s = w.length; p.dir = -1; }
      if (p.s < 0) { p.s = 0; p.dir = 1; }
      sampleLane(w, p.s, tmp.p);
      const nx = -tmp.p.dz, nz = tmp.p.dx;
      tmp.o.position.set(tmp.p.x + nx * p.off, 0.12 + Math.abs(Math.sin(t * 6 + p.phase)) * 0.05, tmp.p.z + nz * p.off);
      tmp.o.rotation.set(0, Math.atan2(tmp.p.dx * p.dir, tmp.p.dz * p.dir), 0);
      tmp.o.updateMatrix();
      ref.current?.setMatrixAt(i, tmp.o.matrix);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  });
  if (!people.length) return null;
  return (
    <instancedMesh ref={ref} args={[geo, undefined, people.length]} frustumCulled={false}>
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
}
