"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PALETTE } from "@/lib/city/architecture";
import { buildOutskirts, type OutskirtsData } from "@/lib/city/outskirts";

/**
 * The open ring around the city: roads and water carry on past the edge, a
 * thinning fringe of houses, then open land. A few draw calls in all.
 */
export function OutskirtsLayer({ data, quality, dark, shadows }: { data: OutskirtsData; quality: "low" | "medium" | "high"; dark: boolean; shadows: boolean }) {
  const build = useMemo(() => buildOutskirts(data, quality), [data, quality]);
  useEffect(() => () => void [build.water, build.roads].forEach((g) => g.dispose()), [build]);

  const mats = useMemo(
    () => ({
      // flat layers: no depth writes, ordered by renderOrder (see CityGround)
      water: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.15, depthWrite: false }),
      roads: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, depthWrite: false }),
      walls: new THREE.MeshStandardMaterial({ roughness: 0.85 }),
      roofs: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      crowns: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    }),
    [],
  );
  useEffect(() => {
    const tint = dark ? new THREE.Color("#7f8899") : new THREE.Color("#ffffff");
    for (const m of Object.values(mats)) m.color.copy(tint);
  }, [dark, mats]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const geos = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    // gable roof along local x, unit footprint
    const roof = new THREE.CylinderGeometry(0.62, 0.62, 1, 3, 1);
    roof.rotateZ(Math.PI / 2);
    roof.scale(1, 0.55, 1);
    roof.translate(0, 0.27, 0);
    const crown = new THREE.IcosahedronGeometry(2.4, 0);
    crown.translate(0, 4.4, 0);
    return { box, roof, crown };
  }, []);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  const n = build.houses.length / 7, nt = build.trees.length / 3;
  const walls = useRef<THREE.InstancedMesh>(null);
  const roofs = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const w = walls.current, r = roofs.current;
    if (!w || !r) return;
    const o = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const [x, z, yaw, wd, dp, h, ci] = build.houses.subarray(i * 7, i * 7 + 7);
      o.position.set(x, 0, z);
      o.rotation.set(0, yaw, 0);
      o.scale.set(wd, h, dp);
      o.updateMatrix();
      w.setMatrixAt(i, o.matrix);
      w.setColorAt(i, c.copy(PALETTE.pastel[ci % PALETTE.pastel.length]));
      o.position.set(x, h, z);
      o.scale.set(wd * 1.05, Math.min(2.6, dp * 0.25), dp * 1.05);
      o.updateMatrix();
      r.setMatrixAt(i, o.matrix);
      r.setColorAt(i, c.copy(ci % 3 === 0 ? PALETTE.roofMetal[ci % PALETTE.roofMetal.length] : PALETTE.roofTile[ci % PALETTE.roofTile.length]));
    }
    for (const m of [w, r]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [build, n]);
  useLayoutEffect(() => {
    const m = crowns.current;
    if (!m) return;
    const o = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < nt; i++) {
      const [x, z, s] = build.trees.subarray(i * 3, i * 3 + 3);
      o.position.set(x, 0, z);
      o.scale.setScalar(s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.setHSL(0.27 + (i % 7) / 120, 0.5, 0.34 + (i % 5) / 50));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [build, nt]);

  return (
    <group>
      {/* under the city's own ground layers (renderOrder 10+), over the base plane */}
      <mesh geometry={build.water} material={mats.water} renderOrder={2} receiveShadow={shadows} />
      <mesh geometry={build.roads} material={mats.roads} renderOrder={3} receiveShadow={shadows} />
      {n > 0 && (
        <>
          <instancedMesh key={`w${n}`} ref={walls} args={[geos.box, mats.walls, n]} castShadow={shadows} receiveShadow={shadows} />
          <instancedMesh key={`r${n}`} ref={roofs} args={[geos.roof, mats.roofs, n]} castShadow={shadows} />
        </>
      )}
      {nt > 0 && <instancedMesh key={`t${nt}`} ref={crowns} args={[geos.crown, mats.crowns, nt]} castShadow={shadows} />}
    </group>
  );
}
