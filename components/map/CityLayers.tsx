"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type CameraControlsImpl from "camera-controls";
import type { CityBuild, Tree } from "@/lib/city/buildCity";
import { facadeMaterial, makeFacadeTextures, makeRoofTextures } from "@/lib/city/textures";
import type { FacadeStyle, RoofStyle } from "@/lib/city/architecture";

/** Buildings: one mesh per facade style / roof style, plus a detail mesh. */
export function CityBuildings({ city, dark, shadows, controls }: { city: CityBuild; dark: boolean; shadows: boolean; controls: React.RefObject<CameraControlsImpl | null> }) {
  const details = useRef<THREE.Mesh>(null);
  // Street furniture is invisible from far away: skip drawing it (and its shadows) when zoomed out.
  useFrame(() => {
    if (details.current && controls.current) details.current.visible = controls.current.distance < 1500;
  });
  const mats = useMemo(() => {
    const facades = makeFacadeTextures();
    const roofs = makeRoofTextures();
    const m = new Map<string, THREE.Material>();
    for (const [k, t] of Object.entries(facades)) m.set(`wall:${k}`, facadeMaterial(t));
    for (const [k, t] of Object.entries(roofs))
      m.set(`roof:${k}`, new THREE.MeshStandardMaterial({ vertexColors: true, map: t, roughness: k === "metal" ? 0.45 : 0.85, metalness: k === "metal" ? 0.25 : 0 }));
    m.set("details", new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
    return { m, textures: [...Object.values(facades).flatMap((f) => [f.map, f.tint, f.emissive]), ...Object.values(roofs)] };
  }, []);

  useEffect(() => {
    for (const [k, mat] of mats.m) {
      if (!k.startsWith("wall:")) continue;
      const s = mat as THREE.MeshStandardMaterial;
      s.emissive.set(dark ? "#ffd08a" : "#000000");
      s.emissiveIntensity = dark ? 1.0 : 0;
      s.needsUpdate = true;
    }
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
      {Object.entries(city.buckets).map(([k, g]) => (
        <mesh key={k} ref={k === "details" ? details : undefined} geometry={g} material={mats.m.get(k) ?? mats.m.get("details")} castShadow={shadows} receiveShadow={shadows} />
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
  const waterTime = useMemo(() => ({ value: 0 }), []);
  const mats = useMemo(() => {
    const decal = (extra: THREE.MeshStandardMaterialParameters = {}) =>
      // FrontSide: every ground triangle faces up, so a flipped one would show as a hole in tests, not as a dark patch
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.FrontSide, depthWrite: false, ...extra });
    const water = decal({ roughness: 0.18, metalness: 0.15 });
    // gentle animated ripples: perturb the shading normal with a few sine waves
    water.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = waterTime;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nuniform float uTime;")
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
          vec2 wp = vWPos.xz * 0.12;
          float rx = sin(wp.x * 1.7 + uTime * 0.9) + sin(wp.y * 2.3 - uTime * 1.3) * 0.6;
          float rz = cos(wp.y * 1.9 + uTime * 1.1) + cos((wp.x + wp.y) * 1.3 - uTime * 0.7) * 0.5;
          normal = normalize(normal + (viewMatrix * vec4(rx * 0.06, 0.0, rz * 0.06, 0.0)).xyz);`,
        );
    };
    return { green: decal({ roughness: 1 }), water, banks: decal(), walks: decal({ roughness: 0.95 }), roads: decal({ roughness: 0.9 }), markings: decal({ roughness: 0.8 }), decks: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }) };
  }, [waterTime]);
  useFrame((s) => {
    waterTime.value = s.clock.elapsedTime;
  });
  useEffect(() => {
    const tint = dark ? new THREE.Color("#7f8899") : new THREE.Color("#ffffff");
    Object.values(mats).forEach((m) => m.color.copy(tint));
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

/** Three tree species as instanced meshes, each with varied greens. */
export function CityTrees({ trees, dark, shadows }: { trees: Tree[]; dark: boolean; shadows: boolean }) {
  const kinds = useMemo(() => {
    const round = (() => {
      const t = new THREE.CylinderGeometry(0.22, 0.32, 3.2, 6);
      t.translate(0, 1.6, 0);
      const c = new THREE.IcosahedronGeometry(2.3, 1);
      c.scale(1, 0.85, 1);
      c.translate(0, 4.6, 0);
      return { t, c };
    })();
    const tall = (() => {
      const t = new THREE.CylinderGeometry(0.25, 0.4, 9, 6);
      t.translate(0, 4.5, 0);
      const c = new THREE.IcosahedronGeometry(2.6, 1);
      c.scale(0.9, 1.25, 0.9);
      c.translate(0, 10.5, 0);
      return { t, c };
    })();
    const small = (() => {
      const t = new THREE.CylinderGeometry(0.15, 0.2, 1.8, 5);
      t.translate(0, 0.9, 0);
      const c = new THREE.IcosahedronGeometry(1.5, 1);
      c.translate(0, 2.8, 0);
      return { t, c };
    })();
    return [round, tall, small];
  }, []);
  const groups = useMemo(() => [0, 1, 2].map((k) => trees.filter((t) => t.k === k)), [trees]);
  return (
    <group>
      {groups.map((list, k) => (
        <TreeKindMesh key={k} list={list} geo={kinds[k]} kind={k} dark={dark} shadows={shadows} />
      ))}
    </group>
  );
}

function TreeKindMesh({ list, geo, kind, dark, shadows }: { list: Tree[]; geo: { t: THREE.BufferGeometry; c: THREE.BufferGeometry }; kind: number; dark: boolean; shadows: boolean }) {
  const trunk = useRef<THREE.InstancedMesh>(null);
  const crown = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    const hues = kind === 1 ? [0.27, 0.3] : kind === 2 ? [0.22, 0.33] : [0.25, 0.36];
    list.forEach((tr, i) => {
      o.position.set(tr.x, 0, tr.z);
      o.scale.setScalar(tr.s);
      o.rotation.set(0, (i * 2.399) % 6.283, 0);
      o.updateMatrix();
      trunk.current?.setMatrixAt(i, o.matrix);
      crown.current?.setMatrixAt(i, o.matrix);
      const h = hues[0] + ((i * 7919) % 100) / 100 * (hues[1] - hues[0]);
      crown.current?.setColorAt(i, col.setHSL(h, 0.55 + ((i * 31) % 10) / 50, 0.34 + ((i * 13) % 10) / 70));
    });
    for (const m of [trunk.current, crown.current]) if (m) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
    if (crown.current?.instanceColor) crown.current.instanceColor.needsUpdate = true;
  }, [list, kind]);
  if (!list.length) return null;
  return (
    <group>
      <instancedMesh ref={trunk} args={[geo.t, undefined, list.length]} castShadow={shadows}>
        <meshStandardMaterial color="#7a5638" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crown} args={[geo.c, undefined, list.length]} castShadow={shadows} receiveShadow={shadows}>
        <meshStandardMaterial roughness={0.9} flatShading color={dark ? "#8fa38a" : "#ffffff"} />
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
    l.position.set(tgt.x - d * 0.55, d * 1.1 + 200, tgt.z + d * 0.45);
    const cam = l.shadow.camera;
    if (cam.right !== d) {
      cam.left = -d; cam.right = d; cam.top = d; cam.bottom = -d;
      cam.far = d * 4 + 800;
      cam.updateProjectionMatrix();
    }
    // Far out, a shadow texel spans metres and shadows turn into dark smears: fade them away.
    l.shadow.intensity = 1 - THREE.MathUtils.smoothstep(c.distance, 900, 1500);
  });
  const size = quality === "high" ? 4096 : 2048;
  return (
    <directionalLight
      ref={light}
      target={target}
      intensity={dark ? 0.35 : 2.6}
      color={dark ? "#9db4ff" : "#fff1d6"}
      castShadow={shadows}
      shadow-mapSize={[size, size]}
      shadow-bias={-0.0006}
      shadow-normalBias={0.6}
    />
  );
}
