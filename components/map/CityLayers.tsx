"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type CameraControlsImpl from "camera-controls";
import type { CityBuild, Tree } from "@/lib/city/buildCity";
import { facadeMaterial, facadeUniforms, makeFacadeTextures, makeRoofTextures } from "@/lib/city/textures";
import type { FacadeStyle, RoofStyle } from "@/lib/city/architecture";
import { makeWaterMaterial, waterUniforms } from "@/lib/city/waterMaterial";
import { SUN_DIR } from "./Sky";

/** Buildings: one mesh per facade style / roof style, plus a detail mesh. */
export function CityBuildings({ city, dark, shadows }: { city: CityBuild; dark: boolean; shadows: boolean }) {
  /*
   * Chunk-aware detail LOD. Building meshes come in chunks (walls/roofs 1 km, details 400 m),
   * each frustum-culled by three.js on its own, so chunks outside the frame or behind the
   * camera are never drawn. Facade/street details are refined per chunk: a chunk's details
   * fade in (dithered alpha-hash: no sorting, no hard pop) only when that chunk is in view
   * and its nearest point is within ~650 m of the camera; chunks further away in the frame
   * keep the plain walls and roofs. Each detail chunk has its own material (same shader
   * program) so the fades are independent.
   */
  const detailChunks = useMemo(() => {
    const out: { key: string; g: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial; centre: THREE.Vector3; radius: number }[] = [];
    for (const [k, g] of Object.entries(city.buckets)) {
      if (!k.startsWith("details")) continue;
      if (!g.boundingSphere) g.computeBoundingSphere();
      out.push({ key: k, g, mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, alphaHash: true }), centre: g.boundingSphere!.center.clone(), radius: g.boundingSphere!.radius });
    }
    return out;
  }, [city]);
  useEffect(() => () => detailChunks.forEach((d) => d.mat.dispose()), [detailChunks]);
  const detailMeshes = useRef(new Map<string, THREE.Mesh>());
  const frustum = useMemo(() => new THREE.Frustum(), []);
  const pm = useMemo(() => new THREE.Matrix4(), []);
  const sphere = useMemo(() => new THREE.Sphere(), []);
  useFrame(({ camera }) => {
    frustum.setFromProjectionMatrix(pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const d of detailChunks) {
      const m = detailMeshes.current.get(d.key);
      if (!m) continue;
      const near = Math.max(0, camera.position.distanceTo(d.centre) - d.radius * 0.7);
      const inView = frustum.intersectsSphere(sphere.set(d.centre, d.radius));
      const o = inView ? 1 - THREE.MathUtils.smoothstep(near, 450, 650) : 0;
      m.visible = o > 0.01;
      d.mat.opacity = o;
    }
  });
  const mats = useMemo(() => {
    const facades = makeFacadeTextures();
    const roofs = makeRoofTextures();
    const m = new Map<string, THREE.Material>();
    for (const [k, t] of Object.entries(facades)) m.set(`wall:${k}`, facadeMaterial(t, k as FacadeStyle));
    for (const [k, t] of Object.entries(roofs))
      m.set(`roof:${k}`, new THREE.MeshStandardMaterial({ vertexColors: true, map: t, roughness: k === "metal" ? 0.45 : 0.85, metalness: k === "metal" ? 0.25 : 0 }));
    return { m, textures: [...Object.values(facades).flatMap((f) => [f.map, f.tint, f.emissive]), ...Object.values(roofs)] };
  }, []);

  useEffect(() => {
    for (const [k, mat] of mats.m) {
      if (!k.startsWith("wall:")) continue;
      const s = mat as THREE.MeshStandardMaterial;
      // which windows are lit, their colour and brightness are chosen per window in the shader
      s.emissive.set(dark ? "#ffffff" : "#000000");
      s.emissiveIntensity = 1;
      s.needsUpdate = true;
    }
    facadeUniforms.uWin.value = dark ? 0.85 : 0;
  }, [dark, mats]);

  useEffect(
    () => () => {
      mats.m.forEach((x) => x.dispose());
      mats.textures.forEach((t) => t.dispose());
    },
    [mats],
  );

  return (
    <group>
      {Object.entries(city.buckets).map(([k, g]) =>
        k.startsWith("details") ? null : (
          <mesh key={k} geometry={g} material={mats.m.get(k.split("@")[0])} castShadow={shadows} receiveShadow={shadows} />
        ),
      )}
      {/* details (frames, bands, balconies, rooftop kit) receive shadows but don't cast them */}
      {detailChunks.map((d) => (
        <mesh
          key={d.key}
          ref={(m) => {
            if (m) detailMeshes.current.set(d.key, m);
            else detailMeshes.current.delete(d.key);
          }}
          geometry={d.g}
          material={d.mat}
          receiveShadow={shadows}
          visible={false}
        />
      ))}
    </group>
  );
}

export type { FacadeStyle, RoofStyle };

/**
 * Ground layers are drawn as ordered decals: no depth writes, increasing
 * renderOrder (green → water → banks → sidewalks → asphalt → markings), all
 * after the opaque scene. Overlapping flat ribbons therefore can't z-fight,
 * and anything standing on the ground still occludes them correctly.
 */
const LAYERS = ["green", "water", "banks", "walks", "roads", "markings"] as const;

export function CityGround({ city, dark, shadows }: { city: CityBuild; dark: boolean; shadows: boolean }) {
  const mats = useMemo(() => {
    const decal = (extra: THREE.MeshStandardMaterialParameters = {}) =>
      // FrontSide: every ground triangle faces up, so a flipped one would show as a hole in tests, not as a dark patch
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.FrontSide, depthWrite: false, ...extra });
    // stylised animated river with boat wakes (lib/city/waterMaterial.ts)
    const water = makeWaterMaterial({ side: THREE.FrontSide });
    return { green: decal({ roughness: 1 }), water, banks: decal(), walks: decal({ roughness: 0.95 }), roads: decal({ roughness: 0.9 }), markings: decal({ roughness: 0.8 }), decks: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }) };
  }, []);
  useFrame((s) => {
    waterUniforms.uTime.value = s.clock.elapsedTime;
  });
  useEffect(() => {
    const tint = dark ? new THREE.Color("#a6b0c4") : new THREE.Color("#ffffff");
    Object.values(mats).forEach((m) => m.color.copy(tint));
    waterUniforms.uNight.value = dark ? 1 : 0;
    waterUniforms.uSky.value.set(dark ? "#3c5078" : "#cfe8e5");
  }, [dark, mats]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const g = city.ground;
  return (
    <group>
      {LAYERS.map((k, i) => (
        <mesh key={k} geometry={g[k]} material={mats[k]} renderOrder={10 + i} receiveShadow={shadows} />
      ))}
      <mesh geometry={g.decks} material={mats.decks} castShadow={shadows} receiveShadow={shadows} />
    </group>
  );
}

/**
 * Six stylised tree species as instanced meshes (one trunk + one crown mesh
 * each), every crown built from a few low-poly volumes rather than one ball.
 */
export function CityTrees({ trees, dark, shadows }: { trees: Tree[]; dark: boolean; shadows: boolean }) {
  const kinds = useMemo(() => {
    const trunk = (r0: number, r1: number, h: number) => {
      const t = new THREE.CylinderGeometry(r0, r1, h, 6);
      t.translate(0, h / 2, 0);
      return t;
    };
    const blob = (r: number, x: number, y: number, z: number, sy = 0.85) => {
      const c = new THREE.IcosahedronGeometry(r, 0);
      c.scale(1, sy, 1);
      c.translate(x, y, z);
      return c;
    };
    // round canopy: a cluster of three volumes
    const round = { t: trunk(0.22, 0.32, 3.2), c: mergeGeometries([blob(2.1, 0, 4.7, 0), blob(1.6, 1.3, 4.1, 0.6), blob(1.5, -1.1, 4.3, -0.7)])! };
    const tall = { t: trunk(0.25, 0.4, 9), c: mergeGeometries([blob(2.4, 0, 10.6, 0, 1.2), blob(1.6, 0.9, 8.6, 0.5)])! };
    const small = { t: trunk(0.15, 0.2, 1.4), c: mergeGeometries([blob(1.4, 0, 2.4, 0), blob(1, 0.8, 1.9, 0.3)])! };
    const cone = (() => {
      const a = new THREE.ConeGeometry(2, 3.6, 7);
      a.translate(0, 3.6, 0);
      const b = new THREE.ConeGeometry(1.5, 3, 7);
      b.translate(0, 5.6, 0);
      return { t: trunk(0.2, 0.28, 2.2), c: mergeGeometries([a, b])! };
    })();
    const layered = (() => {
      const disc = (r: number, y: number) => {
        const d = new THREE.CylinderGeometry(r * 0.75, r, 0.9, 8);
        d.translate(0, y, 0);
        return d;
      };
      return { t: trunk(0.22, 0.32, 6.2), c: mergeGeometries([disc(2.8, 4.2), disc(2.1, 5.4), disc(1.3, 6.5)])! };
    })();
    const broad = { t: trunk(0.3, 0.45, 3.6), c: mergeGeometries([blob(2.6, 0, 4.9, 0, 0.5), blob(2, 1.9, 4.6, 0.8, 0.5), blob(2, -1.8, 4.7, -0.9, 0.5)])! };
    return [round, tall, small, cone, layered, broad];
  }, []);
  useEffect(() => () => kinds.forEach((k) => { k.t.dispose(); k.c.dispose(); }), [kinds]);
  const groups = useMemo(() => kinds.map((_, k) => trees.filter((t) => t.k === k)), [trees, kinds]);
  return (
    <group>
      {groups.map((list, k) => (
        <TreeKindMesh key={k} list={list} geo={kinds[k]} kind={k} dark={dark} shadows={shadows} />
      ))}
    </group>
  );
}

/** Camera heights (m) over which small trees and street-lamp poles dissolve (LOD). */
const FADE_SMALL: [number, number] = [900, 1300];

function TreeKindMesh({ list, geo, kind, dark, shadows }: { list: Tree[]; geo: { t: THREE.BufferGeometry; c: THREE.BufferGeometry }; kind: number; dark: boolean; shadows: boolean }) {
  const trunk = useRef<THREE.InstancedMesh>(null);
  const crown = useRef<THREE.InstancedMesh>(null);
  // LOD: bushes and small ornamental trees (kind 2) dissolve when seen from high up
  useFrame(({ camera }) => {
    if (kind !== 2) return;
    const o = 1 - THREE.MathUtils.smoothstep(camera.position.y, FADE_SMALL[0], FADE_SMALL[1]);
    for (const m of [trunk.current, crown.current]) {
      if (!m) continue;
      m.visible = o > 0.01;
      (m.material as THREE.MeshStandardMaterial).opacity = o;
    }
  });
  useEffect(() => {
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    // per-species greens: dark glossy dầu, yellow-green ornamentals, blue-green conifers, fresh greens for the rest
    const hues = [[0.25, 0.33], [0.27, 0.3], [0.2, 0.3], [0.36, 0.42], [0.24, 0.3], [0.22, 0.28]][kind] ?? [0.25, 0.36];
    list.forEach((tr, i) => {
      o.position.set(tr.x, 0, tr.z);
      o.scale.setScalar(tr.s);
      o.rotation.set(0, (i * 2.399) % 6.283, 0);
      o.updateMatrix();
      trunk.current?.setMatrixAt(i, o.matrix);
      crown.current?.setMatrixAt(i, o.matrix);
      const h = hues[0] + ((i * 7919) % 100) / 100 * (hues[1] - hues[0]);
      // fresh, clear greens (lighter than before so canopies read as foliage, not dark blobs)
      crown.current?.setColorAt(i, col.setHSL(h, 0.58 + ((i * 31) % 10) / 50, 0.4 + ((i * 13) % 10) / 60));
    });
    for (const m of [trunk.current, crown.current]) if (m) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
    if (crown.current?.instanceColor) crown.current.instanceColor.needsUpdate = true;
  }, [list, kind]);
  if (!list.length) return null;
  return (
    <group>
      <instancedMesh ref={trunk} args={[geo.t, undefined, list.length]} castShadow={shadows}>
        <meshStandardMaterial color="#7a5638" roughness={1} alphaHash={kind === 2} />
      </instancedMesh>
      <instancedMesh ref={crown} args={[geo.c, undefined, list.length]} castShadow={shadows} receiveShadow={shadows}>
        <meshStandardMaterial roughness={0.9} flatShading color={dark ? "#b4c6ae" : "#ffffff"} alphaHash={kind === 2} />
      </instancedMesh>
    </group>
  );
}

/** Sun whose shadow frustum follows the camera target and scales with zoom. */
export function CitySun({ dark, shadows, quality, controls }: { dark: boolean; shadows: boolean; quality: string; controls: React.RefObject<CameraControlsImpl | null> }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const { scene } = useThree();
  const tgt = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    scene.add(target);
    return () => void scene.remove(target);
  }, [scene, target]);
  useFrame(() => {
    const l = light.current;
    const c = controls.current;
    if (!l || !c) return;
    c.getTarget(tgt);
    // Shadow frustum in coarse steps (no constant re-projection while zooming)...
    const d = Math.ceil(THREE.MathUtils.clamp(c.distance * 0.7, 140, 1100) / 60) * 60;
    // ...and snapped to whole shadow texels so shadows don't swim while panning.
    const texel = (2 * d) / l.shadow.mapSize.x;
    tgt.x = Math.round(tgt.x / texel) * texel;
    tgt.z = Math.round(tgt.z / texel) * texel;
    target.position.set(tgt.x, 0, tgt.z);
    target.updateMatrixWorld();
    const reach = d * 1.6 + 300;
    l.position.set(tgt.x + SUN_DIR.x * reach, SUN_DIR.y * reach, tgt.z + SUN_DIR.z * reach);
    const cam = l.shadow.camera;
    if (cam.right !== d) {
      cam.left = -d; cam.right = d; cam.top = d; cam.bottom = -d;
      cam.far = d * 4 + 800;
      cam.updateProjectionMatrix();
    }
    // Far out, a shadow texel spans metres and shadows turn into dark smears: fade them away.
    l.shadow.intensity = 1 - THREE.MathUtils.smoothstep(c.distance, 900, 1500);
    // LOD: past 1.6 km shadows are fully faded — skip rendering the shadow map (a whole scene pass)
    // ...but only once the map exists: a never-rendered shadow map leaves the materials sampling a
    // missing depth texture, and on some GPUs every shadow-receiving draw then fails (empty city on first load)
    l.shadow.autoUpdate = c.distance < 1600 || !l.shadow.map;
  });
  const size = quality === "high" ? 4096 : 2048;
  return (
    <directionalLight
      ref={light}
      target={target}
      intensity={dark ? 0.8 : 2.75}
      color={dark ? "#b3c4ff" : "#ffe2b8"}
      castShadow={shadows}
      shadow-mapSize={[size, size]}
      shadow-bias={-0.0006}
      shadow-normalBias={0.6}
    />
  );
}

/**
 * Street lamps along the arterials (one every ~38 m on the kerb side of each
 * carriageway). By day just poles; at night the lamp heads glow softly and each
 * throws a warm pool of light on the road — the night city is lit by its
 * streets, not only by windows. Three instanced meshes in all.
 */
export function StreetLights({ city, dark }: { city: CityBuild; dark: boolean }) {
  const spots = useMemo(() => {
    const out: { x: number; z: number; yaw: number }[] = [];
    const taken = new Set<string>();
    for (const l of city.lanes) {
      if (l.cls === "local" || l.length < 30) continue;
      const off = l.oneway ? l.width / 2 + 0.8 : l.width / 4 + 0.8;
      const step = l.cls === "major" ? 30 : 42;
      for (let s = 12; s < l.length - 6 && out.length < 4200; s += step) {
        let k = 1;
        while (k < l.cum.length - 1 && l.cum[k] < s) k++;
        const a = l.pts[k - 1], b = l.pts[k];
        const seg = l.cum[k] - l.cum[k - 1] || 1, t = (s - l.cum[k - 1]) / seg;
        const dx = (b[0] - a[0]) / seg, dz = (b[1] - a[1]) / seg;
        if ((l.ys[k - 1] ?? 0) > 0.5) continue; // not on bridges and flyovers
        const x = a[0] + (b[0] - a[0]) * t - dz * off, z = a[1] + (b[1] - a[1]) * t + dx * off;
        const key = `${Math.round(x / 16)},${Math.round(z / 16)}`;
        if (taken.has(key)) continue;
        taken.add(key);
        out.push({ x, z, yaw: Math.atan2(dx, dz) });
      }
    }
    return out;
  }, [city]);
  const geo = useMemo(() => {
    const pole = new THREE.CylinderGeometry(0.07, 0.1, 6.5, 6);
    pole.translate(0, 3.25, 0);
    const head = new THREE.BoxGeometry(0.35, 0.16, 1.1);
    head.translate(0, 6.45, -0.45); // arm reaches out over the road
    const pool = new THREE.CircleGeometry(8, 24);
    pool.rotateX(-Math.PI / 2);
    pool.translate(0, 0.08, -1.2);
    return { pole, head, pool };
  }, []);
  const mats = useMemo(() => ({
    pole: new THREE.MeshStandardMaterial({ color: "#5d646b", roughness: 0.6, metalness: 0.3, alphaHash: true }),
    head: new THREE.MeshStandardMaterial({ color: "#eef0f2", roughness: 0.4, alphaHash: true }),
    // soft additive pool: brightest under the lamp, fading out
    pool: new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color("#ffb46a") } },
      vertexShader: "varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 uColor; varying vec2 vP; void main(){ float d = length(vP - vec2(0.0, -1.2)) / 8.0; float a = pow(max(0.0, 1.0 - d), 1.8) * 0.6; gl_FragColor = vec4(uColor * a, 1.0); }",
    }),
  }), []);
  useEffect(() => {
    mats.head.emissive.set(dark ? "#ffd29a" : "#000000");
    mats.head.emissiveIntensity = dark ? 2.4 : 0;
  }, [dark, mats]);
  useEffect(() => () => { Object.values(geo).forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose()); }, [geo, mats]);
  const pole = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const pool = useRef<THREE.InstancedMesh>(null);
  // LOD: poles and lamp heads dissolve from high up; at night the light pools stay (they read as the lit street grid)
  useFrame(({ camera }) => {
    const o = 1 - THREE.MathUtils.smoothstep(camera.position.y, FADE_SMALL[0], FADE_SMALL[1]);
    for (const m of [pole.current, head.current]) if (m) m.visible = o > 0.01;
    mats.pole.opacity = mats.head.opacity = o;
  });
  useEffect(() => {
    const meshes = [pole.current, head.current, pool.current];
    const o = new THREE.Object3D();
    spots.forEach((sp, i) => {
      o.position.set(sp.x, 0, sp.z);
      // the arm and its light point towards the carriageway (to the lamp's left)
      o.rotation.set(0, sp.yaw - Math.PI / 2, 0);
      o.updateMatrix();
      for (const m of meshes) m?.setMatrixAt(i, o.matrix);
    });
    for (const m of meshes) if (m) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
  }, [spots, dark]); // the pool mesh only exists at night: re-place it when it appears
  if (!spots.length) return null;
  return (
    <group>
      <instancedMesh ref={pole} args={[geo.pole, mats.pole, spots.length]} castShadow={false} />
      <instancedMesh ref={head} args={[geo.head, mats.head, spots.length]} />
      {dark && <instancedMesh ref={pool} args={[geo.pool, mats.pool, spots.length]} renderOrder={18} />}
    </group>
  );
}
